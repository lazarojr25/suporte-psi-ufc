import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../../../services/api';
import { FUNCIONARIO_DEFAULT_ROLE } from '../utils/cadastroFuncionarioUtils';

export default function useCadastroFuncionarioData() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  const handleCadastro = async (e) => {
    e.preventDefault();

    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem!');
      return;
    }

    try {
      const res = await apiService.createUserAdmin({
        email: email.trim(),
        password: senha,
        role: FUNCIONARIO_DEFAULT_ROLE,
      });

      if (res?.success) {
        navigate('/usuarios');
        return;
      }

      setErro(res?.message || 'Não foi possível criar o usuário.');
    } catch (err) {
      setErro(`Erro ao criar o usuário: ${err.message}`);
    }
  };

  return {
    email,
    setEmail,
    senha,
    setSenha,
    confirmarSenha,
    setConfirmarSenha,
    erro,
    handleCadastro,
  };
}
