import { useEffect, useMemo, useState } from 'react';
import { BarChart3, FileText, RefreshCw, Search, Table2 } from 'lucide-react';

const API_BASE = (((window as any).__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:5000') as string).replace(/\/$/, '');


const formatCell = (value: any) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string' && value.includes('T') && !Number.isNaN(Date.parse(value))) return new Date(value).toLocaleString();
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(value);
};

const formatSummary = (item: any) => {
  const value = Number(item.value || 0);
  if (item.type === 'money') return `Rs ${Math.round(value).toLocaleString()}`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

export default function ReportsScreen() {
  const [catalog, setCatalog] = useState<any>({ totalReports: 0, categories: {}, reports: [] });
  const [selected, setSelected] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const loadCatalog = async () => {
    const res = await fetch(`${API_BASE}/api/reports/catalog`);
    const data = await res.json();
    setCatalog(data);
    if (!selected && data.reports?.length) runReport(data.reports[0]);
  };

  const runReport = async (report: any) => {
    setSelected(report);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/reports/run/${report.key}`);
      const data = await res.json();
      setReportData(data);
    } catch (err) {
      console.error('Report failed', err);
      setReportData({ error: 'Report failed to load' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCatalog(); }, []);

  const filteredReports = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return catalog.reports || [];
    return (catalog.reports || []).filter((r: any) =>
      r.title.toLowerCase().includes(q) || r.category.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    );
  }, [catalog, search]);

  const columns = reportData?.rows?.length ? Object.keys(reportData.rows[0]).slice(0, 12) : [];

  return (
    <div className="max-w-[1700px] mx-auto pb-10 h-full flex flex-col">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-slate-900 font-heading">Reports Center</h2>
          <p className="text-sm text-slate-500 mt-1">{catalog.totalReports || 0}+ useful reports for sales, purchases, inventory, khata, payments, profit and committee.</p>
        </div>
        <button onClick={() => selected && runReport(selected)} className="bg-[#0f172a] hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 w-fit">
          <RefreshCw size={16} /> Refresh Current Report
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[390px_1fr] gap-5 min-h-0 flex-1">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-emerald-500">
              <Search size={16} className="text-slate-400 mr-2" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search 80+ reports..." className="w-full outline-none text-sm bg-transparent font-medium" />
            </div>
          </div>
          <div className="overflow-y-auto custom-scrollbar p-3 space-y-2">
            {filteredReports.map((report: any) => (
              <button key={report.key} onClick={() => runReport(report)} className={`w-full text-left rounded-xl p-3 border transition-all ${selected?.key === report.key ? 'border-emerald-400 bg-emerald-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"><FileText size={16} /></div>
                  <div>
                    <p className="text-sm font-black text-slate-800">{report.title}</p>
                    <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">{report.category}</p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{report.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4 bg-white">
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2"><BarChart3 size={20} /> {selected?.title || 'Select a report'}</h3>
              <p className="text-sm text-slate-500 mt-1">{selected?.description}</p>
            </div>
            <div className="text-right text-xs text-slate-400 font-semibold shrink-0">Rows: {reportData?.rows?.length || 0}</div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-slate-400 font-bold">Loading report...</div>
          ) : reportData?.error ? (
            <div className="p-10 text-center text-red-500 font-bold">{reportData.error}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 p-5 bg-slate-50 border-b border-slate-100">
                {(reportData?.summary || []).map((s: any, idx: number) => (
                  <div key={idx} className="bg-white rounded-xl border border-slate-100 p-4">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">{s.label}</p>
                    <p className="text-lg font-black text-slate-900 mt-1">{formatSummary(s)}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-auto custom-scrollbar flex-1 p-5">
                {!reportData?.rows?.length ? (
                  <div className="border border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-400 font-semibold">
                    <Table2 className="mx-auto mb-3" /> No records found for this report.
                  </div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-slate-500 uppercase text-[11px] tracking-wider">
                        {columns.map(col => <th key={col} className="text-left px-4 py-3 font-black whitespace-nowrap">{col.replace(/([A-Z])/g, ' $1')}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.rows.slice(0, 300).map((row: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          {columns.map(col => <td key={col} className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{formatCell(row[col])}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
