import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function DataTable({
  columns,
  data,
  total = 0,
  page = 1,
  perPage = 20,
  onPageChange,
  onSearch,
  searchPlaceholder = 'Search...',
  loading = false,
  actions,
  extraFilters,
  title,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const totalPages = Math.ceil(total / perPage) || 1;

  const handleSearch = (e) => {
    e.preventDefault();
    onSearch?.(searchTerm);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {title && <h3 className="text-base font-semibold text-gray-800">{title}</h3>}
            <p className="text-xs text-gray-500 mt-0.5">{total.toLocaleString()} total records</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {extraFilters}
            {onSearch && (
              <form onSubmit={handleSearch} className="flex">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <button type="submit" className="ml-2 px-3 py-2 bg-primary text-white text-xs rounded-lg hover:bg-primary-dark transition">
                  Search
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50/80">
              {columns.map((col, i) => (
                <th key={i} className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">
                  {col.header}
                </th>
              ))}
              {actions && <th className="px-4 py-3 text-left font-semibold text-gray-600">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-12 text-center text-gray-400">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Loading...
                </div>
              </td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-12 text-center text-gray-400">
                No records found
              </td></tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr key={row.id || row.user_id || rowIdx} className="hover:bg-gray-50/50 transition">
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {col.render ? col.render(row) : row[col.key] ?? '-'}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => onPageChange(1)} disabled={page <= 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return (
                <button key={p} onClick={() => onPageChange(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition ${p === page ? 'bg-primary text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
