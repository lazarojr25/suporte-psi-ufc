import React, { useEffect, useState } from 'react';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import ufcLogo from '../assets/ufc-logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Se já está logado, manda para a área interna
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u && !u.isAnonymous) {
        navigate('/agenda');
      }
    });

    return () => unsub();
  }, [navigate]);

  const mapError = (code) => {
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

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    // Verificação local do domínio antes de autenticar
    /*if (!email.trim().toLowerCase().endsWith('@ufc.br')) {
      setError('Apenas e-mails institucionais (@ufc.br) são permitidos.');
      return;
    }*/

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate('/agenda');
    } catch (err) {
      console.error('Login error:', err);
      setError(mapError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="w-full border-b bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={ufcLogo}
              alt="Brasão da UFC"
              className="h-12 w-auto object-contain"
            />
            <div className="leading-tight">
              <p className="text-xs uppercase tracking-[0.15em] text-gray-500">
                Universidade Federal do Ceará · Campus Quixadá
              </p>
              <p className="text-sm font-semibold text-gray-900">
                Serviço de Acompanhamento Psicológico ao Discente
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="
              inline-flex items-center gap-2 px-4 py-2 rounded-full
              text-sm font-medium
              border border-blue-600 text-blue-600
              hover:bg-blue-50 transition
            "
          >
            Voltar para solicitação
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-6xl grid gap-8 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] items-center">
          <section className="hidden md:flex flex-col justify-center space-y-3">
            <h1 className="text-3xl font-bold text-gray-900">
              Acesso da equipe de psicologia
            </h1>
            <p className="text-sm text-gray-700">
              Entre com as credenciais fornecidas pela coordenação para gerenciar solicitações,
              agenda e prontuários.
            </p>
            <p className="text-xs text-gray-500">
              Caso não tenha acesso ou encontre problemas de login, entre em contato com a coordenação do serviço.
            </p>
          </section>

          <section>
            <form
              onSubmit={handleLogin}
              className="bg-white p-6 rounded-2xl shadow-md w-full max-w-md mx-auto"
            >
              <h2 className="text-2xl font-bold mb-4">Login de Funcionário</h2>

              {error && (
                <div className="mb-4 bg-red-100 text-red-700 px-3 py-2 rounded">
                  {error}
                </div>
              )}

              <label className="block mb-2">
                <span className="text-sm font-medium text-gray-700">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
                  required
                />
              </label>

              <label className="block mb-4">
                <span className="text-sm font-medium text-gray-700">Senha</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
                  required
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </section>
        </div>
      </main>

      <footer className="w-full border-t bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-gray-600">
          <div>
            <p className="font-semibold text-gray-800">
              Serviço de Acompanhamento Psicológico ao Discente · UFC Quixadá
            </p>
            <p>
              Contato:{' '}
              <span className="font-medium">
                psicologia.quixada@ufc.br
              </span>{' '}
            </p>
            <p>
              Campus da UFC em Quixadá · Av. José de Freitas Queiroz, 5000 – Cedro,
              Quixadá – CE, 63902-580
            </p>
            <p>
              Site oficial:{' '}
              <a
                href="https://www.quixada.ufc.br"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                www.quixada.ufc.br
              </a>
            </p>
          </div>

          <div className="md:text-right">
            <p className="font-semibold text-gray-800">
              Situações de urgência e risco imediato
            </p>
            <p>
              Procure o serviço de saúde mais próximo ou ligue para o{' '}
              <span className="font-semibold">SAMU 192</span>.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
