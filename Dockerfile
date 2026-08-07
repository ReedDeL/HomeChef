FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV HOST=0.0.0.0
ENV PORT=8081

EXPOSE 8081

CMD ["npm", "run", "web:beta"]