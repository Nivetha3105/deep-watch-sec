FROM node:20-alpine

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install all dependencies including devDependencies (for tsx execution)
RUN npm install

# Copy source code and config
COPY . .

# Expose backend REST & WebSocket port
EXPOSE 5000

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

# Start server using tsx
CMD ["npm", "run", "dev"]
