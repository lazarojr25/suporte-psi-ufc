import GerenciarSolicitacaoItem from './GerenciarSolicitacaoItem';

export default function GerenciarSolicitacaoSection({
  title,
  count,
  countClass,
  items,
  sectionClass,
  sectionBodyClassName,
  sectionListClassName,
  isCollapsible,
  isCollapsed,
  onToggle,
  meetingsBySolicitacao,
  onOpenDiscente,
  onOpenMeeting,
  onOpenScheduling,
  onOpenSolicitacao,
  itemClassName,
  hideHeader = false,
}) {
  if (!items || items.length === 0) return null;

  return (
    <section className={sectionClass || 'mt-4'}>
      {!hideHeader && (
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            {title}
            <span className={`text-xs rounded-full px-2 py-0.5 ${countClass || ''}`}>{count}</span>
          </h3>
          {isCollapsible && (
            <button
              type="button"
              onClick={onToggle}
              className="text-xs font-medium text-gray-600 border rounded-md px-2.5 py-1 hover:bg-gray-50"
            >
              {isCollapsed ? 'Mostrar' : 'Esconder'}
            </button>
          )}
        </div>
      )}

      {!isCollapsed && (
        <div className={` ${sectionBodyClassName || ''}`}>
          <ul className={`space-y-2 sm:space-y-3 ${sectionListClassName || ''}`}>
            {items.map((solicitacao) => (
              <GerenciarSolicitacaoItem
                key={solicitacao.id}
                itemClassName={itemClassName}
                solicitacao={solicitacao}
                meetingsBySolicitacao={meetingsBySolicitacao}
                onOpenDiscente={onOpenDiscente}
                onOpenMeeting={onOpenMeeting}
                onOpenScheduling={onOpenScheduling}
                onOpenSolicitacao={onOpenSolicitacao}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
