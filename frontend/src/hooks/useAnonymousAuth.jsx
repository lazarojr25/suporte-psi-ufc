import { useEffect } from 'react';
import { auth } from '../services/firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

export function useAnonymousAuth() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && !currentUser.isAnonymous) {
        return;
      }

      signInAnonymously(auth).catch((error) => {
        if (error?.code !== 'auth/operation-not-allowed') {
          console.error('Erro no login anônimo:', error);
        }
      });
    });

    return () => unsubscribe();
  }, []);
}
