import React from 'react';

export default function AgendarAtendimentoResumo({ solicitacao, isLocked }) {
  return (
    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
      <p>
        <strong>Aluno:</strong> {solicitacao.name}
      </p>
      <p>
        <strong>Email:</strong> {solicitacao.email}
      </p>
      <p>
        <strong>Matrícula:</strong> {solicitacao.studentId}
      </p>
      <p>
        <strong>Motivo:</strong> {solicitacao.motivation}
      </p>
      {isLocked && (
        <p className="text-sm text-amber-700 mt-2">
          Já existe um encontro agendado para esta solicitação. Não é possível
          agendar outro.
        </p>
      )}
    </div>
  );
}
