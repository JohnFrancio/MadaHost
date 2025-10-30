#!/bin/bash
# deploy.sh - Script de déploiement MadaHost

set -e

echo "🚀 Déploiement MadaHost en production"
echo "======================================"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier que nous sommes dans le bon dossier
if [ ! -f "docker-compose.prod.yml" ]; then
    echo -e "${RED}❌ Erreur: docker-compose.prod.yml non trouvé${NC}"
    echo "Assurez-vous d'être dans le dossier racine du projet"
    exit 1
fi

# Vérifier que .env.production existe
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ Erreur: .env.production non trouvé${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Fichiers de configuration trouvés${NC}"

# Arrêter les conteneurs existants
echo ""
echo "🛑 Arrêt des conteneurs existants..."
docker-compose -f docker-compose.prod.yml down

# Supprimer les images anciennes (optionnel)
echo ""
echo "🧹 Nettoyage des images anciennes..."
docker image prune -f

# Créer les dossiers nécessaires
echo ""
echo "📁 Création des dossiers..."
mkdir -p nginx/conf.d
mkdir -p nginx/html
mkdir -p backend/logs
mkdir -p backend/temp
mkdir -p backend/builds
mkdir -p backend/public

# Copier les pages d'erreur Nginx
echo ""
echo "📄 Configuration des pages d'erreur..."
if [ ! -f "nginx/html/404.html" ]; then
    echo -e "${YELLOW}⚠️  404.html manquant, création...${NC}"
    # Créer un fichier 404.html basique si nécessaire
fi

# Construire les images
echo ""
echo "🏗️  Construction des images Docker..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Créer les volumes s'ils n'existent pas
echo ""
echo "💾 Vérification des volumes..."
docker volume create deployed_projects 2>/dev/null || true
docker volume create build_cache 2>/dev/null || true
docker volume create nginx_cache 2>/dev/null || true

# Démarrer les services
echo ""
echo "🚀 Démarrage des services..."
docker-compose -f docker-compose.prod.yml up -d

# Attendre que les services démarrent
echo ""
echo "⏳ Attente du démarrage des services..."
sleep 5

# Vérifier le statut
echo ""
echo "🔍 Vérification du statut..."
docker-compose -f docker-compose.prod.yml ps

# Tester la santé de l'API
echo ""
echo "🏥 Test de santé de l'API..."
MAX_ATTEMPTS=10
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -f http://localhost:3001/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ API opérationnelle${NC}"
        break
    else
        ATTEMPT=$((ATTEMPT + 1))
        echo "Tentative $ATTEMPT/$MAX_ATTEMPTS..."
        sleep 2
    fi
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}❌ L'API ne répond pas${NC}"
    echo "Vérifiez les logs avec: docker logs madahost_api"
    exit 1
fi

# Afficher les logs récents
echo ""
echo "📋 Logs récents de l'API:"
docker logs --tail=20 madahost_api

echo ""
echo -e "${GREEN}======================================"
echo "✅ Déploiement terminé avec succès!"
echo "======================================${NC}"
echo ""
echo "🔗 URLs:"
echo "   - Frontend: https://madahost.me"
echo "   - API: https://api.madahost.me"
echo "   - Sites déployés: https://<nom>.madahost.me"
echo ""
echo "📊 Commandes utiles:"
echo "   - Voir les logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "   - Arrêter: docker-compose -f docker-compose.prod.yml down"
echo "   - Redémarrer: docker-compose -f docker-compose.prod.yml restart"
echo "   - État des services: docker-compose -f docker-compose.prod.yml ps"
echo ""
echo "🔧 Volumes:"
echo "   - Projets déployés: /var/lib/docker/volumes/deployed_projects"
echo "   - Cache de build: /var/lib/docker/volumes/build_cache"
echo ""