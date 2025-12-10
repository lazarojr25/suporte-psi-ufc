import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase'; // Instância do Firebase Auth
import { useNavigate } from 'react-router-dom';

export default function CadastroFuncionario() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  // Função para criar o usuário
  const handleCadastro = async (e) => {
    e.preventDefault();

    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem!');
      return;
    }

    try {
      // Cria o usuário com e-mail e senha
      await createUserWithEmailAndPassword(auth, email, senha);
      navigate('/gerenciar-solicitacoes');  // Redireciona após sucesso
    } catch (err) {
      setErro('Erro ao criar o usuário: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-md w-full max-w-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Cadastro de Funcionário</h2>

        {erro && <p className="text-red-500 mb-4">{erro}</p>}

        <form onSubmit={handleCadastro}>
          <label className="block mb-2">
            <span className="text-sm font-medium text-gray-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
              required
            />
          </label>

          <label className="block mb-2">
            <span className="text-sm font-medium text-gray-700">Senha</span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
              required
            />
          </label>

          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700">Confirmar Senha</span>
            <input
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
              required
            />
          </label>

          <button
            type="submit"
            className="w-full py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Criar Conta
          </button>
        </form>
      </div>
    </div>
  );
}
