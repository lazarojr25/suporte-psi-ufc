import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../../services/firebase';

export default function useDashboardData() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (!currentUser || !currentUser.email.endsWith('@ufc.br')) {
        navigate('/login');
      } else {
        setUser(currentUser);
      }
    });

    return unsubscribe;
  }, [navigate]);

  return { user };
}
