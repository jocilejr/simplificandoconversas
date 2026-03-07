FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache git
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc
EXPOSE 8084
CMD ["node", "dist/index.js"]
