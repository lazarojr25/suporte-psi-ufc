import React from 'react';

export default function SolicitacaoIntro() {
  return (
    <section className="flex flex-col justify-center">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
        Apoio psicológico para estudantes da UFC Quixadá
      </h1>
      <p className="text-gray-700 text-sm md:text-base mb-4">
        Este canal é destinado exclusivamente a discentes da UFC Quixadá
        que desejam solicitar acompanhamento psicológico.
      </p>
      <ul className="text-sm text-gray-700 space-y-1 mb-6 list-disc list-inside">
        <li>Preencha o formulário ao lado com seus dados institucionais;</li>
        <li>Sua solicitação será avaliada pela equipe de psicologia;</li>
        <li>Você será contatado pelo e-mail informado para orientações.</li>
      </ul>
      <p className="text-xs text-gray-500">
        As informações fornecidas são confidenciais e utilizadas apenas
        para fins de acolhimento e atendimento psicológico.
      </p>
    </section>
  );
}
