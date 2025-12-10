import express from 'express';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const router = express.Router();

// --------- Firebase Admin / Firestore ---------
let db;
try {
  initializeApp({
    credential: applicationDefault(),
  });
  db = getFirestore();
} catch (error) {
  if (/already exists/u.test(error.message)) {
    db = getFirestore();
  } else {
    console.error('Erro ao inicializar Firebase Admin:', error);
  }
}

// --------- helpers ---------
function mapMeetingDoc(doc) {
  return {
    id: doc.id,
    ...doc.data(),
  };
}

// GET /api/meetings - Listar reuniões (com filtros opcionais)
router.get('/', async (req, res) => {
  try {
    const { status, date } = req.query;

    let ref = db.collection('meetings');

    // filtro por status direto no Firestore (se quiser)
    if (status) {
      ref = ref.where('status', '==', status);
    }

    const snapshot = await ref.get();

    let meetings = snapshot.docs.map(mapMeetingDoc);

    // filtro por data (scheduledDate é string YYYY-MM-DD)
    if (date) {
      meetings = meetings.filter(
        (m) => m.scheduledDate === date
      );
    }

    res.json({
      success: true,
      data: {
        meetings,
        total: meetings.length,
      },
    });
  } catch (error) {
    console.error('Erro ao listar reuniões:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar reuniões',
      error: error.message,
    });
  }
});

// POST /api/meetings - Agendar nova reunião
router.post('/', async (req, res) => {
  try {
    console.log('Requisição para agendar reunião:', req.body);
    const {
      solicitacaoId,
      studentName,
      studentEmail,
      scheduledDate,
      scheduledTime,
      duration = 60,
      notes,
      discenteId,
      curso,
    } = req.body;

    // Validações básicas
    if (
      !solicitacaoId ||
      !studentName ||
      !studentEmail ||
      !scheduledDate ||
      !scheduledTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Dados obrigatórios: solicitacaoId, studentName, studentEmail, scheduledDate, scheduledTime',
      });
    }

    // Verificar se já existe reunião para esta solicitação
    const existingSnap = await db
      .collection('meetings')
      .where('solicitacaoId', '==', solicitacaoId)
      .get();
    console.log('Existing meetings for solicitacaoId:', existingSnap.size);
    if (!existingSnap.empty) {
      return res.status(409).json({
        success: false,
        message: 'Já existe uma reunião agendada para esta solicitação',
      });
    }

    const nowIso = new Date().toISOString();
    const dateTimeIso = new Date(
      `${scheduledDate}T${scheduledTime}:00`
    ).toISOString();

    const newMeeting = {
      solicitacaoId,
      studentName,
      studentEmail,
      discenteId: discenteId || null,
      curso: curso || null,
      scheduledDate, // "YYYY-MM-DD"
      scheduledTime, // "HH:mm"
      duration,
      notes: notes || '',
      status: 'agendada',
      createdAt: nowIso,
      dateTime: dateTimeIso,
      meetLink: null,
      transcriptionId: null,
    };

    const docRef = await db.collection('meetings').add(newMeeting);

    const saved = { id: docRef.id, ...newMeeting };

    res.status(201).json({
      success: true,
      message: 'Reunião agendada com sucesso',
      data: saved,
    });
  } catch (error) {
    console.error('Erro ao agendar reunião:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao agendar reunião',
      error: error.message,
    });
  }
});

// GET /api/meetings/available-slots/:date - Obter horários disponíveis
router.get('/available-slots/:date', async (req, res) => {
  try {
    const { date } = req.params;

    // Horários de funcionamento (9h às 17h, de 30 em 30)
    const workingHours = [];
    for (let hour = 9; hour < 17; hour++) {
      workingHours.push(`${hour.toString().padStart(2, '0')}:00`);
      workingHours.push(`${hour.toString().padStart(2, '0')}:30`);
    }

    // Busca reuniões já agendadas para essa data
    const snapshot = await db
      .collection('meetings')
      .where('scheduledDate', '==', date)
      .get();

    const occupiedDocs = snapshot.docs
      .map((doc) => doc.data())
      .filter((m) => m.status !== 'cancelada');

    const occupiedSlots = occupiedDocs.map((m) => m.scheduledTime);

    const availableSlots = workingHours.filter(
      (slot) => !occupiedSlots.includes(slot)
    );

    res.json({
      success: true,
      data: {
        date,
        availableSlots,
        occupiedSlots,
        totalAvailable: availableSlots.length,
      },
    });
  } catch (error) {
    console.error('Erro ao obter horários disponíveis:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter horários disponíveis',
      error: error.message,
    });
  }
});

