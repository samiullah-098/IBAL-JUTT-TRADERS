import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, PackageOpen, Boxes, Users, WalletCards, FileText, ShieldCheck, X, Truck, ReceiptText, ClipboardList, BookOpenCheck, UserCog } from 'lucide-react';

export default function Sidebar({ isOpen, setIsOpen, user }: { isOpen?: boolean; setIsOpen?: (val: boolean) => void; user?: any }) {
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: ShoppingCart, label: 'POS & Billing', path: '/pos' },
    { icon: FileText, label: 'Sales Register', path: '/sales' },
    { icon: PackageOpen, label: 'Purchases', path: '/purchases' },
    { icon: Boxes, label: 'Inventory', path: '/inventory' },
    { icon: Truck, label: 'Suppliers', path: '/suppliers' },
    { icon: Users, label: 'Khata & Accounts', path: '/khata-center' },
    { icon: ReceiptText, label: 'Expenses', path: '/expenses' },
    { icon: ClipboardList, label: 'Quotations', path: '/quotations' },
    { icon: BookOpenCheck, label: 'General Ledger', path: '/general-ledger' },
    { icon: WalletCards, label: 'Committees (Besi)', path: '/committees' },
    { icon: FileText, label: 'Reports', path: '/reports' },
    { icon: UserCog, label: 'Staff', path: '/staff' },
    { icon: ShieldCheck, label: 'Settings / RBAC', path: '/settings' },
  ];

  const allowed = (label: string) => user?.role === 'ADMIN' || user?.permissions?.includes('ALL') || user?.permissions?.includes(label);

  return (
    <div className={`fixed inset-y-0 left-0 z-30 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition-transform duration-300 w-[260px] bg-[var(--color-brand-primary)] text-slate-300 flex flex-col h-full overflow-y-auto custom-scrollbar shadow-2xl lg:shadow-none`}>
      {isOpen && <button onClick={() => setIsOpen && setIsOpen(false)} className="absolute top-4 right-4 lg:hidden text-slate-400 hover:text-white"><X size={20} /></button>}
      <div className="flex flex-col items-center justify-center px-6 py-7 border-b border-slate-800/80 text-center gap-3">
        <img src="/logo.png" alt="Logo" className="w-16 h-16 rounded-xl shadow-lg object-cover bg-white p-1" />
        <div>
          <h1 className="text-white font-black text-sm tracking-widest mt-1 uppercase font-heading">IQBAL JUTT</h1>
          <h1 className="text-white font-black text-xs tracking-widest text-[var(--color-brand-accent)] font-heading">TRADER</h1>
          <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">POS & ERP System</p>
        </div>
      </div>
      <div className="px-3 py-3 border-b border-slate-800/80">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-black">Logged in</p>
        <p className="text-sm font-black text-white truncate">{user?.name || user?.username}</p>
        <p className="text-[11px] text-emerald-300 font-bold">{user?.role || 'STAFF'}</p>
      </div>
      <div className="flex-1 py-5 px-3 flex flex-col gap-1.5">
        {menuItems.filter(item => allowed(item.label)).map((item) => (
          <NavLink key={item.path} to={item.path} onClick={() => setIsOpen && setIsOpen(false)} className={({ isActive }) => `flex items-center w-full px-3 py-2.5 rounded-lg text-[13px] font-bold transition-all duration-200 ${isActive ? 'bg-[var(--color-brand-accent)] text-white shadow-md shadow-[var(--color-brand-accent)]/20' : 'hover:bg-slate-800/80 hover:text-white text-slate-400'}`}>
            <item.icon size={18} className="mr-3 opacity-80" />{item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
