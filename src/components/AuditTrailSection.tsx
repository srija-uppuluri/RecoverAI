interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  details: string | null;
  createdAt: string;
  caseId: string | null;
  caseRef: string | null;
  txnRef: string | null;
  customerName: string;
  caseType: string;
}
interface AuditTrailSectionProps { logs: AuditLogEntry[]; }

function eventStyle(action: string): { color: string; bg: string; border: string } {
  switch (action) {
    case "PAYMENT_RECOVERED":
    case "CASE_RESOLVED_MANUALLY": return { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" };
    case "EMAIL_SENT":
    case "SMS_SENT":               return { color: "#60a5fa", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.3)" };
    case "DISCOUNT_APPLIED":
    case "DISCOUNT_OFFERED":       return { color: "#fbbf24", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)" };
    case "RETRY_FAILED":           return { color: "#f87171", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.3)" };
    case "TRANSACTION_CREATED":    return { color: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)" };
    case "CASE_CREATED":
    case "CASE_OPENED":            return { color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)" };
    default:                       return { color: "#cbd5e1", bg: "rgba(148,163,184,0.1)",  border: "rgba(148,163,184,0.25)" };
  }
}

function actorStyle(actor: string): { color: string } {
  switch (actor) {
    case "MERCHANT":   return { color: "#a78bfa" };
    case "AI_ENGINE":
    case "AI_AGENT":   return { color: "#34d399" };
    case "SYSTEM":     return { color: "#60a5fa" };
    case "OPERATOR":
    case "ADMIN":      return { color: "#fbbf24" };
    default:           return { color: "var(--text-secondary)" };
  }
}

export default function AuditTrailSection({ logs }: AuditTrailSectionProps) {
  const summaryCards = [
    {
      label: "Total Events",
      value: logs.length,
      color: "#60a5fa",
    },
    {
      label: "Transactions Created",
      value: logs.filter((l) => l.action === "TRANSACTION_CREATED").length,
      color: "#a78bfa",
    },
    {
      label: "Cases Opened",
      value: logs.filter((l) => l.action === "CASE_CREATED" || l.action === "CASE_OPENED").length,
      color: "#34d399",
    },
    {
      label: "Payments Recovered",
      value: logs.filter((l) => l.action === "PAYMENT_RECOVERED" || l.action === "CASE_RESOLVED_MANUALLY").length,
      color: "#10b981",
    },
    {
      label: "Outreach Sent",
      value: logs.filter((l) => l.action === "EMAIL_SENT" || l.action === "SMS_SENT").length,
      color: "#38bdf8",
    },
    {
      label: "Failed Retries",
      value: logs.filter((l) => l.action === "RETRY_FAILED").length,
      color: "#f87171",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Summary cards — 6 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "14px" }}>
        {summaryCards.map(({ label, value, color }) => (
          <div key={label} style={{ background: "var(--surface-raised)",
            border: "1px solid var(--surface-border)", borderRadius: "10px", padding: "18px 20px" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.07em",
              textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "10px" }}>
              {label}
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em", color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "var(--surface-raised)", border: "1px solid var(--surface-border)",
        borderRadius: "10px", overflow: "hidden" }}>

        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--surface-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="section-title">Activity Log</div>
            <div style={{ marginTop: "3px", fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
              All recorded events — transactions, recovery cases, outreach, and resolutions
            </div>
          </div>
          <span style={{ padding: "4px 12px", borderRadius: "6px",
            border: "1px solid var(--surface-border)", background: "var(--surface-overlay)",
            fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            {logs.length} event{logs.length !== 1 ? "s" : ""}
          </span>
        </div>

        {logs.length === 0 ? (
          <div style={{ padding: "56px", textAlign: "center", fontSize: "1rem", color: "var(--text-tertiary)" }}>
            No audit events recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: "20px" }}>Event</th>
                  <th>Transaction</th>
                  <th>Case</th>
                  <th>Customer</th>
                  <th>Details</th>
                  <th>Actor</th>
                  <th style={{ textAlign: "right", paddingRight: "20px" }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const s = eventStyle(log.action);
                  const as_ = actorStyle(log.actor);
                  const dateStr = new Intl.DateTimeFormat("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                    hour: "numeric", minute: "2-digit",
                  }).format(new Date(log.createdAt));

                  return (
                    <tr key={log.id}>
                      {/* Event badge */}
                      <td style={{ paddingLeft: "20px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center",
                          padding: "3px 9px", borderRadius: "4px",
                          border: `1px solid ${s.border}`, background: s.bg, color: s.color,
                          fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.02em",
                          whiteSpace: "nowrap" }}>
                          {log.action.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* Transaction ref */}
                      <td>
                        {log.txnRef ? (
                          <span style={{ fontFamily: "var(--font-geist-mono, monospace)",
                            fontSize: "0.8125rem", fontWeight: 700, color: "#60a5fa",
                            background: "rgba(59,130,246,0.08)",
                            border: "1px solid rgba(59,130,246,0.2)", borderRadius: "4px",
                            padding: "2px 8px", whiteSpace: "nowrap" }}>
                            {log.txnRef}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>—</span>
                        )}
                      </td>

                      {/* Case ref */}
                      <td>
                        {log.caseRef ? (
                          <span style={{ fontFamily: "var(--font-geist-mono, monospace)",
                            fontSize: "0.8125rem", fontWeight: 700, color: "#34d399",
                            background: "rgba(52,211,153,0.08)",
                            border: "1px solid rgba(52,211,153,0.2)", borderRadius: "4px",
                            padding: "2px 8px", whiteSpace: "nowrap" }}>
                            {log.caseRef}
                          </span>
                        ) : log.caseId ? (
                          <span style={{ fontFamily: "var(--font-geist-mono, monospace)",
                            fontSize: "0.8125rem", color: "var(--text-secondary)",
                            background: "var(--surface-overlay)",
                            border: "1px solid var(--surface-border)", borderRadius: "4px",
                            padding: "2px 8px", whiteSpace: "nowrap" }}>
                            #{log.caseId.slice(-6)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>—</span>
                        )}
                      </td>

                      {/* Customer */}
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.875rem" }}>
                          {log.customerName}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "1px" }}>
                          {log.caseType}
                        </div>
                      </td>

                      {/* Details */}
                      <td style={{ maxWidth: "260px" }}>
                        <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)",
                          display: "block", overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap" }}>
                          {log.details
                            ? (() => {
                                try {
                                  const p = JSON.parse(log.details);
                                  // Show meaningful parsed summary
                                  if (p.txnRef) return `${p.txnRef} · ${p.transactionType?.replace(/_/g," ")}`;
                                  if (p.caseRef) return `${p.caseRef} · ${p.type?.replace(/_/g," ")}`;
                                  if (p.recipient) return `To: ${p.recipient}`;
                                  if (p.discountPercent) return `${p.discountPercent}% discount · Code: ${p.promoCode}`;
                                  if (p.recoveredAmount) return `Recovered $${p.recoveredAmount}`;
                                  if (p.reason) return p.reason.replace(/_/g, " ");
                                  return log.details;
                                } catch {
                                  return log.details;
                                }
                              })()
                            : "—"}
                        </span>
                      </td>

                      {/* Actor */}
                      <td>
                        <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: as_.color,
                          background: `${as_.color}12`, border: `1px solid ${as_.color}25`,
                          borderRadius: "4px", padding: "2px 8px" }}>
                          {log.actor}
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td style={{ textAlign: "right", paddingRight: "20px", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                          {dateStr}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
