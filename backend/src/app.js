import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { getUploadsDir, isServerlessRuntime } from './config/runtimePaths.js';


// Importar rotas
import transcriptionRoutes from './routes/transcription.js';
import reportsRouter from './routes/reports.js';
import meetingRoutes from './routes/meetings.js';
import attendanceConfigRoutes from './routes/attendanceConfig.js';
import solicitacaoRoutes from './routes/solicitacoes.js';
import usersRoutes from './routes/users.js';
import { verifyAuth } from './middleware/auth.js';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});


const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Criar diretório de uploads se não existir
const uploadsDir = getUploadsDir();
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
// - transcrição/reports: apenas staff/admin
// - meetings: qualquer usuário autenticado
// - attendance-config/users: admin
// - solicitacoes: permite anônimo (discente) criar; leitura exige token
app.use('/api/transcription', verifyAuth(false, { allowedRoles: ['admin', 'servidor'] }), transcriptionRoutes);
app.use('/api/meetings', verifyAuth(false), meetingRoutes);
app.use('/api/attendance-config', verifyAuth(true), attendanceConfigRoutes);
app.use('/api/solicitacoes', verifyAuth(false, { allowAnonymous: true }), solicitacaoRoutes);
app.use('/api/users', verifyAuth(true), usersRoutes);
app.use('/api/reports', verifyAuth(false, { allowedRoles: ['admin', 'servidor'] }), reportsRouter);

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

if (isServerlessRuntime) {
  console.log(`Ambiente serverless detectado. Uploads temporários em: ${uploadsDir}`);
}

export default app;
