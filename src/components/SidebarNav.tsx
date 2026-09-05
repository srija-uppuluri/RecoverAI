"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* ─── Icon components (inline SVG, 18×18) ──────────────────────────────── */
function IconOverview() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconCases() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}
function IconAnalytics() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}
function IconTransactions() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
      <line x1="14" y1="15" x2="18" y2="15" />
    </svg>
  );
}
function IconAudit() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

/* ─── Nav item groups ───────────────────────────────────────────────────── */
const WORKSPACE_ITEMS = [
  { href: "/",                    label: "Overview",            Icon: IconOverview },
  { href: "/transactions",        label: "Transactions",        Icon: IconTransactions },
  { href: "/recovery-cases",      label: "Recovery Cases",      Icon: IconCases },
  { href: "/executive-analytics", label: "Executive Analytics", Icon: IconAnalytics },
];
const OPERATIONS_ITEMS = [
  { href: "/audit-trail", label: "Audit Trail", Icon: IconAudit },
];

/* ─── Nav Group ─────────────────────────────────────────────────────────── */
function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: typeof WORKSPACE_ITEMS;
  pathname: string;
}) {
  return (
    <div style={{ marginBottom: "6px" }}>
      <div
        style={{
          padding: "12px 16px 6px",
          fontSize: "0.625rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {items.map(({ href, label: itemLabel, Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`nav-item${isActive ? " active" : ""}`}
            >
              {/* Active left accent bar */}
              {isActive && (
                <span
                  style={{
                    position: "absolute",
                    left: "-10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "3px",
                    height: "22px",
                    background: "var(--brand)",
                    borderRadius: "0 3px 3px 0",
                    boxShadow: "0 0 8px rgba(16,185,129,0.4)",
                  }}
                />
              )}
              <span
                style={{
                  opacity: isActive ? 1 : 0.5,
                  flexShrink: 0,
                  transition: "opacity 0.2s ease",
                }}
              >
                <Icon />
              </span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {itemLabel}
              </span>
              {isActive && (
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "var(--brand)",
                    boxShadow: "0 0 6px rgba(16,185,129,0.5)",
                    flexShrink: 0,
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Sidebar ──────────────────────────────────────────────────────── */
export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* ── Logo / Branding ── */}
      <div
        style={{
          padding: "22px 18px 18px",
          borderBottom: "1px solid var(--surface-border)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Logo mark with glow */}
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
              border: "1px solid rgba(16,185,129,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 0 16px rgba(16,185,129,0.2), 0 0 4px rgba(16,185,129,0.1) inset",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <div>
            <div
              style={{
                fontSize: "1.375rem",
                fontWeight: 900,
                letterSpacing: "-0.04em",
                lineHeight: 1.1,
              }}
            >
              <span
                style={{
                  background: "linear-gradient(90deg, #ffffff 0%, #a7f3d0 50%, #10b981 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Recover
              </span>
              <span
                style={{
                  background: "linear-gradient(135deg, #34d399 0%, #10b981 40%, #6ee7b7 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 0 12px rgba(16,185,129,0.9)) drop-shadow(0 0 4px rgba(52,211,153,0.6))",
                }}
              >
                AI
              </span>
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.02em",
                background: "linear-gradient(90deg, #6ee7b7 0%, #34d399 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                lineHeight: 1.4,
                marginTop: "4px",
                fontStyle: "italic",
              }}
            >
              Recover revenue. Retain customers.
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, paddingTop: "10px", paddingBottom: "10px" }}>
        <NavGroup label="Workspace" items={WORKSPACE_ITEMS} pathname={pathname} />
        <NavGroup label="Operations" items={OPERATIONS_ITEMS} pathname={pathname} />
      </nav>

      {/* ── Bottom Stats Strip ── */}
      <div className="stats-strip">
        <div className="stats-strip-item">
          <span style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
            Platform
          </span>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--brand)" }}>
            ● Online
          </span>
        </div>
        <div className="stats-strip-item">
          <span style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
            AI Engine
          </span>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#3b82f6" }}>
            v2.4
          </span>
        </div>
      </div>
    </aside>
  );
}
