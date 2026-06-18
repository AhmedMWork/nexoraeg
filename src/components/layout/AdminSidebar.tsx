// ============================================================
// NEXORA V5.5 — HQ Sidebar Navigation
// Grouped command-center IA instead of crowded flat Studio links.
// ============================================================

import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Warehouse,
  Star,
  Tag,
  CalendarClock,
  BarChart3,
  UserRound,
  SearchCheck,
  ShieldCheck,
  Settings,
  Activity,
  MousePointerClick,
  UserPlus,
  Target,
  FileBarChart,
  ChevronLeft,
  Menu,
  X,
  ExternalLink,
  BadgePercent,
  ClipboardList,
  MonitorSmartphone,
  Truck,
  Command,
} from 'lucide-react';
import { useState } from 'react';
import { ADMIN_NAV_GROUPS } from '@/lib/constants';

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Warehouse,
  Star,
  Tag,
  CalendarClock,
  BarChart3,
  UserRound,
  SearchCheck,
  ShieldCheck,
  Settings,
  Activity,
  MousePointerClick,
  UserPlus,
  Target,
  FileBarChart,
  BadgePercent,
  ClipboardList,
  MonitorSmartphone,
  Truck,
};

export default function AdminSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const sidebarClasses = `
    fixed top-0 left-0 z-40 h-screen bg-[#FFFDF7] border-r border-[#D7C5B2] shadow-[12px_0_40px_rgba(43,33,29,.06)]
    transition-all duration-300 flex flex-col
    ${isCollapsed ? 'w-20' : 'w-72'}
    ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
  `;

  return (
    <>
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-4 left-4 z-50 rounded-2xl border border-[#D7C5B2] bg-[#FFFDF7] p-2 text-[#231916] lg:hidden"
        aria-label="Toggle NEXORA HQ navigation"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#231916]/28 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={sidebarClasses}>
        <div className="flex h-20 items-center justify-between border-b border-[#D7C5B2] p-4">
          {!isCollapsed && (
            <Link to="/nexora-admin/dashboard" className="flex items-center gap-3">
              <img src="/assets/nexora-logo.png" alt="NEXORA" className="h-8 w-auto object-contain" />
              <div>
                <p className="text-[11px] font-black tracking-[0.22em] text-[#231916]">NEXORA HQ</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-[#735B4F]">Admin OS</p>
              </div>
            </Link>
          )}
          {isCollapsed && <Command className="mx-auto h-5 w-5 text-[#D6B58F]" />}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden rounded-xl p-1.5 text-[#735B4F] transition hover:bg-[#F1E6D7] hover:text-[#231916] lg:flex"
            aria-label="Collapse NEXORA HQ sidebar"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-5">
              {!isCollapsed && <p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.22em] text-[#A48F7E]">{group.label}</p>}
              <div className="space-y-1">
                {group.links.map((link) => {
                  const Icon = iconMap[link.icon] || LayoutDashboard;
                  const isActive = location.pathname === link.href || (link.href !== '/nexora-admin/dashboard' && location.pathname.startsWith(link.href));
                  return (
                    <Link
                      key={link.href}
                      to={link.href}
                      onClick={() => setIsMobileOpen(false)}
                      title={isCollapsed ? `${link.label}: ${link.description}` : undefined}
                      className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-xs font-semibold transition-all duration-200 ${
                        isActive
                          ? 'border border-[#D6B58F]/55 bg-[#F1E6D7] text-[#231916] shadow-[0_14px_34px_rgba(43,33,29,.08)]'
                          : 'border border-transparent text-[#735B4F] hover:border-[#D7C5B2] hover:bg-[#FAF7F2] hover:text-[#231916]'
                      }`}
                    >
                      <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-[#D6B58F]' : 'text-[#A48F7E] group-hover:text-[#D6B58F]'}`} />
                      {!isCollapsed && (
                        <span className="min-w-0">
                          <span className="block truncate">{link.label}</span>
                          <span className="mt-0.5 block truncate text-[10px] font-normal text-[#A48F7E]">{link.description}</span>
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-1 border-t border-[#D7C5B2] p-3">
          <Link
            to="/"
            onClick={() => setIsMobileOpen(false)}
            className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-xs font-semibold text-[#735B4F] transition hover:bg-[#F1E6D7] hover:text-[#9D7159]"
          >
            <ExternalLink className="h-4 w-4" />
            {!isCollapsed && <span>View Store</span>}
          </Link>
          <button
            onClick={() => navigate('/')}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-xs font-semibold text-[#735B4F] transition hover:bg-[#F1E6D7] hover:text-[#9D7159]"
          >
            <ExternalLink className="h-4 w-4" />
            {!isCollapsed && <span>Close HQ</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
