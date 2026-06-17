import { useEffect, useState } from 'react';
import { getAnalyticsConsent, setAnalyticsConsent } from '@/lib/analytics/tracker';

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(!getAnalyticsConsent()), []);
  if (!visible) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 z-[120] mx-auto max-w-3xl rounded-[24px] border border-[var(--v33-border)] bg-[color-mix(in_srgb,var(--v33-card)_94%,transparent)] p-4 shadow-2xl backdrop-blur-xl md:left-auto md:w-[520px]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--v33-accent-strong)]">NEXORA intelligence</p>
          <p className="mt-2 text-sm leading-6 text-[var(--v33-muted)]">We use privacy-conscious analytics to improve your NEXORA experience and understand campaign performance.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setAnalyticsConsent('rejected'); setVisible(false); }} className="nexora-button min-h-10 px-4 text-[10px]">Necessary only</button>
          <button onClick={() => { setAnalyticsConsent('accepted'); setVisible(false); }} className="nexora-button-primary min-h-10 px-4 text-[10px]">Accept</button>
        </div>
      </div>
    </div>
  );
}
