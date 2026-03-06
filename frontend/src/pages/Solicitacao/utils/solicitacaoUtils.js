export const STATUS = {
  SOLICITADA: 'Pendente',
  AGENDADA: 'Agendada',
};

export const ALLOWED_EMAIL_DOMAINS = ['@alu.ufc.br', '@ufc.br'];

export const CURSOS = [
  'Ciência da Computação',
  'Engenharia de Computação',
  'Engenharia de Software',
  'Sistemas de Informação',
  'Redes de Computadores',
  'Design Digital',
];

export const isInstitutionalEmail = (value) => {
  const normalized = (value || '').trim().toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.some((domain) => normalized.endsWith(domain));
};

export const getDefaultSolicitacaoState = () => ({
  name: '',
  email: '',
  studentId: '',
  motivation: '',
  curso: '',
});
