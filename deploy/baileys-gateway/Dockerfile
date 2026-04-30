FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev --legacy-peer-deps
# increase Baileys link preview fetch timeout from 3s to 15s
RUN sed -i 's/timeout: 3000/timeout: 15000/g' node_modules/@whiskeysockets/baileys/lib/Socket/messages-send.js
# Patch: emit logger.error in silent CIPHERTEXT path so new-contact messages create conversations
RUN node -e "const fs=require('fs'); const p='node_modules/@whiskeysockets/baileys/lib/Utils/decode-wa-message.js'; let c=fs.readFileSync(p,'utf8'); const old='            if (!decryptables && !fullMessage.key?.isViewOnce) {\n                fullMessage.messageStubType = proto.WebMessageInfo.StubType.CIPHERTEXT;'; const rep='            if (!decryptables && !fullMessage.key?.isViewOnce) {\n                logger.error({ key: fullMessage.key }, \'failed to decrypt message\');\n                fullMessage.messageStubType = proto.WebMessageInfo.StubType.CIPHERTEXT;'; if(!c.includes(old)){process.stderr.write('decode patch: target not found\n');process.exit(1);} fs.writeFileSync(p,c.replace(old,rep)); console.log('decode-wa-message patch OK');"
# Patch: emit CIPHERTEXT stub for msmsg (multi-device msg from new contacts)
RUN node -e "const fs=require('fs'); const p='node_modules/@whiskeysockets/baileys/lib/Socket/messages-recv.js'; let c=fs.readFileSync(p,'utf8'); const old='        if (encNode && encNode.attrs.type === \'msmsg\') {\n            logger.debug({ key: node.attrs.key }, \'ignored msmsg\');\n            await sendMessageAck(node, NACK_REASONS.MissingMessageSecret);\n            return;\n        }'; const rep='        if (encNode && encNode.attrs.type === \'msmsg\') {\n            logger.debug({ key: node.attrs.key }, \'ignored msmsg\');\n            await sendMessageAck(node, NACK_REASONS.MissingMessageSecret);\n            if (node.attrs.from && !isJidGroup(node.attrs.from) && !isJidStatusBroadcast(node.attrs.from)) { try { const stubMsg = { key: { id: node.attrs.id||(\'msmsg-\'+Date.now()), remoteJid: jidNormalizedUser(node.attrs.from), fromMe: false, participant: node.attrs.participant||undefined }, messageStubType: proto.WebMessageInfo.StubType.CIPHERTEXT, messageTimestamp: node.attrs.t?parseInt(node.attrs.t):Math.floor(Date.now()/1000), pushName: node.attrs.notify||\'\', message: null }; await upsertMessage(stubMsg,\'notify\'); } catch(e) { logger.debug({err:e.message},\'msmsg stub emit failed\'); } }\n            return;\n        }'; if(c===c.replace(old,rep)){process.stderr.write('msmsg patch: target not found\n');process.exit(1);} fs.writeFileSync(p,c.replace(old,rep)); console.log('messages-recv msmsg patch OK');" 
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
