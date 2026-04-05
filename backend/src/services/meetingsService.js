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
const DEFAULT_DURATION_MINUTES = 45;
const GROUP_SESSION_MAX_MEMBERS = 15;
const APP_TIME_ZONE = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Fortaleza';

const normalizeStatus = (status) =>
  (status || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeEmail = (email) => {
  const safe = (email || '').toString().trim().toLowerCase();
  return safe || null;
};

const sanitizeText = (value) => {
  const safe = (value || '').toString().trim();
  return safe || null;
};

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

  _todayKey() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return year && month && day ? `${year}-${month}-${day}` : new Date().toISOString().slice(0, 10);
  }

  _isValidDateKey(date) {
    return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
  }

  _normalizeSessionType(value) {
    const raw = (value || '').toString().trim().toLowerCase();
    return raw === 'grupo' ? 'grupo' : 'individual';
  }

  _normalizeParticipants(participants = [], fallbackData = {}) {
    if (!Array.isArray(participants)) return [];
    return participants
      .map((participant) => {
        if (!participant || typeof participant !== 'object') return null;
        const participantDiscenteId = sanitizeText(participant.discenteId || participant.id);
        const participantName = sanitizeText(participant.name || participant.studentName);
        const participantEmail = normalizeEmail(participant.email || participant.studentEmail);
        const participantStudentId = sanitizeText(participant.studentId || participant.matricula);
        const participantCourse = sanitizeText(participant.curso || participant.course || fallbackData.curso);
        if (!participantDiscenteId && !participantName && !participantEmail) return null;
        return {
          discenteId: participantDiscenteId,
          name: participantName,
          email: participantEmail,
          studentId: participantStudentId,
          curso: participantCourse,
        };
      })
      .filter(Boolean);
  }

  _extractAttendeeEmails({ studentEmail, participants }) {
    const emails = [normalizeEmail(studentEmail)];
    if (Array.isArray(participants)) {
      participants.forEach((participant) => {
        emails.push(normalizeEmail(participant?.email));
      });
    }
    return Array.from(new Set(emails.filter(Boolean)));
  }

  _buildOwnerInfo(payloadOwner = {}, currentUser = null) {
    const ownerUid = sanitizeText(currentUser?.uid || payloadOwner.ownerUid || payloadOwner.uid);
    const ownerEmail = normalizeEmail(currentUser?.email || payloadOwner.ownerEmail || payloadOwner.email);
    const ownerRole = sanitizeText(currentUser?.role || payloadOwner.role);
    const ownerName = sanitizeText(payloadOwner.name);
    return {
      ownerUid,
      ownerEmail,
      ownerRole,
      ownerName,
      owner: {
        uid: ownerUid,
        email: ownerEmail,
        role: ownerRole,
        name: ownerName,
      },
    };
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
    if (!solicitacaoId) return false;
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

  async createMeeting(payload, currentUser = null) {
    this._requireDb();
    const {
      solicitacaoId,
      studentName,
      studentEmail,
      scheduledDate,
      scheduledTime,
      duration = DEFAULT_DURATION_MINUTES,
      notes,
      discenteId,
      curso,
      sessionType: incomingSessionType,
      groupTheme,
      participants: incomingParticipants,
    } = payload;

    const sessionType = this._normalizeSessionType(incomingSessionType);
    const todayKey = this._todayKey();
    const parsedDuration = Number(duration) || DEFAULT_DURATION_MINUTES;

    if (!scheduledDate || !scheduledTime) {
      return {
        success: false,
        statusCode: 400,
        message: 'Dados obrigatórios: scheduledDate e scheduledTime.',
      };
    }

    if (!this._isValidDateKey(scheduledDate)) {
      return {
        success: false,
        statusCode: 400,
        message: 'Formato de data inválido. Use YYYY-MM-DD.',
      };
    }

    if (scheduledDate < todayKey) {
      return {
        success: false,
        statusCode: 400,
        message: `Só é permitido agendar para hoje (${todayKey}) ou datas futuras.`,
      };
    }

    const fallbackParticipant = {
      discenteId: discenteId || null,
      name: studentName || null,
      email: studentEmail || null,
      curso: curso || null,
    };
    const participants = this._normalizeParticipants(incomingParticipants, fallbackParticipant);

    const safeGroupTheme = sanitizeText(groupTheme);
    const safeDiscenteId = sanitizeText(discenteId);
    const safeCourse = sanitizeText(curso);

    let safeStudentName = sanitizeText(studentName);
    let safeStudentEmail = normalizeEmail(studentEmail);

    if (sessionType === 'grupo') {
      if (!safeGroupTheme) {
        return {
          success: false,
          statusCode: 400,
          message: 'Sessões em grupo exigem um tema.',
        };
      }

      if (participants.length === 0) {
        return {
          success: false,
          statusCode: 400,
          message: 'Sessões em grupo exigem ao menos um integrante.',
        };
      }

      if (participants.length > GROUP_SESSION_MAX_MEMBERS) {
        return {
          success: false,
          statusCode: 400,
          message: `Sessões em grupo permitem no máximo ${GROUP_SESSION_MAX_MEMBERS} integrantes.`,
        };
      }

      safeStudentName = safeGroupTheme;
      safeStudentEmail = safeStudentEmail || participants.find((p) => p.email)?.email || null;
    } else {
      if (!safeStudentName) {
        return {
          success: false,
          statusCode: 400,
          message: 'Sessões individuais exigem studentName.',
        };
      }

      if (!participants.length && (safeDiscenteId || safeStudentName || safeStudentEmail)) {
        participants.push({
          discenteId: safeDiscenteId,
          name: safeStudentName,
          email: safeStudentEmail,
          studentId: sanitizeText(payload.studentId),
          curso: safeCourse,
        });
      }
    }

    const safeSolicitacaoId = sanitizeText(solicitacaoId);
    let solicitacaoRef = null;

    if (safeSolicitacaoId) {
      solicitacaoRef = this.db.collection('solicitacoesAtendimento').doc(safeSolicitacaoId);
      const solicitacaoSnap = await solicitacaoRef.get();
      if (solicitacaoSnap.exists) {
        const statusRaw = normalizeStatus(solicitacaoSnap.data()?.status);
        if (statusRaw.includes('encontro agendado')) {
          return {
            success: false,
            statusCode: 409,
            message: 'Esta solicitação já possui um encontro agendado.',
          };
        }
      }

      const existingMeeting = await this._meetingForSolicitacaoExists(safeSolicitacaoId);
      if (existingMeeting) {
        return {
          success: false,
          statusCode: 409,
          message: 'Já existe uma reunião agendada para esta solicitação',
        };
      }
    }

    const nowIso = new Date().toISOString();
    const dateObj = toDateTime(scheduledDate, scheduledTime);
    const dateTimeIso = dateObj ? dateObj.toISOString() : null;
    const {
      ownerUid,
      ownerEmail,
      ownerRole,
      ownerName,
      owner,
    } = this._buildOwnerInfo(payload.owner || payload, currentUser);

    const safeTitle =
      sessionType === 'grupo'
        ? safeGroupTheme
        : safeStudentName || 'Sessão';

    const newMeeting = {
      solicitacaoId: safeSolicitacaoId || null,
      studentName: safeStudentName,
      studentEmail: safeStudentEmail,
      title: safeTitle,
      sessionType,
      groupTheme: sessionType === 'grupo' ? safeGroupTheme : null,
      participants,
      groupSize: participants.length || (sessionType === 'grupo' ? 1 : 0),
      discenteId: safeDiscenteId || null,
      curso: safeCourse || null,
      scheduledDate,
      scheduledTime,
      duration: parsedDuration,
      notes: notes || '',
      status: 'agendada',
      createdAt: nowIso,
      dateTime: dateTimeIso,
      ownerUid,
      ownerEmail,
      ownerRole: ownerRole || null,
      ownerName: ownerName || null,
      owner,
      createdByUid: ownerUid,
      createdByEmail: ownerEmail,
      meetLink: null,
      calendarEventId: null,
      transcriptionId: null,
      clinicalRecord: null,
    };

    const docRef = await this.db.collection(MEETINGS_COLLECTION).add(newMeeting);

    const calendarStatus = { success: true, message: null };
    try {
      const attendeeEmails = this._extractAttendeeEmails({
        studentEmail: safeStudentEmail,
        participants,
      });
      const meetResp = await createMeetEvent({
        summary:
          sessionType === 'grupo'
            ? `Sessão em grupo - ${safeGroupTheme}`
            : `Atendimento - ${safeStudentName}`,
        description: notes || '',
        date: scheduledDate,
        time: scheduledTime,
        durationMinutes: parsedDuration,
        attendeeEmail: safeStudentEmail,
        attendeeEmails,
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
      if (newMeeting.meetLink) {
        if (sessionType !== 'grupo' && safeStudentEmail) {
          const text = `Olá ${safeStudentName || ''},

Sua sessão está agendada para ${scheduledDate} às ${scheduledTime}.
Link para o encontro: ${newMeeting.meetLink}

Se não foi você, ignore esta mensagem.`;
          await sendMeetingEmail({
            to: safeStudentEmail,
            subject: 'Sessão agendada - link do encontro',
            text,
            html: `<p>Olá ${safeStudentName || ''},</p>
<p>Sua sessão está agendada para <strong>${scheduledDate}</strong> às <strong>${scheduledTime}</strong>.</p>
<p>Link para o encontro: <a href="${newMeeting.meetLink}">${newMeeting.meetLink}</a></p>
<p>Se não foi você, ignore esta mensagem.</p>`,
          });
        }

        if (sessionType === 'grupo') {
          const groupEmails = this._extractAttendeeEmails({
            studentEmail: safeStudentEmail,
            participants,
          });
          const subject = `Sessão em grupo agendada - ${safeGroupTheme}`;
          const text = `Olá,

Uma sessão em grupo foi agendada para ${scheduledDate} às ${scheduledTime}.
Tema: ${safeGroupTheme}
Link para o encontro: ${newMeeting.meetLink}

Se não foi você, ignore esta mensagem.`;
          const html = `<p>Olá,</p>
<p>Uma sessão em grupo foi agendada para <strong>${scheduledDate}</strong> às <strong>${scheduledTime}</strong>.</p>
<p><strong>Tema:</strong> ${safeGroupTheme}</p>
<p>Link para o encontro: <a href="${newMeeting.meetLink}">${newMeeting.meetLink}</a></p>
<p>Se não foi você, ignore esta mensagem.</p>`;

          for (const email of groupEmails) {
            try {
              const sendResp = await sendMeetingEmail({
                to: email,
                subject,
                text,
                html,
              });
              if (!sendResp?.success) {
                console.warn('Falha ao enviar e-mail para integrante da sessão em grupo:', email, sendResp?.message);
              }
            } catch (groupMailErr) {
              console.warn('Falha ao enviar e-mail para integrante da sessão em grupo:', email, groupMailErr?.message);
            }
          }
        }
      }
    } catch (mailErr) {
      console.warn('Falha ao enviar e-mail do encontro:', mailErr?.message);
    }

    const saved = { id: docRef.id, ...newMeeting };

    try {
      if (solicitacaoRef) {
        await solicitacaoRef.set(
          { status: 'encontro agendado', updatedAt: nowIso },
          { merge: true },
        );
      }
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

    if (!this._isValidDateKey(date)) {
      return {
        success: false,
        statusCode: 400,
        message: 'Formato de data inválido. Use YYYY-MM-DD.',
      };
    }

    const todayKey = this._todayKey();
    if (date < todayKey) {
      return {
        success: false,
        statusCode: 400,
        message: `Não é possível agendar em data passada. Use ${todayKey} ou posterior.`,
      };
    }

    const slotDuration = DEFAULT_DURATION_MINUTES;
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
    const now = new Date();
    const isToday = date === todayKey;

    const availableSlots = workingHours.filter((slot) => {
      if (isToday) {
        const slotDateTime = toDateTime(date, slot);
        if (!slotDateTime || slotDateTime <= now) return false;
      }

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

  async updateMeeting(id, payload, currentUser = null) {
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
      transcriptionReview,
    } = payload;

    const current = meetingRef.snap.data() || {};
    const updates = {
      updatedAt: new Date().toISOString(),
    };

    if (scheduledDate) {
      if (!this._isValidDateKey(scheduledDate)) {
        return {
          success: false,
          statusCode: 400,
          message: 'Formato de data inválido. Use YYYY-MM-DD.',
        };
      }
      if (scheduledDate < this._todayKey()) {
        return {
          success: false,
          statusCode: 400,
          message: 'Não é permitido reagendar para data passada.',
        };
      }
    }

    if (scheduledDate) updates.scheduledDate = scheduledDate;
    if (scheduledTime) updates.scheduledTime = scheduledTime;
    if (duration) updates.duration = duration;
    if (notes !== undefined) updates.notes = notes;
    if (status) updates.status = status;
    if (meetLink) updates.meetLink = meetLink;
    if (completionNotes !== undefined) updates.completionNotes = completionNotes;
    if (informalNotes !== undefined) updates.informalNotes = informalNotes;
    if (clinicalRecord !== undefined) updates.clinicalRecord = clinicalRecord;
    if (transcriptionReview !== undefined) updates.transcriptionReview = transcriptionReview;

    const hasOwnerMetadata = Boolean(
      current.ownerUid ||
      current.ownerEmail ||
      current.owner?.uid ||
      current.owner?.email ||
      current.createdByUid ||
      current.createdByEmail,
    );
    if (!hasOwnerMetadata && currentUser) {
      const ownerInfo = this._buildOwnerInfo({}, currentUser);
      updates.ownerUid = ownerInfo.ownerUid;
      updates.ownerEmail = ownerInfo.ownerEmail;
      updates.ownerRole = ownerInfo.ownerRole || null;
      updates.ownerName = ownerInfo.ownerName || null;
      updates.createdByUid = ownerInfo.ownerUid;
      updates.createdByEmail = ownerInfo.ownerEmail;
      updates.owner = ownerInfo.owner;
    }

    const scheduleChanged =
      (scheduledDate && scheduledDate !== current.scheduledDate) ||
      (scheduledTime && scheduledTime !== current.scheduledTime) ||
      (duration && duration !== current.duration);

    const calendarStatus = { success: true, message: null };
    try {
      if (scheduleChanged || (!current.meetLink && (scheduledDate || scheduledTime))) {
        const attendeeEmails = this._extractAttendeeEmails({
          studentEmail: current.studentEmail,
          participants: current.participants || [],
        });
        const calResp = await updateMeetEvent({
          eventId: current.calendarEventId,
          summary:
            current.sessionType === 'grupo'
              ? `Sessão em grupo - ${current.groupTheme || current.title || 'Grupo'}`
              : `Atendimento - ${current.studentName || current.title || 'Discente'}`,
          description: updates.notes ?? current.notes ?? '',
          date: scheduledDate || current.scheduledDate,
          time: scheduledTime || current.scheduledTime,
          durationMinutes: duration || current.duration || DEFAULT_DURATION_MINUTES,
          attendeeEmail: current.studentEmail,
          attendeeEmails,
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
