// src/services/attendanceConfigStore.js
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

// coleção/doc onde vamos guardar a configuração de atendimento
const COLLECTION = 'semestreLetivo';
const DOC_ID = 'semestreLetivoConfig';

const DEFAULT_CONFIG = {
  periodStart: null,             // "2025-02-01"
  periodEnd: null,               // "2025-06-30"
  maxSessionsPerDiscente: 6      // padrão se não configurado
};

/**
 * Carrega config do Firestore.
 * Se não existir, cria com DEFAULT_CONFIG e retorna.
 */
export async function getAttendanceConfig() {
  try {
    const docRef = db.collection(COLLECTION).doc(DOC_ID);
    const snap = await docRef.get();

    if (!snap.exists) {
      // cria o doc pela primeira vez
      await docRef.set(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG };
    }

    const data = snap.data() || {};
    // mescla com defaults pra garantir campos
    return { ...DEFAULT_CONFIG, ...data };
  } catch (error) {
    console.error('Erro ao carregar attendanceConfig do Firestore:', error);
    // fallback pros defaults se der ruim
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Atualiza config no Firestore (merge com o que já existe).
 * `partial` é um objeto com as propriedades que você quiser alterar.
 */
export async function updateAttendanceConfig(partial = {}) {
  try {
    const docRef = db.collection(COLLECTION).doc(DOC_ID);

    // lê o atual (pra poder mesclar e devolver o estado final)
    const current = await getAttendanceConfig();
    const updated = {
      ...current,
      ...partial
    };

    await docRef.set(updated, { merge: true });

    return updated;
  } catch (error) {
    console.error('Erro ao salvar attendanceConfig no Firestore:', error);
    // se der erro, pelo menos devolve o que tentou salvar
    return {
      ...DEFAULT_CONFIG,
      ...partial
    };
  }
}
