#!/bin/bash

# ========================================
# MADAHOST - Script de Déploiement VPS
# Version: 2.0 (Supabase + Cookie Fix)
# ========================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Variables
DOMAIN="madahost.me"
EMAIL="${LETSENCRYPT_EMAIL:-admin@madahost.me}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ========================================
# Fonctions utilitaires
# ========================================

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

check_root() {
    if [ "$EUID" -eq 0 ]; then
        print_error "Ne pas exécuter ce script en root. Utilisez sudo si nécessaire."
        exit 1
    fi
}

# ========================================
# Installation des dépendances
# ========================================

install_dependencies() {
    print_header "Installation des dépendances"
    
    # Mise à jour du système
    print_info "Mise à jour du système..."
    sudo apt update && sudo apt upgrade -y
    print_success "Système mis à jour"
    
    # Installation des paquets de base
    print_info "Installation des paquets de base..."
    sudo apt install -y curl wget git ca-certificates gnupg lsb-release
    
    # Docker
    if ! command -v docker &> /dev/null; then
        print_info "Installation de Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        rm get-docker.sh
        sudo usermod -aG docker $USER
        print_success "Docker installé"
        print_warning "Vous devez vous déconnecter et reconnecter pour utiliser Docker sans sudo"
    else
        print_success "Docker déjà installé ($(docker --version))"
    fi
    
    # Docker Compose
    if ! docker compose version &> /dev/null; then
        print_info "Installation de Docker Compose Plugin..."
        sudo apt install -y docker-compose-plugin -y
        print_success "Docker Compose installé"
    else
        print_success "Docker Compose déjà installé"
    fi
    
    # Certbot
    if ! command -v certbot &> /dev/null; then
        print_info "Installation de Certbot..."
        sudo apt install -y certbot
        print_success "Certbot installé"
    else
        print_success "Certbot déjà installé"
    fi
}

# ========================================
# Configuration environnement
# ========================================

setup_environment() {
    print_header "Configuration de l'environnement"
    
    cd "$PROJECT_DIR"
    
    if [ ! -f .env.production ]; then
        print_info "Création du fichier .env.production..."
        
        # Générer des secrets
        SESSION_SECRET=$(openssl rand -base64 32)
        JWT_SECRET=$(openssl rand -base64 32)
        
        cat > .env.production << EOF
# ========================================
# MADAHOST - Production Environment
# ========================================

NODE_ENV=production
PORT=3001

# ========================================
# SUPABASE DATABASE
# ========================================
SUPABASE_URL='https://kkjbnjkvltvfrccxdmab.supabase.co'
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtramJuamt2bHR2ZnJjY3hkbWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4ODg4NDQsImV4cCI6MjA3MjQ2NDg0NH0.sZ2BtoHs1uG30Zv3ebhFTkPYdoTL-AzGw-oTtFCEYS0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtramJuamt2bHR2ZnJjY3hkbWFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njg4ODg0NCwiZXhwIjoyMDcyNDY0ODQ0fQ.1h8Y1-59sg5jLrnEHG8JUL5Ya-mnSdoNE3sm0MgzLH8

# ========================================
# GITHUB OAUTH
# ========================================
GITHUB_CLIENT_ID=Ov23liq7ZfyfSCt1E0od
GITHUB_CLIENT_SECRET=c3464bc011fb7e42e25caff934553775b24520d4
GITHUB_CALLBACK_URL=http://localhost:3001/api/auth/github/callback

# ========================================
# SECRETS
# ========================================
SESSION_SECRET=${SESSION_SECRET}
JWT_SECRET=${JWT_SECRET}

# ========================================
# URLS
# ========================================
FRONTEND_URL=https://madahost.me
API_URL=https://api.madahost.me/api

# ========================================
# COOKIE CONFIGURATION (IMPORTANT!)
# ========================================
COOKIE_DOMAIN=.madahost.me
COOKIE_SECURE=true

# ========================================
# DEPLOIEMENTS
# ========================================
DEPLOYMENTS_DIR=/app/deployments
PROJECTS_DOMAIN=madahost.me

# ========================================
# LOGS
# ========================================
LOG_LEVEL=info
LOG_DIR=/app/logs

# ========================================
# SECURITE
# ========================================
CORS_ORIGINS=https://madahost.me,https://www.madahost.me
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ========================================
# ADMIN
# ========================================
ADMIN_EMAIL=${EMAIL}
EOF
        
        print_success "Fichier .env.production créé"
        print_warning "IMPORTANT : Modifiez .env.production avec vos vraies valeurs !"
        print_warning "  - SUPABASE_*"
        print_warning "  - GITHUB_CLIENT_ID et GITHUB_CLIENT_SECRET"
        print_warning "  - DATABASE_URL"
    else
        print_success "Fichier .env.production existe déjà"
    fi
    
    # Créer les répertoires nécessaires
    print_info "Création des répertoires..."
    mkdir -p nginx/conf.d nginx/ssl logs
    print_success "Répertoires créés"
}

# ========================================
# Vérification DNS
# ========================================

