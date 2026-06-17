import { supabase } from '@/lib/supabase/client';

export type AttributionPayload = {
  visitorId: string;
  sessionId: string;
  source: string;
  medium: string;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
  referrer?: string | null;
  landingPage?: string | null;
  fbclid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  gclid?: string | null;
  ttclid?: string | null;
  firstTouch?: Record<string, unknown> | null;
  lastTouch?: Record<string, unknown> | null;
};

const VISITOR_KEY = 'nexora-visitor-id-v5-2';
const SESSION_KEY = 'nexora-session-id-v5-2';
const SESSION_TS_KEY = 'nexora-session-ts-v5-2';
const FIRST_TOUCH_KEY = 'nexora-first-touch-v5-2';
const LAST_TOUCH_KEY = 'nexora-last-touch-v5-2';
const CONSENT_KEY = 'nexora-consent-v5-2';
const SESSION_TTL = 1000 * 60 * 30;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function randomId(prefix: string) {
  const bytes = new Uint32Array(2);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  return `${prefix}_${Date.now().toString(36)}_${Array.from(bytes).map((n) => n.toString(36)).join('')}_${Math.random().toString(36).slice(2, 8)}`;
}

function getStoredJson<T>(key: string): T | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function setStoredJson(key: string, value: unknown) {
  if (!canUseStorage()) return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function getVisitorId() {
  if (!canUseStorage()) return randomId('anon');
  const existing = localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const value = randomId('anon');
  localStorage.setItem(VISITOR_KEY, value);
  return value;
}

export function getSessionId() {
  if (!canUseStorage()) return randomId('ses');
  const now = Date.now();
  const lastSeen = Number(localStorage.getItem(SESSION_TS_KEY) || 0);
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing && now - lastSeen < SESSION_TTL) {
    localStorage.setItem(SESSION_TS_KEY, String(now));
    return existing;
  }
  const value = randomId('ses');
  localStorage.setItem(SESSION_KEY, value);
  localStorage.setItem(SESSION_TS_KEY, String(now));
  return value;
}

