# AudioLook — bun multi-stage image.
# Build:  docker build -t audiolook .
# Run:    docker compose up -d   (recommended: restart policy + optional tunnel)

# ---------- build stage: compile the SPA ----------
FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# ---------- runtime stage: bun + express only ----------
FROM oven/bun:1-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build /app/dist ./dist
COPY server.js playlistParser.js ./

# Drop root: run as an unprivileged user
RUN adduser -D -h /app appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["bun", "server.js"]
