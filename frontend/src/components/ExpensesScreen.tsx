import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, ReceiptText, Trash2, Edit, X, Save, Eye, CalendarDays } from 'lucide-react';

const API_BASE = (((window as any).__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:5000') as string).replace(/\/$/, '');


const blank = { title: '', category: 'Daily', amount: '', expenseDate: new Date().toISOString().slice(0,10), paymentMethod: 'CASH', paidTo: '', phone: '', referenceNumber: '', notes: '', proofImage: '' };
const money = (n: any) => `Rs ${Number(n || 0).toLocaleString()}`;

export default function ExpensesScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ count: 0, total: 0 });
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0,10));
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(blank);

  const load = async () => {
    const res = await fetch(`${API_BASE}/api/expenses?search=${encodeURIComponent(search)}&startDate=${startDate}&endDate=${endDate}`);
    const data = await res.json();
    setRows(data.rows || []); setSummary(data.summary || {});
  };
  useEffect(() => { load(); }, [search, startDate, endDate]);

  const categories = useMemo(() => ['Daily','Freight','Mazdoori','Utility','Tea/Food','Fuel','Rent','Repair','Salary Advance','Other'], []);
  const openNew = () => { setEditing(null); setForm(blank); setOpen(true); };
  const openEdit = (r: any) => { setEditing(r); setForm({ ...blank, ...r, expenseDate: String(r.expenseDate || '').slice(0,10) }); setOpen(true); };
  const save = async () => {
    if (!form.title || !form.amount) return alert('Title aur amount required hai');
    const url = editing ? `${API_BASE}/api/expenses/${editing.id}` : `${API_BASE}/api/expenses`;
    const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    if (data.error) return alert(data.error);
    setOpen(false); setDetail(null); load();
  };
  const del = async (id: number) => {
    if (!confirm('Expense delete karna hai?')) return;
    await fetch(`${API_BASE}/api/expenses/${id}`, { method: 'DELETE' });
    setDetail(null); load();
  };

  return (
    <div className="max-w-[1600px] mx-auto pb-10">
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
        <div><h2 className="text-2xl font-black text-slate-900 font-heading">Expenses Management</h2><p className="text-sm font-semibold text-slate-500 mt-1">Daily costs, freight, mazdoori, utility, staff advance aur other expenses.</p></div>
        <button onClick={openNew} className="bg-slate-900 text-white px-5 py-3 rounded-xl font-black text-sm flex items-center gap-2 w-fit"><Plus size={17}/> Add Expense</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-2xl p-5 border shadow-sm"><p className="text-xs font-black text-slate-400 uppercase">Total Expenses</p><h3 className="text-2xl font-black text-rose-600 mt-2">{money(summary.total)}</h3></div>
        <div className="bg-white rounded-2xl p-5 border shadow-sm"><p className="text-xs font-black text-slate-400 uppercase">Records</p><h3 className="text-2xl font-black text-slate-900 mt-2">{summary.count || 0}</h3></div>
        <div className="bg-white rounded-2xl p-5 border shadow-sm"><p className="text-xs font-black text-slate-400 uppercase">Selected Range</p><h3 className="text-lg font-black text-slate-800 mt-2 flex gap-2 items-center"><CalendarDays size={18}/> {startDate} → {endDate}</h3></div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b flex flex-col lg:flex-row gap-3">
          <div className="flex-1 flex items-center border rounded-xl bg-white px-3"><Search size={16} className="text-slate-400 mr-2"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search title, category, paid to, reference..." className="w-full py-3 outline-none text-sm font-bold"/></div>
          <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="border rounded-xl px-3 py-2 text-sm font-bold" />
          <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="border rounded-xl px-3 py-2 text-sm font-bold" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]"><thead className="bg-slate-50 text-xs uppercase text-slate-400"><tr><th className="p-4 text-left">Date</th><th className="p-4 text-left">Expense</th><th className="p-4 text-left">Paid To</th><th className="p-4 text-left">Method</th><th className="p-4 text-right">Amount</th><th className="p-4 text-right">Action</th></tr></thead>
          <tbody className="divide-y">{rows.map(r => <tr key={r.id} onClick={()=>setDetail(r)} className="hover:bg-slate-50 cursor-pointer"><td className="p-4 font-bold">{new Date(r.expenseDate).toLocaleDateString()}</td><td className="p-4"><p className="font-black text-slate-900">{r.title}</p><p className="text-xs font-bold text-slate-400">{r.category}</p></td><td className="p-4 font-bold">{r.paidTo || '-'}</td><td className="p-4 font-bold">{r.paymentMethod}</td><td className="p-4 text-right font-black text-rose-600">{money(r.amount)}</td><td className="p-4 text-right"><button onClick={(e)=>{e.stopPropagation();setDetail(r)}} className="p-2 text-indigo-600"><Eye size={17}/></button><button onClick={(e)=>{e.stopPropagation();openEdit(r)}} className="p-2 text-amber-600"><Edit size={17}/></button><button onClick={(e)=>{e.stopPropagation();del(r.id)}} className="p-2 text-rose-600"><Trash2 size={17}/></button></td></tr>)}</tbody></table>
        </div>
      </div>
      {open && <div className="fixed inset-0 bg-slate-900/50 z-[999] flex items-center justify-center p-4"><div className="bg-white rounded-2xl max-w-3xl w-full p-5 shadow-2xl"><div className="flex justify-between mb-4"><h3 className="font-black text-xl">{editing ? 'Edit Expense' : 'Add New Expense'}</h3><button onClick={()=>setOpen(false)}><X/></button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Expense title *" className="border rounded-xl px-4 py-3 font-bold" />
        <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="border rounded-xl px-4 py-3 font-bold">{categories.map(c=><option key={c}>{c}</option>)}</select>
        <input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="Amount *" className="border rounded-xl px-4 py-3 font-bold" />
        <input type="date" value={form.expenseDate} onChange={e=>setForm({...form,expenseDate:e.target.value})} className="border rounded-xl px-4 py-3 font-bold" />
        <select value={form.paymentMethod} onChange={e=>setForm({...form,paymentMethod:e.target.value})} className="border rounded-xl px-4 py-3 font-bold"><option>CASH</option><option>BANK</option><option>JAZZCASH</option><option>EASYPAISA</option></select>
        <input value={form.paidTo} onChange={e=>setForm({...form,paidTo:e.target.value})} placeholder="Paid to / person / shop" className="border rounded-xl px-4 py-3 font-bold" />
        <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Phone optional" className="border rounded-xl px-4 py-3 font-bold" />
        <input value={form.referenceNumber} onChange={e=>setForm({...form,referenceNumber:e.target.value})} placeholder="Reference / bill no" className="border rounded-xl px-4 py-3 font-bold" />
        <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Full detail / notes" className="md:col-span-2 border rounded-xl px-4 py-3 font-bold min-h-[90px]" />
      </div><button onClick={save} className="mt-4 bg-emerald-600 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2"><Save size={17}/> Save Expense</button></div></div>}
      {detail && !open && <div className="fixed inset-0 bg-slate-900/50 z-[999] flex items-center justify-center p-4"><div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl"><div className="flex justify-between"><h3 className="font-black text-xl flex gap-2 items-center"><ReceiptText/> Expense Detail</h3><button onClick={()=>setDetail(null)}><X/></button></div><div className="mt-4 space-y-3 text-sm">{Object.entries(detail).map(([k,v]: any)=><div key={k} className="flex justify-between border-b pb-2 gap-4"><span className="font-black text-slate-400">{k}</span><span className="font-bold text-slate-800 text-right break-all">{String(v ?? '-')}</span></div>)}</div><div className="mt-5 flex gap-2"><button onClick={()=>openEdit(detail)} className="bg-amber-500 text-white rounded-xl px-4 py-2 font-black">Edit</button><button onClick={()=>del(detail.id)} className="bg-rose-600 text-white rounded-xl px-4 py-2 font-black">Delete</button></div></div></div>}
    </div>
  );
}
