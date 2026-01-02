import { google } from 'googleapis';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || null;
const TIME_ZONE = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Fortaleza';

const calendarClient = () => {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );

  auth.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  return google.calendar({ version: 'v3', auth });
};

const toDateTimeString = (date, time) => {
  if (!date || !time) return null;
  return `${date}T${time}:00`;
};

export async function createMeetEvent({ summary, description, date, time, durationMinutes = 45, attendeeEmail }) {
  if (!CALENDAR_ID) return { success: false, message: 'GOOGLE_CALENDAR_ID não configurado.' };
  const startStr = toDateTimeString(date, time);
  if (!startStr) return { success: false, message: 'Data/hora inválidas.' };

  const start = new Date(startStr);
  const end = new Date(start.getTime() + durationMinutes * 60000);

  try {
    const cal = calendarClient();
    const resp = await cal.events.insert({
      calendarId: CALENDAR_ID,
      conferenceDataVersion: 1,
      requestBody: {
        summary: summary || 'Atendimento',
        description: description || '',
        start: { dateTime: start.toISOString(), timeZone: TIME_ZONE },
        end: { dateTime: end.toISOString(), timeZone: TIME_ZONE },
        attendees: attendeeEmail ? [{ email: attendeeEmail }] : [],
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    });

    const event = resp.data || {};
    const meetLink = event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri || null;
    return {
      success: true,
      meetLink,
      eventId: event.id || null,
    };
  } catch (err) {
    console.error('CALENDAR_ID:',CALENDAR_ID);
    console.error('Erro ao criar evento no Calendar:', err?.message);
    return { success: false, message: err?.message };
  }
}

export async function updateMeetEvent({ eventId, summary, description, date, time, durationMinutes = 45, attendeeEmail }) {
  if (!CALENDAR_ID) return { success: false, message: 'GOOGLE_CALENDAR_ID não configurado.' };
  if (!eventId) {
    return createMeetEvent({ summary, description, date, time, durationMinutes, attendeeEmail });
  }
  const startStr = toDateTimeString(date, time);
  if (!startStr) return { success: false, message: 'Data/hora inválidas.' };

  const start = new Date(startStr);
  const end = new Date(start.getTime() + durationMinutes * 60000);

  try {
    const cal = calendarClient();
    const resp = await cal.events.patch({
      calendarId: CALENDAR_ID,
      eventId,
      conferenceDataVersion: 1,
      requestBody: {
        summary: summary || 'Atendimento',
        description: description || '',
        start: { dateTime: start.toISOString(), timeZone: TIME_ZONE },
        end: { dateTime: end.toISOString(), timeZone: TIME_ZONE },
        attendees: attendeeEmail ? [{ email: attendeeEmail }] : [],
      },
    });

    const event = resp.data || {};
    const meetLink = event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri || null;
    return {
      success: true,
      meetLink,
      eventId: event.id || eventId,
    };
  } catch (err) {
    console.error('Erro ao atualizar evento no Calendar:', err?.message);
    return { success: false, message: err?.message };
  }
}
