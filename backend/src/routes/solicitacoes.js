// src/routes/solicitacoes.js
import express from 'express';
import { getAdminDb } from '../firebaseAdmin.js';

const router = express.Router();
const isStaff = (user) => user && (user.role === 'admin' || user.role === 'servidor');

// Inicializa Firebase Admin (mesma lógica que você já usa em meetings.js)
let db;
try {
  db = getAdminDb();
} catch (error) {
  console.error('Erro ao inicializar Firebase Admin em solicitacoes:', error);
}

function mapDoc(doc) {
  return {
    id: doc.id,
    ...doc.data(),
  };
}

// GET /api/solicitacoes?discenteId=xxx&status=yyy
router.get('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária para consultar solicitações.',
      });
    }

    const { discenteId, status } = req.query;

    let ref = db.collection('solicitacoesAtendimento');

    if (discenteId) {
      ref = ref.where('discenteId', '==', discenteId);
    }

    if (status) {
      ref = ref.where('status', '==', status);
    }

    const snapshot = await ref.get();
    const items = snapshot.docs.map(mapDoc);

    res.json({
      success: true,
      data: items,
      total: items.length,
    });
  } catch (error) {
    console.error('Erro ao listar solicitações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar solicitações',
      error: error.message,
    });
  }
});

// (opcional) GET /api/solicitacoes/:id
router.get('/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária para consultar solicitações.',
      });
    }

    const { id } = req.params;
    const docRef = db.collection('solicitacoesAtendimento').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Solicitação não encontrada',
      });
    }

    res.json({
      success: true,
      data: mapDoc(snap),
    });
  } catch (error) {
    console.error('Erro ao obter solicitação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter solicitação',
      error: error.message,
    });
  }
});

export default router;
