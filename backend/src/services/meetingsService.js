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

const MEETINGS_COLLECTION = 'encontros';
const LEGACY_MEETINGS_COLLECTIONS = ['meetings'];

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

  _meetingCollections() {
    return [MEETINGS_COLLECTION, ...LEGACY_MEETINGS_COLLECTIONS];
  }

  async _collectMeetings(buildQuery) {
    const collections = this._meetingCollections();
    const snapshots = await Promise.all(
      collections.map(async (collectionName) => {
        const ref = this.db.collection(collectionName);
        const queryRef = buildQuery(ref);
        const snapshot = await queryRef.get();
        return snapshot.docs;
      }),
    );

    const byId = new Map();

    snapshots.forEach((docs) => {
      docs.forEach((doc) => {
        if (!byId.has(doc.id)) {
          byId.set(doc.id, mapMeetingDoc(doc));
        }
      });
    });

    return Array.from(byId.values());
  }

  async _findMeetingDocById(meetingId) {
    for (const collectionName of this._meetingCollections()) {
      const ref = this.db.collection(collectionName).doc(meetingId);
      const snap = await ref.get();
      if (snap.exists) {
        return {
          collectionName,
          ref,
          snap,
        };
      }
    }

    return null;
  }

  async _meetingForSolicitacaoExists(solicitacaoId) {
    const query = await this._collectMeetings((ref) =>
      ref.where('solicitacaoId', '==', solicitacaoId),
    );
    return query.length > 0;
  }

  async listMeetings({ status, date }) {
    this._requireDb();
    const meetings = await this._collectMeetings((ref) => {
      let query = ref;
      if (status) {
        query = query.where('status', '==', status);
      }
      return query;
    });

    const filtered = date
      ? meetings.filter((m) => m.scheduledDate === date)
      : meetings;

    return {
      success: true,
      data: {
        meetings: filtered,
        total: filtered.length,
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
      const statusRaw = (solicitacaoSnap.data()?.status || '')
        .toString()
        .toLowerCase();
      if (statusRaw.includes('encontro agendado')) {
        return {
          success: false,
          statusCode: 409,
          message: 'Esta solicitação já possui um encontro agendado.',
        };
      }
    }

    const existingMeeting = await this._meetingForSolicitacaoExists(solicitacaoId);
    if (existingMeeting) {
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

    const docRef = await this.db.collection(MEETINGS_COLLECTION).add(newMeeting);

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
      console.warn('Falha ao criar Meet para o encontro:', calErr?.message);
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
      console.warn('Falha ao enviar e-mail do encontro:', mailErr?.message);
    }

    const saved = { id: docRef.id, ...newMeeting };

    try {
      await solicitacaoRef.set(
        { status: 'encontro agendado', updatedAt: nowIso },
        { merge: true },
      );
    } catch (sErr) {
      console.warn(
        'Falha ao atualizar status da solicitação após criar encontro:',
        sErr?.message,
      );
    }

    return {
      success: true,
      statusCode: 201,
      message: 'Encontro agendado com sucesso',
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

    const meetings = await this._collectMeetings((ref) =>
      ref.where('scheduledDate', '==', date),
    );

    const occupiedDocs = meetings.filter((m) => m.status !== 'cancelada');
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

    const meetings = await this._collectMeetings((ref) =>
      ref.where('discenteId', '==', discenteId),
    );

    let countInPeriod = 0;

    meetings.forEach((m) => {
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
    const meetingRef = await this._findMeetingDocById(id);

    if (!meetingRef) {
      return {
        success: false,
        statusCode: 404,
        message: 'Encontro não encontrado',
      };
    }

    return {
      success: true,
      data: mapMeetingDoc(meetingRef.snap),
    };
  }

  async updateMeeting(id, payload) {
    this._requireDb();
    const meetingRef = await this._findMeetingDocById(id);

    if (!meetingRef) {
      return {
        success: false,
        statusCode: 404,
        message: 'Encontro não encontrado',
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

    const current = meetingRef.snap.data() || {};
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
      console.warn('Falha ao atualizar Meet do encontro:', calErr?.message);
      calendarStatus.success = false;
      calendarStatus.message = calErr?.message ||
        'Não foi possível atualizar o evento no Google Calendar.';
    }

    await meetingRef.ref.update(updates);

    const updatedSnap = await meetingRef.ref.get();
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
      console.warn('Falha ao enviar e-mail do encontro (update):', mailErr?.message);
    }

    return {
      success: true,
      message: 'Encontro atualizado com sucesso',
      data: updatedData,
      calendar: calendarStatus,
    };
  }

  async cancelMeeting(id) {
    this._requireDb();
    const meetingRef = await this._findMeetingDocById(id);

    if (!meetingRef) {
      return {
        success: false,
        statusCode: 404,
        message: 'Encontro não encontrado',
      };
    }

    const updates = {
      status: 'cancelada',
      cancelledAt: new Date().toISOString(),
    };

    await meetingRef.ref.update(updates);

    const updatedSnap = await meetingRef.ref.get();

    return {
      success: true,
      message: 'Encontro cancelado com sucesso',
      data: mapMeetingDoc(updatedSnap),
    };
  }

  async completeMeeting(id, payload) {
    this._requireDb();
    const { transcriptionId, notes } = payload;
    const meetingRef = await this._findMeetingDocById(id);

    if (!meetingRef) {
      return {
        success: false,
        statusCode: 404,
        message: 'Encontro não encontrado',
      };
    }

    const updates = {
      status: 'concluida',
      completedAt: new Date().toISOString(),
    };

    if (transcriptionId) updates.transcriptionId = transcriptionId;
    if (notes) updates.completionNotes = notes;

    await meetingRef.ref.update(updates);

    const updatedSnap = await meetingRef.ref.get();

    return {
      success: true,
      message: 'Encontro marcado como concluído',
      data: mapMeetingDoc(updatedSnap),
    };
  }
}

export default MeetingsService;
