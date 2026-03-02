FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt

RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app


FROM base AS dev
ENV FLASK_ENV=development
EXPOSE 8000
CMD ["bash", "-lc", "flask --app app run --host=0.0.0.0 --port=8000 --debug"]


FROM base AS prod
ENV FLASK_ENV=production
EXPOSE 8000
CMD ["bash", "-lc", "gunicorn -b 0.0.0.0:8000 'app:create_app()' --workers 2 --threads 4 --timeout 60"]