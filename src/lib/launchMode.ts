import type { LaunchSettings, SiteSettings } from '@/types';

export type NormalizedLaunchSettings = Required<Pick<LaunchSettings,
  'enabled' | 'launchAt' | 'timezone' | 'autoOpen' | 'title' | 'subtitle' | 'eyebrow' | 'announcement' | 'buttonText' | 'whatsappMessage' | 'backgroundImage' | 'showCountdown' | 'showNotifyForm' | 'showSocialLinks' | 'allowAdminBypass' | 'notifySuccessMessage'
>>;

function defaultLaunchAt() {
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
}

export function defaultLaunchSettings(): NormalizedLaunchSettings {
  return {
    enabled: false,
    launchAt: defaultLaunchAt(),
    timezone: 'Africa/Cairo',
    autoOpen: true,
    title: 'NEXORA is Opening Soon',
    subtitle: 'A new premium shopping experience is almost here.',
    eyebrow: 'Premium launch experience',
    announcement: 'We are preparing new drops, smoother checkout, and a better shopping journey.',
    buttonText: 'Contact us on WhatsApp',
    whatsappMessage: 'Hello NEXORA, I would like to know more about the launch.',
    backgroundImage: '',
    showCountdown: true,
    showNotifyForm: true,
    showSocialLinks: true,
    allowAdminBypass: true,
    notifySuccessMessage: 'You are on the launch list. We will contact you when NEXORA opens.',
  };
}

export function readBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  if (typeof value === 'number') return value === 1;
  return fallback;
}

export function normalizeLaunchSettings(value: unknown): NormalizedLaunchSettings {
  const base = defaultLaunchSettings();
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const launchAt = typeof raw.launchAt === 'string' && raw.launchAt.trim() ? raw.launchAt.trim() : base.launchAt;
  return {
    ...base,
    ...raw,
    enabled: readBoolean(raw.enabled, base.enabled),
    launchAt,
    timezone: String(raw.timezone || base.timezone),
    autoOpen: readBoolean(raw.autoOpen, base.autoOpen),
    title: String(raw.title || base.title),
    subtitle: String(raw.subtitle || base.subtitle),
    eyebrow: String(raw.eyebrow || base.eyebrow),
    announcement: String(raw.announcement || base.announcement),
    buttonText: String(raw.buttonText || base.buttonText),
    whatsappMessage: String(raw.whatsappMessage || base.whatsappMessage),
    backgroundImage: String(raw.backgroundImage || ''),
    showCountdown: readBoolean(raw.showCountdown, base.showCountdown),
    showNotifyForm: readBoolean(raw.showNotifyForm, base.showNotifyForm),
    showSocialLinks: readBoolean(raw.showSocialLinks, base.showSocialLinks),
    allowAdminBypass: readBoolean(raw.allowAdminBypass, base.allowAdminBypass),
    notifySuccessMessage: String(raw.notifySuccessMessage || base.notifySuccessMessage),
  };
}

export function getLaunchTimestamp(value?: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function isLaunchActive(settings?: SiteSettings | null | { launchSettings?: LaunchSettings | null }, now = Date.now()) {
  const launch = normalizeLaunchSettings(settings?.launchSettings || null);
  const launchTime = getLaunchTimestamp(launch.launchAt);
  if (!launch.enabled) return false;
  if (launch.autoOpen && launchTime > 0 && launchTime <= now) return false;
  return true;
}

export function toInputDateTime(value?: string) {
  const time = getLaunchTimestamp(value);
  const date = time ? new Date(time) : new Date(defaultLaunchSettings().launchAt);
  return date.toISOString().slice(0, 16);
}

export function fromInputDateTime(value?: string) {
  if (!value) return defaultLaunchSettings().launchAt;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return defaultLaunchSettings().launchAt;
  return date.toISOString();
}

export function launchVerificationSummary(submitted: LaunchSettings, stored: LaunchSettings) {
  const a = normalizeLaunchSettings(submitted);
  const b = normalizeLaunchSettings(stored);
  const keys: Array<keyof NormalizedLaunchSettings> = ['enabled', 'launchAt', 'timezone', 'autoOpen', 'title', 'subtitle', 'eyebrow', 'announcement', 'buttonText', 'whatsappMessage', 'backgroundImage', 'showCountdown', 'showNotifyForm', 'showSocialLinks', 'allowAdminBypass', 'notifySuccessMessage'];
  const mismatches = keys.filter((key) => String(a[key] ?? '') !== String(b[key] ?? ''));
  return { verified: mismatches.length === 0, mismatches };
}
