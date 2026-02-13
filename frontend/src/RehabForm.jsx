import React, { useState } from "react";
import { submitRehabAttempt } from "./api";

export default function RehabForm({ patientId }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const [error, setError] = useState("");

  const taskId = "sustained_vowel"; // fixed task (A only)

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!patientId) {
      const msg = "Missing patientId. Please run diagnosis first.";
      setError(msg);
      alert(msg);
      return;
    }

    if (!file) {
      const msg = "Please choose an audio file first.";
      setError(msg);
      alert(msg);
      return;
    }

    setLoading(true);

    try {
      console.log("Submitting rehab attempt:", { patientId, taskId, fileName: file?.name });

      const data = await submitRehabAttempt({
        patient_id: patientId,
        task_id: taskId,
        file,
      });

      console.log("Rehab response:", data);

      setAttempts((prev) => [data, ...prev]);
      setFile(null);
    } catch (err) {
      console.error("Rehab error:", err);

      const msg =
        err?.response?.data?.detail ||
        (typeof err?.response?.data === "string" ? err.response.data : null) ||
        err?.message ||
        "Rehab request failed";

      setError(String(msg));
      alert(String(msg));
    } finally {
      setLoading(false);
    }
  }

  function statusColor(status) {
    if (status === "improved") return "#16a34a";
    if (status === "needs_training") return "#dc2626";
    return "#f59e0b";
  }

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Rehabilitation</h2>
      <p style={styles.subtitle}>
        Task: <b>Sustained "ah"</b>
      </p>

      <div style={styles.smallInfo}>
        Patient ID: <span style={{ fontFamily: "monospace" }}>{patientId || "-"}</span>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={styles.input}
        />

        <button style={styles.button} disabled={loading || !file || !patientId}>
          {loading ? "Submitting..." : "Submit Attempt"}
        </button>
      </form>

      {error && <div style={styles.errorBox}>{error}</div>}

      {attempts.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>History</h3>

          {attempts.map((a, i) => (
            <div key={a.attempt_id || i} style={styles.attemptCard}>
              <div>
                <b>Score:</b> {a.score}
              </div>
              <div>
                <b>Improvement:</b> {a.improvement_percent}%
                {a.improvement_percent >= 5 && " 🎉"}
              </div>
              <div style={{ color: statusColor(a.status), fontWeight: 700 }}>
                {a.status}
              </div>

              {a.metrics && (
                <div style={styles.metrics}>
                  <div><b>Duration:</b> {a.metrics.duration ?? "-"}</div>
                  <div><b>Pitch stability:</b> {a.metrics.pitch_stability ?? "-"}</div>
                  <div><b>Loudness stability:</b> {a.metrics.loudness_stability ?? "-"}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    marginTop: 30,
    padding: 20,
    borderRadius: 16,
    background: "#ffffff",
    boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
  },
  title: {
    marginBottom: 6,
  },
  subtitle: {
    marginTop: 0,
    marginBottom: 8,
    color: "#475569",
    fontSize: 13,
  },
  smallInfo: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 12,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  input: {
    height: 40,
  },
  button: {
    height: 45,
    borderRadius: 12,
    border: "none",
    background: "#111827",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    opacity: 1,
  },
  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    fontWeight: 700,
    fontSize: 13,
  },
  attemptCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
  },
  metrics: {
    marginTop: 10,
    fontSize: 12,
    color: "#334155",
    display: "grid",
    gap: 4,
  },
};
