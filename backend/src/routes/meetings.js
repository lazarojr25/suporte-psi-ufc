import express from 'express';
import { getAdminDb } from '../firebaseAdmin.js';
import { createMeetEvent, updateMeetEvent } from '../services/calendarService.js';
import { sendMeetingEmail } from '../services/gmailService.js';

const router = express.Router();

// --------- Firebase Admin / Firestore ---------
let db;
try {
  db = getAdminDb();
} catch (error) {
  console.error('Erro ao inicializar Firebase Admin:', error);
}

// --------- helpers ---------
function mapMeetingDoc(doc) {
  return {
    id: doc.id,
    ...doc.data(),
  };
}

const toDateTime = (date, time) => {
  if (!date || !time) return null;
  const dt = new Date(`${date}T${time}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

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
      duration = 45,
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

    // Checa status da solicitação e bloqueia duplicidade
    const solicitacaoRef = db.collection('solicitacoesAtendimento').doc(solicitacaoId);
    const solicitacaoSnap = await solicitacaoRef.get();
    if (solicitacaoSnap.exists) {
      const statusRaw = (solicitacaoSnap.data()?.status || '').toString().toLowerCase();
      if (statusRaw.includes('encontro agendado')) {
        return res.status(409).json({
          success: false,
          message: 'Esta solicitação já possui um encontro agendado.',
        });
      }
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
    const dateObj = toDateTime(scheduledDate, scheduledTime);
    const dateTimeIso = dateObj ? dateObj.toISOString() : null;

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
      calendarEventId: null,
      transcriptionId: null,
      clinicalRecord: null,
    };

    const docRef = await db.collection('meetings').add(newMeeting);

    // Cria link do Meet via Calendar (best-effort)
    try {
      const meetResp = await createMeetEvent({
        summary: `Atendimento - ${studentName}`,
        description: notes || '',
        date: scheduledDate,
        time: scheduledTime,
        durationMinutes: duration,
        attendeeEmail: studentEmail,
      });
      if (meetResp?.success && (meetResp.meetLink || meetResp.eventId)) {
        newMeeting.meetLink = meetResp.meetLink || null;
        newMeeting.calendarEventId = meetResp.eventId || null;
        await docRef.update({
          meetLink: newMeeting.meetLink,
          calendarEventId: newMeeting.calendarEventId,
        });
      }
    } catch (calErr) {
      console.warn('Falha ao criar Meet para o meeting:', calErr?.message);
    }

    // E-mail para o discente com o link do Meet (best-effort)
    try {
      if (studentEmail && newMeeting.meetLink) {
        const text = `Olá ${studentName || ''},

Sua sessão está agendada para ${scheduledDate} às ${scheduledTime}.
Link para o encontro: ${newMeeting.meetLink}

Se não foi você, ignore esta mensagem.`;
        await sendMeetingEmail({
          to: studentEmail,
          subject: 'Sessão agendada - link do encontro',
          text,
          html: `<p>Olá ${studentName || ''},</p>
<p>Sua sessão está agendada para <strong>${scheduledDate}</strong> às <strong>${scheduledTime}</strong>.</p>
<p>Link para o encontro: <a href="${newMeeting.meetLink}">${newMeeting.meetLink}</a></p>
<p>Se não foi você, ignore esta mensagem.</p>`,
        });
      }
    } catch (mailErr) {
      console.warn('Falha ao enviar e-mail do meeting:', mailErr?.message);
    }

    const saved = { id: docRef.id, ...newMeeting };

    // Atualiza status da solicitação para "encontro agendado" (best-effort)
    try {
      await solicitacaoRef.set(
        { status: 'encontro agendado', updatedAt: nowIso },
        { merge: true }
      );
    } catch (sErr) {
      console.warn('Falha ao atualizar status da solicitação após criar meeting:', sErr?.message);
    }

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
    const slotDuration = 45; // minutos

    // Gera slots de 45 min entre 09:00 e 17:00, garantindo término antes das 17h
    const workingHours = [];
    const startMinutes = 9 * 60;
    const endMinutes = 17 * 60;
    for (let minutes = startMinutes; minutes <= endMinutes - slotDuration; minutes += slotDuration) {
      const hours = Math.floor(minutes / 60)
        .toString()
        .padStart(2, '0');
      const mins = (minutes % 60).toString().padStart(2, '0');
      workingHours.push(`${hours}:${mins}`);
    }

    // Busca reuniões já agendadas para essa data
    const snapshot = await db
      .collection('meetings')
      .where('scheduledDate', '==', date)
      .get();

    const occupiedDocs = snapshot.docs
      .map((doc) => doc.data())
      .filter((m) => m.status !== 'cancelada');

    // Auxiliares para evitar sobreposição
    const toMinutes = (timeStr) => {
      if (!timeStr) return null;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const overlaps = (candidateStart, candidateDur, existingStart, existingDur) => {
      if (candidateStart === null || existingStart === null) return false;
      const candidateEnd = candidateStart + candidateDur;
      const existingEnd = existingStart + (existingDur || slotDuration);
      return candidateStart < existingEnd && existingStart < candidateEnd;
    };

    const occupiedSlots = occupiedDocs.map((m) => m.scheduledTime);

    const availableSlots = workingHours.filter((slot) => {
      const candidateStart = toMinutes(slot);
      return !occupiedDocs.some((m) =>
        overlaps(candidateStart, slotDuration, toMinutes(m.scheduledTime), m.duration || slotDuration)
      );
    });

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

      // Considera apenas sessões concluídas
      if (m.status !== 'concluida') return;

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
      completionNotes,
      informalNotes,
      clinicalRecord,
    } = req.body;

    const current = snap.data() || {};

    const updates = {
      updatedAt: new Date().toISOString(),
    };

    if (scheduledDate) updates.scheduledDate = scheduledDate;
    if (scheduledTime) updates.scheduledTime = scheduledTime;
    if (duration) updates.duration = duration;
    if (notes !== undefined) updates.notes = notes;
    if (status) updates.status = status;
    if (meetLink) updates.meetLink = meetLink;
    if (completionNotes !== undefined) updates.completionNotes = completionNotes;
    if (informalNotes !== undefined) updates.informalNotes = informalNotes;
    if (clinicalRecord !== undefined) updates.clinicalRecord = clinicalRecord;

    const scheduleChanged =
      (scheduledDate && scheduledDate !== current.scheduledDate) ||
      (scheduledTime && scheduledTime !== current.scheduledTime) ||
      (duration && duration !== current.duration);

    // Atualiza/gera Meet se houver alteração de agenda ou se ainda não existir link
    try {
      if (scheduleChanged || (!current.meetLink && (scheduledDate || scheduledTime))) {
        const calResp = await updateMeetEvent({
          eventId: current.calendarEventId,
          summary: `Atendimento - ${current.studentName || 'Discente'}`,
          description: updates.notes ?? current.notes ?? '',
          date: scheduledDate || current.scheduledDate,
          time: scheduledTime || current.scheduledTime,
          durationMinutes: duration || current.duration || 45,
          attendeeEmail: current.studentEmail,
        });
        if (calResp?.success && (calResp.meetLink || calResp.eventId)) {
          updates.meetLink = calResp.meetLink || current.meetLink || null;
          updates.calendarEventId = calResp.eventId || current.calendarEventId || null;
        }
      }
    } catch (calErr) {
      console.warn('Falha ao atualizar Meet do meeting:', calErr?.message);
    }

    await docRef.update(updates);

    const updatedSnap = await docRef.get();
    const updatedData = mapMeetingDoc(updatedSnap);

    // E-mail para o discente com o link atualizado (best-effort)
    try {
      if (updatedData.studentEmail && updatedData.meetLink && scheduleChanged) {
        const text = `Olá ${updatedData.studentName || ''},

Sua sessão foi agendada/atualizada para ${updatedData.scheduledDate} às ${updatedData.scheduledTime}.
Link para o encontro: ${updatedData.meetLink}

Se não foi você, ignore esta mensagem.`;
        await sendMeetingEmail({
          to: updatedData.studentEmail,
          subject: 'Sessão agendada/atualizada - link do encontro',
          text,
          html: `<p>Olá ${updatedData.studentName || ''},</p>
<p>Sua sessão foi agendada/atualizada para <strong>${updatedData.scheduledDate}</strong> às <strong>${updatedData.scheduledTime}</strong>.</p>
<p>Link para o encontro: <a href="${updatedData.meetLink}">${updatedData.meetLink}</a></p>
<p>Se não foi você, ignore esta mensagem.</p>`,
        });
      }
    } catch (mailErr) {
      console.warn('Falha ao enviar e-mail do meeting (update):', mailErr?.message);
    }

    res.json({
      success: true,
      message: 'Reunião atualizada com sucesso',
      data: updatedData,
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
