export default function KPICard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  iconColorClass, 
  iconBgClass, 
  trendText, 
  trendUp 
}: any) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between h-[120px] transition-all hover:shadow-md hover:border-slate-200">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{title}</h3>
          <div className="text-[22px] font-black text-slate-800 tracking-tight leading-none">{value}</div>
        </div>
        <div className={`p-2.5 rounded-xl ${iconBgClass} ${iconColorClass}`}>
          <Icon size={18} />
        </div>
      </div>
      
      <div className="mt-auto">
        {subtitle && <div className="text-[11px] font-medium text-slate-500">{subtitle}</div>}
        {trendText && (
          <div className="text-[11px] font-medium">
            <span className={trendUp === false ? "text-rose-500 font-bold" : "text-emerald-500 font-bold"}>
              {trendUp === false ? '↘' : '↗'} {trendText.split(' ')[0]}
            </span>
            <span className="text-slate-400"> {trendText.substring(trendText.indexOf(' ') + 1)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
