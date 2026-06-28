import { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, Upload, Phone, MapPin, ReceiptText, X, CreditCard, FileText, BarChart3, Users, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import KPICard from './KPICard';

const API_BASE = (((window as any).__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:5000') as string).replace(/\/$/, '');


export default function KhataCenterScreen() {
  const tabs = ['Reports', 'All Parties', 'Customers Receivable', 'Suppliers Payable'];
  const [activeTab, setActiveTab] = useState('All Parties');
  
  const [parties, setParties] = useState<any[]>([]);
  const [reportsData, setReportsData] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '', type: 'BUYER', phone: '', shopName: '', cnic: '', ntn: '', city: '', address: '', creditLimit: '0', openingBalance: '0'
  });
  
  const [paymentData, setPaymentData] = useState({
    type: 'PAYMENT_IN', amount: '', paymentMethod: 'CASH', referenceNumber: '', description: '', date: new Date().toISOString().split('T')[0]
  });

  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchParties = async (search = '') => {
    try {
      let url = `${API_BASE}/api/parties`;
      if (search) url += `?search=${search}`;
      const res = await fetch(url);
      setParties(await res.json());
    } catch (err) {
      console.error("Failed to fetch parties", err);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reports/khata`);
      setReportsData(await res.json());
    } catch (err) {
      console.error("Failed to fetch reports", err);
    }
  };

  const fetchLedger = async (partyId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/parties/${partyId}/ledger`);
      const data = await res.json();
      setSelectedParty(data.party);
      setLedger(data.ledger);
    } catch (err) {
      console.error("Failed to fetch ledger", err);
    }
  };

  useEffect(() => {
    fetchParties();
    fetchReports();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      fetchParties(val);
    }, 400);
  };

  const openDrawer = () => {
    setFormData({ name: '', type: 'BUYER', phone: '', shopName: '', cnic: '', ntn: '', city: '', address: '', creditLimit: '0', openingBalance: '0' });
    setIsDrawerOpen(true);
  };

  const handleSaveParty = async () => {
    try {
      await fetch(`${API_BASE}/api/parties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setIsDrawerOpen(false);
      fetchParties(searchTerm);
      fetchReports();
    } catch (err) {
      console.error("Failed to save party", err);
    }
  };

  const handleSavePayment = async () => {
    if (!selectedParty) return;
    try {
      await fetch(`${API_BASE}/api/parties/${selectedParty.id}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });
      setIsPaymentModalOpen(false);
      fetchLedger(selectedParty.id);
      fetchParties(searchTerm);
      fetchReports();
    } catch (err) {
      console.error("Failed to save payment", err);
    }
  };

  const handleDeleteParty = async () => {
    if (!selectedParty) return;
    if(!confirm('Are you sure? A party can only be deleted if they have zero transactions.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/parties/${selectedParty.id}`, { method: 'DELETE' });
      if(!res.ok) {
        const error = await res.json();
        alert(error.error);
        return;
      }
      setSelectedParty(null);
      setLedger([]);
      fetchParties(searchTerm);
      fetchReports();
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  // Filter parties based on tab
  const getFilteredParties = () => {
    if (activeTab === 'Customers Receivable') {
      return parties.filter(p => (p.type === 'BUYER' || p.type === 'BOTH') && p.outstanding > 0);
    }
    if (activeTab === 'Suppliers Payable') {
      return parties.filter(p => (p.type === 'SELLER' || p.type === 'BOTH') && p.outstanding < 0);
    }
    // All Parties
    return parties;
  };

  return (
    <div className="max-w-[1600px] mx-auto pb-10 relative h-full flex flex-col">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between mb-6 shrink-0 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-heading">Business Accounts Center</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage customer receivables, supplier payables, and unified accounts in one smart section</p>
        </div>
        <button 
          onClick={openDrawer}
          className="bg-[#1e293b] hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors shadow-md"
        >
          <UserPlus size={16} /> Register Party
        </button>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto mb-6 shrink-0 gap-2 border-b border-slate-200">
        {tabs.map((tab, i) => (
          <button 
            key={i}
            onClick={() => { setActiveTab(tab); setSelectedParty(null); }}
            className={`px-5 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${activeTab === tab ? 'text-[var(--color-brand-accent)] border-[var(--color-brand-accent)]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-transparent'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Reports' ? (
        <div className="flex-1 overflow-y-auto">
          {reportsData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KPICard 
                  title="Total Receivable (Customers)" 
                  value={`Rs ${reportsData.totalReceivable.toLocaleString()}`}
                  icon={ArrowDownRight} 
                  iconColorClass="text-emerald-500" 
                  iconBgClass="bg-emerald-50" 
                />
                <KPICard 
                  title="Total Payable (Suppliers)" 
                  value={`Rs ${reportsData.totalPayable.toLocaleString()}`}
                  icon={ArrowUpRight} 
                  iconColorClass="text-rose-500" 
                  iconBgClass="bg-rose-50" 
                />
                <KPICard 
                  title="Net Business Balance" 
                  value={`Rs ${Math.abs(reportsData.netBusinessBalance).toLocaleString()}`}
                  subtitle={reportsData.netBusinessBalance > 0 ? 'Surplus' : 'Deficit'}
                  icon={BarChart3} 
                  iconColorClass="text-indigo-500" 
                  iconBgClass="bg-indigo-50" 
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Customers */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Users size={16} className="text-emerald-500" /> Top Customers by Receivable
                  </h3>
                  <div className="space-y-3">
                    {reportsData.topCustomers.length === 0 ? <p className="text-sm text-slate-500">No receivable data found.</p> : reportsData.topCustomers.map((c: any) => (
                      <div key={c.id} className="flex justify-between items-center p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => { setActiveTab('Customers Receivable'); fetchLedger(c.id); }}>
                        <div>
                          <p className="font-bold text-slate-700">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.phone || c.shopName || 'Customer'}</p>
                        </div>
                        <div className="text-emerald-600 font-black">Rs {c.outstanding.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Suppliers */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Users size={16} className="text-rose-500" /> Top Suppliers by Payable
                  </h3>
                  <div className="space-y-3">
                    {reportsData.topSuppliers.length === 0 ? <p className="text-sm text-slate-500">No payable data found.</p> : reportsData.topSuppliers.map((s: any) => (
                      <div key={s.id} className="flex justify-between items-center p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => { setActiveTab('Suppliers Payable'); fetchLedger(s.id); }}>
                        <div>
                          <p className="font-bold text-slate-700">{s.name}</p>
                          <p className="text-xs text-slate-500">{s.phone || s.shopName || 'Supplier'}</p>
                        </div>
                        <div className="text-rose-600 font-black">Rs {Math.abs(s.outstanding).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
             <div className="flex justify-center items-center h-full"><p className="text-slate-500">Loading reports...</p></div>
          )}
        </div>
      ) : (
        <div className="flex gap-6 flex-1 overflow-hidden">
          {/* Left Side: Contact List */}
          <div className="w-1/3 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2.5 bg-white shadow-sm focus-within:border-[var(--color-brand-accent)] focus-within:ring-1 focus-within:ring-[var(--color-brand-accent)] transition-all">
                <Search size={16} className="text-slate-400 mr-2" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Instant search by name or shop..." 
                  className="bg-transparent outline-none w-full text-sm font-medium text-slate-700" 
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
              {getFilteredParties().length === 0 ? (
                <div className="p-10 text-center text-slate-400 font-medium">No parties found.</div>
              ) : (
                getFilteredParties().map(party => (
                  <div 
                    key={party.id} 
                    onClick={() => fetchLedger(party.id)}
                    className={`p-4 cursor-pointer flex items-center justify-between transition-colors ${selectedParty?.id === party.id ? 'bg-emerald-50 border-l-4 border-l-[var(--color-brand-accent)]' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border shadow-sm ${selectedParty?.id === party.id ? 'bg-[var(--color-brand-accent)] text-white border-[var(--color-brand-accent-hover)]' : 'bg-white text-slate-500 border-slate-200'}`}>
                        {party.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className={`font-bold text-sm ${selectedParty?.id === party.id ? 'text-[var(--color-brand-primary)]' : 'text-slate-800'}`}>{party.name}</h4>
                        <p className="text-[11px] text-slate-500 font-medium">{party.shopName || party.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-black text-sm ${party.outstanding > 0 ? 'text-emerald-500' : party.outstanding < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                        Rs {Math.abs(party.outstanding).toLocaleString()}
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{party.outstanding > 0 ? 'Receivable' : party.outstanding < 0 ? 'Payable' : 'Cleared'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Side: Detail & Ledger */}
          <div className="w-2/3 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden">
            {selectedParty ? (
              <>
                {/* Profile Header */}
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-start justify-between shrink-0">
                  <div className="flex items-start gap-5">
                     <div className="w-16 h-16 rounded-full bg-white border-2 border-slate-200 shadow-sm flex items-center justify-center text-slate-400 font-black text-xl">
                       {selectedParty.name.substring(0, 2).toUpperCase()}
                     </div>
                     <div>
                       <div className="flex items-center gap-3 mb-1">
                         <h2 className="text-2xl font-black text-slate-800 font-heading">{selectedParty.name}</h2>
                         <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{selectedParty.type}</span>
                       </div>
                       <h3 className="text-sm font-bold text-slate-500 mb-3">{selectedParty.shopName}</h3>
                       
                       <div className="flex items-center gap-6 text-xs text-slate-500 font-medium bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm inline-flex">
                         <span className="flex items-center gap-1.5"><Phone size={14} className="text-slate-400" /> {selectedParty.phone || 'N/A'}</span>
                         <span className="flex items-center gap-1.5"><FileText size={14} className="text-slate-400" /> NTN: {selectedParty.ntn || 'N/A'}</span>
                         <span className="flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" /> {selectedParty.city || 'N/A'}</span>
                       </div>
                     </div>
                  </div>
                  <div className="flex items-center gap-4">
                     <div className="text-right bg-white border border-slate-200 shadow-sm px-5 py-2.5 rounded-xl">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Net Balance</p>
                       <p className={`text-2xl font-black ${selectedParty.outstanding > 0 ? 'text-emerald-500' : selectedParty.outstanding < 0 ? 'text-rose-500' : 'text-slate-800'}`}>
                         Rs {Math.abs(selectedParty.outstanding).toLocaleString()}
                       </p>
                       <p className="text-[10px] font-bold mt-0.5 text-slate-500">
                         {selectedParty.outstanding > 0 ? '(Receivable / Udhar)' : (selectedParty.outstanding < 0 ? '(Payable / Advance)' : 'Cleared')}
                       </p>
                     </div>
                     <div className="flex flex-col items-end gap-2">
                       <div className="flex items-center gap-2">
                         {selectedParty.outstanding > 0 && (
                           <button 
                             onClick={() => {
                                const phone = selectedParty.phone;
                                if (!phone) return alert("Party has no phone number.");
                                let fPhone = phone.replace(/[^0-9]/g, '');
                                if (fPhone.startsWith('0')) fPhone = '92' + fPhone.slice(1);
                                const msg = `Dear ${selectedParty.name},\n\nThis is a gentle reminder that your current outstanding Khata balance is *Rs ${selectedParty.outstanding.toLocaleString()}*.\nKindly arrange the payment at your earliest convenience.\n\nThank you,\n*IQBAL JUTT TRADER*`;
                                window.open(`https://wa.me/${fPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                             }}
                             className="px-4 py-2.5 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl text-sm font-bold transition-colors shadow-md flex items-center gap-2"
                           >
                             WhatsApp Reminder
                           </button>
                         )}
                         <button 
                           onClick={() => {
                              setPaymentData({ ...paymentData, type: selectedParty.outstanding >= 0 ? 'PAYMENT_IN' : 'PAYMENT_OUT' });
                              setIsPaymentModalOpen(true);
                           }}
                           className="px-5 py-2.5 bg-[var(--color-brand-accent)] hover:bg-[var(--color-brand-accent-hover)] text-white rounded-xl text-sm font-bold transition-colors shadow-md flex items-center gap-2"
                         >
                           <CreditCard size={16} /> Add Payment
                         </button>
                       </div>
                       <button onClick={handleDeleteParty} className="text-xs font-bold text-rose-500 hover:underline">Delete Party</button>
                     </div>
                  </div>
                </div>

                {/* Data Table */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px] sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4 w-1/3">Detail & Ref</th>
                        <th className="px-6 py-4 text-emerald-500">Amount (+)</th>
                        <th className="px-6 py-4 text-rose-500">Amount (-)</th>
                        <th className="px-6 py-4 text-slate-800">Balance</th>
                        <th className="px-6 py-4 text-center">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledger.length === 0 ? (
                        <tr><td colSpan={6} className="text-center p-10 text-slate-400 font-medium">No transactions recorded yet.</td></tr>
                      ) : (
                        ledger.map((tx, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-slate-500 font-medium text-xs whitespace-nowrap">
                              {new Date(tx.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-700">{tx.description}</div>
                              {(tx.paymentMethod || tx.referenceNumber) && (
                                <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase flex gap-2">
                                  {tx.paymentMethod && <span className="bg-slate-100 px-1 rounded">{tx.paymentMethod}</span>}
                                  {tx.referenceNumber && <span>Ref: {tx.referenceNumber}</span>}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 font-bold text-emerald-500">{tx.dr > 0 ? `Rs ${tx.dr.toLocaleString()}` : '-'}</td>
                            <td className="px-6 py-4 font-bold text-rose-500">{tx.cr > 0 ? `Rs ${tx.cr.toLocaleString()}` : '-'}</td>
                            <td className="px-6 py-4 font-black text-slate-800 bg-slate-50/50">Rs {tx.runningBalance.toLocaleString()}</td>
                            <td className="px-6 py-4 text-center">
                              {(tx.type === 'PURCHASE' || tx.type === 'SALE') ? (
                                <ReceiptText size={16} className="text-slate-300 mx-auto" />
                              ) : (
                                <button className="text-blue-500 hover:text-blue-700 mx-auto block" title="View Receipt Image">
                                  <Upload size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-10 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <ReceiptText size={32} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-600 mb-2">No Party Selected</h3>
                <p className="text-sm">Select a party from the left pane to view their deep ledger profile and chronological transaction history.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Register Party Drawer */}
      {isDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40" onClick={() => setIsDrawerOpen(false)}></div>
          <div className="fixed top-0 right-0 h-full w-[500px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out border-l border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <UserPlus className="text-[var(--color-brand-accent)]" /> Register New Party
              </h2>
              <button onClick={() => setIsDrawerOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 custom-scrollbar space-y-6">
               <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Basic Info</h3>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="col-span-2">
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">Owner Name *</label>
                     <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-accent)] font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                   </div>
                   <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">Shop / Company Name</label>
                     <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-accent)]" value={formData.shopName} onChange={e => setFormData({...formData, shopName: e.target.value})} />
                   </div>
                   <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">Party Type</label>
                     <select className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-accent)] font-bold" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                       <option value="BUYER">Buyer (Customer)</option>
                       <option value="SELLER">Seller (Supplier)</option>
                       <option value="BOTH">Both</option>
                     </select>
                   </div>
                   <div className="col-span-2">
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">Phone Number</label>
                     <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-accent)]" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                   </div>
                 </div>
               </div>

               <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Legal & Tax</h3>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">CNIC Number</label>
                     <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-accent)]" value={formData.cnic} onChange={e => setFormData({...formData, cnic: e.target.value})} />
                   </div>
                   <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">NTN / GST Number</label>
                     <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-accent)]" value={formData.ntn} onChange={e => setFormData({...formData, ntn: e.target.value})} />
                   </div>
                   <div className="col-span-2">
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">City & Address</label>
                     <input type="text" placeholder="City" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-accent)] mb-2" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                     <input type="text" placeholder="Full Address" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-accent)]" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                   </div>
                 </div>
               </div>

               <div className="bg-slate-800 p-5 rounded-xl shadow-md space-y-4">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 pb-2">Financial Setup</h3>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-sm font-bold text-slate-300 mb-1.5">Opening Balance</label>
                     <input type="number" className="w-full border-none bg-slate-900 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--color-brand-accent)] font-bold text-white" value={formData.openingBalance} onChange={e => setFormData({...formData, openingBalance: e.target.value})} />
                     <p className="text-[10px] text-slate-400 mt-1">Positive = Receivable, Negative = Payable</p>
                   </div>
                   <div>
                     <label className="block text-sm font-bold text-[var(--color-brand-accent)] mb-1.5">Credit Limit Alert</label>
                     <input type="number" className="w-full border-none bg-slate-900 text-[var(--color-brand-accent)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--color-brand-accent)] font-bold" value={formData.creditLimit} onChange={e => setFormData({...formData, creditLimit: e.target.value})} />
                   </div>
                 </div>
               </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsDrawerOpen(false)} className="px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors">Cancel</button>
              <button onClick={handleSaveParty} className="bg-[var(--color-brand-accent)] hover:bg-[var(--color-brand-accent-hover)] text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-lg">Save Profile</button>
            </div>
          </div>
        </>
      )}

      {/* Add Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
           <div className="bg-white rounded-2xl shadow-2xl w-[450px] overflow-hidden">
             <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <h2 className="font-black text-slate-800 text-lg flex items-center gap-2"><CreditCard className="text-emerald-500"/> Record Payment</h2>
                <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
             </div>
             <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Transaction Type</label>
                    <select className="w-full border rounded-lg px-3 py-2 text-sm outline-none font-bold" value={paymentData.type} onChange={e => setPaymentData({...paymentData, type: e.target.value})}>
                      <option value="PAYMENT_IN">Payment Received (IN)</option>
                      <option value="PAYMENT_OUT">Payment Sent (OUT)</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Amount (Rs) *</label>
                    <input type="number" className="w-full border rounded-lg px-3 py-2 text-xl font-black text-emerald-600 outline-none" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Method</label>
                    <select className="w-full border rounded-lg px-3 py-2 text-sm outline-none" value={paymentData.paymentMethod} onChange={e => setPaymentData({...paymentData, paymentMethod: e.target.value})}>
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Reference / Cheque No</label>
                    <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm outline-none" value={paymentData.referenceNumber} onChange={e => setPaymentData({...paymentData, referenceNumber: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                    <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm outline-none" value={paymentData.description} onChange={e => setPaymentData({...paymentData, description: e.target.value})} />
                  </div>
                  <div className="col-span-2 border-2 border-dashed border-slate-200 rounded-lg p-4 text-center cursor-pointer hover:bg-slate-50 transition-colors">
                     <Upload size={24} className="text-slate-400 mx-auto mb-2" />
                     <p className="text-xs font-bold text-slate-500">Upload Receipt Image (Optional)</p>
                  </div>
                </div>
             </div>
             <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setIsPaymentModalOpen(false)} className="px-5 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
                <button onClick={handleSavePayment} className="px-6 py-2 font-bold text-white bg-[var(--color-brand-accent)] hover:bg-[var(--color-brand-accent-hover)] rounded-lg shadow-md">Post Payment</button>
             </div>
           </div>
        </div>
      )}

    </div>
  );
}
