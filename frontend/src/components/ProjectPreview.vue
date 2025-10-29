<!-- frontend/src/components/ProjectPreview.vue - VERSION DOCKER -->

<script setup>
import { ref, computed, onMounted, nextTick } from "vue";
import {
  ArrowPathIcon,
  LinkIcon,
  GlobeAltIcon,
  ExclamationCircleIcon,
  PhotoIcon,
} from "@heroicons/vue/24/outline";

const props = defineProps({
  project: {
    type: Object,
    required: true,
  },
});

// État local
const previewLoading = ref(true);
const previewError = ref(false);
const refreshing = ref(false);
const previewFrame = ref(null);
const showScreenshot = ref(false);
const iframeBlocked = ref(false);

// Variable pour le mode développement
const isDev = import.meta.env.DEV;

// ✅ URL du site déployé (toujours via le domaine wildcard)
const siteUrl = computed(() => {
  if (!props.project.domain || props.project.status !== "active") {
    return null;
  }

  // En développement, peut pointer vers localhost si configuré
  if (isDev) {
    // Si tu testes en local avec /etc/hosts ou autre
    return `http://${props.project.domain}`;
  }

  // En production, toujours HTTPS
  return `https://${props.project.domain}`;
});

// ✅ URL pour l'iframe (même URL, Nginx gère les headers)
const previewUrl = computed(() => {
  return siteUrl.value;
});

// Méthodes
const onPreviewLoad = () => {
  console.log("✅ Aperçu chargé avec succès");
  previewLoading.value = false;
  previewError.value = false;
  iframeBlocked.value = false;
};

const onPreviewError = (event) => {
  console.error("❌ Erreur chargement iframe:", event);
  previewLoading.value = false;
  previewError.value = true;

  // Détecter si c'est un problème de X-Frame-Options
  if (event.type === "error" && previewFrame.value) {
    iframeBlocked.value = true;
  }
};

const refreshPreview = async () => {
  if (!siteUrl.value) return;

  refreshing.value = true;
  previewLoading.value = true;
  previewError.value = false;
  iframeBlocked.value = false;
  showScreenshot.value = false;

  // Attendre un peu pour l'effet visuel
  setTimeout(() => {
    if (previewFrame.value && siteUrl.value) {
      // Ajouter un timestamp pour éviter le cache
      const url = new URL(siteUrl.value);
      url.searchParams.set("t", Date.now().toString());
      previewFrame.value.src = url.toString();
    }
    refreshing.value = false;
  }, 500);
};

const openSite = () => {
  if (props.project.status === "active" && siteUrl.value) {
    window.open(siteUrl.value, "_blank");
  }
};

const tryScreenshot = async () => {
  showScreenshot.value = true;
  // TODO: Implémenter une API de screenshot si nécessaire
  // Par exemple: https://api.screenshotmachine.com ou https://htmlcsstoimage.com
};

const getStatusClass = (status) => {
  const classes = {
    active:
      "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
    building:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
    error: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
    inactive: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
    created: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
  };
  return classes[status] || "bg-gray-100 text-gray-800";
};

const getStatusText = (status) => {
  const texts = {
    active: "En ligne",
    building: "Construction",
    error: "Erreur",
    inactive: "Inactif",
    created: "Créé",
  };
  return texts[status] || status;
};

const formatDate = (dateString) => {
  if (!dateString) return "Jamais";

  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now - date) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    return "Il y a moins d'une heure";
  } else if (diffInHours < 24) {
    const hours = Math.floor(diffInHours);
    return `Il y a ${hours} heure${hours > 1 ? "s" : ""}`;
  } else if (diffInHours < 168) {
    const days = Math.floor(diffInHours / 24);
    return `Il y a ${days} jour${days > 1 ? "s" : ""}`;
  } else {
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
};

