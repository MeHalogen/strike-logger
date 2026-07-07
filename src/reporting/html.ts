import type { Strike, StrikeDatabase, StrikeSeverity, UserConfig } from '../database/schema.js';
import { labelForCategory } from '../config/config.js';

const SEVERITY_COLORS: Record<StrikeSeverity, string> = {
  critical: '#dc2626',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#9ca3af',
};

/** Bucket strikes by month (YYYY-MM) for a trend line. */
export function trendByMonth(strikes: Strike[]): { month: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of strikes) {
    const month = (s.timestamp || '').slice(0, 7) || 'unknown';
    counts.set(month, (counts.get(month) || 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function bar(label: string, count: number, max: number, color: string): string {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return `
    <div class="row">
      <span class="row-label">${escapeHtml(label)}</span>
      <span class="track"><span class="fill" style="width:${pct}%;background:${color}"></span></span>
      <span class="row-count">${count}</span>
    </div>`;
}

/**
 * Render a standalone HTML dashboard for the strike database.
 */
export function generateHtmlReport(
  strikes: Strike[],
  stats: StrikeDatabase['statistics'],
  config: UserConfig = {}
): string {
  const open = strikes.filter((s) => !s.resolved).length;
  const resolved = strikes.length - open;

  const sevOrder: StrikeSeverity[] = ['critical', 'high', 'medium', 'low'];
  const maxSev = Math.max(1, ...sevOrder.map((s) => stats.bySeverity[s] || 0));
  const severityBars = sevOrder
    .map((s) => bar(s.toUpperCase(), stats.bySeverity[s] || 0, maxSev, SEVERITY_COLORS[s]))
    .join('');

  const categories = Object.entries(stats.byCategory).sort(([, a], [, b]) => b - a);
  const maxCat = Math.max(1, ...categories.map(([, c]) => c));
  const categoryBars = categories
    .map(([cat, count]) => bar(labelForCategory(config, cat), count, maxCat, '#6366f1'))
    .join('');

  const trend = trendByMonth(strikes);
  const maxTrend = Math.max(1, ...trend.map((t) => t.count));
  const trendBars = trend
    .map(
      (t) =>
        `<div class="tcol"><span class="tbar" style="height:${Math.round(
          (t.count / maxTrend) * 100
        )}%"></span><span class="tlabel">${escapeHtml(t.month)}</span><span class="tcount">${t.count}</span></div>`
    )
    .join('');

  const rows = [...strikes]
    .reverse()
    .slice(0, 50)
    .map(
      (s) => `
      <tr class="${s.resolved ? 'resolved' : ''}">
        <td><span class="sev sev-${s.severity}">${s.severity}</span></td>
        <td>${escapeHtml(labelForCategory(config, String(s.category)))}</td>
        <td>${escapeHtml((s.description || '').slice(0, 100))}</td>
        <td class="mono">${escapeHtml(String(s.source?.commit || '').slice(0, 7))}</td>
        <td>${s.resolved ? '✅' : '🔴'}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Strike Logger Report</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .sub { color: #94a3b8; margin: 0 0 28px; font-size: 14px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 32px; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; }
  .card .n { font-size: 28px; font-weight: 700; }
  .card .l { color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; }
  .panel { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
  .panel h2 { font-size: 15px; margin: 0 0 16px; text-transform: uppercase; letter-spacing: .04em; color: #cbd5e1; }
  .row { display: grid; grid-template-columns: 150px 1fr 44px; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 13px; }
  .row-label { color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .track { background: #0f172a; border-radius: 6px; height: 14px; overflow: hidden; }
  .fill { display: block; height: 100%; border-radius: 6px; }
  .row-count { text-align: right; color: #94a3b8; }
  .trend { display: flex; align-items: flex-end; gap: 10px; height: 160px; padding-top: 10px; }
  .tcol { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
  .tbar { width: 60%; min-height: 2px; background: linear-gradient(#6366f1, #8b5cf6); border-radius: 4px 4px 0 0; }
  .tlabel { font-size: 10px; color: #94a3b8; margin-top: 6px; }
  .tcount { font-size: 11px; color: #cbd5e1; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #334155; }
  th { color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: .04em; }
  tr.resolved { opacity: .5; }
  .mono { font-family: ui-monospace, Menlo, monospace; }
  .sev { padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #fff; }
  .sev-critical { background: ${SEVERITY_COLORS.critical}; }
  .sev-high { background: ${SEVERITY_COLORS.high}; }
  .sev-medium { background: ${SEVERITY_COLORS.medium}; }
  .sev-low { background: ${SEVERITY_COLORS.low}; }
</style>
</head>
<body>
<div class="wrap">
  <h1>🎯 Strike Logger Report</h1>
  <p class="sub">Generated ${new Date().toLocaleString()}</p>

  <div class="cards">
    <div class="card"><div class="n">${stats.totalStrikes}</div><div class="l">Total</div></div>
    <div class="card"><div class="n">${open}</div><div class="l">Open</div></div>
    <div class="card"><div class="n">${resolved}</div><div class="l">Resolved</div></div>
    <div class="card"><div class="n">${stats.bySeverity.critical || 0}</div><div class="l">Critical</div></div>
  </div>

  <div class="panel"><h2>By Severity</h2>${severityBars}</div>
  <div class="panel"><h2>By Category</h2>${categoryBars || '<p class="sub">No categories yet.</p>'}</div>
  <div class="panel"><h2>Trend by Month</h2><div class="trend">${trendBars || '<p class="sub">No data.</p>'}</div></div>

  <div class="panel">
    <h2>Recent Strikes</h2>
    <table>
      <thead><tr><th>Severity</th><th>Category</th><th>Description</th><th>Commit</th><th>Status</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No strikes logged.</td></tr>'}</tbody>
    </table>
  </div>
</div>
</body>
</html>`;
}
