# ── Stage 1: Install dependencies ──────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only package files first (layer-cache friendly)
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# ── Stage 2: Minimal runtime image ─────────────────────────────────────────
FROM node:20-alpine AS runner

# Non-root user for security
RUN addgroup -S careconnect && adduser -S careconnect -G careconnect

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Remove dev/test files that have no place in production
RUN rm -f diagnose.js test_firebase.js test_mysql.js check_*.js verify_db.js reset_caretakers.js

# Drop to non-root user
USER careconnect

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "index.js"]
