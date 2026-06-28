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
                             <div className="font-bold text-slate-700 text-base">{sale.party?.name}</div>
                             <div className="text-[10px] font-bold text-slate-500 mt-1 flex items-center gap-2">
                               {sale.party?.phone && <span className="flex items-center gap-1"><Phone size={10} /> {sale.party.phone}</span>}
                               {sale.party?.shopName && <span className="flex items-center gap-1"><Building2 size={10} /> {sale.party.shopName}</span>}
                             </div>
                          </div>

                          <div className="sale-row-status w-full xl:w-1/4 xl:text-center">
                             <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Payment Status</div>
                             <div className={`inline-block px-2 py-1 rounded text-xs font-bold border ${isFullyPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                               {isFullyPaid ? 'Fully Paid' : 'Udhar / Partial'}
                             </div>
                          </div>
                          
                          <div className="sale-row-total w-full xl:w-1/4 flex items-center justify-between xl:justify-end gap-3 lg:gap-6">
                             <div className="text-right">
                               <div className="text-xs font-bold text-slate-400 uppercase mb-1">Invoice Total</div>
                               <div className="font-black text-blue-600 text-xl">Rs {grandTotal.toLocaleString()}</div>
                               {!isFullyPaid && <div className="text-[10px] font-bold text-rose-500">Udhar: Rs {balanceDue.toLocaleString()}</div>}
                             </div>
                             <div className="text-slate-400 shrink-0">
                               {isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                             </div>
                          </div>
                       </div>
                       
                       {isExpanded && (
                          <div className="sale-expanded p-4 lg:p-6 bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
                             
                             <div className="flex flex-col lg:flex-row justify-between lg:items-start gap-3 mb-4">
                               <div className="space-y-1">
                                  <h4 className="font-bold text-slate-800 uppercase text-xs tracking-wider mb-2">Customer Details</h4>
                                  <p className="text-sm font-bold text-slate-700">{sale.party?.name}</p>
                                  {sale.party?.phone && <p className="text-xs text-slate-600 flex items-center gap-1"><Phone size={12}/> {sale.party.phone}</p>}
                                  {sale.party?.shopName && <p className="text-xs text-slate-600 flex items-center gap-1"><Building2 size={12}/> {sale.party.shopName}</p>}
                                  {sale.party?.address && <p className="text-xs text-slate-600 flex items-center gap-1"><MapPin size={12}/> {sale.party.address} {sale.party.city ? `, ${sale.party.city}` : ''}</p>}
                               </div>
                               <button 
                                 onClick={(e) => { e.stopPropagation(); handlePrint(sale); }}
                                 className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm"
                               >
                                 <Printer size={14} /> Print Duplicate Invoice
                               </button>
                             </div>
                             
                             <h4 className="font-bold text-slate-800 uppercase text-xs tracking-wider mb-3 mt-6">Itemized Breakdown</h4>
                             <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto custom-scrollbar">
                               <table className="min-w-[640px] w-full text-left text-sm">
                                  <thead className="bg-slate-100 border-b border-slate-200 text-[10px] uppercase text-slate-500 font-bold">
                                     <tr>
                                       <th className="px-4 py-3">Item Variant</th>
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
