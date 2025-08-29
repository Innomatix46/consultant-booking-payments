# Multi-stage Docker build for PCI-compliant Node.js app
FROM node:18-alpine AS builder

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY config/ ./config/

# Security: Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Production stage
FROM node:18-alpine AS production

# Security hardening
RUN apk --no-cache add dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Security: Remove unnecessary packages and files
RUN apk del --purge && rm -rf /var/cache/apk/* /tmp/*

# Expose port (non-privileged)
EXPOSE 3000

USER nodejs

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]