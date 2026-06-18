// ============================================================
// NEXORA V5.5 — Admin OS Layout
// ============================================================

import { type ReactNode, useMemo, useState } from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { Search, ShieldCheck, LogOut, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminSidebar from '@/components/layout/AdminSidebar';
import StudioGate from '@/components/admin/StudioGate';
import { clearStudioToken, getStudioSessionStatus } from '@/lib/supabase/client';
import { ADMIN_NAV_LINKS } from '@/lib/constants';

interface AdminLayoutProps { children: ReactNode; }

export default function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const session = getStudioSessionStatus();
  const isStudioRoot = location.pathname === '/nexora-admin/' || location.pathname === '/nexora-admin';

  const matches = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return ADMIN_NAV_LINKS.filter((link) => `${link.label} ${link.description}`.toLowerCase().includes(q)).slice(0, 6);
  }, [query]);

  const clearSession = () => {
    clearStudioToken();
    toast.success('Studio session cleared. Enter your PIN again.');
    window.location.reload();
  };

  if (isStudioRoot) return <Navigate to="/nexora-admin/dashboard" replace />;

  return (
    <StudioGate>
      <div className="nexora-admin-light min-h-screen bg-[#F8F0E4] text-[#231916]">
        <AdminSidebar />
        <main className="min-h-screen lg:ml-72">
          <div className="sticky top-0 z-20 border-b border-[#D7C5B2] bg-[#FFFDF7]/90 px-4 py-3 shadow-[0_10px_35px_rgba(43,33,29,.06)] backdrop-blur-xl lg:px-8">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative max-w-xl flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A48F7E]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search HQ: orders, shipping, products, reports..."
                  className="w-full rounded-2xl border border-[#D7C5B2] bg-[#FFFDF7] py-3 pl-11 pr-4 text-sm text-[#231916] outline-none placeholder:text-[#A48F7E] focus:border-[#D6B58F]"
                />
                {matches.length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-3xl border border-[#D7C5B2] bg-[#FFFDF7] shadow-[0_24px_70px_rgba(43,33,29,.12)]">
                    {matches.map((match) => (
                      <Link key={match.href} to={match.href} onClick={() => setQuery('')} className="block border-b border-[#2E3442] p-4 last:border-b-0 hover:bg-[#F1E6D7]">
                        <p className="text-sm font-semibold text-[#231916]">{match.label}</p>
                        <p className="mt-1 text-xs text-[#735B4F]">{match.description}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Link to="/nexora-admin/controls" className="inline-flex items-center gap-2 rounded-2xl border border-[#D7C5B2] bg-[#FFFDF7] px-3 py-2 text-[#735B4F] hover:border-[#D6B58F]/70 hover:text-[#231916]">
                  <ShieldCheck className="h-4 w-4 text-[#D7B98E]" />
                  Launch checklist
                </Link>
                <span className="inline-flex items-center gap-2 rounded-2xl border border-[#D7C5B2] bg-[#FFFDF7] px-3 py-2 text-[#735B4F]">
                  <RefreshCw className="h-3.5 w-3.5 text-emerald-600" />
                  Session {session.isActive ? `${session.minutesLeft}m left` : 'locked'}
                </span>
                <button onClick={clearSession} className="inline-flex items-center gap-2 rounded-2xl border border-[#D7C5B2] bg-[#FFFDF7] px-3 py-2 text-[#735B4F] hover:border-amber-500/40 hover:text-amber-700">
                  <LogOut className="h-3.5 w-3.5" /> Clear session
                </button>
              </div>
            </div>
          </div>
          <div className="p-4 lg:p-8">{children}</div>
        </main>
      </div>
    </StudioGate>
  );
}
