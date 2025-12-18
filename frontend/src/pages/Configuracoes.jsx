import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import apiService from '../services/api';
import { db } from '../services/firebase';

export default function Configuracoes() {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [maxSessions, setMaxSessions] = useState(6);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState('staff');
  const [userMsg, setUserMsg] = useState(null);
  const [userErr, setUserErr] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { role } = useOutletContext() || {};
  const loadUsers = async () => {
    if (role !== 'admin') return;
    setLoadingUsers(true);
    try {
      const q = query(collection(db, 'users'), orderBy('email', 'asc'));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, active: true, ...d.data() }));
      setUsersList(list);
    } catch (err) {
      console.warn('Erro ao carregar usuários:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiService.getAttendanceConfig();
        if (res?.success && res.data) {
          setPeriodStart(res.data.periodStart || '');
          setPeriodEnd(res.data.periodEnd || '');
          setMaxSessions(res.data.maxSessionsPerDiscente ?? 6);
        }
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar configuração de atendimentos.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      console.log(role);
      if (role !== 'admin') return;
      setLoadingUsers(true);
      try {
        const q = query(collection(db, 'users'), orderBy('email', 'asc'));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, active: true, ...d.data() }));
        setUsersList(list);
      } catch (err) {
        console.warn('Erro ao carregar usuários:', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    loadUsers();
  }, [role]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        maxSessionsPerDiscente: Number(maxSessions) || 0,
      };

      const res = await apiService.updateAttendanceConfig(payload);
      if (res?.success) {
        setSuccess('Configuração salva com sucesso.');
      } else {
        setError('Falha ao salvar configuração.');
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao salvar configuração.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreatingUser(true);
    setUserErr(null);
    setUserMsg(null);

    const emailTrimmed = userEmail.trim();
    const passwordTrimmed = userPassword.trim();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailTrimmed)) {
      setUserErr('Informe um e-mail válido.');
      setCreatingUser(false);
      return;
    }

    if (passwordTrimmed.length < 8) {
      setUserErr('A senha deve ter pelo menos 8 caracteres.');
      setCreatingUser(false);
      return;
    }

    try {
      const res = await apiService.createUserAdmin({
        email: emailTrimmed,
        password: passwordTrimmed,
        role: userRole,
      });
      if (res?.success) {
        setUserMsg(`Usuário ${res.data?.email || userEmail} criado com sucesso.`);
        setUserEmail('');
        setUserPassword('');
        setUserRole('staff');
        await loadUsers();
      } else {
        setUserErr(res?.message || 'Falha ao criar usuário.');
      }
    } catch (err) {
      console.error(err);
      setUserErr(err.message || 'Erro ao criar usuário.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleActive = async (userId, currentActive) => {
    setLoadingUsers(true);
    try {
      await setDoc(
        doc(db, 'users', userId),
        { active: !currentActive },
        { merge: true }
      );
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, active: !currentActive } : u
        )
      );
    } catch (err) {
      console.error(err);
      alert('Não foi possível atualizar o status do usuário.');
    } finally {
      setLoadingUsers(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div>
        <p className="text-xs uppercase text-gray-500">Configurações</p>
        <h1 className="text-2xl font-bold text-gray-900">Parâmetros e Usuários</h1>
        <p className="text-sm text-gray-600">
          Ajuste limites de sessões e cadastre usuários (admin/staff).
        </p>
      </div>

      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-3">Configuração de atendimentos</h2>

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-2">{success}</p>}

        {loading ? (
          <p>Carregando...</p>
        ) : (
          <form
            onSubmit={handleSave}
            className="space-y-4 text-sm"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block mb-1 text-gray-700">
                  Início do período letivo
                </label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="border rounded-lg px-3 py-2 w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Opcional. Se não for informado, o sistema considera os últimos 6 meses.
                </p>
              </div>

              <div>
                <label className="block mb-1 text-gray-700">
                  Fim do período letivo
                </label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="border rounded-lg px-3 py-2 w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Opcional. Se não for informado, o sistema considera a data atual.
                </p>
              </div>

              <div>
                <label className="block mb-1 text-gray-700">
                  Limite de sessões por discente no período
                </label>
                <input
                  type="number"
                  min={0}
                  value={maxSessions}
                  onChange={(e) => setMaxSessions(e.target.value)}
                  className="border rounded-lg px-3 py-2 w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Exemplo: 6 sessões por semestre. Use 0 para não aplicar limite.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar configuração'}
            </button>
          </form>
        )}
      </section>

      {role === 'admin' && (
        <section className="bg-white rounded-xl shadow p-4 space-y-3">
          <h2 className="text-lg font-semibold mb-1">Cadastro de usuários</h2>
          {userErr && <p className="text-red-500 text-sm mb-2">{userErr}</p>}
          {userMsg && <p className="text-green-600 text-sm mb-2">{userMsg}</p>}

          <form className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm" onSubmit={handleCreateUser}>
            <div className="md:col-span-2">
              <label className="block mb-1 text-gray-700">E-mail</label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full"
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700">Senha</label>
              <input
                type="password"
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full"
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700">Papel</label>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full"
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="md:col-span-4">
              <button
                type="submit"
                disabled={creatingUser}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {creatingUser ? 'Criando...' : 'Criar usuário'}
              </button>
            </div>
          </form>
          <p className="text-xs text-gray-500 mt-2">
            Criação via Admin SDK (backend). Usuários são gravados na coleção <code>users</code> com o papel informado.
          </p>

          <div className="pt-2 border-t">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">Usuários cadastrados</h3>
              {loadingUsers && <span className="text-xs text-gray-500">Atualizando...</span>}
            </div>
            {usersList.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum usuário encontrado na coleção.</p>
            ) : (
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
                    {usersList.map((u) => (
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
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(u.id, u.active === false ? false : true)}
                            disabled={loadingUsers}
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
        </section>
      )}
    </div>
  );
}
