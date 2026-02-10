import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

export async function predictVoice({ name, age, phone, file }) {
  const fd = new FormData();
  fd.append("name", name);
  fd.append("age", String(age)); // لازم string
  fd.append("phone", phone);
  fd.append("file", file);

  const res = await axios.post(`${API_BASE}/predict`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}
