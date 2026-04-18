FROM node:20-alpine

# Native deps for Baileys (sharp for sticker/image processing, ffmpeg for audio conversion)
RUN apk add --no-cache python3 make g++ ffmpeg vips-dev curl git

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm install --save-dev typescript @types/node @types/express
RUN npx tsc

# Strip dev deps after build
RUN npm prune --omit=dev

EXPOSE 8080

CMD ["node", "dist/index.js"]
