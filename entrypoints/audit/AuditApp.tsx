import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { locale, useI18n, type MsgKey } from '../../src/i18n';
import {
  auditBookmarks,
  formatWhen,
  loadAuditCache,
  removeNativeBookmark,
  toCsv,
  type AuditResult,
  type AuditRow,
} from '../../src/utils/bookmarkAudit';

const RANGES: { days: number; labelKey: MsgKey }[] = [
  { days: 30, labelKey: 'audit.range30' },
  { days: 90, labelKey: 'audit.range90' },
  { days: 365, labelKey: 'audit.range365' },
];

type View = 'page' | 'domain';
type Filter = 'all' | 'visited' | 'dead';
type Sort = 'visits' | 'recent' | 'added';

const PAGE_SIZE = 100;

/** 按域名生成稳定的浅色底，避免每次都变 */
const PALETTE = ['#e8f1ee', '#e9eefa', '#fbeee6', '#f1ecf9', '#eef2e6', '#e6f0f3'];

function avatarColor(domain: string): string {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) hash = (hash * 31 + domain.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0]!;
}

export default function AuditApp() {
  const { t } = useI18n();
  const [days, setDays] = useState(365);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');

  const [view, setView] = useState<View>('page');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('visits');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const scanningRef = useRef(false);

  const scan = useCallback(async (rangeDays: number) => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanning(true);
    setError('');
    setProgress({ done: 0, total: 0 });
    try {
      const r = await auditBookmarks({
        days: rangeDays,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setResult(r);
      setLimit(PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }, []);

  // 先读缓存立刻出结果；区间不一致或没有缓存则扫描
  useEffect(() => {
    let alive = true;
    void (async () => {
      const cached = await loadAuditCache();
      if (!alive) return;
      if (cached) setResult(cached);
      if (!cached || cached.days !== days) void scan(days);
    })();
    return () => {
      alive = false;
    };
  }, [days, scan]);

  // ---------- 列表数据 ----------
  const rows = useMemo<AuditRow[]>(() => {
    if (!result) return [];
    const q = query.trim().toLowerCase();
    let list = result.rows.filter((r) => {
      if (filter === 'visited' && r.visits === 0) return false;
      if (filter === 'dead' && r.visits > 0) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.url.toLowerCase().includes(q) ||
        r.domain.toLowerCase().includes(q) ||
        r.folder.toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      if (sort === 'visits') return b.visits - a.visits || b.lastVisit - a.lastVisit;
      if (sort === 'recent') return b.lastVisit - a.lastVisit || b.visits - a.visits;
      return b.dateAdded - a.dateAdded;
    });
    return list;
  }, [result, filter, query, sort]);

  const domainRows = useMemo(() => {
    if (!result) return [];
    const q = query.trim().toLowerCase();
    let list = result.domains.filter((d) => {
      if (filter === 'visited' && d.visits === 0) return false;
      if (filter === 'dead' && d.visits > 0) return false;
      return !q || d.domain.toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) => {
      if (sort === 'visits') return b.visits - a.visits || b.lastVisit - a.lastVisit;
      if (sort === 'recent') return b.lastVisit - a.lastVisit || b.visits - a.visits;
      return b.pages - a.pages;
    });
    return list;
  }, [result, filter, query, sort]);

  const maxVisits = useMemo(() => {
    if (view === 'page') return Math.max(1, ...rows.map((r) => r.visits));
    return Math.max(1, ...domainRows.map((d) => d.visits));
  }, [view, rows, domainRows]);

  // ---------- 操作 ----------
  const remove = async (row: AuditRow) => {
    if (!window.confirm(t('audit.deleteConfirm', { title: row.title, url: row.url }))) {
      return;
    }
    try {
      await removeNativeBookmark(row.bookmarkId);
      setResult((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.filter((r) => r.bookmarkId !== row.bookmarkId),
              totalBookmarks: prev.totalBookmarks - 1,
              visitedCount: prev.visitedCount - (row.visits > 0 ? 1 : 0),
              deadCount: prev.deadCount - (row.visits > 0 ? 0 : 1),
              totalVisits: prev.totalVisits - row.visits,
            }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('audit.deleteFailed'));
    }
  };

  const exportCsv = () => {
    const list = rows.length > 0 ? rows : (result?.rows ?? []);
    const csv = toCsv(list, days);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabpocket-bookmark-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const empty = !!result && result.totalBookmarks === 0;
  const visiblePages = view === 'page' ? rows.slice(0, limit) : [];
  const visibleDomains = view === 'domain' ? domainRows.slice(0, limit) : [];
  const totalVisible = view === 'page' ? rows.length : domainRows.length;
  const rangeLabel =
    days === 365 ? t('audit.range365') : days === 90 ? t('audit.range90') : t('audit.range30');

  return (
    <div className="report">
      <header className="report-header">
        <div className="report-title">
          <h1>{t('audit.title')}</h1>
          <span className="report-sub">{t('audit.sub', { days: rangeLabel })}</span>
        </div>
        <div className="report-ranges">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              className={days === r.days ? 'range-btn active' : 'range-btn'}
              onClick={() => setDays(r.days)}
              disabled={scanning}
            >
              {t(r.labelKey)}
            </button>
          ))}
          <button
            type="button"
            className="range-btn ghost"
            onClick={() => void scan(days)}
            disabled={scanning}
          >
            {scanning ? t('audit.scanning') : t('audit.rescan')}
          </button>
        </div>
      </header>

      {scanning && (
        <div className="au-progress">
          <div className="au-progress-bar">
            <div
              className="au-progress-fill"
              style={{
                width: progress.total
                  ? `${Math.max(3, (progress.done / progress.total) * 100)}%`
                  : '3%',
              }}
            />
          </div>
          <span className="au-progress-text">
            {progress.total
              ? t('audit.progress', { done: progress.done, total: progress.total })
              : t('audit.reading')}
          </span>
        </div>
      )}

      {error && <div className="au-error">{t('audit.error', { msg: error })}</div>}

      <section className="report-kpis">
        <div className="kpi">
          <div className="kpi-label">{t('audit.kpi.pages')}</div>
          <div className="kpi-value">{result ? result.totalBookmarks : '—'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t('audit.kpi.visited')}</div>
          <div className="kpi-value">{result ? result.visitedCount : '—'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t('audit.kpi.dead')}</div>
          <div className="kpi-value">{result ? result.deadCount : '—'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t('audit.kpi.visits')}</div>
          <div className="kpi-value">{result ? result.totalVisits : '—'}</div>
        </div>
      </section>

      {result && result.totalVisits === 0 && !scanning && (
        <div className="au-diag">
          <div className="au-diag-title">{t('audit.diag.title')}</div>
          <ul className="au-diag-list">
            <li>
              {t('audit.diag.api')}
              {result.probe
                ? result.probe.ok
                  ? t('audit.diag.apiOk')
                  : t('audit.diag.apiBad', { msg: result.probe.error ?? '' })
                : t('audit.diag.apiUnknown')}
            </li>
            <li>
              {t('audit.diag.hasHistory')}
              {result.probe?.hasHistory
                ? t('audit.diag.hasHistoryYes')
                : t('audit.diag.hasHistoryNo')}
            </li>
            <li>
              {t('audit.diag.latest')}
              {result.probe?.latest ? formatWhen(result.probe.latest) : '—'}
            </li>
            <li>
              {t('audit.diag.error')}
              {result.visitError ?? t('audit.diag.noError')}
            </li>
          </ul>
          <div className="au-diag-hint">{t('audit.diag.hint')}</div>
        </div>
      )}

      {empty ? (
        <div className="report-empty">
          <p>{t('audit.empty')}</p>
          <p className="report-empty-desc">{t('audit.emptyDesc')}</p>
        </div>
      ) : (
        <>
          <section className="report-card">
            <div className="au-toolbar">
              <div className="au-seg">
                <button
                  type="button"
                  className={view === 'page' ? 'au-seg-btn active' : 'au-seg-btn'}
                  onClick={() => setView('page')}
                >
                  {t('audit.view.page')}
                </button>
                <button
                  type="button"
                  className={view === 'domain' ? 'au-seg-btn active' : 'au-seg-btn'}
                  onClick={() => setView('domain')}
                >
                  {t('audit.view.domain')}
                </button>
              </div>

              <div className="au-seg">
                {(
                  [
                    ['all', t('audit.filter.all')],
                    ['visited', t('audit.filter.visited')],
                    ['dead', t('audit.filter.dead')],
                  ] as [Filter, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={filter === key ? 'au-seg-btn active' : 'au-seg-btn'}
                    onClick={() => {
                      setFilter(key);
                      setLimit(PAGE_SIZE);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <select
                className="au-select"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
              >
                <option value="visits">{t('audit.sort.visits')}</option>
                <option value="recent">{t('audit.sort.recent')}</option>
                <option value="added">
                  {view === 'page' ? t('audit.sort.added') : t('audit.sort.pages')}
                </option>
              </select>

              <input
                className="au-search"
                placeholder={t('audit.search')}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(PAGE_SIZE);
                }}
              />

              <button
                type="button"
                className="range-btn ghost"
                onClick={exportCsv}
                disabled={!result}
              >
                {t('audit.exportCsv')}
              </button>
            </div>

            {totalVisible === 0 ? (
              <p className="au-empty-line">{t('audit.noMatch')}</p>
            ) : view === 'page' ? (
              <ul className="au-list">
                {visiblePages.map((r, i) => (
                  <li key={r.bookmarkId} className="au-row">
                    <span className="au-rank">{i + 1}</span>
                    <span
                      className="au-avatar"
                      style={{ background: avatarColor(r.domain) }}
                    >
                      {r.domain.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="au-body">
                      <a
                        className="au-title"
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        title={r.url}
                      >
                        {r.title}
                      </a>
                      <div className="au-meta">
                        {r.domain}
                        {r.folder ? ` · ${r.folder}` : ''}
                      </div>
                      <div className="au-bar">
                        <div
                          className="au-bar-fill"
                          style={{ width: `${Math.max(2, (r.visits / maxVisits) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="au-right">
                      <div className={r.visits > 0 ? 'au-visits' : 'au-visits zero'}>
                        {r.visits}
                        <span>{t('audit.times')}</span>
                      </div>
                      <div className="au-when">
                        {r.visits > 0 ? formatWhen(r.lastVisit) : t('audit.never')}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="au-del"
                      title={t('audit.deleteTitle')}
                      onClick={() => void remove(r)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="au-list">
                {visibleDomains.map((d, i) => (
                  <li key={d.domain} className="au-row">
                    <span className="au-rank">{i + 1}</span>
                    <span
                      className="au-avatar"
                      style={{ background: avatarColor(d.domain) }}
                    >
                      {d.domain.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="au-body">
                      <div className="au-title-static">{d.domain}</div>
                      <div className="au-meta">
                        {t('audit.pagesCount', { n: d.pages }, d.pages)}
                      </div>
                      <div className="au-bar">
                        <div
                          className="au-bar-fill"
                          style={{ width: `${Math.max(2, (d.visits / maxVisits) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="au-right">
                      <div className={d.visits > 0 ? 'au-visits' : 'au-visits zero'}>
                        {d.visits}
                        <span>{t('audit.times')}</span>
                      </div>
                      <div className="au-when">
                        {d.visits > 0 ? formatWhen(d.lastVisit) : t('audit.never')}
                      </div>
                    </div>
                    <span className="au-del-spacer" />
                  </li>
                ))}
              </ul>
            )}

            {totalVisible > limit && (
              <button
                type="button"
                className="range-btn ghost au-more"
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
              >
                {t('audit.more', { n: totalVisible - limit })}
              </button>
            )}
          </section>

          <p className="au-footnote">
            {t('audit.footnote')}
            {result
              ? ` ${t('audit.lastScan', {
                  time: new Date(result.scannedAt).toLocaleString(locale()),
                })}`
              : ''}
          </p>
        </>
      )}
    </div>
  );
}
