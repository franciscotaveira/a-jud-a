FROM node:22-alpine AS builder

WORKDIR /app

# Copiar arquivos do monorepo
COPY package.json package-lock.json tsconfig.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/
COPY packages/evidence/package.json ./packages/evidence/
COPY packages/connectors/package.json ./packages/connectors/
COPY services/platform-api/package.json ./services/platform-api/

RUN npm install

COPY packages ./packages
COPY services/platform-api ./services/platform-api

RUN npm run --workspace=@pig-br/contracts build && \
    npm run --workspace=@pig-br/domain build && \
    npm run --workspace=@pig-br/evidence build && \
    npm run --workspace=@pig-br/connectors build && \
    npm run --workspace=@pig-br/platform-api build

FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/
COPY packages/evidence/package.json ./packages/evidence/
COPY packages/connectors/package.json ./packages/connectors/
COPY services/platform-api/package.json ./services/platform-api/

RUN npm install --omit=dev

COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/packages/domain/dist ./packages/domain/dist
COPY --from=builder /app/packages/evidence/dist ./packages/evidence/dist
COPY --from=builder /app/packages/connectors/dist ./packages/connectors/dist
COPY --from=builder /app/services/platform-api/dist ./services/platform-api/dist

EXPOSE 3001

CMD ["node", "services/platform-api/dist/index.js"]
