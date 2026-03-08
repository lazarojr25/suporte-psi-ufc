import { clampPercent } from '../utils/relatoriosUtils';

export default function RelatoriosCursoTable({ byCourse, maxCourseCount }) {
  const getCourseBadge = (course) => {
    if (course.topTopics?.length) {
      return {
        list: course.topTopics,
        className:
          'px-2 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200',
      };
    }
    if (course.topKeywords?.length) {
      return {
        list: course.topKeywords,
        className:
          'px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200',
      };
    }
    return {
      list: [],
      className: '',
    };
  };

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="px-3 py-2 sm:px-4 sm:py-3 border-b">
        <h2 className="text-base sm:text-lg font-semibold">Distribuição por curso</h2>
      </div>
      <table className="min-w-full text-xs sm:text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-3 py-2 sm:px-4 sm:py-2.5 text-left font-medium text-gray-700">Curso</th>
            <th className="px-3 py-2 sm:px-4 sm:py-2.5 text-left font-medium text-gray-700">Qtde. transcrições</th>
            <th className="px-3 py-2 sm:px-4 sm:py-2.5 text-left font-medium text-gray-700">Discentes atendidos</th>
            <th className="px-3 py-2 sm:px-4 sm:py-2.5 text-left font-medium text-gray-700">Sentimento médio</th>
            <th className="px-3 py-2 sm:px-4 sm:py-2.5 text-left font-medium text-gray-700">Principais temas</th>
          </tr>
        </thead>
        <tbody>
          {byCourse.map((c) => {
            const sentiment = c.sentimentsAvg
              ? `+${(c.sentimentsAvg.positive * 100).toFixed(0)}% / ~${(
                  c.sentimentsAvg.neutral * 100
                ).toFixed(0)}% / -${(c.sentimentsAvg.negative * 100).toFixed(0)}%`
              : '---';
            const topicMeta = getCourseBadge(c);

            return (
              <tr key={c.course} className="border-b last:border-b-0">
                <td className="px-3 py-2 sm:px-4 sm:py-2.5 text-gray-900">{c.course}</td>
                <td className="px-3 py-2 sm:px-4 sm:py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-800 font-medium">{c.count}</span>
                    <div className="flex-1 h-1.5 sm:h-2 bg-gray-100 rounded-full">
                      <div
                        className="h-1.5 sm:h-2 rounded-full bg-blue-500"
                        style={{
                          width: `${clampPercent(Math.round((c.count / maxCourseCount) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-2.5 text-gray-600">{c.distinctStudents}</td>
                <td className="px-3 py-2 sm:px-4 sm:py-2.5 text-gray-600">
                  <span className="text-xs text-gray-700">{sentiment}</span>
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-2.5 text-gray-600">
                  <div className="flex flex-wrap gap-1 text-[10px] sm:text-[11px]">
                    {topicMeta.list.slice(0, 3).map((t) => (
                      <span key={`${c.course}-${t.term}`} className={topicMeta.className}>
                        {t.term}
                      </span>
                    ))}
                    {topicMeta.list.length === 0 && (
                      <span className="text-xs text-gray-500">---</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
