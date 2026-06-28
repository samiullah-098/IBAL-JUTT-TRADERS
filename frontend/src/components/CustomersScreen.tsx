import { useState, useEffect } from 'react';
import { Search, UserCircle, ShoppingBag, Trash2 } from 'lucide-react';

const API_BASE = (((window as any).__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:5000') as string).replace(/\/$/, '');


export default function CustomersScreen() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  
  const [customerData, setCustomerData] = useState<any>(null);

  const fetchCustomers = () => {
    fetch(`${API_BASE}/api/parties`)
      .then(res => res.json())
      .then(data => setCustomers(data.filter((p: any) => p.type === 'BUYER' || p.type === 'BOTH')));
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      fetch(`${API_BASE}/api/customers/${selectedCustomerId}/analysis`)
        .then(res => res.json())
        .then(data => setCustomerData(data));
    }
  }, [selectedCustomerId]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this customer? This will only work if they have no transactions.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/parties/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.error) alert(result.error);
      else {
        setSelectedCustomerId(null);
        setCustomerData(null);
        fetchCustomers();
      }
    } catch (e) {
      alert("Error deleting customer");
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone && c.phone.includes(searchTerm)) ||
    (c.shopName && c.shopName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-[1600px] mx-auto pb-10 h-full flex flex-col">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center justify-between mb-6 shrink-0 border border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-heading">Customers CRM</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage customer ledgers, sales analytics, and WhatsApp history</p>
        </div>
      </div>

      <div className="flex gap-6 flex-1 h-[calc(100vh-200px)]">
        {/* Left: Customer List */}
        <div className="w-[350px] bg-white rounded-xl shadow-sm border border-slate-100 border border-slate-100 flex flex-col overflow-hidden shrink-0">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm focus-within:border-emerald-500 transition-all">
              <Search size={16} className="text-slate-400 mr-2" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search customers..." 
                className="bg-transparent outline-none w-full text-sm font-medium" 
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredCustomers.map(customer => (
              <div 
                key={customer.id} 
                onClick={() => setSelectedCustomerId(customer.id)}
                className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${selectedCustomerId === customer.id ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="font-bold text-slate-800">{customer.name}</div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600`}>
                    Customer
                  </span>
                </div>
                <div className="text-xs font-medium text-slate-500 line-clamp-1">{customer.phone || 'No Phone'}</div>
                <div className="mt-1 text-xs font-bold text-slate-600">
                  {customer.shopName || 'Individual'} • {customer.city || 'No City'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Detail View */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 border border-slate-100 flex flex-col overflow-hidden relative">
          {!selectedCustomerId || !customerData ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                <UserCircle size={60} strokeWidth={1} className="mb-4 opacity-50 text-slate-300" />
                <p className="font-medium text-slate-500">Select a customer from the list to view their analytics and ledger.</p>
             </div>
          ) : (
             <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                
                {/* Header Profile */}
                <div className="flex justify-between items-start mb-8 pb-6 border-b border-slate-100">
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-500">
                      <UserCircle size={32} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-800 font-heading">{customerData.customer.name}</h2>
                      <p className="text-slate-500 font-medium">{customerData.customer.shopName || 'Individual Customer'} {customerData.customer.city && `• ${customerData.customer.city}`}</p>
                      <div className="flex gap-3 mt-2 text-xs font-bold text-slate-400">
                        {customerData.customer.phone && <span>📞 {customerData.customer.phone}</span>}
                        {customerData.customer.address && <span>📍 {customerData.customer.address}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 items-center">
                    <div className="text-right bg-slate-50 border border-slate-200 p-4 rounded-xl">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Lifetime Sales</p>
                      <p className={`text-3xl font-black text-emerald-600`}>
                        Rs {(customerData.salesHistory ? customerData.salesHistory.reduce((sum: number, sale: any) => sum + sale.amount, 0) : 0).toLocaleString()}
                      </p>
                      <p className="text-xs font-bold mt-1 text-slate-500">
                        {(customerData.salesHistory ? customerData.salesHistory.length : 0)} Total Bills
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {customerData.customer.phone && (
                        <button 
                          onClick={() => {
                            const phone = customerData.customer.phone;
                            let fPhone = phone.replace(/[^0-9]/g, '');
                            if (fPhone.startsWith('0')) fPhone = '92' + fPhone.slice(1);
                            window.open(`https://wa.me/${fPhone}`, '_blank');
                          }}
                          className="px-3 py-2 bg-[#25D366] text-white hover:bg-[#128C7E] rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-sm" title="Message on WhatsApp"
                        >
                          WhatsApp Message
                        </button>
                      )}
                      <button onClick={() => handleDelete(customerData.customer.id)} className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors flex items-center justify-center" title="Delete Customer">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                    <ShoppingBag className="text-emerald-500" size={24}/> Complete Bills History
                  </h3>
                  
                  {(!customerData.salesHistory || customerData.salesHistory.length === 0) ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No sales history found for this customer.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {customerData.salesHistory.map((sale: any, idx: number) => {
                        const discountMatch = sale.description?.match(/Discount:\s*([\d.]+)/i);
                        const freightMatch = sale.description?.match(/Freight:\s*([\d.]+)/i);
                        const discount = discountMatch ? parseFloat(discountMatch[1]) : 0;
                        const freight = freightMatch ? parseFloat(freightMatch[1]) : 0;
                        const subtotal = sale.Items.reduce((acc: number, item: any) => acc + item.total, 0);
                        
                        return (
                          <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <div className="bg-slate-50 p-5 border-b border-slate-200 flex justify-between items-center">
                              <div>
                                <h4 className="font-bold text-slate-800 text-lg">Sale Bill #{sale.id}</h4>
                                <p className="text-xs font-medium text-slate-500 mt-0.5">{new Date(sale.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Bill Amount</p>
                                <p className="text-2xl font-black text-emerald-600 font-heading">Rs {sale.amount.toLocaleString()}</p>
                              </div>
                            </div>
                            
                            <div className="p-6">
                              <table className="w-full text-left text-sm mb-6">
                                <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                                  <tr>
                                    <th className="pb-3 font-black text-slate-500">Item Description</th>
                                    <th className="pb-3 font-black text-slate-500 text-center">Quantity / Bags</th>
                                    <th className="pb-3 font-black text-slate-500 text-right">Price per Unit</th>
                                    <th className="pb-3 font-black text-slate-500 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {sale.Items.map((item: any, i: number) => (
                                    <tr key={i}>
                                      <td className="py-4">
                                        <div className="font-bold text-slate-800">{item.inventoryItem?.variant || 'Unknown Item'}</div>
                                        <div className="text-[11px] text-slate-500 mt-0.5 font-medium">{item.inventoryItem?.category} {item.inventoryItem?.millName && `• ${item.inventoryItem.millName}`}</div>
                                      </td>
                                      <td className="py-4 text-center">
                                        <div className="font-bold text-slate-700">{item.quantity} {item.unit}</div>
                                        {item.bags && <div className="text-[10px] text-slate-400 font-bold mt-0.5">{item.bags} bags</div>}
                                      </td>
                                      <td className="py-4 text-right font-bold text-slate-600">Rs {item.rate.toLocaleString()}</td>
                                      <td className="py-4 text-right font-black text-slate-800">Rs {item.total.toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              
                              <div className="flex justify-end border-t border-slate-100 pt-5">
                                <div className="w-[300px] space-y-2 text-sm">
                                  <div className="flex justify-between font-bold text-slate-500">
                                    <span>Items Subtotal:</span>
                                    <span>Rs {subtotal.toLocaleString()}</span>
                                  </div>
                                  {discount > 0 && (
                                    <div className="flex justify-between font-bold text-rose-500">
                                      <span>Discount Given:</span>
                                      <span>- Rs {discount.toLocaleString()}</span>
                                    </div>
                                  )}
                                  {freight > 0 && (
                                    <div className="flex justify-between font-bold text-blue-500">
                                      <span>Mazdoori / Freight:</span>
                                      <span>+ Rs {freight.toLocaleString()}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between font-black text-lg text-slate-800 pt-3 border-t border-slate-200 mt-3">
                                    <span>Final Bill:</span>
                                    <span className="text-emerald-600">Rs {sale.amount.toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
