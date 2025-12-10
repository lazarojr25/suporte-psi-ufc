import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../services/firebase';

const CURSOS = [
  'Ciência da Computação',
  'Engenharia de Computação',
  'Engenharia de Software',
  'Sistemas da Informação',
  'Redes de Computadores',
  'Design Digital',
];

export default function ListaDiscentes() {
  const [discentes, setDiscentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [cursoFilter, setCursoFilter] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const loadDiscentes = async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query(
          collection(db, 'discentes'),
          orderBy('name', 'asc')
        );
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

    return discentes.filter((d) => {
      const matchCurso = cursoFilter
        ? (d.curso || '').toLowerCase() === cursoFilter.toLowerCase()
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
  }, [discentes, search, cursoFilter]);

  const handleVerDetalhes = (discenteId) => {
    navigate(`/discentes/${discenteId}`);
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Discentes
          </h1>
          <p className="text-sm text-gray-600">
            Listagem de estudantes cadastrados no sistema.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Buscar por nome, matrícula ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm w-full sm:w-72 focus:outline-none focus:ring"
          />

          <select
            value={cursoFilter}
            onChange={(e) => setCursoFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm w-full sm:w-56 focus:outline-none focus:ring"
          >
            <option value="">Todos os cursos</option>
            {CURSOS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-600">Carregando discentes...</div>
      ) : discentesFiltrados.length === 0 ? (
        <div className="text-gray-500 text-sm">
          Nenhum discente encontrado com os filtros atuais.
        </div>
      ) : (
        <div className="bg-white shadow rounded-xl overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-700">
                  Nome
                </th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">
                  Matrícula
                </th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">
                  Curso
                </th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">
                  Email
                </th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {discentesFiltrados.map((d) => (
                <tr key={d.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2">
                    <span className="font-medium text-gray-900">
                      {d.name || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {d.studentId || '-'}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {d.curso || '-'}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {d.email || '-'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleVerDetalhes(d.id)}
                      className="px-3 py-1.5 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Ver detalhes
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
