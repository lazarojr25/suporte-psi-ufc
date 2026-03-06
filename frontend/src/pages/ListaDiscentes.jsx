import React from 'react';
import useListaDiscentesData from './ListaDiscentes/hooks/useListaDiscentesData';
import ListaDiscentesHeader from './ListaDiscentes/components/ListaDiscentesHeader';
import ListaDiscentesFilters from './ListaDiscentes/components/ListaDiscentesFilters';
import ListaDiscentesTable from './ListaDiscentes/components/ListaDiscentesTable';

export default function ListaDiscentes() {
  const {
    discentesFiltrados,
    loading,
    error,
    search,
    setSearch,
    cursoFilter,
    setCursoFilter,
    openDetails,
  } = useListaDiscentesData();

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <ListaDiscentesHeader />
        <ListaDiscentesFilters
          search={search}
          cursoFilter={cursoFilter}
          onSearchChange={setSearch}
          onCursoChange={setCursoFilter}
        />
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-600">Carregando discentes...</div>
      ) : discentesFiltrados.length === 0 ? (
        <div className="text-gray-500 text-sm">
          Nenhum discente encontrado com os filtros atuais.
        </div>
      ) : (
        <ListaDiscentesTable
          discentes={discentesFiltrados}
          onOpenDetails={openDetails}
        />
      )}
    </div>
  );
}
