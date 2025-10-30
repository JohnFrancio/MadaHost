#!/bin/bash
# scripts/diagnose-deployment.sh - Diagnostic des déploiements

set -e

echo "🔍 Diagnostic de l'environnement de déploiement MadaHost"
echo "========================================================="

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Vérifier si on est dans Docker
if [ -f /.dockerenv ]; then
    echo -e "${BLUE}📦 Environnement: Docker${NC}"
else
    echo -e "${YELLOW}⚠️  Environnement: Host (pas Docker)${NC}"
fi

echo ""
echo "=== 1. Vérification Node.js ==="
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"
else
    echo -e "${RED}❌ Node.js non trouvé${NC}"
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ npm: $NPM_VERSION${NC}"
else
    echo -e "${RED}❌ npm non trouvé${NC}"
fi

echo ""
echo "=== 2. Vérification Git ==="
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    echo -e "${GREEN}✅ $GIT_VERSION${NC}"
else
    echo -e "${RED}❌ Git non trouvé${NC}"
fi

echo ""
echo "=== 3. Vérification des dossiers ==="

check_dir() {
    local dir=$1
    if [ -d "$dir" ]; then
        local perms=$(stat -c '%a' "$dir" 2>/dev/null || stat -f '%A' "$dir" 2>/dev/null)
        local owner=$(stat -c '%U:%G' "$dir" 2>/dev/null || stat -f '%Su:%Sg' "$dir" 2>/dev/null)
        echo -e "${GREEN}✅ $dir${NC}"
        echo "   Permissions: $perms | Owner: $owner"
    else
        echo -e "${RED}❌ $dir (n'existe pas)${NC}"
    fi
}

check_dir "/var/www/deployed"
check_dir "/backend/temp"
check_dir "/backend/builds"
check_dir "/backend/public"
check_dir "/backend/logs"

echo ""
echo "=== 4. Test d'écriture ==="

test_write() {
    local dir=$1
    local test_file="$dir/.test-write-$$"
    
    if touch "$test_file" 2>/dev/null; then
        rm "$test_file"
        echo -e "${GREEN}✅ $dir (écriture OK)${NC}"
    else
        echo -e "${RED}❌ $dir (pas d'écriture)${NC}"
    fi
}

test_write "/var/www/deployed"
test_write "/backend/temp"

echo ""
echo "=== 5. Vérification de l'utilisateur ==="
echo "Utilisateur actuel: $(whoami)"
echo "UID: $(id -u)"
echo "GID: $(id -g)"
echo "Groupes: $(groups)"

echo ""
echo "=== 6. Test npm install ==="
TEST_DIR="/tmp/npm-test-$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

cat > package.json <<EOF
{
  "name": "test",
  "version": "1.0.0",
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
EOF

echo "Installation de Vite dans $TEST_DIR..."
if npm install --silent 2>&1 | grep -q "added"; then
    if [ -f "node_modules/.bin/vite" ]; then
        echo -e "${GREEN}✅ npm install fonctionne (Vite installé)${NC}"
    else
        echo -e "${YELLOW}⚠️  npm install OK mais Vite non trouvé dans .bin${NC}"
    fi
else
    echo -e "${RED}❌ npm install a échoué${NC}"
fi

# Nettoyage
cd /
rm -rf "$TEST_DIR"

echo ""
echo "=== 7. Variables d'environnement ==="
echo "NODE_ENV: ${NODE_ENV:-non défini}"
echo "PATH: $PATH"

echo ""
echo "=== 8. Espace disque ==="
df -h / | tail -1

echo ""
echo "=== 9. Sites déployés ==="
if [ -d "/var/www/deployed" ]; then
    DEPLOYED_COUNT=$(ls -1 /var/www/deployed 2>/dev/null | wc -l)
    echo "Nombre de sites: $DEPLOYED_COUNT"
    
    if [ $DEPLOYED_COUNT -gt 0 ]; then
        echo "Sites:"
        ls -1 /var/www/deployed | while read site; do
            SIZE=$(du -sh "/var/www/deployed/$site" 2>/dev/null | cut -f1)
            echo "  - $site ($SIZE)"
        done
    fi
else
    echo -e "${YELLOW}⚠️  Dossier /var/www/deployed n'existe pas${NC}"
fi

echo ""
echo "========================================================="
echo -e "${GREEN}✅ Diagnostic terminé${NC}"