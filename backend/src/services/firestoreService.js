import { getAdminDb } from '../firebaseAdmin.js';

const db = getAdminDb();

const PRIMARY_COLLECTION = 'metadados_transcricoes';
const LEGACY_COLLECTIONS = ['transcriptions_metadata'];
const OVERVIEW_CACHE_COLLECTION = 'relatorio_geral_cache';

const fetchSnapshots = async (queryBuilder) => {
  const collections = [PRIMARY_COLLECTION, ...LEGACY_COLLECTIONS];
  const snapshots = await Promise.all(
    collections.map((collectionName) => {
      const ref = queryBuilder(db.collection(collectionName));
      return ref.get();
    }),
  );
  return snapshots;
};

const readAndDeduplicateDocs = (snapshots) => {
  const byId = new Map();

  snapshots.forEach((snapshot) => {
    snapshot.forEach((doc) => {
      if (!byId.has(doc.id)) {
        byId.set(doc.id, { id: doc.id, ...doc.data() });
      }
    });
  });

  return Array.from(byId.values());
};

const readTranscriptionMetadata = async (queryBuilder) => {
  try {
    const snapshots = await fetchSnapshots(queryBuilder);
    return readAndDeduplicateDocs(snapshots);
  } catch (error) {
    throw error;
  }
};

/**
 * Salva os metadados e a análise de uma transcrição no Firestore.
 * @param {object} data - Os dados a serem salvos.
 * @returns {Promise<string>} O ID do documento criado.
 */
export async function saveTranscriptionMetadata(data) {
  // Estrutura de dados a ser salva:
  // - fileName: string
  // - createdAt: string (ISO date)
  // - size: number (tamanho do texto da transcrição)
  // - metadata: object (extraInfo do upload)
  // - analysis: object (resultado da análise do Gemini)

  try {
    if (data?.fileName) {
      const safeId = data.fileName.replace(/[\/#?]+/g, '_');
      await db
        .collection(PRIMARY_COLLECTION)
        .doc(safeId)
        .set(data, { merge: true });

      // Mantém o legado para compatibilidade durante a migração da coleção.
      await db
        .collection(LEGACY_COLLECTIONS[0])
        .doc(safeId)
        .set(data, { merge: true });

      console.log(
        `Metadados de transcrição salvos no Firestore com ID: ${safeId}`,
      );
      return safeId;
    }

    const docRef = await db.collection(PRIMARY_COLLECTION).add(data);
    console.log(`Metadados de transcrição salvos no Firestore com ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error(
      'ERRO ao salvar metadados no Firestore. Verifique a inicialização do Firebase Admin SDK.',
      error,
    );
    // Em caso de falha, retorna um ID simulado para não quebrar o fluxo
    return `simulated-id-${Date.now()}`;
  }
}

/**
 * Busca metadados de transcrição por ID do discente.
 * @param {string} discenteId - O ID do discente.
 * @returns {Promise<Array<object>>} Lista de metadados.
 */
export async function getTranscriptionsByDiscenteId(discenteId) {
  try {
    const queryBuilder = (ref) =>
      ref.where('metadata.discenteId', '==', discenteId);
    const docs = await readTranscriptionMetadata(queryBuilder);
    return docs.filter((doc) => doc?.metadata?.discenteId === discenteId);
  } catch (error) {
    console.error('ERRO ao buscar metadados no Firestore.', error);
    return [];
  }
}

/**
 * Busca todos os metadados de transcrição.
 * @returns {Promise<Array<object>>} Lista de todos os metadados.
 */
export async function getAllTranscriptionsMetadata() {
  try {
    const queryBuilder = (ref) => ref;
    return await readTranscriptionMetadata(queryBuilder);
  } catch (error) {
    console.error('ERRO ao buscar todos os metadados no Firestore.', error);
    return [];
  }
}

export async function getReportsOverviewCache() {
  try {
    const doc = await db
      .collection(OVERVIEW_CACHE_COLLECTION)
      .doc('current')
      .get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  } catch (error) {
    console.error('ERRO ao buscar cache do overview de relatórios.', error);
    return null;
  }
}

export async function setReportsOverviewCache(payload = {}) {
  try {
    await db.collection(OVERVIEW_CACHE_COLLECTION).doc('current').set(
      {
        ...(payload || {}),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error('ERRO ao salvar cache do overview de relatórios.', error);
  }
}

/**
 * Remove metadados de uma transcrição pelo fileName (docId seguro).
 * @param {string} fileName
 */
export async function deleteTranscriptionMetadata(fileName) {
  if (!fileName) return;
  const safeId = fileName.replace(/[\/#?]+/g, '_');

  try {
    await db.collection(PRIMARY_COLLECTION).doc(safeId).delete();
    await db
      .collection(LEGACY_COLLECTIONS[0])
      .doc(safeId)
      .delete()
      .catch(() => {});

    console.log(`Metadados de transcrição removidos do Firestore: ${safeId}`);
  } catch (error) {
    console.error('ERRO ao remover metadados no Firestore.', error);
  }
}

export async function markReportsOverviewCacheDirty() {
  try {
    const doc = await db
      .collection(OVERVIEW_CACHE_COLLECTION)
      .doc('current')
      .get();

    const base = doc.exists ? doc.data() : {};
    const currentCount = Number(base?.pendingUpdates || 0) || 0;
    await db
      .collection(OVERVIEW_CACHE_COLLECTION)
      .doc('current')
      .set(
        {
          ...(base || {}),
          pendingUpdates: currentCount + 1,
          dirty: true,
          dirtySince: new Date().toISOString(),
          lastEventAt: new Date().toISOString(),
          updatedAt: base?.updatedAt || new Date().toISOString(),
          refreshScheduledAt: base?.refreshScheduledAt || null,
        },
        { merge: true },
      );
  } catch (error) {
    console.warn('Falha ao marcar cache do overview como stale:', error?.message);
  }
}
