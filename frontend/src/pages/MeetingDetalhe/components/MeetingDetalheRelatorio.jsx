function formatSummaryText(value, maxLength = 180) {
  if (value == null) return '';
  const text = value.toString().trim();
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function isTextLike(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export default function MeetingDetalheRelatorio({
  clinicalRecord,
  onOpenModal,
  saving,
  saveMsg,
  saveErr,
  hasClinicalRecord,
  containerClassName = '',
}) {
  const fields = [
    { key: 'motivoDemanda', label: 'Motivo da demanda' },
    { key: 'procedimentos', label: 'Procedimentos e recursos' },
    { key: 'encaminhamentosRecomendacoes', label: 'Encaminhamentos/recomendações' },
    { key: 'planoObjetivos', label: 'Objetivos do acompanhamento' },
    { key: 'analiseCompreensao', label: 'Análise e compreensão' },
    { key: 'identificacaoProfissional', label: 'Identificação do profissional' },
  ];

  const values = clinicalRecord || {};
  const filledCount = fields.filter((field) => isTextLike(values[field.key])).length;

  const firstEntries = fields
    .map((field) => ({
      ...field,
      value: values[field.key],
    }))
    .filter((item) => isTextLike(item.value))
    .slice(0, 3);

  return (
    <div className={`bg-white rounded-xl shadow p-4 sm:p-5 space-y-4 ${containerClassName}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Relatório psicológico</p>
          <h2 className="text-lg font-semibold text-gray-900">Registro clínico da sessão</h2>
          <p className="text-sm text-gray-600">
            Preencha e salve no modal para registrar o acompanhamento técnico.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span
            className={`inline-flex text-xs px-2 py-1 rounded-full border font-semibold ${
              hasClinicalRecord
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : 'bg-gray-100 text-gray-700 border-gray-200'
            }`}
          >
            {hasClinicalRecord ? 'Preenchido' : 'Não preenchido'}
          </span>
          <button
            type="button"
            onClick={onOpenModal}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
            disabled={saving}
          >
            {hasClinicalRecord ? 'Editar relatório' : 'Cadastrar relatório'}
          </button>
        </div>
      </div>

      {saveMsg && <p className="text-xs text-green-600">{saveMsg}</p>}
      {saveErr && <p className="text-xs text-red-600">{saveErr}</p>}

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase text-gray-500">Resumo</p>
          <p className="text-xs text-gray-600">Campos preenchidos: {filledCount}/6</p>
        </div>

        {hasClinicalRecord ? (
          <div className="space-y-2">
            {firstEntries.length > 0 ? (
              firstEntries.map((entry) => (
                <div key={entry.key} className="space-y-0.5">
                  <p className="text-[11px] text-gray-500">{entry.label}</p>
                  <p className="text-sm text-gray-800 leading-relaxed">{formatSummaryText(entry.value, 200)}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-700">Relatório preenchido parcialmente.</p>
            )}
            {filledCount > 3 && (
              <p className="text-[11px] text-gray-500">+ {filledCount - 3} campo(s) adicionais no relatório completo.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600">Nenhum campo do relatório foi preenchido ainda.</p>
        )}
      </div>
    </div>
  );
}
