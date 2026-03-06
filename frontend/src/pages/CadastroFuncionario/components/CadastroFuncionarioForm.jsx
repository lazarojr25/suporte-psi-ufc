import React from 'react';

export default function CadastroFuncionarioForm({
  erro,
  email,
  setEmail,
  senha,
  setSenha,
  confirmarSenha,
  setConfirmarSenha,
  onSubmit,
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-md w-full max-w-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Cadastro de Funcionário</h2>

        {erro && <p className="text-red-500 mb-4">{erro}</p>}

        <form onSubmit={onSubmit}>
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

          <label className="block mb-2">
            <span className="text-sm font-medium text-gray-700">Senha</span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
              required
            />
          </label>

          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700">Confirmar Senha</span>
            <input
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
              required
            />
          </label>

          <button
            type="submit"
            className="w-full py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Criar Conta
          </button>
        </form>
      </div>
    </div>
  );
}
