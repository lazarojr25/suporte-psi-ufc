// front/src/pages/Relatorios.jsx
import React, { useEffect, useState } from 'react';
import apiService from '../services/api';

export default function Relatorios() {
  const [overview, setOverview] = useState(null);
  const [byCourse, setByCourse] = useState([]);
  const [highlights, setHighlights] = useState({ topKeywords: [], topTopics: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiService.getReportsOverview();
        if (res?.success) {
          setOverview(res.overview);
          setByCourse(res.byCourse || []);
          setHighlights(res.highlights || { topKeywords: [], topTopics: [] });
        } else {
          setError('Falha ao carregar relatórios.');
        }
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar relatórios.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Relatórios gerais de atendimentos</h1>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? (
        <p>Carregando...</p>
      ) : !overview ? (
        <p>Nenhum dado disponível.</p>
      ) : (
        <>
          {/* Cards gerais */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-gray-500 text-sm">Total de transcrições</p>
              <p className="text-2xl font-semibold">
                {overview.totalTranscriptions}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-gray-500 text-sm">Total de discentes atendidos</p>
              <p className="text-2xl font-semibold">
                {overview.totalStudents}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-gray-500 text-sm">Tamanho total (KB)</p>
              <p className="text-2xl font-semibold">
                {Math.round((overview.totalSizeBytes || 0) / 1024)}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-gray-500 text-sm">Tamanho médio (KB)</p>
              <p className="text-2xl font-semibold">
                {Math.round((overview.avgSizeBytes || 0) / 1024)}
              </p>
            </div>
          </div>

          {/* Sentimento médio geral, se existir */}
          {overview.sentimentsAvg && (
            <div className="bg-white rounded-xl shadow p-4 text-sm">
              <p className="font-semibold mb-1">Sentimento médio geral</p>
              <p className="text-gray-700">
                Positivo:{' '}
                {(overview.sentimentsAvg.positive * 100).toFixed(1)}% &nbsp;|&nbsp;
                Neutro:{' '}
                {(overview.sentimentsAvg.neutral * 100).toFixed(1)}% &nbsp;|&nbsp;
                Negativo:{' '}
                {(overview.sentimentsAvg.negative * 100).toFixed(1)}%
              </p>
            </div>
          )}

          {/* Tabela por curso */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h2 className="text-lg font-semibold">Distribuição por curso</h2>
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Curso
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Qtde. transcrições
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Discentes atendidos
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Última transcrição
                  </th>
                </tr>
              </thead>
              <tbody>
                {byCourse.map((c) => (
                  <tr key={c.course} className="border-b last:border-b-0">
                    <td className="px-4 py-2">{c.course}</td>
                    <td className="px-4 py-2">{c.count}</td>
                    <td className="px-4 py-2">{c.distinctStudents}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {c.lastTranscriptionAt
                        ? new Date(c.lastTranscriptionAt).toLocaleString(
                            'pt-BR'
                          )
                        : '---'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Principais temas gerais */}
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="text-lg font-semibold mb-3">
              Principais temas gerais identificados
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium mb-2">Palavras-chave mais frequentes</p>
                {(!highlights.topKeywords ||
                  highlights.topKeywords.length === 0) && (
                  <p className="text-gray-500 text-xs">
                    Nenhuma palavra-chave disponível.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {highlights.topKeywords?.map((k) => (
                    <span
                      key={k.term}
                      className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-800 text-xs"
                    >
                      {k.term}
                      <span className="ml-1 text-[10px] text-blue-500">
                        ({k.count})
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-medium mb-2">Tópicos gerais mais frequentes</p>
                {(!highlights.topTopics ||
                  highlights.topTopics.length === 0) && (
                  <p className="text-gray-500 text-xs">
                    Nenhum tópico disponível.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {highlights.topTopics?.map((t) => (
                    <span
                      key={t.term}
                      className="inline-flex items-center px-2 py-1 rounded-full bg-green-50 text-green-800 text-xs"
                    >
                      {t.term}
                      <span className="ml-1 text-[10px] text-green-500">
                        ({t.count})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
