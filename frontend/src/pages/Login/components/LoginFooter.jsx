import React from 'react';

export default function LoginFooter() {
  return (
    <footer className="w-full border-t bg-white">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-gray-600">
        <div>
          <p className="font-semibold text-gray-800">
            Serviço de Acompanhamento Psicológico ao Discente · UFC Quixadá
          </p>
          <p>
            Contato:{' '}
            <span className="font-medium">psicologia.quixada@ufc.br</span>{' '}
          </p>
          <p>
            Campus da UFC em Quixadá · Av. José de Freitas Queiroz, 5000 – Cedro,
            Quixadá – CE, 63902-580
          </p>
          <p>
            Site oficial:{' '}
            <a
              href="https://www.quixada.ufc.br"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              www.quixada.ufc.br
            </a>
          </p>
        </div>

        <div className="md:text-right">
          <p className="font-semibold text-gray-800">
            Situações de urgência e risco imediato
          </p>
          <p>
            Procure o serviço de saúde mais próximo ou ligue para o{' '}
            <span className="font-semibold">SAMU 192</span>.
          </p>
        </div>
      </div>
    </footer>
  );
}
