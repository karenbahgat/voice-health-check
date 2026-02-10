import { useState } from "react";
import { predictVoice } from "./api";

export default function PredictForm() {
  const [name, setName] = useState("test");
  const [age, setAge] = useState(22);
  const [phone, setPhone] = useState("01000000000");
  const [file, setFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!file) {
      setError("اختاري ملف صوت الأول");
      return;
    }

    setLoading(true);
    try {
      const data = await predictVoice({ name, age, phone, file });
      setResult(data);
    } catch (err) {
      setError(err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>Voice Detector</h2>

      <form onSubmit={onSubmit}>
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

        <label>Audio File</label>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files[0])}
        />

        <button type="submit" disabled={loading}>
          {loading ? "Running..." : "Predict"}
        </button>
      </form>

      {error && <pre style={{ color: "red" }}>{JSON.stringify(error, null, 2)}</pre>}

      {result && (
        <pre style={{ marginTop: 20 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
