"use client";

import { usePathname } from "next/navigation";

const PAGE_META: Record<string, { title: string; crumb: string }> = {
  "/":                    { title: "Overview",             crumb: "Workspace / Overview" },
  "/transactions":        { title: "Transactions",         crumb: "Workspace / Transactions" },
  "/recovery-cases":      { title: "Recovery Cases",       crumb: "Workspace / Recovery Cases" },
  "/executive-analytics": { title: "Executive Analytics",  crumb: "Workspace / Executive Analytics" },
  "/audit-trail":         { title: "Audit Trail",          crumb: "Operations / Audit Trail" },
};

export default function TopBar() {
  const pathname = usePathname();
  const meta = PAGE_META[pathname] ?? { title: "RecoverAI", crumb: "RecoverAI" };

  const today = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return (
    <header className="topbar" style={{ justifyContent: "space-between" }}>
      {/* Left — breadcrumb + title */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div>
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              color: "var(--text-tertiary)",
              letterSpacing: "0.04em",
              marginBottom: "2px",
            }}
          >
            {meta.crumb.split(" / ").map((part, i, arr) => (
              <span key={i}>
                {i > 0 && (
                  <span style={{ margin: "0 6px", opacity: 0.4 }}>
                    <svg
                      width="10" height="10" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      style={{ display: "inline", verticalAlign: "middle" }}
                    >
                      <polyline points="9 6 15 12 9 18" />
                    </svg>
                  </span>
                )}
                <span style={i === arr.length - 1 ? { color: "var(--text-secondary)" } : undefined}>
                  {part}
                </span>
              </span>
            ))}
          </div>
          <div
            style={{
              fontSize: "1.125rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.015em",
            }}
          >
            {meta.title}
          </div>
        </div>
      </div>

      {/* Right — search, date, avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* Search */}
        <div className="topbar-search">
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, opacity: 0.5 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search..." readOnly />
        </div>

        {/* Date chip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--surface-border)",
            borderRadius: "8px",
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--text-secondary)",
            whiteSpace: "nowrap",
          }}
        >
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ opacity: 0.5 }}
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {today}
        </div>

        {/* Notification bell */}
        <div className="notification-dot" style={{ cursor: "pointer" }}>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-tertiary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        </div>

        {/* Avatar */}
        <div className="avatar">
          <span>SR</span>
        </div>
      </div>
    </header>
  );
}
