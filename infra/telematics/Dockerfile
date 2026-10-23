FROM node:22.22.0-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY worker.mjs bridge-contract.mjs bridge-processing.mjs bridge-command-mode.mjs janitor.mjs privacy-contract.mjs ./
USER node
CMD ["node", "worker.mjs"]
