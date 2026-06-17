// ============================================================
// NEXORA — App Layout (Navbar + Footer wrapper)
// ============================================================

import { type ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import PromoBar from '@/components/growth/PromoBar';
import FloatingWhatsApp from '@/components/growth/FloatingWhatsApp';
import ConsentBanner from '@/components/growth/ConsentBanner';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-[#050505] text-[#f4f0e8]">
      <PromoBar />
      <Navbar />
      <main>{children}</main>
      <Footer />
      <FloatingWhatsApp />
      <ConsentBanner />
    </div>
  );
}
