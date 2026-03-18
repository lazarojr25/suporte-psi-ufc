import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import useCursosCatalog from '../../../hooks/useCursosCatalog';

export default function useListaDiscentesData() {
  const [discentes, setDiscentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [cursoFilter, setCursoFilter] = useState('');
  const { cursoOptions } = useCursosCatalog();

  const navigate = useNavigate();

  useEffect(() => {
    const loadDiscentes = async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query(collection(db, 'discentes'), orderBy('name', 'asc'));
        const snap = await getDocs(q);
        const list = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDiscentes(list);
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar discentes.');
      } finally {
        setLoading(false);
      }
    };

    loadDiscentes();
  }, []);

  const discentesFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    const selectedCurso = cursoFilter.trim();

    const selectedCursoData = cursoOptions.find((curso) => curso.id === selectedCurso) || null;
    const cursoMatchValues = selectedCursoData
      ? new Set(
          [
            selectedCursoData.id,
            selectedCursoData.nome,
            selectedCursoData.sigla,
          ]
            .filter(Boolean)
            .map((value) => value.toString().trim().toLowerCase()),
        )
      : new Set();

    return discentes.filter((d) => {
      const matchCurso = cursoFilter
        ? [d.cursoId, d.cursoNome, d.cursoSigla, d.curso]
            .filter(Boolean)
            .map((value) => value.toString().trim().toLowerCase())
            .some((value) => cursoMatchValues.has(value))
        : true;

      const matchBusca = term
        ? (
            (d.name || '').toLowerCase().includes(term) ||
            (d.email || '').toLowerCase().includes(term) ||
            (d.studentId || '').toLowerCase().includes(term)
          )
        : true;

      return matchCurso && matchBusca;
    });
  }, [discentes, search, cursoFilter, cursoOptions]);

  return {
    discentesFiltrados,
    loading,
    error,
    search,
    setSearch,
    cursoFilter,
    setCursoFilter,
    cursoOptions,
    openDetails: (discenteId) => navigate(`/discentes/${discenteId}`),
  };
}
