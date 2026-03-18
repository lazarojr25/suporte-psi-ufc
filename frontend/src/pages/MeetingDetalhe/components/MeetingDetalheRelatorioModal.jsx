function getRiskTone(riskSignals = []) {
  if (!Array.isArray(riskSignals) || !riskSignals.length) {
    return {
      label: 'Sem sinais críticos',
      className: 'bg-green-100 text-green-700',
      score: 0,
    };
  }

  const highest = riskSignals.find(
    (item) => (item.nivel || item.level || '').toLowerCase() === 'alto',
  );
  if (highest) {
    return {
      label: 'Alto',
      className: 'bg-red-100 text-red-700',
      score: 2,
    };
  }

  const medium = riskSignals.find(
    (item) => (item.nivel || item.level || '').toLowerCase() === 'medio',
  );
  if (medium) {
    return {
      label: 'Médio',
      className: 'bg-amber-100 text-amber-700',
      score: 1,
    };
  }

  return {
    label: 'Baixo',
    className: 'bg-blue-100 text-blue-700',
    score: 1,
  };
}

function getConfidenceLabel(summaryConfidence) {
  if (typeof summaryConfidence !== 'number') {
    return 'Não informado';
  }
  const pct = Math.round(summaryConfidence * 100);
  if (pct >= 85) return `${pct}% (alta)`;
  if (pct >= 65) return `${pct}% (média)`;
  return `${pct}% (baixa)`;
}

