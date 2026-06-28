import { useState, useEffect, useRef } from 'react';
import { Search, Phone, MapPin, X, CreditCard, BarChart3, Users, ArrowDownRight, ArrowUpRight, PackageOpen, ListOrdered, ReceiptText, Trash2 } from 'lucide-react';
import KPICard from './KPICard';

const API_BASE = (((window as any).__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:5000') as string).replace(/\/$/, '');


export default function SuppliersScreen() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [supplierStats, setSupplierStats] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  const [paymentData, setPaymentData] = useState({
    amount: '', paymentMethod: 'CASH', referenceNumber: '', description: '', date: new Date().toISOString().split('T')[0]
  });

  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuppliers = async (search = '') => {
    try {
      let url = `${API_BASE}/api/suppliers`;
      if (search) url += `?search=${search}`;
      const res = await fetch(url);
      setSuppliers(await res.json());
    } catch (err) {
      console.error("Failed to fetch suppliers", err);
    }
  };

  const fetchSupplierDetails = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/suppliers/${id}/analysis`);
      const data = await res.json();
      setSelectedSupplier(data.supplier);
      setSupplierStats(data.stats);
      setPurchases(data.purchases);
      setSelectedPurchase(null);
    } catch (err) {
      console.error("Failed to fetch supplier details", err);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      fetchSuppliers(val);
    }, 400);
  };

  const handleSavePayment = async () => {
    if (!selectedSupplier) return;
    try {
      await fetch(`${API_BASE}/api/parties/${selectedSupplier.id}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...paymentData,
          type: 'PAYMENT_OUT'
        })
      });
      setIsPaymentModalOpen(false);
      fetchSupplierDetails(selectedSupplier.id);
      fetchSuppliers(searchTerm);
      setPaymentData({ amount: '', paymentMethod: 'CASH', referenceNumber: '', description: '', date: new Date().toISOString().split('T')[0] });
    } catch (err) {
      console.error("Failed to save payment", err);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!selectedSupplier) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedSupplier.name}? This action cannot be undone.`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_BASE}/api/parties/${selectedSupplier.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      
      if (data.error) {
        alert(data.error);
        return;
      }
      
      setSelectedSupplier(null);
      fetchSuppliers(searchTerm);
    } catch (err) {
      console.error("Failed to delete supplier", err);
      alert("An error occurred while deleting the supplier.");
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto pb-10 relative h-full flex flex-col">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between mb-6 shrink-0 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-heading">Suppliers</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage suppliers, track purchased maal, and handle payments & udhar</p>
        </div>
      </div>

      <div className="flex gap-6 flex-1 overflow-hidden">
        {/* Left: Supplier List — 30% */}
        <div className="w-[30%] min-w-[280px] bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2.5 bg-white shadow-sm focus-within:border-indigo-400 transition-all">
              <Search size={16} className="text-slate-400 mr-2" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search suppliers..." 
                className="bg-transparent outline-none w-full text-sm font-medium text-slate-700" 
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
            {suppliers.length === 0 ? (
              <div className="p-10 text-center text-slate-400 font-medium">No suppliers found.</div>
            ) : (
              suppliers.map(supplier => (
                <div 
                  key={supplier.id} 
                  onClick={() => fetchSupplierDetails(supplier.id)}
                  className={`p-4 cursor-pointer flex items-center justify-between transition-colors ${selectedSupplier?.id === supplier.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {supplier.profileImage ? (
                      <img src={supplier.profileImage} alt={supplier.name} className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" />
                    ) : (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border shadow-sm shrink-0 ${selectedSupplier?.id === supplier.id ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                        {supplier.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className={`font-bold text-sm truncate ${selectedSupplier?.id === supplier.id ? 'text-indigo-700' : 'text-slate-800'}`}>{supplier.name}</h4>
                      <p className="text-[11px] text-slate-500 font-medium truncate">{supplier.shopName || 'Supplier'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className={`font-black text-sm ${supplier.outstanding < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                      Rs {Math.abs(supplier.outstanding).toLocaleString()}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{supplier.outstanding < 0 ? 'Udhar' : 'Cleared'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Detail — 70% */}
        <div className="w-[70%] bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden">
          {selectedSupplier && supplierStats ? (
            <>
              {selectedPurchase ? (
                /* Purchase Detail Drill-down */
                <div className="flex flex-col h-full">
                  <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                     <div>
                       <button onClick={() => setSelectedPurchase(null)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 mb-1 flex items-center gap-1">&larr; Back to Supplier</button>
                       <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                         <ReceiptText className="text-indigo-500" size={20} /> 
                         {selectedPurchase.purchaseId || selectedPurchase.billNumber || `PUR-${selectedPurchase.id}`}
                       </h2>
                       <p className="text-xs text-slate-500 mt-1 font-medium">Date: {new Date(selectedPurchase.purchaseDate).toLocaleDateString()} &bull; Supplier: {selectedSupplier.name}</p>
                     </div>
                     <div className="text-right bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                       <p className="text-[10px] font-bold text-slate-400 uppercase">Status</p>
                       <p className={`text-base font-black ${selectedPurchase.balanceDue > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                         {selectedPurchase.balanceDue > 0 ? 'Partial / Unpaid' : 'Fully Paid'}
                       </p>
                     </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Items Supplied in This Purchase</h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-3">Item Name</th>
                            <th className="px-4 py-3">Qty</th>
                            <th className="px-4 py-3">Purchase Rate</th>
                            <th className="px-4 py-3">Sale Rate</th>
                            <th className="px-4 py-3 text-emerald-600">Bachat / Margin</th>
                            <th className="px-4 py-3 text-right">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedPurchase.items.map((item: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <span className="font-bold text-slate-700">{item.inventoryItem?.variant || 'Item'}</span>
                                {item.inventoryItem?.category && <span className="block text-[10px] text-slate-400">{item.inventoryItem.category}</span>}
                              </td>
                              <td className="px-4 py-3 font-medium">{item.quantity.toLocaleString()} {item.unit || 'Kg'}</td>
                              <td className="px-4 py-3 text-slate-600">Rs {item.rate.toLocaleString()}</td>
                              <td className="px-4 py-3 text-slate-600">Rs {(item.inventoryItem?.sellingPrice || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 font-bold text-emerald-500">
                                {(item.inventoryItem?.sellingPrice || 0) > item.rate 
                                  ? `Rs ${(item.inventoryItem.sellingPrice - item.rate).toLocaleString()} /unit` 
                                  : '-'}
                              </td>
                              <td className="px-4 py-3 font-black text-slate-800 text-right">Rs {(item.quantity * item.rate).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Totals */}
                    <div className="mt-6 bg-slate-50 rounded-xl p-5 border border-slate-200 max-w-sm ml-auto space-y-2">
                       <div className="flex justify-between text-sm font-bold text-slate-600">
                         <span>Gross Amount</span> <span>Rs {(selectedPurchase.totalAmount + selectedPurchase.totalDiscount).toLocaleString()}</span>
                       </div>
                       {selectedPurchase.totalDiscount > 0 && (
                         <div className="flex justify-between text-sm font-bold text-rose-500">
                           <span>Discount</span> <span>- Rs {selectedPurchase.totalDiscount.toLocaleString()}</span>
                         </div>
                       )}
                       <div className="flex justify-between text-sm font-bold text-slate-800 pt-2 border-t border-slate-200">
                         <span>Net Amount</span> <span>Rs {selectedPurchase.totalAmount.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between text-sm font-bold text-emerald-600">
                         <span>Paid</span> <span>Rs {selectedPurchase.amountPaid.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between text-base font-black text-rose-600 pt-2 border-t border-slate-200">
                         <span>Remaining Udhar</span> <span>Rs {selectedPurchase.balanceDue.toLocaleString()}</span>
                       </div>
                    </div>

                    {selectedPurchase.notes && (
                      <div className="mt-4 bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-800">
                        <span className="font-bold">Notes:</span> {selectedPurchase.notes}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Main Supplier Profile */
                <div className="flex flex-col h-full">
                  {/* Profile Header */}
                  <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-start justify-between shrink-0">
                    <div className="flex items-start gap-4">
                       {selectedSupplier.profileImage ? (
                         <img src={selectedSupplier.profileImage} alt={selectedSupplier.name} className="w-14 h-14 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0" />
                       ) : (
                         <div className="w-14 h-14 rounded-xl bg-white border-2 border-slate-200 shadow-sm flex items-center justify-center text-slate-400 font-black text-lg shrink-0">
                           {selectedSupplier.name.substring(0, 2).toUpperCase()}
                         </div>
                       )}
                       <div>
                         <div className="flex items-center gap-3 mb-1">
                           <h2 className="text-xl font-black text-slate-800 font-heading">{selectedSupplier.name}</h2>
                           <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Supplier</span>
                         </div>
                         {selectedSupplier.shopName && <h3 className="text-sm font-bold text-slate-500 mb-2">{selectedSupplier.shopName}</h3>}
                         
                         <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                           {selectedSupplier.phone && <span className="flex items-center gap-1"><Phone size={12} className="text-slate-400" /> {selectedSupplier.phone}</span>}
                           {selectedSupplier.city && <span className="flex items-center gap-1"><MapPin size={12} className="text-slate-400" /> {selectedSupplier.city}</span>}
                         </div>
                       </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                       <div className="text-right bg-white border border-slate-200 shadow-sm px-4 py-2 rounded-xl">
                         <p className="text-[10px] font-bold text-slate-400 uppercase">Remaining Udhar</p>
                         <p className={`text-xl font-black ${supplierStats.remainingPayable > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                           Rs {supplierStats.remainingPayable.toLocaleString()}
                         </p>
                       </div>
                       <div className="flex items-center gap-2 mt-2">
                         <button 
                           onClick={handleDeleteSupplier}
                           className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-colors border border-rose-200 shadow-sm flex items-center gap-1.5"
                         >
                           <Trash2 size={14} /> Delete
                         </button>
                         <button 
                           onClick={() => setIsPaymentModalOpen(true)}
                           className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-md flex items-center gap-1.5"
                         >
                           <CreditCard size={14} /> Pay Supplier
                         </button>
                       </div>
                    </div>
                  </div>
  
                  {/* Report Cards */}
                  <div className="p-4 border-b border-slate-100 shrink-0">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <KPICard title="Total Maal Supplied" value={supplierStats.totalMaalSupplied.toLocaleString()} subtitle="Overall quantity" icon={PackageOpen} iconBgClass="bg-blue-50" iconColorClass="text-blue-500" />
                      <KPICard title="Total Purchase Amount" value={`Rs ${supplierStats.totalPurchaseAmount.toLocaleString()}`} icon={BarChart3} iconBgClass="bg-slate-100" iconColorClass="text-slate-600" />
                      <KPICard title="Total Paid" value={`Rs ${supplierStats.totalPaidAmount.toLocaleString()}`} icon={ArrowDownRight} iconBgClass="bg-emerald-50" iconColorClass="text-emerald-500" />
                      <KPICard title="Remaining Udhar" value={`Rs ${supplierStats.remainingPayable.toLocaleString()}`} icon={ArrowUpRight} iconBgClass="bg-rose-50" iconColorClass="text-rose-500" />
                    </div>
                  </div>
  
                  {/* Purchase History */}
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><ListOrdered className="text-indigo-500" size={16} /> Purchase History</h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                          <tr>
                            <th className="px-4 py-3">Purchase ID / Date</th>
                            <th className="px-4 py-3">Items</th>
                            <th className="px-4 py-3">Total Amount</th>
                            <th className="px-4 py-3 text-emerald-500">Paid</th>
                            <th className="px-4 py-3 text-rose-500">Udhar</th>
                            <th className="px-4 py-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {purchases.length === 0 ? (
                            <tr><td colSpan={6} className="text-center p-8 text-slate-400">No purchases recorded yet.</td></tr>
                          ) : (
                            purchases.map((p, idx) => {
                              const totalQty = p.items.reduce((acc: number, item: any) => acc + item.quantity, 0);
                              return (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="font-bold text-indigo-600 text-xs">{p.purchaseId || p.billNumber || `PUR-${p.id}`}</div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">{new Date(p.purchaseDate).toLocaleDateString()}</div>
                                  </td>
                                  <td className="px-4 py-3 font-medium text-slate-700 text-xs">{totalQty.toLocaleString()} units</td>
                                  <td className="px-4 py-3 font-black text-slate-800 text-xs">Rs {p.totalAmount.toLocaleString()}</td>
                                  <td className="px-4 py-3 font-bold text-emerald-500 text-xs">Rs {p.amountPaid.toLocaleString()}</td>
                                  <td className="px-4 py-3 font-bold text-rose-500 text-xs">Rs {p.balanceDue.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-center">
                                    <button 
                                      onClick={() => setSelectedPurchase(p)}
                                      className="px-3 py-1 bg-white border border-slate-200 text-indigo-600 rounded-lg text-[11px] font-bold hover:bg-indigo-50 transition-colors shadow-sm"
                                    >
                                      View
                                    </button>
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-10 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Users size={32} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-600 mb-2">No Supplier Selected</h3>
              <p className="text-sm">Select a supplier from the list to view their profile, supplied maal, and udhar history.</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && selectedSupplier && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
           <div className="bg-white rounded-2xl shadow-2xl w-[450px] overflow-hidden">
             <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <h2 className="font-black text-slate-800 text-lg flex items-center gap-2"><CreditCard className="text-indigo-500"/> Pay Supplier</h2>
                <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
             </div>
             <div className="p-6 space-y-4">
                <div className="bg-rose-50 p-3 rounded-lg border border-rose-100 flex justify-between items-center">
                  <span className="text-sm font-bold text-rose-700">Current Udhar</span>
                  <span className="text-xl font-black text-rose-600">Rs {Math.abs(selectedSupplier.outstanding).toLocaleString()}</span>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Amount Paying (Rs) *</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2.5 text-xl font-black text-indigo-600 outline-none focus:border-indigo-500" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Method</label>
                    <select className="w-full border rounded-lg px-3 py-2 text-sm outline-none" value={paymentData.paymentMethod} onChange={e => setPaymentData({...paymentData, paymentMethod: e.target.value})}>
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="JAZZCASH">JazzCash / EasyPaisa</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Ref / Cheque No</label>
                    <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm outline-none" value={paymentData.referenceNumber} onChange={e => setPaymentData({...paymentData, referenceNumber: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                  <input type="text" placeholder="e.g. Paid against PUR-2026-0001" className="w-full border rounded-lg px-3 py-2 text-sm outline-none" value={paymentData.description} onChange={e => setPaymentData({...paymentData, description: e.target.value})} />
                </div>
             </div>
             <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setIsPaymentModalOpen(false)} className="px-5 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
                <button onClick={handleSavePayment} className="px-6 py-2.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md">Post Payment</button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
