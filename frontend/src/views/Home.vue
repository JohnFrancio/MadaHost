<script setup>
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
</script>

<template>
  <div class="text-center animate-fade-in-up">
    <!-- Hero Section -->
    <div class="max-w-5xl mx-auto mb-20">
      <!-- Badge de version -->
      <div class="inline-flex items-center px-4 py-2 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium mb-8 animate-slide-down animation-delay-200">
        <span class="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
        Nouvelle version disponible
      </div>
      
      <h1 class="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-8 text-balance">
        Déployez vos sites web
        <span class="gradient-text block mt-2">en un clic</span>
      </h1>
      
      <p class="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed animate-fade-in-up animation-delay-400">
        Une plateforme moderne et intuitive pour héberger et déployer vos projets
        <span class="font-semibold text-primary-600 dark:text-primary-400">React, Vue.js, Next.js</span> 
        et autres sites statiques directement depuis GitHub.
      </p>

      <div class="flex flex-col sm:flex-row justify-center items-center gap-4 animate-fade-in-up animation-delay-600">
        <router-link
          v-if="!authStore.isAuthenticated"
          to="/login"
          class="btn-primary text-lg px-8 py-4 hover-glow"
        >
          <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clip-rule="evenodd"></path>
          </svg>
          Commencer gratuitement
        </router-link>
        <router-link
          v-else
          to="/dashboard"
          class="btn-primary text-lg px-8 py-4 hover-glow"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
          </svg>
          Aller au Dashboard
        </router-link>
        
        <button
          class="btn-secondary text-lg px-8 py-4 group"
        >
          <svg class="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          En savoir plus
        </button>
      </div>
      
      <!-- Indicateurs de confiance -->
      <div class="mt-16 flex flex-wrap justify-center items-center gap-8 text-gray-500 dark:text-gray-400 animate-fade-in-up animation-delay-800">
        <div class="flex items-center space-x-2">
          <div class="w-2 h-2 bg-green-500 rounded-full"></div>
          <span class="text-sm">99.9% uptime</span>
        </div>
        <div class="flex items-center space-x-2">
          <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span class="text-sm">SSL gratuit</span>
        </div>
        <div class="flex items-center space-x-2">
          <div class="w-2 h-2 bg-purple-500 rounded-full"></div>
          <span class="text-sm">CDN mondial</span>
        </div>
        <div class="flex items-center space-x-2">
          <div class="w-2 h-2 bg-orange-500 rounded-full"></div>
          <span class="text-sm">Support 24/7</span>
        </div>
      </div>
    </div>

    <!-- Features -->
    <div class="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
      <div class="card-hover text-center group animate-fade-in-up">
        <div
          class="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300"
        >
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3">Déploiement ultra-rapide</h3>
        <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
          Connectez votre repo GitHub et déployez en quelques secondes
        </p>
      </div>

      <div class="card-hover text-center group animate-fade-in-up animation-delay-200">
        <div
          class="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300"
        >
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3">Build intelligent</h3>
        <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
          Support React, Vue.js, Next.js avec détection automatique du framework
        </p>
      </div>

      <div class="card-hover text-center group animate-fade-in-up animation-delay-400">
        <div
          class="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300"
        >
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3">Sécurité avancée</h3>
        <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
          Certificats SSL automatiques, protection DDoS et monitoring 24/7
        </p>
      </div>
    </div>
    
    <!-- Section technologies supportées -->
    <div class="mt-24 animate-fade-in-up animation-delay-800">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-8">Technologies supportées</h2>
      <div class="flex flex-wrap justify-center items-center gap-8 opacity-60 hover:opacity-100 transition-opacity duration-300">
        <!-- React -->
        <div class="flex items-center space-x-2 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <div class="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <span class="text-white font-bold text-sm">R</span>
          </div>
          <span class="font-medium text-gray-700 dark:text-gray-300">React</span>
        </div>
        
        <!-- Vue.js -->
        <div class="flex items-center space-x-2 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <div class="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
            <span class="text-white font-bold text-sm">V</span>
          </div>
          <span class="font-medium text-gray-700 dark:text-gray-300">Vue.js</span>
        </div>
        
        <!-- Next.js -->
        <div class="flex items-center space-x-2 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <div class="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
            <span class="text-white dark:text-black font-bold text-sm">N</span>
          </div>
          <span class="font-medium text-gray-700 dark:text-gray-300">Next.js</span>
        </div>
        
        <!-- Nuxt -->
        <div class="flex items-center space-x-2 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <div class="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <span class="text-white font-bold text-sm">N</span>
          </div>
          <span class="font-medium text-gray-700 dark:text-gray-300">Nuxt.js</span>
        </div>
        
        <!-- Svelte -->
        <div class="flex items-center space-x-2 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <div class="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <span class="text-white font-bold text-sm">S</span>
          </div>
          <span class="font-medium text-gray-700 dark:text-gray-300">Svelte</span>
        </div>
        
        <!-- Astro -->
        <div class="flex items-center space-x-2 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <div class="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
            <span class="text-white font-bold text-sm">A</span>
          </div>
          <span class="font-medium text-gray-700 dark:text-gray-300">Astro</span>
        </div>
      </div>
    </div>
  </div>
</template>
