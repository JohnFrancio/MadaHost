#!/bin/bash
echo "🚀 Démarrage de MadaHost en local..."

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    echo "💡 Utilisation du mode développement simple..."
    
    # Mode simple
    echo "🔧 Installation des dépendances frontend..."
    cd frontend && npm install @heroicons/vue @headlessui/vue
    
    echo "🚀 Démarrage du backend..."
    cd ../backend
    npm run dev &
    
    echo "🎨 Démarrage du frontend..."
    cd ../frontend
    npm run dev
else
    echo "🐳 Docker détecté..."
    
    # Tester quelle version de docker-compose
    if command -v docker-compose &> /dev/null; then
        echo "📦 Utilisation de docker-compose (ancienne version)"
        docker-compose -f docker-compose.local.yml up --build
    elif docker compose version &> /dev/null; then
        echo "📦 Utilisation de docker compose (nouvelle version)"
        docker compose -f docker-compose.local.yml up --build
    else
        echo "❌ Docker Compose non disponible"
        echo "💡 Basculement vers le mode développement simple..."
        
        echo "🔧 Installation des dépendances frontend..."
        cd frontend && npm install @heroicons/vue @headlessui/vue
        
        echo "🚀 Démarrage du backend..."
        cd ../backend
        npm run dev &
        
        echo "🎨 Démarrage du frontend..."
        cd ../frontend
        npm run dev
    fi
fi