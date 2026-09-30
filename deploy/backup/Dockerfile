FROM python:3.14-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
  && apt-get upgrade -y --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools && \
    pip install --no-cache-dir -r requirements.txt

COPY backup.py .
CMD ["python", "backup.py"]
