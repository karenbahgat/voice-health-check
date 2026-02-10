  // trigger deploy

import React, { useMemo, useState } from "react";

const API_URL = "http://localhost:8000/predict";

// Message if Healthy
const HEALTHY_MESSAGE =
  "Great news — your voice analysis looks healthy. Keep taking care of yourself, and have a wonderful day!";

function pct(x) {
  if (typeof x !== "number" || Number.isNaN(x)) return "-";
  return `${(x * 100).toFixed(2)}%`;
}

export default function PatientPredict() {
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

  const isHealthy = result?.prediction?.toLowerCase() === "healthy";

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!name.trim() || !age || !phone.trim()) {
      setError("من فضلك املي الاسم والسن ورقم التليفون.");
      return;
    }

    if (!file) {
      setError("من فضلك ارفعي ملف WAV.");
      return;
    }

    const lower = (file.name || "").toLowerCase();
    if (!lower.endsWith(".wav")) {
      setError("مسموح رفع ملفات WAV فقط.");
      return;
    }

    const fd = new FormData();
    fd.append("name", name.trim());
    fd.append("age", String(age));
    fd.append("phone", phone.trim());
    fd.append("file", file);

    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        body: fd,
      });

      // لو السيرفر رجّع HTML أو حاجة مش JSON، ده هيمسك الخطأ
      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { detail: text };
      }

      if (!res.ok) {
        throw new Error(data?.detail || "Request failed");
      }

      setResult(data);
    } catch (err) {
      setError(err?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>Voice Health Check</h2>

        <div style={styles.instructions}>
          <b>Instructions:</b>
          <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18 }}>
            <li>
              Upload a <b>WAV</b> audio file
            </li>
            <li>
              Say only <b>&quot;ah&quot;</b> (sustained) — <b>no words</b>
            </li>
            <li>Record in a quiet environment</li>
          </ul>
        </div>

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
            min="1"
            max="120"
            required
          />

          <input
            style={styles.input}
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />

          <input
            style={styles.file}
            type="file"
            accept=".wav,audio/wav"
            required
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          <button style={styles.button} disabled={loading}>
            {loading ? "Analyzing..." : "Predict"}
          </button>
        </form>

        {error && <p style={styles.error}>{error}</p>}

        {result && (
          <div style={styles.result}>
            <h3 style={{ marginTop: 0 }}>Result</h3>

            <p style={{ margin: "6px 0" }}>
              <b>Status:</b>{" "}
              {isHealthy ? "Healthy ✅" : `Patient ⚠️ (${result.prediction})`}
            </p>

            <p style={{ margin: "6px 0" }}>
              <b>Confidence:</b> {pct(result.confidence)}
            </p>

            <h4 style={{ margin: "12px 0 6px" }}>Probabilities</h4>
            <ul style={{ marginTop: 0 }}>
              {sortedProbs.map(([k, v]) => (
                <li key={k}>
                  {k}: {pct(v)}
                </li>
              ))}
            </ul>

            {isHealthy ? (
              <p style={styles.healthy}>{HEALTHY_MESSAGE}</p>
            ) : (
              <p style={styles.note}>
                Note: This is an AI screening result, not a final medical
                diagnosis. Please consult a specialist for confirmation.
              </p>
            )}
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
    background: "#f5f6fa",
    fontFamily: "Arial, sans-serif",
    padding: 16,
  },
  card: {
    background: "white",
    padding: 20,
    borderRadius: 12,
    width: 420,
    maxWidth: "100%",
    boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
  },
  title: { textAlign: "center", marginTop: 0 },
  instructions: {
    fontSize: 14,
    background: "#eef2ff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    lineHeight: 1.5,
  },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  input: {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ccc",
    outline: "none",
  },
  file: {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ccc",
    background: "#fff",
  },
  button: {
    padding: 12,
    borderRadius: 10,
    border: "none",
    background: "#111827",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
  },
  error: { color: "#b00020", marginTop: 10, fontWeight: 700 },
  result: {
    marginTop: 14,
    background: "#f9fafb",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #eee",
  },
  healthy: {
    color: "#0b5d2a",
    marginTop: 10,
    fontWeight: "bold",
    background: "#e9fff0",
    border: "1px solid #b7f2c8",
    padding: 10,
    borderRadius: 10,
  },
  note: {
    marginTop: 10,
    background: "#fff7e6",
    border: "1px solid #ffe0a3",
    padding: 10,
    borderRadius: 10,
    color: "#6b4e00",
  },
};
