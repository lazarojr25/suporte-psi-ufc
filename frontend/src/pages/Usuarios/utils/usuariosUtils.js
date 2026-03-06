export const ROLE_OPTIONS = [
  { value: 'servidor', label: 'servidor' },
  { value: 'admin', label: 'admin' },
];

export const normalizeRole = (role) => {
  const normalized = (role || '').toLowerCase();
  if (normalized === 'staff') return 'servidor';
  if (normalized === 'admin' || normalized === 'servidor') return normalized;
  return 'servidor';
};

export const roleLabel = (role) =>
  ROLE_OPTIONS.find((option) => option.value === normalizeRole(role))?.label ||
  normalizeRole(role);
