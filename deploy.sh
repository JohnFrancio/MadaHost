#!/bin/bash

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="madahost.me"
EMAIL="votre_email@example.com" # Remplacer par votre email

# Fonction pour afficher les messages
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Fonction d'initialisation
init() {
    log_info "Installation des dépendances système..."
    
    # Vérifier si Docker est installé
    if ! command -v docker &> /dev/null; then
        log_warning "Docker n'est pas installé. Installation..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh
        log_success "Docker installé !"
    else
        log_success "Docker déjà installé"
    fi
    
    # Vérifier si Docker Compose est installé
    if ! command -v docker-compose &> /dev/null; then
        log_warning "Docker Compose n'est pas installé. Installation..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        log_success "Docker Compose installé !"
    else
        log_success "Docker Compose déjà installé"
    fi
    
    # Créer les dossiers nécessaires
    log_info "Création des dossiers..."
    mkdir -p certbot/conf certbot/www nginx/conf.d backend/logs
    
    # Vérifier les fichiers de configuration
    log_info "Vérification des fichiers de configuration..."
    
    if [ ! -f "backend/.env.production" ]; then
        log_error "backend/.env.production manquant ! Créez-le avant de continuer."
        exit 1
    fi
    
    if [ ! -f "frontend/.env.production" ]; then
        log_error "frontend/.env.production manquant ! Créez-le avant de continuer."
        exit 1
    fi
    
    if [ ! -f "docker-compose.prod.yml" ]; then
        log_error "docker-compose.prod.yml manquant !"
        exit 1
    fi
    
    log_success "Initialisation terminée !"
    log_warning "Avant de continuer, configurez :"
    log_warning "1. backend/.env.production (GitHub OAuth, Supabase, etc.)"
    log_warning "2. frontend/.env.production"
    log_warning "3. Puis exécutez : ./deploy.sh ssl"
}

# Fonction pour configurer SSL
setup_ssl() {
    log_info "Configuration SSL avec Let's Encrypt..."
    
    # Télécharger les options SSL recommandées
    if [ ! -f "certbot/conf/options-ssl-nginx.conf" ]; then
        log_info "Téléchargement des options SSL..."
        sudo curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > certbot/conf/options-ssl-nginx.conf
        sudo curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > certbot/conf/ssl-dhparams.pem
    fi
    
    # Démarrer temporairement nginx pour certbot
    log_info "Démarrage temporaire de Nginx..."
    docker-compose -f docker-compose.prod.yml up -d nginx
    
    sleep 5
    
    # Obtenir le certificat wildcard
    log_info "Obtention du certificat SSL wildcard pour *.$DOMAIN..."
    log_warning "Vous devrez valider manuellement via DNS pour le wildcard"
    
    docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
        --manual \
        --preferred-challenges dns \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN \
        -d "*.$DOMAIN"
    
    if [ $? -eq 0 ]; then
        log_success "Certificat SSL obtenu avec succès !"
        log_info "Redémarrage des services..."
        docker-compose -f docker-compose.prod.yml down
        docker-compose -f docker-compose.prod.yml up -d
        log_success "SSL configuré et services redémarrés !"
    else
        log_error "Échec de l'obtention du certificat SSL"
        exit 1
    fi
}

# Fonction de déploiement/mise à jour
deploy() {
    log_info "Déploiement de MadaHost..."
    
    # Arrêter les services existants
    log_info "Arrêt des services existants..."
    docker-compose -f docker-compose.prod.yml down
    
    # Pull des dernières modifications (si git)
    if [ -d ".git" ]; then
        log_info "Récupération des dernières modifications..."
        git pull
    fi
    
    # Build et démarrage
    log_info "Build et démarrage des services..."
    docker-compose -f docker-compose.prod.yml build --no-cache
    docker-compose -f docker-compose.prod.yml up -d
    
    # Attendre que les services soient prêts
    log_info "Attente du démarrage des services..."
    sleep 10
    
    # Vérifier le statut
    docker-compose -f docker-compose.prod.yml ps
    
    log_success "Déploiement terminé !"
    log_info "Vérifiez : https://$DOMAIN"
    log_info "API : https://api.$DOMAIN"
}

# Fonction de mise à jour rapide (sans rebuild)
update() {
    log_info "Mise à jour rapide..."
    
    # Pull git si disponible
    if [ -d ".git" ]; then
        log_info "Git pull..."
        git pull
    fi
    
    # Redémarrer les services
    log_info "Redémarrage des services..."
    docker-compose -f docker-compose.prod.yml restart
    
    log_success "Mise à jour terminée !"
}

# Fonction de redémarrage
restart() {
    log_info "Redémarrage des services..."
    docker-compose -f docker-compose.prod.yml restart
    log_success "Services redémarrés !"
}

# Fonction pour voir les logs
logs() {
    log_info "Affichage des logs (Ctrl+C pour quitter)..."
    docker-compose -f docker-compose.prod.yml logs -f --tail=100
}

# Fonction de sauvegarde
backup() {
    log_info "Création d'une sauvegarde..."
    
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p $BACKUP_DIR
    
    # Backup des volumes Docker
    docker run --rm -v madahost_deployed_projects:/data -v $(pwd)/$BACKUP_DIR:/backup alpine tar czf /backup/deployed_projects.tar.gz -C /data .
    
    # Backup des logs
    cp -r backend/logs $BACKUP_DIR/
    
    log_success "Sauvegarde créée dans $BACKUP_DIR"
}

# Fonction de nettoyage
clean() {
    log_warning "Nettoyage des ressources Docker..."
    docker-compose -f docker-compose.prod.yml down -v
    docker system prune -af
    log_success "Nettoyage terminé !"
}

# Fonction d'aide
help() {
    echo "Usage: ./deploy.sh [commande]"
    echo ""
    echo "Commandes disponibles:"
    echo "  init      - Installation initiale (Docker, dossiers, etc.)"
    echo "  ssl       - Configuration SSL avec Let's Encrypt"
    echo "  deploy    - Build et déploiement complet"
    echo "  update    - Mise à jour rapide sans rebuild"
    echo "  restart   - Redémarrage des services"
    echo "  logs      - Afficher les logs en temps réel"
    echo "  backup    - Créer une sauvegarde"
    echo "  clean     - Nettoyer les ressources Docker"
    echo "  help      - Afficher cette aide"
}

# Menu principal
case "$1" in
    init)
        init
        ;;
    ssl)
        setup_ssl
        ;;
    deploy)
        deploy
        ;;
    update)
        update
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    backup)
        backup
        ;;
    clean)
        clean
        ;;
    help|*)
        help
        ;;
esac