import { useMemo, useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

const guides: Record<string, { title: string; goal: string; steps: string[]; tip: string }> = {
  '/': {
    title: 'Dashboard Guide',
    goal: 'Yahan se daily, weekly, monthly aur custom date range ki business summary samajh aati hai.',
    steps: ['Upar date range select karo.', 'Daily Sales, Profit, Expenses aur Udhar cards dekho.', 'Neeche top customers, suppliers aur low stock alerts check karo.', 'Agar purani report chahiye to custom start/end date lagao.'],
    tip: 'Dashboard decision screen hai; detailed list ke liye Reports ya related module open karo.'
  },
  '/pos': {
    title: 'POS / Billing Guide',
    goal: 'Customer select karke maal search karo, weight/rate add karo aur bill generate karo.',
    steps: ['Customer search/select karo ya quick add karo.', 'Item ko name, lot, mill ya category se search karo.', 'Bags, weight, rate add karke cart mein daalo.', 'Paid amount aur payment method select karke Generate Bill dabao.', 'Bill print ya WhatsApp par share karo.'],
    tip: 'Udhar sale ke liye customer select karna zaroori rakho taake Khata update ho.'
  },
  '/sales': {
    title: 'Sales Register Guide',
    goal: 'Har invoice, customer phone, item breakdown aur duplicate print yahan milta hai.',
    steps: ['Invoice ID, customer name ya phone se search karo.', 'Invoice expand karke item-wise details dekho.', 'Duplicate invoice print karo.', 'Customer receivable check karne ke liye Khata open karo.'],
    tip: 'Ye audit record hai; sale delete/edit sirf admin permission se hona chahiye.'
  },
  '/purchases': {
    title: 'Purchases Guide',
    goal: 'Supplier se maal purchase karke inventory aur supplier payable automatically update hota hai.',
    steps: ['Existing supplier select karo ya new supplier same form mein add karo.', 'Purchase items, bags, weight aur rate add karo.', 'Discount/paid amount enter karo.', 'Save karte hi stock aur supplier udhar update hoga.'],
    tip: 'Purchase ID ko supplier profile aur inventory reference mein use karo.'
  },
  '/inventory': {
    title: 'Inventory Guide',
    goal: 'Available stock, purchase rate, sale rate, valuation aur low stock yahan control hota hai.',
    steps: ['Category ya search se item dhoondo.', 'Item card/drawer open karke details check karo.', 'Stock edit karo ya archive/delete karo.', 'Low stock report dashboard/reports mein follow karo.'],
    tip: 'History wale item ko delete karne ke bajaye archive karna safe hai.'
  },
  '/suppliers': {
    title: 'Suppliers Guide',
    goal: 'Supplier ki details, purchases, maal supplied aur payable/udhar yahan track hota hai.',
    steps: ['Supplier list se supplier select karo.', 'Report cards se total purchase/payable dekho.', 'Purchase history mein Purchase ID open karo.', 'Payment add karke payable reduce karo.'],
    tip: 'Supplier record purchases se automatically create/update hona chahiye.'
  },
  '/khata-center': {
    title: 'Khata & Accounts Guide',
    goal: 'Customer receivable aur supplier payable ko simple business wording mein manage karo.',
    steps: ['All Parties, Customers Receivable ya Suppliers Payable tab select karo.', 'Party select karke history dekho.', 'Payment in/out add karo.', 'Ledger advanced tab mein detail check karo.'],
    tip: 'Client ke liye “Udhar / Jama / Payable” wording rakho; debit-credit hidden rakho.'
  },
  '/committees': {
    title: 'Committee / Besi Guide',
    goal: 'Participants, monthly collections, winner draw aur payout history manage karo.',
    steps: ['New Committee create karo.', 'Participants add karo.', 'Monthly collections mein paid/partial/pending mark karo.', 'Winner draw/manual select karo.', 'Payout record save karo.'],
    tip: 'Committee ka main kaam pending recovery aur payout tracking hai, sirf draw nahi.'
  },
  '/expenses': {
    title: 'Expenses Guide',
    goal: 'Daily business expenses, staff chai/petrol/freight/utility aur other costs record karo.',
    steps: ['Add Expense dabao.', 'Title, category, amount, date, method aur paid-to details add karo.', 'Record save karo.', 'Expense card click karke detail, edit ya delete karo.'],
    tip: 'Expenses net profit aur General Ledger mein automatically include hotay hain.'
  },
  '/quotations': {
    title: 'Supplier Quotation Guide',
    goal: 'Supplier ko maal mangwane ke liye professional quotation/request generate karo.',
    steps: ['Supplier select karo.', 'Inventory se required items search karke add karo.', 'Quantity, expected rate, quality aur notes likho.', 'Quotation save karke print/share karo.'],
    tip: 'Quotation stock update nahi karti; stock sirf Purchase save hone par update hota hai.'
  },
  '/general-ledger': {
    title: 'General Ledger Guide',
    goal: 'Software ke sales, purchases, payments, expenses aur salary entries ka complete financial trail.',
    steps: ['Date range select karo.', 'Module-wise debit/credit entries dekho.', 'Reference ya party se search karo.', 'Detailed report ke liye source module open karo.'],
    tip: 'Ye owner/admin ke liye audit screen hai; normal staff se restrict karna better hai.'
  },
  '/staff': {
    title: 'Staff & Permissions Guide',
    goal: 'Staff details, salary payments aur section-wise software access control karo.',
    steps: ['New Staff add karo.', 'Profile, phone, CNIC, salary, username/password/PIN set karo.', 'Allowed sections select karo.', 'Salary payment record save karo.'],
    tip: 'Admin ko ALL permission do; staff ko sirf zaroori sections do.'
  },
  '/reports': {
    title: 'Reports Guide',
    goal: '80+ business reports se sales, purchases, stock, khata, profit aur committee records analyze karo.',
    steps: ['Category select karo.', 'Report choose karo.', 'Date range apply karo.', 'Summary cards aur table rows review karo.'],
    tip: 'Dashboard quick view hai, Reports deep view hai.'
  },
  '/settings': {
    title: 'Settings Guide',
    goal: 'Backup, security login, low stock settings, reset safety aur software controls yahan manage hotay hain.',
    steps: ['Business profile review karo.', 'Login username/password/PIN update karo.', 'Backup settings save karo.', 'Manual backup banao.', 'Reset sirf final confirmation ke sath karo.'],
    tip: 'Brand name locked hai taake client branding accidentally change na ho.'
  }
};

export default function UrduGuide({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const guide = useMemo(() => guides[path] || guides['/'], [path]);
  return (
    <div className="mb-4 print:hidden bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full px-4 py-3 flex items-center justify-between text-left">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center"><HelpCircle size={18} /></div>
          <div>
            <h3 className="font-black text-emerald-900 text-sm">آسان اردو گائیڈ — {guide.title}</h3>
            <p className="text-xs text-emerald-700 font-semibold mt-0.5">{guide.goal}</p>
          </div>
        </div>
        {open ? <ChevronUp className="text-emerald-700" size={18} /> : <ChevronDown className="text-emerald-700" size={18} />}
      </button>
      {open && (
        <div className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-4 gap-3">
          {guide.steps.map((step, i) => (
            <div key={step} className="bg-white/80 rounded-xl border border-emerald-100 p-3">
              <p className="text-[10px] font-black text-emerald-500 uppercase">Step {i + 1}</p>
              <p className="text-sm font-bold text-slate-700 mt-1">{step}</p>
            </div>
          ))}
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-3 lg:col-span-4">
            <p className="text-xs font-black text-amber-700">Tip</p>
            <p className="text-sm font-bold text-amber-900 mt-1">{guide.tip}</p>
          </div>
        </div>
      )}
    </div>
  );
}
