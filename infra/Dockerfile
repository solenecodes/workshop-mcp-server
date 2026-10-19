FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/sandbox ./src/sandbox
COPY src/backend ./src/backend
COPY src/data ./src/data
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
RUN mkdir /app/.workshop-data && chown node:node /app/.workshop-data
USER node
EXPOSE 8080
CMD ["node", "dist/src/sandbox/start.js"]
