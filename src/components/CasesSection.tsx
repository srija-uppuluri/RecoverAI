"use client";

import { useState, useEffect, useMemo } from "react";
import type { RecommendationResult } from "@/lib/recommendations";

/* ─── Exported types (unchanged) ───────────────────────────────────────── */
export interface SerializedAuditLog {
  id: string;
  action: string;
  actor: string;
  details?: string | null;
  createdAt: string;
}

export interface SerializedCase {
  id: string;
  status: string;
  priority: string;
  recoveredAmount: number;
  attemptsCount: number;
  createdAt: string;
  caseType: "Failed Payment" | "Checkout Abandonment" | "Failed Subscription" | "Overdue Invoice";
  customer: {
    name: string;
    email: string;
    phone?: string | null;
    riskScore?: number | null;
  };
  transaction?: {
    amount: number;
    paymentMethod?: string | null;
    failureReason?: string | null;
  } | null;
}

interface CasesSectionProps {
  cases: SerializedCase[];
  initialRecommendation?: RecommendationResult | null;
  initialSelectedCaseId?: string;
  initialAuditLogs?: SerializedAuditLog[];
}

type ActionKey = "SEND_EMAIL" | "SEND_SMS" | "APPLY_DISCOUNT" | "RETRY_PAYMENT" | "MARK_RESOLVED";

/* ─── Badge helpers (style objects, no Tailwind) ────────────────────────── */
function riskStyle(score: number | null): { label: string; color: string; bg: string; border: string } {
  const v = score ?? 0;
  if (v >= 0.5) return { label: "High Risk",  color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)"  };
  if (v >= 0.25) return { label: "Med Risk",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)" };
  return              { label: "Low Risk",   color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)" };
}

function statusStyle(s: string): { color: string; bg: string; border: string } {
  switch (s) {
    case "RECOVERED":   return { color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)"  };
    case "IN_PROGRESS": return { color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.25)"  };
    case "OPEN":        return { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)"  };
    case "ESCALATED":   return { color: "#a855f7", bg: "rgba(168,85,247,0.1)",  border: "rgba(168,85,247,0.25)"  };
    case "FAILED":      return { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)"   };
    default:            return { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)"  };
  }
}

function priorityStyle(p: string): { color: string; label: string } {
  switch (p) {
    case "URGENT": return { color: "#ef4444", label: "Urgent"   };
    case "HIGH":   return { color: "#f59e0b", label: "High"     };
    case "MEDIUM": return { color: "#3b82f6", label: "Medium"   };
    default:       return { color: "#475569", label: p          };
  }
}

