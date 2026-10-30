import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { useI18n, type MsgKey } from '../../../src/i18n';
import type { StatsSummary } from '../../../src/types';
import { formatDuration, querySummary } from '../../../src/utils/stats';
import { collectStatus, type TrackStatus } from '../../../src/utils/diagnostics';

const RANGES: { days: number; labelKey: MsgKey }[] = [
  { days: 7, labelKey: 'stats.range7' },
  { days: 30, labelKey: 'stats.range30' },
  { days: 90, labelKey: 'stats.range90' },
];

export default function StatsView() {
  const { t } = useI18n();
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TrackStatus | null>(null);

  const refresh = useCallback(async (range: number) => {
    setLoading(true);
    try {
      const [s, st] = await Promise.all([querySummary(range), collectStatus()]);
      setSummary(s);
      setStatus(st);
    } catch (err) {
      console.warn('[TabPocket] failed to read stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(days);
  }, [days, refresh]);

  const top = summary?.byDomain.slice(0, 5) ?? [];
  const maxMs = top[0]?.durationMs ?? 1;
  const totalVisits = summary
    ? summary.byDomain.reduce((sum, d) => sum + d.visits, 0)
    : 0;
  const hasData = !!summary && (summary.totalMs > 0 || totalVisits > 0);
  const backgroundDown = !!status && !status.backgroundAlive;

  const openReport = () => {
    // stats.html 是手写 Vite 入口，WXT 的 PublicPath 类型映射里没有它，故绕过类型
    const getUrl = browser.runtime.getURL as unknown as (path: string) => string;
    void browser.tabs.create({ url: getUrl('stats.html') });
  };

  return (
    <div className="stats-view">
      <div className="stat-ranges">
        {RANGES.map((r) => (
          <button
            key={r.days}
            type="button"
            className={days === r.days ? 'stat-range active' : 'stat-range'}
            onClick={() => setDays(r.days)}
          >
            {t(r.labelKey)}
          </button>
        ))}
        <button
          type="button"
          className="stat-refresh"
          onClick={() => void refresh(days)}
          title={t('stats.refresh')}
        >
          {t('stats.refresh')}
        </button>
      </div>

      {backgroundDown && <div className="stat-warn">{t('stats.bgDown')}</div>}

      {loading && !summary ? (
        <div className="stat-empty">{t('stats.loading')}</div>
      ) : !hasData ? (
        <div className="stat-empty">
          <div className="stat-empty-title">{t('stats.emptyTitle')}</div>
          <div className="stat-empty-desc">
            {t('stats.emptyDesc').split('\n').map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="stat-kpis">
            <div className="stat-kpi">
              <div className="stat-kpi-label">{t('stats.total')}</div>
              <div className="stat-kpi-value">{formatDuration(summary.totalMs)}</div>
            </div>
            <div className="stat-kpi">
              <div className="stat-kpi-label">{t('stats.dailyAvg')}</div>
              <div className="stat-kpi-value">{formatDuration(summary.avgMs)}</div>
            </div>
            <div className="stat-kpi">
              <div className="stat-kpi-label">{t('stats.activeSites')}</div>
              <div className="stat-kpi-value">{summary.domainCount}</div>
            </div>
            <div className="stat-kpi">
              <div className="stat-kpi-label">{t('stats.daysRecorded')}</div>
              <div className="stat-kpi-value">
                {summary.activeDays}
                <span className="stat-kpi-unit"> {t('stats.dayUnit')}</span>
              </div>
            </div>
          </div>

          <div className="stat-section-title">{t('stats.top5')}</div>
          <div className="stat-top-list">
            {top.map((d) => (
              <div key={d.domain} className="stat-top-row">
                <span className="stat-top-domain" title={d.domain}>
                  {d.domain}
                </span>
                <span className="stat-top-time">{formatDuration(d.durationMs)}</span>
                <div className="stat-top-bar">
                  <div
                    className="stat-top-bar-fill"
                    style={{ width: `${Math.max(4, (d.durationMs / maxMs) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <button type="button" className="btn-primary stat-open" onClick={openReport}>
        {t('stats.openReport')}
      </button>
      <div className="stat-note">{t('stats.note')}</div>
    </div>
  );
}
