import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ParkingSquare,
  History,
  Car,
  CreditCard,
  Cpu,
  BarChart3,
  Settings,
  CarFront
} from 'lucide-react';
import { cn } from '../lib/utils';

export const navigationItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Quản lý Bãi đỗ', path: '/parking', icon: ParkingSquare },
  { name: 'Lượt gửi xe (Sessions)', path: '/sessions', icon: History },
  { name: 'Phương tiện (Vehicles)', path: '/vehicles', icon: Car },
  { name: 'Thẻ từ RFID', path: '/rfid', icon: CreditCard },
  { name: 'Thiết bị IoT (ESP32)', path: '/devices', icon: Cpu },
  { name: 'Doanh thu & Báo cáo', path: '/reports', icon: BarChart3 },
  { name: 'Cài đặt hệ thống', path: '/settings', icon: Settings }
];

export function Sidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        'w-64 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 flex-shrink-0 min-h-screen',
        className
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-blue-500/30">
          <CarFront className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-sm tracking-wide text-white">SMART PARKING</h2>
          <span className="text-[11px] text-blue-400 font-mono tracking-wider">CMS OPERATOR</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Phân hệ điều hành
        </div>
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer info */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <span>Phiên bản CMS:</span>
          <span className="font-mono text-slate-300">v0.1.0-alpha</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-400">
          Pha 0: Nền tảng hệ thống
        </div>
      </div>
    </aside>
  );
}

