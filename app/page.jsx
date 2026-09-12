"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

const DEFAULT_DOMAIN = '';
const AUTO_REFRESH_MS = 15000;

// â”€â”€â”€ Themes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const THEMES = {
  blue: {
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    primary: '#6366f1', primaryDark: '#4f46e5', primaryRgb: '99,102,241',
    pageBg: '#f1f5f9', cardBg: '#ffffff',
    cardShadow: '0 8px 36px rgba(102,126,234,0.15)',
    border: '#e2e8f0', textPrimary: '#0f172a', textMuted: '#64748b',
    itemHoverBg: '#f8f9ff', dark: false,
  },
  dark: {
    gradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    primary: '#818cf8', primaryDark: '#6366f1', primaryRgb: '129,140,248',
    pageBg: '#0f172a', cardBg: '#1e293b',
    cardShadow: '0 8px 36px rgba(0,0,0,0.5)',
    border: '#334155', textPrimary: '#f1f5f9', textMuted: '#94a3b8',
    itemHoverBg: '#243044', dark: true,
  },
  green: {
    gradient: 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)',
    primary: '#10b981', primaryDark: '#059669', primaryRgb: '16,185,129',
    pageBg: '#f0fdf8', cardBg: '#ffffff',
    cardShadow: '0 8px 36px rgba(16,185,129,0.13)',
    border: '#d1fae5', textPrimary: '#064e3b', textMuted: '#6b7280',
    itemHoverBg: '#f0fdf4', dark: false,
  },
  rose: {
    gradient: 'linear-gradient(135deg, #f43f5e 0%, #a855f7 100%)',
    primary: '#f43f5e', primaryDark: '#e11d48', primaryRgb: '244,63,94',
    pageBg: '#fff1f2', cardBg: '#ffffff',
    cardShadow: '0 8px 36px rgba(244,63,94,0.13)',
    border: '#fecdd3', textPrimary: '#881337', textMuted: '#6b7280',
    itemHoverBg: '#fff5f6', dark: false,
  },
  amber: {
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
    primary: '#f59e0b', primaryDark: '#d97706', primaryRgb: '245,158,11',
    pageBg: '#fffbeb', cardBg: '#ffffff',
    cardShadow: '0 8px 36px rgba(245,158,11,0.13)',
    border: '#fde68a', textPrimary: '#78350f', textMuted: '#6b7280',
    itemHoverBg: '#fefce8', dark: false,
  },
};

