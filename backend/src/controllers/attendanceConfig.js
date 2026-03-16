import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

const COLLECTION = 'semestreLetivo';
const ACTIVE_DOC_ID = 'semestreLetivoConfig';
const DEFAULT_NAME = 'Configuração padrão';

const DEFAULT_CONFIG = {
  name: DEFAULT_NAME,
  periodStart: null, // "2025-02-01"
  periodEnd: null, // "2025-06-30"
  maxSessionsPerDiscente: 6, // padrão se não configurado
};

const toTimestamp = () => new Date().toISOString();
const normalizeStringOrNull = (value) => {
  if (value === undefined || value === null) return null;
  const v = String(value).trim();
  return v.length ? v : null;
};
const normalizeMaxSessions = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};

const normalizeConfigPayload = (value = {}) => ({
  name: normalizeStringOrNull(value.name) || DEFAULT_NAME,
  periodStart: normalizeStringOrNull(value.periodStart),
  periodEnd: normalizeStringOrNull(value.periodEnd),
  maxSessionsPerDiscente: normalizeMaxSessions(value.maxSessionsPerDiscente),
});

const normalizeConfig = (doc) => {
  const data = doc.data() || {};
  return {
    id: doc.id,
    ...normalizeConfigPayload(data),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || data.createdAt || null,
    sourceConfigId: data.sourceConfigId || null,
  };
};

const sortByUpdatedAtDesc = (configs) =>
  [...configs].sort((a, b) => {
    const dateA = Date.parse(a.updatedAt || a.createdAt || 0);
    const dateB = Date.parse(b.updatedAt || b.createdAt || 0);
    if (Number.isNaN(dateA) && Number.isNaN(dateB)) return 0;
    if (Number.isNaN(dateA)) return 1;
    if (Number.isNaN(dateB)) return -1;
    return dateB - dateA;
  });

const fetchConfigs = async () => {
  const listSnap = await db.collection(COLLECTION).get();
  return listSnap.docs
    .filter((doc) => doc.id !== ACTIVE_DOC_ID)
    .map((doc) => normalizeConfig(doc));
};

const buildActivePayload = (config, sourceConfigId = null) => {
  const base = normalizeConfigPayload(config);
  const now = toTimestamp();
  return {
    ...base,
    sourceConfigId: sourceConfigId || null,
    createdAt: config.createdAt || now,
    updatedAt: now,
  };
};

/**
 * Carrega configuração ativa e lista de configurações salvas.
 */
export async function getAttendanceConfig() {
  try {
    const activeRef = db.collection(COLLECTION).doc(ACTIVE_DOC_ID);
    const activeSnap = await activeRef.get();
    const now = toTimestamp();

    if (!activeSnap.exists) {
      const initialPayload = {
        ...DEFAULT_CONFIG,
        sourceConfigId: null,
        createdAt: now,
        updatedAt: now,
      };
      await activeRef.set(initialPayload);
      const configs = sortByUpdatedAtDesc(await fetchConfigs());
      return {
        active: { ...initialPayload, id: ACTIVE_DOC_ID },
        configs,
      };
    }

    const activeData = normalizeConfig(activeSnap);
    const active = {
      ...activeData,
      id: ACTIVE_DOC_ID,
      ...(activeSnap.data()?.sourceConfigId
        ? { sourceConfigId: activeSnap.data().sourceConfigId }
        : {}),
    };
    const configs = sortByUpdatedAtDesc(await fetchConfigs());
    return {
      active,
      configs,
    };
  } catch (error) {
    console.error('Erro ao carregar attendanceConfig do Firestore:', error);
    return {
      active: { ...DEFAULT_CONFIG, id: ACTIVE_DOC_ID },
      configs: [],
    };
  }
}

/**
 * Atualiza configuração de atendimento.
 * - configId + setActive: seleciona config existente e ativa.
 * - createNew: cria novo registro e o ativa.
 * - fallback: mantém comportamento antigo, atualizando a configuração ativa.
 */
export async function updateAttendanceConfig(partial = {}) {
  try {
    const listRef = db.collection(COLLECTION);
    const activeRef = listRef.doc(ACTIVE_DOC_ID);

    if (partial?.configId && partial.setActive) {
      const selectedRef = listRef.doc(partial.configId);
      const selectedSnap = await selectedRef.get();
      if (!selectedSnap.exists) {
        return {
          active: null,
          configs: sortByUpdatedAtDesc(await fetchConfigs()),
          error: 'Configuração selecionada não encontrada.',
        };
      }

      const selected = normalizeConfig(selectedSnap);
      const activePayload = {
        ...buildActivePayload(selected, selected.id),
        createdAt: selected.createdAt || toTimestamp(),
      };
      await activeRef.set(activePayload);

      return {
        active: { ...activePayload, id: ACTIVE_DOC_ID, sourceConfigId: selected.id },
        configs: sortByUpdatedAtDesc(await fetchConfigs()),
      };
    }

    if (partial?.createNew) {
      const now = toTimestamp();
      const newConfig = normalizeConfigPayload(partial);
      const withMeta = {
        ...newConfig,
        createdAt: now,
        updatedAt: now,
        sourceConfigId: null,
      };

      const createdRef = await listRef.add(withMeta);
      const activePayload = buildActivePayload(withMeta, createdRef.id);
      await activeRef.set(activePayload);

      return {
        active: { ...activePayload, id: ACTIVE_DOC_ID, sourceConfigId: createdRef.id },
        configs: sortByUpdatedAtDesc(await fetchConfigs()),
      };
    }

    const current = await getAttendanceConfig();
    const merged = {
      ...(current.active || {}),
      ...normalizeConfigPayload(partial),
    };
    const activePayload = buildActivePayload(merged, null);
    await activeRef.set(activePayload);

    return {
      active: { ...activePayload, id: ACTIVE_DOC_ID, sourceConfigId: null },
      configs: sortByUpdatedAtDesc(await fetchConfigs()),
    };
  } catch (error) {
    console.error('Erro ao salvar attendanceConfig no Firestore:', error);
    return {
      active: {
        ...DEFAULT_CONFIG,
        id: ACTIVE_DOC_ID,
        ...normalizeConfigPayload(partial),
      },
      configs: [],
      error: error?.message || 'Falha ao salvar configuração.',
    };
  }
}
