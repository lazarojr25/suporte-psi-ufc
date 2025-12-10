import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Firebase
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';

// hooks
import { useAnonymousAuth } from '../hooks/useAnonymousAuth';

// ajuste o caminho conforme onde salvou o arquivo
import ufcLogo from '../assets/ufc-logo.png';

export default function Solicitacao() {
  
  useAnonymousAuth(); // login anônimo

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [motivation, setMotivation] = useState('');
  const [curso, setCurso] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  const STATUS = {
    SOLICITADA: 'Pendente',
    AGENDADA: 'Agendada',
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name || !email || !studentId || !motivation || !curso) {
      setError('Por favor, preencha todos os campos.');
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
        // dados denormalizados
        name,
        email,
        studentId,
        curso,
      });

      navigate('/obrigado');
    } catch (err) {
      console.error(err);
      setError('Erro ao enviar solicitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* HEADER COM LOGO + LOGIN */}
      <header className="w-full border-b bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={ufcLogo}
              alt="Brasão da UFC"
              className="h-12 w-auto object-contain"
            />
            <div className="leading-tight">
              <p className="text-xs uppercase tracking-[0.15em] text-gray-500">
                Universidade Federal do Ceará · Campus Quixadá
              </p>
              <p className="text-sm font-semibold text-gray-900">
                Serviço de Acompanhamento Psicológico ao Discente
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="
              inline-flex items-center gap-2 px-4 py-2 rounded-full
              text-sm font-medium
              border border-blue-600 text-blue-600
              hover:bg-blue-50 transition
            "
          >
            Área do psicólogo / Login
          </button>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-6xl grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          {/* Lado esquerdo: texto / explicação */}
          <section className="flex flex-col justify-center">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Apoio psicológico para estudantes da UFC Quixadá
            </h1>
            <p className="text-gray-700 text-sm md:text-base mb-4">
              Este canal é destinado exclusivamente a discentes da UFC Quixadá
              que desejam solicitar acompanhamento psicológico.
            </p>
            <ul className="text-sm text-gray-700 space-y-1 mb-6 list-disc list-inside">
              <li>Preencha o formulário ao lado com seus dados institucionais;</li>
              <li>Sua solicitação será avaliada pela equipe de psicologia;</li>
              <li>Você será contatado pelo e-mail institucional para orientações.</li>
            </ul>
            <p className="text-xs text-gray-500">
              As informações fornecidas são confidenciais e utilizadas apenas
              para fins de acolhimento e atendimento psicológico.
            </p>
          </section>

          {/* Lado direito: formulário */}
          <section>
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-2xl shadow-md p-6"
            >
              <h2 className="text-xl font-semibold mb-4">
                Solicitar acompanhamento psicológico
              </h2>

              {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

              <label className="block mb-3">
                <span className="block text-sm font-medium text-gray-700">
                  Nome completo
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
                />
              </label>

              <label className="block mb-3">
                <span className="block text-sm font-medium text-gray-700">
                  E-mail institucional
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
                />
              </label>

              <label className="block mb-3">
                <span className="block text-sm font-medium text-gray-700">
                  Matrícula
                </span>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
                />
              </label>

              <label className="block mb-3">
                <span className="text-sm font-medium text-gray-700">Curso</span>
                <select
                  value={curso}
                  onChange={(e) => setCurso(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
                  required
                >
                  <option value="">Selecione o curso</option>
                  <option value="Ciência da Computação">Ciência da Computação</option>
                  <option value="Engenharia de Computação">Engenharia de Computação</option>
                  <option value="Engenharia de Software">Engenharia de Software</option>
                  <option value="Sistemas de Informação">Sistemas da Informação</option>
                  <option value="Redes de Computadores">Redes de Computadores</option>
                  <option value="Design Digital">Design Digital</option>
                </select>
              </label>

              <label className="block mb-4">
                <span className="block text-sm font-medium text-gray-700">
                  Por que você acredita que precisa de apoio?
                </span>
                <textarea
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  rows={4}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 focus:outline-none disabled:opacity-60"
              >
                {loading ? 'Enviando...' : 'Enviar solicitação'}
              </button>
            </form>
          </section>
        </div>
      </main>

       {/* RODAPÉ */}
      <footer className="w-full border-t bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-gray-600">
          <div>
            <p className="font-semibold text-gray-800">
              Serviço de Acompanhamento Psicológico ao Discente · UFC Quixadá
            </p>
            <p>
              Contato:{' '}
              <span className="font-medium">
                psicologia.quixada@ufc.br
              </span>{' '}
              {/* ajuste o e-mail se precisar */}
            </p>
            <p>
              Campus da UFC em Quixadá · Av. José de Freitas Queiroz, 5000 – Cedro,
              Quixadá – CE, 63902-580
            </p>
            <p>
              Site oficial:{' '}
              <a
                href="https://www.quixada.ufc.br"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                www.quixada.ufc.br
              </a>
            </p>
          </div>

          <div className="md:text-right">
            <p className="font-semibold text-gray-800">
              Situações de urgência e risco imediato
            </p>
            <p>
              Procure o serviço de saúde mais próximo ou ligue para o{' '}
              <span className="font-semibold">SAMU 192</span>.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
