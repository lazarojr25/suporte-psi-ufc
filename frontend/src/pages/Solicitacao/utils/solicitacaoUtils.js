export const STATUS = {
  SOLICITADA: 'Pendente',
  AGENDADA: 'Agendada',
};

export const ALLOWED_EMAIL_DOMAINS = ['@alu.ufc.br', '@ufc.br'];

export const isInstitutionalEmail = (value) => {
  const normalized = (value || '').trim().toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.some((domain) => normalized.endsWith(domain));
};
