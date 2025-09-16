<script setup>
import { onMounted, watch } from "vue";
import { RouterView } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";
import { useNotificationsStore } from "@/stores/notifications";
import Navbar from "@/components/Navbar.vue";
import NotificationContainer from "@/components/NotificationContainer.vue";

// Stores
const authStore = useAuthStore();
const themeStore = useThemeStore();
const notificationsStore = useNotificationsStore();

// Initialisation de l'app
onMounted(async () => {
  // Initialiser le thème
  themeStore.init();
  
  try {
    // Vérifier l'état d'authentification
    await authStore.checkAuth();

    // Message de bienvenue si connecté
    if (authStore.isAuthenticated) {
      notificationsStore.success(`Bienvenue ${authStore.user.username} ! 👋`, {
        title: "🎉 Connexion réussie",
        duration: 3000,
      });
    }
  } catch (error) {
    console.error("Erreur initialisation app:", error);

    // Notification d'erreur si problème de connexion
    notificationsStore.error(
      "Problème de connexion au serveur. Vérifiez votre connexion internet.",
      {
        title: "🔌 Erreur de connexion",
        autoClose: false,
      }
    );
  }
});

// Gestion des erreurs globales
window.addEventListener("unhandledrejection", (event) => {
  console.error("Erreur non gérée:", event.reason);

  // Notification pour les erreurs API
  if (event.reason?.response?.status === 401) {
    notificationsStore.githubConnectionError();
  } else if (event.reason?.response?.status >= 500) {
    notificationsStore.error(
      "Une erreur serveur s'est produite. Réessayez dans quelques instants.",
      { title: "🔧 Erreur serveur" }
    );
  }

  // Empêcher l'affichage de l'erreur dans la console pour les erreurs gérées
  event.preventDefault();
});

// Appliquer le thème au changement
watch(() => themeStore.isDark, (isDark) => {
  document.documentElement.classList.toggle('dark', isDark);
}, { immediate: true });
</script>

<template>
  <div id="app" class="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
    <!-- Navigation -->
    <Navbar />

    <!-- Contenu principal -->
    <main class="flex-1">
      <div class="content-container section-padding">
        <transition
          name="page"
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 transform translate-y-4"
          enter-to-class="opacity-100 transform translate-y-0"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 transform translate-y-0"
          leave-to-class="opacity-0 transform translate-y-4"
          mode="out-in"
        >
          <RouterView />
        </transition>
      </div>
    </main>

    <!-- Container des notifications -->
    <NotificationContainer />

    <!-- Loading global amélioré -->
    <div
      v-if="authStore.loading"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <div class="bg-white dark:bg-gray-900 rounded-2xl p-8 flex items-center space-x-4 shadow-2xl border border-gray-200 dark:border-gray-800">
        <div
          class="loading-spinner h-8 w-8"
        ></div>
        <span class="text-gray-700 dark:text-gray-300 font-medium">Chargement...</span>
      </div>
    </div>

    <!-- Indicateur de connexion réseau -->
    <div
      v-if="!navigator.onLine"
      class="fixed bottom-4 left-4 right-4 bg-red-600 text-white p-4 rounded-xl shadow-lg z-40 text-center"
    >
      <div class="flex items-center justify-center space-x-2">
        <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        <span class="font-medium">Connexion internet perdue</span>
      </div>
    </div>
  </div>
</template>

<style>
/* Import de la police Inter */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

/* Variables CSS globales */
:root {
  --ease-out-cubic: cubic-bezier(0.33, 1, 0.68, 1);
  --ease-in-cubic: cubic-bezier(0.32, 0, 0.67, 0);
  --ease-in-out-cubic: cubic-bezier(0.65, 0, 0.35, 1);
}
</style>
