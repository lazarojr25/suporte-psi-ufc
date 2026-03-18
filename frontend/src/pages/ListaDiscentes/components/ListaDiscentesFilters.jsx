export default function ListaDiscentesFilters({
  search,
  cursoFilter,
  onSearchChange,
  onCursoChange,
  cursoOptions,
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <input
        type="text"
        placeholder="Buscar por nome, matrícula ou e-mail"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="px-3 py-2 border rounded-lg text-sm w-full sm:w-72 focus:outline-none focus:ring"
      />

      <select
        value={cursoFilter}
        onChange={(e) => onCursoChange(e.target.value)}
        className="px-3 py-2 border rounded-lg text-sm w-full sm:w-56 focus:outline-none focus:ring"
      >
        <option value="">Todos os cursos</option>
        {cursoOptions.map((curso) => (
          <option key={curso.id} value={curso.nome || curso.label}>
            {curso.label}
          </option>
        ))}
      </select>
    </div>
  );
}
