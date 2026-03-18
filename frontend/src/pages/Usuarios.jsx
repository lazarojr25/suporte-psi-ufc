import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import apiService from '../services/api';
import useUsuariosData from './Usuarios/hooks/useUsuariosData';
import UsuariosHeader from './Usuarios/components/UsuariosHeader';
import UsuariosTable from './Usuarios/components/UsuariosTable';
import CriarUsuarioModal from './Usuarios/components/CriarUsuarioModal';

export default function Usuarios() {
  const { role } = useOutletContext() || {};
  const isAdmin = role === 'admin';
  const roleLoaded = role !== null;
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const {
    usuarios,
    loading,
    error,
    savingId,
    togglingId,
    handleRoleChange,
    handleToggleActive,
    loadUsers,
  } = useUsuariosData({ isAdmin });

  const handleCreateUser = async ({ email, password }) => {
    setCreateLoading(true);
    setCreateError('');
    try {
      const res = await apiService.createUserAdmin({
        email,
        password,
        role: 'servidor',
      });

      if (!res?.success) {
        setCreateError(res?.message || 'Não foi possível criar o usuário.');
        return;
      }

      setIsCreateModalOpen(false);
      await loadUsers();
    } catch (err) {
      setCreateError(err?.message || 'Falha ao criar usuário.');
    } finally {
      setCreateLoading(false);
    }
  };

  if (!roleLoaded) {
    return <p className="text-sm text-gray-600">Verificando permissão...</p>;
  }

  if (!isAdmin && !loading) {
    return <p className="text-sm text-gray-600">Acesso somente para administradores.</p>;
  }

  return (
    <div className="h-full w-full flex flex-col min-h-0 bg-white rounded-2xl shadow p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <UsuariosHeader />
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
        >
          Criar
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Carregando...</p>}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {!loading && usuarios.length === 0 && (
        <p className="text-sm text-gray-500">
          Nenhum usuário cadastrado na coleção.
        </p>
      )}

      {!loading && usuarios.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <UsuariosTable
            usuarios={usuarios}
            onRoleChange={handleRoleChange}
            onToggleActive={handleToggleActive}
            savingId={savingId}
            togglingId={togglingId}
          />
        </div>
      )}
      <CriarUsuarioModal
        open={isCreateModalOpen}
        loading={createLoading}
        error={createError}
        onClose={() => {
          setIsCreateModalOpen(false);
          setCreateError('');
        }}
        onSubmit={handleCreateUser}
      />
    </div>
  );
}
