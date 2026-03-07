import express from 'express';
import { getAdminDb } from '../firebaseAdmin.js';
import SolicitacoesService from '../services/solicitacoesService.js';

const router = express.Router();

let db = null;
try {
  db = getAdminDb();
} catch (error) {
  console.error('Erro ao inicializar Firebase Admin em solicitacoes:', error);
}

const solicitacoesService = new SolicitacoesService(db);

const withStatus = (res, result) => {
  const statusCode = result?.statusCode || 200;
  if (result?.success === false) {
    return res.status(statusCode).json(result);
  }
  return res.status(statusCode).json(result);
};

router.get('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária para consultar solicitações.',
      });
    }

    const { discenteId, status } = req.query;
    const result = await solicitacoesService.listSolicitacoes({
      discenteId,
      status,
    });
    return withStatus(res, result);
  } catch (error) {
    console.error('Erro ao listar solicitações:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao listar solicitações',
      error: error.message,
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária para consultar solicitações.',
      });
    }

    const { id } = req.params;
    const result = await solicitacoesService.getSolicitacaoById(id);
    return withStatus(res, result);
  } catch (error) {
    console.error('Erro ao obter solicitação:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter solicitação',
      error: error.message,
    });
  }
});

export default router;
