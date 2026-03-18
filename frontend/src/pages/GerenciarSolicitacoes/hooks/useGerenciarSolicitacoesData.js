import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';

import { db } from '../../../services/firebase';
import useCursosCatalog from '../../../hooks/useCursosCatalog';
import apiService from '../../../services/api';
import {
  buildCursoOptions,
  normalizeStatus,
  toDate,
} from '../utils/gerenciarSolicitacoesUtils';

export default function useGerenciarSolicitacoesData() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [meetingsBySolicitacao, setMeetingsBySolicitacao] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchName, setSearchName] = useState('');
  const [searchMatricula, setSearchMatricula] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [curso, setCurso] = useState('');
  const { cursoOptions: cursoCatalogOptions } = useCursosCatalog();

  useEffect(() => {
    const fetchSolicitacoes = async () => {
      try {
        setLoading(true);
        setError(null);

        const solicitacoesQuery = query(
          collection(db, 'solicitacoesAtendimento'),
          orderBy('createdAt', 'desc')
        );

        const [querySnapshot, meetingsResp] = await Promise.all([
          getDocs(solicitacoesQuery),
          apiService.getMeetings(),
        ]);

        const solicitacoesData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setSolicitacoes(solicitacoesData);

        const map = {};
        if (meetingsResp?.success && meetingsResp.data?.meetings) {
          meetingsResp.data.meetings.forEach((m) => {
            if (m.solicitacaoId) {
              map[m.solicitacaoId] = m.id;
            }
          });
        }
        setMeetingsBySolicitacao(map);
      } catch (err) {
        console.error('Erro ao buscar solicitações:', err);
        setError('Erro ao carregar solicitações de atendimento.');
      } finally {
        setLoading(false);
      }
    };

    fetchSolicitacoes();
  }, []);

  const cursoOptions = useMemo(
    () => buildCursoOptions(cursoCatalogOptions),
    [cursoCatalogOptions]
  );
  const cursoSelected = cursoOptions.find((c) => c.id === curso) || null;

  const cursoNomeSet = useMemo(() => {
    if (!cursoSelected) return null;
    return new Set([
      cursoSelected.nome.toLowerCase(),
      cursoSelected.sigla.toLowerCase(),
    ].filter(Boolean));
  }, [cursoSelected]);

  const filteredSolicitacoes = useMemo(() => {
    const termName = searchName.trim().toLowerCase();
    const termMat = searchMatricula.trim().toLowerCase();
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

    return solicitacoes.filter((s) => {
      const created = toDate(s.createdAt);
      if (start && (!created || created < start)) return false;
      if (end && (!created || created > end)) return false;

      const nameMatch = termName
        ? (s.name || s.studentName || '').toLowerCase().includes(termName)
        : true;
      const matMatch = termMat
        ? (s.studentId || '').toLowerCase().includes(termMat)
        : true;
      const cursoMatch = curso
        ? [
            s.cursoId,
            s.cursoNome,
            s.cursoSigla,
            s.curso,
          ]
            .filter(Boolean)
            .map((value) => value.toString().trim().toLowerCase())
            .some((value) => {
              if (value === curso) return true;
              if (cursoNomeSet && cursoNomeSet.has(value)) return true;
              return false;
            })
        : true;
      return nameMatch && matMatch && cursoMatch;
    });
  }, [solicitacoes, searchName, searchMatricula, startDate, endDate, curso, cursoNomeSet]);

  const pendentes = useMemo(
    () => filteredSolicitacoes.filter((s) => normalizeStatus(s.status) === 'pendente'),
    [filteredSolicitacoes]
  );

  const agendadas = useMemo(
    () => filteredSolicitacoes.filter((s) => normalizeStatus(s.status) === 'agendada'),
    [filteredSolicitacoes]
  );

  return {
    solicitacoes: filteredSolicitacoes,
    meetingsBySolicitacao,
    loading,
    error,
    searchName,
    setSearchName,
    searchMatricula,
    setSearchMatricula,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    curso,
    setCurso,
    cursoOptions,
    pendentes,
    agendadas,
  };
}
