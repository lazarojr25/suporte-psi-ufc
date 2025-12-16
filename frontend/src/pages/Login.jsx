import React, { useEffect, useState } from 'react';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useNavigate } from 'react-router-dom';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleLogin}
        className="bg-white p-6 rounded-lg shadow-md w-full max-w-sm"
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
    </div>
  );
}
