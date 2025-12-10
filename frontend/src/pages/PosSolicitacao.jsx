import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PosSolicitacao() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md p-6 w-full max-w-md text-center">
        <h2 className="text-2xl font-bold mb-4">Obrigado!</h2>
        <p className="mb-4">
          Sua solicitação foi enviada com sucesso e está aguardando análise do profissional.
        </p>
        <p className="mb-6">
          Em breve você receberá um e-mail com mais informações sobre o agendamento.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:outline-none"
        >
          Voltar à página inicial
        </button>
      </div>
    </div>
  );
}
