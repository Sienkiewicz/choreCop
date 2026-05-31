FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

ENV TZ=Europe/Warsaw
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
