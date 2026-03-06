import { getAdminAuth, getAdminDb } from '../firebaseAdmin.js';

let auth = null;
let db = null;
try {
  auth = getAdminAuth();
  db = getAdminDb();
} catch (err) {
  console.error('Falha ao inicializar Firebase Admin para auth middleware:', err?.message);
}

const normalizeRole = (role) => {
  const r = (role || '').toLowerCase();
  if (r === 'inactive') return 'inactive';
  if (r === 'admin') return 'admin';
  if (r === 'staff' || r === 'servidor') return 'servidor';
  return role || null;
};

async function resolveUserRole(uid) {
  if (!uid || !db) return null;
  try {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    if (data.active === false) return 'inactive';
    return normalizeRole(data.role);
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
export function verifyAuth(requireAdmin = false, options = {}) {
  const { allowedRoles = null, allowAnonymous = false } = options;
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
      if (allowAnonymous) {
        req.user = null;
        return next();
      }
      return res.status(401).json({ success: false, message: 'Token ausente.' });
    }

    try {
      const decoded = await auth.verifyIdToken(tokenStr);
      const claimsRole = normalizeRole(decoded.role || decoded.customClaims?.role || null);
      const roleFromDb = normalizeRole(await resolveUserRole(decoded.uid));

      if (roleFromDb === 'inactive') {
        return res.status(403).json({ success: false, message: 'Usuário inativo.' });
      }

      const role = roleFromDb || claimsRole || 'servidor';
      req.user = { uid: decoded.uid, email: decoded.email || null, role };

      if (requireAdmin && role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso restrito a administradores.' });
      }

      if (Array.isArray(allowedRoles) && allowedRoles.length && !allowedRoles.includes(role)) {
        return res.status(403).json({ success: false, message: 'Acesso não permitido para este perfil.' });
      }

      next();
    } catch (err) {
      console.error('Falha na autenticação:', err?.message);
      return res.status(401).json({ success: false, message: 'Token inválido ou expirado.' });
    }
  };
}
