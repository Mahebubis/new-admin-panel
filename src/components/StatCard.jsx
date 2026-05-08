export default function StatCard({ title, value, icon, color = 'indigo', subtitle, trend }) {
  const colors = {
    indigo:  'from-indigo-500 to-indigo-600',
    green:   'from-emerald-500 to-emerald-600',
    blue:    'from-blue-500 to-blue-600',
    orange:  'from-orange-500 to-orange-600',
    pink:    'from-pink-500 to-pink-600',
    purple:  'from-purple-500 to-purple-600',
    red:     'from-red-500 to-red-600',
    cyan:    'from-cyan-500 to-cyan-600',
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <p className={`text-xs mt-1 font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </p>
          )}
        </div>
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[color] || colors.indigo} flex items-center justify-center text-white shadow-lg shadow-${color}-500/25`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
