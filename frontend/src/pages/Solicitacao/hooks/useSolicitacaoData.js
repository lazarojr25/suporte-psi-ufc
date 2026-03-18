import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

import { db } from '../../../services/firebase';
import useCursosCatalog, { getCursoDisplayName } from '../../../hooks/useCursosCatalog';
import { STATUS } from '../utils/solicitacaoUtils';

export default function useSolicitacaoData() {
  const navigate = useNavigate();
  const { cursoOptions, loading: cursosLoading } = useCursosCatalog();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [motivation, setMotivation] = useState('');
  const [cursoId, setCursoId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const cursoSelecionado = useMemo(
    () => cursoOptions.find((curso) => curso.id === cursoId) || null,
    [cursoOptions, cursoId],
  );

  const cursoPayload = useMemo(() => {
    if (!cursoSelecionado) return {};

    return {
      cursoId: cursoSelecionado.id,
      curso: cursoSelecionado.nome || getCursoDisplayName(cursoSelecionado),
      cursoNome: cursoSelecionado.nome || null,
      cursoSigla: cursoSelecionado.sigla || null,
    };
  }, [cursoSelecionado]);

  const createDiscente = async () => {
    const basePayload = {
      ...cursoPayload,
      updatedAt: serverTimestamp(),
    };

    const discenteRef = await addDoc(collection(db, 'discentes'), {
      name,
      email,
      studentId,
      ...basePayload,
      createdAt: serverTimestamp(),
    });

    return discenteRef.id;
  };

  const validate = () => {
    if (!name || !email || !studentId || !motivation || !cursoId) {
      return 'Por favor, preencha todos os campos.';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const discenteId = await createDiscente();

      await addDoc(collection(db, 'solicitacoesAtendimento'), {
        discenteId,
        motivation,
        status: STATUS.SOLICITADA,
        createdAt: serverTimestamp(),
        name,
        email,
        studentId,
        ...cursoPayload,
      });

      setShowSuccessModal(true);
      setName('');
      setEmail('');
      setStudentId('');
      setMotivation('');
      setCursoId('');
    } catch (err) {
      console.error(err);
      setError('Erro ao enviar solicitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return {
    name,
    setName,
    email,
    setEmail,
    studentId,
    setStudentId,
    motivation,
    setMotivation,
    cursoId,
    setCursoId,
    cursoOptions,
    cursosLoading,
    loading,
    error,
    showSuccessModal,
    setShowSuccessModal,
    handleSubmit,
    navigateToLogin: () => navigate('/login'),
  };
}
