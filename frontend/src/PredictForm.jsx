import React, { useMemo, useState } from "react";
import { predictVoice } from "./api";
import RehabForm from "./RehabForm";

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
  const [patientId, setPatientId] = useState(null);
  const [error, setError] = useState("");

  const sortedProbs = useMemo(() => {
    if (!result?.probs) return [];
    return Object.entries(result.probs).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  }, [result]);

  const showRehab = useMemo(() => {
    const label = String(result?.predicted_label || "").toLowerCase();
    return ["als", "parkinson"].includes(label);
  }, [result]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!name.trim() || !age || !phone.trim()) {
      setError("Please fill in name, age and phone.");
      return;
    }

    if (!file) {
      setError("Please upload an audio file.");
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
      setPatientId(data.patient_id);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Request failed";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Voice Health Screening</h1>

        <form onSubmit={onSubmit} style={styles.form}>
          <input
            style={styles.input}
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <input
            style={styles.input}
            type="number"
            placeholder="Age"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            required
          />

          <input
            style={styles.input}
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />

          <input
            style={styles.input}
            type="file"
            accept="audio/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
          />

          <button style={styles.button} disabled={loading}>
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </form>

        {error && <div style={styles.error}>{error}</div>}

        {result && (
          <div style={styles.resultCard}>
            <h2>Result</h2>

            <p>
              <strong>Prediction:</strong> {result.predicted_label || "-"}
            </p>

            <p>
              <strong>Confidence:</strong>{" "}
              {typeof result.confidence_percent === "number"
                ? `${result.confidence_percent.toFixed(1)}%`
                : "-"}
            </p>

            <h3>Probabilities</h3>
            {sortedProbs.map(([k, v]) => (
              <div key={k}>
                {k}: {pct(v)}
              </div>
            ))}

            <p style={styles.disclaimer}>
              This assessment is supportive and not a medical diagnosis.
            </p>

            {!showRehab && (
              <p style={styles.healthyNote}>
                No rehabilitation is needed based on this screening result.
              </p>
            )}
          </div>
        )}

        {patientId && showRehab && <RehabForm patientId={patientId} />}
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
    background: "#f3f4f6",
    padding: 20,
  },
  card: {
    width: 600,
    maxWidth: "100%",
    background: "#ffffff",
    padding: 30,
    borderRadius: 20,
    boxShadow: "0 15px 40px rgba(0,0,0,0.08)",
  },
  title: {
    marginBottom: 20,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  input: {
    padding: 10,
    borderRadius: 10,
    border: "1px solid #ddd",
  },
  button: {
    padding: 12,
    borderRadius: 12,
    border: "none",
    background: "#111827",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  error: {
    marginTop: 15,
    color: "red",
    fontWeight: 600,
  },
  resultCard: {
    marginTop: 25,
    padding: 20,
    borderRadius: 15,
    background: "#f9fafb",
  },
  disclaimer: {
    marginTop: 15,
    fontSize: 13,
    color: "#555",
  },
  healthyNote: {
    marginTop: 10,
    fontSize: 13,
    color: "#0f172a",
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    padding: 10,
    borderRadius: 12,
    fontWeight: 700,
  },
};
