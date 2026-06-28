import { useEffect, useMemo, useState } from 'react';
import { Banknote, TrendingUp, ClipboardList, Wallet, AlertTriangle, Users, Boxes, CalendarDays, ShoppingCart, PackageOpen, ReceiptText, RefreshCw } from 'lucide-react';
import KPICard from './KPICard';

const API_BASE = (((window as any).__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:5000') as string).replace(/\/$/, '');


const money = (n: any) => `Rs ${Number(n || 0).toLocaleString()}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const minusDays = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); };
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

export default function Dashboard() {
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/detailed?startDate=${startDate}&endDate=${endDate}`);
      const json = await res.json();
      setData(json);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { load(); }, [startDate, endDate]);

  const c = data?.cards || {};
  const cards = useMemo(() => [
    { title: 'TODAY SALES', value: money(c.todaySales), subtitle: 'Aaj ki total sale', icon: ShoppingCart, iconColorClass: 'text-indigo-500', iconBgClass: 'bg-indigo-50' },
    { title: 'TODAY PROFIT', value: money(c.todayProfit), subtitle: 'Aaj ka estimated profit', icon: TrendingUp, iconColorClass: 'text-emerald-500', iconBgClass: 'bg-emerald-50' },
    { title: 'THIS WEEK SALES', value: money(c.weekSales), subtitle: 'Last 7 days', icon: CalendarDays, iconColorClass: 'text-blue-500', iconBgClass: 'bg-blue-50' },
    { title: 'MONTH SALES', value: money(c.monthSales), subtitle: 'Current month', icon: Banknote, iconColorClass: 'text-amber-500', iconBgClass: 'bg-amber-50' },
    { title: 'RANGE SALES', value: money(c.rangeSales), subtitle: 'Selected date range', icon: ClipboardList, iconColorClass: 'text-purple-500', iconBgClass: 'bg-purple-50', highlight: true },
    { title: 'RANGE PROFIT', value: money(c.rangeProfit), subtitle: 'Before expenses', icon: TrendingUp, iconColorClass: 'text-emerald-500', iconBgClass: 'bg-emerald-50' },
    { title: 'EXPENSES', value: money(c.expenses), subtitle: 'Business + salary expenses', icon: ReceiptText, iconColorClass: 'text-rose-500', iconBgClass: 'bg-rose-50' },
    { title: 'NET PROFIT', value: money(c.netProfit), subtitle: 'Profit minus expenses', icon: Wallet, iconColorClass: Number(c.netProfit || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500', iconBgClass: Number(c.netProfit || 0) >= 0 ? 'bg-emerald-50' : 'bg-rose-50' },
    { title: 'PURCHASES', value: money(c.rangePurchases), subtitle: 'Selected range purchases', icon: PackageOpen, iconColorClass: 'text-orange-500', iconBgClass: 'bg-orange-50' },
    { title: 'CASH RECEIVED', value: money(c.cashReceived), subtitle: 'Customer jama', icon: Banknote, iconColorClass: 'text-emerald-500', iconBgClass: 'bg-emerald-50' },
    { title: 'CASH PAID OUT', value: money(c.cashPaidOut), subtitle: 'Supplier payments', icon: Banknote, iconColorClass: 'text-rose-500', iconBgClass: 'bg-rose-50' },
    { title: 'CUSTOMER UDHAAR', value: money(c.receivable), subtitle: 'Account receivable', icon: Users, iconColorClass: 'text-rose-500', iconBgClass: 'bg-rose-50' },
    { title: 'SUPPLIER PAYABLE', value: money(c.payable), subtitle: 'Supplier ko dena hai', icon: Users, iconColorClass: 'text-orange-500', iconBgClass: 'bg-orange-50' },
    { title: 'NET KHATA', value: money(c.netKhata), subtitle: 'Receivable - payable', icon: ClipboardList, iconColorClass: 'text-slate-700', iconBgClass: 'bg-slate-100' },
    { title: 'INVENTORY VALUE', value: money(c.inventoryValue), subtitle: 'Purchase cost valuation', icon: Boxes, iconColorClass: 'text-indigo-500', iconBgClass: 'bg-indigo-50' },
    { title: 'POTENTIAL PROFIT', value: money(c.potentialProfit), subtitle: 'Unsold stock potential', icon: TrendingUp, iconColorClass: 'text-emerald-500', iconBgClass: 'bg-emerald-50' },
    { title: 'TOTAL STOCK KG', value: Number(c.totalStockKg || 0).toLocaleString(), subtitle: 'KG based stock', icon: Boxes, iconColorClass: 'text-blue-500', iconBgClass: 'bg-blue-50' },
    { title: 'LOW STOCK', value: String(c.lowStockCount || 0), subtitle: 'Reorder required', icon: AlertTriangle, iconColorClass: 'text-amber-500', iconBgClass: 'bg-amber-50' },
    { title: 'OUT OF STOCK', value: String(c.outStockCount || 0), subtitle: 'Immediate action', icon: AlertTriangle, iconColorClass: 'text-rose-500', iconBgClass: 'bg-rose-50' },
    { title: 'ACTIVE COMMITTEES', value: String(c.activeCommittees || 0), subtitle: 'Besi/BC groups', icon: Users, iconColorClass: 'text-purple-500', iconBgClass: 'bg-purple-50' },
  ], [c]);

  const setPreset = (type: string) => {
    if (type === 'today') { setStartDate(todayISO()); setEndDate(todayISO()); }
    if (type === 'yesterday') { const d = minusDays(1); setStartDate(d); setEndDate(d); }
    if (type === 'week') { setStartDate(minusDays(6)); setEndDate(todayISO()); }
    if (type === 'month') { setStartDate(monthStart()); setEndDate(todayISO()); }
  };

  const listBox = (title: string, rows: any[], fields: string[]) => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-slate-50 flex items-center justify-between"><h3 className="font-black text-slate-800">{title}</h3><span className="text-xs font-bold text-slate-400">{rows?.length || 0} records</span></div>
      <div className="divide-y max-h-[320px] overflow-y-auto custom-scrollbar">
        {(rows || []).length === 0 ? <div className="p-6 text-center text-slate-400 font-bold">No records</div> : rows.map((r: any, i: number) => (
          <div key={i} className="p-4 hover:bg-slate-50">
            {fields.map(f => <div key={f} className="flex justify-between gap-4 text-sm"><span className="font-bold text-slate-400 capitalize">{f.replace(/([A-Z])/g, ' $1')}</span><span className="font-black text-slate-700 text-right truncate max-w-[220px]">{typeof r[f] === 'number' ? r[f].toLocaleString() : String(r[f] ?? '-')}</span></div>)}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-[1800px] mx-auto pb-10">
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 font-heading">Business Dashboard</h2>
          <p className="text-sm text-slate-500 font-semibold mt-1">Daily useful summary + custom date range reports in one clean view.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {['today','yesterday','week','month'].map(p => <button key={p} onClick={() => setPreset(p)} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-black uppercase text-slate-700">{p}</button>)}
          <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="border rounded-xl px-3 py-2 text-sm font-bold" />
          <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="border rounded-xl px-3 py-2 text-sm font-bold" />
          <button onClick={load} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-black flex items-center gap-2"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {cards.map((card: any) => <KPICard key={card.title} {...card} />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-6">
        {listBox('Top Receivable Customers', data?.lists?.topCustomers || [], ['name','phone','shopName','outstanding'])}
        {listBox('Top Payable Suppliers', data?.lists?.topSuppliers || [], ['name','phone','shopName','outstanding'])}
        {listBox('Low Stock Alerts', data?.lists?.lowStockItems || [], ['variant','category','quantity','reorderLevel'])}
        {listBox('Recent Sales', data?.lists?.recentSales || [], ['invoiceId','amount'])}
        {listBox('Recent Purchases', data?.lists?.recentPurchases || [], ['purchaseId','totalAmount','balanceDue'])}
        {listBox('Recent Expenses', data?.lists?.recentExpenses || [], ['title','category','amount','paidTo'])}
      </div>
    </div>
  );
}