export default function MeetingDetalheRelatorioModal({
  open,
  clinicalRecord,
  onClinicalRecordChange,
  onSave,
  saving,
  saveMsg,
  saveErr,
  transcriptionAnalysis,
  transcriptionReview,
  onReviewFieldChange,
  onReviewChecklistChange,
  onUseAiSummary,
  saveBlockedMessage,
  checklistTemplate = [],
  isReviewRequired,
  missingChecklistItems,
  onClose,
}) {
  const commonFields = [
    {
      key: 'identificacaoServico',
      label: 'Identificação do serviço/profissional (CFP)',
      placeholder:
        'Ex.: Serviço-escola de Psicologia da UFC Quixadá; CRP e nome do profissional.',
    },
    {
      key: 'motivoDemanda',
      label: 'Motivo da avaliação/atendimento (demanda)',
      placeholder:
        'Demanda apresentada pelo discente ou encaminhamento recebido.',
    },
    {
      key: 'procedimentos',
      label: 'Procedimentos e recursos utilizados',
      placeholder:
        'Ex.: entrevistas, escuta clínica, observações, registros de sessões. Não citar testes formais se não usados.',
    },
    {
      key: 'encaminhamentosRecomendacoes',
      label: 'Encaminhamentos e recomendações',
      placeholder:
        'Encaminhamentos e recomendações acordados; incluir limites do acompanhamento.',
    },
    {
      key: 'limitesDocumento',
      label: 'Limites do documento',
      placeholder:
        'Ex.: Documento restrito ao acompanhamento realizado; não substitui avaliação psicológica formal.',
    },
  ];

  const risk = getRiskTone(transcriptionAnalysis?.riskSignals || []);
  const summaryConfidence = transcriptionAnalysis?.summaryConfidence;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase text-gray-500">Relatório psicológico (CFP)</p>
            <h3 className="text-lg font-semibold text-gray-900">Registro clínico da sessão</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Fechar
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            {saveMsg && <span className="text-[11px] text-green-600">{saveMsg}</span>}
            {saveErr && <span className="text-[11px] text-red-600">{saveErr}</span>}
          </div>

          {transcriptionAnalysis ? (
            <details className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2" open>
              <summary className="cursor-pointer text-sm font-medium text-gray-700 select-none">
                Revisão humana da análise automática
              </summary>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-gray-600">
                  <div className="rounded-md border border-gray-200 px-2 py-1 bg-white">
                    <p>Confiança do resumo</p>
                    <p className="text-gray-900 font-semibold">{getConfidenceLabel(summaryConfidence)}</p>
                  </div>
                  <div className="rounded-md border border-gray-200 px-2 py-1 bg-white">
                    <p>Nível de risco</p>
                    <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${risk.className}`}>
                      {risk.label}
                    </span>
                  </div>
                  <div className="rounded-md border border-gray-200 px-2 py-1 bg-white">
                    <p>Revisão obrigatória</p>
                    <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {isReviewRequired ? 'Sim' : 'Não'}
                    </span>
                  </div>
                </div>

                <div className="rounded-md border border-gray-200 px-2 py-2 bg-white">
                  <p className="text-[11px] text-gray-500 uppercase">Resumo automático</p>
                  <p className="text-sm text-gray-800">
                    {transcriptionAnalysis.summary || 'Sem resumo disponível.'}
                  </p>
                </div>

                {Array.isArray(transcriptionAnalysis.riskSignals) &&
                  transcriptionAnalysis.riskSignals.length > 0 && (
                    <div className="rounded-md border border-gray-200 px-2 py-2 bg-white">
                      <p className="text-[11px] text-gray-500 uppercase mb-1">Sinais de atenção</p>
                      <ul className="space-y-1 text-sm text-gray-700">
                        {transcriptionAnalysis.riskSignals.map((item, index) => (
                          <li key={`${item.tipo || item.type || index}`}>
                            • {item.tipo || item.type || 'Item'} — {item.evidencia || item.evidence || ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {transcriptionAnalysis.uncertainty && (
                  <div className="rounded-md border border-gray-200 px-2 py-2 bg-white">
                    <p className="text-[11px] text-gray-500 uppercase">Incerteza</p>
                    <p className="text-sm text-gray-700">
                      {transcriptionAnalysis.uncertainty.nivel ||
                        transcriptionAnalysis.uncertainty.level ||
                        'média'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(transcriptionAnalysis.uncertainty.motivos || []).slice(0, 3).join(' | ') ||
                        'Sem justificativas detalhadas.'}
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-sm block">
                    <span className="text-[11px] text-gray-600">Resumo revisado para inserir no relatório</span>
                    <textarea
                      value={transcriptionReview?.summaryDraft || ''}
                      onChange={(e) => onReviewFieldChange('summaryDraft', e.target.value)}
                      rows={3}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
                      placeholder="Ajuste o resumo automático conforme necessário."
                    />
                  </label>
                  <button
                    type="button"
                    onClick={onUseAiSummary}
                    className="text-xs font-semibold px-3 py-1 rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                  >
                    Usar resumo da IA
                  </button>
                </div>

                <label className="text-sm block">
                  <span className="text-[11px] text-gray-600">Notas da revisão</span>
                  <textarea
                    value={transcriptionReview?.reviewNotes || ''}
                    onChange={(e) => onReviewFieldChange('reviewNotes', e.target.value)}
                    rows={2}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
                    placeholder="Observações importantes do responsável pela revisão."
                  />
                </label>

                <div className="border-t pt-2 space-y-1">
                  <p className="text-[11px] text-gray-500 uppercase">
                    Checklist de validação clínica
                  </p>
                  {checklistTemplate.map((item) => (
                    <label key={item.key} className="text-sm flex gap-2 items-start">
                      <input
                        type="checkbox"
                        checked={Boolean(transcriptionReview?.checklist?.[item.key])}
                        onChange={(e) => onReviewChecklistChange(item.key, e.target.checked)}
                        className="mt-1"
                      />
                      <span className="leading-5 text-gray-700">{item.label}</span>
                    </label>
                  ))}
                  {missingChecklistItems?.length > 0 && (
                    <p className="text-[11px] text-red-600">
                      Pendências: {missingChecklistItems.join(' • ')}
                    </p>
                  )}
                  <label className="text-sm block">
                    <span className="text-[11px] text-gray-600">Revisor(a)</span>
                    <input
                      type="text"
                      value={transcriptionReview?.reviewedBy || ''}
                      onChange={(e) => onReviewFieldChange('reviewedBy', e.target.value)}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
                      placeholder="Nome (opcional)"
                    />
                  </label>
                </div>
              </div>
            </details>
          ) : (
            <p className="text-xs text-gray-500">
              A análise automática ainda não foi gerada para esta consulta.
            </p>
          )}

          {commonFields.map((field) => (
            <label key={field.key} className="text-sm space-y-1 block">
              <span className="text-[11px] text-gray-600">{field.label}</span>
              <textarea
                value={clinicalRecord[field.key]}
                onChange={(e) => onClinicalRecordChange(field.key, e.target.value)}
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
                placeholder={field.placeholder || ''}
              />
            </label>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t pt-3">
            <div className="space-y-1">
              <p className="text-xs uppercase text-gray-500">Plano de ação / intervenção</p>
              <label className="text-sm space-y-1 block">
                <span className="text-[11px] text-gray-600">Objetivos do acompanhamento</span>
                <textarea
                  value={clinicalRecord.planoObjetivos}
                  onChange={(e) => onClinicalRecordChange('planoObjetivos', e.target.value)}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
                />
              </label>
              <label className="text-sm space-y-1 block">
                <span className="text-[11px] text-gray-600">Estratégias/recursos propostos</span>
                <textarea
                  value={clinicalRecord.planoEstrategias}
                  onChange={(e) => onClinicalRecordChange('planoEstrategias', e.target.value)}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
                />
              </label>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase text-gray-500 invisible">.</p>
              <label className="text-sm space-y-1 block">
                <span className="text-[11px] text-gray-600">Acordos com o discente</span>
                <textarea
                  value={clinicalRecord.planoAcordos}
                  onChange={(e) => onClinicalRecordChange('planoAcordos', e.target.value)}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
                />
              </label>
              <label className="text-sm space-y-1 block">
                <span className="text-[11px] text-gray-600">Encaminhamentos / rede</span>
                <textarea
                  value={clinicalRecord.planoEncaminhamentos}
                  onChange={(e) => onClinicalRecordChange('planoEncaminhamentos', e.target.value)}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
                />
              </label>
              <label className="text-sm space-y-1 block">
                <span className="text-[11px] text-gray-600">Critérios de acompanhamento/reavaliação</span>
                <textarea
                  value={clinicalRecord.planoCriterios}
                  onChange={(e) => onClinicalRecordChange('planoCriterios', e.target.value)}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
                />
              </label>
              <label className="text-sm space-y-1 block">
                <span className="text-[11px] text-gray-600">Análise e compreensão do caso</span>
                <textarea
                  value={clinicalRecord.analiseCompreensao}
                  onChange={(e) => onClinicalRecordChange('analiseCompreensao', e.target.value)}
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
                  placeholder="Síntese clínica em linguagem acessível; evitar jargão jurídico/diagnóstico fechado."
                />
              </label>
              <label className="text-sm space-y-1 block">
                <span className="text-[11px] text-gray-600">Identificação do profissional</span>
                <textarea
                  value={clinicalRecord.identificacaoProfissional}
                  onChange={(e) => onClinicalRecordChange('identificacaoProfissional', e.target.value)}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="space-y-1">
              <button
                type="button"
                onClick={onSave}
                disabled={saving || saveBlockedMessage}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar registro'}
              </button>
              {saveBlockedMessage && (
                <p className="text-[11px] text-red-600">{saveBlockedMessage}</p>
              )}
            </div>
            <p className="text-[11px] text-gray-500 max-w-md">
              Estrutura alinhada ao Manual do CFP para relatório psicológico; campos são opcionais para evitar
              exigir dados não coletados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
