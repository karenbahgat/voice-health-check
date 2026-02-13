import React, { useState } from "react";
import { submitRehabAttempt } from "./api";

export default function RehabForm({ patientId }) {
  const [task, setTask] = useState("sustained_vowel");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState([]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    const data = await submitRehabAttempt({
      patient_id: patientId,
      task_id: task,
      file,
    });

    setAttempts((prev) => [data, ...prev]);
    setFile(null);
    setLoading(false);
  }

  function statusColor(status) {
    if (status === "improved") return "#16a34a";
    if (status === "needs_training") return "#dc2626";
    return "#f59e0b";
  }

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Rehabilitation</h2>

      <form onSubmit={handleSubmit} style={styles.form}>
        <select value={task} onChange={(e) => setTask(e.target.value)} style={styles.select}>
          <option value="sustained_vowel">Sustained "ah"</option>
          <option value="pataka">Pa-Ta-Ka</option>
        </select>

        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={styles.input}
        />

        <button style={styles.button} disabled={loading}>
          {loading ? "Submitting..." : "Submit Attempt"}
        </button>
      </form>

      {attempts.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>History</h3>

          {attempts.map((a, i) => (
            <div key={i} style={styles.attemptCard}>
              <div><b>Score:</b> {a.score}</div>
              <div>
                <b>Improvement:</b> {a.improvement_percent}%
                {a.improvement_percent >= 5 && " 🎉"}
              </div>
              <div style={{ color: statusColor(a.status), fontWeight: 700 }}>
                {a.status}
              </div>
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
    marginBottom: 10,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  select: {
    height: 40,
    borderRadius: 10,
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
  },
  attemptCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
  },
};
