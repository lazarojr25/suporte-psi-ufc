import React from 'react';

export default function LoginHeader({ logoUrl, onBack }) {
  return (
    <header className="w-full border-b bg-white/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt="Brasão da UFC"
            className="h-12 w-auto object-contain"
          />
          <div className="leading-tight">
            <p className="text-xs uppercase tracking-[0.15em] text-gray-500">
              Universidade Federal do Ceará · Campus Quixadá
            </p>
            <p className="text-sm font-semibold text-gray-900">
              Serviço de Acompanhamento Psicológico ao Discente
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="
            inline-flex items-center gap-2 px-4 py-2 rounded-full
            text-sm font-medium
            border border-blue-600 text-blue-600
            hover:bg-blue-50 transition
          "
        >
          Voltar para solicitação
        </button>
      </div>
    </header>
  );
}
