import { useState } from 'react';
import { Lock, User, KeyRound, ShieldCheck } from 'lucide-react';

const API_BASE = (((window as any).__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:5000') as string).replace(/\/$/, '');


export default function LoginScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, pin })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Login failed');
      localStorage.setItem('erp_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-5">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_#10b981,_transparent_35%),radial-gradient(circle_at_bottom_right,_#6366f1,_transparent_30%)]" />
      <div className="relative w-full max-w-[440px] bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20">
        <div className="bg-slate-900 p-8 text-center">
          <img src="/logo.png" className="w-20 h-20 mx-auto rounded-2xl bg-white p-2 shadow-xl object-cover" />
          <h1 className="mt-4 text-2xl font-black text-white tracking-wide">IQBAL JUTT TRADER</h1>
          <p className="text-emerald-300 text-xs font-bold uppercase tracking-[0.25em] mt-1">Secure POS & ERP Login</p>
        </div>
        <div className="p-7 space-y-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex gap-3 text-sm font-semibold text-emerald-800">
            <ShieldCheck size={20} className="shrink-0" /> Staff ko sirf allowed sections nazar aayenge. Admin settings se username/password/PIN change kar sakta hai.
          </div>
          {error && <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-xl p-3 text-sm font-bold">{error}</div>}
          <label className="block text-xs font-black text-slate-500 uppercase">Username
            <div className="mt-2 flex items-center border border-slate-200 rounded-xl px-3 py-3 focus-within:border-emerald-500 bg-slate-50">
              <User size={17} className="text-slate-400 mr-2" />
              <input value={username} onChange={e=>setUsername(e.target.value)} className="bg-transparent outline-none w-full font-bold text-slate-800" />
            </div>
          </label>
          <label className="block text-xs font-black text-slate-500 uppercase">Password
            <div className="mt-2 flex items-center border border-slate-200 rounded-xl px-3 py-3 focus-within:border-emerald-500 bg-slate-50">
              <Lock size={17} className="text-slate-400 mr-2" />
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="bg-transparent outline-none w-full font-bold text-slate-800" />
            </div>
          </label>
          <label className="block text-xs font-black text-slate-500 uppercase">PIN optional
            <div className="mt-2 flex items-center border border-slate-200 rounded-xl px-3 py-3 focus-within:border-emerald-500 bg-slate-50">
              <KeyRound size={17} className="text-slate-400 mr-2" />
              <input value={pin} onChange={e=>setPin(e.target.value)} className="bg-transparent outline-none w-full font-bold text-slate-800" placeholder="1234" />
            </div>
          </label>
          <button disabled={loading} onClick={submit} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-2xl py-3.5 font-black shadow-lg shadow-emerald-600/20">
            {loading ? 'Logging in...' : 'Login to Software'}
          </button>
        </div>
      </div>
    </div>
  );
}
