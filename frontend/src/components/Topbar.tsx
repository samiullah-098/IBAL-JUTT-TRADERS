import { Users, AlertTriangle, Bell, Power, Calendar, Menu } from 'lucide-react';

export default function Topbar({ onMenuClick, user, onLogout }: { onMenuClick?: () => void; user?: any; onLogout?: () => void }) {
  const now = new Date();
  return (
    <div className="h-[64px] bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 shrink-0 shadow-sm z-10 relative print:hidden">
      <div className="flex items-center min-w-0">
        <button onClick={onMenuClick} className="lg:hidden mr-4 text-slate-500 hover:text-[var(--color-brand-accent)] transition-colors"><Menu size={22} /></button>
        <div className="min-w-0">
          <h2 className="font-black text-slate-900 text-sm md:text-lg truncate">IQBAL JUTT TRADER</h2>
          <p className="text-[11px] text-slate-500 font-bold truncate">Secure POS & ERP Control Panel</p>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-5 text-slate-500">
        <div className="flex items-center gap-4">
          <button className="hover:text-[var(--color-brand-accent)] transition-colors"><Users size={18} /></button>
          <button className="hover:text-red-600 text-red-500 transition-colors"><AlertTriangle size={18} /></button>
          <button className="hover:text-[var(--color-brand-accent)] text-slate-500 relative transition-colors"><Bell size={18} /><span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--color-brand-accent)] rounded-full border-2 border-white" /></button>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-black border-l border-slate-200 pl-5 text-slate-500 tracking-wide">
          <Calendar size={16} className="text-[var(--color-brand-accent)]" />
          <div><div className="text-slate-800">{now.toLocaleDateString()}</div><div className="text-slate-500">{now.toLocaleTimeString()}</div></div>
        </div>
        <div className="flex items-center gap-4 border-l border-slate-200 pl-5">
          <span className="text-xs font-black text-slate-700">{user?.username}</span>
          <button onClick={onLogout} className="hover:text-red-600 transition-colors"><Power size={18} /></button>
        </div>
      </div>
      <button onClick={onLogout} className="md:hidden text-rose-500"><Power size={20} /></button>
    </div>
  );
}