function parseParams() {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function normalizeReferrer(referrer: string) {
  if (!referrer) return '';
  try { return new URL(referrer).hostname.replace(/^www\./, '').toLowerCase(); } catch { return referrer.toLowerCase(); }
}

function inferSource(params: URLSearchParams, referrer: string) {
  const utmSource = params.get('utm_source')?.trim().toLowerCase();
  const utmMedium = params.get('utm_medium')?.trim().toLowerCase();
  const host = normalizeReferrer(referrer);
  const hasFb = Boolean(params.get('fbclid')) || host.includes('facebook.com') || host.includes('fb.com') || host.includes('m.facebook.com');
  const hasIg = host.includes('instagram.com') || host.includes('l.instagram.com');
  const hasGoogle = Boolean(params.get('gclid')) || host.includes('google.');
  const hasTikTok = Boolean(params.get('ttclid')) || host.includes('tiktok.com');
  if (utmSource) return { source: utmSource, medium: utmMedium || 'campaign' };
  if (hasIg) return { source: 'instagram', medium: params.get('fbclid') ? 'paid_social' : 'organic_social' };
  if (hasFb) return { source: 'facebook', medium: 'paid_social' };
  if (hasGoogle) return { source: 'google', medium: params.get('gclid') ? 'paid_search' : 'organic_search' };
  if (hasTikTok) return { source: 'tiktok', medium: 'paid_social' };
  if (host) return { source: host, medium: 'referral' };
  return { source: 'direct', medium: 'none' };
}

export function getAttribution(): AttributionPayload {
  const params = parseParams();
  const referrer = typeof document !== 'undefined' ? document.referrer || null : null;
  const inferred = inferSource(params, referrer || '');
  const payload: AttributionPayload = {
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    source: inferred.source,
    medium: inferred.medium,
    campaign: params.get('utm_campaign'),
    content: params.get('utm_content'),
    term: params.get('utm_term'),
    referrer,
    landingPage: typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : null,
    fbclid: params.get('fbclid'),
    fbc: canUseStorage() ? localStorage.getItem('_fbc') : null,
    fbp: canUseStorage() ? localStorage.getItem('_fbp') : null,
    gclid: params.get('gclid'),
    ttclid: params.get('ttclid'),
    firstTouch: getStoredJson(FIRST_TOUCH_KEY),
    lastTouch: getStoredJson(LAST_TOUCH_KEY),
  };

  const touch = {
    source: payload.source,
    medium: payload.medium,
    campaign: payload.campaign,
    content: payload.content,
    term: payload.term,
    referrer: payload.referrer,
    landingPage: payload.landingPage,
    fbclid: payload.fbclid,
    gclid: payload.gclid,
    ttclid: payload.ttclid,
    capturedAt: new Date().toISOString(),
  };
  if (!payload.firstTouch) {
    setStoredJson(FIRST_TOUCH_KEY, touch);
    payload.firstTouch = touch;
  }
  setStoredJson(LAST_TOUCH_KEY, touch);
  payload.lastTouch = touch;
  return payload;
}

function device() {
  if (typeof navigator === 'undefined') return { type: 'unknown', browser: 'unknown', os: 'unknown', language: 'en', userAgent: '' };
  const ua = navigator.userAgent;
  const type = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ? 'mobile' : 'desktop';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'unknown';
  const browser = /Edg/i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : /Firefox/i.test(ua) ? 'Firefox' : 'unknown';
  return { type, browser, os, language: navigator.language || 'en', userAgent: ua };
}

export function analyticsConsentGranted() {
  if (!canUseStorage()) return true;
  const value = localStorage.getItem(CONSENT_KEY);
  return value !== 'rejected';
}

export function setAnalyticsConsent(value: 'accepted' | 'rejected') {
  if (!canUseStorage()) return;
  localStorage.setItem(CONSENT_KEY, value);
}

export function getAnalyticsConsent() {
  if (!canUseStorage()) return null;
  return localStorage.getItem(CONSENT_KEY) as 'accepted' | 'rejected' | null;
}

export async function trackVisitorEvent(eventName: string, payload: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  const attribution = getAttribution();
  const deviceInfo = device();
  const screen = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown';
  const body = {
    eventName,
    visitorId: attribution.visitorId,
    sessionId: attribution.sessionId,
    pageUrl: `${window.location.pathname}${window.location.search}`,
    path: window.location.pathname,
    title: document.title,
    attribution,
    device: { ...deviceInfo, screen },
    payload,
  };

  try {
    if (analyticsConsentGranted()) {
      const { error } = await supabase.functions.invoke('track-visitor-event', { body });
      if (!error) return;
    }
  } catch {
    // fallback below
  }

  try {
    await supabase.from('analytics_events').insert({
      event_name: eventName,
      session_id: attribution.sessionId,
      path: window.location.pathname,
      referrer: attribution.referrer,
      language: deviceInfo.language,
      device: deviceInfo.type,
      payload: { ...payload, attribution, visitorId: attribution.visitorId, fallback: true },
    });
  } catch {
    // Analytics must not break UX.
  }
}

export async function captureLead(input: { name?: string; phone?: string; email?: string; sourceType: string; productId?: string; productName?: string; notes?: string; status?: string; metadata?: Record<string, unknown> }) {
  const phone = String(input.phone || '').trim();
  const email = String(input.email || '').trim();
  if (!phone && !email) return;
  const attribution = getAttribution();
  try {
    await supabase.functions.invoke('capture-lead', { body: { ...input, attribution, visitorId: attribution.visitorId, sessionId: attribution.sessionId } });
  } catch {
    // Lead capture should not block checkout/contact.
  }
  await trackVisitorEvent('lead_captured', { sourceType: input.sourceType, productId: input.productId, hasPhone: Boolean(phone), hasEmail: Boolean(email) });
}

export async function trackWhatsAppClick(input: { phone?: string; message?: string; productId?: string; productName?: string; cartValue?: number; sourceType?: string }) {
  const attribution = getAttribution();
  try {
    await supabase.functions.invoke('track-whatsapp-click', { body: { ...input, attribution, visitorId: attribution.visitorId, sessionId: attribution.sessionId, pageUrl: typeof window !== 'undefined' ? window.location.pathname : '/' } });
  } catch {
    // ignore
  }
  await trackVisitorEvent('whatsapp_click', { productId: input.productId, productName: input.productName, cartValue: input.cartValue, sourceType: input.sourceType || 'whatsapp_button' });
}
