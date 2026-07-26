# Build the Nuxt app, then run the self-contained Nitro output.
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3333
# .output is fully self-contained — no node_modules needed at runtime.
COPY --from=build /app/.output ./.output
EXPOSE 3333
CMD ["node", ".output/server/index.mjs"]
