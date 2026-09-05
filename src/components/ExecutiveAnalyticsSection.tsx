import type { CategoryStat } from "@/lib/caseHelpers";

interface ExecutiveAnalyticsSectionProps {
  totalCases: number;
  totalRevenueAtRisk: number;
  totalRevenueRecovered: number;
  revenueLost: number;
  recoveryEfficiency: number;
  avgResolutionDays: number | null;
  avgAttemptsToRecover: number | null;
  highPriorityCount: number;
  urgentCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  categories: CategoryStat[];
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function KpiCard({
  label,
  value,
  sub,
  accentColor,
  icon,
  children,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accentColor: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--surface-border)",
        borderRadius: "8px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
          {label}
        </span>
        <div
          style={{
            width: "32px", height: "32px", borderRadius: "6px",
            background: `${accentColor}18`, border: `1px solid ${accentColor}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: accentColor, flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
      <div>
        <div style={{ fontSize: "1.625rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", lineHeight: 1 }}>
          {value}
        </div>
        {sub && <div style={{ marginTop: "6px", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>{sub}</div>}
        {children}
      </div>
    </div>
  );
}

function PriorityBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color }}>{label}</span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
          {count} <span style={{ color: "var(--text-tertiary)", opacity: 0.6 }}>({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div style={{ height: "6px", background: "var(--surface-overlay)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(pct > 0 ? 2 : 0, pct)}%`, background: color, borderRadius: "3px", transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

export default function ExecutiveAnalyticsSection({
  totalCases,
  totalRevenueAtRisk,
  totalRevenueRecovered,
  revenueLost,
  recoveryEfficiency,
  avgResolutionDays,
  avgAttemptsToRecover,
  highPriorityCount,
  urgentCount,
  mediumPriorityCount,
  lowPriorityCount,
  categories,
}: ExecutiveAnalyticsSectionProps) {
  const totalPri = urgentCount + highPriorityCount + mediumPriorityCount + lowPriorityCount;

  const topLossCategory = [...categories].sort(
    (a, b) => (b.atRisk - b.recovered) - (a.atRisk - a.recovered)
  )[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px" }}>

        <KpiCard
          label="Recovery Efficiency"
          value={<span style={{ color: "#10b981" }}>{recoveryEfficiency.toFixed(1)}%</span>}
          sub="Recovered ÷ total at-risk"
          accentColor="#10b981"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
        >
          <div style={{ marginTop: "10px" }}>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.min(100, recoveryEfficiency)}%`, background: "#10b981" }} />
            </div>
          </div>
        </KpiCard>

        <KpiCard
          label="Revenue Leakage"
          value={<span style={{ color: "#ef4444" }}>${fmt(revenueLost)}</span>}
          sub="Lost from FAILED cases"
          accentColor="#ef4444"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>}
        />

        <KpiCard
          label="Avg Resolution Time"
          value={
            avgResolutionDays !== null
              ? <>{avgResolutionDays.toFixed(1)}<span style={{ fontSize: "1rem", fontWeight: 500, color: "var(--text-tertiary)", marginLeft: "4px" }}>days</span></>
              : <span style={{ fontSize: "1rem", color: "var(--text-tertiary)" }}>—</span>
          }
          sub="Case open → resolved"
          accentColor="#3b82f6"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />

        <KpiCard
          label="Avg Attempts / Recovery"
          value={
            avgAttemptsToRecover !== null
              ? <>{avgAttemptsToRecover.toFixed(1)}<span style={{ fontSize: "1rem", fontWeight: 500, color: "var(--text-tertiary)", marginLeft: "4px" }}>attempts</span></>
              : <span style={{ fontSize: "1rem", color: "var(--text-tertiary)" }}>—</span>
          }
          sub="Per successfully recovered case"
          accentColor="#f59e0b"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>}
        />
      </div>

      {/* ── Second row: Priority breakdown + Top loss driver ─────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

        {/* Priority breakdown */}
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--surface-border)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--surface-border)" }}>
            <div className="section-title">Case Priority Breakdown</div>
            <div style={{ marginTop: "2px", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
              Distribution across {totalCases} cases
            </div>
          </div>
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <PriorityBar label="Urgent" count={urgentCount}        total={totalPri} color="#ef4444" />
            <PriorityBar label="High"   count={highPriorityCount}  total={totalPri} color="#f59e0b" />
            <PriorityBar label="Medium" count={mediumPriorityCount} total={totalPri} color="#3b82f6" />
            <PriorityBar label="Low"    count={lowPriorityCount}   total={totalPri} color="#475569" />
          </div>
        </div>

        {/* Top revenue leakage driver */}
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--surface-border)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--surface-border)" }}>
            <div className="section-title">Top Revenue Leakage Driver</div>
            <div style={{ marginTop: "2px", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
              Category with highest unrecovered revenue
            </div>
          </div>
          <div style={{ padding: "20px" }}>
            {topLossCategory && (topLossCategory.atRisk - topLossCategory.recovered) > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "40px", height: "40px", borderRadius: "8px",
                      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#ef4444", flexShrink: 0,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)" }}>{topLossCategory.label}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>{topLossCategory.count} cases in this category</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div style={{ padding: "10px 12px", background: "var(--surface-overlay)", border: "1px solid var(--surface-border)", borderRadius: "6px" }}>
                    <div className="label-xs" style={{ marginBottom: "4px" }}>At Risk</div>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)" }}>${fmt(topLossCategory.atRisk)}</div>
                  </div>
                  <div style={{ padding: "10px 12px", background: "var(--surface-overlay)", border: "1px solid var(--surface-border)", borderRadius: "6px" }}>
                    <div className="label-xs" style={{ marginBottom: "4px" }}>Recovered</div>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#10b981" }}>${fmt(topLossCategory.recovered)}</div>
                  </div>
                  <div style={{ padding: "10px 12px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "6px", gridColumn: "span 2" }}>
                    <div className="label-xs" style={{ marginBottom: "4px", color: "#ef4444" }}>Unrecovered Leakage</div>
                    <div style={{ fontSize: "1.0625rem", fontWeight: 800, color: "#ef4444" }}>${fmt(topLossCategory.atRisk - topLossCategory.recovered)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: "32px", textAlign: "center", fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
                No revenue leakage detected.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Category Efficiency Scorecard ────────────────────────────────── */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--surface-border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--surface-border)" }}>
          <div className="section-title">Category Efficiency Scorecard</div>
          <div style={{ marginTop: "2px", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
            Recovery performance by incident type — sorted by highest leakage
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: "20px" }}>Category</th>
                <th style={{ textAlign: "right" }}>Cases</th>
                <th style={{ textAlign: "right" }}>At Risk</th>
                <th style={{ textAlign: "right" }}>Recovered</th>
                <th style={{ textAlign: "right" }}>Leakage</th>
                <th style={{ textAlign: "right", paddingRight: "20px" }}>Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {[...categories]
                .sort((a, b) => (b.atRisk - b.recovered) - (a.atRisk - a.recovered))
                .map((cat) => {
                  const lost = cat.atRisk - cat.recovered;
                  const eff = cat.atRisk > 0 ? (cat.recovered / cat.atRisk) * 100 : 0;
                  const effColor = eff >= 70 ? "#10b981" : eff >= 40 ? "#f59e0b" : "#ef4444";
                  return (
                    <tr key={cat.key}>
                      <td style={{ paddingLeft: "20px" }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{cat.label}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>{cat.count}</td>
                      <td style={{ textAlign: "right", color: "var(--text-primary)", fontWeight: 500 }}>${fmt(cat.atRisk)}</td>
                      <td style={{ textAlign: "right", color: "#10b981", fontWeight: 500 }}>${fmt(cat.recovered)}</td>
                      <td style={{ textAlign: "right", color: "#ef4444", fontWeight: 500 }}>${fmt(lost)}</td>
                      <td style={{ textAlign: "right", paddingRight: "20px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            padding: "3px 9px",
                            borderRadius: "4px",
                            border: `1px solid ${effColor}30`,
                            background: `${effColor}15`,
                            color: effColor,
                            fontSize: "0.6875rem",
                            fontWeight: 700,
                          }}
                        >
                          {eff.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
