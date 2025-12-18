import React, { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const ROLES = ['staff', 'admin'];

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query(collection(db, 'users'), orderBy('email', 'asc'));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsuarios(list);
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar usuários.');
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, []);

  const handleRoleChange = async (userId, role) => {
    setSavingId(userId);
    try {
      const ref = doc(db, 'users', userId);
      await setDoc(ref, { role }, { merge: true });
      setUsuarios((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role } : u))
      );
    } catch (err) {
      console.error(err);
      alert('Não foi possível salvar a alteração de papel.');
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleActive = async (userId, currentActive) => {
    setTogglingId(userId);
    try {
      const nextActive = currentActive === false ? true : false;
      const ref = doc(db, 'users', userId);
      await setDoc(ref, { active: nextActive }, { merge: true });
      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, active: nextActive } : u
        )
      );
    } catch (err) {
      console.error(err);
      alert('Não foi possível atualizar o status do usuário.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase text-gray-500">Administração</p>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-sm text-gray-600">
            Defina papéis (admin/staff) para controlar acesso.
          </p>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Carregando...</p>}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {!loading && usuarios.length === 0 && (
        <p className="text-sm text-gray-500">Nenhum usuário cadastrado na coleção.</p>
      )}

      {!loading && usuarios.length > 0 && (
        <div className="overflow-hidden rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Email</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Papel</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2">{u.email || u.id}</td>
                  <td className="px-4 py-2 capitalize">{u.role || 'staff'}</td>
                  <td className="px-4 py-2">
                    {u.active === false ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-100">
                        Desativado
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Ativo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 space-x-2">
                    <select
                      value={u.role || 'staff'}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={savingId === u.id}
                      className="border rounded-lg px-3 py-1 text-sm"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(u.id, u.active === false ? false : true)}
                      disabled={togglingId === u.id}
                      className="px-3 py-1 rounded-md border text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      {u.active === false ? 'Reativar' : 'Desativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
