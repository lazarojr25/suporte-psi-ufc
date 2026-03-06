import React from 'react';

export default function LoginIntro() {
  return (
    <section className="hidden md:flex flex-col justify-center space-y-3">
      <h1 className="text-3xl font-bold text-gray-900">
        Acesso da equipe de psicologia
      </h1>
      <p className="text-sm text-gray-700">
        Entre com as credenciais fornecidas pela coordenação para gerenciar
        solicitações, agenda e prontuários.
      </p>
      <p className="text-xs text-gray-500">
        Caso não tenha acesso ou encontre problemas de login, entre em contato com
        a coordenação do serviço.
      </p>
    </section>
  );
}
