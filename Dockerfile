# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /workspace

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs ./
COPY apps/api/package.json apps/api/package.json
COPY apps/storefront/package.json apps/storefront/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
ARG API_URL=http://api:4000
ARG APP_URL=http://localhost:3000
ARG STORE_NAME="Atelier Floral"
ARG STORE_DEFAULT_CURRENCY=TND
ARG STORE_DEFAULT_LOCALE=fr-TN
ENV API_URL=$API_URL
ENV APP_URL=$APP_URL
ENV STORE_NAME=$STORE_NAME
ENV STORE_DEFAULT_CURRENCY=$STORE_DEFAULT_CURRENCY
ENV STORE_DEFAULT_LOCALE=$STORE_DEFAULT_LOCALE
COPY . .
RUN pnpm build

FROM base AS api
ENV NODE_ENV=production
COPY --from=build /workspace /workspace
EXPOSE 4000
CMD ["pnpm", "--filter", "@atelier/api", "start"]

FROM base AS storefront
ENV NODE_ENV=production
COPY --from=build /workspace /workspace
EXPOSE 3000
CMD ["pnpm", "--filter", "@atelier/storefront", "start"]
