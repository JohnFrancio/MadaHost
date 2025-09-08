<!-- frontend/src/components/DeploymentStatus.vue -->
<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  RocketLaunchIcon,
  ExternalLinkIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  ArrowPathIcon,
} from "@heroicons/vue/24/outline";
import axios from "axios";

const props = defineProps({
  project: {
    type: Object,
    required: true,
  },
  autoRefresh: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["deploymentUpdated", "siteOpened"]);

// État
const deployment = ref(null);
const showLogs = ref(false);
const isRetrying = ref(false);
const progress = ref(0);
const progressMessage = ref("");
let refreshInterval = null;

// Computed
const statusClasses = computed(() => {
  if (!deployment.value) return "bg-gray-100 text-gray-600";

  const classes = {
    pending: "bg-yellow-100 text-yellow-800",
    building: "bg-blue-100 text-blue-800",
    success: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };
  return classes[deployment.value.status] || "bg-gray-100 text-gray-600";
});

const statusIcon = computed(() => {
  if (!deployment.value) return ClockIcon;

  const icons = {
    pending: ClockIcon,
    building: RocketLaunchIcon,
    success: CheckCircleIcon,
    failed: XCircleIcon,
  };
  return icons[deployment.value.status] || ClockIcon;
});

const iconClasses = computed(() => {
  if (deployment.value?.status === "building") {
    return "animate-spin";
  }
  return "";
});

const statusText = computed(() => {
  if (!deployment.value) return "Aucun déploiement";

  const texts = {
    pending: "En attente",
    building: "En cours",
    success: "Déployé",
    failed: "Échoué",
  };
  return texts[deployment.value.status] || deployment.value.status;
});

// Méthodes
const loadLatestDeployment = async () => {
  try {
    const response = await axios.get(
      `/api/deployments/projects/${props.project.id}/deployments?limit=1`
    );

    if (response.data.length > 0) {
      deployment.value = response.data[0];
      emit("deploymentUpdated", deployment.value);
    }
  } catch (error) {
    console.error("Erreur chargement déploiement:", error);
  }
};

const retryDeployment = async () => {
  isRetrying.value = true;
  try {
    const response = await axios.post(
      `/api/projects/${props.project.id}/deploy`
    );

    if (response.data.success) {
      await loadLatestDeployment();
    }
  } catch (error) {
    console.error("Erreur relance déploiement:", error);
  } finally {
    isRetrying.value = false;
  }
};

const startFirstDeployment = async () => {
  await retryDeployment();
};

const openSite = () => {
  if (props.project.domain) {
    const url = `https://${props.project.domain}`;
    window.open(url, "_blank");
    emit("siteOpened", url);
  }
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getDuration = () => {
  if (!deployment.value?.started_at || !deployment.value?.completed_at)
    return "-";

  const start = new Date(deployment.value.started_at);
  const end = new Date(deployment.value.completed_at);
  const diffMs = end - start;

  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

const updateProgress = () => {
  if (!deployment.value || deployment.value.status !== "building") return;

  // Simulation de progression basée sur le temps
  const now = Date.now();
  const start = new Date(deployment.value.started_at).getTime();
  const elapsed = now - start;

  // Progression simulée (0-90% sur 2 minutes)
  const simulatedProgress = Math.min(90, (elapsed / 120000) * 90);
  progress.value = simulatedProgress;

  // Messages de progression
  if (progress.value < 10) {
    progressMessage.value = "Initialisation...";
  } else if (progress.value < 30) {
    progressMessage.value = "Clonage du repository...";
  } else if (progress.value < 60) {
    progressMessage.value = "Installation des dépendances...";
  } else if (progress.value < 85) {
    progressMessage.value = "Build en cours...";
  } else {
    progressMessage.value = "Finalisation...";
  }
};

// Watchers
watch(
  () => deployment.value?.status,
  (newStatus) => {
    if (newStatus === "building") {
      updateProgress();
    } else if (newStatus === "success") {
      progress.value = 100;
      progressMessage.value = "Déploiement terminé !";
    } else if (newStatus === "failed") {
      progress.value = 0;
      progressMessage.value = "Déploiement échoué";
    }
  }
);

// Lifecycle
onMounted(async () => {
  await loadLatestDeployment();

  // Auto-refresh si déploiement en cours
  if (props.autoRefresh) {
    refreshInterval = setInterval(async () => {
      if (
        deployment.value?.status === "building" ||
        deployment.value?.status === "pending"
      ) {
        await loadLatestDeployment();
        updateProgress();
      }
    }, 3000); // Rafraîchir toutes les 3 secondes
  }
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
    <!-- En-tête avec statut -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900">Dernier déploiement</h3>
      <div class="flex items-center space-x-2">
        <div
          :class="statusClasses"
          class="flex items-center px-3 py-1 rounded-full text-sm font-medium"
        >
          <component
            :is="statusIcon"
            class="w-4 h-4 mr-2"
            :class="iconClasses"
          />
          {{ statusText }}
        </div>
        <button
          v-if="deployment?.status === 'success'"
          @click="openSite"
          class="p-2 text-gray-400 hover:text-blue-600 transition-colors"
          title="Voir le site"
        >
          <ExternalLinkIcon class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Informations du déploiement -->
    <div v-if="deployment" class="space-y-3">
      <!-- Timeline -->
      <div class="text-sm text-gray-600">
        <div class="flex justify-between items-center">
          <span>Démarré:</span>
          <span>{{ formatDate(deployment.started_at) }}</span>
        </div>
        <div
          v-if="deployment.completed_at"
          class="flex justify-between items-center"
        >
          <span>Terminé:</span>
          <span>{{ formatDate(deployment.completed_at) }}</span>
        </div>
        <div
          v-if="deployment.completed_at"
          class="flex justify-between items-center"
        >
          <span>Durée:</span>
          <span>{{ getDuration() }}</span>
        </div>
      </div>

      <!-- Commit info -->
      <div
        v-if="deployment.commit_hash"
        class="flex items-center space-x-2 text-sm"
      >
        <CodeBracketIcon class="w-4 h-4 text-gray-400" />
        <span class="font-mono text-gray-600">{{
          deployment.commit_hash.substring(0, 8)
        }}</span>
        <a
          :href="`https://github.com/${project.github_repo}/commit/${deployment.commit_hash}`"
          target="_blank"
          class="text-blue-600 hover:text-blue-800"
        >
          Voir le commit
        </a>
      </div>

      <!-- Actions -->
      <div class="flex space-x-2 pt-2 border-t border-gray-200">
        <button
          v-if="deployment.status === 'failed'"
          @click="retryDeployment"
          :disabled="isRetrying"
          class="flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <ArrowPathIcon
            class="w-4 h-4 mr-2"
            :class="{ 'animate-spin': isRetrying }"
          />
          {{ isRetrying ? "Relance..." : "Relancer" }}
        </button>

        <button
          @click="showLogs = !showLogs"
          class="flex items-center px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
        >
          <DocumentTextIcon class="w-4 h-4 mr-2" />
          {{ showLogs ? "Masquer" : "Voir" }} les logs
        </button>
      </div>

      <!-- Logs (collapsible) -->
      <transition name="slide-down">
        <div v-if="showLogs" class="mt-4">
          <div class="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto">
            <pre class="text-green-400 text-sm font-mono whitespace-pre-wrap">{{
              deployment.build_log || "Aucun log disponible..."
            }}</pre>
          </div>
        </div>
      </transition>

      <!-- Barre de progression pour les déploiements en cours -->
      <div
        v-if="
          deployment.status === 'building' || deployment.status === 'pending'
        "
        class="mt-4"
      >
        <div class="flex justify-between text-sm text-gray-600 mb-2">
          <span>{{ progressMessage }}</span>
          <span>{{ Math.round(progress) }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div
            class="bg-blue-600 h-2 rounded-full transition-all duration-300"
            :style="{ width: `${progress}%` }"
          ></div>
        </div>
      </div>
    </div>

    <!-- État vide -->
    <div v-else class="text-center py-8 text-gray-500">
      <RocketLaunchIcon class="w-8 h-8 mx-auto mb-2" />
      <p>Aucun déploiement pour ce projet</p>
      <button
        @click="startFirstDeployment"
        class="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
      >
        Déployer maintenant
      </button>
    </div>
  </div>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  max-height: 300px;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
