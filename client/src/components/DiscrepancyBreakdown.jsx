import React from 'react';
import {
  CalendarClock,
  Coins,
  AlertOctagon,
  Copy,
  Undo2,
  HelpCircle,
  Clock,
  ArrowUpRight
} from 'lucide-react';

export default function DiscrepancyBreakdown({
  counts,
  summary,
  ambiguousMatchesCount = 0,
  activeTab,
  onSelectTab
}) {
  if (!counts) return null;

  const cards = [
    {
      id: 'FOLLOWING_MONTH',
      title: 'Next-Month Settlements',
      count: counts.following_month_settlements || 0,
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      icon: CalendarClock,
      iconColor: 'text-amber-400',
      description: 'Cutoff timing difference across calendar month or year boundary'
    },
    {
      id: 'ROUNDING',
      title: 'Rounding Variances',
      count: counts.rounding_differences || 0,
      badgeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      icon: Coins,
      iconColor: 'text-blue-400',
      description: 'Sub-tolerance variances (≤ ₹0.05) added to cumulative drift'
    },
    {
      id: 'MATERIAL',
      title: 'Material Mismatches',
      count: counts.material_mismatches || 0,
      badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      icon: AlertOctagon,
      iconColor: 'text-rose-400',
      description: `Gross discrepancies > ₹0.05 (Total: ₹${summary?.total_material_variance || '0.00'})`
    },
    {
      id: 'DUPLICATES',
      title: 'Duplicate Entries',
      count: (counts.gateway_technical_duplicates || 0) + (counts.bank_technical_duplicates || 0),
      badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      icon: Copy,
      iconColor: 'text-purple-400',
      description: `${counts.gateway_technical_duplicates || 0} Gateway + ${counts.bank_technical_duplicates || 0} Bank technical duplicates`
    },
    {
      id: 'ORPHAN_REFUNDS',
      title: 'Orphaned Refunds',
      count: counts.orphaned_refunds || 0,
      badgeColor: 'text-red-400 bg-red-500/10 border-red-500/20',
      icon: Undo2,
      iconColor: 'text-red-400',
      description: `Missing valid parent payment capture (Total: ₹${summary?.orphaned_refunds_total || '0.00'})`
    },
    {
      id: 'AMBIGUOUS',
      title: 'Ambiguous Matches',
      count: ambiguousMatchesCount,
      badgeColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
      icon: HelpCircle,
      iconColor: 'text-orange-400',
      description: 'Bidirectional degree > 1; match withheld without guessing'
    },
    {
      id: 'UNMATCHED',
      title: 'In-Transit & Credits',
      count: (counts.unmatched_gateway || 0) + (counts.unmatched_bank || 0),
      badgeColor: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
      icon: Clock,
      iconColor: 'text-slate-400',
      description: `${counts.unmatched_gateway || 0} In-Transit Gateway + ${counts.unmatched_bank || 0} Bank Credits`
    }
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Detected Discrepancies & Anomaly Slices
        </h3>
        <span className="text-xs text-slate-400">Click a slice to filter audit table</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const isSelected = activeTab === card.id;

          return (
            <button
              key={card.id}
              onClick={() => onSelectTab(card.id)}
              className={`text-left p-3.5 rounded-xl border transition-all relative overflow-hidden group ${
                isSelected
                  ? 'bg-slate-800/90 border-blue-500 ring-1 ring-blue-500/50 shadow-lg shadow-blue-500/10'
                  : 'bg-[#111827] border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`w-4 h-4 ${card.iconColor}`} />
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${card.badgeColor}`}
                >
                  {card.count}
                </span>
              </div>
              <div className="mt-2.5">
                <div className="text-xs font-semibold text-slate-200 truncate group-hover:text-white">
                  {card.title}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {card.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

