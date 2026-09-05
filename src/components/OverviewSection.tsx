import type { CategoryStat } from "@/lib/caseHelpers";

interface OverviewSectionProps {
  totalCases: number;
  totalRevenueAtRisk: number;
  totalRevenueRecovered: number;
  recoveryRate: number;
  recoveredCount: number;
  inProgressCount: number;
  openCount: number;
  escalatedCount: number;
  failedCount: number;
  categories: CategoryStat[];
  maxCategoryAmount: number;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function KpiCard({
  label, value, sub, accentColor, icon, children, delayClass,
}: {
  label: string; value: React.ReactNode; sub?: string;
  accentColor: string; icon: React.ReactNode; children?: React.ReactNode;
  delayClass?: string;
}) {
  return (
    <div
      className={`glass-card-accent fade-in-up ${delayClass || ""}`}
      style={{ "--accent-color": accentColor, padding: "22px" } as React.CSSProperties}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
          {label}
        </span>
        <div
          className="kpi-icon-box"
          style={{
            background: `linear-gradient(135deg, ${accentColor}25 0%, ${accentColor}10 100%)`,
            border: `1px solid ${accentColor}30`,
            color: accentColor,
            boxShadow: `0 0 12px ${accentColor}15`,
          }}
        >
          {icon}
        </div>
      </div>
      <div>
        <div style={{ fontSize: "1.875rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", lineHeight: 1 }}>
          {value}
        </div>
        {sub && (
          <div style={{ marginTop: "8px", fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
            {sub}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function StatusRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <span style={{
        width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0,
        boxShadow: `0 0 6px ${color}50`,
      }} />
      <span style={{ flex: 1, fontSize: "0.875rem", color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", minWidth: "28px", textAlign: "right" }}>{count}</span>
      <div style={{ width: "60px", flexShrink: 0 }}>
        <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, borderRadius: "2px", transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }} />
        </div>
      </div>
      <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", minWidth: "36px", textAlign: "right" }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

export default function OverviewSection({
  totalCases, totalRevenueAtRisk, totalRevenueRecovered, recoveryRate,
  recoveredCount, inProgressCount, openCount, escalatedCount, failedCount,
  categories, maxCategoryAmount,
}: OverviewSectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px" }}>
        <KpiCard label="Revenue at Risk" value={<span style={{ color: "#ef4444" }}>${fmt(totalRevenueAtRisk)}</span>} sub={`${totalCases} incidents detected`} accentColor="#ef4444" delayClass="fade-delay-1"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
        />
        <KpiCard label="Revenue Recovered" value={<span style={{ color: "var(--brand)" }}>${fmt(totalRevenueRecovered)}</span>} sub={`${recoveredCount} cases captured`} accentColor="#10b981" delayClass="fade-delay-2"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
        />
        <KpiCard label="Recovery Rate" value={`${recoveryRate.toFixed(1)}%`} accentColor="#3b82f6" delayClass="fade-delay-3"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
        >
          <div style={{ marginTop: "12px" }}>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.min(100, recoveryRate)}%`, background: "linear-gradient(90deg, #3b82f6, #60a5fa)" }} />
            </div>
          </div>
        </KpiCard>
        <KpiCard label="Total Cases" value={totalCases} sub={`${openCount} open · ${inProgressCount} in progress`} accentColor="#a855f7" delayClass="fade-delay-4"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
        />
      </div>

      {/* Status + Chart row */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "16px" }}>

        {/* Case Status */}
        <div className="glass-card fade-in-up" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--surface-border)" }}>
            <div className="section-title">Case Status</div>
            <div style={{ marginTop: "4px", fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>Live pipeline breakdown</div>
          </div>
          <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <StatusRow label="Open"        count={openCount}       total={totalCases} color="#f59e0b" />
            <StatusRow label="In Progress" count={inProgressCount} total={totalCases} color="#3b82f6" />
            <StatusRow label="Recovered"   count={recoveredCount}  total={totalCases} color="#10b981" />
            <StatusRow label="Escalated"   count={escalatedCount}  total={totalCases} color="#a855f7" />
            <StatusRow label="Failed"      count={failedCount}     total={totalCases} color="#ef4444" />
          </div>
        </div>

        {/* Category chart */}
        <div className="glass-card fade-in-up" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--surface-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div className="section-title">Revenue at Risk vs. Recovered</div>
              <div style={{ marginTop: "4px", fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>By incident category</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "linear-gradient(135deg, #ef4444, #f87171)", display: "inline-block" }} />
                <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>At Risk</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "linear-gradient(135deg, #10b981, #34d399)", display: "inline-block" }} />
                <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>Recovered</span>
              </div>
            </div>
          </div>

          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "22px" }}>
            {categories.map((cat) => {
              const atRiskPct = Math.max(2, (cat.atRisk / maxCategoryAmount) * 100);
              const recovPct  = Math.max(cat.recovered > 0 ? 2 : 0, (cat.recovered / maxCategoryAmount) * 100);
              const effRate   = cat.atRisk > 0 ? ((cat.recovered / cat.atRisk) * 100).toFixed(1) : "0.0";
              const effColor  = parseFloat(effRate) >= 70 ? "#10b981" : parseFloat(effRate) >= 40 ? "#f59e0b" : "#ef4444";
              return (
                <div key={cat.key}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>{cat.label}</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-tertiary)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--surface-border)", borderRadius: "6px", padding: "1px 8px" }}>{cat.count}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <span style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
                        Risk <strong style={{ color: "var(--text-primary)" }}>${fmt(cat.atRisk)}</strong>
                      </span>
                      <span style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
                        Rec <strong style={{ color: "#10b981" }}>${fmt(cat.recovered)}</strong>
                      </span>
                      <span style={{
                        fontSize: "0.75rem", fontWeight: 700, color: effColor,
                        background: `${effColor}15`, border: `1px solid ${effColor}30`,
                        borderRadius: "6px", padding: "2px 9px",
                      }}>
                        {effRate}%
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ height: "7px", background: "rgba(255,255,255,0.04)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${atRiskPct}%`, background: "linear-gradient(90deg, #ef4444, #f87171)", borderRadius: "4px", transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }} />
                    </div>
                    <div style={{ height: "7px", background: "rgba(255,255,255,0.04)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${recovPct}%`, background: "linear-gradient(90deg, #10b981, #34d399)", borderRadius: "4px", transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
