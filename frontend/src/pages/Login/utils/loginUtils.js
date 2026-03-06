export const LOGIN_ROUTES = {
  HOME: '/',
  AGENDA: '/agenda',
};

export const getAuthErrorMessage = (code) => {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Credenciais inválidas. Verifique e tente novamente.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Tente novamente mais tarde.';
    case 'auth/network-request-failed':
      return 'Falha de rede. Verifique sua conexão.';
    default:
      return 'Falha ao fazer login. Verifique suas credenciais.';
  }
};
