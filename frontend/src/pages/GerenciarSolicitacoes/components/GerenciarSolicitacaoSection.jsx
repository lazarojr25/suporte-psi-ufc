import GerenciarSolicitacaoItem from './GerenciarSolicitacaoItem';

export default function GerenciarSolicitacaoSection({
  title,
  count,
  countClass,
  items,
  sectionClass,
  meetingsBySolicitacao,
  onOpenDiscente,
  onOpenMeeting,
  onOpenScheduling,
  itemClassName,
}) {
  if (!items || items.length === 0) return null;

  return (
    <section className={sectionClass || 'mt-4'}>
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        {title}
        <span className={`text-xs rounded-full px-2 py-0.5 ${countClass || ''}`}>{count}</span>
      </h3>

      <ul className="space-y-3">
        {items.map((solicitacao) => (
          <GerenciarSolicitacaoItem
            key={solicitacao.id}
            itemClassName={itemClassName}
            solicitacao={solicitacao}
            meetingsBySolicitacao={meetingsBySolicitacao}
            onOpenDiscente={onOpenDiscente}
            onOpenMeeting={onOpenMeeting}
            onOpenScheduling={onOpenScheduling}
          />
        ))}
      </ul>
    </section>
  );
}
