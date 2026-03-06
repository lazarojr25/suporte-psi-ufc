import React from 'react';

export default function SolicitacaoSuccessModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Solicitação enviada
          </p>
          <h3 className="text-xl font-semibold text-gray-900">
            Recebemos seus dados
          </h3>
          <p className="text-sm text-gray-700">
            Vamos revisar sua solicitação e retornar pelo seu e-mail institucional.
            Fique atento à caixa de entrada e ao spam.
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800">
          Use apenas seu e-mail institucional para garantir o recebimento das
          orientações.
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
