FROM node:18-alpine

WORKDIR /app

# Install dependencies (use production install by default)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

EXPOSE 4000

# Use the start script from server/package.json
CMD ["node", "src/index.js"]