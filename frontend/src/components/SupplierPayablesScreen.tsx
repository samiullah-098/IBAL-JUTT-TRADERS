import { useState, useEffect } from 'react';
import { Search, UserCircle, Package, History } from 'lucide-react';

const API_BASE = (((window as any).__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:5000') as string).replace(/\/$/, '');


export default function SupplierPayablesScreen() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  
  const [supplierData, setSupplierData] = useState<any>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/parties`)
      .then(res => res.json())
      .then(data => setSuppliers(data.filter((p: any) => p.type === 'SELLER' || p.type === 'BOTH')));
  }, []);

  useEffect(() => {
    if (selectedSupplierId) {
      fetch(`${API_BASE}/api/suppliers/${selectedSupplierId}/analysis`)
        .then(res => res.json())
        .then(data => setSupplierData(data));
    }
  }, [selectedSupplierId]);

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.shopName && s.shopName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-[1600px] mx-auto pb-10 h-full flex flex-col">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center justify-between mb-6 shrink-0 border border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-heading">Supplier Payables</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage outstanding balances, payments, and vendor ledgers</p>
        </div>
      </div>

      <div className="flex gap-6 flex-1 h-[calc(100vh-200px)]">
        {/* Left: Supplier List */}
        <div className="w-[350px] bg-white rounded-xl shadow-sm border border-slate-100 border border-slate-100 flex flex-col overflow-hidden shrink-0">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm focus-within:border-[var(--color-brand-accent)] transition-all">
              <Search size={16} className="text-slate-400 mr-2" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search suppliers..." 
                className="bg-transparent outline-none w-full text-sm font-medium" 
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredSuppliers.map(supplier => (
              <div 
                key={supplier.id} 
                onClick={() => setSelectedSupplierId(supplier.id)}
                className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${selectedSupplierId === supplier.id ? 'bg-emerald-50 border-l-4 border-l-[var(--color-brand-accent)]' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="font-bold text-slate-800">{supplier.name}</div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${supplier.outstanding > 0 ? 'bg-emerald-100 text-emerald-700' : (supplier.outstanding < 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600')}`}>
                    {supplier.outstanding > 0 ? 'To Pay' : (supplier.outstanding < 0 ? 'To Receive' : 'Settled')}
                  </span>
                </div>
                <div className="text-xs text-slate-500 line-clamp-1">{supplier.shopName || 'No Shop Name'}</div>
                <div className="mt-2 font-black text-sm text-slate-700">
                  Rs {Math.abs(supplier.outstanding).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Detail View */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 border border-slate-100 flex flex-col overflow-hidden relative">
          {!selectedSupplierId || !supplierData ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                <UserCircle size={60} strokeWidth={1} className="mb-4 opacity-50 text-slate-300" />
                <p className="font-medium text-slate-500">Select a supplier from the list to view their analytics and ledger.</p>
             </div>
          ) : (
             <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                
                {/* Header Profile */}
                <div className="flex justify-between items-start mb-8 pb-6 border-b border-slate-100">
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-[var(--color-brand-accent)]">
                      <UserCircle size={32} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-800 font-heading">{supplierData.supplier.name}</h2>
                      <p className="text-slate-500 font-medium">{supplierData.supplier.shopName || 'Individual Supplier'} {supplierData.supplier.city && `• ${supplierData.supplier.city}`}</p>
                      <div className="flex gap-3 mt-2 text-xs font-bold text-slate-400">
                        {supplierData.supplier.phone && <span>📞 {supplierData.supplier.phone}</span>}
                        {supplierData.supplier.ntn && <span>NTN: {supplierData.supplier.ntn}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                    <p className="text-xs font-bold text-[var(--color-brand-primary)] uppercase mb-1">Supplier Payable (Udhar)</p>
                    <p className={`text-3xl font-black ${supplierData.supplier.outstanding > 0 ? 'text-[var(--color-brand-primary)]' : 'text-emerald-600'}`}>
                      Rs {Math.abs(supplierData.supplier.outstanding).toLocaleString()}
                    </p>
                    <p className="text-xs font-bold mt-1 text-[var(--color-brand-accent)]/70">
                      {supplierData.supplier.outstanding > 0 ? '(You have to pay them)' : (supplierData.supplier.outstanding < 0 ? '(They owe you advance)' : 'Settled')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  {/* Purchase Analytics */}
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Package className="text-[var(--color-brand-accent)]" size={18}/> Historical Supply Analysis
                    </h3>
                    
                    {supplierData.itemStats.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-sm">
                        No purchase history found for this supplier.
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                            <tr>
                              <th className="px-4 py-3">Yarn Variant</th>
                              <th className="px-4 py-3 text-center">Total Bags</th>
                              <th className="px-4 py-3 text-right">Total Weight</th>
                              <th className="px-4 py-3 text-right">Total Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {supplierData.itemStats.map((stat: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 font-bold text-slate-700">{stat.variant}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">{stat.totalBags}</span>
                                </td>
                                <td className="px-4 py-3 text-right font-medium">{stat.totalQuantity.toLocaleString()} {stat.unit}</td>
                                <td className="px-4 py-3 text-right font-bold text-slate-800">Rs {stat.totalValue.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Financial Ledger */}
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <History className="text-emerald-500" size={18}/> Financial Statement (Ledger)
                    </h3>
                    
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-800 text-slate-300 border-b border-slate-700 text-[10px] uppercase font-bold sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-3">Date</th>
                              <th className="px-4 py-3">Details</th>
                              <th className="px-4 py-3 text-right text-rose-400">Paid (Dr)</th>
                              <th className="px-4 py-3 text-right text-emerald-400">Billed (Cr)</th>
                              <th className="px-4 py-3 text-right text-white">Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {supplierData.ledger.length === 0 ? (
                               <tr><td colSpan={5} className="text-center p-6 text-slate-400">No transactions</td></tr>
                            ) : (
                              supplierData.ledger.map((tx: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td>
                                  <td className="px-4 py-3">
                                    <div className="font-bold text-slate-700 text-xs">{tx.description}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">{tx.type} {tx.paymentMethod && `• ${tx.paymentMethod}`}</div>
                                  </td>
                                  <td className="px-4 py-3 text-right font-bold text-rose-600">{tx.dr > 0 ? tx.dr.toLocaleString() : '-'}</td>
                                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{tx.cr > 0 ? tx.cr.toLocaleString() : '-'}</td>
                                  <td className="px-4 py-3 text-right font-black text-slate-800">{tx.runningBalance.toLocaleString()}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
                
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
