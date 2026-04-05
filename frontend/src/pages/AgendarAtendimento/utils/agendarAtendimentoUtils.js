export const AGENDA_STATUS = {
  AGENDADO: 'encontro agendado',
};

export const DEFAULT_MEETING_DURATION = 45;
export const DIAS_FUTUROS = 30;

const EMAIL_LOCALE = 'pt-BR';

export const isLockedStatus = (status) =>
  (status || '').toString().trim().toLowerCase() ===
  AGENDA_STATUS.AGENDADO.toLowerCase();

export const getAvailableDates = () => {
  const dates = [];
  const today = new Date();

  for (let i = 0; i <= DIAS_FUTUROS; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    if (date.getDay() >= 1 && date.getDay() <= 5) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
  }

  return dates;
};

export const formatDateOption = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(EMAIL_LOCALE, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

export const buildMeetingData = ({
  solicitacaoId,
  solicitacao,
  selectedDate,
  selectedTime,
  observacoes,
}) => ({
  solicitacaoId,
  sessionType: 'individual',
  studentName: solicitacao?.name,
  studentEmail: solicitacao?.email,
  discenteId: solicitacao?.discenteId || null,
  curso: solicitacao?.curso || null,
  participants: [
    {
      discenteId: solicitacao?.discenteId || null,
      name: solicitacao?.name || null,
      email: solicitacao?.email || null,
      studentId: solicitacao?.studentId || null,
      curso: solicitacao?.curso || null,
    },
  ],
  scheduledDate: selectedDate,
  scheduledTime: selectedTime,
  duration: DEFAULT_MEETING_DURATION,
  notes: observacoes,
});

export const buildCalendarErrorMessage = (response) => {
  if (response?.calendar?.success) return null;

  const baseMessage =
    'Consulta agendada, mas não foi possível criar o evento no Google Calendar.';
  if (!response?.calendar?.message) return baseMessage;

  return `Consulta agendada, mas não foi possível criar o evento no Google Calendar: ${response.calendar.message}`;
};
