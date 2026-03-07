import { createMeetEvent, updateMeetEvent } from './calendarService.js';
import { sendMeetingEmail } from './gmailService.js';

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

function toMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if ([h, m].some((value) => Number.isNaN(value))) return null;
  return h * 60 + m;
}

function overlaps(candidateStart, candidateDur, existingStart, existingDur) {
  if (candidateStart === null || existingStart === null) return false;
  const candidateEnd = candidateStart + candidateDur;
  const existingEnd = existingStart + (existingDur || candidateDur);
  return candidateStart < existingEnd && existingStart < candidateEnd;
}

class MeetingsService {
  constructor(db) {
    this.db = db;
  }

  _requireDb() {
    if (!this.db) {
      const error = new Error('Firebase Admin não inicializado.');
      error.statusCode = 500;
      throw error;
    }
  }

  async listMeetings({ status, date }) {
    this._requireDb();
    let ref = this.db.collection('meetings');

    if (status) {
      ref = ref.where('status', '==', status);
    }

    const snapshot = await ref.get();
    let meetings = snapshot.docs.map(mapMeetingDoc);

    if (date) {
      meetings = meetings.filter((m) => m.scheduledDate === date);
    }

    return {
      success: true,
      data: {
        meetings,
        total: meetings.length,
      },
    };
  }

  async createMeeting(payload) {
    this._requireDb();
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
    } = payload;

    if (
      !solicitacaoId ||
      !studentName ||
      !studentEmail ||
      !scheduledDate ||
      !scheduledTime
    ) {
      return {
        success: false,
        statusCode: 400,
        message:
          'Dados obrigatórios: solicitacaoId, studentName, studentEmail, scheduledDate, scheduledTime',
      };
    }

    const solicitacaoRef = this.db
      .collection('solicitacoesAtendimento')
      .doc(solicitacaoId);
    const solicitacaoSnap = await solicitacaoRef.get();
    if (solicitacaoSnap.exists) {
      const statusRaw = (solicitacaoSnap.data()?.status || '').
        toString()
        .toLowerCase();
      if (statusRaw.includes('encontro agendado')) {
        return {
          success: false,
          statusCode: 409,
          message: 'Esta solicitação já possui um encontro agendado.',
        };
      }
    }

