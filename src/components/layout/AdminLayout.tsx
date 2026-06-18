// ============================================================
// NEXORA V5.5.3 — Clean Light Admin Layout
// Daily admin stays quiet. Technical recovery is moved into Setup.
// ============================================================

import { type ReactNode, useMemo, useState } from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { Search, ShieldCheck, LogOut, Sparkles } from 'lucide-react';
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
    return ADMIN_NAV_LINKS.filter((link) => `${link.label} ${link.description}`.toLowerCase().includes(q)).slice(0, 7);
  }, [query]);

  const clearSession = () => {
    clearStudioToken();
    toast.success('Studio session cleared. Enter your PIN again.');
    window.location.reload();
  };

  if (isStudioRoot) return <Navigate to="/nexora-admin/dashboard" replace />;

  return (
    <StudioGate>
      <div className="nexora-admin-light admin-ux-reset min-h-screen bg-[#F8F0E4] text-[#231916]">
        <AdminSidebar />
        <main className="min-h-screen lg:ml-[268px]">
          <header className="sticky top-0 z-20 border-b border-[#E4D6C5] bg-[#FFFDF8]/88 px-4 py-3 shadow-[0_10px_28px_rgba(43,33,29,.05)] backdrop-blur-xl lg:px-7">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <span className="hidden h-10 w-10 place-items-center rounded-2xl border border-[#E4D6C5] bg-[#FAF5EE] text-[#9D7159] lg:grid">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#B39D89]">NEXORA HQ</p>
                  <p className="mt-1 text-sm font-semibold text-[#231916]">Daily back office · clean mode</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative sm:w-[340px]">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A48F7E]" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search advanced tools..."
                    className="h-11 w-full rounded-2xl border border-[#E4D6C5] bg-[#FFFDF8] pl-11 pr-4 text-sm text-[#231916] outline-none placeholder:text-[#A48F7E] focus:border-[#D6B58F]"
                  />
                  {matches.length > 0 && (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-3xl border border-[#E4D6C5] bg-[#FFFDF8] shadow-[0_24px_70px_rgba(43,33,29,.12)]">
                      {matches.map((match) => (
                        <Link key={match.href} to={match.href} onClick={() => setQuery('')} className="block border-b border-[#EFE5D9] p-4 last:border-b-0 hover:bg-[#FAF5EE]">
                          <p className="text-sm font-semibold text-[#231916]">{match.label}</p>
                          <p className="mt-1 text-xs leading-5 text-[#7A6658]">{match.description}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <Link to="/nexora-admin/controls" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E4D6C5] bg-[#FFFDF8] px-3 text-xs font-semibold text-[#6F5D50] hover:border-[#D6B58F] hover:text-[#231916]">
                  <ShieldCheck className="h-4 w-4 text-[#9D7159]" />
                  Setup
                </Link>
                <button onClick={clearSession} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E4D6C5] bg-[#FFFDF8] px-3 text-xs font-semibold text-[#6F5D50] hover:border-amber-500/40 hover:text-amber-700">
                  <LogOut className="h-3.5 w-3.5" />
                  {session.isActive ? `${session.minutesLeft}m` : 'Locked'}
                </button>
              </div>
            </div>
          </header>
          <div className="px-4 py-5 lg:px-7 lg:py-7">{children}</div>
        </main>
      </div>
    </StudioGate>
  );
}
