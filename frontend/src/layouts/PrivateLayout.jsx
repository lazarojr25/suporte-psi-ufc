import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import TopBar from '../components/TopBar';

export default function PrivateLayout() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [role, setRole] = useState(null);
  const location = useLocation();
  const normalizeRole = (value) => {
    const r = (value || '').toLowerCase();
    if (r === 'admin') return 'admin';
    if (r === 'staff' || r === 'servidor') return 'servidor';
    return 'servidor';
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const ensureUserDoc = async () => {
      if (!user) {
        setRole(null);
        return;
      }

      try {
        const ref = doc(db, 'users', user.uid);
        console.log('userId: ',user.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          console.log('nao achou user');
          await setDoc(ref, {
            email: user.email || '',
            role: 'servidor',
            createdAt: new Date().toISOString(),
          });
          setRole('servidor');
        } else {
          console.log('achou usar');
          const data = snap.data();
          setRole(normalizeRole(data.role));
        }
      } catch (err) {
        console.warn('Falha ao carregar role do usuário:', err);
        setRole('servidor');
      }
    };

    ensureUserDoc();
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-600">
        Verificando sessão...
      </div>
    );
  }


  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.isAnonymous) {
    return <Navigate to="/" replace />;
  }

  const adminOnlyRoutes = ['/relatorios', '/usuarios'];
  const isAdmin = role === 'admin';
  if (role && !isAdmin && adminOnlyRoutes.includes(location.pathname)) {
    return <Navigate to="/agenda" replace />;
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      <TopBar user={user} role={role} />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet context={{ role }} />
      </main>
    </div>
  );
}
