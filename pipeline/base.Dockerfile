FROM python:3.12-slim

COPY backend/ /app/backend/
COPY pipeline/ /app/pipeline/

ENV PYTHONPATH=/app/backend

WORKDIR /app/pipeline

RUN pip install --no-cache-dir -r /app/backend/requirements.txt -r /app/pipeline/requirements.txt

ENTRYPOINT ["python", "cli.py"]
