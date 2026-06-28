import { useEffect, useMemo, useState } from 'react';
import {

  Plus,
  Users,
  Trophy,
  Wallet,
  CalendarDays,
  CheckCircle2,
  Clock3,
  AlertCircle,
  CreditCard,
  Archive,
  FileText,
  X
} from 'lucide-react';

const API_BASE = (((window as any).__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:5000') as string).replace(/\/$/, '');

const API = `${API_BASE}/api`;

const money = (value: any) => `Rs ${Number(value || 0).toLocaleString()}`;
const dateOnly = (value: any) => value ? new Date(value).toLocaleDateString() : '-';

const emptyCommittee = {
  name: '',
  type: 'MONTHLY',
  startDate: '',
  endDate: '',
  totalParticipants: '',
  installmentAmount: '',
  drawDate: '',
  winnerSelectionMethod: 'MANUAL',
  notes: ''
};

const emptyParticipant = {
  name: '',
  phone: '',
  cnic: '',
  shopName: '',
  address: '',
  profilePicture: '',
  openingBalance: '0',
  notes: ''
};

export default function CommitteeScreen() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [committees, setCommittees] = useState<any[]>([]);
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<number | null>(null);
  const [committeeDetail, setCommitteeDetail] = useState<any>(null);
  const [selectedMonthId, setSelectedMonthId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [newCommittee, setNewCommittee] = useState<any>(emptyCommittee);

  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  const [newParticipant, setNewParticipant] = useState<any>(emptyParticipant);

  const [manualWinnerId, setManualWinnerId] = useState('');
  const [payoutDraft, setPayoutDraft] = useState<any>({ deductions: '0', paidAmount: '', paymentMethod: 'CASH', notes: '' });
  const tabs = ['Overview', 'Participants', 'Collections', 'Winner & Payout', 'Monthly History', 'Reports', 'Archives'];

  const calculatedPool = useMemo(() => {
    return (Number(newCommittee.totalParticipants) || 0) * (Number(newCommittee.installmentAmount) || 0);
  }, [newCommittee.totalParticipants, newCommittee.installmentAmount]);

  const fetchJson = async (url: string, options?: RequestInit) => {
    const res = await fetch(url, options);
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { error: text || 'Invalid server response' }; }
    if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
    return data;
  };

  const fetchCommittees = async () => {
    try {
      setError('');
      const data = await fetchJson(`${API}/committees`);
      setCommittees(Array.isArray(data) ? data : []);
      if (!selectedCommitteeId && Array.isArray(data) && data.length > 0) {
        setSelectedCommitteeId(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load committees');
    }
  };

  const fetchCommitteeDetail = async (id: number) => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchJson(`${API}/committees/${id}`);
      setCommitteeDetail(data);
      const firstPending = data.months?.find((m: any) => m.status === 'PENDING') || data.months?.[0];
      setSelectedMonthId((prev) => prev || firstPending?.id || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load committee details');
      setCommitteeDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCommittees(); }, []);
  useEffect(() => {
    if (selectedCommitteeId) fetchCommitteeDetail(selectedCommitteeId);
  }, [selectedCommitteeId]);

  const currentMonth = useMemo(() => {
    if (!committeeDetail?.months?.length) return null;
    return committeeDetail.months.find((m: any) => m.id === selectedMonthId) || committeeDetail.months.find((m: any) => m.status === 'PENDING') || committeeDetail.months[0];
  }, [committeeDetail, selectedMonthId]);

  const currentStats = useMemo(() => {
    const collections = currentMonth?.collections || [];
    const paidCount = collections.filter((c: any) => c.status === 'PAID').length;
    const partialCount = collections.filter((c: any) => c.status === 'PARTIAL').length;
    const pendingCount = Math.max((committeeDetail?.participants?.length || 0) - paidCount - partialCount, 0);
    const collected = collections.reduce((sum: number, c: any) => sum + Number(c.paidAmount || 0), 0);
    const pending = collections.reduce((sum: number, c: any) => sum + Number(c.remainingAmount || 0), 0);
    return { paidCount, partialCount, pendingCount, collected, pending };
  }, [currentMonth, committeeDetail]);

  const handleCreateCommittee = async () => {
    if (!newCommittee.name.trim()) return alert('Committee name is required');
    if (!newCommittee.startDate) return alert('Start date is required');
    if (Number(newCommittee.totalParticipants) <= 0) return alert('Total participants must be greater than 0');
    if (Number(newCommittee.installmentAmount) <= 0) return alert('Installment amount must be greater than 0');

    try {
      setLoading(true);
      const payload = { ...newCommittee };
      const created = await fetchJson(`${API}/committees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setIsCreating(false);
      setNewCommittee(emptyCommittee);
      await fetchCommittees();
      setSelectedCommitteeId(created.id);
      alert('Committee created successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to create committee');
    } finally {
      setLoading(false);
    }
  };

  const handleParticipantImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setNewParticipant({ ...newParticipant, profilePicture: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleAddParticipant = async () => {
    if (!selectedCommitteeId) return;
    if (!newParticipant.name.trim()) return alert('Participant name is required');
    try {
      await fetchJson(`${API}/committees/${selectedCommitteeId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newParticipant)
      });
      setNewParticipant(emptyParticipant);
      setIsAddingParticipant(false);
      fetchCommitteeDetail(selectedCommitteeId);
    } catch (err: any) {
      alert(err.message || 'Failed to add participant');
    }
  };

  const handleMarkPayment = async (collection: any) => {
    const defaultAmount = collection.installmentAmount?.toString() || '0';
    const amountStr = prompt(`Total paid for ${collection.participant?.name || 'participant'} this month`, defaultAmount);
    if (amountStr === null) return;
    try {
      await fetchJson(`${API}/committee-collections/${collection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidAmount: amountStr, paymentMethod: 'CASH' })
      });
      fetchCommitteeDetail(selectedCommitteeId!);
    } catch (err: any) {
      alert(err.message || 'Payment failed');
    }
  };

  const handleRandomDraw = async () => {
    if (!selectedCommitteeId || !currentMonth) return;
    if (!confirm(`Draw winner for ${currentMonth.monthName}?`)) return;
    try {
      await fetchJson(`${API}/committees/${selectedCommitteeId}/draw-winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthId: currentMonth.id })
      });
      fetchCommitteeDetail(selectedCommitteeId);
      alert('Winner selected successfully');
    } catch (err: any) {
      alert(err.message || 'Draw failed');
    }
  };

  const handleManualWinner = async () => {
    if (!selectedCommitteeId || !currentMonth) return;
    if (!manualWinnerId) return alert('Select participant first');
    try {
      await fetchJson(`${API}/committees/${selectedCommitteeId}/manual-winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthId: currentMonth.id, participantId: manualWinnerId, notes: 'Manual winner selection' })
      });
      setManualWinnerId('');
      fetchCommitteeDetail(selectedCommitteeId);
      alert('Manual winner saved');
    } catch (err: any) {
      alert(err.message || 'Manual winner failed');
    }
  };

  const handleUpdatePayout = async (payoutId: number) => {
    try {
      await fetchJson(`${API}/committee-payouts/${payoutId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payoutDraft)
      });
      setPayoutDraft({ deductions: '0', paidAmount: '', paymentMethod: 'CASH', notes: '' });
      fetchCommitteeDetail(selectedCommitteeId!);
      alert('Payout updated');
    } catch (err: any) {
      alert(err.message || 'Payout update failed');
    }
  };

  const StatCard = ({ title, value, subtitle, icon: Icon, tone = 'slate' }: any) => {
    const toneClass: any = {
      slate: 'bg-slate-50 text-slate-500',
      indigo: 'bg-indigo-50 text-indigo-500',
      emerald: 'bg-emerald-50 text-emerald-500',
      amber: 'bg-amber-50 text-amber-500',
      rose: 'bg-rose-50 text-rose-500',
      blue: 'bg-blue-50 text-blue-500'
    };
    return (
      <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm min-h-[105px] flex justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{title}</p>
          <h3 className="text-xl font-black text-slate-800 mt-2">{value}</h3>
          {subtitle && <p className="text-xs font-semibold text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toneClass[tone] || toneClass.slate}`}>
          <Icon size={18} />
        </div>
      </div>
    );
  };

  const StatusBadge = ({ status }: any) => {
    const cls = status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : status === 'PARTIAL' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200';
    return <span className={`px-2 py-1 rounded-full border text-[10px] font-black ${cls}`}>{status || 'PENDING'}</span>;
  };

  return (
    <div className="max-w-[1700px] mx-auto pb-10 h-full flex flex-col">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-black text-slate-800 font-heading">Committee / Besi Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">Track committees, participants, monthly collections, winners, payouts, and archives.</p>
        </div>
        <div className="flex gap-3 items-center">
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-700 outline-none min-w-[210px]"
            value={selectedCommitteeId || ''}
            onChange={e => setSelectedCommitteeId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Select committee</option>
            {committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setIsCreating(true)} className="bg-[#1e293b] hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
            <Plus size={16} /> New Committee
          </button>
        </div>
      </div>

      {error && <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm font-bold flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}

      {isCreating && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-black text-lg text-slate-800">Create New Committee</h3>
              <p className="text-xs text-slate-500 font-semibold">Committee create hote hi system monthly cycles auto-generate karega.</p>
            </div>
            <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-[11px] font-black uppercase text-slate-400">Committee Name *</label>
              <input type="text" placeholder="e.g. June Besi 2026" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 outline-none font-bold text-sm mt-1" value={newCommittee.name} onChange={e => setNewCommittee({ ...newCommittee, name: e.target.value })} />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase text-slate-400">Type</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2.5 outline-none font-bold text-sm mt-1" value={newCommittee.type} onChange={e => setNewCommittee({ ...newCommittee, type: e.target.value })}>
                <option value="MONTHLY">Monthly</option>
                <option value="WEEKLY">Weekly</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-black uppercase text-slate-400">Start Date *</label>
              <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 outline-none font-bold text-sm mt-1" value={newCommittee.startDate} onChange={e => setNewCommittee({ ...newCommittee, startDate: e.target.value })} />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase text-slate-400">Draw Day</label>
              <input type="number" placeholder="e.g. 10" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 outline-none font-bold text-sm mt-1" value={newCommittee.drawDate} onChange={e => setNewCommittee({ ...newCommittee, drawDate: e.target.value })} />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase text-slate-400">Total Participants *</label>
              <input type="number" placeholder="25" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 outline-none font-bold text-sm mt-1" value={newCommittee.totalParticipants} onChange={e => setNewCommittee({ ...newCommittee, totalParticipants: e.target.value })} />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase text-slate-400">Installment Amount *</label>
              <input type="number" placeholder="20000" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 outline-none font-bold text-sm mt-1" value={newCommittee.installmentAmount} onChange={e => setNewCommittee({ ...newCommittee, installmentAmount: e.target.value })} />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase text-slate-400">Winner Method</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2.5 outline-none font-bold text-sm mt-1" value={newCommittee.winnerSelectionMethod} onChange={e => setNewCommittee({ ...newCommittee, winnerSelectionMethod: e.target.value })}>
                <option value="MANUAL">Manual Selection</option>
                <option value="RANDOM">Random Draw</option>
              </select>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-[11px] font-black uppercase text-emerald-700">Total Pool</p>
              <h4 className="font-black text-xl text-emerald-700 mt-1">{money(calculatedPool)}</h4>
            </div>
          </div>

          <textarea placeholder="Notes / terms optional" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 outline-none font-bold text-sm mb-4" value={newCommittee.notes} onChange={e => setNewCommittee({ ...newCommittee, notes: e.target.value })} />

          <div className="flex justify-end gap-3">
            <button onClick={() => setIsCreating(false)} className="px-4 py-2 text-sm font-bold text-slate-500">Cancel</button>
            <button disabled={loading} onClick={handleCreateCommittee} className="bg-[var(--color-brand-accent)] disabled:opacity-60 text-white px-5 py-2 rounded-lg font-black text-sm">{loading ? 'Saving...' : 'Save Committee'}</button>
          </div>
        </div>
      )}

      <div className="flex border-b border-slate-200 mb-5 bg-white px-4 pt-2 rounded-t-xl overflow-x-auto shadow-sm">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-3 font-black text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? 'border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{tab}</button>
        ))}
      </div>

      {!committeeDetail ? (
        <div className="p-10 text-center text-slate-400 font-bold bg-white rounded-xl border border-dashed border-slate-300">Select or create a committee</div>
      ) : (
        <div className="bg-white rounded-b-xl border border-slate-200 p-5 shadow-sm min-h-[520px]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-5">
            <div>
              <h3 className="text-xl font-black text-slate-800">{committeeDetail.name} <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded ml-2">{committeeDetail.status}</span></h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">{dateOnly(committeeDetail.startDate)} to {dateOnly(committeeDetail.endDate)} • {committeeDetail.type} • {committeeDetail.winnerSelectionMethod}</p>
            </div>
            <select className="border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-700 outline-none" value={selectedMonthId || ''} onChange={e => setSelectedMonthId(Number(e.target.value))}>
              {committeeDetail.months?.map((m: any) => <option key={m.id} value={m.id}>{m.monthName}</option>)}
            </select>
          </div>

          {activeTab === 'Overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard title="Total Pool" value={money(committeeDetail.totalPool)} subtitle="Per cycle winner amount" icon={Trophy} tone="amber" />
                <StatCard title="Installment" value={money(committeeDetail.installmentAmount)} subtitle="Per participant" icon={Wallet} tone="emerald" />
                <StatCard title="Participants" value={`${committeeDetail.participants?.length || 0} / ${committeeDetail.totalParticipants}`} subtitle="Registered members" icon={Users} tone="blue" />
                <StatCard title="Current Month" value={currentMonth?.monthName || '-'} subtitle={currentMonth?.status || 'PENDING'} icon={CalendarDays} tone="indigo" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard title="Collected" value={money(currentStats.collected)} subtitle={`${currentStats.paidCount} paid, ${currentStats.partialCount} partial`} icon={CheckCircle2} tone="emerald" />
                <StatCard title="Pending Amount" value={money(currentStats.pending)} subtitle={`${currentStats.pendingCount} pending`} icon={Clock3} tone="rose" />
                <StatCard title="Winner" value={currentMonth?.winners?.[0]?.participant?.name || 'Not Drawn'} subtitle="Current selected month" icon={Trophy} tone="amber" />
                <StatCard title="Payout" value={currentMonth?.winners?.[0]?.payout?.status || 'Pending'} subtitle="Winner payment status" icon={CreditCard} tone="purple" />
              </div>
            </div>
          )}

          {activeTab === 'Participants' && (
            <div>
              <div className="flex flex-col md:flex-row justify-between gap-3 mb-4">
                <h3 className="font-black text-lg text-slate-800">Participants</h3>
                {committeeDetail.participants.length < committeeDetail.totalParticipants && <button onClick={() => setIsAddingParticipant(!isAddingParticipant)} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm">+ Add Participant</button>}
              </div>
              {isAddingParticipant && (
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl mb-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-end">
                  <div><label className="text-xs font-bold text-slate-500">Name *</label><input className="w-full border rounded-lg p-2 text-sm" value={newParticipant.name} onChange={e => setNewParticipant({ ...newParticipant, name: e.target.value })} /></div>
                  <div><label className="text-xs font-bold text-slate-500">Phone</label><input className="w-full border rounded-lg p-2 text-sm" value={newParticipant.phone} onChange={e => setNewParticipant({ ...newParticipant, phone: e.target.value })} /></div>
                  <div><label className="text-xs font-bold text-slate-500">Shop Name</label><input className="w-full border rounded-lg p-2 text-sm" value={newParticipant.shopName} onChange={e => setNewParticipant({ ...newParticipant, shopName: e.target.value })} /></div>
                  <div><label className="text-xs font-bold text-slate-500">CNIC</label><input className="w-full border rounded-lg p-2 text-sm" value={newParticipant.cnic} onChange={e => setNewParticipant({ ...newParticipant, cnic: e.target.value })} /></div>
                  <div className="xl:col-span-2"><label className="text-xs font-bold text-slate-500">Address</label><input className="w-full border rounded-lg p-2 text-sm" value={newParticipant.address} onChange={e => setNewParticipant({ ...newParticipant, address: e.target.value })} /></div>
                  <div><label className="text-xs font-bold text-slate-500">Profile Picture</label><input type="file" accept="image/*" className="w-full border rounded-lg p-1.5 text-sm bg-white" onChange={handleParticipantImageUpload} /></div>
                  <button onClick={handleAddParticipant} className="bg-[var(--color-brand-accent)] text-white px-4 py-2 rounded-lg font-black text-sm">Save Participant</button>
                </div>
              )}
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 font-black"><tr><th className="p-3">No</th><th className="p-3">Participant</th><th className="p-3">Phone</th><th className="p-3">Shop</th><th className="p-3">Status</th><th className="p-3">Winner</th></tr></thead>
                  <tbody>
                    {committeeDetail.participants?.map((p: any) => {
                      const won = committeeDetail.months?.some((m: any) => m.winners?.some((w: any) => w.participantId === p.id));
                      return <tr key={p.id} className="border-t border-slate-100"><td className="p-3 font-black">#{p.participantNo}</td><td className="p-3"><div className="font-black text-slate-800">{p.name}</div><div className="text-xs text-slate-500">{p.cnic || '-'}</div></td><td className="p-3 font-semibold">{p.phone || '-'}</td><td className="p-3 font-semibold">{p.shopName || '-'}</td><td className="p-3"><span className="bg-emerald-50 text-emerald-700 rounded-full px-2 py-1 text-[10px] font-black">{p.status}</span></td><td className="p-3 font-bold">{won ? 'Won' : 'Not yet'}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'Collections' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-lg text-slate-800">Collections — {currentMonth?.monthName}</h3>
                <div className="text-sm font-bold text-slate-500">Collected: <span className="text-emerald-600">{money(currentStats.collected)}</span> / Pending: <span className="text-rose-600">{money(currentStats.pending)}</span></div>
              </div>
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 font-black"><tr><th className="p-3">Participant</th><th className="p-3">Phone</th><th className="p-3">Installment</th><th className="p-3">Paid</th><th className="p-3">Remaining</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr></thead>
                  <tbody>
                    {(currentMonth?.collections || []).map((c: any) => <tr key={c.id} className="border-t border-slate-100"><td className="p-3 font-black text-slate-800">{c.participant?.name}</td><td className="p-3 font-semibold">{c.participant?.phone || '-'}</td><td className="p-3 font-bold">{money(c.installmentAmount)}</td><td className="p-3 text-emerald-600 font-black">{money(c.paidAmount)}</td><td className="p-3 text-rose-600 font-black">{money(c.remainingAmount)}</td><td className="p-3"><StatusBadge status={c.status} /></td><td className="p-3 text-right"><button onClick={() => handleMarkPayment(c)} className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-black">Update Payment</button></td></tr>)}
                    {(!currentMonth?.collections || currentMonth.collections.length === 0) && <tr><td colSpan={7} className="p-8 text-center text-slate-400 font-bold">Add participants first. Collection rows will auto-create.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'Winner & Payout' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="border border-slate-100 rounded-xl p-4">
                <h3 className="font-black text-lg text-slate-800 mb-3">Winner Selection — {currentMonth?.monthName}</h3>
                {currentMonth?.winners?.[0] ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs font-black uppercase text-amber-600">Winner</p>
                    <h4 className="text-2xl font-black text-slate-800 mt-1">{currentMonth.winners[0].participant?.name}</h4>
                    <p className="text-sm font-semibold text-slate-500 mt-1">Pool: {money(currentMonth.winners[0].totalPool)}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button onClick={handleRandomDraw} className="w-full bg-[var(--color-brand-accent)] text-white px-4 py-3 rounded-xl font-black flex justify-center gap-2"><Trophy size={18} /> Random Draw</button>
                    <div className="flex gap-2">
                      <select className="flex-1 border border-slate-200 rounded-lg px-3 py-2 font-bold" value={manualWinnerId} onChange={e => setManualWinnerId(e.target.value)}>
                        <option value="">Select manual winner</option>
                        {committeeDetail.participants?.map((p: any) => <option key={p.id} value={p.id}>{p.participantNo}. {p.name}</option>)}
                      </select>
                      <button onClick={handleManualWinner} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-black">Save</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="border border-slate-100 rounded-xl p-4">
                <h3 className="font-black text-lg text-slate-800 mb-3">Winner Payout</h3>
                {currentMonth?.winners?.[0]?.payout ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs font-black text-slate-400">Final Payable</p><h4 className="font-black text-lg">{money(currentMonth.winners[0].payout.finalPayable)}</h4></div>
                      <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs font-black text-slate-400">Paid</p><h4 className="font-black text-lg">{money(currentMonth.winners[0].payout.paidAmount)}</h4></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input className="border rounded-lg p-2 text-sm font-bold" placeholder="Deductions" value={payoutDraft.deductions} onChange={e => setPayoutDraft({ ...payoutDraft, deductions: e.target.value })} />
                      <input className="border rounded-lg p-2 text-sm font-bold" placeholder="Paid Amount" value={payoutDraft.paidAmount} onChange={e => setPayoutDraft({ ...payoutDraft, paidAmount: e.target.value })} />
                      <select className="border rounded-lg p-2 text-sm font-bold" value={payoutDraft.paymentMethod} onChange={e => setPayoutDraft({ ...payoutDraft, paymentMethod: e.target.value })}><option value="CASH">Cash</option><option value="BANK">Bank</option><option value="JAZZCASH">JazzCash</option><option value="EASYPAISA">EasyPaisa</option></select>
                      <input className="border rounded-lg p-2 text-sm font-bold" placeholder="Notes" value={payoutDraft.notes} onChange={e => setPayoutDraft({ ...payoutDraft, notes: e.target.value })} />
                    </div>
                    <button onClick={() => handleUpdatePayout(currentMonth.winners[0].payout.id)} className="w-full bg-slate-900 text-white px-4 py-2 rounded-lg font-black">Update Payout</button>
                  </div>
                ) : <div className="text-slate-400 font-bold text-center p-8 border border-dashed rounded-xl">Select winner first.</div>}
              </div>
            </div>
          )}

          {activeTab === 'Monthly History' && (
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase text-slate-400 font-black"><tr><th className="p-3">Month</th><th className="p-3">Collected</th><th className="p-3">Pending</th><th className="p-3">Winner</th><th className="p-3">Payout</th><th className="p-3">Status</th></tr></thead><tbody>{committeeDetail.months?.map((m: any) => { const collected = m.collections?.reduce((s: number, c: any) => s + Number(c.paidAmount || 0), 0) || 0; const pending = m.collections?.reduce((s: number, c: any) => s + Number(c.remainingAmount || 0), 0) || 0; return <tr key={m.id} className="border-t border-slate-100"><td className="p-3 font-black">{m.monthName}</td><td className="p-3 text-emerald-600 font-black">{money(collected)}</td><td className="p-3 text-rose-600 font-black">{money(pending)}</td><td className="p-3 font-bold">{m.winners?.[0]?.participant?.name || '-'}</td><td className="p-3"><StatusBadge status={m.winners?.[0]?.payout?.status || 'PENDING'} /></td><td className="p-3 font-bold">{m.status}</td></tr>; })}</tbody></table>
            </div>
          )}

          {activeTab === 'Reports' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard title="Total Possible Collection" value={money((committeeDetail.totalParticipants || 0) * (committeeDetail.installmentAmount || 0) * (committeeDetail.months?.length || 0))} subtitle="Full committee duration" icon={FileText} tone="indigo" />
              <StatCard title="Total Collected" value={money(committeeDetail.months?.reduce((s: number, m: any) => s + (m.collections?.reduce((x: number, c: any) => x + Number(c.paidAmount || 0), 0) || 0), 0))} subtitle="All months" icon={CheckCircle2} tone="emerald" />
              <StatCard title="Winners Done" value={committeeDetail.months?.filter((m: any) => m.winners?.length > 0).length || 0} subtitle="Drawn months" icon={Trophy} tone="amber" />
              <StatCard title="Remaining Winners" value={(committeeDetail.totalParticipants || 0) - (committeeDetail.months?.filter((m: any) => m.winners?.length > 0).length || 0)} subtitle="Not won yet" icon={Clock3} tone="rose" />
            </div>
          )}

          {activeTab === 'Archives' && (
            <div className="text-center p-10 border border-dashed border-slate-200 rounded-xl text-slate-400 font-bold">
              <Archive className="mx-auto mb-3" /> Completed/archived committees will appear here after status is changed to COMPLETED or ARCHIVED.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
