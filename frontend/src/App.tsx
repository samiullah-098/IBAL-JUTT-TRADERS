import { useMemo, useState } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './components/Dashboard';
import POSScreen from './components/POSScreen';
import InventoryScreen from './components/InventoryScreen';
import KhataCenterScreen from './components/KhataCenterScreen';
import SuppliersScreen from './components/SuppliersScreen';
import CommitteeScreen from './components/CommitteeScreen';
import PurchasesScreen from './components/PurchasesScreen';
import SalesRegisterScreen from './components/SalesRegisterScreen';
import ReportsScreen from './components/ReportsScreen';
import SettingsScreen from './components/SettingsScreen';
import ExpensesScreen from './components/ExpensesScreen';
import QuotationsScreen from './components/QuotationsScreen';
import GeneralLedgerScreen from './components/GeneralLedgerScreen';
import StaffScreen from './components/StaffScreen';
import LoginScreen from './components/LoginScreen';
import UrduGuide from './components/UrduGuide';
import ShortcutCenter from './components/ShortcutCenter';

const routePermissions: Record<string, string> = {
  '/': 'Dashboard', '/pos': 'POS & Billing', '/sales': 'Sales Register', '/purchases': 'Purchases', '/inventory': 'Inventory', '/suppliers': 'Suppliers', '/khata-center': 'Khata & Accounts', '/committees': 'Committees (Besi)', '/expenses': 'Expenses', '/quotations': 'Quotations', '/general-ledger': 'General Ledger', '/reports': 'Reports', '/staff': 'Staff', '/settings': 'Settings / RBAC'
};

function canAccess(user: any, path: string) {
  if (!user) return false;
  if (user.role === 'ADMIN' || user.permissions?.includes('ALL')) return true;
  const needed = routePermissions[path];
  return !needed || user.permissions?.includes(needed);
}

function ProtectedRoute({ user, path, children }: { user: any; path: string; children: any }) {
  if (!canAccess(user, path)) return <div className="bg-white rounded-2xl p-10 border border-slate-100 shadow-sm text-center"><h2 className="text-xl font-black text-slate-800">Access Restricted</h2><p className="text-sm text-slate-500 mt-2">Is section ki permission settings/staff se allow karni hogi.</p></div>;
  return children;
}

export default function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('erp_user') || 'null'); } catch { return null; }
  });
  const location = useLocation();
  const currentPath = useMemo(() => location.pathname, [location.pathname]);

  if (!user) return <LoginScreen onLogin={setUser} />;

  const logout = () => { localStorage.removeItem('erp_user'); setUser(null); };

  return (
    <div className="flex h-screen bg-[var(--color-brand-light)] overflow-hidden font-sans">
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-20 lg:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}
      <Sidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} user={user} />
      <div className="flex flex-col flex-1 overflow-hidden w-full">
        <Topbar onMenuClick={() => setIsMobileMenuOpen(true)} user={user} onLogout={logout} />
        <ShortcutCenter />
        <main className="flex-1 overflow-y-auto p-3 md:p-5 lg:p-6">
          <UrduGuide path={currentPath} />
          <Routes>
            <Route path="/" element={<ProtectedRoute user={user} path="/"><Dashboard /></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute user={user} path="/pos"><POSScreen /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute user={user} path="/sales"><SalesRegisterScreen /></ProtectedRoute>} />
            <Route path="/purchases" element={<ProtectedRoute user={user} path="/purchases"><PurchasesScreen /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute user={user} path="/inventory"><InventoryScreen /></ProtectedRoute>} />
            <Route path="/khata-center" element={<ProtectedRoute user={user} path="/khata-center"><KhataCenterScreen /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute user={user} path="/suppliers"><SuppliersScreen /></ProtectedRoute>} />
            <Route path="/committees" element={<ProtectedRoute user={user} path="/committees"><CommitteeScreen /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute user={user} path="/expenses"><ExpensesScreen /></ProtectedRoute>} />
            <Route path="/quotations" element={<ProtectedRoute user={user} path="/quotations"><QuotationsScreen /></ProtectedRoute>} />
            <Route path="/general-ledger" element={<ProtectedRoute user={user} path="/general-ledger"><GeneralLedgerScreen /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute user={user} path="/reports"><ReportsScreen /></ProtectedRoute>} />
            <Route path="/staff" element={<ProtectedRoute user={user} path="/staff"><StaffScreen /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute user={user} path="/settings"><SettingsScreen /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
