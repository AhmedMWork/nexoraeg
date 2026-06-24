import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Facebook, Instagram } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { buildWhatsAppUrl } from '@/lib/whatsapp';


function WhatsAppMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <path d="M16 3.5c-6.82 0-12.35 5.36-12.35 11.96 0 2.25.65 4.35 1.77 6.14L4.2 28.5l7.12-1.85A12.75 12.75 0 0 0 16 27.43c6.82 0 12.35-5.36 12.35-11.97C28.35 8.86 22.82 3.5 16 3.5Z" fill="currentColor" opacity=".18" />
      <path d="M16 4.75c-6.1 0-11.04 4.8-11.04 10.71 0 2.13.65 4.12 1.77 5.78l-.78 4.3 4.5-1.17A11.34 11.34 0 0 0 16 26.18c6.1 0 11.04-4.8 11.04-10.72S22.1 4.76 16 4.76Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12.36 10.84c-.25-.56-.5-.58-.74-.58h-.63c-.22 0-.57.08-.87.4-.3.33-1.14 1.1-1.14 2.67 0 1.58 1.17 3.1 1.33 3.32.16.21 2.27 3.52 5.58 4.8 2.75 1.06 3.32.85 3.92.8.6-.06 1.94-.78 2.21-1.54.27-.76.27-1.4.19-1.54-.08-.14-.3-.22-.63-.38-.33-.16-1.94-.94-2.24-1.05-.3-.1-.52-.16-.74.16-.22.32-.85 1.05-1.04 1.27-.19.21-.38.24-.71.08-.33-.16-1.38-.5-2.64-1.58-.98-.86-1.64-1.92-1.83-2.24-.19-.32-.02-.5.14-.66.15-.15.33-.38.49-.57.16-.19.22-.32.33-.54.11-.21.05-.4-.03-.56-.08-.16-.72-1.75-.96-2.25Z" fill="currentColor" />
    </svg>
  );
}

const socialLinksBase = [
  { label: 'Instagram', href: 'https://www.instagram.com/nexora.eg_wear?igsh=Zm9zN2ZjZ3Q3Zmlw&utm_source=qr', Icon: Instagram },
  { label: 'Facebook', href: 'https://www.facebook.com/share/18k2uTBtYu/?mibextid=wwXIfr', Icon: Facebook },
];

export default function Footer() {
  const { lang, t } = useI18n();
  const whatsappMessage = lang === 'ar' ? 'مرحبًا NEXORA، أريد الاستفسار عن المنتجات.' : 'Hello NEXORA, I would like to ask about your products.';
  const socialLinks = [
    ...socialLinksBase,
    { label: 'WhatsApp', href: buildWhatsAppUrl('201037141322', whatsappMessage), Icon: WhatsAppMark, featured: true },
  ];

  const groups = [
    {
      title: t('footer.shop'),
      links: lang === 'ar'
        ? [
            { label: 'كل المنتجات', href: '/shop' },
            { label: 'وصل حديثًا', href: '/shop?sort=newest' },
            { label: 'الإصدارات المحدودة', href: '/limited' },
            { label: 'رجالي', href: '/shop/men' },
            { label: 'نسائي', href: '/shop/women' },
            { label: 'يونيسكس', href: '/shop/unisex' },
          ]
        : [
            { label: 'All Products', href: '/shop' },
            { label: 'New Arrivals', href: '/shop?sort=newest' },
            { label: 'Limited Drops', href: '/limited' },
            { label: 'Men', href: '/shop/men' },
            { label: 'Women', href: '/shop/women' },
            { label: 'Unisex', href: '/shop/unisex' },
          ],
    },
    {
      title: t('footer.support'),
      links: lang === 'ar'
        ? [
            { label: 'الشحن والاسترجاع', href: '/info/shipping-returns' },
            { label: 'الأسئلة الشائعة', href: '/info/faq' },
            { label: 'تواصل معنا', href: '/contact' },
          ]
        : [
            { label: 'Shipping & Returns', href: '/info/shipping-returns' },
            { label: 'FAQs', href: '/info/faq' },
            { label: 'Contact Us', href: '/contact' },
          ],
    },
    {
      title: t('footer.company'),
      links: lang === 'ar'
        ? [
            { label: 'عن NEXORA', href: '/info/about' },
            { label: 'سياسة الخصوصية', href: '/info/privacy' },
            { label: 'الشروط والأحكام', href: '/info/terms' },
          ]
        : [
            { label: 'About NEXORA', href: '/info/about' },
            { label: 'Privacy Policy', href: '/info/privacy' },
            { label: 'Terms of Service', href: '/info/terms' },
          ],
    },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-[var(--v33-border)] bg-[var(--v33-card)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--v33-accent)]/50 to-transparent" />
      <div className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-[var(--v33-accent)]/15 blur-3xl" />

      <div className="relative w-full px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] lg:gap-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="col-span-2 lg:col-span-1"
          >
            <Link to="/" className="inline-flex items-center gap-3 mb-6">
              <img src="/assets/nexora-logo-dark.png" alt="NEXORA" className="h-11 w-auto object-contain opacity-95 dark:hidden" />
              <img src="/assets/nexora-logo-ivory.png" alt="NEXORA" className="hidden h-11 w-auto object-contain opacity-95 dark:block" />
            </Link>
            <p className="max-w-[300px] whitespace-pre-line text-sm leading-7 text-[var(--v33-muted)]">{t('footer.brandText')}</p>
            <div className="mt-7 flex items-center gap-3">
              {socialLinks.map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`NEXORA ${label}`}
                  className={`group relative flex items-center justify-center rounded-full border transition-all duration-300 hover:-translate-y-0.5 ${label === 'WhatsApp' ? 'h-12 min-w-12 gap-2 border-[var(--v33-accent)] bg-gradient-to-br from-[var(--v33-accent)] to-[#f1ddbd] px-3 text-[#171210] shadow-[0_18px_42px_rgba(214,181,143,0.26)] hover:shadow-[0_24px_58px_rgba(214,181,143,0.34)]' : 'h-10 w-10 border-[var(--v33-border)] text-[var(--v33-muted)] hover:border-[var(--v33-accent)] hover:text-[var(--v33-accent-strong)]'}`}
                >
                  <Icon className={label === 'WhatsApp' ? 'h-5 w-5' : 'h-4 w-4'} />
                  {label === 'WhatsApp' && <span className="hidden text-[10px] font-black uppercase tracking-[0.16em] sm:inline">Chat</span>}
                </a>
              ))}
            </div>
          </motion.div>

          {groups.map((group) => (
            <div key={group.title}>
              <h4 className="mb-5 text-xs font-black uppercase tracking-[0.22em] text-[var(--v33-text)]">{group.title}</h4>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link to={link.href} className="text-sm text-[var(--v33-muted)] transition-colors hover:text-[var(--v33-accent-strong)]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="nexora-divider" />
      <div className="w-full px-4 py-6 sm:px-6 lg:px-10">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--v33-subtle)]">
            © {new Date().getFullYear()} NEXORA. {lang === 'ar' ? 'كل الحقوق محفوظة.' : 'All rights reserved.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <Link to="/info/privacy" className="text-[10px] uppercase tracking-[0.18em] text-[var(--v33-subtle)] hover:text-[var(--v33-accent-strong)]">
              {t('footer.privacy')}
            </Link>
            <Link to="/info/terms" className="text-[10px] uppercase tracking-[0.18em] text-[var(--v33-subtle)] hover:text-[var(--v33-accent-strong)]">
              {t('footer.terms')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
