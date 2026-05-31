FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm build

ENV TZ=Europe/Kyiv
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
