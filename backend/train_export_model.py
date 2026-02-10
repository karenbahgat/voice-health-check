from pathlib import Path
import json
import pandas as pd
import numpy as np
import joblib

from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression

# ✅ حطي ملفّاتك هنا (انتي هتنقليهم من Kaggle للكمبيوتر)
BASE = Path(__file__).resolve().parent
DATA_DIR = BASE / "model_data"
FEAT_CSV = DATA_DIR / "features_for_ml.csv"
FINAL_CSV = DATA_DIR / "final_dataset.csv"
TOP_CSV = DATA_DIR / "top250_mi_features.csv"   # ملف فيه عمود اسمه feature

OUT_DIR = BASE / "model_artifacts"
OUT_DIR.mkdir(exist_ok=True)

# load
feat_df = pd.read_csv(FEAT_CSV)
final_df = pd.read_csv(FINAL_CSV)

# find label column
label_candidates = ["label", "target", "class", "diagnosis", "y"]
label_col = next((c for c in label_candidates if c in final_df.columns), None)
if label_col is None:
    raise ValueError("No label column found in final_dataset.csv")

if "group_id" not in final_df.columns:
    raise ValueError("final_dataset.csv must contain group_id")

if "filepath" not in feat_df.columns or "filepath" not in final_df.columns:
    raise ValueError("Both CSVs must contain filepath for merging")

base = final_df[["filepath", label_col, "group_id"]].drop_duplicates()
feat_df = feat_df.drop(columns=[c for c in ["label", "group_id", label_col] if c in feat_df.columns], errors="ignore")
feat_df = feat_df.merge(base, on="filepath", how="left")
feat_df = feat_df.rename(columns={label_col: "label"})
feat_df = feat_df.dropna(subset=["label", "group_id"]).copy()

meta_cols = {
    "filepath","label","dataset_source","quality_level","snr_db","clip_frac","silence_frac","group_id"
}
feature_cols = [c for c in feat_df.columns if c not in meta_cols and pd.api.types.is_numeric_dtype(feat_df[c])]

# load top250 features list
top = pd.read_csv(TOP_CSV)
top_features = top["feature"].astype(str).tolist()

# keep only those features that exist
top_features = [f for f in top_features if f in feature_cols]
if len(top_features) < 10:
    raise ValueError("Top features file doesn't match your feature columns.")

X = feat_df[top_features].to_numpy(dtype=float)
y_raw = feat_df["label"].astype(str).values

le = LabelEncoder()
y = le.fit_transform(y_raw)

pipe = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler()),
    ("clf", LogisticRegression(
        multi_class="multinomial",
        solver="lbfgs",
        max_iter=4000,
        random_state=42
    ))
])

pipe.fit(X, y)

joblib.dump(pipe, OUT_DIR / "pipeline.joblib")
json.dump({"classes": le.classes_.tolist()}, open(OUT_DIR / "classes.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
json.dump({"top_features": top_features}, open(OUT_DIR / "top_features.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print("✅ Saved:")
print(" -", OUT_DIR / "pipeline.joblib")
print(" -", OUT_DIR / "classes.json")
print(" -", OUT_DIR / "top_features.json")
print("Top features used:", len(top_features))
print("Classes:", le.classes_.tolist())
