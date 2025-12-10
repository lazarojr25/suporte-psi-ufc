import React, { useEffect, useState } from 'react';
import { auth } from '../services/firebase';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (!currentUser || !currentUser.email.endsWith('@ufc.br')) {
        navigate('/login');  // Redireciona para o login se não for um funcionário autenticado
      } else {
        setUser(currentUser);
      }
    });

    return unsubscribe;
  }, [navigate]);

  return user ? (
    <div>
      <h1>Bem-vindo ao Dashboard</h1>
      {/* Aqui vai a lógica do painel de administração */}
    </div>
  ) : (
    <div>Carregando...</div>
  );
}
