import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';


// Importar rotas
import transcriptionRoutes from './routes/transcription.js';
import reportsRouter from './routes/reports.js';
import meetingRoutes from './routes/meetings.js';
import attendanceConfigRoutes from './routes/attendanceConfig.js';
import solicitacaoRoutes from './routes/solicitacoes.js';
import usersRoutes from './routes/users.js';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});


// Configurar __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Criar diretório de uploads se não existir
const uploadsDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Servir arquivos estáticos do diretório de uploads
app.use('/uploads', express.static(uploadsDir));

// Rotas
app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'Backend Node.js funcionando!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// Rotas da API
app.use('/api/transcription', transcriptionRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/attendance-config', attendanceConfigRoutes);
app.use('/api/solicitacoes', solicitacaoRoutes);
app.use('/api/users', usersRoutes);


app.use('/api/reports', reportsRouter);

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Erro interno do servidor', 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Algo deu errado!' 
  });
});



// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Rota não encontrada' });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV}`);
  console.log(`Diretório de uploads: ${uploadsDir}`);
});

export default app;
