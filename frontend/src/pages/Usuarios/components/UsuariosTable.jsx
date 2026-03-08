import React from 'react';
import { ROLE_OPTIONS, roleLabel, normalizeRole } from '../utils/usuariosUtils';

export default function UsuariosTable({
  usuarios,
  onRoleChange,
  onToggleActive,
  savingId,
  togglingId,
}) {
  return (
    <div className="overflow-auto rounded-xl border h-full">
      <table className="min-w-full text-xs sm:text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-3 py-2 sm:px-4 sm:py-2.5 text-left font-medium text-gray-700">
              Email
            </th>
            <th className="px-3 py-2 sm:px-4 sm:py-2.5 text-left font-medium text-gray-700">
              Papel
            </th>
            <th className="px-3 py-2 sm:px-4 sm:py-2.5 text-left font-medium text-gray-700">
              Status
            </th>
            <th className="px-3 py-2 sm:px-4 sm:py-2.5 text-left font-medium text-gray-700">
              Ações
            </th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((user) => (
            <tr key={user.id} className="border-b last:border-b-0">
              <td className="px-3 py-2 sm:px-4 sm:py-2.5">{user.email || user.id}</td>
              <td className="px-3 py-2 sm:px-4 sm:py-2.5 capitalize">{roleLabel(user.role)}</td>
              <td className="px-3 py-2 sm:px-4 sm:py-2.5">
                {user.active === false ? (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-100">
                    Desativado
                  </span>
                ) : (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                    Ativo
                  </span>
                )}
              </td>
              <td className="px-3 py-2 sm:px-4 sm:py-2.5 space-x-2">
                <select
                  value={normalizeRole(user.role)}
                  onChange={(e) => onRoleChange(user.id, e.target.value)}
                  disabled={savingId === user.id}
                  className="border rounded-lg px-2.5 py-1 text-xs sm:text-sm"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => onToggleActive(user.id, user.active === false ? false : true)}
                  disabled={togglingId === user.id}
                  className="px-2.5 py-1 rounded-md border text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {user.active === false ? 'Reativar' : 'Desativar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
