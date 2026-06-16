import { motion } from 'framer-motion';
import { Crown, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import SectionReveal from '@/components/ui/SectionReveal';
import { useI18n } from '@/i18n/I18nProvider';

export default function WhyNexoraSection() {
  const { lang } = useI18n();
  const values = lang === 'ar'
    ? [
        { icon: Sparkles, title: 'Defined by intention', description: 'Every release is deliberate, considered, and made with a clear reason to exist.' },
        { icon: ShieldCheck, title: 'Crafted with precision', description: 'Silhouettes, weight, and finishing are refined to feel quiet, sharp, and lasting.' },
        { icon: Crown, title: 'We command presence', description: 'NEXORA avoids noise and builds confidence through restraint, proportion, and clarity.' },
        { icon: Lock, title: 'Not for everyone', description: 'Limited by design for customers who understand presence without chasing attention.' },
      ]
    : [
        { icon: Sparkles, title: 'Defined by intention', description: 'Every release is deliberate, considered, and made with a clear reason to exist.' },
        { icon: ShieldCheck, title: 'Crafted with precision', description: 'Silhouettes, weight, and finishing are refined to feel quiet, sharp, and lasting.' },
        { icon: Crown, title: 'We command presence', description: 'NEXORA avoids noise and builds confidence through restraint, proportion, and clarity.' },
        { icon: Lock, title: 'Not for everyone', description: 'Limited by design for customers who understand presence without chasing attention.' },
      ];

  return (
    <section className="py-20 lg:py-32 bg-[var(--v33-bg)]">
      <div className="v3-shell">
        <SectionReveal className="text-center mb-16">
          <p className="nexora-caption mb-3">{lang === 'ar' ? 'NEXORA Manifesto' : 'NEXORA Manifesto'}</p>
          <h2 className="nexora-heading-md">{lang === 'ar' ? 'Not for everyone.' : 'Not for everyone.'}</h2>
        </SectionReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {values.map((value, i) => (
            <SectionReveal key={value.title} delay={i * 0.1}>
              <motion.div whileHover={{ y: -4 }} className="v41-trust-card h-full">
                <div className="v41-trust-icon"><value.icon className="w-4 h-4" /></div>
                <div>
                  <h3>{value.title}</h3>
                  <p>{value.description}</p>
                </div>
              </motion.div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
