# syntax=docker/dockerfile:1
# Production image: Next.js standalone server + a bundled release step (migrations and
# first-run setup) that runs before the server starts. Works on any container host
# (Railway, Render, Fly.io, Cloud Run, a VPS with Docker).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
# Public URL is inlined into the client bundle at build time.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build \
 && npx esbuild scripts/deploy.ts --bundle --platform=node --target=node22 --conditions=react-server \
      --external:pg-native --outfile=dist/deploy.cjs --log-level=warning

FROM node:22-alpine AS runner
WORKDIR /app
ARG NEXT_PUBLIC_SITE_URL
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/drizzle ./drizzle
COPY --from=build --chown=app:app /app/dist/deploy.cjs ./deploy.cjs
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["sh", "-c", "node deploy.cjs && exec node server.js"]