    const existingSnap = await this.db
      .collection('meetings')
      .where('solicitacaoId', '==', solicitacaoId)
      .get();
    if (!existingSnap.empty) {
      return {
        success: false,
        statusCode: 409,
        message: 'Já existe uma reunião agendada para esta solicitação',
      };
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
      scheduledDate,
      scheduledTime,
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

    const docRef = await this.db.collection('meetings').add(newMeeting);

    const calendarStatus = { success: true, message: null };
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
      } else {
        calendarStatus.success = false;
        calendarStatus.message = meetResp?.message ||
          'Não foi possível criar o evento no Google Calendar.';
      }
    } catch (calErr) {
      console.warn('Falha ao criar Meet para o meeting:', calErr?.message);
      calendarStatus.success = false;
      calendarStatus.message =
        calErr?.message || 'Não foi possível criar o evento no Google Calendar.';
    }

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

    try {
      await solicitacaoRef.set(
        { status: 'encontro agendado', updatedAt: nowIso },
        { merge: true },
      );
    } catch (sErr) {
      console.warn(
        'Falha ao atualizar status da solicitação após criar meeting:',
        sErr?.message,
      );
    }

    return {
      success: true,
      statusCode: 201,
      message: 'Reunião agendada com sucesso',
      data: saved,
      calendar: calendarStatus,
    };
  }

  async getAvailableSlots(date) {
    this._requireDb();

    const slotDuration = 45;
    const workingHours = [];
    const startMinutes = 9 * 60;
    const endMinutes = 17 * 60;

    for (let minutes = startMinutes; minutes <= endMinutes - slotDuration; minutes += slotDuration) {
      const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
      const mins = String(minutes % 60).padStart(2, '0');
      workingHours.push(`${hours}:${mins}`);
    }

    const snapshot = await this.db
      .collection('meetings')
      .where('scheduledDate', '==', date)
      .get();

    const occupiedDocs = snapshot.docs
      .map((doc) => doc.data())
      .filter((m) => m.status !== 'cancelada');

    const occupiedSlots = occupiedDocs.map((m) => m.scheduledTime);

    const availableSlots = workingHours.filter((slot) => {
      const candidateStart = toMinutes(slot);
      return !occupiedDocs.some((m) =>
        overlaps(
          candidateStart,
          slotDuration,
          toMinutes(m.scheduledTime),
          m.duration || slotDuration,
        ),
      );
    });

    return {
      success: true,
      data: {
        date,
        availableSlots,
        occupiedSlots,
        totalAvailable: availableSlots.length,
      },
    };
  }

  async canSchedule(discenteId) {
    this._requireDb();

    if (!discenteId) {
      return {
        success: false,
        statusCode: 400,
        message: 'discenteId é obrigatório',
      };
    }

    const cfgRef = this.db.collection('semestreLetivo').doc('semestreLetivoConfig');
    const cfgSnap = await cfgRef.get();

    const now = new Date();
    let maxSessions = 0;
    let periodStart;
    let periodEnd;

    if (cfgSnap.exists) {
      const cfg = cfgSnap.data() || {};
      maxSessions = cfg.maxSessionsPerDiscente || 0;
      if (cfg.periodStart) periodStart = new Date(cfg.periodStart);
      if (cfg.periodEnd) periodEnd = new Date(cfg.periodEnd);
    }

    if (!periodStart || !periodEnd) {
      periodEnd = now;
      periodStart = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    }

    const snapshot = await this.db
      .collection('meetings')
      .where('discenteId', '==', discenteId)
      .get();

    let countInPeriod = 0;

    snapshot.forEach((docSnap) => {
      const m = docSnap.data() || {};
      if (m.status !== 'concluida') return;

      let d;
      if (m.dateTime) {
        d = new Date(m.dateTime);
      } else if (m.scheduledDate) {
        d = new Date(`${m.scheduledDate}T00:00:00`);
      } else if (m.createdAt) {
        d = new Date(m.createdAt);
      } else {
        return;
      }

      if (Number.isNaN(d.getTime())) return;

      if (d >= periodStart && d <= periodEnd) {
        countInPeriod += 1;
      }
    });

    const remaining = maxSessions > 0 ? Math.max(0, maxSessions - countInPeriod) : 0;

    return {
      success: true,
      data: {
        allowed: maxSessions === 0 ? true : remaining > 0,
        remaining,
        used: countInPeriod,
        limit: maxSessions,
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: periodEnd.toISOString().slice(0, 10),
      },
    };
  }

  async getById(id) {
    this._requireDb();
    const docRef = this.db.collection('meetings').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return {
        success: false,
        statusCode: 404,
        message: 'Reunião não encontrada',
      };
    }

    return {
      success: true,
      data: mapMeetingDoc(snap),
    };
  }

  async updateMeeting(id, payload) {
    this._requireDb();
    const docRef = this.db.collection('meetings').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return {
        success: false,
        statusCode: 404,
        message: 'Reunião não encontrada',
      };
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
    } = payload;

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

    const calendarStatus = { success: true, message: null };
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
        } else {
          calendarStatus.success = false;
          calendarStatus.message = calResp?.message ||
            'Não foi possível atualizar o evento no Google Calendar.';
        }
      }
    } catch (calErr) {
      console.warn('Falha ao atualizar Meet do meeting:', calErr?.message);
      calendarStatus.success = false;
      calendarStatus.message = calErr?.message ||
        'Não foi possível atualizar o evento no Google Calendar.';
    }

    await docRef.update(updates);

    const updatedSnap = await docRef.get();
    const updatedData = mapMeetingDoc(updatedSnap);

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

    return {
      success: true,
      message: 'Reunião atualizada com sucesso',
      data: updatedData,
      calendar: calendarStatus,
    };
  }

  async cancelMeeting(id) {
    this._requireDb();
    const docRef = this.db.collection('meetings').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return {
        success: false,
        statusCode: 404,
        message: 'Reunião não encontrada',
      };
    }

    const updates = {
      status: 'cancelada',
      cancelledAt: new Date().toISOString(),
    };

    await docRef.update(updates);

    const updatedSnap = await docRef.get();

    return {
      success: true,
      message: 'Reunião cancelada com sucesso',
      data: mapMeetingDoc(updatedSnap),
    };
  }

  async completeMeeting(id, payload) {
    this._requireDb();
    const { transcriptionId, notes } = payload;
    const docRef = this.db.collection('meetings').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return {
        success: false,
        statusCode: 404,
        message: 'Reunião não encontrada',
      };
    }

    const updates = {
      status: 'concluida',
      completedAt: new Date().toISOString(),
    };

    if (transcriptionId) updates.transcriptionId = transcriptionId;
    if (notes) updates.completionNotes = notes;

    await docRef.update(updates);

    const updatedSnap = await docRef.get();

    return {
      success: true,
      message: 'Reunião marcada como concluída',
      data: mapMeetingDoc(updatedSnap),
    };
  }
}

export default MeetingsService;
