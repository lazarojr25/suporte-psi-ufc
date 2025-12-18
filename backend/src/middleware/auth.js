import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let appInitialized = false;
try {
  initializeApp({
    credential: applicationDefault(),
  });
  appInitialized = true;
} catch (err) {
  if (/already exists/u.test(err.message)) {
    appInitialized = true;
  } else {
    console.error('Falha ao inicializar Firebase Admin para auth middleware:', err?.message);
  }
}

const auth = appInitialized ? getAuth() : null;
const db = appInitialized ? getFirestore() : null;

async function resolveUserRole(uid) {
  if (!uid || !db) return null;
  try {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    if (data.active === false) return 'inactive';
    return data.role || null;
  } catch (err) {
    console.warn('Não foi possível ler role do Firestore:', err?.message);
    return null;
  }
}

/**
 * Middleware de autenticação/autorizaçao básica com Firebase ID Token.
 * - Requer header Authorization: Bearer <token>
 * - Se requireAdmin = true, exige role admin (customClaims.role ou doc em users)
 */
export function verifyAuth(requireAdmin = false) {
  return async (req, res, next) => {
    if (!auth) {
      return res.status(500).json({
        success: false,
        message: 'Auth não inicializado no servidor.',
      });
    }

    const authHeader = req.headers.authorization || '';
    const tokenStr = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null;

    if (!tokenStr) {
      return res.status(401).json({ success: false, message: 'Token ausente.' });
    }

    try {
      const decoded = await auth.verifyIdToken(tokenStr);
      const claimsRole = decoded.role || decoded.customClaims?.role || null;
      const roleFromDb = await resolveUserRole(decoded.uid);

      if (roleFromDb === 'inactive') {
        return res.status(403).json({ success: false, message: 'Usuário inativo.' });
      }

      const role = roleFromDb || claimsRole || 'staff';
      req.user = { uid: decoded.uid, email: decoded.email || null, role };

      if (requireAdmin && role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso restrito a administradores.' });
      }

      next();
    } catch (err) {
      console.error('Falha na autenticação:', err?.message);
      return res.status(401).json({ success: false, message: 'Token inválido ou expirado.' });
    }
  };
}
