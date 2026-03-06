import React from 'react';
import useCadastroFuncionarioData from './CadastroFuncionario/hooks/useCadastroFuncionarioData';
import CadastroFuncionarioForm from './CadastroFuncionario/components/CadastroFuncionarioForm';

export default function CadastroFuncionario() {
  const {
    email,
    setEmail,
    senha,
    setSenha,
    confirmarSenha,
    setConfirmarSenha,
    erro,
    handleCadastro,
  } = useCadastroFuncionarioData();

  return (
    <CadastroFuncionarioForm
      erro={erro}
      email={email}
      setEmail={setEmail}
      senha={senha}
      setSenha={setSenha}
      confirmarSenha={confirmarSenha}
      setConfirmarSenha={setConfirmarSenha}
      onSubmit={handleCadastro}
    />
  );
}
