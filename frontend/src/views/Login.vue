<script setup>
import { useAuthStore } from "@/stores/auth";
import { onMounted } from "vue";
import { useRouter } from "vue-router";

const authStore = useAuthStore();
const router = useRouter();

onMounted(() => {
  // Si déjà connecté, rediriger vers le dashboard
  if (authStore.isAuthenticated) {
    router.push("/dashboard");
  }
});
</script>

<template>
  <div class="max-w-md mx-auto animate-fade-in-scale">
    <div class="card text-center hover-lift">
      <!-- Illustration/Logo -->
      <div
        class="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
      >
        <span class="text-white font-bold text-2xl">M</span>
      </div>

      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-3">
        Bienvenue sur MadaHost
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mb-8 text-lg">
        Connectez-vous avec GitHub pour déployer vos projets en quelques clics
      </p>

      <!-- Avantages -->
      <div class="grid grid-cols-1 gap-3 mb-8 text-left">
        <div class="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div class="w-2 h-2 bg-green-500 rounded-full"></div>
          <span class="text-sm text-gray-700 dark:text-gray-300">Déploiement automatique</span>
        </div>
        <div class="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span class="text-sm text-gray-700 dark:text-gray-300">SSL gratuit inclus</span>
        </div>
        <div class="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div class="w-2 h-2 bg-purple-500 rounded-full"></div>
          <span class="text-sm text-gray-700 dark:text-gray-300">Support multi-framework</span>
        </div>
      </div>

      <button
        @click="authStore.loginWithGitHub"
        :disabled="authStore.loading"
        class="w-full bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center space-x-3 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none group"
      >
        <div v-if="authStore.loading" class="loading-spinner w-5 h-5"></div>
        <svg v-else class="w-6 h-6 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clip-rule="evenodd"></path>
        </svg>
        <span class="text-lg">{{ authStore.loading ? 'Connexion...' : 'Continuer avec GitHub' }}</span>
      </button>

      <!-- Footer -->
      <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          En vous connectant, vous acceptez nos 
          <a href="#" class="link-primary">conditions d'utilisation</a> et notre 
          <a href="#" class="link-primary">politique de confidentialité</a>.
      </p>
        
        <div class="mt-4 flex items-center justify-center space-x-4 text-xs text-gray-400 dark:text-gray-500">
          <span>🔒 Connexion sécurisée</span>
          <span>•</span>
          <span>⚡ Déploiement instantané</span>
          <span>•</span>
          <span>🌍 CDN mondial</span>
        </div>
      </div>
    </div>
  </div>
</template>
