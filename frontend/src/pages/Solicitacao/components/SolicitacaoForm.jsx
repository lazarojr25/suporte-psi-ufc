import React from 'react';

export default function SolicitacaoForm({
  error,
  loading,
  name,
  setName,
  email,
  setEmail,
  studentId,
  setStudentId,
  cursoId,
  setCursoId,
  motivation,
  setMotivation,
  onSubmit,
  cursos,
}) {
  return (
    <section>
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">
          Solicitar acompanhamento psicológico
        </h2>

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

        <label className="block mb-3">
          <span className="block text-sm font-medium text-gray-700">
            Nome completo
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
          />
        </label>

        <label className="block mb-3">
          <span className="block text-sm font-medium text-gray-700">
            E-mail institucional
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
          />
        </label>

        <label className="block mb-3">
          <span className="block text-sm font-medium text-gray-700">
            Matrícula
          </span>
          <input
            type="text"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
          />
        </label>

        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700">Curso</span>
          <select
            value={cursoId}
            onChange={(e) => setCursoId(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
            required
          >
            <option value="">Selecione o curso</option>
            {cursos.map((curso) => (
              <option key={curso.id} value={curso.id}>
                {curso.label}
              </option>
            ))}
          </select>
          {!cursos.length && (
            <p className="text-xs text-gray-500 mt-1">
              Nenhum curso disponível no momento.
            </p>
          )}
        </label>

        <label className="block mb-4">
          <span className="block text-sm font-medium text-gray-700">
            Por que você acredita que precisa de apoio?
          </span>
          <textarea
            value={motivation}
            onChange={(e) => setMotivation(e.target.value)}
            rows={4}
            className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 focus:outline-none disabled:opacity-60"
        >
          {loading ? 'Enviando...' : 'Enviar solicitação'}
        </button>
      </form>
    </section>
  );
}
