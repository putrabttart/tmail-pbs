"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function useBootstrap() {
  useEffect(() => {
    import('bootstrap/dist/js/bootstrap.bundle.min.js');
  }, []);
}

function formatDateTime(value) {
  if (!value) return '-';
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

function formatCompactDate(value) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
}

function splitFilterInput(value) {
  return String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function localizeErrorMessage(message) {
  const raw = String(message || '').trim();
  if (!raw) return 'Terjadi kesalahan. Silakan coba lagi.';

  const lowered = raw.toLowerCase();
  if (lowered.includes('unauthorized')) return 'Sesi admin tidak valid. Silakan login ulang.';
  if (lowered.includes('forbidden')) return 'Akses ditolak untuk aksi ini.';
  if (lowered.includes('domain not allowed')) return 'Domain belum diizinkan.';
  if (lowered.includes('invalid')) return 'Data tidak valid. Periksa kembali input Anda.';
  if (lowered.includes('failed to load')) return 'Gagal memuat data. Coba lagi beberapa saat.';
  if (lowered.includes('request failed')) return 'Permintaan gagal diproses oleh server.';
  return raw;
}

function hasActiveFilterConfig(config = {}) {
  return Boolean(
    (config.subjectExact && config.subjectExact.length) ||
      (config.subjectIncludes && config.subjectIncludes.length) ||
      (config.subjectExcludes && config.subjectExcludes.length) ||
      (config.senderIncludes && config.senderIncludes.length) ||
      (config.keywordIncludes && config.keywordIncludes.length) ||
      config.customRegex
  );
}

function hasAliasConfig(row) {
  return hasActiveFilterConfig(row?.filterConfig || {}) || Boolean(row?.pinHash);
}

function paginateRows(rows, page, pageSize) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    total,
    totalPages,
    page: safePage,
    rows: rows.slice(start, start + pageSize)
  };
}

