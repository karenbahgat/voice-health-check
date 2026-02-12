import json
import uuid
import sqlite3
from datetime import datetime
from pathlib import Path

import numpy as np
import joblib
import librosa
from scipy.signal import butter, filtfilt

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
# -----------------------
# Paths (HF/Docker safe)
# -----------------------
APP_DIR = Path(__file__).resolve().parent  # root of the Space (where app.py is)

# Storage (will be created inside the container)
STORAGE_DIR = APP_DIR / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"
REFS_DIR = STORAGE_DIR / "references"
DB_PATH = STORAGE_DIR / "app.db"

STORAGE_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
REFS_DIR.mkdir(parents=True, exist_ok=True)

# -----------------------
# Model artifacts (HF Space layout)
# -----------------------
ART_DIR = APP_DIR / "model_artifacts"

PIPELINE_PATH = ART_DIR / "pipeline.joblib"
TOP_FEATURES_PATH = ART_DIR / "top_features.json"
CLASSES_PATH = ART_DIR / "classes.json"

if not PIPELINE_PATH.exists():
    raise RuntimeError(f"Missing model pipeline: {PIPELINE_PATH}")
if not TOP_FEATURES_PATH.exists():
    raise RuntimeError(f"Missing top features: {TOP_FEATURES_PATH}")
if not CLASSES_PATH.exists():
    raise RuntimeError(f"Missing classes: {CLASSES_PATH}")

pipe = joblib.load(PIPELINE_PATH)
top_features = json.load(open(TOP_FEATURES_PATH, "r", encoding="utf-8"))["top_features"]
classes = json.load(open(CLASSES_PATH, "r", encoding="utf-8"))["classes"]

