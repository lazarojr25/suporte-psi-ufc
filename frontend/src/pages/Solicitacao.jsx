import React from 'react';
import ufcLogo from '../assets/ufc-logo.png';

// hooks
import useSolicitacaoData from './Solicitacao/hooks/useSolicitacaoData';
import { useAnonymousAuth } from '../hooks/useAnonymousAuth';

// components
import SolicitacaoHeader from './Solicitacao/components/SolicitacaoHeader';
import SolicitacaoIntro from './Solicitacao/components/SolicitacaoIntro';
import SolicitacaoForm from './Solicitacao/components/SolicitacaoForm';
import SolicitacaoFooter from './Solicitacao/components/SolicitacaoFooter';
import SolicitacaoSuccessModal from './Solicitacao/components/SolicitacaoSuccessModal';

export default function Solicitacao() {
  useAnonymousAuth();

  const {
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
    navigateToLogin,
  } = useSolicitacaoData();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SolicitacaoHeader logoUrl={ufcLogo} onLogin={navigateToLogin} />

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-6xl grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <SolicitacaoIntro />
          <SolicitacaoForm
            error={error}
            loading={loading}
            name={name}
            setName={setName}
            email={email}
            setEmail={setEmail}
            studentId={studentId}
            setStudentId={setStudentId}
            curso={curso}
            setCurso={setCurso}
            motivation={motivation}
            setMotivation={setMotivation}
            onSubmit={handleSubmit}
          />
        </div>
      </main>

      <SolicitacaoFooter />

      <SolicitacaoSuccessModal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
      />
    </div>
  );
}
