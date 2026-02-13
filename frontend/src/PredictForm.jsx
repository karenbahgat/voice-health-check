import { useState } from "react";
import { diagnoseAAA, predictVoice } from "./api";

export default function PredictForm() {
  const [name, setName] = useState("test");
  const [age, setAge] = useState(22);
  const [phone, setPhone] = useState("01000000000");
  const [file, setFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async (mode) => {
    setError(null);
    setResult(null);

    if (!file) {
      setError("اختاري ملف صوت الأول");
      return;
    }

    setLoading(true);
    try {
      const data =
        mode === "diagnosis"
          ? await diagnoseAAA({ name, age, phone, file })
          : await predictVoice({ name, age, phone, file });

      setResult(data);
    } catch (err) {
      setError(err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>Voice Health</h2>

      <div style={{ marginBottom: 14, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <b>Diagnosis (AI)</b>
        <div style={{ marginTop: 6, fontSize: 13, color: "#444" }}>
          يعتمد على تسجيل آآآ فقط — ويعرض احتمالية باركنسون + نسبة الثقة.
          <br />
          <b>تنبيه:</b> هذا التقييم مساعد وليس بديلاً عن استشارة الطبيب.
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run("diagnosis");
        }}
      >
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />

        <label>Age</label>
        <input
          type="number"
          value={age}
          onChange={(e) => setAge(Number(e.target.value))}
        />

        <label>Phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} />

        <label>Audio File (آآآ)</label>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button type="submit" disabled={loading}>
            {loading ? "Running..." : "Run Diagnosis (آآآ)"}
          </button>

          {/* اختياري: نخلي القديم للاختبار */}
          <button
            type="button"
            disabled={loading}
            onClick={() => run("legacy")}
          >
            {loading ? "Running..." : "Legacy /predict"}
          </button>
        </div>
      </form>

      {error && (
        <pre style={{ color: "red", marginTop: 16 }}>
          {JSON.stringify(error, null, 2)}
        </pre>
      )}

      {/* عرض لطيف لنتيجة التشخيص */}
      {result?.type === "diagnosis" && (
        <div style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{result.result}</div>
          <div style={{ marginTop: 6 }}>
            <b>Confidence:</b> {result.confidence_percent}%
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: "#444" }}>
            {result.warning}
          </div>

          {/* لو عايزة تشوفي التفاصيل أثناء التطوير */}
          <details style={{ marginTop: 12 }}>
            <summary>Debug details</summary>
            <pre style={{ marginTop: 10 }}>{JSON.stringify(result.details, null, 2)}</pre>
          </details>
        </div>
      )}

      {/* لو رجعت نتيجة legacy */}
      {result && result.type !== "diagnosis" && (
        <pre style={{ marginTop: 20 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
