import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus, Search, Trash2, X, Save, Printer, MessageCircle } from 'lucide-react';

const API_BASE = (((window as any).__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:5000') as string).replace(/\/$/, '');


const money = (n: any) => `Rs ${Number(n || 0).toLocaleString()}`;

export default function QuotationsScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState<any>({ supplierId: '', supplierName: '', supplierPhone: '', validUntil: '', notes: '', status: 'DRAFT' });
  const [items, setItems] = useState<any[]>([]);
  const [itemSearch, setItemSearch] = useState('');

  const load = async () => {
    const [qRes, sRes, iRes] = await Promise.all([
      fetch(`${API_BASE}/api/quotations`), fetch(`${API_BASE}/api/suppliers`), fetch(`${API_BASE}/api/inventory?category=All`)
    ]);
    setRows((await qRes.json()).rows || []); setSuppliers(await sRes.json()); setInventory(await iRes.json());
  };
  useEffect(() => { load(); }, []);
  const filteredInventory = useMemo(() => inventory.filter(i => !itemSearch || [i.variant,i.category,i.lotNumber,i.millName,i.notes].join(' ').toLowerCase().includes(itemSearch.toLowerCase())).slice(0, 12), [inventory, itemSearch]);
  const total = items.reduce((a, i) => a + Number(i.total || 0), 0);

  const newQuote = () => { setForm({ supplierId: '', supplierName: '', supplierPhone: '', validUntil: '', notes: '', status: 'DRAFT' }); setItems([]); setOpen(true); };
  const selectSupplier = (id: string) => {
    const s = suppliers.find(x => String(x.id) === String(id));
    setForm({ ...form, supplierId: id, supplierName: s?.name || '', supplierPhone: s?.phone || '' });
  };
  const addItem = (inv: any) => setItems([...items, { inventoryItemId: inv.id, itemName: inv.variant, category: inv.category, lotNumber: inv.lotNumber, millName: inv.millName, quality: inv.notes || '', unit: inv.unit || 'Kg', quantity: 1, expectedRate: inv.purchaseRate || 0, total: inv.purchaseRate || 0, notes: '' }]);
  const updateItem = (idx: number, key: string, value: any) => {
    const next = [...items]; next[idx][key] = value;
    if (key === 'quantity' || key === 'expectedRate') next[idx].total = Number(next[idx].quantity || 0) * Number(next[idx].expectedRate || 0);
    setItems(next);
  };
  const save = async () => {
    if (!form.supplierName) return alert('Supplier select karo');
    if (items.length === 0) return alert('At least one item add karo');
    const res = await fetch(`${API_BASE}/api/quotations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, items }) });
    const data = await res.json();
    if (data.error) return alert(data.error);
    setOpen(false); load();
  };
  const openDetail = async (id: number) => { const res = await fetch(`${API_BASE}/api/quotations/${id}`); setDetail(await res.json()); };
  const del = async (id: number) => { if (!confirm('Quotation delete karni hai?')) return; await fetch(`${API_BASE}/api/quotations/${id}`, { method: 'DELETE' }); setDetail(null); load(); };
  const shareWhatsApp = (q: any, its: any[]) => {
    const text = encodeURIComponent(`Quotation ${q.quotationId}\nSupplier: ${q.supplierName}\n${its.map(i=>`${i.itemName} - ${i.quantity} ${i.unit} @ Rs ${i.expectedRate}`).join('\n')}\nTotal: ${money(q.totalAmount)}\nNotes: ${q.notes || '-'}`);
    window.open(`https://wa.me/${String(q.supplierPhone||'').replace(/\D/g,'')}?text=${text}`, '_blank');
  };

  return <div className="max-w-[1600px] mx-auto pb-10">
    <div className="bg-white rounded-2xl p-5 border shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5"><div><h2 className="text-2xl font-black text-slate-900">Supplier Quotation Generator</h2><p className="text-sm text-slate-500 font-semibold mt-1">Supplier ko maal mangwane ke liye professional quotation/request banayein.</p></div><button onClick={newQuote} className="bg-slate-900 text-white px-5 py-3 rounded-xl font-black flex items-center gap-2 w-fit"><Plus size={17}/> New Quotation</button></div>
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">{rows.map(r=><div key={r.id} onClick={()=>openDetail(r.id)} className="bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md cursor-pointer"><div className="flex justify-between"><div><p className="text-xs font-black text-slate-400">{r.quotationId}</p><h3 className="font-black text-slate-900 mt-1">{r.supplierName}</h3><p className="text-xs font-bold text-slate-500">{r.supplierPhone || '-'}</p></div><ClipboardList className="text-emerald-500"/></div><p className="mt-5 text-2xl font-black text-emerald-600">{money(r.totalAmount)}</p><p className="text-xs font-bold text-slate-400 mt-1">{new Date(r.createdAt).toLocaleString()} • {r.status}</p></div>)}</div>
    {open && <div className="fixed inset-0 bg-slate-900/50 z-[999] p-4 overflow-y-auto"><div className="bg-white rounded-2xl max-w-6xl mx-auto p-5 shadow-2xl"><div className="flex justify-between mb-4"><h3 className="font-black text-xl">Create Quotation</h3><button onClick={()=>setOpen(false)}><X/></button></div><div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4"><select value={form.supplierId} onChange={e=>selectSupplier(e.target.value)} className="border rounded-xl px-4 py-3 font-bold"><option value="">Select Supplier</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name} - {s.phone}</option>)}</select><input value={form.supplierName} onChange={e=>setForm({...form,supplierName:e.target.value})} placeholder="Supplier name" className="border rounded-xl px-4 py-3 font-bold"/><input value={form.supplierPhone} onChange={e=>setForm({...form,supplierPhone:e.target.value})} placeholder="Supplier phone" className="border rounded-xl px-4 py-3 font-bold"/><input type="date" value={form.validUntil} onChange={e=>setForm({...form,validUntil:e.target.value})} className="border rounded-xl px-4 py-3 font-bold"/><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Quotation notes" className="md:col-span-2 border rounded-xl px-4 py-3 font-bold"/></div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><div className="bg-slate-50 rounded-2xl border p-4"><div className="flex items-center border rounded-xl bg-white px-3"><Search size={16} className="text-slate-400 mr-2"/><input value={itemSearch} onChange={e=>setItemSearch(e.target.value)} placeholder="Search inventory item..." className="w-full py-3 outline-none font-bold text-sm"/></div><div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto">{filteredInventory.map(inv=><button key={inv.id} onClick={()=>addItem(inv)} className="w-full text-left bg-white rounded-xl border p-3 hover:border-emerald-400"><p className="font-black text-slate-900">{inv.variant}</p><p className="text-xs font-bold text-slate-400">{inv.category} • {inv.lotNumber || '-'} • Stock {inv.quantity} {inv.unit}</p></button>)}</div></div><div className="lg:col-span-2 overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="p-3 text-left">Item</th><th>Qty</th><th>Unit</th><th>Expected Rate</th><th>Total</th><th>Notes</th><th></th></tr></thead><tbody className="divide-y">{items.map((i,idx)=><tr key={idx}><td className="p-3 font-black">{i.itemName}<p className="text-xs text-slate-400">{i.category} • {i.lotNumber}</p></td><td><input type="number" value={i.quantity} onChange={e=>updateItem(idx,'quantity',e.target.value)} className="border rounded-lg p-2 w-24 font-bold"/></td><td><input value={i.unit} onChange={e=>updateItem(idx,'unit',e.target.value)} className="border rounded-lg p-2 w-20 font-bold"/></td><td><input type="number" value={i.expectedRate} onChange={e=>updateItem(idx,'expectedRate',e.target.value)} className="border rounded-lg p-2 w-28 font-bold"/></td><td className="font-black text-emerald-600">{money(i.total)}</td><td><input value={i.notes} onChange={e=>updateItem(idx,'notes',e.target.value)} className="border rounded-lg p-2 w-44"/></td><td><button onClick={()=>setItems(items.filter((_,x)=>x!==idx))} className="text-rose-600"><Trash2 size={16}/></button></td></tr>)}</tbody></table><div className="mt-4 flex justify-between items-center bg-slate-900 text-white rounded-2xl p-4"><span className="font-black">Quotation Total</span><span className="text-2xl font-black text-emerald-300">{money(total)}</span></div></div></div><button onClick={save} className="mt-5 bg-emerald-600 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2"><Save size={17}/> Save Quotation</button></div></div>}
    {detail?.quotation && <div className="fixed inset-0 bg-slate-900/50 z-[999] flex items-center justify-center p-4"><div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl"><div className="flex justify-between"><h3 className="font-black text-xl">{detail.quotation.quotationId}</h3><button onClick={()=>setDetail(null)}><X/></button></div><p className="font-bold text-slate-500 mt-1">Supplier: {detail.quotation.supplierName} • {detail.quotation.supplierPhone}</p><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-100"><th className="p-3 text-left">Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead><tbody>{detail.items.map((i:any)=><tr key={i.id} className="border-b"><td className="p-3 font-bold">{i.itemName}<p className="text-xs text-slate-400">{i.notes}</p></td><td>{i.quantity} {i.unit}</td><td>{money(i.expectedRate)}</td><td className="font-black text-emerald-600">{money(i.total)}</td></tr>)}</tbody></table></div><div className="mt-4 flex justify-between bg-slate-900 text-white rounded-xl p-4"><span className="font-black">Total</span><span className="font-black text-emerald-300">{money(detail.quotation.totalAmount)}</span></div><div className="mt-5 flex flex-wrap gap-2"><button onClick={()=>window.print()} className="bg-slate-800 text-white rounded-xl px-4 py-2 font-black flex gap-2"><Printer size={16}/> Print</button><button onClick={()=>shareWhatsApp(detail.quotation, detail.items)} className="bg-emerald-600 text-white rounded-xl px-4 py-2 font-black flex gap-2"><MessageCircle size={16}/> WhatsApp</button><button onClick={()=>del(detail.quotation.id)} className="bg-rose-600 text-white rounded-xl px-4 py-2 font-black">Delete</button></div></div></div>}
  </div>;
}
