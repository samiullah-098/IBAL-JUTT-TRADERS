import { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, Save, Trash2, Truck, MapPin, Package, DollarSign, UserPlus, User, AlertTriangle, Image as ImageIcon } from 'lucide-react';

const API_BASE = (((window as any).__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:5000') as string).replace(/\/$/, '');


export default function PurchasesScreen() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    billNumber: '', partyId: '', purchaseDate: new Date().toISOString().split('T')[0], status: 'RECEIVED',
    truckNumber: '', driverPhone: '', amountPaid: '0', notes: '',
    paymentMethod: 'CASH', paymentStatus: 'UNPAID', discountType: 'FIXED', totalDiscount: '0', billImage: ''
  });

  const [isNewSupplier, setIsNewSupplier] = useState(false);
  const [newSupplierData, setNewSupplierData] = useState({
    name: '', phone: '', shopName: '', city: '', address: '', openingBalance: '0', profileImage: ''
  });

  const handleSupplierImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewSupplierData({ ...newSupplierData, profileImage: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };
  
  const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = async (search = '') => {
    try {
      let url = `${API_BASE}/api/purchases`;
      if (search) url += `?search=${search}`;
      
      const [purchasesRes, partiesRes, invRes] = await Promise.all([
        fetch(url),
        fetch(`${API_BASE}/api/suppliers`),
        fetch(`${API_BASE}/api/inventory`)
      ]);
      
      setPurchases(await purchasesRes.json());
      setParties(await partiesRes.json());
      setInventoryItems(await invRes.json());
    } catch (err) {
      console.error("Failed to fetch data", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      fetchData(val);
    }, 400);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, billImage: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const openDrawer = (purchase?: any, detailView = false) => {
    if (purchase) {
      setSelectedPurchase(purchase);
      setFormData({
        billNumber: purchase.billNumber,
        partyId: purchase.partyId,
        purchaseDate: new Date(purchase.purchaseDate).toISOString().split('T')[0],
        status: purchase.status,
        truckNumber: purchase.truckNumber || '',
        driverPhone: purchase.driverPhone || '',
        amountPaid: purchase.amountPaid.toString(),
        notes: purchase.notes || '',
        paymentMethod: purchase.paymentMethod || 'CASH',
        paymentStatus: purchase.paymentStatus || 'UNPAID',
        discountType: purchase.discountType || 'FIXED',
        totalDiscount: purchase.totalDiscount?.toString() || '0',
        billImage: purchase.billImage || ''
      });
      setPurchaseItems(purchase.items || []);
    } else {
      setSelectedPurchase(null);
      setFormData({
        billNumber: '', partyId: '', purchaseDate: new Date().toISOString().split('T')[0], status: 'RECEIVED',
        truckNumber: '', driverPhone: '', amountPaid: '0', notes: '',
        paymentMethod: 'CASH', paymentStatus: 'UNPAID', discountType: 'FIXED', totalDiscount: '0', billImage: ''
      });
      setIsNewSupplier(false);
      setNewSupplierData({ name: '', phone: '', shopName: '', city: '', address: '', openingBalance: '0', profileImage: '' });
      setPurchaseItems([]);
    }
    setIsDetailView(detailView);
    setIsDrawerOpen(true);
  };

  const handleSave = async () => {
    if ((!formData.partyId && !isNewSupplier) || (isNewSupplier && !newSupplierData.name)) {
      alert("Please select a supplier or enter a new supplier name.");
      return;
    }
    if (purchaseItems.length === 0) {
      alert("Please add at least one item.");
      return;
    }
    
    if (purchaseItems.some(item => !item.isNewItem && !item.inventoryItemId)) {
      alert("Please select a yarn variant for all items, or create a new one.");
      return;
    }
    
    if (purchaseItems.some(item => item.isNewItem && !item.newItemDetails?.variant)) {
      alert("Please provide the Item Name for all new items.");
      return;
    }

    try {
      const payload: any = {
        ...formData,
        items: purchaseItems.map(item => {
          const bagWeights = parseBagWeights(item.bagWeightsText || item.bagWeights);
          const quantity = bagWeights.length > 0
            ? bagWeights.reduce((a, b) => a + b, 0)
            : ((parseFloat(item.bags || 0) || 0) * (parseFloat(item.weightPerBag || 0) || 0));
          return {
            ...item,
            bagWeights,
            quantity: quantity.toString(),
            bags: bagWeights.length > 0 ? String(bagWeights.length) : item.bags,
            weightPerBag: bagWeights.length > 0 ? String(quantity / bagWeights.length) : item.weightPerBag
          };
        })
      };

      if (isNewSupplier) {
        payload.newSupplier = newSupplierData;
      }
      
      await fetch(`${API_BASE}/api/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      setIsDrawerOpen(false);
      fetchData();
    } catch (err) {
      console.error("Failed to save", err);
    }
  };

  const handleDelete = async (id: number) => {
    if(!confirm('Are you sure you want to completely delete this invoice? This will REVERSE the items from inventory and reverse the Khata balance.')) return;
    try {
      await fetch(`${API_BASE}/api/purchases/${id}`, { method: 'DELETE' });
      setIsDrawerOpen(false);
      fetchData();
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  const addItemRow = () => {
    setPurchaseItems([...purchaseItems, { inventoryItemId: '', bags: '', weightPerBag: '', unit: 'Kg', rate: '', note: '' }]);
  };

  const updateItemRow = (index: number, field: string, value: any) => {
    const newItems = [...purchaseItems];
    newItems[index][field] = value;
    setPurchaseItems(newItems);
  };

  const removeItemRow = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const parseBagWeights = (raw: any): number[] => {
    const text = String(raw || '').trim();
    if (!text) return [];
    return text
      .replace(/[\n\t]+/g, ',')
      .split(/[,، ]+/)
      .map(v => Number(v.trim()))
      .filter(n => Number.isFinite(n) && n > 0);
  };

  const getItemQuantity = (item: any) => {
    const weights = parseBagWeights(item.bagWeightsText || item.bagWeights);
    if (weights.length > 0) return weights.reduce((a, b) => a + b, 0);
    return (parseFloat(item.bags) || 0) * (parseFloat(item.weightPerBag) || 0);
  };

  const selectedInventory = (item: any) => inventoryItems.find(inv => String(inv.id) === String(item.inventoryItemId));
  const purchaseRateNote = (item: any) => {
    const inv = selectedInventory(item);
    const oldRate = Number(inv?.purchaseRate || 0);
    const newRate = Number(item.rate || 0);
    if (!inv || !oldRate || !newRate) return null;
    const diff = newRate - oldRate;
    if (diff > 0) return { type: 'high', text: `Is dafa purchase rate previous se Rs ${diff.toLocaleString()} zyada hai. Previous: Rs ${oldRate.toLocaleString()}` };
    if (diff < 0) return { type: 'low', text: `Is dafa purchase rate previous se Rs ${Math.abs(diff).toLocaleString()} kam hai. Previous: Rs ${oldRate.toLocaleString()}` };
    return { type: 'same', text: `Purchase rate previous jaisa hi hai: Rs ${oldRate.toLocaleString()}` };
  };

  const calculateLineTotal = (item: any) => {
    const quantity = getItemQuantity(item);
    const r = parseFloat(item.rate) || 0;
    return quantity * r;
  };

  const grossTotal = purchaseItems.reduce((acc, item) => acc + calculateLineTotal(item), 0);
  const netTotal = grossTotal - (parseFloat(formData.totalDiscount) || 0);
  const balanceDue = netTotal - parseFloat(formData.amountPaid || '0');

  return (
    <div className="max-w-[1600px] mx-auto pb-10 relative h-full flex flex-col">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center justify-between mb-6 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-heading">Complete Purchase Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage inward stock, supplier khata, logistics, margins, and automated valuations</p>
        </div>
        <button 
          onClick={() => openDrawer()}
          className="bg-[var(--color-brand-accent)] hover:bg-[var(--color-brand-accent-hover)] text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-md"
        >
          <Plus size={16} /> Create Purchase Invoice
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex-1 flex flex-col">
        {/* Search */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2.5 bg-white shadow-sm focus-within:border-[var(--color-brand-accent)] focus-within:ring-1 focus-within:ring-[var(--color-brand-accent)] transition-all">
            <Search size={16} className="text-slate-400 mr-2" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by Bill Number, Supplier, or Truck Number..." 
              className="bg-transparent outline-none w-full text-sm font-medium text-slate-700" 
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px] sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4">Date & Bill No</th>
                <th className="px-6 py-4">Supplier Party</th>
                <th className="px-6 py-4">Items/Stock</th>
                <th className="px-6 py-4 text-[var(--color-brand-primary)]">Payment Status</th>
                <th className="px-6 py-4 text-emerald-600">Net Amount</th>
                <th className="px-6 py-4 text-[var(--color-brand-accent)]">Balance Khata</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchases.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-20 text-center text-slate-400 font-medium">No purchase invoices found.</td></tr>
              ) : (
                purchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => openDrawer(purchase, true)}>
                    <td className="px-6 py-4">
                      <div className="font-bold text-indigo-600">{purchase.purchaseId || `#${purchase.billNumber}`}</div>
                      {purchase.billNumber && purchase.purchaseId && <div className="text-[10px] text-slate-400 mt-0.5">Ref: {purchase.billNumber}</div>}
                      <div className="text-[11px] text-slate-500 font-medium mt-1">{new Date(purchase.purchaseDate).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700">{purchase.party?.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-emerald-100 text-[var(--color-brand-primary)] px-2 py-0.5 rounded-full text-xs font-bold">{purchase.items?.length || 0} items</span>
                    </td>
                    <td className="px-6 py-4">
                      {purchase.paymentStatus === 'PAID' ? (
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">PAID</span>
                      ) : purchase.paymentStatus === 'PARTIAL' ? (
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">PARTIAL</span>
                      ) : (
                        <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold">UNPAID</span>
                      )}
                      <div className="text-[10px] text-slate-500 mt-1 font-bold">{purchase.paymentMethod}</div>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-800">Rs {purchase.totalAmount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      {purchase.balanceDue > 0 ? (
                        <span className="font-bold text-[var(--color-brand-primary)]">Rs {purchase.balanceDue.toLocaleString()}</span>
                      ) : <span className="text-slate-400 font-medium">Cleared</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); openDrawer(purchase, true); }}
                        className="text-blue-500 font-bold hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        View Bill
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer */}
      {isDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40" onClick={() => setIsDrawerOpen(false)}></div>
          <div className={`fixed top-0 right-0 h-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out border-l border-slate-200 ${isDetailView ? 'w-[600px]' : 'w-[900px]'}`}>
            
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Package className="text-[var(--color-brand-accent)]" /> 
                {isDetailView ? `Invoice #${selectedPurchase?.billNumber}` : 'New Purchase Invoice'}
              </h2>
              <div className="flex items-center gap-2">
                {isDetailView && (
                  <button onClick={() => handleDelete(selectedPurchase.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors font-bold flex items-center gap-2">
                    <Trash2 size={16} /> Reverse Invoice
                  </button>
                )}
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 custom-scrollbar">
              {isDetailView && selectedPurchase ? (
                /* VIEW INVOICE MODE */
                <div className="space-y-6">
                   <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-start">
                     <div className="w-2/3">
                       <h3 className="text-xs font-bold text-slate-400 uppercase">Supplier</h3>
                       <p className="text-xl font-black text-slate-800 mt-1 mb-2">{selectedPurchase.party?.name}</p>
                       <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                         <div>
                           <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Company Name</span>
                           <span className="font-semibold text-slate-700">{selectedPurchase.party?.shopName || 'Not Provided'}</span>
                         </div>
                         <div>
                           <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Phone Number</span>
                           <span className="font-semibold text-slate-700 flex items-center gap-1.5">{selectedPurchase.party?.phone || 'Not Provided'}</span>
                         </div>
                         <div className="col-span-2">
                           <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Address</span>
                           <span className="font-semibold text-slate-700 flex items-center gap-1.5">{selectedPurchase.party?.address || 'Not Provided'} {selectedPurchase.party?.city ? `, ${selectedPurchase.party.city}` : ''}</span>
                         </div>
                       </div>
                       <p className="text-xs font-bold text-slate-400 mt-4 border-t border-slate-100 pt-2">Purchase Date: {new Date(selectedPurchase.purchaseDate).toLocaleDateString()}</p>
                     </div>
                     <div className="text-right w-1/3">
                       <h3 className="text-xs font-bold text-slate-400 uppercase">Status</h3>
                       <span className="inline-block mt-2 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold">{selectedPurchase.status}</span>
                     </div>
                   </div>

                   {(selectedPurchase.truckNumber || selectedPurchase.driverPhone) && (
                     <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-2 gap-4">
                       <div>
                         <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1"><Truck size={14}/> Truck Number</span>
                         <span className="font-bold text-slate-800">{selectedPurchase.truckNumber || 'N/A'}</span>
                       </div>
                       <div>
                         <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1"><MapPin size={14}/> Driver Contact</span>
                         <span className="font-bold text-slate-800">{selectedPurchase.driverPhone || 'N/A'}</span>
                       </div>
                     </div>
                   )}

                   <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                     <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-sm">Purchased Items & Inventory Updated</div>
                     <table className="w-full text-left text-sm">
                       <thead className="text-[11px] uppercase text-slate-400 font-bold border-b border-slate-100">
                         <tr><th className="px-5 py-3">Variant (Category)</th><th className="px-5 py-3">Details</th><th className="px-5 py-3">Rate</th><th className="px-5 py-3 text-right">Total</th></tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {purchaseItems.map((item, idx) => (
                           <tr key={idx}>
                             <td className="px-5 py-4">
                               <div className="font-bold text-slate-800">{item.inventoryItem?.variant} <span className="text-[10px] text-slate-400">({item.inventoryItem?.category})</span></div>
                               {item.note && <div className="text-[10px] text-slate-500 mt-1 italic">{item.note}</div>}
                             </td>
                             <td className="px-5 py-4">
                               <div className="font-bold">{item.bags} Bags</div>
                               <div className="text-xs text-slate-500">{item.quantity} {item.unit || 'Kg'}</div>
                             </td>
                             <td className="px-5 py-4">Rs {item.rate.toLocaleString()}/{item.unit}</td>
                             <td className="px-5 py-4 font-bold text-right">Rs {item.total.toLocaleString()}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>

                   {selectedPurchase.billImage && (
                     <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                       <h3 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2"><ImageIcon size={14}/> Attached Bill Image</h3>
                       <img src={selectedPurchase.billImage} alt="Bill attachment" className="max-w-full rounded-lg border border-slate-200 shadow-sm" />
                     </div>
                   )}

                   <div className="bg-slate-800 p-6 rounded-xl shadow-md text-white grid grid-cols-2 gap-4">
                      <div>
                        <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Gross Total</span>
                        <span className="text-lg font-bold">Rs {(selectedPurchase.totalAmount + selectedPurchase.totalDiscount).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-rose-400 uppercase mb-1">Total Discount</span>
                        <span className="text-lg font-bold text-rose-400">- Rs {selectedPurchase.totalDiscount.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Paid Upfront ({selectedPurchase.paymentMethod})</span>
                        <span className="text-lg font-bold text-emerald-400">Rs {selectedPurchase.amountPaid.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-[var(--color-brand-accent)] uppercase mb-1">Added to Khata</span>
                        <span className="text-xl font-black text-[var(--color-brand-accent)]">Rs {selectedPurchase.balanceDue.toLocaleString()}</span>
                      </div>
                   </div>
                </div>
              ) : (
                /* CREATE INVOICE MODE */
                <div className="space-y-6">
                  {/* Section 1: Supplier & Bill Info */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-4">
                      <h3 className="font-black text-slate-800 text-lg">1. Supplier Information</h3>
                      <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button 
                          onClick={() => setIsNewSupplier(false)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-colors ${!isNewSupplier ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          <User size={14}/> Existing
                        </button>
                        <button 
                          onClick={() => setIsNewSupplier(true)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-colors ${isNewSupplier ? 'bg-[var(--color-brand-accent)] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          <UserPlus size={14}/> New Supplier
                        </button>
                      </div>
                    </div>
                    
                    {!isNewSupplier ? (
                      <div className="grid grid-cols-2 gap-5">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">Supplier Party (Khata) *</label>
                          <select 
                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-accent)] font-bold text-slate-700"
                            value={formData.partyId} onChange={e => setFormData({...formData, partyId: e.target.value})}
                          >
                            <option value="">-- Select Party --</option>
                            {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                           <label className="block text-sm font-bold text-slate-700 mb-1.5">Bill / Invoice Number *</label>
                           <input 
                             type="text" placeholder="INV-2026-001"
                             className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-accent)] font-bold text-slate-700"
                             value={formData.billNumber} onChange={e => setFormData({...formData, billNumber: e.target.value})}
                           />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                        <div className="col-span-2 flex items-start gap-4">
                          {/* Profile Picture */}
                          <div className="shrink-0">
                            <label className="block text-xs font-bold text-[var(--color-brand-primary)] mb-1">Photo</label>
                            <label className="w-16 h-16 rounded-xl border-2 border-dashed border-emerald-300 bg-white flex items-center justify-center cursor-pointer hover:bg-emerald-50 transition-colors overflow-hidden">
                              {newSupplierData.profileImage ? (
                                <img src={newSupplierData.profileImage} alt="Profile" className="w-full h-full object-cover" />
                              ) : (
                                <UserPlus size={20} className="text-emerald-400" />
                              )}
                              <input type="file" accept="image/*" onChange={handleSupplierImageUpload} className="hidden" />
                            </label>
                          </div>
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <div>
                               <label className="block text-xs font-bold text-[var(--color-brand-primary)] mb-1">Supplier Name *</label>
                               <input type="text" className="w-full border border-emerald-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-accent)] font-bold" value={newSupplierData.name} onChange={e=>setNewSupplierData({...newSupplierData, name: e.target.value})} />
                            </div>
                            <div>
                               <label className="block text-xs font-bold text-[var(--color-brand-primary)] mb-1">Shop / Business Name</label>
                               <input type="text" className="w-full border border-emerald-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-accent)]" value={newSupplierData.shopName} onChange={e=>setNewSupplierData({...newSupplierData, shopName: e.target.value})} />
                            </div>
                          </div>
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-[var(--color-brand-primary)] mb-1">Phone Number</label>
                           <input type="text" className="w-full border border-emerald-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-accent)]" value={newSupplierData.phone} onChange={e=>setNewSupplierData({...newSupplierData, phone: e.target.value})} />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-[var(--color-brand-primary)] mb-1">City</label>
                           <input type="text" className="w-full border border-emerald-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-accent)]" value={newSupplierData.city} onChange={e=>setNewSupplierData({...newSupplierData, city: e.target.value})} />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-[var(--color-brand-primary)] mb-1">Address</label>
                           <input type="text" className="w-full border border-emerald-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-accent)]" value={newSupplierData.address} onChange={e=>setNewSupplierData({...newSupplierData, address: e.target.value})} />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-[var(--color-brand-primary)] mb-1">Opening Udhar</label>
                           <input type="number" className="w-full border border-emerald-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-accent)]" placeholder="0" value={newSupplierData.openingBalance} onChange={e=>setNewSupplierData({...newSupplierData, openingBalance: e.target.value})} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 2: Logistics & Attachments */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-black text-slate-800 mb-4 border-b border-slate-100 pb-2 text-lg">2. Delivery & Attachments</h3>
                    <div className="grid grid-cols-3 gap-5">
                      <div>
                         <label className="block text-sm font-bold text-slate-700 mb-1.5">Truck / Vehicle No</label>
                         <input 
                           type="text" placeholder="FSD-8822"
                           className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-accent)]"
                           value={formData.truckNumber} onChange={e => setFormData({...formData, truckNumber: e.target.value})}
                         />
                      </div>
                      <div>
                         <label className="block text-sm font-bold text-slate-700 mb-1.5">Driver Contact</label>
                         <input 
                           type="text" placeholder="0300-XXXXXXX"
                           className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-accent)]"
                           value={formData.driverPhone} onChange={e => setFormData({...formData, driverPhone: e.target.value})}
                         />
                      </div>
                      <div>
                         <label className="block text-sm font-bold text-slate-700 mb-1.5">Attach Bill Image</label>
                         <label className="flex items-center gap-2 cursor-pointer w-full border border-dashed border-emerald-300 bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2.5 text-sm font-bold hover:bg-emerald-100 transition-colors">
                           <ImageIcon size={16} /> 
                           {formData.billImage ? 'Image Attached' : 'Upload Image'}
                           <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                         </label>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Advanced Dynamic Items */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
                      <h3 className="font-black text-slate-800 text-lg">3. Purchased Items</h3>
                      <button onClick={addItemRow} className="text-[var(--color-brand-accent)] font-bold text-sm hover:underline flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg"><Plus size={14}/> Add Row</button>
                    </div>
                    
                    {purchaseItems.length === 0 ? (
                       <div className="text-center p-5 text-slate-400 font-medium bg-slate-50 border border-dashed border-slate-200 rounded-lg">Click "Add Row" to attach inventory items to this bill.</div>
                    ) : (
                      <div className="space-y-4">
                        {purchaseItems.map((item, idx) => {
                          const pRate = parseFloat(item.rate) || 0;
                          const sRate = parseFloat(item.newItemDetails?.sellingPrice) || 0;
                          const calcMargin = sRate - pRate;
                          const userMargin = parseFloat(item.newItemDetails?.sellingMargin) || 0;
                          const showMarginWarning = item.isNewItem && sRate > 0 && pRate > 0 && calcMargin !== userMargin;
                          const weights = parseBagWeights(item.bagWeightsText || item.bagWeights);
                          const actualQuantity = getItemQuantity(item);
                          const inv = selectedInventory(item);
                          const rateNote = purchaseRateNote(item);
                          
                          const derivedBags = item.bagWeightsText ? weights.length || '' : item.bags;
                          const derivedWeightPerBag = item.bagWeightsText && weights.length > 0 ? (actualQuantity / weights.length).toFixed(2) : item.weightPerBag;

                          return (
                          <div key={idx} className="flex flex-col gap-2 p-4 bg-slate-50 border border-slate-200 rounded-lg relative">
                            <button onClick={() => removeItemRow(idx)} className="absolute top-2 right-2 p-1.5 text-rose-400 hover:bg-rose-100 rounded-md"><Trash2 size={14}/></button>
                            
                            <div className="grid grid-cols-12 gap-3 pr-8">
                              <div className="col-span-4">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Variant (Inventory Link) *</label>
                                {item.isNewItem ? (
                                  <div className="flex gap-2">
                                    <input type="text" placeholder="Item Name (e.g. P.C Koh)" className="w-full border border-emerald-300 bg-emerald-50 rounded-md px-2 py-1.5 text-sm outline-none focus:border-[var(--color-brand-accent)] font-bold" value={item.newItemDetails?.variant || ''} onChange={e => updateItemRow(idx, 'newItemDetails', {...(item.newItemDetails || {}), variant: e.target.value})} />
                                    <button onClick={() => { updateItemRow(idx, 'isNewItem', false); updateItemRow(idx, 'newItemDetails', null); }} className="text-slate-400 hover:text-rose-500"><X size={14}/></button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1 items-center">
                                    <select 
                                      className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm outline-none focus:border-[var(--color-brand-accent)] font-bold"
                                      value={item.inventoryItemId} onChange={e => updateItemRow(idx, 'inventoryItemId', e.target.value)}
                                    >
                                      <option value="">-- Select Existing Item --</option>
                                      {inventoryItems.map(inv => <option key={inv.id} value={inv.id}>{inv.variant} ({inv.category})</option>)}
                                    </select>
                                    <button onClick={() => updateItemRow(idx, 'isNewItem', true)} className="text-[var(--color-brand-accent)] hover:bg-emerald-50 p-1.5 rounded-md border border-emerald-200" title="Create New Item"><Plus size={14}/></button>
                                  </div>
                                )}
                              </div>
                              <div className="col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bags/Qty *</label>
                                <input type="number" placeholder="10" className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm outline-none font-bold text-center disabled:bg-slate-100 disabled:text-slate-400"
                                  value={derivedBags} onChange={e => updateItemRow(idx, 'bags', e.target.value)} disabled={!!item.bagWeightsText} />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Wt/Bag *</label>
                                <input type="number" placeholder="45.36" className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm outline-none font-bold text-center disabled:bg-slate-100 disabled:text-slate-400"
                                  value={derivedWeightPerBag} onChange={e => updateItemRow(idx, 'weightPerBag', e.target.value)} disabled={!!item.bagWeightsText} />
                              </div>
                              <div className="col-span-4">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Actual Bag Weights</label>
                                <input type="text" placeholder="e.g. 89, 91, 87" className="w-full border border-amber-200 bg-amber-50 rounded-md px-2 py-1.5 text-sm outline-none font-bold"
                                  value={item.bagWeightsText || ''} onChange={e => updateItemRow(idx, 'bagWeightsText', e.target.value)} />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Purch. Rate *</label>
                                <input type="number" placeholder="Rate" className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm outline-none font-bold text-center"
                                  value={item.rate} onChange={e => updateItemRow(idx, 'rate', e.target.value)} />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unit</label>
                                <select className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm outline-none font-bold"
                                  value={item.unit} onChange={e => updateItemRow(idx, 'unit', e.target.value)}>
                                  <option value="Kg">Kg</option>
                                  <option value="Lbs">Lbs</option>
                                  <option value="Piece">Piece</option>
                                  <option value="Bundle">Bundle</option>
                                  <option value="Bag">Bag</option>
                                  <option value="Roll">Roll</option>
                                </select>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-12 gap-3 pr-8 mt-1 items-end">
                              <div className="col-span-8">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quality / Notes / Lot #</label>
                                <input type="text" placeholder="Excellent quality, lot #55..." className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs outline-none"
                                  value={item.note} onChange={e => updateItemRow(idx, 'note', e.target.value)} />
                              </div>
                              <div className="col-span-4 flex justify-between items-center bg-white border border-slate-200 rounded-md px-3 py-1.5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Item Total:</span>
                                <span className="text-sm font-black text-slate-800">Rs {calculateLineTotal(item).toLocaleString()}</span>
                              </div>
                            </div>

                            {!item.isNewItem && inv && (
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pr-8 mt-2">
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-xs"><b>Prev Rate:</b> Rs {Number(inv.purchaseRate || 0).toLocaleString()}</div>
                                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-xs"><b>Stock:</b> {Number(inv.quantity || 0).toLocaleString()} {inv.unit}</div>
                                <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs"><b>Maal Value:</b> Rs {(Number(inv.quantity || 0) * Number(inv.purchaseRate || 0)).toLocaleString()}</div>
                                <div className="bg-purple-50 border border-purple-100 rounded-lg p-2 text-xs"><b>Qty This Bill:</b> {actualQuantity.toLocaleString()} {item.unit}</div>
                                {rateNote && <div className={`md:col-span-4 rounded-lg p-2 text-xs font-bold border ${rateNote.type === 'high' ? 'bg-amber-50 text-amber-700 border-amber-200' : rateNote.type === 'low' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{rateNote.text}</div>}
                                {weights.length > 0 && <div className="md:col-span-4 bg-white border border-amber-200 rounded-lg p-2 text-xs"><b>Varied Bags:</b> {weights.join(' + ')} = <b>{actualQuantity.toLocaleString()} {item.unit}</b></div>}
                              </div>
                            )}

                            {item.isNewItem && (
                              <div className="grid grid-cols-4 gap-3 bg-emerald-50 p-3 rounded-lg border border-emerald-200 mt-2 relative">
                                {showMarginWarning && (
                                  <div className="absolute -top-3 right-2 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 border border-amber-200">
                                    <AlertTriangle size={12}/> Calc Margin is {calcMargin}, but you entered {userMargin}. Confirm?
                                  </div>
                                )}
                                <div>
                                   <label className="block text-[10px] font-bold text-[var(--color-brand-primary)] uppercase mb-1">Category</label>
                                   <input list={`purchase-categories-${idx}`} className="w-full border border-emerald-200 rounded-md px-2 py-1.5 text-sm outline-none bg-white font-bold" placeholder="Type custom category" value={item.newItemDetails?.category || ''} onChange={e => updateItemRow(idx, 'newItemDetails', {...(item.newItemDetails || {}), category: e.target.value})} />
                                   <datalist id={`purchase-categories-${idx}`}>
                                     {['PC','PV','Cotton','Staple','Miscellaneous Threads','Packaging & Supplies','Yarn','Thread','Bardanay','Fabric','Koh','Lounge','Other'].map(c => <option key={c} value={c} />)}
                                   </datalist>
                                </div>
                                <div>
                                   <label className="block text-[10px] font-bold text-[var(--color-brand-primary)] uppercase mb-1">Sale Rate / unit optional</label>
                                   <input type="number" placeholder="160" className="w-full border border-emerald-200 rounded-md px-2 py-1.5 text-sm outline-none bg-white" value={item.newItemDetails?.sellingPrice || ''} onChange={e => updateItemRow(idx, 'newItemDetails', {...(item.newItemDetails || {}), sellingPrice: e.target.value})} />
                                </div>
                                <div>
                                   <label className="block text-[10px] font-bold text-[var(--color-brand-primary)] uppercase mb-1">Yarn Count</label>
                                   <input type="text" placeholder="20 / 30 / 40" className="w-full border border-emerald-200 bg-white rounded-md px-2 py-1.5 text-sm outline-none" value={item.newItemDetails?.yarnCount || ''} onChange={e => updateItemRow(idx, 'newItemDetails', {...(item.newItemDetails || {}), yarnCount: e.target.value})} />
                                </div>
                                <div>
                                   <label className="block text-[10px] font-bold text-[var(--color-brand-primary)] uppercase mb-1">Extra Specs</label>
                                   <input type="text" placeholder="Colors, quality, etc" className="w-full border border-emerald-200 rounded-md px-2 py-1.5 text-sm outline-none bg-white" value={item.newItemDetails?.notes || ''} onChange={e => updateItemRow(idx, 'newItemDetails', {...(item.newItemDetails || {}), notes: e.target.value})} />
                                </div>
                                <div>
                                   <label className="block text-[10px] font-bold text-[var(--color-brand-primary)] uppercase mb-1">Mill / Brand</label>
                                   <input type="text" placeholder="KHADDAR" className="w-full border border-emerald-200 rounded-md px-2 py-1.5 text-sm outline-none bg-white" value={item.newItemDetails?.millName || ''} onChange={e => updateItemRow(idx, 'newItemDetails', {...(item.newItemDetails || {}), millName: e.target.value})} />
                                </div>
                                <div>
                                   <label className="block text-[10px] font-bold text-[var(--color-brand-primary)] uppercase mb-1">Lot / Batch</label>
                                   <input type="text" placeholder="LOT-321" className="w-full border border-emerald-200 rounded-md px-2 py-1.5 text-sm outline-none bg-white" value={item.newItemDetails?.lotNumber || ''} onChange={e => updateItemRow(idx, 'newItemDetails', {...(item.newItemDetails || {}), lotNumber: e.target.value})} />
                                </div>
                                <div>
                                   <label className="block text-[10px] font-bold text-[var(--color-brand-primary)] uppercase mb-1">Wt/Unit</label>
                                   <input type="number" placeholder="45.36" className="w-full border border-emerald-200 rounded-md px-2 py-1.5 text-sm outline-none bg-white" value={item.newItemDetails?.weightPerUnit || ''} onChange={e => updateItemRow(idx, 'newItemDetails', {...(item.newItemDetails || {}), weightPerUnit: e.target.value})} />
                                </div>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Section 4: Discount & Payment Summary */}
                  <div className="bg-slate-800 p-6 rounded-xl shadow-md text-white">
                    <h3 className="font-black text-[var(--color-brand-accent)] mb-4 border-b border-slate-700 pb-2 text-lg flex items-center gap-2"><DollarSign size={20}/> 4. Payment & Discount Automation</h3>
                    
                    <div className="grid grid-cols-4 gap-4 mb-4 pb-4 border-b border-slate-700">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Discount Type</label>
                        <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-[var(--color-brand-accent)] text-sm font-bold"
                          value={formData.discountType} onChange={e => setFormData({...formData, discountType: e.target.value})}>
                          <option value="FIXED">Fixed Amount</option>
                          <option value="PER_UNIT">Per Unit/Kg</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Total Discount</label>
                        <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-[var(--color-brand-accent)] text-sm font-bold text-rose-400"
                          value={formData.totalDiscount} onChange={e => setFormData({...formData, totalDiscount: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Payment Method</label>
                        <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-[var(--color-brand-accent)] text-sm font-bold"
                          value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                          <option value="CASH">Cash</option>
                          <option value="BANK">Bank Transfer</option>
                          <option value="CHEQUE">Cheque</option>
                          <option value="EASYPAISA">EasyPaisa/JazzCash</option>
                          <option value="CREDIT">Full Credit (Udhaar)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Payment Status</label>
                        <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-[var(--color-brand-accent)] text-sm font-bold"
                          value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value})}>
                          <option value="UNPAID">Unpaid</option>
                          <option value="PARTIAL">Partial Payment</option>
                          <option value="PAID">Fully Paid</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-6 items-end">
                       <div>
                         <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Gross Total</label>
                         <div className="text-xl font-black font-heading text-slate-300">Rs {grossTotal.toLocaleString()}</div>
                       </div>
                       <div>
                         <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Net Total</label>
                         <div className="text-xl font-black font-heading text-white">Rs {netTotal.toLocaleString()}</div>
                       </div>
                       <div>
                         <label className="block text-xs font-bold text-emerald-400 mb-1.5 uppercase">Amount Paid Now</label>
                         <input 
                           type="number"
                           className="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 outline-none focus:border-emerald-400 font-bold text-emerald-300 text-lg"
                           value={formData.amountPaid} onChange={e => setFormData({...formData, amountPaid: e.target.value})}
                         />
                       </div>
                       <div>
                         <label className="block text-xs font-bold text-[var(--color-brand-accent)] mb-1.5 uppercase">Remaining Udhar</label>
                         <div className="text-2xl font-black text-[var(--color-brand-accent)] font-heading">Rs {balanceDue.toLocaleString()}</div>
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {!isDetailView && (
              <div className="p-6 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                <button onClick={() => setIsDrawerOpen(false)} className="px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors">Cancel</button>
                <button onClick={handleSave} className="bg-[var(--color-brand-accent)] hover:bg-[var(--color-brand-accent-hover)] text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-lg">
                  <Save size={18} /> Save & Process Invoice
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
