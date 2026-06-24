// ============================================================
// NEXORA — Premium HQ Sidebar
// Grouped daily navigation with clear labels, examples, and status-first access.
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
  Menu,
  X,
  ExternalLink,
  BadgePercent,
  ClipboardList,
  MonitorSmartphone,
  Truck,
  Rocket,
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
  Rocket,
};

export default function AdminSidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed left-4 top-4 z-50 rounded-full border border-[#E4D6C5] bg-[#FFFDF8] p-2.5 text-[#231916] shadow-[0_14px_32px_rgba(43,33,29,.10)] lg:hidden"
        aria-label="Toggle NEXORA HQ navigation"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#231916]/20 backdrop-blur-[2px] lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen w-[268px] flex-col border-r border-[#E4D6C5] bg-[#FFFDF8]/96 shadow-[16px_0_45px_rgba(43,33,29,.06)] backdrop-blur-xl transition-transform duration-300 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="border-b border-[#E9DDCF] px-5 py-5">
          <Link to="/nexora-admin/dashboard" onClick={() => setIsMobileOpen(false)} className="flex items-center gap-3">
            <img src="/assets/nexora-logo.png" alt="NEXORA" className="h-9 w-auto object-contain" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#231916]">NEXORA</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8E7664]">Operations HQ</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5">
          {ADMIN_NAV_GROUPS.map((group) => (
            <section key={group.label} className="mb-5">
              <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#B39D89]">{group.label}</p>
              <div className="space-y-1.5">
                {group.links.map((link) => {
                  const Icon = iconMap[link.icon] || LayoutDashboard;
                  const isActive = location.pathname === link.href || (link.href !== '/nexora-admin/dashboard' && location.pathname.startsWith(link.href));
                  return (
                    <Link
                      key={link.href}
                      to={link.href}
                      onClick={() => setIsMobileOpen(false)}
                      title={link.description}
                      className={`group flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-semibold transition-all duration-200 ${
                        isActive
                          ? 'border-[#D6B58F]/70 bg-[#F2E7D8] text-[#231916] shadow-[0_16px_32px_rgba(43,33,29,.08)]'
                          : 'border-transparent text-[#6F5D50] hover:border-[#E4D6C5] hover:bg-[#FAF5EE] hover:text-[#231916]'
                      }`}
                    >
                      <span className={`grid h-8 w-8 place-items-center rounded-xl ${isActive ? 'bg-[#FFFDF8] text-[#9D7159]' : 'bg-[#F3E9DC] text-[#A28A74] group-hover:text-[#9D7159]'}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">{link.label}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className="space-y-2 border-t border-[#E9DDCF] p-4">
          <Link
            to="/nexora-admin/launch"
            onClick={() => setIsMobileOpen(false)}
            className="flex items-center justify-between rounded-2xl border border-[#E4D6C5] bg-[#FAF5EE] px-4 py-3 text-xs font-semibold text-[#6F5D50] hover:border-[#D6B58F] hover:text-[#231916]"
          >
            <span>Launch Mode</span>
            <Rocket className="h-4 w-4" />
          </Link>
          <button
            onClick={() => navigate('/')}
            className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-xs font-semibold text-[#6F5D50] transition hover:bg-[#FAF5EE] hover:text-[#9D7159]"
          >
            <span>Open Store</span>
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
