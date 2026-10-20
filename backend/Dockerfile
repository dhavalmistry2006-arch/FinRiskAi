FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=build_ca,target=/tmp/build-ca.pem \
    if [ -f /tmp/build-ca.pem ]; then export NODE_EXTRA_CA_CERTS=/tmp/build-ca.pem; fi; npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=build_ca,target=/tmp/build-ca.pem \
    if [ -f /tmp/build-ca.pem ]; then export NODE_EXTRA_CA_CERTS=/tmp/build-ca.pem; fi; npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
USER node
EXPOSE 5000
CMD ["node","dist/server.js"]
