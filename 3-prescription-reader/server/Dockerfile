# ── Stage 1: Download and cache model weights ───────────────────────────────
# Using a full Python image just for pip + heavy model download
FROM python:3.11-slim AS model-downloader

WORKDIR /model-cache

# Install only what's needed to pull the model
RUN pip install --no-cache-dir huggingface_hub

# Pre-download Donut base model to a cache folder
# (Replace with your fine-tuned model ID if uploaded to HuggingFace Hub)
RUN python -c "\
from huggingface_hub import snapshot_download; \
snapshot_download(repo_id='naver-clova-ix/donut-base', cache_dir='/model-cache')"

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM python:3.11-slim AS runner

WORKDIR /app

# System libraries needed by OpenCV and PyTorch
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy model weights from downloader stage (avoids re-downloading)
COPY --from=model-downloader /model-cache /root/.cache/huggingface

# Copy application code
COPY donut_server.py ./

# Copy local fine-tuned model if present (adjust path as needed)
# COPY ../best_model ./best_model

# Non-root user
RUN useradd -m donut && chown -R donut:donut /app /root/.cache/huggingface
USER donut

EXPOSE 8000

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

CMD ["uvicorn", "donut_server:app", "--host", "0.0.0.0", "--port", "8000"]
