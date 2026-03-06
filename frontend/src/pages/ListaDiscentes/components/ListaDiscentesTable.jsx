import React from 'react';

export default function ListaDiscentesTable({ discentes, onOpenDetails }) {
  return (
    <div className="bg-white shadow rounded-xl overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-gray-700">Nome</th>
            <th className="text-left px-4 py-2 font-medium text-gray-700">Matrícula</th>
            <th className="text-left px-4 py-2 font-medium text-gray-700">Curso</th>
            <th className="text-left px-4 py-2 font-medium text-gray-700">Email</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {discentes.map((discente) => (
            <tr key={discente.id} className="border-b last:border-b-0">
              <td className="px-4 py-2">
                <span className="font-medium text-gray-900">
                  {discente.name || '-'}
                </span>
              </td>
              <td className="px-4 py-2 text-gray-700">
                {discente.studentId || '-'}
              </td>
              <td className="px-4 py-2 text-gray-700">
                {discente.curso || '-'}
              </td>
              <td className="px-4 py-2 text-gray-700">
                {discente.email || '-'}
              </td>
              <td className="px-4 py-2 text-right">
                <button
                  onClick={() => onOpenDetails(discente.id)}
                  className="px-3 py-1.5 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Ver detalhes
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
