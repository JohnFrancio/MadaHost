<script setup>
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
</script>

<template>
  <div class="text-center">
    <!-- Hero Section -->
    <div class="max-w-4xl mx-auto mb-16">
      <h1 class="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
        Déployez vos sites web
        <span class="text-primary-600">en un clic</span>
      </h1>
      <p class="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
        Une plateforme simple et rapide pour héberger et déployer vos projets
        React, Vue.js et autres sites statiques directement depuis GitHub.
      </p>

      <div class="flex justify-center space-x-4">
        <router-link
          v-if="!authStore.isAuthenticated"
          to="/login"
          class="btn-primary text-lg px-8 py-3"
        >
          Commencer gratuitement
        </router-link>
        <router-link
          v-else
          to="/dashboard"
          class="btn-primary text-lg px-8 py-3"
        >
          Aller au Dashboard
        </router-link>
        <a
          href="https://github.com"
          class="btn-secondary text-lg px-8 py-3"
          target="_blank"
        >
          Voir le code
        </a>
      </div>
    </div>

    <!-- Features -->
    <div class="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
      <div class="card text-center">
        <div
          class="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-6 h-6 text-primary-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            ></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold mb-2">Déploiement rapide</h3>
        <p class="text-gray-600">
          Connectez votre repo GitHub et déployez en quelques secondes
        </p>
      </div>

      <div class="card text-center">
        <div
          class="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-6 h-6 text-primary-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold mb-2">Build automatisé</h3>
        <p class="text-gray-600">
          Support React, Vue.js, Next.js avec détection automatique
        </p>
      </div>

      <div class="card text-center">
        <div
          class="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-6 h-6 text-primary-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            ></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold mb-2">SSL gratuit</h3>
        <p class="text-gray-600">
          Certificats SSL automatiques avec Let's Encrypt
        </p>
      </div>
    </div>
  </div>
</template>
