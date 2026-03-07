import express from 'express';
import { getAdminAuth, getAdminDb } from '../firebaseAdmin.js';
import UsersService from '../services/usersService.js';

const router = express.Router();

let appInitialized = false;
let auth = null;
let db = null;
try {
  auth = getAdminAuth();
  db = getAdminDb();
  appInitialized = true;
} catch (error) {
  console.error('Erro ao inicializar Firebase Admin em users:', error);
}

const usersService = new UsersService(auth, db);

router.post('/', async (req, res) => {
  try {
    if (!appInitialized) {
      return res
        .status(500)
        .json({ success: false, message: 'Firebase Admin não inicializado.' });
    }

    const result = await usersService.createUser(req.body || {});
    const statusCode = result?.statusCode || 200;

    if (result?.success === false) {
      return res.status(statusCode).json(result);
    }

    return res.status(statusCode).json({
      success: true,
      message: result.message,
      data: result.data,
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
