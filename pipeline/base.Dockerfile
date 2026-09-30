FROM python:3.12-slim

RUN apt-get update && apt-get upgrade -y --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

COPY backend/ /app/backend/
COPY pipeline/ /app/pipeline/

ENV PYTHONPATH=/app/backend

WORKDIR /app/pipeline

RUN pip install --no-cache-dir --upgrade pip setuptools && \
    pip install --no-cache-dir -r /app/backend/requirements.txt -r /app/pipeline/requirements.txt

ENTRYPOINT ["python", "cli.py"]
