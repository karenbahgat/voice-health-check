import axios from "axios";

const API_URL = "https://karen-bahgat-voice-health-backend.hf.space";

export async function predictVoice({ name, age, phone, file }) {
  const fd = new FormData();
  fd.append("name", name);
  fd.append("age", String(age));
  fd.append("phone", phone);
  fd.append("file", file);

  const res = await axios.post(`${API_URL}/diagnosis/aaa`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}

export async function submitRehabAttempt({ patient_id, task_id, file }) {
  const fd = new FormData();
  fd.append("patient_id", patient_id);
  fd.append("task_id", task_id);
  fd.append("file", file);

  const res = await axios.post(`${API_URL}/rehab/attempts`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}
