import React from 'react';

export default function UsuariosHeader() {
  return (
    <div>
      <p className="text-xs uppercase text-gray-500">Administração</p>
      <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
      <p className="text-sm text-gray-600">
        Defina papéis (admin/servidor) para controlar acesso.
      </p>
    </div>
  );
}
