import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, HeatmapChart } from 'echarts/charts';
import {
  CalendarComponent,
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useI18n, type MsgKey } from '../../src/i18n';
import type { StatsSummary } from '../../src/types';
import {
  clearStats,
  formatDuration,
  loadSettings,
  querySummary,
  saveSettings,
} from '../../src/utils/stats';
import {
  collectStatus,
  formatSince,
  settleNow,
  type TrackStatus,
} from '../../src/utils/diagnostics';

echarts.use([
  BarChart,
  HeatmapChart,
  CalendarComponent,
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

const GREEN = '#0f6e56';
const GREEN_SOFT = '#8fbfb0';

const RANGES: { days: number; labelKey: MsgKey }[] = [
  { days: 7, labelKey: 'stats.range7' },
  { days: 30, labelKey: 'stats.range30' },
  { days: 90, labelKey: 'stats.range90' },
];

/** 把 ECharts 实例挂到 div 上；容器挂载/卸载与 option 变化都能正确响应 */
function useChart(option: echarts.EChartsCoreOption | null) {
  // 用 state 保存容器节点：图表容器是条件渲染的，普通 ref + 空依赖 effect 会漏初始化
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null);

  useEffect(() => {
    if (!el) return;
    const chart = echarts.init(el);
    chartRef.current = chart;
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, [el]);

  useEffect(() => {
    if (chartRef.current && option) chartRef.current.setOption(option, true);
  }, [option, el]);

  return setEl;
}

export default function StatsApp() {
  const { t, lang } = useI18n();
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<TrackStatus | null>(null);
  const [settling, setSettling] = useState(false);

  const refresh = useCallback(async (range: number) => {
    setLoading(true);
    try {
      const [s, settings, st] = await Promise.all([
        querySummary(range),
        loadSettings(),
        collectStatus(),
      ]);
      setSummary(s);
      setExcluded(settings.excludedDomains);
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

  // ---------- 日历热力图 ----------
  const calendarOption = useMemo<echarts.EChartsCoreOption | null>(() => {
    if (!summary) return null;
    const data = summary.byDay.map((d) => [d.date, d.durationMs] as [string, number]);
    const maxMs = Math.max(1, ...data.map((d) => d[1]));
    const start = data[0]?.[0];
    const end = data[data.length - 1]?.[0];
    if (!start || !end) return null;

    return {
      tooltip: {
        formatter: (p: unknown) => {
          const v = (p as { value: [string, number] }).value;
          return `${v[0]}<br/><b>${formatDuration(v[1])}</b>`;
        },
      },
      visualMap: {
        show: false,
        min: 0,
        max: maxMs,
        inRange: { color: ['#eef3f1', '#b7d8cd', '#6aa896', GREEN] },
      },
      calendar: {
        top: 34,
        left: 44,
        right: 16,
        bottom: 24,
        range: [start, end],
        cellSize: ['auto', 15],
        orient: 'horizontal',
        itemStyle: { color: '#f5f7f6', borderColor: '#fff', borderWidth: 2 },
        splitLine: { show: false },
        dayLabel: {
          firstDay: 1,
          nameMap: t('report.weekdays').split(','),
          fontSize: 10,
          color: '#9ca3af',
        },
        monthLabel: { nameMap: t('report.monthNameMap'), fontSize: 10, color: '#6b7280' },
        yearLabel: { show: false },
      },
      series: [
        {
          type: 'heatmap',
          coordinateSystem: 'calendar',
          data,
        },
      ],
    };
  }, [summary, t, lang]);

  // ---------- 域名排行 ----------
  const domainOption = useMemo<echarts.EChartsCoreOption | null>(() => {
    if (!summary) return null;
    const top = summary.byDomain.slice(0, 12).reverse();
    if (top.length === 0) return null;
    return {
      grid: { left: 8, right: 28, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const item = p as { name: string; value: number };
          return `${item.name}<br/><b>${formatDuration(item.value)}</b>`;
        },
      },
      xAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 10,
          color: '#9ca3af',
          formatter: (v: number) => `${(v / 3600000).toFixed(0)}h`,
        },
        splitLine: { lineStyle: { color: '#f1f3f2' } },
      },
      yAxis: {
        type: 'category',
        data: top.map((d) => d.domain),
        axisLabel: {
          fontSize: 11,
          color: '#374151',
          width: 130,
          overflow: 'truncate',
        },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: top.map((d) => d.durationMs),
          itemStyle: { color: GREEN, borderRadius: [0, 4, 4, 0] },
          barMaxWidth: 14,
        },
      ],
    };
  }, [summary, t, lang]);

  // ---------- 24 小时分布 ----------
  const hourOption = useMemo<echarts.EChartsCoreOption | null>(() => {
    if (!summary) return null;
    return {
      grid: { left: 8, right: 12, top: 10, bottom: 24, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const item = p as { name: string; value: number };
          return `${t('report.hourTooltip', { h: item.name })}<br/><b>${formatDuration(item.value)}</b>`;
        },
      },
      xAxis: {
        type: 'category',
        data: Array.from({ length: 24 }, (_, i) => String(i)),
        axisLabel: { fontSize: 9, color: '#9ca3af', interval: 2 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e5e7eb' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 9,
          color: '#9ca3af',
          formatter: (v: number) => `${(v / 3600000).toFixed(1)}h`,
        },
        splitLine: { lineStyle: { color: '#f5f7f6' } },
      },
      series: [
        {
          type: 'bar',
          data: summary.byHour,
          itemStyle: { color: GREEN_SOFT, borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 14,
        },
      ],
    };
  }, [summary, t, lang]);

  const calendarRef = useChart(calendarOption);
  const domainRef = useChart(domainOption);
  const hourRef = useChart(hourOption);

  /** 区间内累计访问次数（打开次数，与停留时长独立） */
  const totalVisits = summary
    ? summary.byDomain.reduce((sum, d) => sum + d.visits, 0)
    : 0;

  // ---------- 排除域名 ----------
  const addExcluded = async () => {
    const v = input.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!v || excluded.includes(v)) {
      setInput('');
      return;
    }
    const next = [...excluded, v];
    setExcluded(next);
    setInput('');
    await saveSettings({ excludedDomains: next });
  };

  const removeExcluded = async (domain: string) => {
    const next = excluded.filter((d) => d !== domain);
    setExcluded(next);
    await saveSettings({ excludedDomains: next });
  };

  const doClear = async () => {
    if (!window.confirm(t('report.clearConfirm'))) return;
    await clearStats();
    await refresh(days);
  };

  const hasData = !!summary && (summary.totalMs > 0 || totalVisits > 0);

  const doSettle = async () => {
    setSettling(true);
    try {
      await settleNow();
      // 结算后给它一点时间落库，再刷新
      await new Promise((r) => window.setTimeout(r, 400));
      await refresh(days);
    } finally {
      setSettling(false);
    }
  };

  const emptyTitle = status && !status.backgroundAlive
    ? t('report.empty.bgDown')
    : status && status.recordCount === 0
      ? t('report.empty.noRecord')
      : t('report.empty.noData');

  const emptyDesc = status && !status.backgroundAlive
    ? t('report.empty.bgDownDesc')
    : status && status.recordCount === 0
      ? t('report.empty.noRecordDesc')
      : t('report.empty.noDataDesc');

  return (
    <div className="report">
      <header className="report-header">
        <div className="report-title">
          <h1>{t('report.title')}</h1>
          <span className="report-sub">{t('report.sub')}</span>
        </div>
        <div className="report-ranges">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              className={days === r.days ? 'range-btn active' : 'range-btn'}
              onClick={() => setDays(r.days)}
            >
              {t(r.labelKey)}
            </button>
          ))}
          <button type="button" className="range-btn ghost" onClick={() => void refresh(days)}>
            {t('report.refresh')}
          </button>
        </div>
      </header>

      <section className="report-kpis">
        <div className="kpi">
          <div className="kpi-label">{t('report.kpi.total')}</div>
          <div className="kpi-value">{summary ? formatDuration(summary.totalMs) : '—'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t('report.kpi.visits')}</div>
          <div className="kpi-value">{summary ? totalVisits : '—'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t('report.kpi.avg')}</div>
          <div className="kpi-value">{summary ? formatDuration(summary.avgMs) : '—'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t('report.kpi.sites')}</div>
          <div className="kpi-value">{summary ? summary.domainCount : '—'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t('report.kpi.top')}</div>
          <div className="kpi-value kpi-value-sm">
            {summary?.topDomain || '—'}
          </div>
        </div>
      </section>

      {loading && !summary ? (
        <div className="report-empty">{t('report.loading')}</div>
      ) : !hasData ? (
        <div className="report-empty">
          <p>{emptyTitle}</p>
          <p className="report-empty-desc">{emptyDesc}</p>
          <button
            type="button"
            className="range-btn"
            style={{ marginTop: 12 }}
            onClick={() => void doSettle()}
            disabled={settling}
          >
            {settling ? t('report.settling') : t('report.settle')}
          </button>
        </div>
      ) : (
        <>
          <section className="report-card">
            <h2>{t('report.calendar')}</h2>
            <div ref={calendarRef} className="chart chart-calendar" />
          </section>

          <div className="report-grid">
            <section className="report-card">
              <h2>{t('report.domains')}</h2>
              <div ref={domainRef} className="chart chart-domain" />
            </section>
            <section className="report-card">
              <h2>{t('report.hours')}</h2>
              <div ref={hourRef} className="chart chart-hour" />
            </section>
          </div>
        </>
      )}

      <section className="report-card">
        <h2>{t('report.diag.title')}</h2>
        <div className="diag-grid">
          <div className="diag-item">
            <span>{t('report.diag.background')}</span>
            <b className={status?.backgroundAlive ? 'diag-ok' : 'diag-bad'}>
              {status
                ? status.backgroundAlive
                  ? t('report.diag.alive')
                  : t('report.diag.dead')
                : '—'}
            </b>
          </div>
          <div className="diag-item">
            <span>{t('report.diag.alarm')}</span>
            <b className={status?.alarmExists ? 'diag-ok' : 'diag-bad'}>
              {status
                ? status.alarmExists
                  ? t('report.diag.alarmOn', { n: status.alarmPeriod ?? 1 })
                  : t('report.diag.alarmOff')
                : '—'}
            </b>
          </div>
          <div className="diag-item">
            <span>{t('report.diag.tracking')}</span>
            <b>
              {status?.state
                ? t('report.diag.trackingOn', {
                    domain: status.state.domain,
                    duration: formatSince(status.state.since),
                  })
                : t('report.diag.trackingOff')}
            </b>
          </div>
          <div className="diag-item">
            <span>{t('report.diag.records')}</span>
            <b>
              {status ? t('report.diag.recordsValue', { n: status.recordCount }) : '—'}
            </b>
          </div>
          <div className="diag-item">
            <span>{t('report.diag.lastWrite')}</span>
            <b>
              {status?.lastWriteTs
                ? t('report.diag.lastWriteAgo', { duration: formatSince(status.lastWriteTs) })
                : t('report.diag.never')}
            </b>
          </div>
        </div>
        <div className="diag-actions">
          <button
            type="button"
            className="range-btn"
            onClick={() => void doSettle()}
            disabled={settling}
          >
            {settling ? t('report.settling') : t('report.settle')}
          </button>
          <button type="button" className="range-btn ghost" onClick={() => void refresh(days)}>
            {t('report.diag.refresh')}
          </button>
        </div>
        <p className="report-hint">{t('report.diag.hint')}</p>
      </section>

      <section className="report-card">
        <h2>{t('report.exclude.title')}</h2>
        <p className="report-hint">{t('report.exclude.hint')}</p>
        <div className="exclude-input-row">
          <input
            className="exclude-input"
            value={input}
            placeholder={t('report.exclude.placeholder')}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addExcluded();
            }}
          />
          <button type="button" className="range-btn" onClick={() => void addExcluded()}>
            {t('report.exclude.add')}
          </button>
        </div>
        <div className="exclude-chips">
          {excluded.length === 0 ? (
            <span className="report-hint">{t('report.exclude.none')}</span>
          ) : (
            excluded.map((d) => (
              <span key={d} className="exclude-chip">
                {d}
                <button
                  type="button"
                  onClick={() => void removeExcluded(d)}
                  title={t('report.exclude.remove')}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
      </section>

      <footer className="report-footer">
        <button type="button" className="danger-btn" onClick={() => void doClear()}>
          {t('report.clear')}
        </button>
        <span className="report-hint">{t('report.clearNote')}</span>
      </footer>
    </div>
  );
}
