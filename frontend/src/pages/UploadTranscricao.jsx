import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';

export default function UploadTranscricao() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedTxt, setSelectedTxt] = useState(null);
  const [txtUploading, setTxtUploading] = useState(false);
  const [txtSuccess, setTxtSuccess] = useState(null);
  const [txtError, setTxtError] = useState(null);
  const [txtDiscente, setTxtDiscente] = useState('');
  const [txtMeeting, setTxtMeeting] = useState('');
  const [txtSolicitacao, setTxtSolicitacao] = useState('');
  const [txtCurso, setTxtCurso] = useState('');
  const [txtNome, setTxtNome] = useState('');
  const [txtEmail, setTxtEmail] = useState('');
  const [txtMatricula, setTxtMatricula] = useState('');
  const [transcriptions, setTranscriptions] = useState([]);
  const [selectedTranscription, setSelectedTranscription] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadTranscriptions();
  }, []);

  const loadTranscriptions = async () => {
    try {
      const response = await apiService.getTranscriptions();
      if (response.success) setTranscriptions(response.data);
    } catch (err) {
      console.error('Erro ao carregar transcrições:', err);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    setError(null);
    setSuccess(null);
    if (!file) return;

    // Áudio + Vídeo
    const allowedTypes = [
      // áudio
      'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/x-m4a',
      // vídeo
      'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/x-msvideo'
    ];
    const allowedExtensions = [
      // áudio
      '.mp3', '.wav', '.m4a', '.ogg',
      // vídeo
      '.mp4', '.mov', '.webm', '.mkv', '.avi'
    ];

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      setError('Tipo não suportado. Use: MP3, WAV, M4A, OGG, MP4, MOV, WEBM, MKV ou AVI.');
      return;
    }

    // Limite para vídeo/áudio grandes (o backend converte/segmenta)
    const maxSize = 200 * 1024 * 1024; // 200MB
    if (file.size > maxSize) {
      setError(`Arquivo muito grande: ${(file.size / (1024 * 1024)).toFixed(2)}MB. Limite: ${maxSize / (1024 * 1024)}MB`);
      return;
    }

    setSelectedFile(file);
  };

  const handleTxtSelect = (event) => {
    const file = event.target.files?.[0];
    setTxtError(null);
    setTxtSuccess(null);
    if (!file) return;

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (ext !== '.txt' && file.type !== 'text/plain') {
      setTxtError('Envie um arquivo .txt de transcrição.');
      return;
    }
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setTxtError(`Arquivo muito grande: ${(file.size / (1024 * 1024)).toFixed(2)}MB. Limite: ${maxSize / (1024 * 1024)}MB`);
      return;
    }
    setSelectedTxt(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Por favor, selecione um arquivo de áudio ou vídeo.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // supondo que você tenha esses dados (por ex. carregados do Firestore)
      formData.append('discenteId', discente.id);
      formData.append('studentName', discente.name);
      formData.append('studentEmail', discente.email);
      formData.append('studentId', discente.studentId);
      formData.append('curso', discente.curso);
      const response = await apiService.uploadMedia(formData);

      if (response.success) {
        setSuccess('Transcrição iniciada/concluída com sucesso!');
        setSelectedFile(null);
        const input = document.getElementById('mediaFile');
        if (input) input.value = '';
        await loadTranscriptions();
      } else {
        throw new Error(response.message || 'Erro na transcrição');
      }
    } catch (err) {
      console.error('Erro no upload:', err);
      setError(err.message || 'Erro ao fazer upload do arquivo');
    } finally {
      setUploading(false);
    }
  };

  const handleTxtUpload = async () => {
    if (!selectedTxt) {
      setTxtError('Selecione um arquivo .txt de transcrição.');
      return;
    }

    setTxtUploading(true);
    setTxtError(null);
    setTxtSuccess(null);

    try {
      const extra = {
        discenteId: txtDiscente || undefined,
        meetingId: txtMeeting || undefined,
        solicitacaoId: txtSolicitacao || undefined,
        curso: txtCurso || undefined,
        studentName: txtNome || undefined,
        studentEmail: txtEmail || undefined,
        studentId: txtMatricula || undefined,
      };
      const response = await apiService.uploadTranscriptText(selectedTxt, extra);
      if (response.success) {
        setTxtSuccess('Transcrição pronta processada com sucesso!');
        setSelectedTxt(null);
        const input = document.getElementById('txtFile');
        if (input) input.value = '';
        await loadTranscriptions();
      } else {
        throw new Error(response.message || 'Erro ao processar transcrição.');
      }
    } catch (err) {
      console.error('Erro no upload do TXT:', err);
      setTxtError(err.message || 'Erro ao processar transcrição pronta.');
    } finally {
      setTxtUploading(false);
    }
  };

  const handleViewTranscription = async (fileName) => {
    try {
      const response = await apiService.getTranscription(fileName);
      if (response.success) setSelectedTranscription(response.data);
    } catch (err) {
      console.error('Erro ao carregar transcrição:', err);
      setError('Erro ao carregar transcrição');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleString('pt-BR');

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold mb-6">Upload e Transcrição (Áudio/Vídeo)</h1>

          {/* Seção de Upload */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Novo Upload</h2>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                {success}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecionar Arquivo de Áudio ou Vídeo
              </label>
              <input
                id="mediaFile"
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,.mp4,.mov,.webm,.mkv,.avi,audio/*,video/*"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Formatos: MP3, WAV, M4A, OGG, MP4, MOV, WEBM, MKV, AVI (máx. 200MB).
                O servidor converterá e dividirá arquivos grandes automaticamente.
              </p>
            </div>

            {selectedFile && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Arquivo Selecionado:</h3>
                <p><strong>Nome:</strong> {selectedFile.name}</p>
                <p><strong>Tamanho:</strong> {formatFileSize(selectedFile.size)}</p>
                <p><strong>Tipo:</strong> {selectedFile.type || 'desconhecido'}</p>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {uploading ? 'Processando...' : 'Fazer Upload e Transcrever'}
            </button>
          </div>

          {/* Seção de Upload de Transcrição Pronta */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Enviar transcrição pronta (TXT)</h2>

            {txtError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {txtError}
              </div>
            )}

            {txtSuccess && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                {txtSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Arquivo .txt da transcrição
                <input
                  id="txtFile"
                  type="file"
                  accept=".txt,text/plain"
                  onChange={handleTxtSelect}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Discente ID (opcional)
                <input
                  type="text"
                  value={txtDiscente}
                  onChange={(e) => setTxtDiscente(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
                  placeholder="ID do discente no Firestore"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Meeting ID (opcional)
                <input
                  type="text"
                  value={txtMeeting}
                  onChange={(e) => setTxtMeeting(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
                  placeholder="ID da reunião"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Solicitação ID (opcional)
                <input
                  type="text"
                  value={txtSolicitacao}
                  onChange={(e) => setTxtSolicitacao(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
                  placeholder="ID da solicitação"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Nome (opcional)
                <input
                  type="text"
                  value={txtNome}
                  onChange={(e) => setTxtNome(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
                  placeholder="Nome do discente"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                E-mail (opcional)
                <input
                  type="email"
                  value={txtEmail}
                  onChange={(e) => setTxtEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
                  placeholder="Email do discente"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Matrícula (opcional)
                <input
                  type="text"
                  value={txtMatricula}
                  onChange={(e) => setTxtMatricula(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
                  placeholder="Matrícula"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Curso (opcional)
                <input
                  type="text"
                  value={txtCurso}
                  onChange={(e) => setTxtCurso(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
                  placeholder="Curso"
                />
              </label>
            </div>

            {selectedTxt && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Arquivo selecionado:</h3>
                <p><strong>Nome:</strong> {selectedTxt.name}</p>
                <p><strong>Tamanho:</strong> {formatFileSize(selectedTxt.size)}</p>
              </div>
            )}

            <button
              onClick={handleTxtUpload}
              disabled={!selectedTxt || txtUploading}
              className="px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {txtUploading ? 'Processando...' : 'Enviar TXT e analisar'}
            </button>
          </div>

          {/* Lista de Transcrições */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Transcrições Existentes</h2>
            {transcriptions.length === 0 ? (
              <p className="text-gray-500">Nenhuma transcrição encontrada.</p>
            ) : (
              <div className="grid gap-4">
                {transcriptions.map((t, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{t.fileName}</h3>
                        <p className="text-sm text-gray-500">Criado em: {formatDate(t.createdAt)}</p>
                        <p className="text-sm text-gray-500">Tamanho: {formatFileSize(t.size)}</p>
                      </div>
                      <button
                        onClick={() => handleViewTranscription(t.fileName)}
                        className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        Ver Transcrição
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Visualização da Transcrição */}
        {selectedTranscription && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Transcrição: {selectedTranscription.fileName}</h2>
              <button
                onClick={() => setSelectedTranscription(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Fechar
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">Criado em: {formatDate(selectedTranscription.createdAt)}</p>
              <p className="text-sm text-gray-500 mb-4">Tamanho: {formatFileSize(selectedTranscription.size)}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium mb-2">Conteúdo da Transcrição:</h3>
              <div className="whitespace-pre-wrap text-sm">
                {selectedTranscription.content}
              </div>
            </div>
          </div>
        )}

        {/* Botão para voltar */}
        <div className="mt-6">
          <button
            onClick={() => navigate('/gerenciar-solicitacoes')}
            className="px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700"
          >
            Voltar para Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
