import React from 'react';
import { formatDate } from '../utils/solicitacaoDetalheUtils';

export default function SolicitacaoDetalheInfo({ solicitacao }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-4">
      <div className="pb-2 border-b">
        <p className="text-xs uppercase text-gray-500 tracking-wide">Dados do registro</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase">Nome do discente</p>
          <p className="text-sm sm:text-base font-semibold text-gray-900">
            {solicitacao.name || solicitacao.studentName || 'Não informado'}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase">Matrícula</p>
          <p className="text-sm sm:text-base text-gray-800">
            {solicitacao.studentId || '---'}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase">Email</p>
          <p className="text-sm sm:text-base text-gray-800 break-words">
            {solicitacao.email || solicitacao.studentEmail || '---'}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase">Curso</p>
          <p className="text-sm sm:text-base text-gray-800 break-words">
            {solicitacao.curso || '---'}
          </p>
        </div>

        <div className="md:col-span-2 space-y-1">
          <p className="text-xs text-gray-500 uppercase">Motivação</p>
          <p className="text-sm sm:text-base text-gray-800 leading-relaxed">
            {solicitacao.motivation || '---'}
          </p>
        </div>

        <div className="md:col-span-2 space-y-1">
          <p className="text-xs text-gray-500 uppercase">Criada em</p>
          <p className="text-sm sm:text-base text-gray-800">{formatDate(solicitacao.createdAt)}</p>
        </div>
      </div>
    </div>
  );
}
