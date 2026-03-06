export const clampPercent = (value) => Math.min(100, Math.max(0, value));

export const toKilobytes = (bytes = 0) => Math.round((bytes || 0) / 1024);

export const getMaxTimeline = (timeline = [], countKey = 'count') => {
  return Math.max(
    1,
    ...timeline.map((item) => Number(item?.[countKey] || 0))
  );
};

export const getMaxFromPair = (arr = []) =>
  Math.max(
    1,
    ...arr.map((item) =>
      Math.max(Number(item?.solicitacoes || 0), Number(item?.atendimentosConcluidos || 0))
    )
  );
