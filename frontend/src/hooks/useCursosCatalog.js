import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

import { db } from '../services/firebase';

export const formatCursoLabel = (curso = {}) => {
  const nome = (curso.nome || '').toString().trim();
  const sigla = (curso.sigla || '').toString().trim();

  if (nome && sigla) return `${nome} (${sigla})`;
  return nome || sigla || '';
};

const normalize = (value) =>
  (value || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const getCursoDisplayName = (curso = {}) =>
  curso.nome || curso.label || '';

export default function useCursosCatalog() {
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadCursos = async () => {
      try {
        setLoading(true);
        setError(null);

        const cursosQuery = query(collection(db, 'cursos'), orderBy('nome', 'asc'));
        const snapshot = await getDocs(cursosQuery);
        const list = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((curso) => (curso.nome || curso.sigla));

        setCursos(list);
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar cursos.');
      } finally {
        setLoading(false);
      }
    };

    loadCursos();
  }, []);

  const cursoOptions = useMemo(() => {
    return cursos
      .map((curso) => ({
        ...curso,
        label: formatCursoLabel(curso),
      }))
      .sort((a, b) => normalize(a.label).localeCompare(normalize(b.label)));
  }, [cursos]);

  return {
    cursos,
    cursoOptions,
    loading,
    error,
  };
}