export default function AdminPage() {
  useBootstrap();
  const router = useRouter();

  const [accessToken, setAccessToken] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [sessionChecked, setSessionChecked] = useState(false);

  const [stats, setStats] = useState(null);
  const [aliases, setAliases] = useState([]);
  const [domains, setDomains] = useState([]);
  const [logs, setLogs] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [partnerApiEnabled, setPartnerApiEnabled] = useState(false);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('disconnected');
  const [toast, setToast] = useState('');

  const [section, setSection] = useState('overview');
  const [newDomain, setNewDomain] = useState('');

  const [aliasQuery, setAliasQuery] = useState('');
  const [aliasSort, setAliasSort] = useState('activity');
  const [aliasFilterStatus, setAliasFilterStatus] = useState('all');
  const [aliasPage, setAliasPage] = useState(1);

  const [selectedAlias, setSelectedAlias] = useState('');
  const [logQuery, setLogQuery] = useState('');
  const [logSort, setLogSort] = useState('latest');
  const [logPage, setLogPage] = useState(1);
  const [aliasFormAddress, setAliasFormAddress] = useState('');
  const [aliasSubjectExact, setAliasSubjectExact] = useState('');
  const [aliasSubjectIncludes, setAliasSubjectIncludes] = useState('');
  const [aliasSubjectExcludes, setAliasSubjectExcludes] = useState('');
  const [aliasSenderIncludes, setAliasSenderIncludes] = useState('');
  const [aliasKeywordIncludes, setAliasKeywordIncludes] = useState('');
  const [aliasCustomRegex, setAliasCustomRegex] = useState('');
  const [aliasPin, setAliasPin] = useState('');
  const [aliasFilterOpen, setAliasFilterOpen] = useState(false);
  const [aliasListTab, setAliasListTab] = useState('all');
  const [inboxAlias, setInboxAlias] = useState('');
  const [inboxMessages, setInboxMessages] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxDetail, setInboxDetail] = useState(null);
  const [inboxQuery, setInboxQuery] = useState('');
  const [inboxSort, setInboxSort] = useState('latest');
  const [inboxPage, setInboxPage] = useState(1);

  const [domainQuery, setDomainQuery] = useState('');
  const [domainFilterStatus, setDomainFilterStatus] = useState('all');
  const [domainPage, setDomainPage] = useState(1);

  const [overviewAliasPage, setOverviewAliasPage] = useState(1);
  const [overviewLogPage, setOverviewLogPage] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTheme, setActiveTheme] = useState('blue');
  const [themeLoading, setThemeLoading] = useState(false);
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyScopes, setApiKeyScopes] = useState('alias:create, messages:read, otp:read');
  const [apiKeyRateLimit, setApiKeyRateLimit] = useState('60');
  const [apiKeyAllowedDomains, setApiKeyAllowedDomains] = useState('');
  const [apiKeyAllowedIps, setApiKeyAllowedIps] = useState('');
  const [apiKeyExpiresAt, setApiKeyExpiresAt] = useState('');
  const [issuedApiKeySecret, setIssuedApiKeySecret] = useState('');
  const [apiKeyQuery, setApiKeyQuery] = useState('');
  const [apiKeyPage, setApiKeyPage] = useState(1);

  useEffect(() => {
    const ensureSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace('/admin/login');
        return;
      }
      setAccessToken(data.session.access_token || '');
      setUserEmail(data.session.user?.email || '');
      setSessionChecked(true);
    };
    ensureSession();
  }, [router]);

  const fetchWithAdmin = useCallback(async (path, options = {}) => {
    const authHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    const headers = { ...(options.headers || {}), ...authHeaders };
    if (options.body) headers['Content-Type'] = 'application/json';
    const res = await fetch(path, { cache: 'no-store', ...options, headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed with ${res.status}`);
    }
    return res.json();
  }, [accessToken]);

  const loadAll = useCallback(async () => {
    if (!sessionChecked || !accessToken) return;
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        fetchWithAdmin('/api/admin/stats'),
        fetchWithAdmin('/api/admin/aliases'),
        fetchWithAdmin('/api/admin/domains'),
        fetchWithAdmin('/api/admin/logs?limit=5000'),
        fetchWithAdmin('/api/admin/keys')
      ]);

      const [statsRes, aliasesRes, domainsRes, logsRes, keysRes] = results;

      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (aliasesRes.status === 'fulfilled') setAliases(aliasesRes.value.aliases || []);
      if (domainsRes.status === 'fulfilled') setDomains(domainsRes.value.domains || []);
      if (logsRes.status === 'fulfilled') setLogs(logsRes.value.logs || []);
      if (keysRes.status === 'fulfilled') {
        setApiKeys(keysRes.value.keys || []);
        setPartnerApiEnabled(Boolean(keysRes.value.partnerApiEnabled));
      }

      const anyError = results.some((r) => r.status === 'rejected');
      setStatus('connected');
      setToast(anyError ? 'Sebagian data gagal dimuat' : 'Data berhasil dimuat');
    } catch (err) {
      console.error(err);
      setStatus('disconnected');
      setToast(localizeErrorMessage(err?.message) || 'Gagal memuat data admin');
    } finally {
      setLoading(false);
    }
  }, [accessToken, fetchWithAdmin, sessionChecked]);

  useEffect(() => {
    if (accessToken && sessionChecked) loadAll();
  }, [accessToken, loadAll, sessionChecked]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setAliasPage(1);
  }, [aliasQuery, aliasSort, aliasFilterStatus]);

  useEffect(() => {
    setLogPage(1);
  }, [logQuery, selectedAlias, logSort]);

  useEffect(() => {
    setInboxPage(1);
  }, [inboxAlias, inboxQuery, inboxSort]);

  useEffect(() => {
    setDomainPage(1);
  }, [domainQuery, domainFilterStatus]);

  useEffect(() => {
    setApiKeyPage(1);
  }, [apiKeyQuery]);

  useEffect(() => {
    if (!accessToken) return;
    fetchWithAdmin('/api/admin/theme')
      .then((d) => { if (d?.theme) setActiveTheme(d.theme); })
      .catch(() => {});
  }, [accessToken, fetchWithAdmin]);

  useEffect(() => {
    if (inboxAlias) return;
    const firstActive = aliases.find((row) => row.active !== false);
    if (firstActive) setInboxAlias(firstActive.address);
  }, [aliases, inboxAlias]);

  const aliasLogMap = useMemo(() => {
    const map = new Map();
    logs.forEach((logItem) => {
      const key = (logItem.alias || '').toLowerCase().trim();
      if (!key) return;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          totalEmails: 1,
          latestSeenAt: logItem.lastSeenAt || null,
          latestSubject: logItem.subject || '-',
          latestFrom: logItem.from || '-'
        });
        return;
      }
      existing.totalEmails += 1;
      const currentSeen = new Date(existing.latestSeenAt || 0).getTime();
      const nextSeen = new Date(logItem.lastSeenAt || 0).getTime();
      if (nextSeen > currentSeen) {
        existing.latestSeenAt = logItem.lastSeenAt || null;
        existing.latestSubject = logItem.subject || '-';
        existing.latestFrom = logItem.from || '-';
      }
    });
    return map;
  }, [logs]);

  const aliasRows = useMemo(() => {
    const merged = aliases.map((a) => {
      const key = (a.address || '').toLowerCase();
      const activity = aliasLogMap.get(key);
      return {
        address: a.address,
        createdAt: a.createdAt || null,
        lastUsedAt: a.lastUsedAt || null,
        hits: a.hits || 0,
        active: a.active !== false,
        filterConfig: a.filterConfig || {},
        pinHash: a.pinHash || null,
        totalEmails: activity?.totalEmails || 0,
        latestSeenAt: activity?.latestSeenAt || null,
        latestSubject: activity?.latestSubject || '-',
        latestFrom: activity?.latestFrom || '-'
      };
    });

    const existingSet = new Set(merged.map((m) => (m.address || '').toLowerCase()));
    aliasLogMap.forEach((value, key) => {
      if (existingSet.has(key)) return;
      merged.push({
        address: key,
        createdAt: null,
        lastUsedAt: null,
        hits: 0,
        active: true,
        filterConfig: {},
        totalEmails: value.totalEmails || 0,
        latestSeenAt: value.latestSeenAt || null,
        latestSubject: value.latestSubject || '-',
        latestFrom: value.latestFrom || '-'
      });
    });

    const q = aliasQuery.trim().toLowerCase();
    let rows = merged;
    if (q) {
      rows = rows.filter((row) => {
        const hay = [row.address, row.latestFrom, row.latestSubject].join(' ').toLowerCase();
        return hay.includes(q);
      });
    }

    if (aliasFilterStatus === 'aktif') {
      rows = rows.filter((row) => row.active);
    } else if (aliasFilterStatus === 'arsip') {
      rows = rows.filter((row) => !row.active);
    } else if (aliasFilterStatus === 'dengan-filter') {
      rows = rows.filter((row) => hasActiveFilterConfig(row.filterConfig || {}));
    } else if (aliasFilterStatus === 'tanpa-filter') {
      rows = rows.filter((row) => !hasActiveFilterConfig(row.filterConfig || {}));
    }

    rows = [...rows].sort((a, b) => {
      if (aliasSort === 'newest') {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      if (aliasSort === 'address') {
        return String(a.address || '').localeCompare(String(b.address || ''));
      }
      const diff = (b.totalEmails || 0) - (a.totalEmails || 0);
      if (diff !== 0) return diff;
      return new Date(b.lastUsedAt || 0) - new Date(a.lastUsedAt || 0);
    });

    return rows;
  }, [aliases, aliasLogMap, aliasQuery, aliasSort, aliasFilterStatus]);

  const aliasPageSize = 25;
  const aliasPagination = useMemo(
    () => paginateRows(aliasRows, aliasPage, aliasPageSize),
    [aliasRows, aliasPage]
  );
  const pagedAliases = aliasPagination.rows;
  const aliasPageCount = aliasPagination.totalPages;

  const overviewAliasRows = useMemo(() => {
    const rows = [...aliasRows];
    rows.sort((a, b) => {
      const byTraffic = (b.totalEmails || 0) - (a.totalEmails || 0);
      if (byTraffic !== 0) return byTraffic;
      return new Date(b.lastUsedAt || 0) - new Date(a.lastUsedAt || 0);
    });
    return rows;
  }, [aliasRows]);

  const overviewAliasPagination = useMemo(
    () => paginateRows(overviewAliasRows, overviewAliasPage, 8),
    [overviewAliasRows, overviewAliasPage]
  );

  const logRows = useMemo(() => {
    let rows = [...logs];
    if (selectedAlias) {
      rows = rows.filter((l) => (l.alias || '').toLowerCase() === selectedAlias.toLowerCase());
    }
    const q = logQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter((l) => {
        const hay = [l.alias || '', l.subject || '', l.from || '', l.snippet || ''].join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    rows.sort((a, b) => {
      if (logSort === 'lama') return new Date(a.lastSeenAt || 0) - new Date(b.lastSeenAt || 0);
      return new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0);
    });
    return rows;
  }, [logs, selectedAlias, logQuery, logSort]);

  const logPagination = useMemo(() => paginateRows(logRows, logPage, 20), [logRows, logPage]);

  const inboxRows = useMemo(() => {
    const q = inboxQuery.trim().toLowerCase();
    let rows = [...inboxMessages];
    if (q) {
      rows = rows.filter((msg) => {
        const hay = [msg.subject || '', msg.from || '', msg.snippet || ''].join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    rows.sort((a, b) => {
      if (inboxSort === 'lama') return new Date(a.date || 0) - new Date(b.date || 0);
      return new Date(b.date || 0) - new Date(a.date || 0);
    });
    return rows;
  }, [inboxMessages, inboxQuery, inboxSort]);

  const inboxPagination = useMemo(() => paginateRows(inboxRows, inboxPage, 12), [inboxRows, inboxPage]);

  const domainRows = useMemo(() => {
    const q = domainQuery.trim().toLowerCase();
    let rows = [...domains];
    if (q) {
      rows = rows.filter((d) => String(d.name || '').toLowerCase().includes(q));
    }
    if (domainFilterStatus === 'aktif') rows = rows.filter((d) => d.active !== false);
    if (domainFilterStatus === 'nonaktif') rows = rows.filter((d) => d.active === false);
    rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    return rows;
  }, [domains, domainQuery, domainFilterStatus]);

  const domainPagination = useMemo(() => paginateRows(domainRows, domainPage, 15), [domainRows, domainPage]);

  const apiKeyRows = useMemo(() => {
    const q = apiKeyQuery.trim().toLowerCase();
    let rows = [...apiKeys];
    if (q) {
      rows = rows.filter((row) => {
        const haystack = [
          row.name || '',
          row.id || '',
          row.keyPrefix || '',
          ...(row.scopes || [])
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    rows.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    return rows;
  }, [apiKeys, apiKeyQuery]);

  const apiKeyPagination = useMemo(
    () => paginateRows(apiKeyRows, apiKeyPage, 10),
    [apiKeyRows, apiKeyPage]
  );

  const overviewLatestRows = useMemo(() => {
    const rows = [...logs];
    rows.sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0));
    return rows;
  }, [logs]);

  const overviewLatestPagination = useMemo(
    () => paginateRows(overviewLatestRows, overviewLogPage, 8),
    [overviewLatestRows, overviewLogPage]
  );

  const activeDomains = domains.filter((d) => d.active !== false);
  const aliasesWithTraffic = aliasRows.filter((a) => (a.totalEmails || 0) > 0).length;
  const inactiveAliases = aliasRows.filter((a) => a.active === false).length;

  async function handleAddDomain() {
    const trimmed = newDomain.trim().toLowerCase();
    if (!trimmed) return;
    try {
      await fetchWithAdmin('/api/admin/domains', {
        method: 'POST',
        body: JSON.stringify({ name: trimmed })
      });
      setNewDomain('');
      await loadAll();
      setToast('Domain berhasil ditambahkan');
    } catch (err) {
      setToast(localizeErrorMessage(err?.message) || 'Gagal menambahkan domain');
    }
  }

  async function toggleDomain(name, active) {
    try {
      await fetchWithAdmin(`/api/admin/domains/${encodeURIComponent(name)}`, {
        method: 'PUT',
        body: JSON.stringify({ active })
      });
      await loadAll();
      setToast(active ? 'Domain berhasil diaktifkan' : 'Domain berhasil dinonaktifkan');
    } catch (err) {
      setToast(localizeErrorMessage(err?.message) || 'Gagal memperbarui domain');
    }
  }

  async function removeDomain(name) {
    if (!window.confirm(`Hapus domain ${name}?`)) return;
    try {
      await fetchWithAdmin(`/api/admin/domains/${encodeURIComponent(name)}`, { method: 'DELETE' });
      await loadAll();
      setToast('Domain berhasil dihapus');
    } catch (err) {
      setToast(localizeErrorMessage(err?.message) || 'Gagal menghapus domain');
    }
  }

  async function removeAlias(address) {
    if (!window.confirm(`Arsipkan alias ${address}?`)) return;
    try {
      await fetchWithAdmin(`/api/admin/aliases/${encodeURIComponent(address)}`, { method: 'DELETE' });
      await loadAll();
      setToast('Alias berhasil diarsipkan');
    } catch (err) {
      setToast(localizeErrorMessage(err?.message) || 'Gagal mengarsipkan alias');
    }
  }

  async function clearAllLogs() {
    if (!window.confirm('Hapus semua log email? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
      await fetchWithAdmin('/api/admin/logs', { method: 'DELETE' });
      await loadAll();
      setToast('Log email berhasil dibersihkan');
    } catch (err) {
      setToast(localizeErrorMessage(err?.message) || 'Gagal membersihkan log email');
    }
  }

  async function revokeToken() {
    if (!window.confirm('Cabut token OAuth? Anda mungkin perlu login OAuth kembali.')) return;
    try {
      await fetchWithAdmin('/auth/revoke', { method: 'POST' });
      setToast('Token OAuth berhasil dicabut');
    } catch (err) {
      setToast(localizeErrorMessage(err?.message) || 'Gagal mencabut token OAuth');
    }
  }

  function resetApiKeyForm() {
    setApiKeyName('');
    setApiKeyScopes('alias:create, messages:read, otp:read');
    setApiKeyRateLimit('60');
    setApiKeyAllowedDomains('');
    setApiKeyAllowedIps('');
    setApiKeyExpiresAt('');
  }

  async function copyIssuedApiKey() {
    if (!issuedApiKeySecret) return;
    try {
      await navigator.clipboard.writeText(issuedApiKeySecret);
      setToast('API key berhasil disalin');
    } catch {
      setToast('Gagal menyalin API key');
    }
  }

  async function createApiKey() {
    const name = apiKeyName.trim();
    if (!name) {
      setToast('Nama API key wajib diisi');
      return;
    }

    try {
      const payload = {
        name,
        scopes: splitFilterInput(apiKeyScopes),
        rateLimitPerMin: parseInt(apiKeyRateLimit || '60', 10) || 60,
        allowedDomains: splitFilterInput(apiKeyAllowedDomains),
        allowedIps: splitFilterInput(apiKeyAllowedIps),
        expiresAt: apiKeyExpiresAt || null
      };

      const data = await fetchWithAdmin('/api/admin/keys', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setIssuedApiKeySecret(data?.secret || '');
      resetApiKeyForm();
      await loadAll();
      setToast('API key baru berhasil dibuat');
    } catch (err) {
      setToast(localizeErrorMessage(err?.message) || 'Gagal membuat API key');
    }
  }

  async function revokeApiKeyRecord(row) {
    if (!row?.id) return;
    if (!window.confirm(`Cabut API key ${row.name}?`)) return;
    try {
      await fetchWithAdmin(`/api/admin/keys/${encodeURIComponent(row.id)}`, {
        method: 'DELETE'
      });
      await loadAll();
      setToast('API key berhasil dicabut');
    } catch (err) {
      setToast(localizeErrorMessage(err?.message) || 'Gagal mencabut API key');
    }
  }

  async function rotateApiKeyRecord(row) {
    if (!row?.id) return;
    if (!window.confirm(`Rotate API key ${row.name}? Key lama akan langsung dicabut.`)) return;
    try {
      const data = await fetchWithAdmin(`/api/admin/keys/${encodeURIComponent(row.id)}/rotate`, {
        method: 'POST'
      });
      setIssuedApiKeySecret(data?.secret || '');
      await loadAll();
      setToast('API key berhasil di-rotate');
    } catch (err) {
      setToast(localizeErrorMessage(err?.message) || 'Gagal rotate API key');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/admin/login');
  }

  function resetAliasForm() {
    setAliasFormAddress('');
    setAliasSubjectExact('');
    setAliasSubjectIncludes('');
    setAliasSubjectExcludes('');
    setAliasSenderIncludes('');
    setAliasKeywordIncludes('');
    setAliasCustomRegex('');
    setAliasPin('');
  }

  function editAliasFilter(row) {
    setAliasFormAddress(row.address || '');
    const cfg = row.filterConfig || {};
    setAliasSubjectExact((cfg.subjectExact || []).join(', '));
    setAliasSubjectIncludes((cfg.subjectIncludes || []).join(', '));
    setAliasSubjectExcludes((cfg.subjectExcludes || []).join(', '));
    setAliasSenderIncludes((cfg.senderIncludes || []).join(', '));
    setAliasKeywordIncludes((cfg.keywordIncludes || []).join(', '));
    setAliasCustomRegex(cfg.customRegex || '');
  }

  async function saveAliasFilter() {
    const address = aliasFormAddress.trim().toLowerCase();
    if (!address) {
      setToast('Alamat alias wajib diisi');
      return;
    }

    const payload = {
      address,
      pin: aliasPin.trim() || null,
      filterConfig: {
        subjectExact: splitFilterInput(aliasSubjectExact),
        subjectIncludes: splitFilterInput(aliasSubjectIncludes),
        subjectExcludes: splitFilterInput(aliasSubjectExcludes),
        senderIncludes: splitFilterInput(aliasSenderIncludes),
        keywordIncludes: splitFilterInput(aliasKeywordIncludes),
        customRegex: aliasCustomRegex.trim()
      }
    };

    try {
      await fetchWithAdmin('/api/admin/aliases', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await loadAll();
      setToast('Filter alias berhasil disimpan' + (aliasPin.trim() ? ' (dengan PIN)' : ''));
      if (!inboxAlias) setInboxAlias(address);
    } catch (err) {
      setToast(localizeErrorMessage(err?.message) || 'Gagal menyimpan filter alias');
    }
  }

  function applyNetflixPreset() {
    setAliasSubjectExact('kode akses sementaramu, kode akses sementara netflix-mu');
    setAliasSubjectIncludes('');
    setAliasSubjectExcludes('');
    setAliasSenderIncludes('info@account.netflix.com, netflix');
    setAliasKeywordIncludes('kode akses sementara, netflix');
    setAliasCustomRegex('');
  }

  async function loadAdminInbox(targetAlias = inboxAlias) {
    const alias = String(targetAlias || '').trim().toLowerCase();
    if (!alias) {
      setToast('Pilih alias terlebih dahulu');
      return;
    }
    setInboxLoading(true);
    try {
      const data = await fetchWithAdmin(`/api/admin/messages?alias=${encodeURIComponent(alias)}`);
      setInboxMessages(data.messages || []);
      setToast('Inbox admin berhasil dimuat');
      setSelectedAlias(alias);
    } catch (err) {
      setToast(localizeErrorMessage(err?.message) || 'Gagal memuat inbox admin');
    } finally {
      setInboxLoading(false);
    }
  }

  async function openAdminMessage(id) {
    if (!id) return;
    setInboxDetail({ loading: true });
    try {
      const data = await fetchWithAdmin(`/api/admin/messages/${encodeURIComponent(id)}`);
      setInboxDetail({ ...data, loading: false });
    } catch (err) {
      setInboxDetail({ loading: false, error: localizeErrorMessage(err?.message) || 'Gagal memuat isi pesan' });
    }
  }

  const ADMIN_THEMES = [
    { id: 'blue', name: 'Ocean Blue', swatches: ['#667eea', '#764ba2'] },
    { id: 'dark', name: 'Midnight Dark', swatches: ['#1e293b', '#6366f1'] },
    { id: 'green', name: 'Forest Green', swatches: ['#10b981', '#0d9488'] },
    { id: 'rose', name: 'Cherry Rose', swatches: ['#f43f5e', '#a855f7'] },
    { id: 'amber', name: 'Sunset Amber', swatches: ['#f59e0b', '#f97316'] },
  ];

  const ADMIN_THEME_MAP = {
    blue: {
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      pageBg: '#f1f5f9', cardBg: '#ffffff', border: '#e2e8f0',
      text: '#0f172a', muted: '#64748b', primary: '#6366f1',
      shadow: '0 10px 30px rgba(102,126,234,0.18)'
    },
    dark: {
      gradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      pageBg: '#0b1220', cardBg: '#1f2a44', border: '#2b3a55',
      text: '#f8fafc', muted: '#cbd5f1', primary: '#a5b4fc',
      shadow: '0 10px 30px rgba(0,0,0,0.45)'
    },
    green: {
      gradient: 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)',
      pageBg: '#ecfdf5', cardBg: '#ffffff', border: '#d1fae5',
      text: '#064e3b', muted: '#6b7280', primary: '#10b981',
      shadow: '0 10px 30px rgba(16,185,129,0.16)'
    },
    rose: {
      gradient: 'linear-gradient(135deg, #f43f5e 0%, #a855f7 100%)',
      pageBg: '#fff1f2', cardBg: '#ffffff', border: '#fecdd3',
      text: '#881337', muted: '#6b7280', primary: '#f43f5e',
      shadow: '0 10px 30px rgba(244,63,94,0.16)'
    },
    amber: {
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
      pageBg: '#fffbeb', cardBg: '#ffffff', border: '#fde68a',
      text: '#78350f', muted: '#6b7280', primary: '#f59e0b',
      shadow: '0 10px 30px rgba(245,158,11,0.16)'
    }
  };

  const adminTheme = ADMIN_THEME_MAP[activeTheme] || ADMIN_THEME_MAP.blue;

  async function handleSaveTheme(themeId) {
    setThemeLoading(true);
    try {
      await fetchWithAdmin('/api/admin/theme', {
        method: 'POST',
        body: JSON.stringify({ theme: themeId }),
      });
      setActiveTheme(themeId);
      setToast(`Tema "${ADMIN_THEMES.find((th) => th.id === themeId)?.name || themeId}" berhasil diterapkan`);
    } catch (err) {
      setToast(localizeErrorMessage(err?.message) || 'Gagal menyimpan tema');
    } finally {
      setThemeLoading(false);
    }
  }

  const navItems = [
    { key: 'overview', icon: 'bi-speedometer2', label: 'Ringkasan' },
    { key: 'aliases', icon: 'bi-at', label: 'Alias' },
    { key: 'inbox', icon: 'bi-inboxes', label: 'Kotak Masuk' },
    { key: 'logs', icon: 'bi-envelope-paper', label: 'Log Email' },
    { key: 'domains', icon: 'bi-globe2', label: 'Domain' },
    { key: 'api-keys', icon: 'bi-key', label: 'API Key' },
    { key: 'security', icon: 'bi-shield-lock', label: 'Keamanan' },
    { key: 'tampilan', icon: 'bi-palette', label: 'Tampilan' },
  ];

  return (
    <main
      className="admin-shell"
      style={{
        '--admin-page-bg': adminTheme.pageBg,
        '--admin-card-bg': adminTheme.cardBg,
        '--admin-border': adminTheme.border,
        '--admin-text': adminTheme.text,
        '--admin-muted': adminTheme.muted,
        '--admin-primary': adminTheme.primary,
        '--admin-hero': adminTheme.gradient,
        '--admin-shadow': adminTheme.shadow
      }}
    >
      <style suppressHydrationWarning>{`
        .admin-shell { background: var(--admin-page-bg); color: var(--admin-text); }
        .admin-sidebar {
          background: var(--admin-card-bg);
          border-right: 1px solid var(--admin-border);
          box-shadow: var(--admin-shadow);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .admin-sidebar.open { box-shadow: var(--admin-shadow); }
        .admin-sidebar-overlay { transition: opacity 0.2s ease; }
        .admin-brand-icon {
          background: var(--admin-hero);
          color: #fff;
          border-radius: 14px;
        }
        .admin-status-card,
        .admin-panel,
        .admin-kpi-card,
        .admin-guide {
          background: var(--admin-card-bg);
          border: 1px solid var(--admin-border);
          box-shadow: var(--admin-shadow);
          border-radius: 16px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .admin-panel:hover,
        .admin-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--admin-shadow);
        }
        .admin-topbar {
          background: var(--admin-hero);
          color: #fff;
          border-radius: 20px;
          padding: 1.25rem 1.5rem;
          margin: 1.25rem 0 1rem;
          box-shadow: var(--admin-shadow);
        }
        .admin-topbar-title,
        .admin-topbar-subtitle,
        .admin-mobile-toggle { color: #fff; }
        .admin-topbar-subtitle { opacity: 0.85; }
        .admin-topbar-actions .btn-outline-secondary,
        .admin-topbar-actions .btn-outline-danger {
          border-color: rgba(255,255,255,0.4);
          color: #fff;
        }
        .admin-topbar-actions .btn-outline-secondary:hover,
        .admin-topbar-actions .btn-outline-danger:hover {
          background: rgba(255,255,255,0.15);
        }
        .admin-nav-item {
          color: var(--admin-muted);
          display: flex;
          align-items: center;
          gap: 0.6rem;
          width: 100%;
          text-align: left;
          padding: 0.6rem 0.75rem;
          border-radius: 10px;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .admin-nav-item i { font-size: 0.95rem; width: 18px; text-align: center; }
        .admin-nav-item:hover { background: rgba(99, 102, 241, 0.12); color: var(--admin-text); }
        .admin-nav-item.active {
          background: var(--admin-primary);
          color: #fff;
        }
        .admin-shell .text-muted { color: var(--admin-muted) !important; }
        .admin-shell a { color: var(--admin-text); }
        .admin-shell a:hover { color: var(--admin-primary); }
        .admin-shell .bg-light { background: var(--admin-page-bg) !important; }
        .admin-shell .bg-white { background: var(--admin-card-bg) !important; }
        .admin-shell .list-group-item {
          background: var(--admin-card-bg);
          color: var(--admin-text);
          border-color: var(--admin-border);
        }
        .admin-shell .table {
          background: var(--admin-card-bg);
          color: var(--admin-text);
        }
        .admin-shell .table td,
        .admin-shell .table th {
          color: var(--admin-text) !important;
          border-color: var(--admin-border) !important;
        }
        .admin-shell .table > :not(caption) > * > * {
          background-color: var(--admin-card-bg) !important;
        }
        .admin-shell .table-hover > tbody > tr:hover > * {
          background-color: rgba(99, 102, 241, 0.14) !important;
        }
        .admin-shell .table-responsive {
          background: var(--admin-card-bg);
          border-radius: 12px;
        }
        .admin-shell .alert {
          background: var(--admin-page-bg);
          color: var(--admin-text);
          border-color: var(--admin-border);
        }
        .admin-shell .badge {
          color: var(--admin-text);
        }
        .admin-table tbody tr:hover { background: rgba(99, 102, 241, 0.14); }
        .admin-content {
          padding: 0.5rem 1.5rem 1.5rem;
        }
        .form-control,
        .form-select {
          background: var(--admin-card-bg);
          color: var(--admin-text);
          border: 1px solid var(--admin-border);
          border-radius: 10px;
          padding: 0.55rem 0.75rem;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .form-control:focus,
        .form-select:focus {
          border-color: var(--admin-primary);
          box-shadow: 0 0 0 0.2rem rgba(99, 102, 241, 0.2);
          outline: none;
        }
        .form-control::placeholder {
          color: var(--admin-muted);
          opacity: 0.8;
        }
        .btn {
          border-radius: 10px;
          transition: transform 0.15s ease, box-shadow 0.2s ease;
        }
        .btn:hover { transform: translateY(-1px); }
        .btn-primary {
          background: var(--admin-primary);
          border-color: var(--admin-primary);
        }
        .btn-outline-secondary,
        .btn-outline-danger {
          border-color: var(--admin-border);
          color: var(--admin-text);
        }
        .table {
          color: var(--admin-text);
        }
        .table th {
          background: var(--admin-page-bg);
          color: var(--admin-muted);
        }
        .admin-table {
          border-radius: 14px;
          overflow: hidden;
        }
        .admin-table tbody tr {
          border-top: 1px solid var(--admin-border);
        }
        .admin-table tbody tr:hover {
          background: rgba(99, 102, 241, 0.08);
        }
        .admin-pagination-bar {
          background: var(--admin-page-bg);
          border: 1px solid var(--admin-border);
          border-radius: 12px;
          padding: 0.45rem 0.75rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }
        .admin-page-controls { display: flex; align-items: center; gap: 0.4rem; }
        .admin-page-btn {
          border: 1px solid var(--admin-border);
          background: var(--admin-card-bg);
          color: var(--admin-text);
          border-radius: 8px;
          padding: 0.25rem 0.5rem;
          transition: transform 0.15s ease, box-shadow 0.2s ease;
        }
        .admin-page-btn:hover { transform: translateY(-1px); }
        .admin-page-info { font-size: 0.8rem; color: var(--admin-muted); }
        .admin-skeleton {
          background: linear-gradient(90deg, rgba(148,163,184,0.2), rgba(148,163,184,0.35), rgba(148,163,184,0.2));
          background-size: 200% 100%;
          animation: adminShimmer 1.2s ease-in-out infinite;
          border-radius: 12px;
        }
        .admin-skeleton-line { height: 12px; margin-top: 10px; }
        .admin-skeleton-card { padding: 1rem; }
        @keyframes adminShimmer {
          0% { background-position: 0% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <div
        className={`admin-sidebar-overlay${sidebarOpen ? ' active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="admin-brand">
          <div className="admin-brand-icon">
            <i className="bi bi-gear-fill" />
          </div>
          <div>
            <h1 className="admin-brand-title">PBS Admin</h1>
            <p className="admin-brand-subtitle">Dashboard Operasional</p>
          </div>
          <button
            className="admin-sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Tutup menu"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="admin-status-card">
          <p className="mb-1 text-muted small">Sesi</p>
          <p className="mb-2 fw-600 text-break" style={{ fontSize: '0.9rem' }}>{userEmail || '-'}</p>
          <span className={`badge ${status === 'connected' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>
            <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.55rem' }} />
            {status === 'connected' ? 'Terhubung' : 'Terputus'}
          </span>
        </div>

        <nav className="admin-nav" aria-label="Navigasi admin">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`admin-nav-item ${section === item.key ? 'active' : ''}`}
              onClick={() => { setSection(item.key); setSidebarOpen(false); }}
            >
              <i className={`bi ${item.icon}`} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-actions">
          <button className="btn btn-primary w-100" onClick={loadAll} disabled={loading || !accessToken}>
            <i className={`bi ${loading ? 'bi-hourglass-split' : 'bi-arrow-clockwise'} me-2`} />
            {loading ? 'Menyinkronkan...' : 'Sinkronkan Data'}
          </button>
          <Link href="/" className="btn btn-outline-secondary w-100">
            <i className="bi bi-arrow-left me-2" /> Kembali ke Aplikasi
          </Link>
        </div>
      </aside>

      <section className="admin-content">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              className="admin-mobile-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka menu navigasi"
            >
              <i className="bi bi-list" />
            </button>
            <div>
              <h2 className="admin-topbar-title">{navItems.find((n) => n.key === section)?.label || 'Ringkasan'}</h2>
              <p className="admin-topbar-subtitle">Kelola alias, pantau email masuk, dan atur keamanan sistem.</p>
            </div>
          </div>
          <div className="admin-topbar-actions">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={loadAll}
              disabled={loading || !accessToken}
              title="Sinkronkan data"
            >
              <i className={`bi ${loading ? 'bi-hourglass-split' : 'bi-arrow-clockwise'}`} />
            </button>
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={handleLogout}
              title="Keluar dari admin"
            >
              <i className="bi bi-box-arrow-right" />
            </button>
          </div>
        </header>

        {section === 'overview' && (
          <>
            <div className="admin-guide mb-3">
              <h6 className="mb-2">Panduan Cepat (Untuk Pengguna Baru)</h6>
              <div className="admin-guide-grid">
                <div className="admin-guide-item">
                  <strong>1. Atur Domain</strong>
                  <p className="mb-0">Masuk ke menu Domain, lalu tambahkan domain aktif yang boleh dipakai alias.</p>
                </div>
                <div className="admin-guide-item">
                  <strong>2. Buat Alias + Filter</strong>
                  <p className="mb-0">Di menu Alias, isi alamat alias lalu atur filter email agar sesuai kebutuhan.</p>
                </div>
                <div className="admin-guide-item">
                  <strong>3. Cek Kotak Masuk</strong>
                  <p className="mb-0">Di menu Kotak Masuk, admin bisa melihat semua email alias tanpa dibatasi filter.</p>
                </div>
                <div className="admin-guide-item">
                  <strong>4. Pantau Log</strong>
                  <p className="mb-0">Gunakan menu Log Email untuk audit aktivitas per alias secara cepat.</p>
                </div>
              </div>
            </div>

            {loading && !stats ? (
              <div className="admin-kpi-grid">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <div key={idx} className="admin-kpi-card admin-skeleton-card">
                    <div className="admin-skeleton" style={{ width: 36, height: 36, borderRadius: 12 }} />
                    <div className="admin-skeleton admin-skeleton-line" style={{ width: '60%' }} />
                    <div className="admin-skeleton" style={{ width: '40%', height: 22, marginTop: 12 }} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-kpi-grid">
                <article className="admin-kpi-card">
                  <div className="admin-kpi-icon bg-primary-subtle text-primary"><i className="bi bi-at" /></div>
                  <p className="admin-kpi-label">Total Alias</p>
                  <h3 className="admin-kpi-value">{stats?.totalAliases ?? aliasRows.length}</h3>
                </article>
                <article className="admin-kpi-card">
                  <div className="admin-kpi-icon bg-success-subtle text-success"><i className="bi bi-envelope-check" /></div>
                  <p className="admin-kpi-label">Log Email Tersimpan</p>
                  <h3 className="admin-kpi-value">{logs.length}</h3>
                </article>
                <article className="admin-kpi-card">
                  <div className="admin-kpi-icon bg-warning-subtle text-warning"><i className="bi bi-globe2" /></div>
                  <p className="admin-kpi-label">Domain Aktif</p>
                  <h3 className="admin-kpi-value">{activeDomains.length}</h3>
                </article>
                <article className="admin-kpi-card">
                  <div className="admin-kpi-icon bg-info-subtle text-info"><i className="bi bi-graph-up-arrow" /></div>
                  <p className="admin-kpi-label">Alias Dengan Trafik</p>
                  <h3 className="admin-kpi-value">{aliasesWithTraffic}</h3>
                </article>
                <article className="admin-kpi-card">
                  <div className="admin-kpi-icon bg-danger-subtle text-danger"><i className="bi bi-archive" /></div>
                  <p className="admin-kpi-label">Alias Diarsipkan</p>
                  <h3 className="admin-kpi-value">{inactiveAliases}</h3>
                </article>
              </div>
            )}

            <div className="row g-4 mt-1">
              <div className="col-12 col-xl-6">
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <h5 className="mb-0">Alias Paling Aktif</h5>
                    <button className="btn btn-sm btn-outline-primary" onClick={() => setSection('aliases')}>Kelola Alias</button>
                  </div>
                  {aliasRows.length === 0 ? (
                    <p className="text-muted small mb-0">Belum ada data alias.</p>
                  ) : (
                    <>
                      {overviewAliasPagination.total > 0 && (
                        <div className="admin-pagination-bar">
                          <small className="text-muted">{overviewAliasPagination.rows.length} / {overviewAliasPagination.total} alias</small>
                          <div className="admin-page-controls">
                            <button
                              className="admin-page-btn"
                              onClick={() => setOverviewAliasPage((p) => Math.max(1, p - 1))}
                              disabled={overviewAliasPagination.page <= 1}
                            >
                              <i className="bi bi-chevron-left" />
                            </button>
                            <span className="admin-page-info">{overviewAliasPagination.page} / {overviewAliasPagination.totalPages}</span>
                            <button
                              className="admin-page-btn"
                              onClick={() => setOverviewAliasPage((p) => Math.min(overviewAliasPagination.totalPages, p + 1))}
                              disabled={overviewAliasPagination.page >= overviewAliasPagination.totalPages}
                            >
                              <i className="bi bi-chevron-right" />
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0 admin-table">
                          <thead>
                            <tr>
                              <th>Alias</th>
                              <th className="text-end">Email</th>
                              <th className="text-end">Akses</th>
                            </tr>
                          </thead>
                          <tbody>
                            {overviewAliasPagination.rows.map((row) => (
                              <tr key={row.address}>
                                <td>
                                  <div className="fw-600 text-break">{row.address}</div>
                                  <small className="text-muted">Email terakhir: {formatDateTime(row.latestSeenAt)}</small>
                                </td>
                                <td className="text-end fw-600">{row.totalEmails}</td>
                                <td className="text-end">{row.hits}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="col-12 col-xl-6">
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <h5 className="mb-0">Email Masuk Terbaru</h5>
                    <button className="btn btn-sm btn-outline-primary" onClick={() => setSection('logs')}>Lihat Semua Log</button>
                  </div>
                  {logs.length === 0 ? (
                    <p className="text-muted small mb-0">Belum ada log email.</p>
                  ) : (
                    <>
                      {overviewLatestPagination.total > 0 && (
                        <div className="admin-pagination-bar">
                          <small className="text-muted">{overviewLatestPagination.rows.length} / {overviewLatestPagination.total} log</small>
                          <div className="admin-page-controls">
                            <button
                              className="admin-page-btn"
                              onClick={() => setOverviewLogPage((p) => Math.max(1, p - 1))}
                              disabled={overviewLatestPagination.page <= 1}
                            >
                              <i className="bi bi-chevron-left" />
                            </button>
                            <span className="admin-page-info">{overviewLatestPagination.page} / {overviewLatestPagination.totalPages}</span>
                            <button
                              className="admin-page-btn"
                              onClick={() => setOverviewLogPage((p) => Math.min(overviewLatestPagination.totalPages, p + 1))}
                              disabled={overviewLatestPagination.page >= overviewLatestPagination.totalPages}
                            >
                              <i className="bi bi-chevron-right" />
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="admin-timeline">
                        {overviewLatestPagination.rows.map((entry) => (
                          <div key={entry.id} className="admin-timeline-item">
                            <div className="admin-timeline-dot" />
                            <div className="admin-timeline-content">
                              <div className="d-flex justify-content-between align-items-start gap-2">
                                <strong className="text-break">{entry.alias || 'alias-tidak-dikenal'}</strong>
                                <small className="text-muted text-nowrap">{formatDateTime(entry.lastSeenAt)}</small>
                              </div>
                              <div className="small fw-500 text-break">{entry.subject || '(tanpa subjek)'}</div>
                              <div className="small text-muted text-break">{entry.from || '-'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {section === 'aliases' && (
          <div className="admin-section-stack">
            {/* === Form Buat Alias === */}
            <div className="admin-panel">
              <div className="admin-panel-header">
                <h5 className="mb-0"><i className="bi bi-plus-circle me-2" />Buat Alias Baru</h5>
              </div>

              <div className="p-4">
                {/* === Alamat Email - Style seperti halaman user === */}
                <label className="form-label fw-bold mb-2" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bs-secondary-color)' }}>
                  Alamat Email Anda
                </label>

                {/* Input group besar */}
                <div style={{
                  display: 'flex', alignItems: 'stretch',
                  border: '1.5px solid var(--bs-border-color)', borderRadius: '12px',
                  overflow: 'hidden', background: 'var(--bs-tertiary-bg)', marginBottom: '0.75rem',
                }}>
                  <input
                    value={aliasFormAddress.split('@')[0] || ''}
                    onChange={(e) => {
                      const domain = aliasFormAddress.includes('@') ? aliasFormAddress.split('@')[1] : (activeDomains[0]?.name || '');
                      setAliasFormAddress(e.target.value.replace(/\s+/g, '').toLowerCase() + (domain ? '@' + domain : ''));
                    }}
                    style={{
                      flex: 1, border: 'none', background: 'transparent',
                      padding: '0.875rem 1rem', fontSize: '1rem', fontWeight: 500,
                      outline: 'none', minWidth: 0,
                    }}
                    placeholder="username"
                    spellCheck="false"
                  />
                  <span style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', fontSize: '1rem', color: 'var(--bs-secondary-color)', fontWeight: 600 }}>@</span>
                  <select
                    value={aliasFormAddress.includes('@') ? aliasFormAddress.split('@')[1] : ''}
                    onChange={(e) => {
                      const local = aliasFormAddress.split('@')[0] || '';
                      setAliasFormAddress(local + '@' + e.target.value);
                    }}
                    style={{
                      border: 'none', background: 'transparent',
                      padding: '0.875rem 0.75rem', fontSize: '0.95rem', fontWeight: 500,
                      outline: 'none', cursor: 'pointer', maxWidth: 200, minWidth: 120,
                      appearance: 'none', WebkitAppearance: 'none',
                    }}
                  >
                    {activeDomains.length === 0 && <option value="">-</option>}
                    {activeDomains.map((d) => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {/* Actions row */}
                <div className="d-flex gap-2 mb-3" style={{ flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    style={{ borderRadius: '10px', padding: '0.6rem 1.25rem', fontWeight: 600, fontSize: '0.9rem' }}
                    onClick={saveAliasFilter}
                    disabled={loading || !aliasFormAddress.includes('@')}
                  >
                    <i className="bi bi-floppy me-2" />Simpan Alias
                  </button>
                  <button
                    className="btn btn-outline-primary"
                    style={{ borderRadius: '10px', padding: '0.6rem 1rem', fontWeight: 600, fontSize: '0.9rem' }}
                    type="button"
                    onClick={() => {
                      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
                      let rand = '';
                      for (let i = 0; i < 10; i++) rand += chars[Math.floor(Math.random() * chars.length)];
                      const domain = aliasFormAddress.includes('@') ? aliasFormAddress.split('@')[1] : (activeDomains[0]?.name || '');
                      setAliasFormAddress(rand + (domain ? '@' + domain : ''));
                    }}
                  >
                    <i className="bi bi-shuffle me-1" />Acak
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    style={{ borderRadius: '10px', padding: '0.6rem 1rem', fontWeight: 600, fontSize: '0.9rem' }}
                    onClick={resetAliasForm}
                  >
                    <i className="bi bi-eraser me-1" />Reset
                  </button>
                </div>

                {/* Preview alamat */}
                {aliasFormAddress && aliasFormAddress.includes('@') && (
                  <div className="rounded-3 px-3 py-2 mb-3" style={{ background: 'rgba(var(--bs-primary-rgb), 0.06)', border: '1px solid rgba(var(--bs-primary-rgb), 0.15)', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                    <i className="bi bi-envelope-fill text-primary me-2" />{aliasFormAddress}
                  </div>
                )}

                {/* === PIN Proteksi === */}
                <div className="mb-3">
                  <label className="form-label fw-bold mb-2" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bs-secondary-color)' }}>
                    <i className="bi bi-shield-lock me-1" />PIN Proteksi
                  </label>
                  <div style={{
                    display: 'flex', alignItems: 'stretch',
                    border: '1.5px solid var(--bs-border-color)', borderRadius: '12px',
                    overflow: 'hidden', background: 'var(--bs-tertiary-bg)',
                    maxWidth: 360,
                  }}>
                    <span style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', color: 'var(--bs-secondary-color)' }}>
                      <i className="bi bi-lock" />
                    </span>
                    <input
                      value={aliasPin}
                      onChange={(e) => setAliasPin(e.target.value)}
                      style={{
                        flex: 1, border: 'none', background: 'transparent',
                        padding: '0.75rem 0.5rem', fontSize: '1rem', fontWeight: 500,
                        outline: 'none', letterSpacing: '0.1em',
                      }}
                      placeholder="Kosongkan jika tidak pakai"
                      type="text"
                      autoComplete="off"
                    />
                  </div>
                  <small className="text-muted d-block mt-1">User harus masukkan PIN ini untuk membuka inbox alias.</small>
                </div>

                {/* Filter - React-controlled toggle */}
                <div className="mb-3">
                  <button
                    className="btn btn-sm w-100 d-flex align-items-center justify-content-between"
                    type="button"
                    onClick={() => setAliasFilterOpen((v) => !v)}
                    style={{
                      background: aliasFilterOpen ? 'rgba(var(--bs-primary-rgb), 0.08)' : 'var(--bs-tertiary-bg)',
                      border: aliasFilterOpen ? '1px solid rgba(var(--bs-primary-rgb), 0.25)' : '1px solid var(--bs-border-color)',
                      borderRadius: '8px',
                      padding: '0.6rem 1rem',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>
                      <i className={`bi ${aliasFilterOpen ? 'bi-funnel-fill text-primary' : 'bi-funnel'} me-2`} />
                      Filter Email {aliasFilterOpen ? '' : '(opsional)'}
                    </span>
                    <i className={`bi bi-chevron-${aliasFilterOpen ? 'up' : 'down'} text-muted`} style={{ fontSize: '0.75rem' }} />
                  </button>
                  {aliasFilterOpen && (
                    <div className="mt-2 p-3 rounded-3" style={{ background: 'var(--bs-tertiary-bg)', border: '1px solid var(--bs-border-color)' }}>
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <span className="small fw-bold text-muted">Aturan Filter</span>
                        <button className="btn btn-xs btn-outline-info" type="button" onClick={applyNetflixPreset}>
                          <i className="bi bi-lightning-charge me-1" />Preset Netflix
                        </button>
                      </div>
                      <div className="row g-2">
                        <div className="col-12 col-md-6">
                          <label className="form-label small mb-1">Subjek Persis</label>
                          <input className="form-control form-control-sm" placeholder="kode akses sementaramu" value={aliasSubjectExact} onChange={(e) => setAliasSubjectExact(e.target.value)} />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label small mb-1">Subjek Mengandung</label>
                          <input className="form-control form-control-sm" placeholder="kode akses, verifikasi" value={aliasSubjectIncludes} onChange={(e) => setAliasSubjectIncludes(e.target.value)} />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label small mb-1">Subjek Dikecualikan</label>
                          <input className="form-control form-control-sm" placeholder="newsletter, promosi" value={aliasSubjectExcludes} onChange={(e) => setAliasSubjectExcludes(e.target.value)} />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label small mb-1">Pengirim Mengandung</label>
                          <input className="form-control form-control-sm" placeholder="no-reply@x.com" value={aliasSenderIncludes} onChange={(e) => setAliasSenderIncludes(e.target.value)} />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label small mb-1">Kata Kunci</label>
                          <input className="form-control form-control-sm" placeholder="kode verifikasi, akun" value={aliasKeywordIncludes} onChange={(e) => setAliasKeywordIncludes(e.target.value)} />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label small mb-1">Regex Kustom</label>
                          <input className="form-control form-control-sm" placeholder="(otp|code)\\s*..." value={aliasCustomRegex} onChange={(e) => setAliasCustomRegex(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* === Daftar Alias === */}
            <div className="admin-panel admin-table-card">
              <div className="admin-panel-header">
                <h5 className="mb-0"><i className="bi bi-list-ul me-2" />Daftar Alias</h5>
              </div>

              {/* Search + Sort - satu baris */}
              <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--bs-border-color)' }}>
                <div className="d-flex gap-2 align-items-center">
                  <div style={{ flex: 1, position: 'relative' }}>
                    <i className="bi bi-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--bs-secondary-color)', fontSize: '0.8rem' }} />
                    <input
                      className="form-control form-control-sm"
                      placeholder="Cari alias..."
                      value={aliasQuery}
                      onChange={(e) => setAliasQuery(e.target.value)}
                      style={{ paddingLeft: '2rem' }}
                    />
                  </div>
                  <select className="form-select form-select-sm" style={{ width: 'auto', minWidth: 120 }} value={aliasSort} onChange={(e) => setAliasSort(e.target.value)}>
                    <option value="activity">Aktivitas</option>
                    <option value="newest">Terbaru</option>
                    <option value="address">Alamat</option>
                  </select>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ borderBottom: '1px solid var(--bs-border-color)', padding: '0 1rem' }}>
                <div className="d-flex" style={{ gap: '0' }}>
                  {[
                    { key: 'all', label: 'Semua', icon: 'bi-collection', count: pagedAliases.length },
                    { key: 'configured', label: 'Dikonfigurasi', icon: 'bi-gear-fill', count: pagedAliases.filter((r) => hasAliasConfig(r)).length },
                    { key: 'plain', label: 'Tanpa Konfigurasi', icon: 'bi-envelope', count: pagedAliases.filter((r) => !hasAliasConfig(r)).length },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setAliasListTab(tab.key)}
                      style={{
                        border: 'none', background: 'none',
                        borderBottom: aliasListTab === tab.key ? '2.5px solid var(--bs-primary)' : '2.5px solid transparent',
                        borderRadius: 0, fontSize: '0.82rem', fontWeight: 600,
                        padding: '0.65rem 1rem',
                        color: aliasListTab === tab.key ? 'var(--bs-primary)' : 'var(--bs-secondary-color)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      <i className={`bi ${tab.icon} me-1`} />{tab.label}
                      <span className="ms-1" style={{ fontSize: '0.7rem', opacity: 0.7 }}>({tab.count})</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="admin-pagination-bar">
                <small className="text-muted">{aliasPagination.total} alias total</small>
                <div className="admin-page-controls">
                  <button className="admin-page-btn" onClick={() => setAliasPage((p) => Math.max(1, p - 1))} disabled={aliasPagination.page <= 1}>
                    <i className="bi bi-chevron-left" />
                  </button>
                  <span className="admin-page-info">{aliasPagination.page} / {aliasPageCount}</span>
                  <button className="admin-page-btn" onClick={() => setAliasPage((p) => Math.min(aliasPageCount, p + 1))} disabled={aliasPagination.page >= aliasPageCount}>
                    <i className="bi bi-chevron-right" />
                  </button>
                </div>
              </div>

              {/* Table */}
              {(() => {
                let rows = pagedAliases;
                if (aliasListTab === 'configured') rows = pagedAliases.filter((r) => hasAliasConfig(r));
                else if (aliasListTab === 'plain') rows = pagedAliases.filter((r) => !hasAliasConfig(r));

                if (rows.length === 0) return (
                  <div className="admin-empty p-4">
                    <i className="bi bi-at" />
                    <p>Tidak ada alias di tab ini.</p>
                  </div>
                );

                return (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 admin-table">
                      <thead><tr>
                        <th>Alias</th>
                        <th className="d-none d-lg-table-cell">Dibuat</th>
                        <th className="text-end">Email</th>
                        <th>Konfigurasi</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr></thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.address}>
                            <td><div className="fw-600 text-break">{row.address}</div></td>
                            <td className="text-nowrap d-none d-lg-table-cell">{formatCompactDate(row.createdAt)}</td>
                            <td className="text-end fw-600">{row.totalEmails}</td>
                            <td>
                              <div className="d-flex gap-1 flex-wrap">
                                {hasActiveFilterConfig(row.filterConfig || {}) && (
                                  <span className="badge bg-primary-subtle text-primary">Filter</span>
                                )}
                                {row.pinHash && (
                                  <span className="badge bg-warning-subtle text-warning">PIN</span>
                                )}
                                {!hasActiveFilterConfig(row.filterConfig || {}) && !row.pinHash && (
                                  <span className="badge bg-secondary-subtle text-secondary">-</span>
                                )}
                              </div>
                            </td>
                            <td><span className={`badge ${row.active ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}>{row.active ? 'Aktif' : 'Arsip'}</span></td>
                            <td>
                              <div className="admin-row-actions">
                                <button className="btn btn-sm btn-icon btn-outline-secondary" title="Edit" onClick={() => editAliasFilter(row)}><i className="bi bi-pencil" /></button>
                                <button className="btn btn-sm btn-icon btn-outline-success" title="Inbox" onClick={() => { setInboxAlias(row.address); setSection('inbox'); }}><i className="bi bi-inbox" /></button>
                                <button className="btn btn-sm btn-icon btn-outline-danger" title="Arsipkan" onClick={() => removeAlias(row.address)} disabled={loading}><i className="bi bi-archive" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

                {section === 'inbox' && (
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h5 className="mb-0"><i className="bi bi-inbox-fill me-2" />Kotak Masuk Admin</h5>
            </div>

            {/* Alias picker - searchable */}
            <div className="px-3 pt-3 pb-2">
              <label className="form-label small fw-bold mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bs-secondary-color)', fontSize: '0.75rem' }}>
                Pilih Alias
              </label>
              <div className="d-flex gap-2 align-items-center mb-2">
                <div style={{ flex: 1, position: 'relative' }}>
                  <i className="bi bi-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--bs-secondary-color)', fontSize: '0.8rem' }} />
                  <input
                    className="form-control form-control-sm"
                    placeholder="Ketik untuk cari alias..."
                    value={inboxAlias}
                    onChange={(e) => setInboxAlias(e.target.value)}
                    style={{ paddingLeft: '2rem' }}
                    list="inbox-alias-list"
                  />
                  <datalist id="inbox-alias-list">
                    {aliasRows.map((row) => (
                      <option key={row.address} value={row.address} />
                    ))}
                  </datalist>
                </div>
                <button className="btn btn-sm btn-primary" style={{ borderRadius: '8px', padding: '0.45rem 1rem', fontWeight: 600 }} onClick={() => loadAdminInbox()} disabled={inboxLoading || !inboxAlias}>
                  {inboxLoading ? (<><span className="spinner-border spinner-border-sm me-1" />Memuat</>) : (<><i className="bi bi-arrow-right me-1" />Muat</>)}
                </button>
              </div>
              {inboxAlias && inboxAlias.includes('@') && (
                <div className="rounded-2 px-3 py-2 small" style={{ background: 'rgba(var(--bs-primary-rgb), 0.06)', border: '1px solid rgba(var(--bs-primary-rgb), 0.15)', fontFamily: 'monospace' }}>
                  <i className="bi bi-envelope-fill text-primary me-2" />{inboxAlias}
                </div>
              )}
            </div>

            {/* Toolbar - search + sort */}
            {inboxMessages.length > 0 && (
              <div className="px-3 py-2" style={{ borderTop: '1px solid var(--bs-border-color)', borderBottom: '1px solid var(--bs-border-color)' }}>
                <div className="d-flex gap-2 align-items-center">
                  <div style={{ flex: 1, position: 'relative' }}>
                    <i className="bi bi-funnel" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--bs-secondary-color)', fontSize: '0.8rem' }} />
                    <input
                      className="form-control form-control-sm"
                      placeholder="Filter subjek, pengirim..."
                      value={inboxQuery}
                      onChange={(e) => setInboxQuery(e.target.value)}
                      style={{ paddingLeft: '2rem' }}
                    />
                  </div>
                  <select className="form-select form-select-sm" style={{ width: 'auto', minWidth: 110 }} value={inboxSort} onChange={(e) => setInboxSort(e.target.value)}>
                    <option value="baru">Terbaru</option>
                    <option value="lama">Terlama</option>
                  </select>
                  <span className="badge bg-primary-subtle text-primary" style={{ whiteSpace: 'nowrap' }}>
                    {inboxPagination.total} email
                  </span>
                </div>
              </div>
            )}

            {/* Pagination */}
            {inboxMessages.length > 0 && (
              <div className="admin-pagination-bar">
                <small className="text-muted">{inboxPagination.total} email</small>
                <div className="admin-page-controls">
                  <button className="admin-page-btn" onClick={() => setInboxPage((p) => Math.max(1, p - 1))} disabled={inboxPagination.page <= 1}>
                    <i className="bi bi-chevron-left" />
                  </button>
                  <span className="admin-page-info">{inboxPagination.page} / {inboxPagination.totalPages}</span>
                  <button className="admin-page-btn" onClick={() => setInboxPage((p) => Math.min(inboxPagination.totalPages, p + 1))} disabled={inboxPagination.page >= inboxPagination.totalPages}>
                    <i className="bi bi-chevron-right" />
                  </button>
                </div>
              </div>
            )}

            {/* Email list - card style */}
            <div>
              {!inboxAlias && inboxMessages.length === 0 && (
                <div className="p-4 text-center">
                  <div style={{ width: 52, height: 52, borderRadius: '14px', margin: '0 auto 0.75rem', background: 'var(--bs-tertiary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="bi bi-inbox" style={{ fontSize: '1.4rem', color: 'var(--bs-secondary-color)' }} />
                  </div>
                  <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Pilih alias untuk melihat email</p>
                  <p className="text-muted small mb-0">Ketik nama alias di kolom pencarian di atas, lalu klik Muat.</p>
                </div>
              )}
              {inboxAlias && inboxMessages.length === 0 && !inboxLoading && (
                <div className="admin-empty p-4">
                  <i className="bi bi-envelope-open" />
                  <p>Belum ada email untuk alias ini.</p>
                </div>
              )}
              {inboxPagination.rows.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => openAdminMessage(msg.id)}
                  style={{
                    padding: '0.85rem 1.25rem',
                    borderBottom: '1px solid var(--bs-border-color)',
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  className="admin-log-item"
                  title="Klik untuk buka isi email"
                >
                  <div className="d-flex align-items-start justify-content-between gap-2 mb-1">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {msg.subject || '(tanpa subjek)'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--bs-secondary-color)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {msg.from || '-'}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--bs-secondary-color)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {formatDateTime(msg.date)}
                    </div>
                  </div>
                  {msg.snippet && (
                    <p style={{
                      margin: 0, fontSize: '0.8rem', color: 'var(--bs-secondary-color)',
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                    }}>
                      {msg.snippet}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'logs' && (
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h5 className="mb-0"><i className="bi bi-clock-history me-2" />Log Email</h5>
            </div>

            {/* Toolbar - satu baris */}
            <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--bs-border-color)' }}>
              <div className="d-flex gap-2 align-items-center flex-wrap">
                <select className="form-select form-select-sm" style={{ width: 'auto', minWidth: 140 }} value={selectedAlias} onChange={(e) => setSelectedAlias(e.target.value)}>
                  <option value="">Semua alias</option>
                  {aliasRows.map((row) => (
                    <option key={row.address} value={row.address}>{row.address}</option>
                  ))}
                </select>
                <div style={{ flex: 1, position: 'relative', minWidth: 150 }}>
                  <i className="bi bi-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--bs-secondary-color)', fontSize: '0.8rem' }} />
                  <input
                    className="form-control form-control-sm"
                    placeholder="Cari subjek, pengirim..."
                    value={logQuery}
                    onChange={(e) => setLogQuery(e.target.value)}
                    style={{ paddingLeft: '2rem' }}
                  />
                </div>
                <select className="form-select form-select-sm" style={{ width: 'auto', minWidth: 110 }} value={logSort} onChange={(e) => setLogSort(e.target.value)}>
                  <option value="latest">Terbaru</option>
                  <option value="lama">Terlama</option>
                </select>
                <button className="btn btn-sm btn-outline-danger" onClick={clearAllLogs} disabled={loading || logs.length === 0} title="Bersihkan semua log">
                  <i className="bi bi-trash3 me-1" />Hapus
                </button>
              </div>
            </div>

            {/* Pagination */}
            <div className="admin-pagination-bar">
              <small className="text-muted">{logPagination.total} email tercatat</small>
              <div className="admin-page-controls">
                <button className="admin-page-btn" onClick={() => setLogPage((p) => Math.max(1, p - 1))} disabled={logPagination.page <= 1}>
                  <i className="bi bi-chevron-left" />
                </button>
                <span className="admin-page-info">{logPagination.page} / {logPagination.totalPages}</span>
                <button className="admin-page-btn" onClick={() => setLogPage((p) => Math.min(logPagination.totalPages, p + 1))} disabled={logPagination.page >= logPagination.totalPages}>
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>

            {/* Log list - card style */}
            <div>
              {logPagination.rows.length === 0 && (
                <div className="admin-empty p-4">
                  <i className="bi bi-envelope-open" />
                  <p>Tidak ada log yang sesuai filter.</p>
                </div>
              )}
              {logPagination.rows.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => openAdminMessage(entry.id)}
                  style={{
                    padding: '0.85rem 1.25rem',
                    borderBottom: '1px solid var(--bs-border-color)',
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  className="admin-log-item"
                  title="Klik untuk buka isi email"
                >
                  <div className="d-flex align-items-start justify-content-between gap-2 mb-1">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.subject || '(tanpa subjek)'}
                      </div>
                      <div className="d-flex align-items-center gap-2 mt-1" style={{ fontSize: '0.78rem' }}>
                        <span className="text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                          {entry.from || '-'}
                        </span>
                        <span className="badge bg-primary-subtle text-primary" style={{ fontSize: '0.68rem', fontWeight: 600 }}>
                          {entry.alias || '?'}
                        </span>
                      </div>
                    </div>
                    <div className="text-end" style={{ flexShrink: 0 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--bs-secondary-color)', whiteSpace: 'nowrap' }}>
                        {formatDateTime(entry.date)}
                      </div>
                    </div>
                  </div>
                  {entry.snippet && (
                    <p style={{
                      margin: 0, fontSize: '0.8rem', color: 'var(--bs-secondary-color)',
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                    }}>
                      {entry.snippet}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <style>{`
              .admin-log-item:hover { background: var(--bs-tertiary-bg) !important; }
            `}</style>
          </div>
        )}

        {section === 'domains' && (
          <div className="admin-panel">
            <div className="admin-panel-header flex-wrap gap-2">
              <h5 className="mb-0">Manajemen Domain</h5>
              <div className="admin-toolbar-group">
                <input
                  className="form-control form-control-sm admin-toolbar-field"
                  placeholder="Cari domain..."
                  value={domainQuery}
                  onChange={(e) => setDomainQuery(e.target.value)}
                />
                <select className="form-select form-select-sm admin-toolbar-field" value={domainFilterStatus} onChange={(e) => setDomainFilterStatus(e.target.value)}>
                  <option value="all">Status: Semua</option>
                  <option value="aktif">Status: Aktif</option>
                  <option value="nonaktif">Status: Nonaktif</option>
                </select>
              </div>
            </div>

            <div className="admin-add-row">
              <label className="form-label mb-0">Domain baru:</label>
              <input
                className="form-control form-control-sm"
                placeholder="example.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
              />
              <button className="btn btn-sm btn-primary" onClick={handleAddDomain} disabled={!newDomain.trim()}>
                <i className="bi bi-plus-lg me-1" />Tambah Domain
              </button>
            </div>

            <div className="admin-pagination-bar">
              <small className="text-muted">{domainPagination.rows.length} / {domainPagination.total} domain</small>
              <div className="admin-page-controls">
                <button
                  className="admin-page-btn"
                  onClick={() => setDomainPage((p) => Math.max(1, p - 1))}
                  disabled={domainPagination.page <= 1}
                >
                  <i className="bi bi-chevron-left" />
                </button>
                <span className="admin-page-info">{domainPagination.page} / {domainPagination.totalPages}</span>
                <button
                  className="admin-page-btn"
                  onClick={() => setDomainPage((p) => Math.min(domainPagination.totalPages, p + 1))}
                  disabled={domainPagination.page >= domainPagination.totalPages}
                >
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 admin-table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Dibuat</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {domainRows.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <div className="admin-empty">
                          <i className="bi bi-globe2" />
                          <p>Belum ada domain yang dikonfigurasi.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {domainPagination.rows.map((domain) => (
                    <tr key={domain.name}>
                      <td className="fw-600">{domain.name}</td>
                      <td className="text-nowrap">{formatCompactDate(domain.createdAt)}</td>
                      <td>
                        <span className={`badge ${domain.active !== false ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}>
                          {domain.active !== false ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td>
                        <div className="admin-row-actions">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => toggleDomain(domain.name, domain.active === false)}
                            disabled={loading}
                          >
                            {domain.active !== false ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button className="btn btn-sm btn-icon btn-outline-danger" title="Hapus domain" onClick={() => removeDomain(domain.name)} disabled={loading}>
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {section === 'api-keys' && (
          <div className="row g-4">
            <div className="col-12 col-xl-5">
              <div className="admin-panel h-100">
                <h5 className="mb-1">Buat API Key Partner</h5>
                <p className="text-muted small mb-3">
                  Key digunakan pihak ketiga untuk generate alias email, baca inbox, dan ambil OTP.
                </p>

                <div className={`alert ${partnerApiEnabled ? 'alert-success' : 'alert-warning'} py-2 small`}>
                  <strong>Status Partner API:</strong> {partnerApiEnabled ? 'Aktif' : 'Nonaktif'}
                </div>

                {issuedApiKeySecret && (
                  <div className="alert alert-info">
                    <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                      <strong>API Key Baru</strong>
                      <button className="btn btn-sm btn-outline-primary" onClick={copyIssuedApiKey}>
                        <i className="bi bi-clipboard me-1" /> Salin
                      </button>
                    </div>
                    <code className="d-block text-break">{issuedApiKeySecret}</code>
                    <small className="text-muted">Simpan key ini sekarang. Nilainya tidak akan ditampilkan ulang.</small>
                  </div>
                )}

                <div className="row g-2">
                  <div className="col-12">
                    <label className="form-label small mb-1">Nama Key</label>
                    <input
                      className="form-control form-control-sm"
                      placeholder="Partner A - Production"
                      value={apiKeyName}
                      onChange={(e) => setApiKeyName(e.target.value)}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small mb-1">Scopes (pisahkan koma)</label>
                    <input
                      className="form-control form-control-sm"
                      placeholder="alias:create, messages:read, otp:read"
                      value={apiKeyScopes}
                      onChange={(e) => setApiKeyScopes(e.target.value)}
                    />
                  </div>

                  <div className="col-6">
                    <label className="form-label small mb-1">Rate Limit / Menit</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control form-control-sm"
                      value={apiKeyRateLimit}
                      onChange={(e) => setApiKeyRateLimit(e.target.value)}
                    />
                  </div>

                  <div className="col-6">
                    <label className="form-label small mb-1">Expires At (opsional)</label>
                    <input
                      type="datetime-local"
                      className="form-control form-control-sm"
                      value={apiKeyExpiresAt}
                      onChange={(e) => setApiKeyExpiresAt(e.target.value)}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small mb-1">Allowed Domains (opsional)</label>
                    <input
                      className="form-control form-control-sm"
                      placeholder="example.com, example.org"
                      value={apiKeyAllowedDomains}
                      onChange={(e) => setApiKeyAllowedDomains(e.target.value)}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small mb-1">Allowed IPs (opsional)</label>
                    <input
                      className="form-control form-control-sm"
                      placeholder="203.0.113.10, 198.51.100.7"
                      value={apiKeyAllowedIps}
                      onChange={(e) => setApiKeyAllowedIps(e.target.value)}
                    />
                  </div>
                </div>

                <div className="d-flex gap-2 mt-3">
                  <button className="btn btn-sm btn-primary" onClick={createApiKey}>
                    <i className="bi bi-key me-1" /> Buat Key
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={resetApiKeyForm}>
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="col-12 col-xl-7">
              <div className="admin-panel h-100">
                <div className="admin-panel-header flex-wrap gap-2">
                  <h5 className="mb-0">Daftar API Key</h5>
                  <input
                    className="form-control form-control-sm admin-toolbar-field"
                    placeholder="Cari nama key / scope / prefix"
                    value={apiKeyQuery}
                    onChange={(e) => setApiKeyQuery(e.target.value)}
                  />
                </div>

                <div className="admin-pagination-bar">
                  <small className="text-muted">{apiKeyPagination.rows.length} / {apiKeyPagination.total} key</small>
                  <div className="admin-page-controls">
                    <button
                      className="admin-page-btn"
                      onClick={() => setApiKeyPage((p) => Math.max(1, p - 1))}
                      disabled={apiKeyPagination.page <= 1}
                    >
                      <i className="bi bi-chevron-left" />
                    </button>
                    <span className="admin-page-info">{apiKeyPagination.page} / {apiKeyPagination.totalPages}</span>
                    <button
                      className="admin-page-btn"
                      onClick={() => setApiKeyPage((p) => Math.min(apiKeyPagination.totalPages, p + 1))}
                      disabled={apiKeyPagination.page >= apiKeyPagination.totalPages}
                    >
                      <i className="bi bi-chevron-right" />
                    </button>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0 admin-table">
                    <thead>
                      <tr>
                        <th>Nama</th>
                        <th>Prefix</th>
                        <th>Scopes</th>
                        <th>Status</th>
                        <th>Dibuat</th>
                        <th className="text-end">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiKeyRows.length === 0 && (
                        <tr>
                          <td colSpan={6}>
                            <div className="admin-empty">
                              <i className="bi bi-key" />
                              <p>Belum ada API key partner.</p>
                            </div>
                          </td>
                        </tr>
                      )}

                      {apiKeyPagination.rows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <div className="fw-600 text-break">{row.name || '-'}</div>
                            <small className="text-muted text-break">{row.id}</small>
                          </td>
                          <td><code>{row.keyPrefix || '-'}</code></td>
                          <td>
                            <small className="text-break">{(row.scopes || []).join(', ') || '-'}</small>
                          </td>
                          <td>
                            <span className={`badge ${row.active ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}>
                              {row.active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="text-nowrap">{formatCompactDate(row.createdAt)}</td>
                          <td>
                            <div className="admin-row-actions justify-content-end">
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => rotateApiKeyRecord(row)}
                                disabled={!row.active}
                                title="Rotate key"
                              >
                                Rotate
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => revokeApiKeyRecord(row)}
                                disabled={!row.active}
                                title="Revoke key"
                              >
                                Revoke
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {section === 'tampilan' && (
          <div className="row g-4">
            <div className="col-12 col-lg-8">
              <div className="admin-panel">
                <h5 className="mb-1">Tema Halaman Utama</h5>
                <p className="text-muted small mb-4">
                  Pilih tema warna yang akan ditampilkan kepada pengguna di halaman utama PBS Mail.
                  Perubahan langsung tersimpan dan berlaku untuk semua pengguna.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                  {ADMIN_THEMES.map((th) => (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => handleSaveTheme(th.id)}
                      disabled={themeLoading}
                      style={{
                        border: `2px solid ${activeTheme === th.id ? th.swatches[0] : 'transparent'}`,
                        borderRadius: '16px',
                        padding: '1rem',
                        background: activeTheme === th.id ? `${th.swatches[0]}12` : 'var(--bs-body-bg, #ffffff)',
                        cursor: themeLoading ? 'wait' : 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                        boxShadow: activeTheme === th.id ? `0 0 0 1px ${th.swatches[0]}40, 0 4px 12px ${th.swatches[0]}25` : '0 1px 4px rgba(0,0,0,0.08)',
                      }}
                    >
                      {/* Color swatch strip */}
                      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.75rem' }}>
                        {th.swatches.map((clr, i) => (
                          <div key={i} style={{ flex: 1, height: 28, borderRadius: '6px', background: clr }} />
                        ))}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{th.name}</div>
                      {activeTheme === th.id && (
                        <div style={{ fontSize: '0.75rem', color: th.swatches[0], marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <i className="bi bi-check-circle-fill" /> Aktif
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {themeLoading && (
                  <div className="d-flex align-items-center gap-2 mt-3 text-muted">
                    <div className="spinner-border spinner-border-sm" role="status" />
                    <span className="small">Menyimpan tema...</span>
                  </div>
                )}
              </div>
            </div>
            <div className="col-12 col-lg-4">
              <div className="admin-panel h-100">
                <h5 className="mb-3">Pratinjau Warna</h5>
                {(() => {
                  const th = ADMIN_THEMES.find((x) => x.id === activeTheme) || ADMIN_THEMES[0];
                  return (
                    <>
                      <div style={{
                        borderRadius: '12px', overflow: 'hidden',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                        border: '1px solid rgba(0,0,0,0.07)',
                      }}>
                        <div style={{
                          background: `linear-gradient(135deg, ${th.swatches[0]}, ${th.swatches[1]})`,
                          padding: '1.25rem 1rem', color: '#fff',
                        }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.2rem' }}>PBS Mail</div>
                          <div style={{ opacity: 0.8, fontSize: '0.78rem' }}>Email Sementara, Tanpa Ribet</div>
                        </div>
                        <div style={{ padding: '1rem', background: '#fff' }}>
                          <div style={{
                            border: `1.5px solid ${th.swatches[0]}40`,
                            borderRadius: '8px', padding: '0.7rem 1rem',
                            fontSize: '0.8rem', color: '#64748b', fontFamily: 'monospace',
                            marginBottom: '0.75rem', background: '#f8fafc',
                          }}>
                            alias@domain.com
                          </div>
                          <div style={{
                            background: th.swatches[0], color: '#fff',
                            borderRadius: '8px', padding: '0.6rem 1rem',
                            fontSize: '0.82rem', fontWeight: 600, textAlign: 'center',
                          }}>
                            Salin Alamat
                          </div>
                        </div>
                      </div>
                      <p className="small text-muted mt-3 mb-0">
                        Tema <strong>{th.name}</strong> saat ini aktif.
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {section === 'security' && (
          <div className="row g-4">
            <div className="col-12 col-lg-6">
              <div className="admin-panel h-100">
                <h5 className="mb-3">Kontrol OAuth</h5>
                <p className="text-muted small">Kelola siklus token Gmail dengan aman dari satu tempat.</p>
                <div className="d-grid gap-2">
                  <Link href="/login" target="_blank" className="btn btn-primary">
                    <i className="bi bi-google me-2" /> Mulai OAuth
                  </Link>
                  <button className="btn btn-outline-danger" onClick={revokeToken} disabled={loading}>
                    <i className="bi bi-shield-x me-2" /> Cabut Token
                  </button>
                </div>
              </div>
            </div>
            <div className="col-12 col-lg-6">
              <div className="admin-panel h-100">
                <h5 className="mb-3">Ringkasan Penyimpanan & Kesehatan</h5>
                <ul className="list-group list-group-flush">
                  <li className="list-group-item d-flex justify-content-between px-0">
                    <span className="text-muted">Mode Penyimpanan</span>
                    <strong>{stats?.storage?.mode || '-'}</strong>
                  </li>
                  <li className="list-group-item d-flex justify-content-between px-0">
                    <span className="text-muted">Total Domain</span>
                    <strong>{domains.length}</strong>
                  </li>
                  <li className="list-group-item d-flex justify-content-between px-0">
                    <span className="text-muted">Total Akses Alias</span>
                    <strong>{stats?.totalHits ?? aliasRows.reduce((sum, r) => sum + (r.hits || 0), 0)}</strong>
                  </li>
                  <li className="list-group-item d-flex justify-content-between px-0">
                    <span className="text-muted">Alias Terbaru</span>
                    <strong>{formatCompactDate(stats?.lastAliasCreatedAt)}</strong>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>

      {inboxDetail && (
        <div className="modal fade show d-block" style={{ background: 'rgba(15,23,42,0.45)' }} onClick={() => setInboxDetail(null)}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header border-0 bg-light">
                <div className="w-100 d-flex align-items-start justify-content-between gap-2">
                  <div>
                    <h5 className="modal-title mb-1">{inboxDetail.loading ? 'Memuat pesan...' : inboxDetail.subject || '(tanpa subjek)'}</h5>
                    {!inboxDetail.loading && !inboxDetail.error && (
                      <small className="text-muted">{inboxDetail.from || '-'} | {formatDateTime(inboxDetail.date)}</small>
                    )}
                  </div>
                  <button type="button" className="btn-close" onClick={() => setInboxDetail(null)} />
                </div>
              </div>
              <div className="modal-body">
                {inboxDetail.loading && (
                  <div className="text-center text-muted py-5">
                    <div className="spinner-border spinner-border-sm mb-2" role="status" />
                    <div className="small">Memuat detail pesan...</div>
                  </div>
                )}
                {inboxDetail.error && (
                  <div className="alert alert-danger mb-0">{inboxDetail.error}</div>
                )}
                {!inboxDetail.loading && !inboxDetail.error && (
                  <div className="admin-message-view">
                    {inboxDetail.bodyHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: inboxDetail.bodyHtml }} />
                    ) : inboxDetail.bodyText ? (
                      <pre className="admin-message-pre">{inboxDetail.bodyText}</pre>
                    ) : (
                      <p className="text-muted small mb-0">Tidak ada konten</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="admin-toast">
          <i className="bi bi-check-circle-fill" style={{ color: '#4ade80' }} />
          {toast}
        </div>
      )}
    </main>
  );
}
