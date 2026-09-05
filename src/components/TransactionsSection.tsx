"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

/* ─── Types ──────────────────────────────────────────────────────────────── */
export interface SerializedTransaction {
  id: string;
  txnRef: string;
  customerName: string;
  customerEmail: string;
  customerId: string;
  amount: number;
  currency: string;
  transactionType: string;
  status: string;
  paymentMethod: string;
  failureReason: string | null;
  riskScore: number;
  transactionDate: string;
  createdAt: string;
  recoveryCase: {
    id: string;
    caseRef: string;
    status: string;
    recoveredAmount: number;
  } | null;
}

interface KPIs {
  total: number;
  successful: number;
  failed: number;
  pending: number;
  totalValue: number;
  revenueAtRisk: number;
  unlinkedRecoverable: number;
}

interface TransactionsSectionProps {
  transactions: SerializedTransaction[];
  kpis: KPIs;
}

/* ─── Style helpers ──────────────────────────────────────────────────────── */
function txnStatusStyle(s: string) {
  switch (s) {
    case "SUCCEEDED": return { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" };
    case "FAILED":    return { color: "#ef4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)"  };
    case "PENDING":   return { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" };
    case "REFUNDED":  return { color: "#a855f7", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.3)" };
    default:          return { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)"};
  }
}

function caseStatusStyle(s: string) {
  switch (s) {
    case "RECOVERED":   return { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" };
    case "IN_PROGRESS": return { color: "#3b82f6", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)" };
    case "OPEN":        return { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" };
    case "ESCALATED":   return { color: "#a855f7", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.3)" };
    case "FAILED":      return { color: "#ef4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)"  };
    default:            return { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)"};
  }
}

function riskStyle(score: number) {
  if (score >= 0.5) return { label: "High",   color: "#ef4444", dot: "#ef4444" };
  if (score >= 0.25) return { label: "Medium", color: "#f59e0b", dot: "#f59e0b" };
  return                   { label: "Low",    color: "#10b981", dot: "#10b981" };
}

function typeLabel(t: string) {
  switch (t) {
    case "FAILED_PAYMENT":       return "Failed Payment";
    case "CHECKOUT_ABANDONMENT": return "Checkout Abandonment";
    case "FAILED_SUBSCRIPTION":  return "Failed Subscription";
    case "OVERDUE_INVOICE":      return "Overdue Invoice";
    default: return t.replace(/_/g, " ");
  }
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Chip({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: "4px",
      border: `1px solid ${border}`, background: bg, color, fontSize: "0.6875rem", fontWeight: 700,
      letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

/* ─── KPI Card ───────────────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, accent, icon }: {
  label: string; value: React.ReactNode; sub?: string; accent: string; icon: React.ReactNode;
}) {
  return (
    <div style={{ background: "var(--surface-raised)", border: "1px solid var(--surface-border)",
      borderRadius: "10px", padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.06em",
          textTransform: "uppercase", color: "var(--text-tertiary)" }}>{label}</span>
        <div style={{ width: "32px", height: "32px", borderRadius: "8px",
          background: `${accent}18`, border: `1px solid ${accent}30`,
          display: "flex", alignItems: "center", justifyContent: "center", color: accent }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>{sub}</div>}
    </div>
  );
}

/* ─── Add Transaction Modal ──────────────────────────────────────────────── */
function AddTransactionModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (txn: SerializedTransaction, message: string) => void;
}) {
  const [form, setForm] = useState({
    customerName: "", customerEmail: "", amount: "",
    currency: "USD", transactionType: "FAILED_PAYMENT",
    paymentMethod: "CREDIT_CARD", status: "FAILED",
    transactionDate: new Date().toISOString().slice(0, 16),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    setError(null);
    if (!form.customerName.trim() || !form.customerEmail.trim() || !form.amount) {
      setError("Customer name, email, and amount are required."); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) {
      setError("Enter a valid email address."); return;
    }
    if (isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      setError("Amount must be a positive number."); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Failed to create transaction."); return; }
      onCreated(data.transaction, data.message);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldStyle = {
    width: "100%", padding: "9px 12px",
    background: "var(--surface-overlay)", border: "1px solid var(--surface-border)",
    borderRadius: "6px", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none",
  };
  const labelStyle = { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)",
    display: "block", marginBottom: "6px", letterSpacing: "0.02em" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center",
      justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px",
        width: "100%", maxWidth: "560px", maxHeight: "92vh", overflowY: "auto",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--surface-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>Add Transaction</div>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", marginTop: "2px" }}>
              Create a new merchant transaction record
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer",
            color: "var(--text-tertiary)", fontSize: "1.25rem", lineHeight: 1, padding: "4px" }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "6px", color: "#ef4444", fontSize: "0.8125rem" }}>{error}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Customer Name *</label>
              <input style={fieldStyle} placeholder="e.g. Derrick Hayes"
                value={form.customerName} onChange={(e) => set("customerName", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Customer Email *</label>
              <input style={fieldStyle} type="email" placeholder="e.g. d.hayes@example.com"
                value={form.customerEmail} onChange={(e) => set("customerEmail", e.target.value)} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Amount *</label>
              <input style={fieldStyle} type="number" min="0.01" step="0.01" placeholder="e.g. 520.00"
                value={form.amount} onChange={(e) => set("amount", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Currency</label>
              <select style={fieldStyle} value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="INR">INR — Indian Rupee</option>
                <option value="CAD">CAD — Canadian Dollar</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Transaction Type *</label>
            <select style={fieldStyle} value={form.transactionType} onChange={(e) => set("transactionType", e.target.value)}>
              <option value="FAILED_PAYMENT">Failed Payment</option>
              <option value="CHECKOUT_ABANDONMENT">Checkout Abandonment</option>
              <option value="FAILED_SUBSCRIPTION">Failed Subscription</option>
              <option value="OVERDUE_INVOICE">Overdue Invoice</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Payment Method *</label>
              <select style={fieldStyle} value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="DEBIT_CARD">Debit Card</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="PAYPAL">PayPal</option>
                <option value="ACH">ACH</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status *</label>
              <select style={fieldStyle} value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="FAILED">Failed</option>
                <option value="PENDING">Pending</option>
                <option value="SUCCEEDED">Successful</option>
                <option value="REFUNDED">Refunded</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Transaction Date</label>
            <input style={fieldStyle} type="datetime-local"
              value={form.transactionDate} onChange={(e) => set("transactionDate", e.target.value)} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--surface-border)",
          display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: "6px",
            border: "1px solid var(--surface-border)", background: "transparent",
            color: "var(--text-secondary)", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ padding: "9px 24px", borderRadius: "6px",
              border: "1px solid rgba(16,185,129,0.4)", background: "rgba(16,185,129,0.15)",
              color: "#10b981", fontSize: "0.875rem", fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1,
              display: "flex", alignItems: "center", gap: "8px" }}>
            {submitting && <span className="spin" style={{ width: "14px", height: "14px",
              border: "2px solid #10b981", borderTopColor: "transparent", borderRadius: "50%",
              display: "inline-block" }} />}
            {submitting ? "Creating…" : "+ Add Transaction"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Create Recovery Case Modal ─────────────────────────────────────────── */
function CreateCaseModal({ txn, onClose, onCreated }: {
  txn: SerializedTransaction;
  onClose: () => void;
  onCreated: (txnId: string, caseData: NonNullable<SerializedTransaction["recoveryCase"]>, message: string) => void;
}) {
  const [priority, setPriority] = useState("MEDIUM");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/transactions/create-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: txn.id, priority }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Failed to create case."); return; }
      onCreated(txn.id, {
        id: data.recoveryCase.id,
        caseRef: data.recoveryCase.caseRef,
        status: data.recoveryCase.status,
        recoveredAmount: 0,
      }, data.message);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldStyle = {
    width: "100%", padding: "9px 12px",
    background: "var(--surface-overlay)", border: "1px solid var(--surface-border)",
    borderRadius: "6px", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center",
      justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px",
        width: "100%", maxWidth: "480px", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--surface-border)",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>Create Recovery Case</div>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", marginTop: "2px" }}>
              From transaction {txn.txnRef}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer",
            color: "var(--text-tertiary)", fontSize: "1.25rem" }}>×</button>
        </div>

        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", color: "#ef4444",
              fontSize: "0.8125rem" }}>{error}</div>
          )}

          {/* Summary */}
          {[
            ["Transaction", txn.txnRef],
            ["Customer", txn.customerName],
            ["Email", txn.customerEmail],
            ["Amount at Risk", `$${fmt(txn.amount)} ${txn.currency}`],
            ["Case Type", typeLabel(txn.transactionType)],
            ["Payment Method", txn.paymentMethod.replace(/_/g, " ")],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between",
              padding: "8px 12px", background: "var(--surface-overlay)",
              border: "1px solid var(--surface-border)", borderRadius: "6px" }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>{k}</span>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>{v}</span>
            </div>
          ))}

          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)",
              display: "block", marginBottom: "6px" }}>Priority</label>
            <select style={fieldStyle} value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--surface-border)",
          display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: "6px",
            border: "1px solid var(--surface-border)", background: "transparent",
            color: "var(--text-secondary)", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleCreate} disabled={submitting}
            style={{ padding: "9px 24px", borderRadius: "6px",
              border: "1px solid rgba(16,185,129,0.4)", background: "rgba(16,185,129,0.15)",
              color: "#10b981", fontSize: "0.875rem", fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1,
              display: "flex", alignItems: "center", gap: "8px" }}>
            {submitting && <span className="spin" style={{ width: "14px", height: "14px",
              border: "2px solid #10b981", borderTopColor: "transparent", borderRadius: "50%",
              display: "inline-block" }} />}
            {submitting ? "Creating…" : "Create Case"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Transaction Detail Panel ───────────────────────────────────────────── */
function TransactionDetailPanel({ txn, onClose, onCreateCase }: {
  txn: SerializedTransaction;
  onClose: () => void;
  onCreateCase: (txn: SerializedTransaction) => void;
}) {
  const ss = txnStatusStyle(txn.status);
  const rs = riskStyle(txn.riskScore);
  const canCreateCase = (txn.status === "FAILED" || txn.status === "PENDING") && !txn.recoveryCase;

  const timelineEvents = [
    { label: "Transaction Created", date: txn.createdAt, color: "#3b82f6" },
    { label: "Payment Attempted", date: txn.transactionDate, color: "#f59e0b" },
    ...(txn.status === "FAILED" ? [{ label: "Payment Failed", date: txn.transactionDate, color: "#ef4444" }] : []),
    ...(txn.recoveryCase ? [{ label: `Recovery Case Created (${txn.recoveryCase.caseRef})`, date: txn.createdAt, color: "#10b981" }] : []),
  ];

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 900, width: "440px",
      background: "#0f172a", borderLeft: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "-8px 0 40px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column",
      overflowY: "auto" }}>

      {/* Header */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--surface-border)",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.07em",
            textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "4px" }}>
            Transaction Details
          </div>
          <div style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)",
            fontFamily: "var(--font-geist-mono, monospace)" }}>{txn.txnRef}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer",
          color: "var(--text-tertiary)", fontSize: "1.25rem", lineHeight: 1 }}>×</button>
      </div>

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>

        {/* Amount + Status */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--surface-border)", borderRadius: "10px" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "4px" }}>Amount</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: txn.status === "FAILED" ? "#ef4444" : "var(--text-primary)" }}>
              ${fmt(txn.amount)}
              <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-tertiary)", marginLeft: "6px" }}>
                {txn.currency}
              </span>
            </div>
          </div>
          <Chip label={txn.status} color={ss.color} bg={ss.bg} border={ss.border} />
        </div>

        {/* Fields grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            ["Customer",       txn.customerName],
            ["Email",          txn.customerEmail],
            ["Type",           typeLabel(txn.transactionType)],
            ["Payment Method", txn.paymentMethod.replace(/_/g, " ")],
            ["Date",           new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(txn.transactionDate))],
            ...(txn.failureReason ? [["Failure Reason", txn.failureReason.replace(/_/g, " ")]] : []),
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "9px 12px", background: "var(--surface-overlay)",
              border: "1px solid var(--surface-border)", borderRadius: "6px" }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>{k}</span>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)",
                maxWidth: "220px", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
            </div>
          ))}
          {/* Risk Score */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "9px 12px", background: "var(--surface-overlay)",
            border: "1px solid var(--surface-border)", borderRadius: "6px" }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>Risk Score</span>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: rs.color }}>
              {txn.riskScore.toFixed(2)} — {rs.label} Risk
            </span>
          </div>
        </div>

        {/* Recovery Case */}
        {txn.recoveryCase ? (
          <div style={{ padding: "16px", background: "rgba(16,185,129,0.06)",
            border: "1px solid rgba(16,185,129,0.2)", borderRadius: "8px" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.07em",
              textTransform: "uppercase", color: "#10b981", marginBottom: "10px" }}>
              Linked Recovery Case
            </div>
            {[
              ["Case ID",           txn.recoveryCase.caseRef],
              ["Status",            txn.recoveryCase.status.replace("_", " ")],
              ["Amount Recovered",  `$${fmt(txn.recoveryCase.recoveredAmount)}`],
            ].map(([k, v]) => {
              const cs = k === "Status" ? caseStatusStyle(txn.recoveryCase!.status) : null;
              return (
                <div key={k} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", paddingBottom: "8px" }}>
                  <span style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>{k}</span>
                  {cs ? (
                    <Chip label={v} color={cs.color} bg={cs.bg} border={cs.border} />
                  ) : (
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>{v}</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : canCreateCase ? (
          <div style={{ padding: "14px 16px", background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.2)", borderRadius: "8px",
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#f59e0b" }}>
                No Recovery Case
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "2px" }}>
                This transaction needs a recovery case
              </div>
            </div>
            <button onClick={() => onCreateCase(txn)}
              style={{ padding: "7px 14px", borderRadius: "6px",
                border: "1px solid rgba(16,185,129,0.4)", background: "rgba(16,185,129,0.15)",
                color: "#10b981", fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer",
                whiteSpace: "nowrap" }}>
              + Create Case
            </button>
          </div>
        ) : null}

        {/* Timeline */}
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.06em",
            textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "12px" }}>
            Transaction Timeline
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {timelineEvents.map((ev, i) => (
              <div key={i} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%",
                    background: ev.color, boxShadow: `0 0 6px ${ev.color}60`, flexShrink: 0,
                    marginTop: "3px" }} />
                  {i < timelineEvents.length - 1 && (
                    <div style={{ width: "2px", height: "28px", background: "var(--surface-border)",
                      marginTop: "4px" }} />
                  )}
                </div>
                <div style={{ paddingBottom: i < timelineEvents.length - 1 ? "0" : "0" }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    {ev.label}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "2px" }}>
                    {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric",
                      year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(ev.date))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function TransactionsSection({ transactions: initial, kpis }: TransactionsSectionProps) {
  const router = useRouter();
  const [transactions, setTransactions] = useState<SerializedTransaction[]>(initial);
  const [showAddModal, setShowAddModal] = useState(false);
  const [createCaseFor, setCreateCaseFor] = useState<SerializedTransaction | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<SerializedTransaction | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 5000);
  };

  const localKpis = useMemo(() => ({
    total: transactions.length,
    successful: transactions.filter((t) => t.status === "SUCCEEDED").length,
    failed: transactions.filter((t) => t.status === "FAILED").length,
    pending: transactions.filter((t) => t.status === "PENDING").length,
    totalValue: transactions.reduce((s, t) => s + t.amount, 0),
    revenueAtRisk: transactions.filter((t) => t.status === "FAILED" || t.status === "PENDING")
      .reduce((s, t) => s + t.amount, 0),
    unlinkedRecoverable: transactions.filter(
      (t) => !t.recoveryCase && (t.status === "FAILED" || t.status === "PENDING")
    ).length,
  }), [transactions]);

  const filtered = useMemo(() => transactions.filter((t) => {
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
    if (typeFilter !== "ALL" && t.transactionType !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.customerName.toLowerCase().includes(q) &&
          !t.customerEmail.toLowerCase().includes(q) &&
          !t.txnRef.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [transactions, statusFilter, typeFilter, searchQuery]);

  const handleTxnCreated = useCallback((txn: SerializedTransaction, message?: string) => {
    setTransactions((prev) => [txn, ...prev]);
    showSuccess(message ?? `Transaction ${txn.txnRef} created successfully.`);
    // Refresh server components (Recovery Cases, Overview) so they pick up the new data
    router.refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleCaseCreated = useCallback(
    (txnId: string, caseData: NonNullable<SerializedTransaction["recoveryCase"]>, message?: string) => {
      setTransactions((prev) =>
        prev.map((t) => t.id === txnId ? { ...t, recoveryCase: caseData } : t)
      );
      if (selectedTxn?.id === txnId) {
        setSelectedTxn((prev) => prev ? { ...prev, recoveryCase: caseData } : null);
      }
      showSuccess(message ?? `Recovery case ${caseData.caseRef} created successfully.`);
      router.refresh();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedTxn, router]
  );

  const inputStyle = {
    padding: "7px 12px", background: "var(--surface-overlay)",
    border: "1px solid var(--surface-border)", borderRadius: "6px",
    color: "var(--text-primary)", fontSize: "0.8125rem", outline: "none",
  };

  return (
    <>
      {/* Success toast */}
      {successToast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 2000,
          display: "flex", alignItems: "center", gap: "12px",
          padding: "14px 18px",
          background: "#0f2e1c",
          border: "1px solid rgba(16,185,129,0.5)",
          borderRadius: "10px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          maxWidth: "420px",
          animation: "fadeIn 0.2s ease",
        }}>
          <span style={{ fontSize: "1rem" }}>✅</span>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#10b981", flex: 1 }}>
            {successToast}
          </span>
          <button onClick={() => setSuccessToast(null)}
            style={{ background: "none", border: "none", cursor: "pointer",
              color: "#10b981", opacity: 0.7, fontSize: "1rem", lineHeight: 1, padding: "0 2px" }}>
            ×
          </button>
        </div>
      )}
      {/* Modals */}
      {showAddModal && (
        <AddTransactionModal onClose={() => setShowAddModal(false)} onCreated={handleTxnCreated} />
      )}
      {createCaseFor && (
        <CreateCaseModal txn={createCaseFor}
          onClose={() => setCreateCaseFor(null)} onCreated={handleCaseCreated} />
      )}
      {selectedTxn && (
        <TransactionDetailPanel txn={selectedTxn}
          onClose={() => setSelectedTxn(null)}
          onCreateCase={(t) => { setSelectedTxn(null); setCreateCaseFor(t); }} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* ── Page Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em",
              color: "var(--text-primary)", margin: 0 }}>Transactions</h1>
            <p style={{ fontSize: "0.875rem", color: "var(--text-tertiary)", marginTop: "4px", margin: "4px 0 0" }}>
              Monitor and manage merchant payment transactions
            </p>
          </div>
          <button onClick={() => setShowAddModal(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "10px 20px", borderRadius: "8px",
              border: "1px solid rgba(16,185,129,0.5)", background: "rgba(16,185,129,0.15)",
              color: "#10b981", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer",
              boxShadow: "0 0 16px rgba(16,185,129,0.1)", transition: "all 0.15s" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Transaction
          </button>
        </div>

        {/* ── KPI Row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "14px" }}>
          <KpiCard label="Total" value={localKpis.total} sub="All transactions"
            accent="#3b82f6"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>} />
          <KpiCard label="Successful" value={localKpis.successful} sub="Completed"
            accent="#10b981"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>} />
          <KpiCard label="Failed" value={localKpis.failed} sub="Need recovery"
            accent="#ef4444"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>} />
          <KpiCard label="Pending" value={localKpis.pending} sub="Awaiting result"
            accent="#f59e0b"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
          <KpiCard label="Total Value"
            value={<span style={{ fontSize: "1.375rem" }}>${(localKpis.totalValue / 1000).toFixed(1)}k</span>}
            sub={`$${fmt(localKpis.totalValue)}`}
            accent="#a855f7"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} />
          <KpiCard label="Revenue at Risk"
            value={<span style={{ color: "#ef4444", fontSize: "1.375rem" }}>${(localKpis.revenueAtRisk / 1000).toFixed(1)}k</span>}
            sub={`${localKpis.unlinkedRecoverable} without case`}
            accent="#ef4444"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />
        </div>

        {/* ── Table Card ── */}
        <div style={{ background: "var(--surface-raised)", border: "1px solid var(--surface-border)",
          borderRadius: "10px", overflow: "hidden" }}>

          {/* Toolbar */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--surface-border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div className="section-title">Transaction Ledger</div>
              <div style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", marginTop: "2px" }}>
                {filtered.length} of {transactions.length} transactions
              </div>
            </div>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)"
                strokeWidth="2" strokeLinecap="round"
                style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" placeholder="Search ID, customer, email…" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ ...inputStyle, paddingLeft: "32px", width: "220px" }} />
            </div>
          </div>

          {/* Filters */}
          <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--surface-border)",
            display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {/* Status pills */}
            {["ALL", "SUCCEEDED", "FAILED", "PENDING", "REFUNDED"].map((s) => {
              const active = statusFilter === s;
              const st = s !== "ALL" ? txnStatusStyle(s) : null;
              return (
                <button key={s} onClick={() => setStatusFilter(s)}
                  style={{ padding: "4px 12px", borderRadius: "5px", cursor: "pointer",
                    border: active ? `1px solid ${st ? st.border : "rgba(16,185,129,0.4)"}` : "1px solid var(--surface-border)",
                    background: active ? (st ? st.bg : "rgba(16,185,129,0.1)") : "transparent",
                    color: active ? (st ? st.color : "var(--brand)") : "var(--text-tertiary)",
                    fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.04em",
                    transition: "all 0.15s" }}>
                  {s === "ALL" ? "All Status" : s}
                </button>
              );
            })}
            <div style={{ width: "1px", height: "20px", background: "var(--surface-border)", margin: "0 4px" }} />
            {/* Type filter */}
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              style={{ ...inputStyle, fontSize: "0.6875rem", padding: "4px 10px" }}>
              <option value="ALL">All Types</option>
              <option value="FAILED_PAYMENT">Failed Payment</option>
              <option value="CHECKOUT_ABANDONMENT">Checkout Abandonment</option>
              <option value="FAILED_SUBSCRIPTION">Failed Subscription</option>
              <option value="OVERDUE_INVOICE">Overdue Invoice</option>
            </select>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: "20px" }}>Transaction ID</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Risk</th>
                  <th>Recovery Case</th>
                  <th style={{ textAlign: "right", paddingRight: "20px" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "40px", color: "var(--text-tertiary)" }}>
                      No transactions match the selected filters.
                    </td>
                  </tr>
                ) : filtered.map((t) => {
                  const ss = txnStatusStyle(t.status);
                  const rs = riskStyle(t.riskScore);
                  const isSelected = selectedTxn?.id === t.id;
                  const canCase = (t.status === "FAILED" || t.status === "PENDING") && !t.recoveryCase;
                  const dateStr = new Intl.DateTimeFormat("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  }).format(new Date(t.transactionDate));

                  return (
                    <tr key={t.id} onClick={() => setSelectedTxn(isSelected ? null : t)}
                      style={{ cursor: "pointer",
                        background: isSelected ? "rgba(59,130,246,0.06)" : undefined,
                        borderLeft: isSelected ? "3px solid #3b82f6" : "3px solid transparent",
                        transition: "background 0.15s" }}>

                      {/* Txn ID */}
                      <td style={{ paddingLeft: isSelected ? "17px" : "20px" }}>
                        <span style={{ fontFamily: "var(--font-geist-mono, monospace)",
                          fontSize: "0.8125rem", fontWeight: 700, color: "#60a5fa" }}>
                          {t.txnRef}
                        </span>
                      </td>

                      {/* Customer */}
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.875rem" }}>
                          {t.customerName}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                          {t.customerEmail}
                        </div>
                      </td>

                      {/* Amount */}
                      <td>
                        <div style={{ fontWeight: 700, color: t.status === "FAILED" ? "#ef4444" : "var(--text-primary)" }}>
                          ${fmt(t.amount)}
                        </div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", letterSpacing: "0.04em" }}>
                          {t.currency}
                        </div>
                      </td>

                      {/* Type */}
                      <td>
                        <span style={{ padding: "3px 8px", borderRadius: "4px",
                          background: "var(--surface-overlay)", border: "1px solid var(--surface-border)",
                          color: "var(--text-secondary)", fontSize: "0.6875rem", fontWeight: 500 }}>
                          {typeLabel(t.transactionType)}
                        </span>
                      </td>

                      {/* Method */}
                      <td style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                        {t.paymentMethod.replace(/_/g, " ")}
                      </td>

                      {/* Status */}
                      <td><Chip label={t.status} color={ss.color} bg={ss.bg} border={ss.border} /></td>

                      {/* Risk */}
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px",
                          fontSize: "0.75rem", fontWeight: 600, color: rs.color }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%",
                            background: rs.color, boxShadow: `0 0 4px ${rs.color}80` }} />
                          {t.riskScore.toFixed(2)} · {rs.label}
                        </span>
                      </td>

                      {/* Recovery Case */}
                      <td>
                        {t.recoveryCase ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            <span style={{ fontFamily: "var(--font-geist-mono, monospace)",
                              fontSize: "0.75rem", fontWeight: 700, color: "#10b981" }}>
                              {t.recoveryCase.caseRef}
                            </span>
                            {(() => { const cs = caseStatusStyle(t.recoveryCase.status);
                              return <Chip label={t.recoveryCase.status.replace("_"," ")} color={cs.color} bg={cs.bg} border={cs.border} />;
                            })()}
                          </div>
                        ) : canCase ? (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", fontStyle: "italic" }}>
                            — none
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td style={{ textAlign: "right", paddingRight: "20px", whiteSpace: "nowrap",
                        color: "var(--text-tertiary)", fontSize: "0.75rem" }}>
                        {dateStr}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
