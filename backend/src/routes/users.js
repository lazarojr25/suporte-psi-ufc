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

    const { email, password, role = 'servidor' } = req.body || {};
    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedRole =
      (role || '').toLowerCase() === 'admin' ? 'admin' : 'servidor';

    if (!normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: 'E-mail e senha são obrigatórios.' });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'E-mail inválido.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Senha deve ter ao menos 8 caracteres.' });
    }

    const userRecord = await auth.createUser({
      email: normalizedEmail,
      password,
      emailVerified: false,
      disabled: false,
    });

    try {
      await db.collection('users').doc(userRecord.uid).set({
        email: normalizedEmail,
        role: normalizedRole,
        createdAt: new Date().toISOString(),
      }, { merge: true });
    } catch (fireErr) {
      console.warn('Usuário criado, mas não foi possível salvar no Firestore:', fireErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso.',
      data: { uid: userRecord.uid, email: userRecord.email, role: normalizedRole },
    });
  } catch (error) {
    console.error('Erro ao criar usuário pelo Admin SDK:', error);
    const code = error?.code || '';
    let message = error?.message || 'Falha ao criar usuário.';
    if (code === 'auth/email-already-exists') message = 'E-mail já cadastrado.';
    if (code === 'auth/invalid-password') message = 'Senha inválida (mínimo 6 caracteres pelo Auth).';
    return res.status(500).json({
      success: false,
      message,
      code,
    });
  }
});

export default router;
