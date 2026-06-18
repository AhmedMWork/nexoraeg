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
    fixed top-0 left-0 z-40 h-screen bg-[#0D1016] border-r border-[#2E3442]
    transition-all duration-300 flex flex-col
    ${isCollapsed ? 'w-20' : 'w-72'}
    ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
  `;

  return (
    <>
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-4 left-4 z-50 rounded-2xl border border-[#2E3442] bg-[#171A21] p-2 text-[#F5F1EA] lg:hidden"
        aria-label="Toggle NEXORA HQ navigation"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={sidebarClasses}>
        <div className="flex h-20 items-center justify-between border-b border-[#2E3442] p-4">
          {!isCollapsed && (
            <Link to="/nexora-admin/dashboard" className="flex items-center gap-3">
              <img src="/assets/nexora-logo-ivory.png" alt="NEXORA" className="h-8 w-auto object-contain" />
              <div>
                <p className="text-[11px] font-black tracking-[0.22em] text-[#F5F1EA]">NEXORA HQ</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-[#A7AEBB]">Admin OS</p>
              </div>
            </Link>
          )}
          {isCollapsed && <Command className="mx-auto h-5 w-5 text-[#D7B98E]" />}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden rounded-xl p-1.5 text-[#A7AEBB] transition hover:bg-[#1F2430] hover:text-[#F5F1EA] lg:flex"
            aria-label="Collapse NEXORA HQ sidebar"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-5">
              {!isCollapsed && <p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.22em] text-[#697286]">{group.label}</p>}
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
                          ? 'border border-[#D7B98E]/30 bg-[#D7B98E]/12 text-[#F6E7D2] shadow-[0_14px_40px_rgba(215,185,142,.08)]'
                          : 'border border-transparent text-[#A7AEBB] hover:border-[#2E3442] hover:bg-[#171A21] hover:text-[#F5F1EA]'
                      }`}
                    >
                      <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-[#D7B98E]' : 'text-[#697286] group-hover:text-[#D7B98E]'}`} />
                      {!isCollapsed && (
                        <span className="min-w-0">
                          <span className="block truncate">{link.label}</span>
                          <span className="mt-0.5 block truncate text-[10px] font-normal text-[#697286]">{link.description}</span>
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-1 border-t border-[#2E3442] p-3">
          <Link
            to="/"
            onClick={() => setIsMobileOpen(false)}
            className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-xs font-semibold text-[#A7AEBB] transition hover:bg-[#171A21] hover:text-[#D7B98E]"
          >
            <ExternalLink className="h-4 w-4" />
            {!isCollapsed && <span>View Store</span>}
          </Link>
          <button
            onClick={() => navigate('/')}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-xs font-semibold text-[#A7AEBB] transition hover:bg-[#171A21] hover:text-[#D7B98E]"
          >
            <ExternalLink className="h-4 w-4" />
            {!isCollapsed && <span>Close HQ</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