// GET /api/meetings/can-schedule/:discenteId
// Verifica se o discente ainda pode agendar sessão no período
router.get('/can-schedule/:discenteId', async (req, res) => {
  try {
    const { discenteId } = req.params;

    if (!discenteId) {
      return res.status(400).json({
        success: false,
        message: 'discenteId é obrigatório',
      });
    }

    // 1) Lê configuração do semestre no Firestore
    const cfgRef = db.collection('semestreLetivo').doc('semestreLetivoConfig');
    const cfgSnap = await cfgRef.get();

    const now = new Date();
    let maxSessions = 0;
    let periodStart;
    let periodEnd;

    if (cfgSnap.exists) {
      const cfg = cfgSnap.data() || {};

      // limite configurado no Firestore
      maxSessions = cfg.maxSessionsPerDiscente || 0;

      if (cfg.periodStart) {
        periodStart = new Date(cfg.periodStart);
      }
      if (cfg.periodEnd) {
        periodEnd = new Date(cfg.periodEnd);
      }
    }

    // Fallback: se não tiver período configurado, usa últimos 6 meses
    if (!periodStart || !periodEnd) {
      periodEnd = now;
      periodStart = new Date(
        now.getFullYear(),
        now.getMonth() - 6,
        now.getDate()
      );
    }

    // 2) Busca meetings desse discente no Firestore
    const snapshot = await db
      .collection('meetings')
      .where('discenteId', '==', discenteId)
      .get();

    let countInPeriod = 0;

    snapshot.forEach((docSnap) => {
      const m = docSnap.data() || {};

      // ignora canceladas
      if (m.status === 'cancelada') return;

      // tenta pegar data mais precisa
      let d;
      if (m.dateTime) {
        d = new Date(m.dateTime);
      } else if (m.scheduledDate) {
        // scheduledDate é "YYYY-MM-DD"
        d = new Date(`${m.scheduledDate}T00:00:00`);
      } else if (m.createdAt) {
        d = new Date(m.createdAt);
      } else {
        return;
      }

      if (Number.isNaN(d.getTime())) return;

      if (d >= periodStart && d <= periodEnd) {
        countInPeriod++;
      }
    });

    const remaining =
      maxSessions > 0 ? Math.max(0, maxSessions - countInPeriod) : 0;

    res.json({
      success: true,
      data: {
        // se maxSessions = 0, consideramos "sem limite" -> sempre allowed
        allowed: maxSessions === 0 ? true : remaining > 0,
        remaining,
        used: countInPeriod,
        limit: maxSessions,
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: periodEnd.toISOString().slice(0, 10),
      },
    });
  } catch (error) {
    console.error('Erro ao verificar limite de sessões:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar limite de sessões',
      error: error.message,
    });
  }
});

// GET /api/meetings/:id - Obter reunião específica
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection('meetings').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Reunião não encontrada',
      });
    }

    res.json({
      success: true,
      data: mapMeetingDoc(snap),
    });
  } catch (error) {
    console.error('Erro ao obter reunião:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter reunião',
      error: error.message,
    });
  }
});

// PUT /api/meetings/:id - Atualizar reunião
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection('meetings').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Reunião não encontrada',
      });
    }

    const {
      scheduledDate,
      scheduledTime,
      duration,
      notes,
      status,
      meetLink,
    } = req.body;

    const updates = {
      updatedAt: new Date().toISOString(),
    };

    if (scheduledDate) updates.scheduledDate = scheduledDate;
    if (scheduledTime) updates.scheduledTime = scheduledTime;
    if (duration) updates.duration = duration;
    if (notes !== undefined) updates.notes = notes;
    if (status) updates.status = status;
    if (meetLink) updates.meetLink = meetLink;

    await docRef.update(updates);

    const updatedSnap = await docRef.get();

    res.json({
      success: true,
      message: 'Reunião atualizada com sucesso',
      data: mapMeetingDoc(updatedSnap),
    });
  } catch (error) {
    console.error('Erro ao atualizar reunião:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar reunião',
      error: error.message,
    });
  }
});

// DELETE /api/meetings/:id - Cancelar reunião (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection('meetings').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Reunião não encontrada',
      });
    }

    const updates = {
      status: 'cancelada',
      cancelledAt: new Date().toISOString(),
    };

    await docRef.update(updates);

    const updatedSnap = await docRef.get();

    res.json({
      success: true,
      message: 'Reunião cancelada com sucesso',
      data: mapMeetingDoc(updatedSnap),
    });
  } catch (error) {
    console.error('Erro ao cancelar reunião:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao cancelar reunião',
      error: error.message,
    });
  }
});

// POST /api/meetings/:id/complete - Marcar reunião como concluída
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { transcriptionId, notes } = req.body;

    const docRef = db.collection('meetings').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Reunião não encontrada',
      });
    }

    const updates = {
      status: 'concluida',
      completedAt: new Date().toISOString(),
    };

    if (transcriptionId) updates.transcriptionId = transcriptionId;
    if (notes) updates.completionNotes = notes;

    await docRef.update(updates);

    const updatedSnap = await docRef.get();

    res.json({
      success: true,
      message: 'Reunião marcada como concluída',
      data: mapMeetingDoc(updatedSnap),
    });
  } catch (error) {
    console.error('Erro ao concluir reunião:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao concluir reunião',
      error: error.message,
    });
  }
});

export default router;
