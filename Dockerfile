# Build frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY index.html vite.config.ts tsconfig*.json tailwind.config.ts postcss.config.js components.json ./
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build

# Backend + serve frontend
FROM node:20-alpine
WORKDIR /app
COPY backend/package.json ./
RUN npm install --production
COPY backend/src/ ./src/
COPY --from=frontend /app/dist ./public
EXPOSE 3001
CMD node src/migrate.js && node src/seed.js && npm start
