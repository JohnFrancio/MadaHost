<!-- frontend/src/components/ProjectPreview.vue -->

<script setup>
import { ref, computed, onMounted, nextTick } from "vue";
import {
  ArrowPathIcon,
  LinkIcon,
  GlobeAltIcon,
  ExclamationCircleIcon,
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
// URL du site déployé
const siteUrl = computed(() => {
  if (import.meta.env.DEV) {
    // En développement, utiliser le serveur statique local
    return `http://localhost:3002/project/${props.project.id}/`;
  } else {
    // En production, utiliser le domaine
    return `https://${props.project.domain}/`;
  }
});

// Méthodes
const onPreviewLoad = () => {
  previewLoading.value = false;
  previewError.value = false;
};

const onPreviewError = () => {
  previewLoading.value = false;
  previewError.value = true;
};

const refreshPreview = async () => {
  refreshing.value = true;
  previewLoading.value = true;
  previewError.value = false;

  // Attendre un peu pour l'effet visuel
  setTimeout(() => {
    if (previewFrame.value) {
      previewFrame.value.src = previewFrame.value.src + "?t=" + Date.now();
    }
    refreshing.value = false;
  }, 500);
};

const openSite = () => {
  if (props.project.status === "active") {
    window.open(siteUrl.value, "_blank");
  }
};

const getStatusClass = (status) => {
  const classes = {
    active: "bg-green-100 text-green-800",
    building: "bg-yellow-100 text-yellow-800",
    error: "bg-red-100 text-red-800",
    inactive: "bg-gray-100 text-gray-800",
    created: "bg-gray-100 text-gray-800",
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
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now - date) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    return "Il y a moins d'une heure";
  } else if (diffInHours < 24) {
    return `Il y a ${Math.floor(diffInHours)} heure${
      Math.floor(diffInHours) > 1 ? "s" : ""
    }`;
  } else if (diffInHours < 168) {
    return `Il y a ${Math.floor(diffInHours / 24)} jour${
      Math.floor(diffInHours / 24) > 1 ? "s" : ""
    }`;
  } else {
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
};

// Lifecycle
onMounted(async () => {
  if (props.project.status === "active") {
    // Démarrer le chargement après un petit délai
    await nextTick();
    setTimeout(() => {
      previewLoading.value = true;
    }, 100);
  } else {
    previewLoading.value = false;
  }
});
</script>

<template>
  <div
    class="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200"
  >
    <div class="flex items-center justify-between mb-3">
      <h4 class="text-md font-medium text-gray-900">Aperçu du site</h4>
      <div class="flex items-center space-x-2">
        <button
          @click="refreshPreview"
          :disabled="refreshing"
          class="text-gray-400 hover:text-gray-600 p-1 rounded"
          title="Actualiser l'aperçu"
        >
          <ArrowPathIcon :class="['w-4 h-4', refreshing && 'animate-spin']" />
        </button>
        <a
          v-if="project.status === 'active'"
          :href="siteUrl"
          target="_blank"
          class="text-blue-600 hover:text-blue-800 p-1 rounded"
          title="Ouvrir le site"
        >
          <LinkIcon class="w-4 h-4" />
        </a>
      </div>
    </div>

    <!-- Aperçu du site -->
    <div class="relative group cursor-pointer" @click="openSite">
      <div
        v-if="project.status !== 'active'"
        class="aspect-video bg-gray-100 rounded-lg flex items-center justify-center"
      >
        <div class="text-center">
          <GlobeAltIcon class="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p class="text-sm text-gray-500">Site non déployé</p>
          <p class="text-xs text-gray-400">
            Lancez un déploiement pour voir l'aperçu
          </p>
        </div>
      </div>

      <div
        v-else
        class="aspect-video bg-gray-100 rounded-lg overflow-hidden relative"
      >
        <!-- Loading state -->
        <div
          v-if="previewLoading"
          class="absolute inset-0 flex items-center justify-center bg-gray-50"
        >
          <div class="text-center">
            <div
              class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"
            ></div>
            <p class="text-sm text-gray-600">Génération de l'aperçu...</p>
          </div>
        </div>

        <!-- Aperçu iframe (caché pendant le chargement) -->
        <iframe
          v-show="!previewLoading && !previewError"
          ref="previewFrame"
          :src="siteUrl"
          class="w-full h-full border-0 rounded-lg scale-50 origin-top-left transform"
          style="width: 200%; height: 200%"
          @load="onPreviewLoad"
          @error="onPreviewError"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />

        <!-- Erreur de chargement -->
        <div
          v-if="previewError"
          class="absolute inset-0 flex items-center justify-center bg-red-50"
        >
          <div class="text-center">
            <ExclamationCircleIcon class="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p class="text-sm text-red-600">Impossible de charger l'aperçu</p>
            <button
              @click="refreshPreview"
              class="text-xs text-red-500 hover:text-red-700 mt-1"
            >
              Réessayer
            </button>
          </div>
        </div>

        <!-- Overlay pour le clic -->
        <div
          class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center"
        >
          <div
            class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white rounded-full p-3 shadow-lg"
          >
            <LinkIcon class="w-6 h-6 text-gray-700" />
          </div>
        </div>
      </div>
    </div>

    <!-- Informations -->
    <div class="mt-3 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600">URL:</span>
        <a
          v-if="project.status === 'active'"
          :href="siteUrl"
          target="_blank"
          class="text-sm text-blue-600 hover:text-blue-800 font-mono truncate max-w-48"
          :title="siteUrl"
        >
          {{ siteUrl }}
        </a>
        <span v-else class="text-sm text-gray-400">Non disponible</span>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600">Statut:</span>
        <span
          :class="getStatusClass(project.status)"
          class="px-2 py-1 rounded-full text-xs font-medium"
        >
          {{ getStatusText(project.status) }}
        </span>
      </div>

      <div
        v-if="project.last_deployed"
        class="flex items-center justify-between"
      >
        <span class="text-sm text-gray-600">Déployé:</span>
        <span class="text-sm text-gray-900">
          {{ formatDate(project.last_deployed) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Style pour masquer la scrollbar de l'iframe */
iframe {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* Internet Explorer 10+ */
}

iframe::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none; /* Chrome, Safari, Opera */
}
</style>
