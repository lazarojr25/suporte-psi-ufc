import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

import { db } from '../../../services/firebase';
import { isInstitutionalEmail, STATUS } from '../utils/solicitacaoUtils';

export default function useSolicitacaoData() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [motivation, setMotivation] = useState('');
  const [curso, setCurso] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const getOrCreateDiscente = async () => {
    const q = query(
      collection(db, 'discentes'),
      where('studentId', '==', studentId)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      return docSnap.id;
    }

    const discenteRef = await addDoc(collection(db, 'discentes'), {
      name,
      email,
      studentId,
      curso,
      createdAt: serverTimestamp(),
    });

    return discenteRef.id;
  };

  const validate = () => {
    if (!name || !email || !studentId || !motivation || !curso) {
      return 'Por favor, preencha todos os campos.';
    }
    if (!isInstitutionalEmail(email)) {
      return 'Use seu e-mail institucional (@ufc.br ou @quixada.ufc.br).';
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
      const discenteId = await getOrCreateDiscente();

      await addDoc(collection(db, 'solicitacoesAtendimento'), {
        discenteId,
        motivation,
        status: STATUS.SOLICITADA,
        createdAt: serverTimestamp(),
        name,
        email,
        studentId,
        curso,
      });

      setShowSuccessModal(true);
      setName('');
      setEmail('');
      setStudentId('');
      setMotivation('');
      setCurso('');
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
    curso,
    setCurso,
    loading,
    error,
    showSuccessModal,
    setShowSuccessModal,
    handleSubmit,
    navigateToLogin: () => navigate('/login'),
  };
}
