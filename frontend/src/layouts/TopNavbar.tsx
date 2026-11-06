import { useLocation } from 'react-router-dom';
import { UserCheck, Shield, Menu } from 'lucide-react';
import { navigationItems } from './Sidebar';
import { useHealthStatus } from '../hooks/useHealthStatus';
import { Badge } from '../components/ui/Badge';

export function TopNavbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const location = useLocation();
  const { liveness, isError } = useHealthStatus();

  // Tìm tên tiêu đề trang theo đường dẫn
  const currentItem = navigationItems.find((item) =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
  );
  const pageTitle = currentItem?.name || 'Trang quản trị';

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="text-lg font-bold text-slate-800">{pageTitle}</h1>
          <p className="text-xs text-slate-500 hidden sm:block">
            Smart Parking Management System &middot; Console
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Backend status indicator */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Backend API:</span>
          {isError ? (
            <Badge variant="destructive" className="h-6 text-[11px] gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Offline
            </Badge>
          ) : liveness?.status === 'ok' ? (
            <Badge variant="success" className="h-6 text-[11px] gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live: 5000
            </Badge>
          ) : (
            <Badge variant="warning" className="h-6 text-[11px]">Đang kết nối...</Badge>
          )}
        </div>

        {/* Operator Badge (Do not implement RBAC in this phase as instructed) */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-semibold text-slate-800 flex items-center gap-1">
              Gate Operator <Shield className="w-3 h-3 text-blue-600" />
            </div>
            <div className="text-[10px] text-slate-500">Toàn quyền vận hành (Pha 0)</div>
          </div>
        </div>
      </div>
    </header>
  );
}

