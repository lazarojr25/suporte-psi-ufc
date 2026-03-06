import React from 'react';
import useUsuariosData from './Usuarios/hooks/useUsuariosData';
import UsuariosHeader from './Usuarios/components/UsuariosHeader';
import UsuariosTable from './Usuarios/components/UsuariosTable';

export default function Usuarios() {
  const {
    usuarios,
    loading,
    error,
    savingId,
    togglingId,
    handleRoleChange,
    handleToggleActive,
  } = useUsuariosData();

  return (
    <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <UsuariosHeader />
      </div>

      {loading && <p className="text-sm text-gray-500">Carregando...</p>}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {!loading && usuarios.length === 0 && (
        <p className="text-sm text-gray-500">
          Nenhum usuário cadastrado na coleção.
        </p>
      )}

      {!loading && usuarios.length > 0 && (
        <UsuariosTable
          usuarios={usuarios}
          onRoleChange={handleRoleChange}
          onToggleActive={handleToggleActive}
          savingId={savingId}
          togglingId={togglingId}
        />
      )}
    </div>
  );
}
