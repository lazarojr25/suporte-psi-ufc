// src/routes/solicitacoes.js
import express from 'express';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const router = express.Router();

// Inicializa Firebase Admin (mesma lógica que você já usa em meetings.js)
let db;
try {
  initializeApp({
    credential: applicationDefault(),
  });
  db = getFirestore();
} catch (error) {
  if (/already exists/u.test(error.message)) {
    db = getFirestore();
  } else {
    console.error('Erro ao inicializar Firebase Admin em solicitacoes:', error);
  }
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
