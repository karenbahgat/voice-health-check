import React, { useMemo, useState } from "react";
import { predictVoice } from "./api";

function pct(x) {
  if (typeof x !== "number" || Number.isNaN(x)) return "-";
  return `${(x * 100).toFixed(2)}%`;
}

export default function PredictForm() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [file, setFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const sortedProbs = useMemo(() => {
    if (!result?.probs) return [];
    return Object.entries(result.probs).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  }, [result]);

  const statusBadge = useMemo(() => {
    const pred = (result?.prediction || "").toLowerCase();
    if (!pred) return null;
    if (pred === "healthy") return { text: "Healthy", tone: "good" };
    if (pred === "parkinson") return { text: "Parkinson (screening)", tone: "warn" };
    if (pred === "als") return { text: "ALS (screening)", tone: "warn" };
    return { text: result.prediction, tone: "warn" };
  }, [result]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!name.trim() || !age || !phone.trim()) {
      setError("Please fill in name, age, and phone.");
      return;
    }
    if (!file) {
      setError('Please upload an audio file (sustained "ah").');
      return;
    }

    setLoading(true);
    try {
      const data = await predictVoice({
        name: name.trim(),
        age: Number(age),
        phone: phone.trim(),
        file,
      });
      setResult(data);
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        (typeof err?.response?.data === "string" ? err.response.data : null) ||
        err?.message ||
        "Request failed";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.h1}>Voice Health</h1>
            <p style={styles.sub}>
              Upload a sustained <b>"ah"</b> only (no words).
            </p>
          </div>
          <div style={styles.pill}>3-class detection</div>
        </div>

        <form onSubmit={onSubmit} style={styles.form}>
          <div style={styles.grid}>
            <div style={styles.field}>
              <label style={styles.label}>Name</label>
              <input
                style={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Karen"
                required
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Age</label>
              <input
                style={styles.input}
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g., 56"
                min="1"
                max="120"
                required
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Phone</label>
            <input
              style={styles.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., 0100000000"
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Audio file</label>
            <div style={styles.fileWrap}>
              <input
                style={styles.file}
                type="file"
                accept="audio/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
              <div style={styles.fileHint}>
                {file ? file.name : "Any audio format (wav/mp3/m4a/webm...)"}{" "}
              </div>
            </div>
          </div>

          <button style={{ ...styles.button, opacity: loading ? 0.75 : 1 }} disabled={loading}>
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </form>

        {error && <div style={styles.alertError}>{error}</div>}

        {result && (
          <div style={styles.resultCard}>
            <div style={styles.resultHeader}>
              <h2 style={styles.h2}>Result</h2>
              {statusBadge && (
                <span
                  style={{
                    ...styles.badge,
                    ...(statusBadge.tone === "good" ? styles.badgeGood : styles.badgeWarn),
                  }}
                >
                  {statusBadge.text}
                </span>
              )}
            </div>

            <div style={styles.kpis}>
              <div style={styles.kpi}>
                <div style={styles.kpiLabel}>Top prediction</div>
                <div style={styles.kpiValue}>{result.prediction || "-"}</div>
              </div>
              <div style={styles.kpi}>
                <div style={styles.kpiLabel}>Confidence</div>
                <div style={styles.kpiValue}>{pct(result.confidence)}</div>
              </div>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionTitle}>Probabilities</div>
              <div style={styles.probList}>
                {sortedProbs.map(([k, v]) => (
                  <div key={k} style={styles.probRow}>
                    <div style={styles.probName}>{k}</div>
                    <div style={styles.probPct}>{pct(v)}</div>
                    <div style={styles.probBarTrack}>
                      <div style={{ ...styles.probBarFill, width: `${Math.max(0, Math.min(1, v)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.disclaimer}>
              This is an AI screening result, not a final medical diagnosis. Please consult a specialist for confirmation.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
    background: "#f5f6fa",
    fontFamily: "Inter, Arial, sans-serif",
    color: "#0f172a",
  },
  card: {
    width: 560,
    maxWidth: "100%",
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.10)",
    border: "1px solid rgba(15, 23, 42, 0.06)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  h1: { margin: 0, fontSize: 26, letterSpacing: -0.3 },
  sub: { margin: "6px 0 0", fontSize: 14, color: "#475569", lineHeight: 1.4 },
  pill: {
    fontSize: 12,
    color: "#334155",
    background: "#eef2ff",
    border: "1px solid #dbeafe",
    padding: "8px 10px",
    borderRadius: 999,
    whiteSpace: "nowrap",
  },

  form: { marginTop: 8 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 },
  label: { fontSize: 13, color: "#334155", fontWeight: 600 },
  input: {
    height: 42,
    borderRadius: 12,
    border: "1px solid rgba(15, 23, 42, 0.16)",
    padding: "0 12px",
    outline: "none",
    fontSize: 14,
  },

  fileWrap: {
    border: "1px dashed rgba(15, 23, 42, 0.22)",
    borderRadius: 12,
    padding: 12,
    background: "#fafafa",
  },
  file: { width: "100%" },
  fileHint: { marginTop: 8, fontSize: 12, color: "#64748b" },

  button: {
    width: "100%",
    height: 46,
    borderRadius: 14,
    border: "none",
    background: "#111827",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 15,
    marginTop: 6,
  },

  alertError: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    fontWeight: 700,
    fontSize: 13,
  },

  resultCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    background: "#f9fafb",
    border: "1px solid rgba(15, 23, 42, 0.08)",
  },
  resultHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  h2: { margin: 0, fontSize: 18 },

  badge: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(15, 23, 42, 0.12)",
  },
  badgeGood: { background: "#ecfdf5", color: "#065f46", borderColor: "#a7f3d0" },
  badgeWarn: { background: "#fff7ed", color: "#9a3412", borderColor: "#fed7aa" },

  kpis: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 },
  kpi: {
    background: "#fff",
    border: "1px solid rgba(15, 23, 42, 0.08)",
    borderRadius: 14,
    padding: 12,
  },
  kpiLabel: { fontSize: 12, color: "#64748b", fontWeight: 700 },
  kpiValue: { marginTop: 6, fontSize: 18, fontWeight: 900, color: "#0f172a" },

  section: { marginTop: 12 },
  sectionTitle: { fontSize: 13, fontWeight: 800, color: "#334155", marginBottom: 10 },

  probList: { display: "flex", flexDirection: "column", gap: 10 },
  probRow: { display: "grid", gridTemplateColumns: "110px 80px 1fr", gap: 10, alignItems: "center" },
  probName: { fontSize: 13, fontWeight: 800, color: "#0f172a" },
  probPct: { fontSize: 13, color: "#334155", fontWeight: 700, textAlign: "right" },
  probBarTrack: {
    height: 10,
    borderRadius: 999,
    background: "rgba(15, 23, 42, 0.08)",
    overflow: "hidden",
  },
  probBarFill: { height: "100%", borderRadius: 999, background: "#111827" },

  disclaimer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    background: "#fff7e6",
    border: "1px solid #ffe0a3",
    color: "#6b4e00",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 700,
  },
};
