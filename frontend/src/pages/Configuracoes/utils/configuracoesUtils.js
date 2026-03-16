export const CONFIG_DEFAULTS = {
  MAX_SESSIONS: 6,
};

export const buildAttendancePayload = ({
  periodName,
  periodStart,
  periodEnd,
  maxSessions,
  configId,
  createNew = false,
  setActive = false,
} = {}) => ({
  name: (periodName || '').trim() || undefined,
  periodStart: periodStart || null,
  periodEnd: periodEnd || null,
  maxSessionsPerDiscente: Number(maxSessions) || 0,
  ...(configId ? { configId } : {}),
  ...(createNew ? { createNew: true } : {}),
  ...(setActive ? { setActive: true } : {}),
});
