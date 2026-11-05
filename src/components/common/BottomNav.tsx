import React from 'react';
import { LayoutGrid, Calculator, HandCoins, BarChart3 } from 'lucide-react';

export type ActiveTab = 'phong' | 'chot_so' | 'thu_tien' | 'bao_cao';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  unpaidCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab, unpaidCount = 0 }) => {
  const tabs = [
    {
      id: 'phong' as ActiveTab,
      label: 'Phòng',
      icon: LayoutGrid,
    },
    {
      id: 'chot_so' as ActiveTab,
      label: 'Chốt sổ',
      icon: Calculator,
    },
    {
      id: 'thu_tien' as ActiveTab,
      label: 'Thu tiền',
      icon: HandCoins,
      badge: unpaidCount > 0 ? unpaidCount : undefined,
    },
    {
      id: 'bao_cao' as ActiveTab,
      label: 'Báo cáo',
      icon: BarChart3,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe shadow-lg">
      <div className="max-w-md mx-auto grid grid-cols-4 h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-1 select-none transition-all min-h-[44px] cursor-pointer ${
                isActive ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
              style={{ minHeight: '44px' }}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-110 stroke-[2.5]' : 'stroke-2'
                  }`}
                />
                {tab.badge !== undefined && (
                  <span className="absolute -top-1 -right-2.5 bg-rose-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] leading-none">{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-1 w-8 h-1 bg-blue-600 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
