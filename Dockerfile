# Proje Arkadaşım — üretim imajı (Oracle Always Free ARM ya da x86 VM üzerinde derlenir).
FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
# Derleme sırasında veritabanına bağlanılmaz; Prisma yalnız geçerli bir adres ister.
ENV DATABASE_URL="file:/tmp/build.db" NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS run
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build /app ./
RUN mkdir -p /data /app/storage
EXPOSE 3000
# Açılışta bekleyen göçleri uygular, sonra sunucuyu başlatır.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
