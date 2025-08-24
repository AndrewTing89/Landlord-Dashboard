# Simple single-stage build for development
FROM node:18-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install dependencies (skip optional dependencies to speed up)
RUN npm ci --omit=optional && \
    npm cache clean --force

# Copy application code
COPY . .

# Expose port
EXPOSE 3002

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/server.js"]