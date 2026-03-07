class SolicitacoesService {
  constructor(db) {
    this.db = db;
  }

  _requireDb() {
    if (!this.db) {
      const error = new Error('Firebase Admin não inicializado.');
      error.statusCode = 500;
      throw error;
    }
  }

  _mapDoc(doc) {
    return {
      id: doc.id,
      ...doc.data(),
    };
  }

  async listSolicitacoes({ discenteId, status }) {
    this._requireDb();
    let ref = this.db.collection('solicitacoesAtendimento');

    if (discenteId) {
      ref = ref.where('discenteId', '==', discenteId);
    }

    if (status) {
      ref = ref.where('status', '==', status);
    }

    const snapshot = await ref.get();
    const items = snapshot.docs.map((doc) => this._mapDoc(doc));

    return {
      success: true,
      data: items,
      total: items.length,
    };
  }

  async getSolicitacaoById(id) {
    this._requireDb();
    const docRef = this.db.collection('solicitacoesAtendimento').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return {
        success: false,
        statusCode: 404,
        message: 'Solicitação não encontrada',
      };
    }

    return {
      success: true,
      data: this._mapDoc(snap),
    };
  }
}

export default SolicitacoesService;
