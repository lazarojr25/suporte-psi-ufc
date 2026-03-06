import React from 'react';

export default function LoginForm({
  error,
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  loading,
  onSubmit,
}) {
  return (
    <section>
      <form onSubmit={onSubmit} className="bg-white p-6 rounded-2xl shadow-md w-full max-w-md mx-auto">
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
          <div className="mt-1 relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring pr-24"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-2 px-3 text-sm font-semibold text-blue-600 hover:text-blue-700 focus:outline-none"
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
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
  );
}
