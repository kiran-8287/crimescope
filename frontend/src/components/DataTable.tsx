import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, Search } from 'lucide-react';
import { Empty } from './UI';

type Row = { id?: string | number; [key: string]: unknown };
export type Column = { key: string; label: string; render?: (row: Row) => ReactNode; wrap?: boolean };

// When provided, the table renders the already-sliced server page directly and
// delegates paging to the caller instead of client-slicing `rows`.
export type ServerPagination = {
  page: number; // zero-based index of the current server page
  pageSize: number;
  total: number; // total matching rows across all pages (from response metadata)
  onPageChange: (page: number) => void;
  unitLabel?: string;
};

export function DataTable({
  rows,
  columns,
  searchable = true,
  server,
}: {
  rows: Row[];
  columns: Column[];
  searchable?: boolean;
  server?: ServerPagination;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('');
  const [asc, setAsc] = useState(true);
  const [page, setPage] = useState(0);

  const isServer = Boolean(server);

  // In server mode the caller supplies the visible page; only client-paginated
  // tables filter/sort locally across the full row set.
  const filtered = isServer
    ? rows
    : rows
        .filter(r => Object.values(r).join(' ').toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => {
          if (!sort) return 0;
          const av = a[sort], bv = b[sort];
          if (av === null || av === undefined) return 1;
          if (bv === null || bv === undefined) return -1;
          return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))) * (asc ? 1 : -1);
        });

  const pageSize = server?.pageSize ?? 6;
  const totalRows = isServer ? server!.total : filtered.length;
  const pages = Math.max(1, Math.ceil(totalRows / pageSize));
  const requestedPage = isServer ? server!.page : page;
  const current = Math.min(Math.max(0, requestedPage), pages - 1);

  useEffect(() => {
    if (!isServer) setPage(0);
  }, [query, sort, rows.length, isServer]);

  const visible = isServer ? filtered : filtered.slice(current * pageSize, current * pageSize + pageSize);

  const goTo = (target: number) => {
    const clamped = Math.max(0, Math.min(target, pages - 1));
    if (isServer) server!.onPageChange(clamped);
    else setPage(clamped);
  };

  const rangeStart = totalRows ? current * pageSize + 1 : 0;
  const rangeEnd = totalRows ? Math.min(current * pageSize + pageSize, totalRows) : 0;
  const unit = server?.unitLabel ?? 'records';

  return (
    <>
      {searchable && !isServer && (
        <div className="table-tools">
          <label className="search">
            <Search size={15} />
            <input aria-label="Search table" placeholder="Search records…" value={query} onChange={e => setQuery(e.target.value)} />
          </label>
          <span>{filtered.length} records</span>
        </div>
      )}
      {isServer && totalRows > 0 && (
        <div className="table-tools">
          <span>Server-paginated table — search and ordering are applied by the analysis endpoint across all {totalRows} {unit}.</span>
        </div>
      )}
      {visible.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {columns.map(c => (
                  <th
                    key={c.key}
                    className={c.wrap ? 'cell-wrap-head' : undefined}
                    aria-sort={!isServer && sort === c.key ? (asc ? 'ascending' : 'descending') : 'none'}
                  >
                    {isServer ? (
                      c.label
                    ) : (
                      <button onClick={() => { setSort(c.key); setAsc(sort === c.key ? !asc : true); }}>
                        {c.label}
                        <ArrowUpDown size={12} />
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r, idx) => (
                <tr key={r.id ? String(r.id) : `row-${current * pageSize + idx}`}>
                  {columns.map(c => (
                    <td key={c.key} className={c.wrap ? 'cell-wrap' : undefined}>{c.render ? c.render(r) : String(r[c.key] ?? 'Unavailable')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty />
      )}
      <div className="pagination">
        <span>
          {isServer
            ? `Showing ${rangeStart}–${rangeEnd} of ${totalRows} ${unit} · Page ${current + 1} of ${pages}`
            : `Page ${current + 1} of ${pages}`}
        </span>
        {isServer && (
          <button aria-label="First page" disabled={current === 0} onClick={() => goTo(0)}>
            <ChevronsLeft size={16} />
          </button>
        )}
        <button aria-label="Previous page" disabled={current === 0} onClick={() => goTo(current - 1)}>
          <ChevronLeft size={16} />
        </button>
        <button aria-label="Next page" disabled={current === pages - 1} onClick={() => goTo(current + 1)}>
          <ChevronRight size={16} />
        </button>
        {isServer && (
          <button aria-label="Last page" disabled={current === pages - 1} onClick={() => goTo(pages - 1)}>
            <ChevronsRight size={16} />
          </button>
        )}
      </div>
    </>
  );
}
