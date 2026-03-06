export default function MeetingDetalheRelatorio({
  clinicalRecord,
  onClinicalRecordChange,
  onSave,
  saving,
  saveMsg,
  saveErr,
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
      key: 'analiseCompreensao',
      label: 'Análise e compreensão do caso',
      placeholder:
        'Síntese clínica em linguagem acessível; evitar jargão jurídico/diagnóstico fechado.',
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

  const planoLeftFields = [
    {
      key: 'planoObjetivos',
      label: 'Objetivos do acompanhamento',
    },
    {
      key: 'planoEstrategias',
      label: 'Estratégias/recursos propostos',
    },
  ];

  const planoRightFields = [
    {
      key: 'planoAcordos',
      label: 'Acordos com o discente',
    },
    {
      key: 'planoEncaminhamentos',
      label: 'Encaminhamentos / rede',
    },
    {
      key: 'planoCriterios',
      label: 'Critérios de acompanhamento/reavaliação',
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase text-gray-500">Relatório psicológico (CFP)</p>
        {saveMsg && <span className="text-[11px] text-green-600">{saveMsg}</span>}
        {saveErr && <span className="text-[11px] text-red-600">{saveErr}</span>}
      </div>

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
          {planoLeftFields.map((field) => (
            <label key={field.key} className="text-sm space-y-1 block">
              <span className="text-[11px] text-gray-600">{field.label}</span>
              <textarea
                value={clinicalRecord[field.key]}
                onChange={(e) => onClinicalRecordChange(field.key, e.target.value)}
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
              />
            </label>
          ))}
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase text-gray-500 invisible">.</p>
          {planoRightFields.map((field) => (
            <label key={field.key} className="text-sm space-y-1 block">
              <span className="text-[11px] text-gray-600">{field.label}</span>
              <textarea
                value={clinicalRecord[field.key]}
                onChange={(e) => onClinicalRecordChange(field.key, e.target.value)}
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'Salvando...' : 'Salvar registro'}
        </button>
        <p className="text-[11px] text-gray-500">
          Estrutura alinhada ao Manual do CFP para relatório psicológico; campos são opcionais para evitar
          exigir dados não coletados.
        </p>
      </div>
    </div>
  );
}
