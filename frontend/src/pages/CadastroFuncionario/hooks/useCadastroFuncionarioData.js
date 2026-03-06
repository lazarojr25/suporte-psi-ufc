import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../../services/firebase';
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
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      try {
        await setDoc(doc(db, 'users', cred.user.uid), {
          email: cred.user.email || '',
          role: FUNCIONARIO_DEFAULT_ROLE,
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Não foi possível criar doc do usuário:', e);
      }
      navigate('/gerenciar-solicitacoes');
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
