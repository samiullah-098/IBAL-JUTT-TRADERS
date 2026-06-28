import { useEffect, useMemo, useState } from 'react';
import { Keyboard, X, Search, Plus, Save, Printer, LayoutDashboard } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const shortcuts = [
  { keys: 'Alt + D', action: 'Dashboard open karo' },
  { keys: 'Alt + P', action: 'POS & Billing open karo' },
  { keys: 'Alt + S', action: 'Sales Register open karo' },
  { keys: 'Alt + I', action: 'Inventory open karo' },
  { keys: 'Alt + U', action: 'Purchases open karo' },
  { keys: 'Alt + K', action: 'Khata & Accounts open karo' },
  { keys: 'Alt + E', action: 'Expenses open karo' },
  { keys: 'Alt + Q', action: 'Quotations open karo' },
  { keys: 'Alt + G', action: 'General Ledger open karo' },
  { keys: 'Alt + R', action: 'Reports open karo' },
  { keys: 'Alt + T', action: 'Staff open karo' },
  { keys: 'F2', action: 'Current section mein New/Add/Register button open karo' },
  { keys: 'F3', action: 'Current section ki search bar focus karo' },
  { keys: 'F4', action: 'Print / Duplicate Invoice / receipt print karo' },
  { keys: 'F8', action: 'Save / Process / Submit button run karo' },
  { keys: 'F9', action: 'POS checkout / Generate Bill' },
  { keys: 'Esc', action: 'Modal close / cancel' },
  { keys: 'Alt + /', action: 'Keyboard shortcut guide open/close' },
];

function clickButtonByText(words: string[]) {
  const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
  const btn = buttons.find(b => {
    const t = (b.innerText || b.textContent || '').toLowerCase();
    return !b.disabled && words.some(w => t.includes(w));
  });
  btn?.click();
  return !!btn;
}

function focusSearch() {
  const candidates = Array.from(document.querySelectorAll('input, textarea')) as HTMLInputElement[];
  const search = candidates.find(i => {
    const p = `${i.getAttribute('placeholder') || ''} ${i.getAttribute('aria-label') || ''}`.toLowerCase();
    return !i.disabled && (p.includes('search') || p.includes('dhoond') || p.includes('invoice') || p.includes('customer') || p.includes('item'));
  });
  search?.focus();
  search?.select?.();
  return !!search;
}

export default function ShortcutCenter() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const routes = useMemo(() => ({
    d: '/', p: '/pos', s: '/sales', i: '/inventory', u: '/purchases', k: '/khata-center',
    e: '/expenses', q: '/quotations', g: '/general-ledger', r: '/reports', t: '/staff'
  } as Record<string,string>), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target && ['INPUT','TEXTAREA','SELECT'].includes(target.tagName);

      if (e.altKey && e.key === '/') {
        e.preventDefault(); setOpen(v => !v); return;
      }
      if (e.altKey && routes[e.key.toLowerCase()]) {
        e.preventDefault(); navigate(routes[e.key.toLowerCase()]); return;
      }
      if (isTyping && !['Escape','F8','F9'].includes(e.key)) return;

      if (e.key === 'F2') { e.preventDefault(); clickButtonByText(['new','add','register','create','naya','نیا']); }
      if (e.key === 'F3') { e.preventDefault(); focusSearch(); }
      if (e.key === 'F4') { e.preventDefault(); if (!clickButtonByText(['print','invoice'])) window.print(); }
      if (e.key === 'F8') { e.preventDefault(); clickButtonByText(['save','process','submit','complete','update']); }
      if (e.key === 'F9') { e.preventDefault(); clickButtonByText(['generate bill','checkout','bill']); }
      if (e.key === 'Escape') { clickButtonByText(['cancel','close','back']); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, routes]);

  return (
    <>
      {location.pathname === '/' && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-[60] print:hidden bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2 text-sm font-black hover:bg-slate-800 active:scale-95"
          title="Keyboard Shortcuts"
        >
          <Keyboard size={18} /> Shortcuts
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/60 backdrop-blur-sm print:hidden flex items-center justify-center p-3">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl border border-slate-200">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black flex items-center gap-2"><Keyboard size={20}/> Keyboard Shortcut Guide</h2>
                <p className="text-xs text-slate-300 font-semibold">Har section mein fast kaam karne ke liye shortcut keys.</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-white/10"><X size={20}/></button>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {shortcuts.map((s) => (
                <div key={s.keys} className="border border-slate-200 rounded-2xl p-3 bg-slate-50 flex items-start gap-3">
                  <div className="shrink-0 bg-white border border-slate-200 rounded-xl px-3 py-2 font-black text-slate-900 shadow-sm text-xs min-w-[78px] text-center">{s.keys}</div>
                  <div className="text-sm font-bold text-slate-700 leading-snug">{s.action}</div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 bg-emerald-50 text-emerald-800 text-xs font-bold flex items-start gap-2">
              <LayoutDashboard size={16} className="shrink-0 mt-0.5" /> Tip: Mobile par shortcut button dashboard ke right-bottom corner mein milega. Desktop par Alt + / se guide open hoti hai.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
