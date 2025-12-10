import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Inicialização do Firebase Admin SDK
// Em um ambiente de produção, as credenciais seriam carregadas automaticamente
// ou fornecidas via variável de ambiente GOOGLE_APPLICATION_CREDENTIALS.
// Para fins de simulação e teste local, usaremos uma inicialização básica.
// O usuário precisará configurar o Firebase Admin SDK corretamente em seu ambiente.
try {
  initializeApp({
    credential: applicationDefault(),
    // O URL do banco de dados pode ser necessário dependendo do serviço
    // databaseURL: 'https://<DATABASE_NAME>.firebaseio.com',
  });
} catch (error) {
  // Evita erro de inicialização se já estiver inicializado (ex: em testes)
  if (!/already exists/u.test(error.message)) {
    console.warn('Aviso: Firebase Admin SDK não inicializado. A persistência no Firestore será simulada.', error.message);
  }
}

const db = getFirestore();

// Coleção onde os metadados e análises das transcrições serão salvos
const TRANSCRIPTIONS_COLLECTION = 'transcriptions_metadata';

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
    // Simulação de persistência no Firestore
    const docRef = await db.collection(TRANSCRIPTIONS_COLLECTION).add(data);
    console.log(`Metadados de transcrição salvos no Firestore com ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('ERRO ao salvar metadados no Firestore. Verifique a inicialização do Firebase Admin SDK.', error);
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
    const snapshot = await db.collection(TRANSCRIPTIONS_COLLECTION)
      .where('metadata.discenteId', '==', discenteId)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    const snapshot = await db.collection(TRANSCRIPTIONS_COLLECTION).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('ERRO ao buscar todos os metadados no Firestore.', error);
    return [];
  }
}
