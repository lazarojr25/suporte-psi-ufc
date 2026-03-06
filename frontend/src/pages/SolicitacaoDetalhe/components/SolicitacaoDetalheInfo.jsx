import React from 'react';
import { formatDate } from '../utils/solicitacaoDetalheUtils';

export default function SolicitacaoDetalheInfo({ solicitacao }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-2 text-sm">
      <p><strong>Matrícula:</strong> {solicitacao.studentId || '---'}</p>
      <p>
        <strong>Email:</strong> {solicitacao.email || solicitacao.studentEmail || '---'}
      </p>
      <p><strong>Curso:</strong> {solicitacao.curso || '---'}</p>
      <p><strong>Motivação:</strong> {solicitacao.motivation || '---'}</p>
      <p><strong>Criada em:</strong> {formatDate(solicitacao.createdAt)}</p>
    </div>
  );
}