// Détecter si l'iframe est bloquée après quelques secondes
const checkIframeLoad = () => {
  if (previewFrame.value && previewLoading.value) {
    setTimeout(() => {
      if (previewLoading.value) {
        console.warn("⚠️ Iframe semble bloquée, basculement vers alternative");
        iframeBlocked.value = true;
        previewError.value = true;
        previewLoading.value = false;
      }
    }, 8000); // 8 secondes de timeout
  }
};

// Lifecycle
onMounted(async () => {
  if (props.project.status === "active" && props.project.domain) {
    await nextTick();
    setTimeout(() => {
      previewLoading.value = true;
      checkIframeLoad();
    }, 100);
  } else {
    previewLoading.value = false;
  }
});
</script>

<template>
  <div
    class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:shadow-md transition-all duration-200"
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-3">
      <h4 class="text-md font-medium text-gray-900 dark:text-white">
        Aperçu du site
      </h4>
      <div class="flex items-center space-x-2">
        <!-- Refresh button -->
        <button
          v-if="project.status === 'active' && siteUrl"
          @click="refreshPreview"
          :disabled="refreshing"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded transition-colors"
          title="Actualiser l'aperçu"
        >
          <ArrowPathIcon :class="['w-4 h-4', refreshing && 'animate-spin']" />
        </button>

        <!-- Screenshot fallback button -->
        <button
          v-if="iframeBlocked && project.status === 'active'"
          @click="tryScreenshot"
          class="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 p-1 rounded"
          title="Essayer un screenshot"
        >
          <PhotoIcon class="w-4 h-4" />
        </button>

        <!-- Open in new tab -->
        <a
          v-if="project.status === 'active' && siteUrl"
          :href="siteUrl"
          target="_blank"
          class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded"
          title="Ouvrir le site"
        >
          <LinkIcon class="w-4 h-4" />
        </a>
      </div>
    </div>

    <!-- Preview Area -->
    <div class="relative group cursor-pointer" @click="openSite">
      <!-- Projet non déployé -->
      <div
        v-if="project.status !== 'active' || !project.domain"
        class="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center"
      >
        <div class="text-center">
          <GlobeAltIcon
            class="w-8 h-8 text-gray-400 dark:text-gray-600 mx-auto mb-2"
          />
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Site non déployé
          </p>
          <p class="text-xs text-gray-400 dark:text-gray-500">
            Lancez un déploiement pour voir l'aperçu
          </p>
        </div>
      </div>

      <!-- Aperçu du site déployé -->
      <div
        v-else
        class="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden relative"
      >
        <!-- Loading state -->
        <div
          v-if="previewLoading && !iframeBlocked"
          class="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800"
        >
          <div class="text-center">
            <div
              class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-2"
            ></div>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Génération de l'aperçu...
            </p>
          </div>
        </div>

        <!-- Iframe preview -->
        <iframe
          v-show="!previewLoading && !previewError && !iframeBlocked"
          ref="previewFrame"
          :src="previewUrl"
          class="w-full h-full border-0 rounded-lg scale-50 origin-top-left transform"
          style="width: 200%; height: 200%"
          @load="onPreviewLoad"
          @error="onPreviewError"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          loading="lazy"
          title="Aperçu du site"
        />

        <!-- Error state -->
        <div
          v-if="previewError && !showScreenshot"
          class="absolute inset-0 flex items-center justify-center bg-red-50 dark:bg-red-900/20"
        >
          <div class="text-center p-4">
            <ExclamationCircleIcon
              class="w-8 h-8 text-red-500 dark:text-red-400 mx-auto mb-2"
            />
            <p class="text-sm text-red-600 dark:text-red-400 mb-2">
              {{
                iframeBlocked
                  ? "Aperçu bloqué par sécurité"
                  : "Impossible de charger l'aperçu"
              }}
            </p>

            <div class="space-y-2">
              <button
                @click.stop="refreshPreview"
                class="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 block mx-auto"
              >
                Réessayer
              </button>

              <button
                v-if="iframeBlocked"
                @click.stop="tryScreenshot"
                class="text-xs text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 block mx-auto"
              >
                Essayer un screenshot
              </button>

              <a
                :href="siteUrl"
                target="_blank"
                @click.stop
                class="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 block mx-auto"
              >
                Ouvrir dans un nouvel onglet →
              </a>
            </div>
          </div>
        </div>

        <!-- Screenshot mode -->
        <div
          v-if="showScreenshot"
          class="absolute inset-0 flex items-center justify-center bg-purple-50 dark:bg-purple-900/20"
        >
          <div class="text-center p-4">
            <PhotoIcon
              class="w-8 h-8 text-purple-500 dark:text-purple-400 mx-auto mb-2"
            />
            <p class="text-sm text-purple-600 dark:text-purple-400 mb-2">
              Mode screenshot
            </p>
            <p class="text-xs text-purple-400 dark:text-purple-500">
              Fonctionnalité en développement
            </p>
            <a
              :href="siteUrl"
              target="_blank"
              @click.stop
              class="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 block mx-auto mt-2"
            >
              Ouvrir dans un nouvel onglet →
            </a>
          </div>
        </div>

        <!-- Hover overlay -->
        <div
          v-if="!previewError && !previewLoading"
          class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center pointer-events-none"
        >
          <div
            class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white dark:bg-gray-800 rounded-full p-3 shadow-lg"
          >
            <LinkIcon class="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </div>
        </div>
      </div>
    </div>

    <!-- Informations -->
    <div class="mt-3 space-y-2">
      <!-- URL -->
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600 dark:text-gray-400">URL:</span>
        <a
          v-if="project.status === 'active' && siteUrl"
          :href="siteUrl"
          target="_blank"
          class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-mono truncate max-w-48"
          :title="project.domain"
          @click.stop
        >
          {{ project.domain }}
        </a>
        <span v-else class="text-sm text-gray-400 dark:text-gray-500">
          Non disponible
        </span>
      </div>

      <!-- Statut -->
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600 dark:text-gray-400">Statut:</span>
        <span
          :class="getStatusClass(project.status)"
          class="px-2 py-1 rounded-full text-xs font-medium"
        >
          {{ getStatusText(project.status) }}
        </span>
      </div>

      <!-- Date de déploiement -->
      <div
        v-if="project.last_deployed"
        class="flex items-center justify-between"
      >
        <span class="text-sm text-gray-600 dark:text-gray-400">Déployé:</span>
        <span class="text-sm text-gray-900 dark:text-gray-100">
          {{ formatDate(project.last_deployed) }}
        </span>
      </div>

      <!-- Debug info (mode dev uniquement) -->
      <div
        v-if="isDev"
        class="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs space-y-1"
      >
        <p class="text-blue-700 dark:text-blue-400 font-bold">🔧 Debug Mode</p>
        <p class="text-blue-600 dark:text-blue-300 font-mono text-[10px]">
          URL: {{ siteUrl || "N/A" }}
        </p>
        <p class="text-blue-600 dark:text-blue-300">
          Domain: {{ project.domain || "N/A" }}
        </p>
        <p class="text-blue-600 dark:text-blue-300">
          Status: {{ project.status }}
        </p>
        <p v-if="iframeBlocked" class="text-red-600 dark:text-red-400">
          ⚠️ Iframe bloquée - Vérifiez X-Frame-Options dans Nginx
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Masquer scrollbar iframe */
iframe {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

iframe::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

/* Animation bounce pour erreurs */
@keyframes bounce {
  0%,
  20%,
  50%,
  80%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-5px);
  }
  60% {
    transform: translateY(-3px);
  }
}

.error-bounce {
  animation: bounce 0.5s ease-in-out;
}

/* Transition hover */
.preview-container {
  transition: transform 0.2s ease-in-out;
}

.preview-container:hover {
  transform: scale(1.02);
}
</style>
