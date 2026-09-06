# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar arquivos de configuração do monorepo
COPY package.json package-lock.json tsconfig.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/
COPY packages/evidence/package.json ./packages/evidence/
COPY packages/connectors/package.json ./packages/connectors/
COPY apps/web/package.json ./apps/web/

# Instalar dependências
RUN npm install

# Copiar código fonte
COPY packages ./packages
COPY fixtures ./fixtures
COPY apps/web ./apps/web

# Build dos pacotes e do app web
RUN npm run --workspace=@pig-br/contracts build && \
    npm run --workspace=@pig-br/domain build && \
    npm run --workspace=@pig-br/evidence build && \
    npm run --workspace=@pig-br/connectors build && \
    npm run --workspace=@pig-br/web build

# Production stage com Nginx
FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
