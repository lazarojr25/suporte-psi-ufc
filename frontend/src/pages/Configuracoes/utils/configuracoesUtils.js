export const CONFIG_DEFAULTS = {
  MAX_SESSIONS: 6,
};

export const buildAttendancePayload = ({ periodStart, periodEnd, maxSessions }) => ({
  periodStart: periodStart || null,
  periodEnd: periodEnd || null,
  maxSessionsPerDiscente: Number(maxSessions) || 0,
});
