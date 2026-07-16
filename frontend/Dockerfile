# Docker cannot read frontend/.nvmrc in FROM before the build context is copied.
# Keep this default in sync with frontend/.nvmrc; CI verifies they match.
ARG NODE_VERSION=26
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:${NODE_VERSION}-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["sh", "-lc", "npm run dev -- --host 0.0.0.0 --port 5173"]

FROM deps AS build
COPY . .
ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN=$(cat /run/secrets/sentry_auth_token) npm run build

FROM nginx:1.31.3-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]