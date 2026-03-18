import React, { useState } from 'react';

export default function CriarUsuarioModal({
  open,
  loading,
  error,
  onSubmit,
  onClose,
}) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [localError, setLocalError] = useState('');

  if (!open) {
    return null;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email.trim() || !senha || !confirmarSenha) {
      setLocalError('Preencha todos os campos.');
      return;
    }

    if (senha !== confirmarSenha) {
      setLocalError('As senhas não coincidem.');
      return;
    }

    onSubmit({
      email: email.trim(),
      password: senha,
      confirmarSenha,
    });
  };

  const isBusy = loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Criar usuário</h3>
          <button
            type="button"
            onClick={() => {
              setEmail('');
              setSenha('');
              setConfirmarSenha('');
              setLocalError('');
              onClose();
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
          <label className="block">
            <span className="text-sm text-gray-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700">Senha</span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700">Confirmar senha</span>
            <input
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>

          {(error || localError) && (
            <p className="text-sm text-red-600">{error || localError}</p>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEmail('');
                setSenha('');
                setConfirmarSenha('');
                setLocalError('');
                onClose();
              }}
              className="px-4 py-2 rounded-lg border text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-60"
            >
              {isBusy ? 'Salvando...' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
