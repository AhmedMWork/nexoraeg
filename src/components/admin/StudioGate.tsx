// ============================================================
// NEXORA V5 — Secure Studio Gate
// Studio access requires a Supabase Edge Function PIN session.
// The admin route is hidden from storefront navigation, but security is
// enforced by verify-studio-access + signed short-lived Studio token.
// ============================================================

import { type FormEvent, type ReactNode, useState } from 'react';
import { Shield, LockKeyhole, RefreshCw } from 'lucide-react';
import { createStudioSession, getStudioToken } from '@/lib/supabase/client';

export default function StudioGate({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(() => !!getStudioToken());
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const pin = value.trim();
    if (!pin) {
      setError('Enter your private Studio PIN.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await createStudioSession(pin);
      setIsUnlocked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Studio access failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUnlocked) return <>{children}</>;

  return (
    <main className="min-h-screen bg-[var(--v33-bg)] text-[var(--v33-text)] flex items-center justify-center px-5">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--v33-accent) 26%, transparent), transparent 28rem), linear-gradient(135deg, var(--v33-card), var(--v33-bg))' }} />
      <form onSubmit={submit} className="relative w-full max-w-md v34-admin-panel p-6 sm:p-8 text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full v34-logo-plate">
          <picture>
            <source srcSet="/assets/nexora-logo-ivory.png" media="(prefers-color-scheme: dark)" />
            <img src="/assets/nexora-logo-dark.png" alt="NEXORA" className="h-16 w-16 object-contain" />
          </picture>
        </div>
        <p className="v3-kicker mb-3">NEXORA Studio</p>
        <h1 className="text-2xl font-semibold tracking-[-0.04em]">Secure operations portal</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--v33-muted)]">
          Enter the private Studio PIN to manage products, orders, inventory, coupons, reviews, settings, and media.
        </p>

        <label className="mt-7 block text-left text-[10px] font-black uppercase tracking-[0.22em] text-[var(--v33-muted)]">Studio PIN</label>
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          type="password"
          className="nexora-input mt-2 text-center tracking-[0.18em]"
          placeholder="Enter your private PIN"
          autoComplete="current-password"
        />

        {error && <p className="mt-3 text-xs leading-6 text-amber-300">{error}</p>}

        <button className="nexora-button-primary mt-6 w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
          {isSubmitting ? 'Verifying...' : 'Unlock Studio'}
        </button>
        <p className="mt-5 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--v33-subtle)]">
          <Shield className="h-3.5 w-3.5" /> Protected by Supabase Edge Functions
        </p>
      </form>
    </main>
  );
}
