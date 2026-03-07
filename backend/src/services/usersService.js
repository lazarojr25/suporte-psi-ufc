class UsersService {
  constructor(auth, db) {
    this.auth = auth;
    this.db = db;
  }

  _requireDependencies() {
    if (!this.auth || !this.db) {
      const error = new Error('Firebase Admin não inicializado.');
      error.statusCode = 500;
      throw error;
    }
  }

  _normalizeEmail(email) {
    return (email || '').trim().toLowerCase();
  }

  _normalizeRole(role) {
    return (role || '').toLowerCase() === 'admin' ? 'admin' : 'servidor';
  }

  validatePayload({ email, password, role }) {
    const normalizedEmail = this._normalizeEmail(email);
    const normalizedRole = this._normalizeRole(role);

    if (!normalizedEmail || !password) {
      return {
        valid: false,
        statusCode: 400,
        message: 'E-mail e senha são obrigatórios.',
      };
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      return {
        valid: false,
        statusCode: 400,
        message: 'E-mail inválido.',
      };
    }
    if (typeof password !== 'string' || password.length < 8) {
      return {
        valid: false,
        statusCode: 400,
        message: 'Senha deve ter ao menos 8 caracteres.',
      };
    }

    return {
      valid: true,
      normalizedEmail,
      normalizedRole,
    };
  }

  async createUser(payload) {
    this._requireDependencies();
    const validation = this.validatePayload(payload || {});
    if (!validation.valid) return validation;

    const { normalizedEmail, normalizedRole } = validation;
    const { password } = payload;

    try {
      const userRecord = await this.auth.createUser({
        email: normalizedEmail,
        password,
        emailVerified: false,
        disabled: false,
      });

      try {
        await this.db.collection('users').doc(userRecord.uid).set(
          {
            email: normalizedEmail,
            role: normalizedRole,
            createdAt: new Date().toISOString(),
          },
          { merge: true },
        );
      } catch (fireErr) {
        console.warn('Usuário criado, mas não foi possível salvar no Firestore:', fireErr);
      }

      return {
        success: true,
        statusCode: 201,
        data: {
          uid: userRecord.uid,
          email: userRecord.email,
          role: normalizedRole,
        },
        message: 'Usuário criado com sucesso.',
      };
    } catch (error) {
      const code = error?.code || '';
      let message = error?.message || 'Falha ao criar usuário.';
      if (code === 'auth/email-already-exists') message = 'E-mail já cadastrado.';
      if (code === 'auth/invalid-password') message = 'Senha inválida (mínimo 6 caracteres pelo Auth).';
      return {
        success: false,
        statusCode: 500,
        message,
        code,
      };
    }
  }
}

export default UsersService;