check_dns() {
    print_header "Vérification DNS"
    
    local server_ip=$(curl -s ifconfig.me)
    print_info "IP du serveur : $server_ip"
    
    local dns_ip=$(dig +short $DOMAIN | head -n1)
    if [ "$dns_ip" == "$server_ip" ]; then
        print_success "$DOMAIN pointe vers $server_ip"
    else
        print_error "$DOMAIN pointe vers $dns_ip (devrait être $server_ip)"
        return 1
    fi
    
    local api_ip=$(dig +short api.$DOMAIN | head -n1)
    if [ "$api_ip" == "$server_ip" ]; then
        print_success "api.$DOMAIN pointe vers $server_ip"
    else
        print_error "api.$DOMAIN pointe vers $api_ip (devrait être $server_ip)"
        return 1
    fi
    
    local wildcard_ip=$(dig +short test.$DOMAIN | head -n1)
    if [ "$wildcard_ip" == "$server_ip" ]; then
        print_success "*.$DOMAIN (wildcard) pointe vers $server_ip"
    else
        print_error "*.$DOMAIN pointe vers $wildcard_ip (devrait être $server_ip)"
        return 1
    fi
    
    return 0
}

# ========================================
# Configuration SSL
# ========================================

setup_ssl() {
    print_header "Configuration SSL avec Let's Encrypt"
    
    if ! check_dns; then
        print_error "Les DNS ne sont pas correctement configurés"
        exit 1
    fi
    
    print_info "Arrêt temporaire de Nginx..."
    docker compose -f docker-compose.prod.yml stop nginx 2>/dev/null || true
    
    print_info "Demande du certificat SSL wildcard..."
    sudo certbot certonly \
        --standalone \
        --preferred-challenges http \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" \
        -d "api.$DOMAIN" \
        -d "*.$DOMAIN"
    
    if [ $? -eq 0 ]; then
        print_success "Certificat SSL obtenu avec succès"
    else
        print_error "Échec de l'obtention du certificat SSL"
        exit 1
    fi
}

# ========================================
# Build et déploiement
# ========================================

build_and_deploy() {
    print_header "Build et déploiement"
    
    cd "$PROJECT_DIR"
    
    if grep -q "votre_github_client_id" .env.production 2>/dev/null; then
        print_error "Le fichier .env.production n'est pas configuré !"
        print_info "Modifiez .env.production avec vos vraies valeurs"
        exit 1
    fi
    
    print_info "Pull des images Docker..."
    docker compose -f docker-compose.prod.yml pull
    
    print_info "Build des images..."
    docker compose -f docker-compose.prod.yml build --no-cache
    
    print_info "Arrêt des anciens conteneurs..."
    docker compose -f docker-compose.prod.yml down
    
    print_info "Démarrage des conteneurs..."
    docker compose -f docker-compose.prod.yml up -d
    
    print_info "Attente du démarrage..."
    sleep 10
    
    print_info "État des services..."
    docker compose -f docker-compose.prod.yml ps
    
    print_success "Déploiement terminé !"
}

# ========================================
# Autres fonctions
# ========================================

show_logs() {
    cd "$PROJECT_DIR"
    docker compose -f docker-compose.prod.yml logs -f --tail=100
}

show_status() {
    print_header "État des services"
    cd "$PROJECT_DIR"
    docker compose -f docker-compose.prod.yml ps
}

restart_services() {
    print_header "Redémarrage des services"
    cd "$PROJECT_DIR"
    docker compose -f docker-compose.prod.yml restart
    print_success "Services redémarrés"
}

stop_services() {
    print_header "Arrêt des services"
    cd "$PROJECT_DIR"
    docker compose -f docker-compose.prod.yml down
    print_success "Services arrêtés"
}

update_code() {
    print_header "Mise à jour du code"
    cd "$PROJECT_DIR"
    
    print_info "Pull des modifications..."
    git pull origin main
    
    build_and_deploy
}

show_help() {
    cat << EOF
${BLUE}MADAHOST - Script de Déploiement${NC}

${GREEN}Usage:${NC}
  ./deploy.sh [commande]

${GREEN}Commandes:${NC}
  ${YELLOW}install${NC}     Installer les dépendances
  ${YELLOW}init${NC}        Configuration initiale
  ${YELLOW}check-dns${NC}   Vérifier DNS
  ${YELLOW}ssl${NC}         Configurer SSL
  ${YELLOW}deploy${NC}      Build et déployer
  ${YELLOW}update${NC}      Mettre à jour
  ${YELLOW}restart${NC}     Redémarrer
  ${YELLOW}stop${NC}        Arrêter
  ${YELLOW}status${NC}      Voir l'état
  ${YELLOW}logs${NC}        Voir les logs
  ${YELLOW}help${NC}        Aide

EOF
}

# ========================================
# Main
# ========================================

main() {
    check_root
    
    case "${1:-help}" in
        install) install_dependencies ;;
        init) setup_environment ;;
        check-dns) check_dns ;;
        ssl) setup_ssl ;;
        deploy) build_and_deploy ;;
        update) update_code ;;
        restart) restart_services ;;
        stop) stop_services ;;
        status) show_status ;;
        logs) show_logs ;;
        help|*) show_help ;;
    esac
}

main "$@"