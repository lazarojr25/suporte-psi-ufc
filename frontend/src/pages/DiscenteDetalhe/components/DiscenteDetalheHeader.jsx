import React from 'react';

export default function DiscenteDetalheHeader({
  discente,
  solicitacoes,
  relatorioDiscente,
  orderedTranscricoes,
  lastTranscription,
  hasTranscricoes,
  onAgendarNovaSessao,
  creatingSession,
  isBlockedByLimit,
  onReprocessDiscente,
  reprocessing,
  reprocessMsg,
  reprocessErr,
}) {
  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Discente</p>
          <h1 className="text-3xl font-bold text-gray-900">{discente.name}</h1>
          <p className="text-sm text-gray-500">
            Matrícula: <span className="font-semibold text-gray-700">{discente.studentId || '---'}</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm w-full md:w-auto">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs uppercase text-gray-500">Transcrições</p>
            <p className="text-2xl font-semibold text-gray-900">
              {relatorioDiscente?.totalTranscriptions ?? orderedTranscricoes.length}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs uppercase text-gray-500">Solicitações</p>
            <p className="text-2xl font-semibold text-gray-900">{solicitacoes.length}</p>
          </div>
          <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
            <button
              type="button"
              onClick={onAgendarNovaSessao}
              disabled={creatingSession || isBlockedByLimit}
              className="px-3 py-2 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              {creatingSession ? 'Criando...' : 'Agendar nova sessão'}
            </button>
            <button
              type="button"
              onClick={onReprocessDiscente}
              disabled={reprocessing || !hasTranscricoes}
              className="px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {reprocessing ? 'Reprocessando...' : 'Reprocessar transcrições'}
            </button>
            {(reprocessMsg || reprocessErr) && (
              <span className="text-[11px] text-gray-600">
                {reprocessMsg && <span className="text-green-600">{reprocessMsg}</span>}
                {reprocessErr && <span className="text-red-600">{reprocessErr}</span>}
              </span>
            )}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
        <div>
          <dt className="text-xs uppercase text-gray-500">Curso</dt>
          <dd className="text-gray-900">{discente.curso || '---'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-gray-500">E-mail</dt>
          <dd>
            {discente.email ? (
              <a href={`mailto:${discente.email}`} className="text-blue-600 hover:underline">
                {discente.email}
              </a>
            ) : (
              '---'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-gray-500">ID no sistema</dt>
          <dd className="text-gray-900 break-all">{discente.id}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-gray-500">Última atualização</dt>
          <dd className="text-gray-900">
            {lastTranscription?.createdAt
              ? new Date(lastTranscription.createdAt).toLocaleString('pt-BR')
              : 'Sem transcrições registradas'}
          </dd>
        </div>
      </dl>
    </div>
  );
}
