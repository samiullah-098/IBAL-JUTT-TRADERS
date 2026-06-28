import { useState, useEffect, useRef } from 'react';
import { Search, Printer, FileText, ChevronDown, ChevronUp, MapPin, Phone, Building2 } from 'lucide-react';
import { InvoicePrint } from './InvoicePrint';

const API_BASE = (((window as any).__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:5000') as string).replace(/\/$/, '');


export default function SalesRegisterScreen() {
  const [sales, setSales] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  
  // Print State
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState<any>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/sales`)
      .then(res => res.json())
      .then(setSales);
  }, []);

  const handlePrint = (sale: any) => {
    setSelectedSaleForPrint(sale);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const filteredSales = sales.filter(s => 
    s.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.id.toString().includes(searchTerm) || 
    s.party?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.party?.phone?.includes(searchTerm)
  );

  return (
    <div className="sales-register-screen max-w-[1600px] mx-auto pb-10 h-full flex flex-col relative">
      <div className="bg-white rounded-xl p-4 lg:p-5 shadow-sm border border-slate-100 flex items-center justify-between mb-4 lg:mb-6 shrink-0 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-heading">Daily Sales Register</h2>
          <p className="text-sm text-slate-500 mt-0.5">Complete record of all generated sales invoices</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 border border-slate-100 overflow-hidden flex-1 flex flex-col print:hidden">
        {/* Search */}
        <div className="p-3 lg:p-4 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-white border rounded-xl p-3 shadow-sm">
              <p className="text-[10px] uppercase font-black text-slate-400">Total Invoices</p>
              <p className="font-black text-slate-900 text-lg">{filteredSales.length}</p>
            </div>
            <div className="bg-white border rounded-xl p-3 shadow-sm">
              <p className="text-[10px] uppercase font-black text-slate-400">Total Value</p>
              <p className="font-black text-blue-600 text-lg">Rs {filteredSales.reduce((a, s) => a + s.amount, 0).toLocaleString()}</p>
            </div>
            <div className="bg-white border rounded-xl p-3 shadow-sm">
              <p className="text-[10px] uppercase font-black text-slate-400">Total Paid (Jama)</p>
              <p className="font-black text-emerald-600 text-lg">Rs {filteredSales.reduce((a, s) => a + (s.amountPaid || 0), 0).toLocaleString()}</p>
            </div>
            <div className="bg-white border rounded-xl p-3 shadow-sm">
              <p className="text-[10px] uppercase font-black text-slate-400">Total Udhar</p>
              <p className="font-black text-rose-600 text-lg">Rs {filteredSales.reduce((a, s) => a + Math.max(0, s.amount - (s.amountPaid || 0)), 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2.5 bg-white shadow-sm focus-within:border-blue-500 transition-all">
            <Search size={16} className="text-slate-400 mr-2" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by Invoice ID, Customer Name, or Phone..." 
              className="bg-transparent outline-none w-full text-sm font-medium" 
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 custom-scrollbar p-3 lg:p-6">
           <div className="space-y-4">
              {filteredSales.length === 0 ? (
                <div className="text-center p-10 text-slate-400 font-medium">No sales records found.</div>
              ) : (
                filteredSales.map(sale => {
                  const isExpanded = expandedId === sale.id;
                  
                  // Extract calculated fields
                  const invoiceItems = sale.Items || [];
                  const subtotal = invoiceItems.reduce((acc:number, item:any) => acc + item.total, 0);
                  const discount = sale.discount || 0;
                  const freight = sale.freight || 0;
                  const amountPaid = sale.amountPaid || 0;
                  const grandTotal = sale.amount; // amount already has discount/freight applied in POST /api/sales
                  const balanceDue = grandTotal - amountPaid;
                  
                  const isFullyPaid = amountPaid >= grandTotal;

                  return (
                    <div key={sale.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all duration-200">
                       <div 
                         className="sale-row flex flex-col xl:flex-row xl:items-center xl:justify-between p-4 lg:p-5 cursor-pointer hover:bg-slate-50 gap-3"
                         onClick={() => setExpandedId(isExpanded ? null : sale.id)}
                       >
                          <div className="sale-row-main flex items-center gap-3 lg:gap-5 w-full xl:w-1/4 min-w-0">
                            <div className="bg-blue-50 text-blue-600 p-3 rounded-xl shrink-0">
                               <FileText size={24} />
                            </div>
                            <div>
                               <div className="text-xs font-bold text-slate-400 mb-1">{new Date(sale.date).toLocaleString()}</div>
                               <div className="font-black text-slate-800 text-lg">{sale.invoiceId || `INV-${sale.id.toString().padStart(6, '0')}`}</div>
                            </div>
                          </div>
                          
                          <div className="sale-row-customer w-full xl:w-1/4 min-w-0">
                             <div className="text-xs font-bold text-slate-400 uppercase mb-1">Customer</div>
                             <div className="font-bold text-slate-700 text-base">{sale.party?.name || 'Walk-in'}</div>
                             {sale.party?.phone && <div className="text-[10px] font-bold text-slate-500 mt-1 flex items-center gap-2"><Phone size={10}/> {sale.party.phone}</div>}
                          </div>
                          
                          <div className="sale-row-amounts w-full xl:w-1/4 min-w-0 grid grid-cols-2 gap-2">
                             <div>
                               <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Grand Total</div>
                               <div className="font-black text-slate-800">Rs {grandTotal.toLocaleString()}</div>
                             </div>
                             <div>
                               <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Status</div>
                               <div className={`text-xs font-black px-2 py-1 rounded w-fit ${isFullyPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                  {isFullyPaid ? 'PAID' : `UDHAR: Rs ${balanceDue.toLocaleString()}`}
                               </div>
                             </div>
                          </div>
                          
                          <div className="sale-row-actions w-full xl:w-1/4 flex items-center justify-end gap-3 shrink-0">
                             <button 
                               onClick={(e) => { e.stopPropagation(); handlePrint(sale); }} 
                               className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 p-2.5 rounded-xl transition-colors font-bold text-xs flex items-center gap-2"
                             >
                                <Printer size={16} /> Print
                             </button>
                             <div className="text-slate-300">
                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                             </div>
                          </div>
                       </div>
                       
                       {/* Expanded Details */}
                       {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50 p-4 lg:p-6 cursor-default">
                             <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
                                <table className="w-full text-sm text-left">
                                   <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-100 font-bold">
                                     <tr>
                                       <th className="px-4 py-3">Item / Lot</th>
                                       <th className="px-4 py-3 text-center">Bags</th>
                                       <th className="px-4 py-3 text-right">Quantity</th>
                                       <th className="px-4 py-3 text-right">Rate</th>
                                       <th className="px-4 py-3 text-right">Total</th>
                                     </tr>
                                   </thead>
                                   <tbody className="divide-y divide-slate-100">
                                      {invoiceItems.map((item: any) => (
                                         <tr key={item.id}>
                                           <td className="px-4 py-3 font-bold text-slate-700">
                                             {item.inventoryItem?.variant}
                                             {item.note && <div className="text-[10px] text-slate-400 font-normal italic mt-0.5">{item.note}</div>}
                                           </td>
                                           <td className="px-4 py-3 text-center font-bold text-slate-600">{item.bags || '-'}</td>
                                           <td className="px-4 py-3 text-right font-medium">{item.quantity} {item.unit || 'Kg'}</td>
                                           <td className="px-4 py-3 text-right font-medium">Rs {item.rate.toLocaleString()}</td>
                                           <td className="px-4 py-3 text-right font-bold text-slate-800">Rs {item.total.toLocaleString()}</td>
                                         </tr>
                                      ))}
                                   </tbody>
                                </table>
                                <div className="bg-slate-800 text-white p-5 text-sm space-y-2">
                                   <div className="flex justify-between items-center text-slate-400">
                                     <span className="font-bold">Subtotal Items:</span>
                                     <span className="font-bold text-white">Rs {subtotal.toLocaleString()}</span>
                                   </div>
                                   <div className="flex justify-between items-center text-rose-300">
                                     <span className="font-bold">Discount:</span>
                                     <span className="font-bold">- Rs {discount.toLocaleString()}</span>
                                   </div>
                                   <div className="flex justify-between items-center text-slate-400">
                                     <span className="font-bold">Freight / Mazdoori:</span>
                                     <span className="font-bold text-white">+ Rs {freight.toLocaleString()}</span>
                                   </div>
                                   
                                   <div className="flex justify-between items-center pt-3 border-t border-slate-600 mt-2">
                                     <span className="font-bold text-slate-300">Grand Total Billed:</span>
                                     <span className="font-black text-blue-400 text-xl">Rs {grandTotal.toLocaleString()}</span>
                                   </div>
                                   
                                   <div className="flex justify-between items-center pt-3 border-t border-dashed border-slate-600 mt-2">
                                     <span className="font-bold text-emerald-300">Amount Paid (Jama):</span>
                                     <span className="font-black text-emerald-400">Rs {amountPaid.toLocaleString()}</span>
                                   </div>
                                   <div className="flex justify-between items-center text-rose-300">
                                     <span className="font-bold">Remaining Udhar:</span>
                                     <span className="font-black">Rs {balanceDue.toLocaleString()}</span>
                                   </div>
                                </div>
                             </div>
                             
                             <div className="flex justify-end">
                               <button 
                                 onClick={async () => {
                                   if (!window.confirm('Are you sure you want to completely delete this sale? This will restore inventory stock and reverse customer khata.')) return;
                                   const res = await fetch(`${API_BASE}/api/sales/${sale.id}`, { method: 'DELETE' });
                                   if (res.ok) {
                                     setSales(sales.filter(s => s.id !== sale.id));
                                     alert('Sale deleted successfully!');
                                   } else {
                                     const data = await res.json();
                                     alert(data.error || 'Failed to delete sale');
                                   }
                                 }}
                                 className="bg-rose-100 text-rose-600 hover:bg-rose-200 px-4 py-2 rounded-lg font-bold text-xs"
                               >
                                 Delete Sale Permanently
                               </button>
                             </div>
                          </div>
                       )}
                    </div>
                  );
                })
              )}
           </div>
        </div>
      </div>

      <InvoicePrint ref={printRef} sale={selectedSaleForPrint} />
    </div>
  );
}