function actionStyle(a: string): { color: string; bg: string; border: string } {
  switch (a) {
    case "SMART_RETRY":       return { color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.25)"  };
    case "AP_ESCALATION":
    case "MANUAL_OUTREACH":   return { color: "#a855f7", bg: "rgba(168,85,247,0.1)",  border: "rgba(168,85,247,0.25)"  };
    case "CARD_UPDATE_REQUEST":
    case "PAYMENT_LINK":      return { color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)"  };
    case "DISCOUNT_INCENTIVE":
    case "GRACE_PERIOD_EXTENSION": return { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" };
    default:                  return { color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)"  };
  }
}

function channelStyle(ch: string): { color: string; bg: string; border: string } {
  switch (ch) {
    case "EMAIL": return { color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.25)"  };
    case "SMS":   return { color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)"  };
    case "BOTH":  return { color: "#a855f7", bg: "rgba(168,85,247,0.1)",  border: "rgba(168,85,247,0.25)"  };
    default:      return { color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)"  };
  }
}

function auditActionStyle(a: string): { color: string; bg: string; border: string } {
  switch (a) {
    case "PAYMENT_RECOVERED":
    case "CASE_RESOLVED_MANUALLY": return { color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)"  };
    case "EMAIL_SENT":
    case "SMS_SENT":               return { color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.25)"  };
    case "DISCOUNT_APPLIED":
    case "DISCOUNT_OFFERED":       return { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)"  };
    case "RETRY_FAILED":           return { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)"   };
    default:                       return { color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)"  };
  }
}

/* ─── Reusable inline badge ──────────────────────────────────────────────── */
function Chip({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "4px",
        border: `1px solid ${border}`,
        background: bg,
        color,
        fontSize: "0.6875rem",
        fontWeight: 600,
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

/* ─── Action button ──────────────────────────────────────────────────────── */
function ActionBtn({
  label,
  emoji,
  highlighted,
  loading,
  disabled,
  onClick,
}: {
  label: string;
  emoji: string;
  highlighted?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "7px 14px",
        borderRadius: "6px",
        border: highlighted ? "1px solid rgba(16,185,129,0.5)" : "1px solid var(--surface-border)",
        background: highlighted ? "rgba(16,185,129,0.12)" : "var(--surface-overlay)",
        color: highlighted ? "#10b981" : "var(--text-secondary)",
        fontSize: "0.75rem",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {loading ? (
        <span
          className="spin"
          style={{
            width: "12px",
            height: "12px",
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: "50%",
            display: "inline-block",
          }}
        />
      ) : (
        <span style={{ fontSize: "0.875rem" }}>{emoji}</span>
      )}
      {label}
    </button>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function CasesSection({
  cases: initialCases,
  initialRecommendation,
  initialSelectedCaseId,
  initialAuditLogs = [],
}: CasesSectionProps) {

  /* ── State (logic unchanged) ── */
  const [casesList, setCasesList] = useState<SerializedCase[]>(initialCases);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [auditLogs, setAuditLogs] = useState<SerializedAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [executingAction, setExecutingAction] = useState<ActionKey | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"recommendation" | "audit">("recommendation");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const selectedCase = selectedCaseId ? casesList.find((c) => c.id === selectedCaseId) ?? null : null;

  /* ── Fetch on case select (logic unchanged) ── */
  useEffect(() => {
    if (!selectedCaseId) return;
    setFeedback(null);
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/recommendations?caseId=${selectedCaseId}`);
        const data = await res.json();
        if (!cancelled && data.success) {
          if (data.recommendation) setRecommendation(data.recommendation);
          if (data.auditLogs) {
            setAuditLogs(
              data.auditLogs.map((log: SerializedAuditLog) => ({
                ...log,
                createdAt: typeof log.createdAt === "string" ? log.createdAt : new Date(log.createdAt).toISOString(),
              }))
            );
          }
        }
      } catch (e) {
        console.error("Failed to load case data:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedCaseId]);

  /* ── Copy message (logic unchanged) ── */
  const handleCopyMessage = () => {
    if (!recommendation?.customerMessage) return;
    navigator.clipboard.writeText(recommendation.customerMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Execute action (logic unchanged) ── */
  const handleExecuteAction = async (actionType: ActionKey) => {
    if (!selectedCase) return;
    setExecutingAction(actionType);
    setFeedback(null);
    try {
      const res = await fetch("/api/cases/execute-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCase.id,
          actionType,
          customMessage: recommendation?.customerMessage,
          actor: "OPERATOR",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: "error", message: data.error || "Action execution failed." });
        return;
      }
      setFeedback({ type: "success", message: data.message });
      setCasesList((prev) =>
        prev.map((c) =>
          c.id === selectedCase.id
            ? {
                ...c,
                status: data.status,
                recoveredAmount: data.recoveredAmount ?? c.recoveredAmount,
                attemptsCount: actionType === "RETRY_PAYMENT" ? c.attemptsCount + 1 : c.attemptsCount,
              }
            : c
        )
      );
      if (data.auditLogId) {
        const labelMap: Record<ActionKey, string> = {
          SEND_EMAIL: "EMAIL_SENT", SEND_SMS: "SMS_SENT", APPLY_DISCOUNT: "DISCOUNT_APPLIED",
          RETRY_PAYMENT: "PAYMENT_RECOVERED", MARK_RESOLVED: "CASE_RESOLVED_MANUALLY",
        };
        setAuditLogs((prev) => [
          { id: data.auditLogId, action: labelMap[actionType] || actionType, actor: "OPERATOR", details: data.message, createdAt: new Date().toISOString() },
          ...prev,
        ]);
      }
    } catch {
      setFeedback({ type: "error", message: "An unexpected network error occurred." });
    } finally {
      setExecutingAction(null);
    }
  };

  /* ── Filtered cases (logic unchanged) ── */
  const filteredCases = useMemo(() => {
    return casesList.filter((c) => {
      const matchStatus = statusFilter === "ALL" || c.status === statusFilter;
      const matchQuery =
        !searchQuery ||
        c.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.caseType.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchQuery;
    });
  }, [casesList, statusFilter, searchQuery]);

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* ══ AI Recommendation Panel ══════════════════════════════════════════ */}
      {!selectedCase ? (
        /* Empty state */
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--surface-border)",
            borderRadius: "8px",
            padding: "40px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "var(--surface-overlay)",
              border: "1px solid var(--surface-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-tertiary)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
          </div>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            Select a case to view the AI recovery recommendation
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
            Click any row in the table below
          </div>
        </div>
      ) : (
        /* Recommendation panel */
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid rgba(16,185,129,0.25)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {/* Panel header */}
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--surface-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            {/* Left: case identity */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="pulse-dot" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--brand)", flexShrink: 0 }} />
                <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--brand)" }}>
                  AI Recovery Recommendation
                </span>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-geist-mono, monospace)",
                  fontSize: "0.6875rem",
                  color: "var(--text-tertiary)",
                  background: "var(--surface-overlay)",
                  border: "1px solid var(--surface-border)",
                  borderRadius: "4px",
                  padding: "2px 7px",
                }}
              >
                #{selectedCase.id.slice(-6)}
              </span>
              {(() => { const s = statusStyle(selectedCase.status); return <Chip label={selectedCase.status.replace("_", " ")} {...s} />; })()}
              {selectedCase.customer.riskScore != null && (() => {
                const r = riskStyle(selectedCase.customer.riskScore);
                return (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "0.6875rem", fontWeight: 600, color: r.color }}>
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: r.color, display: "inline-block" }} />
                    {r.label} · {selectedCase.customer.riskScore.toFixed(2)}
                  </span>
                );
              })()}
            </div>

            {/* Right: customer + amount */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {selectedCase.customer.name}
              </span>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                ${selectedCase.transaction?.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
              <span
                style={{
                  fontSize: "0.6875rem",
                  color: "var(--text-tertiary)",
                  background: "var(--surface-overlay)",
                  border: "1px solid var(--surface-border)",
                  borderRadius: "4px",
                  padding: "2px 7px",
                }}
              >
                {selectedCase.caseType}
              </span>
            </div>
          </div>

          {/* Tab switcher */}
          <div
            style={{
              padding: "0 20px",
              borderBottom: "1px solid var(--surface-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex" }}>
              {(["recommendation", "audit"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "10px 16px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: activeTab === tab ? "var(--brand)" : "var(--text-tertiary)",
                    background: "transparent",
                    border: "none",
                    borderBottom: activeTab === tab ? "2px solid var(--brand)" : "2px solid transparent",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    marginBottom: "-1px",
                  }}
                >
                  {tab === "recommendation" ? "Recommendation" : `Activity Trail (${auditLogs.length})`}
                </button>
              ))}
            </div>
            {recommendation && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                  Confidence:
                  <strong style={{ color: "var(--brand)", marginLeft: "4px" }}>
                    {(recommendation.estimatedRecoveryProbability * 100).toFixed(0)}%
                  </strong>
                </span>
                <span style={{ color: "var(--surface-border)", fontSize: "0.75rem" }}>|</span>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                  Urgency:
                  <strong style={{ color: "#f59e0b", marginLeft: "4px" }}>
                    {recommendation.metadata.urgency}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Panel body */}
          <div style={{ padding: "20px" }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "32px", color: "var(--text-tertiary)" }}>
                <span className="spin" style={{ width: "18px", height: "18px", border: "2px solid var(--brand)", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block" }} />
                <span style={{ fontSize: "0.8125rem" }}>Analysing recovery strategy…</span>
              </div>
            ) : activeTab === "recommendation" && recommendation ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Two-column: action/channel/reason | message */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  {/* Left */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      {/* Recommended action */}
                      <div
                        style={{
                          background: "var(--surface-overlay)",
                          border: "1px solid var(--surface-border)",
                          borderRadius: "6px",
                          padding: "12px 14px",
                        }}
                      >
                        <div className="label-xs" style={{ marginBottom: "8px" }}>Recommended Action</div>
                        {(() => { const s = actionStyle(recommendation.action); return <Chip label={recommendation.action.replace(/_/g, " ")} {...s} />; })()}
                      </div>
                      {/* Channel */}
                      <div
                        style={{
                          background: "var(--surface-overlay)",
                          border: "1px solid var(--surface-border)",
                          borderRadius: "6px",
                          padding: "12px 14px",
                        }}
                      >
                        <div className="label-xs" style={{ marginBottom: "8px" }}>Channel</div>
                        {(() => { const s = channelStyle(recommendation.channel); return <Chip label={recommendation.channel} {...s} />; })()}
                      </div>
                    </div>
                    {/* Strategic reason */}
                    <div
                      style={{
                        background: "var(--surface-overlay)",
                        border: "1px solid var(--surface-border)",
                        borderRadius: "6px",
                        padding: "12px 14px",
                        flex: 1,
                      }}
                    >
                      <div className="label-xs" style={{ marginBottom: "8px" }}>Strategic Reason</div>
                      <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                        {recommendation.reason}
                      </p>
                    </div>
                  </div>

                  {/* Right: customer message */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div className="label-xs">Customer Message</div>
                      <button
                        onClick={handleCopyMessage}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "4px 10px",
                          borderRadius: "5px",
                          border: "1px solid var(--surface-border)",
                          background: "var(--surface-overlay)",
                          color: copied ? "var(--brand)" : "var(--text-secondary)",
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {copied ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        background: "var(--surface-overlay)",
                        border: "1px solid var(--surface-border)",
                        borderRadius: "6px",
                        padding: "14px",
                        fontFamily: "var(--font-geist-mono, monospace)",
                        fontSize: "0.8125rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.65,
                        minHeight: "100px",
                      }}
                    >
                      &ldquo;{recommendation.customerMessage}&rdquo;
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "0.6875rem",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      <span>⏱ {recommendation.metadata.suggestedTiming}</span>
                      <span>{recommendation.metadata.strategyName}</span>
                    </div>
                  </div>
                </div>

                {/* Action toolbar */}
                <div
                  style={{
                    borderTop: "1px solid var(--surface-border)",
                    paddingTop: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-tertiary)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                      </svg>
                      Execute Recovery Action
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      <ActionBtn
                        label="Send Email"
                        emoji="✉️"
                        highlighted={recommendation.channel === "EMAIL" || recommendation.channel === "BOTH"}
                        loading={executingAction === "SEND_EMAIL"}
                        disabled={executingAction !== null}
                        onClick={() => handleExecuteAction("SEND_EMAIL")}
                      />
                      <ActionBtn
                        label="Send SMS"
                        emoji="💬"
                        highlighted={recommendation.channel === "SMS" || recommendation.channel === "BOTH"}
                        loading={executingAction === "SEND_SMS"}
                        disabled={executingAction !== null}
                        onClick={() => handleExecuteAction("SEND_SMS")}
                      />
                      <ActionBtn
                        label="Apply Discount (15%)"
                        emoji="🏷️"
                        loading={executingAction === "APPLY_DISCOUNT"}
                        disabled={executingAction !== null}
                        onClick={() => handleExecuteAction("APPLY_DISCOUNT")}
                      />
                      <ActionBtn
                        label="Retry Payment"
                        emoji="⚡"
                        loading={executingAction === "RETRY_PAYMENT"}
                        disabled={executingAction !== null}
                        onClick={() => handleExecuteAction("RETRY_PAYMENT")}
                      />
                      <ActionBtn
                        label="Mark Resolved"
                        emoji="✓"
                        loading={executingAction === "MARK_RESOLVED"}
                        disabled={executingAction !== null}
                        onClick={() => handleExecuteAction("MARK_RESOLVED")}
                      />
                    </div>
                  </div>

                  {/* Feedback banner */}
                  {feedback && (
                    <div
                      style={{
                        marginTop: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: "6px",
                        border: `1px solid ${feedback.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                        background: feedback.type === "success" ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                        fontSize: "0.8125rem",
                        color: feedback.type === "success" ? "#10b981" : "#ef4444",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <strong>{feedback.type === "success" ? "✓ Executed:" : "✕ Blocked:"}</strong>
                        {feedback.message}
                      </div>
                      <button
                        onClick={() => setFeedback(null)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.7, fontSize: "1rem", lineHeight: 1, padding: "0 4px" }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === "audit" ? (
              /* ── Activity Trail tab ── */
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Case summary */}
                <div
                  style={{
                    padding: "12px 16px",
                    background: "var(--surface-overlay)",
                    border: "1px solid var(--surface-border)",
                    borderRadius: "6px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "16px",
                    fontSize: "0.8125rem",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{selectedCase.customer.name}</span>
                  <span style={{ color: "var(--text-tertiary)" }}>{selectedCase.customer.email}</span>
                  {selectedCase.customer.phone && <span style={{ color: "var(--text-tertiary)" }}>{selectedCase.customer.phone}</span>}
                  <span style={{ color: "var(--text-tertiary)" }}>Type: <strong style={{ color: "var(--text-secondary)" }}>{selectedCase.caseType}</strong></span>
                  <span style={{ color: "var(--text-tertiary)" }}>Priority: <strong style={{ color: priorityStyle(selectedCase.priority).color }}>{priorityStyle(selectedCase.priority).label}</strong></span>
                  {selectedCase.customer.riskScore != null && (
                    <span style={{ color: "var(--text-tertiary)" }}>Risk: <strong style={{ color: riskStyle(selectedCase.customer.riskScore).color }}>{riskStyle(selectedCase.customer.riskScore).label}</strong></span>
                  )}
                </div>

                {/* Audit entries */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingBottom: "10px",
                      borderBottom: "1px solid var(--surface-border)",
                      marginBottom: "10px",
                      fontSize: "0.75rem",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Case Activity</span>
                    <span>{auditLogs.length} event{auditLogs.length !== 1 ? "s" : ""}</span>
                  </div>

                  {auditLogs.length === 0 ? (
                    <div style={{ padding: "24px", textAlign: "center", fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
                      No activity recorded for this case yet.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "260px", overflowY: "auto" }}>
                      {[...auditLogs].reverse().map((log) => {
                        const s = auditActionStyle(log.action);
                        const dateStr = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(log.createdAt));
                        return (
                          <div
                            key={log.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              padding: "9px 12px",
                              background: "var(--surface-overlay)",
                              border: "1px solid var(--surface-border)",
                              borderRadius: "6px",
                              fontSize: "0.8125rem",
                            }}
                          >
                            <Chip label={log.action.replace(/_/g, " ")} {...s} />
                            <span style={{ flex: 1, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {log.details || "Event recorded"}
                            </span>
                            <span style={{ color: "var(--text-tertiary)", fontSize: "0.6875rem", whiteSpace: "nowrap", flexShrink: 0 }}>
                              <strong style={{ color: "var(--text-secondary)" }}>{log.actor}</strong> · {dateStr}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: "24px", textAlign: "center", fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
                No recommendation loaded.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Cases Table ══════════════════════════════════════════════════════ */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--surface-border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {/* Table toolbar */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--surface-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <div className="section-title">Recovery Cases</div>
            <div style={{ marginTop: "2px", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
              {filteredCases.length} of {casesList.length} cases · click a row to load AI recommendation
            </div>
          </div>

          {/* Search */}
          <div style={{ position: "relative" }}>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }}
            >
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer, email, type…"
              style={{
                paddingLeft: "32px",
                paddingRight: "12px",
                paddingTop: "7px",
                paddingBottom: "7px",
                background: "var(--surface-overlay)",
                border: "1px solid var(--surface-border)",
                borderRadius: "6px",
                color: "var(--text-primary)",
                fontSize: "0.8125rem",
                width: "240px",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Status filters */}
        <div
          style={{
            padding: "10px 20px",
            borderBottom: "1px solid var(--surface-border)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexWrap: "wrap",
          }}
        >
          {["ALL", "OPEN", "IN_PROGRESS", "RECOVERED", "ESCALATED", "FAILED"].map((st) => {
            const active = statusFilter === st;
            const s = st !== "ALL" ? statusStyle(st) : null;
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: "4px 12px",
                  borderRadius: "5px",
                  border: active
                    ? `1px solid ${s ? s.border : "rgba(16,185,129,0.4)"}`
                    : "1px solid var(--surface-border)",
                  background: active
                    ? `${s ? s.bg : "rgba(16,185,129,0.1)"}`
                    : "transparent",
                  color: active
                    ? `${s ? s.color : "var(--brand)"}`
                    : "var(--text-tertiary)",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {st === "ALL" ? "All" : st.replace("_", " ")}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: "20px" }}>Customer</th>
                <th>Amount</th>
                <th>Risk</th>
                <th>Case Type</th>
                <th>Status</th>
                <th>Priority</th>
                <th style={{ textAlign: "right", paddingRight: "20px" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>
                    No cases match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => {
                  const isSelected = c.id === selectedCaseId;
                  const ss = statusStyle(c.status);
                  const rs = riskStyle(c.customer.riskScore ?? null);
                  const ps = priorityStyle(c.priority);
                  const dateStr = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(c.createdAt));

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCaseId(c.id)}
                      style={{
                        cursor: "pointer",
                        background: isSelected ? "rgba(16,185,129,0.06)" : undefined,
                        borderLeft: isSelected ? "3px solid var(--brand)" : "3px solid transparent",
                        transition: "background 0.15s",
                      }}
                    >
                      {/* Customer */}
                      <td style={{ paddingLeft: isSelected ? "17px" : "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "6px",
                              background: isSelected ? "rgba(16,185,129,0.15)" : "var(--surface-overlay)",
                              border: isSelected ? "1px solid rgba(16,185,129,0.3)" : "1px solid var(--surface-border)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              color: isSelected ? "var(--brand)" : "var(--text-secondary)",
                              flexShrink: 0,
                              fontFamily: "var(--font-geist-mono, monospace)",
                            }}
                          >
                            {c.customer.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px" }}>
                              {c.customer.name}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px" }}>
                              {c.customer.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Amount */}
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          ${c.transaction?.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                          {c.transaction?.paymentMethod || "CARD"}
                        </div>
                      </td>

                      {/* Risk */}
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            border: `1px solid ${rs.border}`,
                            background: rs.bg,
                            color: rs.color,
                            fontSize: "0.6875rem",
                            fontWeight: 600,
                          }}
                        >
                          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: rs.color }} />
                          {c.customer.riskScore?.toFixed(2)} · {rs.label}
                        </span>
                      </td>

                      {/* Case type */}
                      <td>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            background: "var(--surface-overlay)",
                            border: "1px solid var(--surface-border)",
                            color: "var(--text-secondary)",
                            fontSize: "0.6875rem",
                            fontWeight: 500,
                          }}
                        >
                          {c.caseType}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <Chip label={c.status.replace("_", " ")} color={ss.color} bg={ss.bg} border={ss.border} />
                      </td>

                      {/* Priority */}
                      <td>
                        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: ps.color }}>
                          {ps.label}
                        </span>
                      </td>

                      {/* Date */}
                      <td style={{ textAlign: "right", paddingRight: "20px", whiteSpace: "nowrap", color: "var(--text-tertiary)", fontSize: "0.75rem" }}>
                        {dateStr}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
