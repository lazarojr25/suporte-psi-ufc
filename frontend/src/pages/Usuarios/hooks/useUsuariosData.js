import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, doc, setDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';

export default function useUsuariosData() {
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
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
  };
}