function randomAlias(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function useBootstrap() {
  useEffect(() => {
    import('bootstrap/dist/js/bootstrap.bundle.min.js');
  }, []);
}

function formatMessageDate(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export default function HomePage({ initialAlias = '' }) {
  useBootstrap();
  const [address, setAddress] = useState('');
  const [localPart, setLocalPart] = useState(() => randomAlias());
  const [selectedDomain, setSelectedDomain] = useState(DEFAULT_DOMAIN);
  const [domains, setDomains] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState('');
  const [messageFilter, setMessageFilter] = useState(null);
  const [theme, setTheme] = useState('blue');
  const [otpNotification, setOtpNotification] = useState(null);
  const [notifPermission, setNotifPermission] = useState('default');
  const [pinRequired, setPinRequired] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinVerified, setPinVerified] = useState(false);

  const prevMessageIdsRef = useRef(new Set());
  const audioRef = useRef(null);
  const skipNextNotifRef = useRef(false);
  const currentAddressRef = useRef('');
  const verifiedPinRef = useRef('');

  const t = THEMES[theme] || THEMES.blue;
  const displayedMessages = useMemo(() => (messages || []).slice(0, 3), [messages]);

  // â"€â"€â"€ Notification Sound â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  useEffect(() => {
    // Create audio element for notification sound (Web Audio API beep)
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioRef.current = { type: 'webaudio' };
      }
    } catch {}
  }, []);

  function playNotificationSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      // Play a pleasant two-tone notification
      const playTone = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = ctx.currentTime;
      playTone(880, now, 0.15);        // A5
      playTone(1108, now + 0.15, 0.2); // C#6
      playTone(1320, now + 0.3, 0.25); // E6
      // Close context after sound finishes
      setTimeout(() => ctx.close(), 1000);
    } catch {}
  }

  // Request notification permission on first interaction
  function requestNotifPermission() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => setNotifPermission(perm));
    }
  }

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotifPermission(Notification.permission);
    }
  }, []);

  function showBrowserNotification(title, body, otpCode) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      const notif = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'otp-notification',
        requireInteraction: true,
      });
      notif.onclick = () => {
        window.focus();
        if (otpCode) copyToClipboard(otpCode, { successToast: '✓ OTP disalin dari notifikasi' });
        notif.close();
      };
    } catch {}
  }

  // Apply theme CSS variables to DOM
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bs-primary', t.primary);
    root.style.setProperty('--bs-primary-rgb', t.primaryRgb);
    root.style.setProperty('--bs-link-color', t.primary);
    root.style.setProperty('--bs-link-hover-color', t.primaryDark);
    if (t.dark) {
      root.setAttribute('data-bs-theme', 'dark');
    } else {
      root.removeAttribute('data-bs-theme');
    }
  }, [theme, t]);

  // Fetch active theme from server
  useEffect(() => {
    fetch('/api/theme')
      .then((r) => r.json())
      .then((d) => { if (d?.theme && THEMES[d.theme]) setTheme(d.theme); })
      .catch(() => {});
  }, []);

  const otpKeywordRe = /(otp|passcode|pass code|verification|verify|one[\s-]*time|2fa|mfa|auth|authentication|security code|login code|reset code|activation code|kode|kode verifikasi|kode otp|pin|token|code|sandi|kata sandi|password|confirm|konfirmasi)/i;

  function normalizeOtpCandidate(raw) {
    const text = String(raw || '').trim();
    if (!text) return '';
    return text.replace(/[^a-zA-Z0-9]/g, '');
  }

  function formatOtpCandidate(raw) {
    return String(raw || '')
      .trim()
      .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')
      .replace(/\s+/g, '-')
      .toUpperCase();
  }

  function scoreOtpCandidate({ code, idx, raw, input, seedScore = 0 }) {
    let score = seedScore;
    const len = code.length;
    const isNumeric = /^\d+$/.test(code);
    const hasLetter = /[a-zA-Z]/.test(code);
    const hasDigit = /\d/.test(code);
    const digitCount = (code.match(/\d/g) || []).length;

    if (!hasDigit) return -999;

    // Length scoring — 6 digits is the most common OTP length
    if (len === 6) score += 9;
    else if (len === 4) score += 6;
    else if (len === 5 || len === 7) score += 5;
    else if (len === 8) score += 4;
    else score += 1;

    // Pure numeric codes are more likely OTPs
    if (isNumeric) score += 4;
    // Alphanumeric with digits (like AB12CD) can be verification codes
    if (hasLetter && hasDigit && len <= 8) score += 3;

    // Grouped patterns (123-456, 12 34 56)
    if (/^[A-Za-z0-9]{2,8}(?:-[A-Za-z0-9]{2,8}){1,2}$/.test(raw)) score += 6;
    if (/^\d{2,4}(?:[\s-]\d{2,4}){1,3}$/.test(raw)) score += 7;

    // Penalties
    if (hasLetter && hasDigit && digitCount === 1 && len >= 8) score -= 8;
    if (hasLetter && !/[A-Z]/.test(raw)) score -= 2;
    if (/^(?:19|20)\d{2}$/.test(code)) score -= 8; // Year
    if (/^(\d)\1{4,}$/.test(code)) score -= 6; // Repeated digits
    if (/^\d{9,}$/.test(code)) score -= 7; // Too long number (phone, etc)
    if (/^0\d{9,}$/.test(code)) score -= 10; // Phone number

    // Context scoring — look at surrounding text
    const near = input.slice(Math.max(0, idx - 120), Math.min(input.length, idx + raw.length + 120));
    if (otpKeywordRe.test(near)) score += 12;
    if (/(do not share|jangan bagikan|don't share|rahasia|secret|private)/i.test(near)) score += 5;
    if (/(expires?|expired|berlaku|valid|minutes?|menit|seconds?|detik)/i.test(near)) score += 4;
    if (/(enter|masukkan|gunakan|use|input|ketik|type)/i.test(near)) score += 3;
    if (/(invoice|order|amount|harga|total|rp\b|idr\b|usd\b|\$)/i.test(near) && !otpKeywordRe.test(near)) score -= 5;
    if (/(tracking|resi|nomor pesanan|order number|id transaksi)/i.test(near) && !otpKeywordRe.test(near)) score -= 4;

    return score;
  }

  function pickOtpFromText(text) {
    const input = String(text || '');
    if (!input) return null;

    const candidates = [];
    const seen = new Set();

    function pushCandidate(raw, idx, seedScore = 0) {
      const code = normalizeOtpCandidate(raw);
      const output = formatOtpCandidate(raw);
      if (!code || code.length < 4 || code.length > 12) return;
      if (!/\d/.test(code)) return;

      // Reject obvious phrase-like captures (too many words).
      if ((String(raw).match(/[\s-]/g) || []).length > 3) return;

      const key = `${code}:${idx}`;
      if (seen.has(key)) return;
      seen.add(key);

      const score = scoreOtpCandidate({ code, idx, raw: String(raw || ''), input, seedScore });
      if (score <= 0) return;

      candidates.push({ code, output, score, idx });
    }

    // Pattern 1: Contextual — keyword followed by code
    const contextualRe = /\b(?:otp|passcode|verification(?:\s*code)?|security\s*code|one[\s-]*time(?:\s*(?:password|pin|code))?|kode(?:\s*(?:otp|verifikasi|login|akses))?|pin|token|2fa|mfa|auth(?:entication)?\s*code|confirmation\s*code|code|sandi)\b[^\r\nA-Za-z0-9]{0,30}([A-Za-z0-9]{2,8}(?:[\s-][A-Za-z0-9]{2,8}){0,2})/gi;
    // Pattern 2: "Your code is: XXXXXX" style
    const codeIsRe = /(?:code|kode|otp|pin|sandi)\s*(?:is|:|=|nya|anda)\s*[^\r\nA-Za-z0-9]{0,10}([A-Za-z0-9]{4,8}(?:[\s-][A-Za-z0-9]{2,4}){0,2})/gi;
    // Pattern 3: Standalone numeric codes (4-8 digits)
    const numericRe = /\b(\d{4,8})\b/g;
    // Pattern 4: Grouped numeric (123 456, 12-34-56)
    const groupedNumericRe = /\b(\d{2,4}(?:[\s-]\d{2,4}){1,3})\b/g;
    // Pattern 5: Grouped alphanumeric (AB1-CD2)
    const groupedAlphaNumRe = /\b([A-Za-z0-9]{2,8}(?:-[A-Za-z0-9]{2,8}){1,2})\b/g;
    // Pattern 6: Bold/emphasized codes (often in HTML: <b>123456</b>, <strong>...)
    const boldCodeRe = /(?:<b>|<strong>|<em>|\*\*|__)([A-Za-z0-9]{4,8}(?:[\s-][A-Za-z0-9]{2,4}){0,2})(?:<\/b>|<\/strong>|<\/em>|\*\*|__)/gi;

    let m;
    while ((m = contextualRe.exec(input)) !== null) pushCandidate(m[1], m.index, 10);
    while ((m = codeIsRe.exec(input)) !== null) pushCandidate(m[1], m.index, 11);
    while ((m = boldCodeRe.exec(input)) !== null) pushCandidate(m[1], m.index, 8);
    while ((m = groupedNumericRe.exec(input)) !== null) pushCandidate(m[0], m.index, 6);
    while ((m = groupedAlphaNumRe.exec(input)) !== null) pushCandidate(m[0], m.index, 7);
    while ((m = numericRe.exec(input)) !== null) pushCandidate(m[0], m.index, 4);

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score || a.idx - b.idx);
    return candidates[0].output;
  }

  // Extract OTP from a message object (used for badge display)
  function extractOtpFromMessage(msg) {
    if (!msg) return null;
    const base = [
      msg.subject || '',
      msg.snippet || '',
      msg.from || '',
      msg.to || ''
    ].join('\n');
    return pickOtpFromText(base);
  }

  function htmlToText(html) {
    try {
      const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
      return doc?.body?.textContent || '';
    } catch {
      return '';
    }
  }

  async function copyToClipboard(text, options = {}) {
    const { successToast = 'âœ“ Copied to clipboard' } = options;
    try {
      // Method 1: Modern Clipboard API (desktop + some mobile browsers)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setToast(successToast);
        return;
      }
    } catch (err) {
      console.log('Clipboard API failed, trying fallback');
    }

    // Method 2: Fallback for older/mobile browsers
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, 99999); // For mobile
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) {
        setToast(successToast);
      } else {
        setToast('âœ— Copy failed');
      }
    } catch (err) {
      console.error('Copy failed:', err);
      setToast('âœ— Copy failed');
    }
  }

  async function copyOtpFromMessage(msg, options = {}) {
    const base = [
      msg?.subject || '',
      msg?.snippet || '',
      msg?.from || '',
      msg?.to || ''
    ].join('\n');
    const otp = pickOtpFromText(base);
    if (!otp) {
      setToast(options.notFoundToast || 'âœ— OTP not found');
      return;
    }
    await copyToClipboard(otp, { successToast: options.successToast || 'âœ“ OTP copied' });
  }

  async function copyOtpFromDetail() {
    if (!detail || detail.loading || detail.error) return;
    const combined = [
      detail.subject || '',
      detail.bodyText || '',
      htmlToText(detail.bodyHtml || ''),
      detail.from || ''
    ].join('\n');
    const otp = pickOtpFromText(combined);
    if (!otp) {
      setToast('âœ— OTP not found');
      return;
    }
    await copyToClipboard(otp, { successToast: 'âœ“ OTP copied' });
  }

  async function registerAlias(addr) {
    if (!addr || typeof addr !== 'string') return;
    const trimmed = addr.trim();
    if (!trimmed.includes('@')) return;
    try {
      const res = await fetch('/api/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: trimmed })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Alias registration failed');
      }
    } catch (e) {
      console.error('Failed to register alias', e);
      // Avoid noisy UI: only show this when user is actively doing an action
    }
  }

  async function refreshInbox(currentAddr = address, options = {}) {
    const { silent = false, currentPin = '' } = options;
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      // Use: explicitly passed PIN > verified PIN ref > pinInput state
      const pinParam = currentPin || verifiedPinRef.current || pinInput;
      let url = `/api/messages?alias=${encodeURIComponent(currentAddr)}`;
      if (pinParam) url += `&pin=${encodeURIComponent(pinParam)}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));

      // Handle PIN required or wrong PIN
      if (res.status === 401 && (data?.error || '').toLowerCase().includes('pin')) {
        setPinRequired(true);
        setPinVerified(false);
        verifiedPinRef.current = '';
        if (currentPin) {
          // PIN was explicitly provided but wrong
          setError('PIN salah');
          setPinInput('');
        }
        if (!silent) setLoading(false);
        return;
      }

      if (!res.ok) throw new Error(data?.error || 'Failed to fetch messages');

      // PIN was accepted — store in ref for future polling
      if (pinParam && pinRequired) {
        verifiedPinRef.current = pinParam;
        setPinVerified(true);
        setError('');
      }

      // STALE CHECK: if address changed while we were fetching, discard results
      if (currentAddr !== currentAddressRef.current) return;

      const newMessages = data.messages || [];

      // On first fetch after alias change (non-silent), just populate prevIds without notifying
      if (!silent) {
        prevMessageIdsRef.current = new Set(newMessages.map((m) => m.id));
        skipNextNotifRef.current = false;
      } else if (skipNextNotifRef.current) {
        // Skip notification on the very first silent poll after alias change
        prevMessageIdsRef.current = new Set(newMessages.map((m) => m.id));
        skipNextNotifRef.current = false;
      } else if (newMessages.length > 0) {
        // Detect genuinely new messages and check for OTP
        const prevIds = prevMessageIdsRef.current;
        const newOnes = newMessages.filter((m) => !prevIds.has(m.id));
        if (newOnes.length > 0) {
          for (const msg of newOnes) {
            const otp = extractOtpFromMessage(msg);
            if (otp) {
              playNotificationSound();
              setOtpNotification({ code: otp, from: msg.from, subject: msg.subject, id: msg.id });
              showBrowserNotification(
                `\u{1F511} Kode OTP: ${otp}`,
                `Dari: ${msg.from || 'Unknown'}\n${msg.subject || ''}`,
                otp
              );
              break;
            } else {
              playNotificationSound();
            }
          }
        }
        prevMessageIdsRef.current = new Set(newMessages.map((m) => m.id));
      }

      setMessages(newMessages);
      setMessageFilter(data.filter || null);
      setLastRefreshed(new Date().toLocaleTimeString());
      // Clear any previous error when fetch succeeds (including silent polls)
      if (error) setError('');
    } catch (err) {
      console.error(err);
      if (!silent) setError(err?.message || 'Failed to refresh messages');
      // For silent polls: only show persistent errors (auth issues)
      if (silent && err?.message && err.message.includes('Token expired')) {
        setError(err.message);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function openMessage(id) {
    try {
      setDetail({ loading: true });
      const res = await fetch(`/api/messages/${id}`);
      if (!res.ok) throw new Error('Failed to fetch message detail');
      const data = await res.json();
      setDetail({ ...data, loading: false });
    } catch (err) {
      console.error(err);
      setDetail({ loading: false, error: 'Failed to load message content' });
    }
  }

  useEffect(() => {
    if (!address || !address.includes('@')) return undefined;

    // Set current address ref FIRST — this is used by refreshInbox to discard stale responses
    currentAddressRef.current = address;

    // Clear old messages immediately when alias changes
    setMessages([]);
    setDetail(null);
    setError('');
    setLastRefreshed('');
    setMessageFilter(null);
    setOtpNotification(null);
    setPinRequired(false);
    setPinInput('');
    setPinVerified(false);
    verifiedPinRef.current = '';
    prevMessageIdsRef.current = new Set();
    skipNextNotifRef.current = true;

    registerAlias(address);
    refreshInbox(address);

    // SSE real-time: listen for push notifications from server
    let es = null;
    let reconnectTimer = null;

    function connectSSE() {
      try {
        es = new EventSource(`/api/messages/stream?alias=${encodeURIComponent(address)}`);
        es.addEventListener('newmail', () => {
          // Immediately refresh when server signals new mail
          refreshInbox(address, { silent: true });
        });
        es.onerror = () => {
          // SSE disconnected, will fallback to polling
          try { es.close(); } catch {}
          es = null;
          // Try reconnect after 5 seconds
          reconnectTimer = setTimeout(connectSSE, 5000);
        };
      } catch {
        // SSE not supported, polling only
      }
    }

    connectSSE();

    // Fallback polling (slower interval since SSE handles real-time)
    const timer = setInterval(() => refreshInbox(address, { silent: true }), AUTO_REFRESH_MS);
    return () => {
      clearInterval(timer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (es) { try { es.close(); } catch {} }
    };
  }, [address]);

  useEffect(() => {
    async function loadDomains() {
      try {
        const res = await fetch('/api/domains');
        const data = await res.json();
        const active = (data.domains || []).map((d) => d.name);
        setDomains(active);
        if (active.length > 0) {
          // ensure selectedDomain is valid
          if (!selectedDomain || !active.includes(selectedDomain)) setSelectedDomain(active[0]);
        }
      } catch (e) {
        console.error('Failed to load domains', e);
      }
    }
    loadDomains();
  }, []);

  useEffect(() => {
    if (!selectedDomain) return;
    const newAddr = `${localPart}@${selectedDomain}`;
    setAddress(newAddr);
  }, [localPart, selectedDomain]);

  // Handle initialAlias from URL (e.g. /user@domain.com)
  useEffect(() => {
    if (!initialAlias || !initialAlias.includes('@')) return;
    const [local, domain] = initialAlias.split('@');
    if (local && domain) {
      setLocalPart(local);
      setSelectedDomain(domain);
      setAddress(initialAlias);
    }
  }, [initialAlias]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 10000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Auto-dismiss OTP notification after 30 seconds
  useEffect(() => {
    if (!otpNotification) return undefined;
    const timer = setTimeout(() => setOtpNotification(null), 30000);
    return () => clearTimeout(timer);
  }, [otpNotification]);

  // â”€â”€â”€ Computed style helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const btnPrimary = {
    background: t.primary, borderColor: t.primary, color: '#fff',
    border: '1.5px solid', borderRadius: '10px', padding: '0.65rem 1.25rem',
    fontWeight: 600, cursor: 'pointer', display: 'inline-flex',
    alignItems: 'center', gap: '0.4rem', transition: 'opacity 0.15s', fontSize: '0.9rem',
  };
  const btnOutline = {
    background: 'transparent', border: `1.5px solid ${t.primary}`, color: t.primary,
    borderRadius: '10px', padding: '0.65rem 1rem', fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.15s', fontSize: '0.9rem',
  };
  const card = {
    background: t.cardBg, borderRadius: '20px',
    boxShadow: t.cardShadow, border: `1px solid ${t.border}`,
  };

  return (
    <div style={{ minHeight: '100vh', background: t.pageBg }}>
      {/* â”€â”€ Inbox item hover style â”€ */}
      <style>{`
        .inbox-msg-item { background: ${t.cardBg}; transition: background 0.15s; }
        .inbox-msg-item:hover { background: ${t.itemHoverBg} !important; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .theme-input::placeholder { color: ${t.textMuted}; opacity: 0.8; }
        .theme-select-wrap { position: relative; display: flex; align-items: center; }
        .theme-select {
          appearance: none !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          background-image: none !important;
          color: ${t.textPrimary} !important;
          background: ${t.pageBg} !important;
          border: none !important;
          box-shadow: none !important;
          font-family: inherit;
          line-height: 1.2;
          padding-right: 2rem !important;
        }
        .theme-select::-ms-expand { display: none; }
        .theme-select option { color: ${t.textPrimary}; background: ${t.cardBg}; }
        .theme-select-caret { position: absolute; right: 10px; pointer-events: none; color: ${t.textMuted}; font-size: 0.8rem; }
        .footer-link { color: ${t.primary}; text-decoration: none; font-weight: 600; }
        .footer-link:hover { color: ${t.primaryDark}; text-decoration: underline; }
      `}</style>

      {/* â”€â”€ Gradient Hero â”€ */}
      <div style={{ background: t.gradient, paddingBottom: '5rem' }}>
        <div className="container-xl">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 42, height: 42, background: 'rgba(255,255,255,0.18)',
                borderRadius: '12px', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className="bi bi-envelope-fill" style={{ color: '#fff', fontSize: '1.05rem' }} />
              </div>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.01em' }}>
                PBS Mail
              </span>
            </div>
            <Link href="/admin" style={{
              color: 'rgba(255,255,255,0.85)', textDecoration: 'none',
              fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem',
              background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: '100px',
              padding: '0.4rem 0.9rem', fontWeight: 500,
            }}>
              <i className="bi bi-gear-fill" />
              <span className="d-none d-sm-inline">Login</span>
            </Link>
          </div>
          <div style={{ textAlign: 'center', padding: '0.25rem 0 1rem', color: '#fff' }}>
            <h1 style={{ fontWeight: 800, fontSize: 'clamp(1.4rem, 5vw, 2.4rem)', marginBottom: '0.5rem', lineHeight: 1.15 }}>
              Email Sementara, Tanpa Ribet
            </h1>
            <p style={{ opacity: 0.82, fontSize: '0.98rem', margin: '0 auto', maxWidth: 460 }}>
              Buat alias email instan. Terima, baca &amp; salin OTP langsung dari browser.
            </p>
          </div>
        </div>
      </div>

      {/* â”€â”€ Main content â”€ */}
      <div className="container-xl" style={{ marginTop: '-3.75rem', paddingBottom: '3rem' }}>
        <div className="row justify-content-center">
          <div className="col-12 col-lg-8 col-xl-7">

            {/* â”€â”€ Email Generator Card â”€ */}
            <div style={{ ...card, padding: '1.75rem', marginBottom: '1.25rem' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: t.textMuted, marginBottom: '0.875rem' }}>
                Alamat Email Anda
              </p>

              {/* Input group */}
              <div style={{
                display: 'flex', alignItems: 'stretch',
                border: `1.5px solid ${t.border}`, borderRadius: '12px',
                overflow: 'hidden', background: t.pageBg, marginBottom: '1rem',
              }}>
                <input
                  value={localPart}
                  onChange={(e) => setLocalPart((e.target.value || '').replace(/\s+/g, ''))}
                  style={{
                    flex: 1, border: 'none', background: 'transparent',
                    padding: '0.875rem 1rem', fontSize: '1rem', fontWeight: 500,
                    outline: 'none', color: t.textPrimary, minWidth: 0,
                  }}
                  className="theme-input"
                  placeholder="alias-kamu"
                  spellCheck="false"
                />
                <span style={{ padding: '0 0.4rem', color: t.textMuted, display: 'flex', alignItems: 'center', fontSize: '1rem' }}>@</span>
                <div className="theme-select-wrap">
                  <select
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                    className="theme-select"
                    style={{
                      border: 'none', background: 'transparent',
                      appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                      backgroundImage: 'none',
                      padding: '0.875rem 2rem 0.875rem 0.35rem',
                      fontSize: '0.9rem', fontWeight: 500,
                      outline: 'none', cursor: 'pointer',
                      maxWidth: 170, minWidth: 140,
                    }}
                    aria-label="Pilih domain"
                  >
                    {(domains.length ? domains : [DEFAULT_DOMAIN]).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <span className="theme-select-caret">
                    <i className="bi bi-chevron-down" />
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  style={{ ...btnPrimary, flex: 1, justifyContent: 'center' }}
                  onClick={() => copyToClipboard(address)}
                  disabled={!address || !address.includes('@')}
                >
                  <i className="bi bi-clipboard" /> Salin Alamat
                </button>
                <button
                  style={btnOutline}
                  onClick={() => {
                    setLocalPart(randomAlias(10));
                    // Clear inbox from previous alias
                    setMessages([]);
                    setDetail(null);
                    setError('');
                    setLastRefreshed('');
                    setMessageFilter(null);
                    setOtpNotification(null);
                    setPinRequired(false);
                    setPinInput('');
                    setPinVerified(false);
                    verifiedPinRef.current = '';
                    prevMessageIdsRef.current = new Set();
                    setToast('\u2713 Alamat baru dibuat, inbox dibersihkan');
                  }}
                  disabled={!selectedDomain}
                  title="Buat alamat baru (inbox akan direset)"
                >
                  <i className="bi bi-arrow-repeat" />
                  <span className="d-none d-sm-inline">Baru</span>
                </button>
              </div>

              {/* Address preview */}
              {address && address.includes('@') && (
                <div style={{
                  marginTop: '0.875rem', padding: '0.65rem 1rem',
                  background: t.pageBg, borderRadius: '8px',
                  border: `1px solid ${t.border}`,
                  fontSize: '0.85rem', color: t.textMuted,
                  fontFamily: 'monospace', wordBreak: 'break-all',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>
                  <i className="bi bi-envelope" style={{ color: t.primary, flexShrink: 0 }} />
                  {address}
                </div>
              )}
            </div>

            {/* â”€â”€ Inbox Card â”€ */}
            <div style={{ ...card, overflow: 'hidden' }}>
              {/* Inbox header */}
              <div style={{
                padding: '1.1rem 1.5rem', borderBottom: `1px solid ${t.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: t.textPrimary }}>Kotak Masuk</span>
                    {messages.length > 0 && (
                      <span style={{
                        background: t.primary, color: '#fff',
                        borderRadius: '100px', fontSize: '0.68rem', fontWeight: 700,
                        padding: '0.1em 0.55em', lineHeight: 1.6,
                      }}>
                        {messages.length > 3 ? '3+' : messages.length}
                      </span>
                    )}
                  </div>
                  {messageFilter?.enabled && (
                    <p style={{ margin: 0, fontSize: '0.73rem', color: t.primary }}>Difilter oleh admin</p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {lastRefreshed && (
                    <span style={{ fontSize: '0.75rem', color: t.textMuted }}>{lastRefreshed}</span>
                  )}
                  <button
                    style={{ ...btnPrimary, padding: 0, width: 34, height: 34, borderRadius: '9px', justifyContent: 'center' }}
                    onClick={() => refreshInbox()}
                    disabled={loading}
                    title="Refresh"
                  >
                    <i className={`bi ${loading ? 'bi-hourglass-split' : 'bi-arrow-clockwise'}`} />
                  </button>
                </div>
              </div>

              {/* Error banner */}
              {error && (
                <div style={{
                  padding: '0.75rem 1.5rem', background: '#fff7ed', color: '#c2410c',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  fontSize: '0.85rem', borderBottom: `1px solid ${t.border}`,
                }}>
                  <i className="bi bi-exclamation-triangle-fill" />
                  <span>{error}</span>
                </div>
              )}

              {/* Messages */}
              <div style={{ minHeight: 190 }}>
                {/* PIN Required Prompt */}
                {pinRequired && !pinVerified && (
                  <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '14px', margin: '0 auto 1rem',
                      background: `rgba(${t.primaryRgb}, 0.1)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <i className="bi bi-lock-fill" style={{ fontSize: '1.5rem', color: t.primary }} />
                    </div>
                    <p style={{ color: t.textPrimary, fontWeight: 700, marginBottom: '0.3rem', fontSize: '1rem' }}>
                      Alias Dilindungi PIN
                    </p>
                    <p style={{ color: t.textMuted, fontSize: '0.82rem', marginBottom: '1.25rem' }}>
                      Masukkan PIN untuk membuka inbox alias ini.
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (pinInput.trim()) refreshInbox(address, { currentPin: pinInput.trim() });
                      }}
                      style={{ display: 'flex', gap: '0.5rem', maxWidth: 280, margin: '0 auto' }}
                    >
                      <input
                        type="password"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value)}
                        placeholder="Masukkan PIN"
                        style={{
                          flex: 1, border: `1.5px solid ${t.border}`, borderRadius: '10px',
                          padding: '0.6rem 1rem', fontSize: '0.9rem', outline: 'none',
                          background: t.cardBg, color: t.textPrimary,
                          textAlign: 'center', letterSpacing: '0.15em', fontWeight: 600,
                        }}
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={!pinInput.trim()}
                        style={{
                          ...btnPrimary, padding: '0.6rem 1rem', borderRadius: '10px',
                        }}
                      >
                        <i className="bi bi-unlock-fill" />
                      </button>
                    </form>
                    {error && (
                      <p style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                        PIN salah. Coba lagi.
                      </p>
                    )}
                  </div>
                )}

                {!pinRequired || pinVerified ? (<>
                {loading && messages.length === 0 && (
                  <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: t.textMuted }}>
                    <div className="spinner-border spinner-border-sm mb-2" role="status">
                      <span className="visually-hidden">Memuat...</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>Memuat pesan...</p>
                  </div>
                )}

                {!loading && !error && messages.length === 0 && (
                  <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: '14px', margin: '0 auto 0.875rem',
                      background: t.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <i className="bi bi-inbox" style={{ fontSize: '1.5rem', color: t.textMuted }} />
                    </div>
                    <p style={{ color: t.textPrimary, fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                      Menunggu email masuk...
                    </p>
                    <p style={{ color: t.textMuted, fontSize: '0.8rem', marginBottom: 0 }}>
                      Refresh otomatis setiap {AUTO_REFRESH_MS / 1000} detik
                    </p>
                  </div>
                )}

                {messages.length > 0 && (
                  <div>
                    {displayedMessages.map((msg, idx) => (
                      <div
                        key={msg.id}
                        className="inbox-msg-item"
                        onClick={() => openMessage(msg.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openMessage(msg.id); }}
                        role="button"
                        tabIndex={0}
                        style={{
                          padding: '1rem 1.5rem',
                          borderBottom: idx < displayedMessages.length - 1 ? `1px solid ${t.border}` : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{
                              fontWeight: 600, fontSize: '0.88rem', color: t.textPrimary,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {msg.subject || '(tanpa subjek)'}
                            </div>
                            {msg.from && (
                              <div style={{
                                fontSize: '0.76rem', color: t.textMuted, marginTop: '0.15rem',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {msg.from}
                              </div>
                            )}
                            <p style={{
                              margin: '0.35rem 0 0', fontSize: '0.8rem', color: t.textMuted,
                              overflow: 'hidden', display: '-webkit-box',
                              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5,
                            }}>
                              {msg.snippet || '(tidak ada pratinjau)'}
                            </p>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.73rem', color: t.textMuted, whiteSpace: 'nowrap' }}>
                              {formatMessageDate(msg.date)}
                            </span>
                            {(() => {
                              const otp = extractOtpFromMessage(msg);
                              if (!otp) return null;
                              return (
                                <div
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                                    background: `rgba(${t.primaryRgb}, 0.1)`, border: `1px solid rgba(${t.primaryRgb}, 0.3)`,
                                    borderRadius: '8px', padding: '0.25rem 0.6rem',
                                    cursor: 'pointer',
                                  }}
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(otp, { successToast: '\u2713 OTP disalin: ' + otp }); }}
                                  title="Klik untuk salin OTP"
                                >
                                  <i className="bi bi-key-fill" style={{ color: t.primary, fontSize: '0.7rem' }} />
                                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: t.primary, letterSpacing: '0.08em' }}>
                                    {otp}
                                  </span>
                                  <i className="bi bi-clipboard" style={{ color: t.primary, fontSize: '0.65rem', opacity: 0.7 }} />
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                </>) : null}
              </div>
            </div>

            <p style={{ textAlign: 'center', marginTop: '1.25rem', color: t.textMuted, fontSize: '0.78rem', marginBottom: 0 }}>
              Auto-refresh setiap {AUTO_REFRESH_MS / 1000} detik &bull; Maks 3 pesan terbaru
            </p>
          </div>
        </div>
      </div>

      {/* â”€â”€ Email Detail Modal â”€ */}
      {detail && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1040, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem', overflowY: 'auto' }}
          onClick={() => setDetail(null)}
        >
          <div
            style={{ ...card, width: '100%', maxWidth: 680, marginTop: '1rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h5 style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {detail.loading ? 'Memuat...' : detail.subject || '(tanpa subjek)'}
                </h5>
                {!detail.loading && !detail.error && (
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: t.textMuted }}>{detail.from}</p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  style={{ ...btnPrimary, padding: '0.35rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px' }}
                  onClick={copyOtpFromDetail}
                  disabled={detail.loading || Boolean(detail.error)}
                  title="Salin OTP"
                >
                  <i className="bi bi-clipboard-check" /> OTP
                </button>
                <button
                  onClick={() => setDetail(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: '1.1rem', padding: '0.3rem', display: 'flex', alignItems: 'center' }}
                  aria-label="Tutup"
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>
            </div>
            <div style={{ padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
              {detail.loading && (
                <div style={{ textAlign: 'center', color: t.textMuted, padding: '3rem 0' }}>
                  <div className="spinner-border spinner-border-sm mb-2" role="status">
                    <span className="visually-hidden">Memuat...</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Memuat pesan...</p>
                </div>
              )}
              {detail.error && (
                <div style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: 10, padding: '1rem', fontSize: '0.875rem' }}>
                  {detail.error}
                </div>
              )}
              {!detail.loading && !detail.error && (
                <>
                  <div style={{ background: t.pageBg, borderRadius: '10px', padding: '0.875rem 1rem', marginBottom: '1.25rem', border: `1px solid ${t.border}` }}>
                    <p style={{ margin: '0 0 0.25rem', fontSize: '0.78rem', color: t.textMuted }}>
                      <strong style={{ color: t.textPrimary }}>Dari:</strong> {detail.from}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: t.textMuted }}>
                      <strong style={{ color: t.textPrimary }}>Tanggal:</strong> {formatMessageDate(detail.date)}
                    </p>
                  </div>
                  <div className="email-body" style={{ color: t.textPrimary }}>
                    {detail.bodyHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: detail.bodyHtml }} />
                    ) : detail.bodyText ? (
                      <pre style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', wordWrap: 'break-word', color: t.textPrimary }}>
                        {detail.bodyText}
                      </pre>
                    ) : (
                      <p style={{ color: t.textMuted, fontSize: '0.875rem' }}>Tidak ada konten</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <footer style={{
        textAlign: 'center',
        padding: '1.5rem 1rem 2.5rem',
        color: t.textMuted,
        fontSize: '0.85rem'
      }}>
        {/* Notification permission button */}
        {notifPermission === 'default' && (
          <button
            onClick={requestNotifPermission}
            style={{
              background: 'none', border: `1px solid ${t.border}`, borderRadius: '8px',
              padding: '0.4rem 0.8rem', fontSize: '0.75rem', color: t.textMuted,
              cursor: 'pointer', marginBottom: '0.5rem', display: 'inline-flex',
              alignItems: 'center', gap: '0.35rem',
            }}
          >
            <i className="bi bi-bell" /> Aktifkan notifikasi OTP
          </button>
        )}
        {notifPermission === 'default' && <br />}
        Copyright 2026 |{' '}
        <Link
          href="/docs/api-partner"
          className="footer-link"
          style={{ marginRight: '0.65rem' }}
        >
          API Partner Docs
        </Link>
        {' | '}
        <a
          href="https://t.me/aryadwinata543"
          target="_blank"
          rel="noreferrer"
          className="footer-link"
        >
          Mas Arya
        </a>
      </footer>

      {/* OTP Notification Banner */}
      {otpNotification && (
        <div style={{
          position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)',
          background: t.gradient,
          color: '#fff', padding: '1rem 1.5rem', borderRadius: '16px',
          fontSize: '0.9rem', fontWeight: 500, zIndex: 2100,
          boxShadow: `0 8px 32px rgba(${t.primaryRgb}, 0.4)`,
          maxWidth: '90vw', width: 380,
          animation: 'slideDown 0.3s ease-out',
        }}>
          <style>{`
            @keyframes slideDown {
              from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
              to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
            @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
          `}</style>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="bi bi-key-fill" style={{ fontSize: '1.1rem' }} />
              <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Kode OTP Terdeteksi
              </span>
            </div>
            <button
              onClick={() => setOtpNotification(null)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: '1rem', padding: '0.2rem' }}
              aria-label="Tutup"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.2)', borderRadius: '10px',
            padding: '0.75rem 1rem', textAlign: 'center', marginBottom: '0.5rem',
            animation: 'pulse 2s infinite',
          }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '0.15em', fontFamily: 'monospace' }}>
              {otpNotification.code}
            </span>
          </div>
          <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {otpNotification.from && <><i className="bi bi-person-fill" /> {otpNotification.from}</>}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => {
                copyToClipboard(otpNotification.code, { successToast: '\u2713 OTP disalin!' });
                setOtpNotification(null);
              }}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.4)',
                color: '#fff', borderRadius: '8px', padding: '0.5rem',
                fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
              }}
            >
              <i className="bi bi-clipboard-check" /> Salin OTP
            </button>
            <button
              onClick={() => setOtpNotification(null)}
              style={{
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.8)', borderRadius: '8px', padding: '0.5rem 0.75rem',
                fontSize: '0.82rem', cursor: 'pointer',
              }}
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* â”€â”€ Toast â”€ */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: t.dark ? t.cardBg : t.primary,
          color: '#fff',
          padding: '0.7rem 1.4rem', borderRadius: '100px',
          fontSize: '0.85rem', fontWeight: 600, zIndex: 2000,
          boxShadow: `0 4px 24px rgba(${t.primaryRgb}, 0.35)`,
          whiteSpace: 'nowrap',
          border: t.dark ? `1px solid ${t.border}` : 'none',
          display: 'flex', alignItems: 'center', gap: '0.4rem',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
