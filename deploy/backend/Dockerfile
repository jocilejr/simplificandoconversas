FROM node:20-alpine
RUN apk add --no-cache poppler-utils
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc
EXPOSE 3001
CMD ["node", "dist/index.js"]
