import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// públicas
import Solicitacao from '../pages/Solicitacao';
import PosSolicitacao from '../pages/PosSolicitacao';
import Login from '../pages/Login';

// privadas
import Relatorios from '../pages/Relatorios';
import Dashboard from '../pages/Dashboard';
import AgendarAtendimento from '../pages/AgendarAtendimento';
import GerenciarSolicitacoes from '../pages/GerenciarSolicitacoes';
import DiscenteDetalhe from '../pages/DiscenteDetalhe';
import ListaDiscentes from '../pages/ListaDiscentes';
import CadastroFuncionario from '../pages/CadastroFuncionario';
import UploadTranscricao from '../pages/UploadTranscricao';
import Configuracoes from '../pages/Configuracoes';
import Agenda from '../pages/Agenda';
import MeetingDetalhe from '../pages/MeetingDetalhe';
import SolicitacaoDetalhe from '../pages/SolicitacaoDetalhe';
import Usuarios from '../pages/Usuarios';

// layout privado
import PrivateLayout from '../layouts/PrivateLayout';

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ROTAS PÚBLICAS */}
        <Route path="/" element={<Solicitacao />} />
        <Route path="/obrigado" element={<PosSolicitacao />} />
        <Route path="/login" element={<Login />} />

        {/* ROTAS PRIVADAS (só depois de login, via PrivateLayout) */}
        <Route element={<PrivateLayout />}>
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/agendar/:solicitacaoId" element={<AgendarAtendimento />} />
          <Route path="/agendar-atendimento/:solicitacaoId" element={<AgendarAtendimento />} />
          <Route path="/discentes" element={<ListaDiscentes />} />
          <Route path="/discentes/:discenteId" element={<DiscenteDetalhe />} />
          <Route path="/solicitacoes/:solicitacaoId" element={<SolicitacaoDetalhe />} />
          <Route path="/meetings/:meetingId" element={<MeetingDetalhe />} />
          <Route path="/gerenciar-solicitacoes" element={<GerenciarSolicitacoes />} />
          <Route path="/cadastro" element={<CadastroFuncionario />} />
          <Route path="/upload-transcricao" element={<UploadTranscricao />} />
          <Route path="/configuracoes" element={<Configuracoes />} /> 
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/usuarios" element={<Usuarios />} />
        </Route>

        {/* fallback pra qualquer rota desconhecida */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
