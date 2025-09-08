<script setup>
import { onMounted } from "vue";
import { RouterView } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useNotificationsStore } from "@/stores/notifications";
import Navbar from "@/components/Navbar.vue";
import NotificationContainer from "@/components/NotificationContainer.vue";

// Stores
const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();

// Initialisation de l'app
onMounted(async () => {
  try {
    // Vérifier l'état d'authentification
    await authStore.checkAuth();

    // Message de bienvenue si connecté
    if (authStore.isAuthenticated) {
      notificationsStore.info(`Bienvenue ${authStore.user.username} ! 👋`, {
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
</script>

<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <!-- Navigation -->
    <Navbar />

    <!-- Contenu principal -->
    <main class="flex-1 my-10">
      <RouterView />
    </main>

    <!-- Container des notifications -->
    <NotificationContainer />

    <!-- Loading global optionnel -->
    <div
      v-if="authStore.loading"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg p-6 flex items-center space-x-4">
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"
        ></div>
        <span class="text-gray-700 font-medium">Chargement...</span>
      </div>
    </div>
  </div>
</template>

<style>
/* Styles globaux pour l'application */
#app {
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    Oxygen, Ubuntu, Cantarell, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Scrollbar personnalisée */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Animation globale pour les transitions de page */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.3s ease;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
}

/* Classes utilitaires personnalisées */
.glass-effect {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.loading-spinner {
  @apply animate-spin rounded-full border-b-2 border-primary-600;
}

/* Focus personnalisé pour l'accessibilité */
.focus-ring {
  @apply focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500;
}
</style>
