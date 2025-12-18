import express from 'express';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const router = express.Router();

let appInitialized = false;
try {
  initializeApp({
    credential: applicationDefault(),
  });
  appInitialized = true;
} catch (error) {
  if (/already exists/u.test(error.message)) {
    appInitialized = true;
  } else {
    console.error('Erro ao inicializar Firebase Admin em users:', error);
  }
}

const auth = getAuth();
const db = getFirestore();

router.post('/', async (req, res) => {
  try {
    if (!appInitialized) {
      return res.status(500).json({ success: false, message: 'Firebase Admin não inicializado.' });
    }

    const { email, password, role = 'staff' } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'E-mail e senha são obrigatórios.' });
    }

    const userRecord = await auth.createUser({
      email,
      password,
      emailVerified: false,
      disabled: false,
    });

    try {
      await db.collection('users').doc(userRecord.uid).set({
        email,
        role,
        createdAt: new Date().toISOString(),
      }, { merge: true });
    } catch (fireErr) {
      console.warn('Usuário criado, mas não foi possível salvar no Firestore:', fireErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso.',
      data: { uid: userRecord.uid, email: userRecord.email, role },
    });
  } catch (error) {
    console.error('Erro ao criar usuário pelo Admin SDK:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Falha ao criar usuário.',
    });
  }
});

export default router;
