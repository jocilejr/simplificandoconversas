FROM node:20-slim
WORKDIR /app

RUN apt-get update &&     apt-get install -y python3 make g++ git &&     rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY dist ./dist

EXPOSE 8080
CMD ["node", "dist/index.js"]