# -----------------------
# App
# -----------------------
app = FastAPI(
    title="Voice Detector API",
    version="0.1.0",
    description="Dataset used: https://www.kaggle.com/datasets/karenbahgatzakaria/als-and-parkinson-1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # demo only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def now_iso():
    return datetime.now().isoformat(timespec="seconds")


# -----------------------
# DB
# -----------------------
def init_db():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      phone TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS predictions (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      audio_filename TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      prediction TEXT NOT NULL,
      confidence REAL NOT NULL,
      probs_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS reference_files (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      uploaded_at TEXT NOT NULL
    )
    """)

    con.commit()
    con.close()


init_db()


# -----------------------
# WAV upload only
# -----------------------
def save_wav_only(upload_file: UploadFile, folder: Path):
    filename = (upload_file.filename or "").lower()

    if not filename.endswith(".wav"):
        raise HTTPException(
            status_code=400,
            detail="مسموح رفع ملفات WAV فقط."
        )

    file_id = str(uuid.uuid4())
    stored_name = f"{file_id}.wav"
    stored_path = folder / stored_name

    with stored_path.open("wb") as f:
        f.write(upload_file.file.read())

    return stored_name, str(stored_path), upload_file.filename


# =========================================================
# PREPROCESSING + FEATURES (MATCHES YOUR NOTEBOOK)
# =========================================================
TARGET_SR = 16000
FIXED_DUR = 1.30

TRIM_TOP_DB = 30
STEADY_MARGIN_SEC = 0.15
VAD_TOP_DB = 25

DO_BANDPASS = True
DO_NOTCH = False
DO_DENOISE = False  # not used here (same as notebook default)

N_MELS = 80
N_FFT = 512
HOP_LENGTH = 128
FMIN = 50
FMAX = TARGET_SR // 2


def bandpass_filter(y, sr, low=50, high=None, order=4):
    if high is None:
        high = sr // 2 - 200
    nyq = 0.5 * sr
    lowc = max(low / nyq, 1e-6)
    highc = min(high / nyq, 0.999)
    b, a = butter(order, [lowc, highc], btype="band")
    return filtfilt(b, a, y).astype(np.float32)


def pick_steady_voiced_segment(y, sr, fixed_dur, margin_sec=0.15, top_db=25):
    win_len = int(sr * fixed_dur)
    margin = int(sr * margin_sec)

    if len(y) <= win_len:
        return y

    intervals = librosa.effects.split(y, top_db=top_db)
    if len(intervals) == 0:
        return None

    lengths = intervals[:, 1] - intervals[:, 0]
    s, e = intervals[np.argmax(lengths)]
    if (e - s) < win_len:
        return None

    start_min = s + margin
    start_max = e - win_len - margin
    if start_max < start_min:
        start = int((s + e - win_len) / 2)
    else:
        start = int((start_min + start_max) / 2)

    start = np.clip(start, 0, len(y) - win_len)
    return y[start:start + win_len]


def crop_loudest_window(y, sr, dur, frame_length=512, hop_length=128):
    win_len = int(sr * dur)
    if len(y) <= win_len:
        return y

    rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
    frames_per_win = max(1, int(np.ceil(win_len / hop_length)))

    if len(rms) <= frames_per_win:
        start = 0
    else:
        c = np.convolve(rms, np.ones(frames_per_win), mode="valid")
        start = int(np.argmax(c)) * hop_length

    start = min(start, len(y) - win_len)
    return y[start:start + win_len]


def rms_normalize(y, target_rms=0.1):
    rms = np.sqrt(np.mean(y ** 2) + 1e-9)
    return (y / (rms + 1e-9)) * target_rms


def logmel(y, sr):
    S = librosa.feature.melspectrogram(
        y=y, sr=sr,
        n_fft=N_FFT, hop_length=HOP_LENGTH,
        n_mels=N_MELS, fmin=FMIN, fmax=FMAX,
        power=2.0
    )
    return librosa.power_to_db(S, ref=np.max).astype(np.float32)


def load_preprocess_unified(
    path,
    target_sr=TARGET_SR,
    fixed_dur=FIXED_DUR,
    trim_top_db=TRIM_TOP_DB,
    do_bandpass=DO_BANDPASS,
    do_notch=DO_NOTCH,
    do_denoise=DO_DENOISE,
    steady_margin_sec=STEADY_MARGIN_SEC,
    vad_top_db=VAD_TOP_DB
):
    y, sr = librosa.load(path, sr=None, mono=True)
    orig_sr = sr
    orig_dur = len(y) / float(sr)

    if sr != target_sr:
        y = librosa.resample(y, orig_sr=sr, target_sr=target_sr)
        sr = target_sr

    # mean centering (same as notebook)
    y = y - np.mean(y)

    # trim silence
    y_trim, _ = librosa.effects.trim(y, top_db=trim_top_db)
    min_len = int(sr * fixed_dur)
    if len(y_trim) >= min_len:
        y = y_trim

    # bandpass
    if do_bandpass:
        y = bandpass_filter(y, sr, low=50, high=sr // 2 - 200)

    # notch/denoise were disabled in your config (kept for exact signature)
    if do_notch:
        pass
    if do_denoise:
        pass

    # steady voiced segment + fallback loudest
    seg = pick_steady_voiced_segment(y, sr, fixed_dur, margin_sec=steady_margin_sec, top_db=vad_top_db)
    if seg is None:
        seg = crop_loudest_window(y, sr, fixed_dur, frame_length=N_FFT, hop_length=HOP_LENGTH)

    # pad/trim to fixed length
    if len(seg) < min_len:
        seg = np.pad(seg, (0, min_len - len(seg)))
    elif len(seg) > min_len:
        seg = seg[:min_len]

    seg = rms_normalize(seg, target_rms=0.1).astype(np.float32)
    return seg, sr, orig_sr, orig_dur


def mel_stats_features(S, prefix="mel"):
    """
    SAME as notebook:
    - per-mel mean/std
    - global stats
    Names:
      mel_m{i}_mean, mel_m{i}_std, mel_global_mean/std/min/max
      mel_d1_m{i}_mean/std ...
      mel_d2_m{i}_mean/std ...
    """
    S = np.asarray(S)

    mu = S.mean(axis=1)
    sd = S.std(axis=1) + 1e-9

    feats = {}
    for i in range(len(mu)):
        feats[f"{prefix}_m{i}_mean"] = float(mu[i])
        feats[f"{prefix}_m{i}_std"] = float(sd[i])

    feats[f"{prefix}_global_mean"] = float(S.mean())
    feats[f"{prefix}_global_std"] = float(S.std() + 1e-9)
    feats[f"{prefix}_global_min"] = float(S.min())
    feats[f"{prefix}_global_max"] = float(S.max())

    return feats


def extract_features_for_model(wav_path: str) -> np.ndarray:
    seg, sr, _, _ = load_preprocess_unified(wav_path)

    S = logmel(seg, sr)  # (n_mels, T)

    feats = mel_stats_features(S, "mel")

    d1 = librosa.feature.delta(S)
    d2 = librosa.feature.delta(S, order=2)

    feats.update(mel_stats_features(d1, "mel_d1"))
    feats.update(mel_stats_features(d2, "mel_d2"))

    # vector in top_features order (missing -> NaN, pipeline has imputer)
    x = [feats.get(f, np.nan) for f in top_features]
    return np.array([x], dtype=float)


def predict_with_model(wav_path: str):
    X = extract_features_for_model(wav_path)

    pred_idx = int(pipe.predict(X)[0])
    pred_label = classes[pred_idx]

    if hasattr(pipe, "predict_proba"):
        p = pipe.predict_proba(X)[0]
        probs = {classes[i]: float(p[i]) for i in range(len(classes))}
        confidence = float(probs[pred_label])
    else:
        probs = {pred_label: 1.0}
        confidence = 1.0

    return pred_label, confidence, probs


# -----------------------
# Endpoints
# -----------------------
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": True,
        "num_top_features": len(top_features),
        "classes": classes
    }


@app.post("/predict")
async def predict(
    name: str = Form(...),
    age: int = Form(...),
    phone: str = Form(...),
    file: UploadFile = File(...)
):
    stored_name, stored_path, original_name = save_wav_only(file, UPLOADS_DIR)

    # --- REAL MODEL ---
    try:
        prediction, confidence, probs = predict_with_model(stored_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference failed: {str(e)}")

    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    patient_id = str(uuid.uuid4())
    cur.execute(
        "INSERT INTO patients (id, name, age, phone, created_at) VALUES (?, ?, ?, ?, ?)",
        (patient_id, name.strip(), int(age), phone.strip(), now_iso())
    )

    cur.execute(
        """INSERT INTO predictions
           (id, patient_id, audio_filename, stored_path, prediction, confidence, probs_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            str(uuid.uuid4()),
            patient_id,
            original_name,
            stored_path,
            prediction,
            float(confidence),
            json.dumps(probs),
            now_iso(),
        )
    )

    con.commit()
    con.close()

    return {
        "prediction": prediction,
        "confidence": float(confidence),
        "probs": probs,
        "saved": True
    }


@app.post("/reference/upload")
async def upload_reference(file: UploadFile = File(...)):
    stored_name, stored_path, original_name = save_wav_only(file, REFS_DIR)

    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    ref_id = str(uuid.uuid4())

    cur.execute(
        "INSERT INTO reference_files (id, filename, stored_path, uploaded_at) VALUES (?, ?, ?, ?)",
        (ref_id, original_name, stored_path, now_iso())
    )
    con.commit()
    con.close()

    return {"id": ref_id, "filename": original_name}


@app.get("/reference/list")
async def list_refs():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    rows = cur.execute(
        "SELECT id, filename, uploaded_at FROM reference_files ORDER BY uploaded_at DESC"
    ).fetchall()
    con.close()

    return [{"id": r[0], "filename": r[1], "uploaded_at": r[2]} for r in rows]


@app.get("/reference/audio/{ref_id}")
async def get_ref_audio(ref_id: str):
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    row = cur.execute(
        "SELECT stored_path, filename FROM reference_files WHERE id=?",
        (ref_id,),
    ).fetchone()
    con.close()

    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    stored_path, filename = row
    return FileResponse(stored_path, media_type="audio/wav", filename=filename)
