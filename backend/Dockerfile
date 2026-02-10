FROM python:3.11-slim

WORKDIR /app

# system deps for librosa/scipy
RUN apt-get update && apt-get install -y \
    build-essential \
    libsndfile1 \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
