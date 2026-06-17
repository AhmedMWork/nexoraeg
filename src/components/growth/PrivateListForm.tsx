import { useState } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { captureLead, trackVisitorEvent } from '@/lib/analytics/tracker';

export default function PrivateListForm({ compact = false }: { compact?: boolean }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanedPhone = phone.trim();
    if (!/^01[0-9]{9}$/.test(cleanedPhone.replace(/\s/g, ''))) {
      toast.error('Enter a valid Egyptian WhatsApp number.');
      return;
    }
    setIsSubmitting(true);
    await captureLead({ name, phone: cleanedPhone, sourceType: 'private_list', status: 'new', notes: 'Requested private drop access.' });
    await trackVisitorEvent('private_list_joined', { hasName: Boolean(name), sourceType: 'private_list' });
    toast.success('You are on the private list.');
    setPhone('');
    setName('');
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={submit} className={`border border-[var(--v33-border)] bg-[color-mix(in_srgb,var(--v33-card)_84%,transparent)] p-5 shadow-xl ${compact ? 'rounded-[22px]' : 'rounded-[30px] md:p-8'}`}>
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--v33-accent)] bg-[var(--v33-accent)]/10 text-[var(--v33-accent-strong)]"><Lock className="h-4 w-4" /></span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--v33-accent-strong)]">Private access</p>
          <h3 className="mt-1 text-lg font-semibold text-[var(--v33-text)]">Join the private list.</h3>
        </div>
      </div>
      <p className="mb-5 text-sm leading-7 text-[var(--v33-muted)]">Get early access to limited drops and selected privileges. Not for everyone.</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input value={name} onChange={(e) => setName(e.target.value)} className="nexora-input" placeholder="Name optional" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="nexora-input" placeholder="01XXXXXXXXX" dir="ltr" />
        <button disabled={isSubmitting} className="nexora-button-primary whitespace-nowrap disabled:opacity-60">Join <ArrowRight className="h-4 w-4" /></button>
      </div>
    </form>
  );
}
