import { useState, useEffect, useRef } from 'react';
import { Search, Printer, ShoppingCart, Trash2, Edit, CheckCircle2, ChevronDown, ChevronUp, X, UserPlus, MessageCircle } from 'lucide-react';
import { InvoicePrint } from './InvoicePrint';

const API_BASE = (((window as any).__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:5000') as string).replace(/\/$/, '');


interface Party { id: number; name: string; outstanding: number; phone?: string; shopName?: string; city?: string; address?: string; }
interface InventoryItem { id: number; variant: string; category: string; millName?: string; lotNumber?: string; quantity: number; sellingPrice: number; weightPerUnit?: number; unit: string; purchaseRate?: number; bagBreakdown?: any[]; }
interface CartItem { id: number; inventoryItemId: number; item: string; lot: string; bags: number; weightPerBag: number; totalWeight: number; unit: string; rate: number; total: number; note: string; selectedBagIds?: number[]; }

export default function POSScreen() {
  const [parties, setParties] = useState<Party[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [_summary, setSummary] = useState({ todaySales: 0, cashReceived: 0, todayUdhar: 0, itemsSold: 0, lowStockCount: 0 });
  
  // Search and Filter State
  const [searchItem, setSearchItem] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Customer State
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerExpanded, setIsCustomerExpanded] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', shopName: '', city: '', address: '', openingBalance: '0' });

  // Bill State
  const [discount, setDiscount] = useState<string>('');
  const [freight, setFreight] = useState<string>('');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // Modal State for adding item
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [inputBags, setInputBags] = useState('');
  const [inputWeightPerBag, setInputWeightPerBag] = useState('');
  const [inputTotalWeight, setInputTotalWeight] = useState('');
  const [inputUnit, setInputUnit] = useState('Kg');
  const [inputRate, setInputRate] = useState('');
  const [inputNote, setInputNote] = useState('');
  const [selectedBagIds, setSelectedBagIds] = useState<number[]>([]);
  const [editingCartId, setEditingCartId] = useState<number | null>(null);

  // Print & Success Modal State
  const printRef = useRef<HTMLDivElement>(null);
  const [lastSale, setLastSale] = useState<any>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load local draft on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('pos_cart');
    const savedCustomer = localStorage.getItem('pos_customer');
    if (savedCart) setCart(JSON.parse(savedCart));
    if (savedCustomer) setSelectedParty(JSON.parse(savedCustomer));

    fetchData();
    fetchSummary();
  }, []);

  // Save drafts
  useEffect(() => {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (selectedParty) {
      localStorage.setItem('pos_customer', JSON.stringify(selectedParty));
    } else {
      localStorage.removeItem('pos_customer');
    }
  }, [selectedParty]);

  const fetchData = async () => {
    try {
      const pRes = await fetch(`${API_BASE}/api/customers`);
      if (pRes.ok) setParties(await pRes.json());
      
      const iRes = await fetch(`${API_BASE}/api/pos/recent-items`);
      if (iRes.ok) {
        const data = await iRes.json();
        setInventory(data.items || []);
      } else {
        console.error("Failed to load recent items, Status:", iRes.status);
      }
    } catch (err) {
      console.error("Fetch Data Error:", err);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/pos/today-summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary || { todaySales: 0, cashReceived: 0, todayUdhar: 0, itemsSold: 0, lowStockCount: 0 });
      } else {
        console.error("Failed to fetch summary, Status:", res.status);
      }
    } catch (err) {
      console.error("Fetch Summary Error:", err);
    }
  };

  const handleItemSearch = (val: string) => {
    setSearchItem(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    
    setIsSearching(true);
    searchDebounce.current = setTimeout(async () => {
      try {
        let res;
        if (val.trim() === '') {
          res = await fetch(`${API_BASE}/api/pos/recent-items`);
        } else {
          res = await fetch(`${API_BASE}/api/pos/items/search?q=${encodeURIComponent(val)}`);
        }
        
        if (!res.ok) {
          console.error("POS Search API returned status:", res.status);
          alert("Inventory search API not available. Please check backend.");
          return;
        }

        const data = await res.json();
        setInventory(data.items || []);
      } catch (err) {
        console.error("POS Search Error:", err);
        alert("Inventory search API not available. Please check backend.");
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  // --- Customer Handlers ---
  const filteredParties = customerSearch.length > 0 
    ? parties.filter(p => p.name.toLowerCase().includes(customerSearch.toLowerCase()) || p.phone?.includes(customerSearch) || p.shopName?.toLowerCase().includes(customerSearch.toLowerCase()))
    : [];

  const handleQuickAddCustomer = async () => {
    if (!customerForm.name) return alert("Name is required");
    try {
      const res = await fetch(`${API_BASE}/api/customers/quick-add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerForm)
      });
      const newCust = await res.json();
      if (newCust.error) return alert(newCust.error);
      
      setParties([newCust, ...parties]);
      setSelectedParty(newCust);
      setIsNewCustomer(false);
      setCustomerSearch('');
    } catch (err) {
      alert("Failed to add customer");
    }
  };

  // --- Add Item Handlers ---
  const handleOpenModal = (item: InventoryItem, cartItemToEdit?: CartItem) => {
    if (item.quantity <= 0 && !cartItemToEdit) {
       alert("Out of stock!");
       return;
    }
    setSelectedItem(item);
    
    if (cartItemToEdit) {
      setInputBags(cartItemToEdit.bags ? cartItemToEdit.bags.toString() : '');
      setInputWeightPerBag(cartItemToEdit.weightPerBag ? cartItemToEdit.weightPerBag.toString() : '');
      setInputTotalWeight(cartItemToEdit.totalWeight ? cartItemToEdit.totalWeight.toString() : '');
      setInputUnit(cartItemToEdit.unit);
      setInputRate(cartItemToEdit.rate.toString());
      setInputNote(cartItemToEdit.note);
      setSelectedBagIds(cartItemToEdit.selectedBagIds || []);
      setEditingCartId(cartItemToEdit.id);
    } else {
      setInputBags('');
      setInputWeightPerBag('');
      setInputTotalWeight('');
      setInputUnit(item.unit || 'Kg');
      setInputRate(item.sellingPrice.toString());
      setInputNote('');
      setSelectedBagIds([]);
      setEditingCartId(null);
    }
    setModalOpen(true);
  };

  const toggleBagSelection = (bag: any) => {
    let newSelected = [...selectedBagIds];
    if (newSelected.includes(bag.id)) {
       newSelected = newSelected.filter(id => id !== bag.id);
    } else {
       newSelected.push(bag.id);
    }
    setSelectedBagIds(newSelected);
    
    // Auto update total weight and bags
    if (newSelected.length > 0) {
       const sumWeight = newSelected.reduce((acc, id) => {
          const b = selectedItem?.bagBreakdown?.find((x:any) => x.id === id);
          return acc + (b ? parseFloat(b.weight) : 0);
       }, 0);
       setInputTotalWeight(sumWeight.toFixed(2));
       setInputBags(newSelected.length.toString());
       setInputWeightPerBag((sumWeight / newSelected.length).toFixed(2));
    }
  };

  // Removed aggressive auto-calculation effect to prevent overwriting manual Total Weight input


  const handleAddToCart = () => {
    if (!selectedItem) return;
    const bags = parseFloat(inputBags) || 0;
    const weightPerBag = parseFloat(inputWeightPerBag) || 0;
    const rate = parseFloat(inputRate) || 0;
    const totalWeight = parseFloat(inputTotalWeight) || 0;
    
    if (totalWeight <= 0) return alert("Total weight/quantity must be greater than 0");
    if (rate <= 0) return alert("Rate must be greater than 0");
    
    // Check stock validation (ignore if editing same item)
    const currentCartQty = editingCartId ? 0 : cart.filter(c => c.inventoryItemId === selectedItem.id).reduce((acc, c) => acc + c.totalWeight, 0);
    if ((totalWeight + currentCartQty) > selectedItem.quantity) {
       if(!window.confirm(`Warning: You are adding more than available stock (${selectedItem.quantity} ${selectedItem.unit}). Proceed anyway?`)) {
          return;
       }
    }

    const newItem = {
      id: editingCartId || Date.now(),
      inventoryItemId: selectedItem.id,
      item: selectedItem.variant + (selectedItem.millName ? ` - ${selectedItem.millName}` : ''),
      lot: selectedItem.lotNumber || '-',
      bags,
      weightPerBag,
      totalWeight: Number(totalWeight.toFixed(2)),
      unit: inputUnit,
      rate,
      total: totalWeight * rate,
      note: inputNote,
      selectedBagIds: selectedBagIds.length > 0 ? selectedBagIds : undefined
    };

    if (editingCartId) {
      setCart(cart.map(c => c.id === editingCartId ? newItem : c));
    } else {
      // Check if item already exists
      const exists = cart.find(c => c.inventoryItemId === selectedItem.id && c.rate === rate);
      if (exists) {
         if (window.confirm("Item already in cart at this rate. Add as separate line? (Cancel to combine)")) {
            setCart([...cart, newItem]);
         } else {
            setCart(cart.map(c => c.id === exists.id ? {...c, bags: c.bags + bags, totalWeight: c.totalWeight + totalWeight, total: (c.totalWeight + totalWeight) * rate} : c));
         }
      } else {
         setCart([...cart, newItem]);
      }
    }
    
    setModalOpen(false);
    setSelectedItem(null);
  };

  // --- Bill Calculations ---
  const parsedDiscount = parseFloat(discount) || 0;
  const parsedFreight = parseFloat(freight) || 0;
  const parsedAmountPaid = parseFloat(amountPaidInput) || 0;

  const subtotal = cart.reduce((acc, c) => acc + c.total, 0);
  const grandTotal = subtotal - parsedDiscount + parsedFreight;
  const balanceDue = grandTotal - parsedAmountPaid;

  const handleCheckout = async () => {
    if (!selectedParty) return alert("Please select or add a Customer.");
    if (cart.length === 0) return alert("Cart is empty");
    if (balanceDue > 0 && selectedParty.name.toLowerCase() === 'walk in') {
      if(!window.confirm("Walk-in customer has Udhar remaining. Are you sure?")) return;
    }

    try {
      const payload: any = {
        partyId: selectedParty.id,
        items: cart.map(c => ({ 
          inventoryItemId: c.inventoryItemId, 
          quantity: c.totalWeight, 
          rate: c.rate,
          bags: c.bags,
          weightPerBag: c.weightPerBag,
          unit: c.unit,
          note: c.note,
          selectedBagIds: c.selectedBagIds
        })),
        discount: parsedDiscount,
        freight: parsedFreight,
        amountPaid: parsedAmountPaid,
        paymentMethod
      };

      const res = await fetch(`${API_BASE}/api/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.error) {
         return alert("Checkout Error: " + data.error);
      }

      setLastSale({ ...data, _sessionAmountPaid: parsedAmountPaid });
      setSuccessModalOpen(true);
      
      // Clear session
      setCart([]);
      setSelectedParty(null);
      setDiscount('');
      setFreight('');
      setAmountPaidInput('');
      localStorage.removeItem('pos_cart');
      localStorage.removeItem('pos_customer');
      
      fetchData();
      fetchSummary();
    } catch (e) {
      alert("Error processing sale");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        handleCheckout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, selectedParty, discount, freight, amountPaidInput, paymentMethod]);

  const clearCart = () => {
    if (window.confirm("Are you sure you want to clear the entire cart?")) {
      setCart([]);
      localStorage.removeItem('pos_cart');
    }
  };



  const shareLastSaleWhatsApp = () => {
    if (!lastSale) return;
    const phone = String(lastSale.party?.phone || '').replace(/\D/g, '');
    const itemsText = (lastSale.Items || []).map((i: any) => {
      let bagText = ``;
      try {
        if (i.bagWeights) {
          const w = typeof i.bagWeights === 'string' ? JSON.parse(i.bagWeights) : i.bagWeights;
          if (Array.isArray(w) && w.length > 0) bagText = `\n  Bags: ${w.length} (${w.join(', ')})`;
        }
      } catch(e) {}
      return `${i.inventoryItem?.variant || 'Item'} - ${Number(i.quantity || 0).toFixed(2)} ${i.unit || 'kg'} @ Rs ${Number(i.rate || 0).toLocaleString()} = Rs ${Number(i.total || 0).toLocaleString()}${bagText}`;
    }).join('\n');
    const paid = Number(lastSale._sessionAmountPaid || 0);
    const remaining = Math.max(0, Number(lastSale.amount || 0) - paid);
    const text = encodeURIComponent(`IQBAL JUTT TRADER\nInvoice: ${lastSale.invoiceId || lastSale.id}\nCustomer: ${lastSale.party?.name || '-'}\n\n${itemsText}\n\nGrand Total: Rs ${Number(lastSale.amount || 0).toLocaleString()}\nPaid/Jama: Rs ${paid.toLocaleString()}\nRemaining Udhar: Rs ${remaining.toLocaleString()}\n\nThank you.`);
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const categories = ['All', ...Array.from(new Set(inventory.map(i => i.category)))];
  const displayedInventory = selectedCategory === 'All' ? inventory : inventory.filter(i => i.category === selectedCategory);

  return (
    <div className="pos-screen max-w-[1800px] mx-auto pb-28 lg:pb-6 min-h-0 lg:h-[calc(100vh-20px)] flex flex-col relative bg-slate-50 overflow-y-auto lg:overflow-hidden print:h-auto print:overflow-visible pt-2 lg:pt-4">
      
      <div className="pos-workspace flex flex-col lg:flex-row gap-3 lg:gap-4 flex-1 lg:h-[calc(100vh-60px)] px-2 sm:px-4 print:hidden">
        
        {/* 1. LEFT PANEL: Customer (25%) */}
        <div className="pos-customer-panel w-full lg:w-1/4 flex flex-col gap-3 lg:gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
               <h2 className="font-bold text-slate-800 flex items-center gap-2"><UserPlus size={18} className="text-indigo-600"/> Customer Info</h2>
               {selectedParty && (
                 <button onClick={() => setSelectedParty(null)} className="text-xs font-bold text-rose-500 hover:text-rose-700">Clear</button>
               )}
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
              {!selectedParty ? (
                <>
                  {!isNewCustomer ? (
                    <div className="space-y-4">
                      <div className="relative">
                        <div className="flex items-center border border-slate-300 rounded-lg px-3 py-2 bg-white focus-within:border-indigo-500">
                          <Search size={16} className="text-slate-400 mr-2" />
                          <input 
                            type="text" autoFocus
                            placeholder="Search name, phone, shop..." 
                            value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                            className="bg-transparent outline-none w-full text-sm font-medium" 
                          />
                        </div>
                        {customerSearch && (
                          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg z-20 max-h-60 overflow-y-auto">
                            {filteredParties.length === 0 ? (
                              <div className="p-3 text-sm text-slate-500 text-center">No results found</div>
                            ) : (
                              filteredParties.map(p => (
                                <div key={p.id} onClick={() => { setSelectedParty(p); setCustomerSearch(''); }} className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 flex flex-col">
                                  <div className="flex justify-between items-center"><span className="font-bold text-slate-800">{p.name}</span> <span className={`text-xs font-bold ${p.outstanding > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>Rs {Math.abs(p.outstanding)} {p.outstanding > 0 ? 'Dr' : 'Cr'}</span></div>
                                  <span className="text-[10px] text-slate-500">{p.phone || '-'} • {p.shopName || '-'}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-xs font-bold text-slate-400 uppercase">OR</span>
                         <button onClick={() => setIsNewCustomer(true)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800">+ Quick Add New</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 animate-in fade-in zoom-in duration-200">
                       <button onClick={() => setIsNewCustomer(false)} className="text-xs font-bold text-slate-500 hover:text-slate-700 mb-2">&larr; Back to Search</button>
                       <input type="text" placeholder="Customer Name *" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500" value={customerForm.name} onChange={e=>setCustomerForm({...customerForm, name: e.target.value})} />
                       <input type="text" placeholder="Phone Number" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" value={customerForm.phone} onChange={e=>setCustomerForm({...customerForm, phone: e.target.value})} />
                       <input type="text" placeholder="Shop Name" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" value={customerForm.shopName} onChange={e=>setCustomerForm({...customerForm, shopName: e.target.value})} />
                       <div className="grid grid-cols-2 gap-2">
                         <input type="text" placeholder="City" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" value={customerForm.city} onChange={e=>setCustomerForm({...customerForm, city: e.target.value})} />
                         <input type="number" placeholder="Open Udhar" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-500" value={customerForm.openingBalance} onChange={e=>setCustomerForm({...customerForm, openingBalance: e.target.value})} />
                       </div>
                       <button onClick={handleQuickAddCustomer} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg mt-2 transition-colors">Add Customer</button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                     <div>
                       <h3 className="text-xl font-black text-slate-800">{selectedParty.name}</h3>
                       {selectedParty.shopName && <p className="text-sm font-bold text-slate-500">{selectedParty.shopName}</p>}
                     </div>
                     <div className={`px-2 py-1 rounded text-xs font-black border ${selectedParty.outstanding > 0 ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                       Rs {Math.abs(selectedParty.outstanding).toLocaleString()} {selectedParty.outstanding > 0 ? 'Udhar' : 'Cr'}
                     </div>
                  </div>
                  
                  <button onClick={() => setIsCustomerExpanded(!isCustomerExpanded)} className="flex items-center gap-1 text-xs font-bold text-indigo-600 w-full justify-center bg-indigo-50 py-1.5 rounded hover:bg-indigo-100">
                    {isCustomerExpanded ? <><ChevronUp size={14}/> Show Less</> : <><ChevronDown size={14}/> Show Details</>}
                  </button>

                  {isCustomerExpanded && (
                    <div className="text-xs text-slate-600 space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                       <p><span className="font-bold text-slate-400 w-16 inline-block">Phone:</span> {selectedParty.phone || 'N/A'}</p>
                       <p><span className="font-bold text-slate-400 w-16 inline-block">City:</span> {selectedParty.city || 'N/A'}</p>
                       <p><span className="font-bold text-slate-400 w-16 inline-block">Address:</span> {selectedParty.address || 'N/A'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. CENTER PANEL: Items (45%) */}
        <div className="pos-items-panel w-full lg:w-[45%] flex flex-col gap-3">
          {/* Smart Search */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 shrink-0 flex items-center gap-3">
            <div className="flex-1 flex items-center border-2 border-indigo-100 rounded-lg px-3 py-2.5 bg-white focus-within:border-indigo-500 transition-colors">
              <Search size={20} className="text-indigo-400 mr-2" />
              <input 
                type="text" 
                placeholder="Search items by name, lot, mill, roman urdu..." 
                value={searchItem} 
                onChange={e => handleItemSearch(e.target.value)}
                className="bg-transparent outline-none w-full text-base font-bold text-slate-800" 
              />
            </div>
          </div>

          {/* Categories */}
          <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar shrink-0 px-1">
             {categories.map(cat => (
               <button 
                 key={cat} 
                 onClick={() => setSelectedCategory(cat)}
                 className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors shadow-sm ${selectedCategory === cat ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
               >
                 {cat}
               </button>
             ))}
          </div>

          {/* Item Grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-10">
             <div className="pos-item-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {displayedInventory.map(item => {
                  let stockColor = "text-emerald-600 bg-emerald-50 border-emerald-200";
                  if (item.quantity <= 0) stockColor = "text-rose-600 bg-rose-50 border-rose-200 opacity-60";
                  else if (item.quantity < 50) stockColor = "text-amber-600 bg-amber-50 border-amber-200";

                  return (
                    <div 
                      key={item.id} 
                      onClick={() => handleOpenModal(item)}
                      className={`bg-white border rounded-xl p-3 cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between h-[120px] ${item.quantity <= 0 ? 'border-rose-100' : 'border-slate-200'}`}
                    >
                      <div>
                        <div className="font-black text-sm text-slate-800 line-clamp-2 leading-tight">{item.variant}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{item.category} • Lot {item.lotNumber || '-'}</div>
                      </div>
                      <div className="flex justify-between items-end mt-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${stockColor}`}>
                           {item.quantity} {item.unit}
                        </span>
                        <span className="font-black text-indigo-700">Rs {item.sellingPrice}</span>
                      </div>
                    </div>
                  )
                })}
                {isSearching && (
                  <div className="col-span-full p-10 flex items-center justify-center text-slate-500 font-bold bg-white rounded-xl border border-slate-200 border-dashed">
                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 mr-3"></span>
                    Searching inventory...
                  </div>
                )}
                {!isSearching && displayedInventory.length === 0 && (
                  <div className="col-span-full p-10 text-center text-slate-500 font-bold bg-white rounded-xl border border-slate-200 border-dashed">
                     No matching inventory item found. Check Inventory or Purchase stock first.
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* 3. RIGHT PANEL: Cart & Checkout (30%) */}
        <div className="pos-cart-panel w-full lg:w-[30%] bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col overflow-hidden relative">
          <div className="bg-slate-800 text-white p-3 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-2 font-bold"><ShoppingCart size={18} /> Current Bill</div>
             <div className="flex items-center gap-3">
               <span className="bg-slate-700 px-2 py-0.5 rounded text-xs font-black">{cart.length} items</span>
               {cart.length > 0 && <button onClick={clearCart} className="text-slate-400 hover:text-white text-xs font-bold transition-colors">Clear</button>}
             </div>
          </div>

          <div className="pos-cart-list flex-1 overflow-y-auto bg-slate-50/50 p-3 space-y-2 custom-scrollbar">
            {cart.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                 <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center"><ShoppingCart size={32} className="text-slate-300"/></div>
                 <p className="font-bold text-sm">Cart is empty</p>
               </div>
            ) : (
               cart.map((c) => (
                 <div key={c.id} className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm relative group">
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenModal(inventory.find(i => i.id === c.inventoryItemId)!, c)} className="p-1 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded"><Edit size={12}/></button>
                      <button onClick={() => setCart(cart.filter(x => x.id !== c.id))} className="p-1 text-slate-400 hover:text-rose-600 bg-slate-50 rounded"><Trash2 size={12}/></button>
                    </div>
                    <div className="font-bold text-sm text-slate-800 line-clamp-1 pr-12">{c.item}</div>
                    <div className="text-[10px] text-slate-500 font-bold mb-1.5 uppercase">Lot: {c.lot}</div>
                    
                    <div className="flex justify-between items-end border-t border-slate-50 pt-1.5">
                       <div className="text-xs text-slate-600 font-medium">
                         <span className="bg-slate-100 px-1 py-0.5 rounded mr-1">{Number(Number(c.totalWeight).toFixed(2))} {c.unit}</span>
                         x Rs {c.rate}
                       </div>
                       <div className="font-black text-slate-800">Rs {c.total.toLocaleString()}</div>
                    </div>
                 </div>
               ))
            )}
          </div>

          {/* Checkout Area */}
          <div className="pos-checkout-area p-3 bg-white border-t border-slate-200 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] z-10">
             <div className="space-y-1 mb-3">
               <div className="flex justify-between text-xs font-bold text-slate-500">
                 <span>Subtotal</span><span>Rs {subtotal.toLocaleString()}</span>
               </div>
               <div className="flex justify-between text-xs font-bold text-slate-500 items-center">
                 <span>Discount</span>
                 <div className="flex items-center border border-slate-200 rounded px-1 w-20 focus-within:border-indigo-400">
                   <span className="text-slate-400">-</span>
                   <input type="number" value={discount} onChange={e=>setDiscount(e.target.value)} className="w-full text-right outline-none bg-transparent font-bold" placeholder="0" />
                 </div>
               </div>
               <div className="flex justify-between text-xs font-bold text-slate-500 items-center">
                 <span>Freight / Mazdoori</span>
                 <div className="flex items-center border border-slate-200 rounded px-1 w-20 focus-within:border-indigo-400">
                   <span className="text-slate-400">+</span>
                   <input type="number" value={freight} onChange={e=>setFreight(e.target.value)} className="w-full text-right outline-none bg-transparent font-bold" placeholder="0" />
                 </div>
               </div>
             </div>

             <div className="flex justify-between items-center text-lg mb-3 pt-2 border-t border-dashed border-slate-300">
               <span className="font-black text-slate-800">Grand Total</span>
               <span className="font-black text-indigo-700 text-xl">Rs {grandTotal.toLocaleString()}</span>
             </div>

             <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 mb-3">
               <div className="flex justify-between items-center mb-2">
                 <span className="text-xs font-bold text-slate-600">Amount Paid</span>
                 <input type="number" value={amountPaidInput} onChange={e=>setAmountPaidInput(e.target.value)} placeholder="0" className="w-24 text-right border border-emerald-300 rounded p-1 text-sm font-black outline-none focus:border-emerald-500 text-emerald-700 shadow-sm" />
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-xs font-bold text-slate-600">Pay Method</span>
                 <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="w-24 border border-slate-200 rounded p-1 text-xs font-bold outline-none text-slate-700">
                   <option value="CASH">Cash</option><option value="BANK">Bank</option><option value="CHEQUE">Cheque</option>
                 </select>
               </div>
               <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-200">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remaining Udhar</span>
                 <span className={`font-black text-sm ${balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>Rs {balanceDue.toLocaleString()}</span>
               </div>
             </div>

             <button 
               onClick={handleCheckout} 
               disabled={cart.length === 0} 
               className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-400 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
             >
               <Printer size={18} /> Generate Bill (F9)
             </button>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      
      {/* Add Item Modal */}
      {modalOpen && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/40 z-[999] flex items-center justify-center backdrop-blur-sm print:hidden p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[500px] max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in duration-200">
            <div className="bg-indigo-600 text-white p-4 flex justify-between items-start">
              <div>
                <h3 className="font-black text-xl font-heading leading-tight">{selectedItem.variant}</h3>
                <p className="text-indigo-100 text-xs mt-1 font-medium">Lot: {selectedItem.lotNumber || '-'} &bull; Mill: {selectedItem.millName || '-'} &bull; Stock: <span className="font-bold text-white bg-indigo-500 px-1 rounded">{selectedItem.quantity} {selectedItem.unit}</span></p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-indigo-200 hover:text-white"><X size={20}/></button>
            </div>
            
            <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Number of Bags (Optional)</label>
                  <input type="number" autoFocus value={inputBags} onChange={e=>{
                     setInputBags(e.target.value);
                     const b = parseFloat(e.target.value) || 0;
                     const w = parseFloat(inputWeightPerBag) || 0;
                     if(b>0 && w>0 && selectedBagIds.length === 0) setInputTotalWeight(parseFloat((b*w).toFixed(2)).toString());
                  }} disabled={selectedBagIds.length > 0} className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-lg font-black outline-none focus:border-indigo-500 transition-colors disabled:bg-slate-100 disabled:text-slate-400" placeholder="0" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Weight Per Bag (Optional)</label>
                  <input type="number" value={inputWeightPerBag} onChange={e=>{
                     setInputWeightPerBag(e.target.value);
                     const b = parseFloat(inputBags) || 0;
                     const w = parseFloat(e.target.value) || 0;
                     if(b>0 && w>0 && selectedBagIds.length === 0) setInputTotalWeight(parseFloat((b*w).toFixed(2)).toString());
                  }} disabled={selectedBagIds.length > 0} className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-lg font-black outline-none focus:border-indigo-500 transition-colors disabled:bg-slate-100 disabled:text-slate-400" placeholder="0" />
                </div>
              </div>

              {selectedItem.bagBreakdown && selectedItem.bagBreakdown.length > 0 && (
                <div className="border border-indigo-100 bg-indigo-50/50 p-4 rounded-xl">
                   <label className="block text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2">Select Specific Bags (Actual Weights)</label>
                   <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                     {selectedItem.bagBreakdown.map((bag: any) => {
                       const isSelected = selectedBagIds.includes(bag.id);
                       // disable if another cart item has already selected it
                       const isAlreadyInCart = !isSelected && cart.some(c => c.selectedBagIds?.includes(bag.id));
                       return (
                         <button
                           key={bag.id}
                           onClick={() => toggleBagSelection(bag)}
                           disabled={isAlreadyInCart}
                           className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : isAlreadyInCart ? 'bg-slate-200 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-100'}`}
                         >
                           {bag.weight} {selectedItem.unit}
                         </button>
                       );
                     })}
                   </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Weight / Quantity</label>
                <div className="flex items-stretch border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-indigo-500 transition-colors">
                  <input type="number" value={inputTotalWeight} onChange={e=>setInputTotalWeight(e.target.value)} disabled={selectedBagIds.length > 0} className="w-full p-2.5 text-xl font-black outline-none disabled:bg-slate-100 disabled:text-slate-400" placeholder="0" />
                  <select value={inputUnit} onChange={e=>setInputUnit(e.target.value)} className="bg-slate-100 px-4 font-black text-slate-700 border-l-2 border-slate-200 outline-none">
                    <option value="Kg">Kg</option>
                    <option value="Lbs">Lbs</option>
                    <option value="Piece">Piece</option>
                    <option value="Bundle">Bundle</option>
                    <option value="Bag">Bag</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rate (Per Unit)</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400 font-bold">Rs</span>
                  <input type="number" value={inputRate} onChange={e=>setInputRate(e.target.value)} className="w-full border-2 border-slate-200 rounded-xl pl-9 p-2.5 text-xl font-black outline-none focus:border-indigo-500 text-indigo-700 transition-colors" placeholder="0" />
                </div>
                {/* Margin Hint */}
                {selectedItem.purchaseRate && parseFloat(inputRate) < selectedItem.purchaseRate && (
                   <p className="text-[10px] text-rose-500 font-bold mt-1">Warning: Rate is below purchase cost (Rs {selectedItem.purchaseRate})</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notes (Optional)</label>
                <input type="text" value={inputNote} onChange={e=>setInputNote(e.target.value)} className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-sm font-medium outline-none focus:border-indigo-500 transition-colors" placeholder="Any details for the bill..." />
              </div>

              <div className="bg-slate-800 p-4 rounded-xl flex justify-between items-center shadow-inner mt-2">
                <span className="font-bold text-slate-300 text-sm uppercase tracking-wider">Item Total Cost</span>
                <span className="font-black text-2xl text-emerald-400">Rs {((parseFloat(inputTotalWeight)||0) * (parseFloat(inputRate)||0)).toLocaleString()}</span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
              <button onClick={handleAddToCart} className="px-8 py-2.5 font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-md">
                 {editingCartId ? 'Update Cart' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Success Modal */}
      {successModalOpen && lastSale && (
        <div className="fixed inset-0 bg-slate-900/60 z-[999] flex items-center justify-center backdrop-blur-sm print:hidden p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden text-center animate-in zoom-in duration-300">
             <div className="bg-emerald-500 p-8 flex flex-col items-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <CheckCircle2 size={56} className="text-white mb-3 relative z-10" />
                <h3 className="text-2xl font-black text-white font-heading relative z-10">Sale Completed!</h3>
                <p className="text-emerald-100 font-bold mt-1 relative z-10">{lastSale.invoiceId || `SALE-${lastSale.id}`}</p>
             </div>
             <div className="p-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 text-left space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-bold">Customer</span>
                    <span className="font-black text-slate-800">{lastSale.party.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-bold">Total Amount</span>
                    <span className="font-black text-indigo-600">Rs {lastSale.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-slate-200 pt-2 mt-2">
                    <span className="text-slate-500 font-bold">Paid</span>
                    <span className="font-black text-emerald-600">Rs {lastSale._sessionAmountPaid.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button onClick={() => window.print()} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md">
                    <Printer size={18} /> Print Invoice
                  </button>
                  <button onClick={shareLastSaleWhatsApp} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md">
                    <MessageCircle size={18} /> Send Receipt on WhatsApp
                  </button>
                  <button onClick={() => setSuccessModalOpen(false)} className="w-full text-slate-500 hover:text-slate-800 font-bold py-2 mt-1">
                    Start New Sale
                  </button>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* Hidden Print Container */}
      <InvoicePrint ref={printRef} sale={lastSale} amountPaidPreview={lastSale?._sessionAmountPaid} />

    </div>
  );
}
