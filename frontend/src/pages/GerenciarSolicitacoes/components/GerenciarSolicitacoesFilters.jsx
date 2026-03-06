export default function GerenciarSolicitacoesFilters({
  searchName,
  setSearchName,
  searchMatricula,
  setSearchMatricula,
  curso,
  setCurso,
  cursoOptions,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 text-sm">
        <div className="md:col-span-2">
          <label className="block text-xs uppercase text-gray-600 mb-1">
            Nome
          </label>
          <input
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="Buscar por nome"
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-gray-600 mb-1">
            Matrícula
          </label>
          <input
            type="text"
            value={searchMatricula}
            onChange={(e) => setSearchMatricula(e.target.value)}
            placeholder="Buscar por matrícula"
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-gray-600 mb-1">
            Curso
          </label>
          <select
            value={curso}
            onChange={(e) => setCurso(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">Todos</option>
            {cursoOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase text-gray-600 mb-1">
            Início
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-gray-600 mb-1">
            Fim
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
      </div>
    </>
  );
}
