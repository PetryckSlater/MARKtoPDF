# Imagem base leve com Node.js
FROM node:20-slim

# Instala Chromium headless e fontes essenciais no Linux Debian
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Define o executável do Chromium para o motor headless
ENV CHROME_PATH=/usr/bin/chromium
ENV PORT=3000

WORKDIR /app

# Instala dependências
COPY package*.json ./
RUN npm ci --only=production

# Copia código fonte da aplicação
COPY . .

# Expõe porta da interface Web
EXPOSE 3000

# Por padrão, inicia o servidor Web (pode ser sobrescrito para CLI)
CMD ["node", "server.js"]
