
# backend/Dockerfile.local
FROM node:18-alpine

# Installer git pour les clones
RUN apk add --no-cache git docker-cli

WORKDIR /app

# Copier package.json
COPY package*.json ./
RUN npm install

# Copier le code
COPY . .

# Créer les dossiers nécessaires
RUN mkdir -p builds public temp

EXPOSE 3001

CMD ["npm", "run", "dev"]
