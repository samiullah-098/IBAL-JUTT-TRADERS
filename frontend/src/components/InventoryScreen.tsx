import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Filter, X, Save, Trash2, Edit, Package, Calculator, TrendingUp, ShoppingCart, Percent } from 'lucide-react';
import KPICard from './KPICard';

const API_BASE = (((window as any).__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:5000') as string).replace(/\/$/, '');


export default function InventoryScreen() {
  const predefinedCategories = ['All', 'PC', 'PV', 'Cotton', 'Staple', 'Miscellaneous Threads', 'Packaging & Supplies'];
  const [dynamicCategories, setDynamicCategories] = useState<string[]>(predefinedCategories);
  const [activeTab, setActiveTab] = useState('All');
  
  const [inventory, setInventory] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    category: 'PC', variant: '', yarnCount: '', millName: '', lotNumber: '',
    color: '', weightPerUnit: '', quantity: '0', unit: 'kg', purchaseRate: '0',
    sellingMargin: '0', sellingPrice: '0', reorderLevel: '10', notes: '', actualBagWeights: ''
  });

  const [stats, setStats] = useState({
    totalStockKG: 0,
    totalValuation: 0,
    totalPotentialProfit: 0,
    totalPurchasesAmount: 0,
    totalMargin: 0
  });

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/inventory/stats`);
      const data = await res.json();
      if (data && !data.error) setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch Inventory (Supports Debounce & Category Filter)
  const fetchInventory = async (search = '', category = activeTab) => {
    try {
      let url = `${API_BASE}/api/inventory?category=${category}`;
      if (search) url += `&search=${search}`;
      
      const res = await fetch(url);
      const data = await res.json();
      const items = Array.isArray(data) ? data : [];
      setInventory(items);
      
      if (category === 'All' && !search) {
        const uniqueCats = Array.from(new Set(items.map((i:any) => i.category))).filter(Boolean) as string[];
        const combined = Array.from(new Set([...predefinedCategories, ...uniqueCats]));
        setDynamicCategories(combined);
      }
    } catch (err) {
      console.error("Failed to fetch inventory", err);
    }
  };

  useEffect(() => {
    fetchInventory(searchTerm, activeTab);
    fetchStats();
  }, [activeTab]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      fetchInventory(val, activeTab);
    }, 400); // 400ms debounce
  };

  const openDrawer = (item?: any, detailView = false) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        category: item.category || 'PC', variant: item.variant || '', yarnCount: item.yarnCount || '',
        millName: item.millName || '', lotNumber: item.lotNumber || '', color: item.color || '',
        weightPerUnit: item.weightPerUnit || '', quantity: item.quantity || '0', unit: item.unit || 'kg',
        purchaseRate: item.purchaseRate || '0', sellingMargin: item.sellingMargin || '0',
        sellingPrice: item.sellingPrice || '0',
        reorderLevel: item.reorderLevel || '10', notes: item.notes || '',
        actualBagWeights: item.Bags ? item.Bags.filter((b:any)=>b.status==='IN_STOCK'&&b.source==='MANUAL').map((b: any) => b.weight).join(', ') : ''
      });
    } else {
      setEditingItem(null);
      setFormData({
        category: activeTab !== 'All' ? activeTab : 'PC', variant: '', yarnCount: '', millName: '', lotNumber: '',
        color: '', weightPerUnit: '', quantity: '0', unit: 'kg', purchaseRate: '0',
        sellingMargin: '0', sellingPrice: '0', reorderLevel: '10', notes: '', actualBagWeights: ''
      });
    }
    setIsDetailView(detailView);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setIsDetailView(false);
  };

  const handleSave = async () => {
    try {
      const url = editingItem 
        ? `${API_BASE}/api/inventory/${editingItem.id}` 
        : `${API_BASE}/api/inventory`;
        
      const method = editingItem ? 'PUT' : 'POST';
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      closeDrawer();
      fetchInventory(searchTerm, activeTab);
    } catch (err) {
      console.error("Failed to save", err);
    }
  };

  const handleDelete = async (id: number) => {
    if(!confirm('Are you sure you want to delete this item completely?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/inventory/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
      } else {
        alert(data.error || "Failed to delete item");
      }
      closeDrawer();
      fetchInventory(searchTerm, activeTab);
      fetchStats();
    } catch (err) {
      console.error("Failed to delete", err);
      alert("Failed to delete item");
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto pb-10 relative h-full">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-heading">Advanced Inventory Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage stock levels, yarn counts, lot numbers, and margins</p>
        </div>
        <button 
          onClick={() => openDrawer()}
          className="bg-[#1e293b] hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={16} /> Add New Stock
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <KPICard 
          title="Total Stock" 
          value={`${stats.totalStockKG.toLocaleString()} KG`}
          icon={Package} 
          iconColorClass="text-emerald-500" 
          iconBgClass="bg-emerald-50" 
        />
        <KPICard 
          title="Inventory Valuation" 
          value={`Rs ${stats.totalValuation.toLocaleString()}`}
          icon={Calculator} 
          iconColorClass="text-blue-500" 
          iconBgClass="bg-blue-50" 
        />
        <KPICard 
          title="Potential Profit" 
          value={`Rs ${stats.totalPotentialProfit.toLocaleString()}`}
          icon={TrendingUp} 
          iconColorClass="text-amber-500" 
          iconBgClass="bg-amber-50" 
        />
        <KPICard 
          title="Total Purchases" 
          value={`Rs ${stats.totalPurchasesAmount.toLocaleString()}`}
          icon={ShoppingCart} 
          iconColorClass="text-indigo-500" 
          iconBgClass="bg-indigo-50" 
        />
        <KPICard 
          title="Average Margin" 
          value={`${stats.totalMargin.toFixed(2)}%`}
          icon={Percent} 
          iconColorClass="text-rose-500" 
          iconBgClass="bg-rose-50" 
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden h-[calc(100vh-340px)] flex flex-col">
        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-slate-100 custom-scrollbar shrink-0">
          {dynamicCategories.map((cat, i) => (
            <button 
              key={i}
              onClick={() => setActiveTab(cat)}
              className={`px-6 py-4 text-sm font-bold whitespace-nowrap transition-colors ${activeTab === cat ? 'text-[var(--color-brand-accent)] border-b-2 border-[var(--color-brand-accent)] bg-emerald-50/30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search & Filters */}
        <div className="p-4 flex gap-4 bg-slate-50/50 border-b border-slate-100 shrink-0">
          <div className="flex-1 flex items-center border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm focus-within:border-[var(--color-brand-accent)] focus-within:ring-1 focus-within:ring-[var(--color-brand-accent)] transition-all">
            <Search size={16} className="text-slate-400 mr-2" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Instant Search by variant, lot number, or mill name..." 
              className="bg-transparent outline-none w-full text-sm font-medium text-slate-700" 
            />
          </div>
          <button className="px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-colors">
            <Filter size={16} /> Filters
          </button>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px] sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4">Variant & Details</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Current Stock</th>
                <th className="px-6 py-4">Purchase Rate</th>
                <th className="px-6 py-4 text-[var(--color-brand-accent)]">Margin</th>
                <th className="px-6 py-4">Selling Price</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-slate-400 font-medium">
                    No items found matching your criteria.
                  </td>
                </tr>
              ) : (
                inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-emerald-50/30 transition-colors cursor-pointer group" onClick={() => openDrawer(item, true)}>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{item.variant}</div>
                      <div className="text-[11px] text-slate-500 font-medium flex gap-2 mt-1">
                        {item.lotNumber && <span className="bg-slate-100 px-1.5 rounded text-slate-600 border border-slate-200">Lot: {item.lotNumber}</span>}
                        {item.yarnCount && <span className="text-slate-400">Count: {item.yarnCount}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-bold text-xs">{item.category}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${item.quantity <= item.reorderLevel ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                        {item.quantity} {item.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-600">Rs {item.purchaseRate}</td>
                    <td className="px-6 py-4">
                      <span className="font-black text-[var(--color-brand-accent)]">+{item.sellingMargin}</span>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-800 text-base">Rs {item.sellingPrice}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); openDrawer(item, false); }}
                        className="text-blue-500 font-bold hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Drawer for Add/Edit/View */}
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity" onClick={closeDrawer}></div>
          
          {/* Drawer Panel */}
          <div className="fixed top-0 right-0 h-full w-[500px] bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out border-l border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 font-heading">
                {isDetailView ? 'Item Details' : editingItem ? 'Edit Stock Item' : 'Add New Stock'}
              </h2>
              <div className="flex items-center gap-2">
                {isDetailView && editingItem && (
                   <button onClick={() => setIsDetailView(false)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                     <Edit size={18} />
                   </button>
                )}
                {editingItem && (
                  <button onClick={() => handleDelete(editingItem.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Delete">
                    <Trash2 size={18} />
                  </button>
                )}
                <button onClick={closeDrawer} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {isDetailView && editingItem ? (
                /* View Mode */
                <div className="space-y-6">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Variant Name</h3>
                    <div className="text-2xl font-black text-slate-800 mb-4 font-heading">{editingItem.variant}</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500 block text-xs">Category</span>
                        <span className="font-bold text-slate-700">{editingItem.category}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs">Yarn Count</span>
                        <span className="font-bold text-slate-700">{editingItem.yarnCount || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="border border-slate-100 rounded-xl p-4 shadow-sm">
                        <span className="text-slate-500 block text-xs mb-1">Lot / Batch Number</span>
                        <span className="font-bold text-slate-800">{editingItem.lotNumber || 'N/A'}</span>
                     </div>
                     <div className="border border-slate-100 rounded-xl p-4 shadow-sm">
                        <span className="text-slate-500 block text-xs mb-1">Mill / Brand Name</span>
                        <span className="font-bold text-slate-800">{editingItem.millName || 'N/A'}</span>
                     </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-[var(--color-brand-primary)] mb-4 flex items-center gap-2">Pricing Metrics</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Purchase Rate</span>
                        <span className="font-bold text-slate-800">Rs {editingItem.purchaseRate}</span>
                      </div>
                      <div>
                        <span className="text-[var(--color-brand-accent)] block text-[10px] uppercase font-bold">Custom Margin</span>
                        <span className="font-bold text-[var(--color-brand-primary)]">+{editingItem.sellingMargin}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Selling Price</span>
                        <span className="font-black text-slate-800 text-lg">Rs {editingItem.sellingPrice}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-emerald-100 bg-emerald-50/30 rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-emerald-800 mb-4 flex items-center gap-2">Stock Availability</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-500 block text-xs">Current Quantity</span>
                        <span className="font-black text-emerald-600 text-xl">{editingItem.quantity} <span className="text-sm font-bold">{editingItem.unit}</span></span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs">Reorder Level</span>
                        <span className="font-bold text-rose-500">{editingItem.reorderLevel} {editingItem.unit}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bag Breakdown */}
                  {editingItem.Bags && editingItem.Bags.length > 0 && (
                     <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm mt-4">
                       <h3 className="text-sm font-bold text-slate-800 mb-4">Bag-Wise Stock Breakdown</h3>
                       <div className="overflow-x-auto max-h-60 custom-scrollbar">
                         <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0">
                               <tr>
                                 <th className="px-2 py-2">Bag #</th>
                                 <th className="px-2 py-2">Weight</th>
                                 <th className="px-2 py-2">Status</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                               {editingItem.Bags.map((bag: any, idx: number) => (
                                  <tr key={bag.id}>
                                    <td className="px-2 py-2">Bag {idx + 1}</td>
                                    <td className="px-2 py-2">{bag.weight} {editingItem.unit}</td>
                                    <td className="px-2 py-2">
                                       <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${bag.status === 'SOLD' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                         {bag.status}
                                       </span>
                                    </td>
                                  </tr>
                               ))}
                            </tbody>
                         </table>
                       </div>
                     </div>
                  )}

                  {/* Supplier & Purchase Tracking */}
                  {(editingItem.supplierName || editingItem.lastPurchaseId) && (
                    <div className="border border-indigo-100 bg-indigo-50/30 rounded-xl p-5 shadow-sm">
                      <h3 className="text-sm font-bold text-indigo-700 mb-4">Purchase Tracking</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {editingItem.supplierName && (
                          <div>
                            <span className="text-slate-500 block text-xs">Supplier</span>
                            <span className="font-bold text-slate-700">{editingItem.supplierName}</span>
                          </div>
                        )}
                        {editingItem.lastPurchaseId && (
                          <div>
                            <span className="text-slate-500 block text-xs">Last Purchase ID</span>
                            <span className="font-bold text-indigo-600">{editingItem.lastPurchaseId}</span>
                          </div>
                        )}
                        {editingItem.lastPurchaseDate && (
                          <div>
                            <span className="text-slate-500 block text-xs">Last Purchase Date</span>
                            <span className="font-bold text-slate-700">{new Date(editingItem.lastPurchaseDate).toLocaleDateString()}</span>
                          </div>
                        )}
                        {editingItem.totalPurchaseQuantity > 0 && (
                          <div>
                            <span className="text-slate-500 block text-xs">Total Purchased</span>
                            <span className="font-bold text-blue-600">{editingItem.totalPurchaseQuantity.toLocaleString()} {editingItem.unit}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {editingItem.notes && (
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                      <span className="text-slate-500 block text-xs mb-2 font-bold">Notes</span>
                      <p className="text-sm text-slate-700">{editingItem.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Edit/Add Form Mode */
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4">Basic Details</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Category</label>
                        <input 
                          list="category-options"
                          placeholder="Type or select a category"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-accent)] focus:ring-1 focus:ring-[var(--color-brand-accent)] transition-all bg-white"
                          value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}
                        />
                        <datalist id="category-options">
                          {dynamicCategories.filter(c => c !== 'All').map(c => <option key={c} value={c} />)}
                        </datalist>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Variant Name</label>
                        <input 
                          type="text" placeholder="e.g. Kachi Long" required
                          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-accent)] focus:ring-1 focus:ring-[var(--color-brand-accent)] transition-all bg-white"
                          value={formData.variant} onChange={e => setFormData({...formData, variant: e.target.value})}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">Yarn Count</label>
                          <input 
                            type="text" placeholder="e.g. 20s, 30s"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-accent)] focus:ring-1 focus:ring-[var(--color-brand-accent)] transition-all bg-white"
                            value={formData.yarnCount} onChange={e => setFormData({...formData, yarnCount: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">Color / Shade</label>
                          <input 
                            type="text" placeholder="e.g. Kora, Dyed Blue"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-accent)] focus:ring-1 focus:ring-[var(--color-brand-accent)] transition-all bg-white"
                            value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sourcing */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4">Sourcing & Lot</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Mill / Brand</label>
                        <input 
                          type="text" placeholder="Origin Mill"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-accent)] bg-white"
                          value={formData.millName} onChange={e => setFormData({...formData, millName: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Lot Number</label>
                        <input 
                          type="text" placeholder="e.g. L-10492"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-accent)] bg-white"
                          value={formData.lotNumber} onChange={e => setFormData({...formData, lotNumber: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pricing Logic */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4">Dynamic Pricing</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Purchase Rate (Per {formData.unit || 'Kg'})</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-bold">Rs</span>
                          <input 
                            type="number"
                            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-accent)] font-bold bg-white"
                            value={formData.purchaseRate} onChange={e => setFormData({...formData, purchaseRate: e.target.value})}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Custom Margin</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-[var(--color-brand-accent)] text-sm font-bold">+</span>
                          <input 
                            type="number"
                            className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-accent)] font-bold text-[var(--color-brand-primary)] bg-emerald-50/30"
                            value={formData.sellingMargin} onChange={e => setFormData({...formData, sellingMargin: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 shadow-inner">
                       <label className="block text-slate-300 font-bold text-sm mb-1.5 uppercase tracking-wider">Sale Rate / Selling Price (Per {formData.unit || 'Kg'})</label>
                       <div className="relative">
                         <span className="absolute left-3 top-2 text-slate-400 text-lg font-bold">Rs</span>
                         <input 
                           type="number"
                           className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-white font-black text-xl outline-none focus:border-[var(--color-brand-accent)] transition-colors"
                           value={formData.sellingPrice} onChange={e => setFormData({...formData, sellingPrice: e.target.value})}
                         />
                       </div>
                    </div>
                  </div>

                  {/* Stock Management */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4">Stock Levels</h3>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Actual Bag Weights (Comma Separated)</label>
                      <input 
                        type="text"
                        placeholder="e.g. 45.5, 46.2, 45.0"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500 font-bold bg-white"
                        value={formData.actualBagWeights} 
                        onChange={e => setFormData({...formData, actualBagWeights: e.target.value})}
                      />
                      <p className="text-[10px] text-slate-500 mt-1 font-medium">If provided, total quantity is auto-calculated. For editing, only 'MANUAL' stock bags are replaced.</p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Total Stock Qty / Weight</label>
                        <input 
                          type="number"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500 font-bold bg-white disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                          value={
                             formData.actualBagWeights.trim() 
                               ? formData.actualBagWeights.split(/[,،]+/).reduce((acc, v) => acc + (parseFloat(v.trim()) || 0), 0) 
                               : formData.quantity
                          }
                          onChange={e => setFormData({...formData, quantity: e.target.value})}
                          disabled={!!formData.actualBagWeights.trim()}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Unit</label>
                        <select 
                          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500 font-bold bg-white"
                          value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}
                        >
                          <option>kg</option>
                          <option>bags</option>
                          <option>cones</option>
                          <option>lbs</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Low Stock Alert (Reorder Level)</label>
                      <input 
                        type="number"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-rose-500 font-bold bg-white"
                        value={formData.reorderLevel} onChange={e => setFormData({...formData, reorderLevel: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">Notes / Description</label>
                     <textarea 
                       rows={3}
                       className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-accent)] bg-white resize-none"
                       value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}
                     ></textarea>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {!isDetailView && (
              <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button onClick={closeDrawer} className="px-5 py-2.5 rounded-lg text-slate-600 font-bold hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} className="bg-[var(--color-brand-accent)] hover:bg-[var(--color-brand-accent-hover)] text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-md">
                  <Save size={18} /> {editingItem ? 'Save Changes' : 'Create Item'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
