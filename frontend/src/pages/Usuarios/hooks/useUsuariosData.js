import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../services/firebase';

export default function useUsuariosData({ isAdmin = false } = {}) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      setError('Acesso bloqueado para esta funcionalidade.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'users'), orderBy('email', 'asc'));
      const snap = await getDocs(q);
      const list = snap.docs.map((docRef) => ({ id: docRef.id, ...docRef.data() }));
      setUsuarios(list);
    } catch (err) {
      console.error(err);
      const code = err?.code || err?.message || 'Erro';
      if (code === 'permission-denied' && auth.currentUser?.uid) {
        try {
          const meRef = doc(db, 'users', auth.currentUser.uid);
          const meSnap = await getDoc(meRef);
          const me = meSnap.exists() ? meSnap.data() : null;
          const role = me?.role;
          const active = me?.active;
          setError(
            `Erro ao carregar usuários: ${code}. Seu documento users/${auth.currentUser.uid} está com role="${role}" ativo="${active}".`,
          );
          return;
        } catch (docErr) {
          console.error('Falha ao conferir doc do usuário logado:', docErr);
        }
      }
      setError(`Erro ao carregar usuários: ${code}`);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadUsers();
  }, [isAdmin, loadUsers]);

  const handleRoleChange = async (userId, role) => {
    setSavingId(userId);
    try {
      const ref = doc(db, 'users', userId);
      await setDoc(ref, { role }, { merge: true });
      setUsuarios((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
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
        prev.map((u) => (u.id === userId ? { ...u, active: nextActive } : u)),
      );
    } catch (err) {
      console.error(err);
      alert('Não foi possível atualizar o status do usuário.');
    } finally {
      setTogglingId(null);
    }
  };

  return {
    usuarios,
    loading,
    error,
    savingId,
    togglingId,
    handleRoleChange,
    handleToggleActive,
    loadUsers,
  };
}
