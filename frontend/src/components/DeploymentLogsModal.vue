<!-- frontend/src/components/DeploymentLogsModal.vue -->
<template>
  <TransitionRoot :show="isOpen" as="template">
    <Dialog as="div" class="relative z-50" @close="close">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black bg-opacity-50" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="ease-out duration-300"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel
              class="w-full max-w-6xl max-h-[90vh] transform overflow-y-auto rounded-xl bg-white shadow-xl transition-all flex flex-col"
            >
              <!-- Header -->
              <div
                class="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-gray-900 to-gray-700 text-white"
              >
                <div>
                  <DialogTitle class="text-xl font-semibold flex items-center">
                    <DocumentTextIcon class="w-6 h-6 text-green-400 mr-2" />
                    Logs de déploiement
                  </DialogTitle>
                  <p class="mt-1 text-sm text-gray-300">
                    {{
                      deployment?.id
                        ? `Déploiement #${deployment.id.split("-")[0]}`
                        : "Chargement..."
                    }}
                    <span v-if="deployment?.started_at" class="ml-2">
                      • {{ formatDate(deployment.started_at) }}
                    </span>
                  </p>
                </div>
                <div class="flex items-center space-x-3">
                  <!-- Status -->
                  <div v-if="deployment" class="flex items-center space-x-2">
                    <div :class="getStatusIndicator(deployment.status)"></div>
                    <span
                      :class="getStatusClass(deployment.status)"
                      class="text-sm font-medium px-2 py-1 rounded"
                    >
                      {{ getStatusText(deployment.status) }}
                    </span>
                  </div>

                  <!-- Actions -->
                  <div class="flex space-x-2">
                    <button
                      @click="toggleAutoScroll"
                      :class="[
                        'p-2 rounded-md transition-colors',
                        autoScroll
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-gray-600 hover:bg-gray-700 text-gray-300',
                      ]"
                      title="Auto-scroll"
                    >
                      <ArrowDownIcon class="w-4 h-4" />
                    </button>

                    <button
                      @click="refreshLogs"
                      :disabled="loading"
                      class="p-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                      title="Actualiser"
                    >
                      <ArrowPathIcon
                        :class="['w-4 h-4', loading && 'animate-spin']"
                      />
                    </button>

                    <button
                      @click="downloadLogs"
                      class="p-2 rounded-md bg-gray-600 hover:bg-gray-700 text-white transition-colors"
                      title="Télécharger les logs"
                    >
                      <ArrowDownTrayIcon class="w-4 h-4" />
                    </button>

                    <button
                      @click="close"
                      class="p-2 rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
                    >
                      <XMarkIcon class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Tabs pour les différents types de logs -->
              <div class="border-b border-gray-200 bg-gray-50">
                <nav class="flex space-x-8 px-6">
                  <button
                    v-for="tab in logTabs"
                    :key="tab.key"
                    @click="activeTab = tab.key"
                    :class="[
                      'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                      activeTab === tab.key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                    ]"
                  >
                    <component :is="tab.icon" class="w-4 h-4 inline mr-2" />
                    {{ tab.name }}
                    <span
                      v-if="tab.badge"
                      :class="[
                        'ml-2 px-2 py-1 rounded-full text-xs',
                        tab.badgeClass || 'bg-gray-100 text-gray-900',
                      ]"
                    >
                      {{ tab.badge }}
                    </span>
                  </button>
                </nav>
              </div>

              <!-- Loading -->
              <div
                v-if="loading && !logs"
                class="flex-1 flex items-center justify-center py-12"
              >
                <div class="text-center">
                  <div
                    class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"
                  ></div>
                  <p class="text-gray-600">Chargement des logs...</p>
                </div>
              </div>

              <!-- Contenu des logs -->
              <div v-else class="flex-1 flex flex-col overflow-hidden">
                <!-- Informations du déploiement -->
                <div
                  v-if="deployment"
                  class="px-6 py-3 bg-gray-50 border-b border-gray-200"
                >
                  <div class="flex items-center justify-between text-sm">
                    <div class="flex items-center space-x-6">
                      <div>
                        <span class="text-gray-600">Commit:</span>
                        <span class="font-mono text-gray-900 ml-2">
                          {{ deployment.commit_hash?.substring(0, 8) || "N/A" }}
                        </span>
                      </div>

                      <div>
                        <span class="text-gray-600">Durée:</span>
                        <span class="text-gray-900 ml-2">
                          {{
                            getDuration(
                              deployment.started_at,
                              deployment.completed_at
                            )
                          }}
                        </span>
                      </div>

                      <div v-if="deployment.completed_at">
                        <span class="text-gray-600">Terminé:</span>
                        <span class="text-gray-900 ml-2">
                          {{ formatTime(deployment.completed_at) }}
                        </span>
                      </div>
                    </div>

                    <!-- Progress bar pour les déploiements en cours -->
                    <div
                      v-if="isDeploymentActive(deployment.status)"
                      class="flex items-center space-x-2"
                    >
                      <div class="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          class="bg-blue-600 h-2 rounded-full transition-all duration-500"
                          :style="{
                            width:
                              getProgressPercentage(deployment.status) + '%',
                          }"
                        ></div>
                      </div>
                      <span class="text-xs text-gray-600"
                        >{{ getProgressPercentage(deployment.status) }}%</span
                      >
                    </div>
                  </div>
                </div>

                <!-- Container des logs -->
                <div class="flex-1 h-full overflow-auto">
                  <!-- Tab: Build Logs -->
                  <div
                    v-if="activeTab === 'build'"
                    class="h-full flex flex-col"
                  >
                    <div class="flex-1 h-full overflow-auto">
                      <div
                        ref="buildLogsContainer"
                        class="h-full overflow-y-auto bg-gray-900 text-green-400 font-mono text-sm p-4 logs-container"
                        @scroll="handleScroll"
                      >
                        <!-- Placeholder si pas de logs -->
                        <div
                          v-if="!logs.build || logs.build.length === 0"
                          class="text-center py-12 text-gray-500"
                        >
                          <DocumentTextIcon
                            class="w-12 h-12 mx-auto mb-4 opacity-50"
                          />
                          <p>
                            {{
                              isDeploymentActive(deployment?.status)
                                ? "En attente des logs de build..."
                                : "Aucun log de build disponible"
                            }}
                          </p>
                        </div>

                        <!-- Logs de build -->
                        <div v-else>
                          <div class="mb-4 text-blue-400">
                            === LOGS DE BUILD ===
                          </div>

                          <pre
                            v-for="(line, index) in buildLogLines"
                            :key="`build-${index}`"
                            class="mb-1 whitespace-pre-wrap"
                            :class="getLogLineClass(line)"
                            >{{ line }}</pre
                          >

                          <!-- Indicateur de logs en cours -->
                          <div
                            v-if="isDeploymentActive(deployment?.status)"
                            class="flex items-center text-yellow-400 mt-4"
                          >
                            <div class="animate-pulse mr-2">●</div>
                            <span>Build en cours...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Tab: Deploy Logs -->
                  <div
                    v-else-if="activeTab === 'deploy'"
                    class="h-full flex flex-col"
                  >
                    <div class="flex-1 overflow-hidden">
                      <div
                        ref="deployLogsContainer"
                        class="h-full overflow-y-auto bg-gray-900 text-green-400 font-mono text-sm p-4 logs-container"
                        @scroll="handleScroll"
                      >
                        <!-- Placeholder si pas de logs -->
                        <div
                          v-if="!logs.deploy || logs.deploy.length === 0"
                          class="text-center py-12 text-gray-500"
                        >
                          <RocketLaunchIcon
                            class="w-12 h-12 mx-auto mb-4 opacity-50"
                          />
                          <p>
                            {{
                              deployment?.status === "deploying"
                                ? "En attente des logs de déploiement..."
                                : "Aucun log de déploiement disponible"
                            }}
                          </p>
                        </div>

                        <!-- Logs de déploiement -->
                        <div v-else>
                          <div class="mb-4 text-purple-400">
                            === LOGS DE DÉPLOIEMENT ===
                          </div>

                          <pre
                            v-for="(line, index) in deployLogLines"
                            :key="`deploy-${index}`"
                            class="mb-1 whitespace-pre-wrap"
                            :class="getLogLineClass(line)"
                            >{{ line }}</pre
                          >

                          <!-- Indicateur de déploiement en cours -->
                          <div
                            v-if="deployment?.status === 'deploying'"
                            class="flex items-center text-yellow-400 mt-4"
                          >
                            <div class="animate-pulse mr-2">●</div>
                            <span>Déploiement en cours...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Tab: Tous les logs -->
                  <div
                    v-else-if="activeTab === 'all'"
                    class="h-full flex flex-col"
                  >
                    <div class="flex-1 overflow-hidden">
                      <div
                        ref="allLogsContainer"
                        class="h-full overflow-y-auto bg-gray-900 text-green-400 font-mono text-sm p-4 logs-container"
                        @scroll="handleScroll"
                      >
                        <!-- Logs combinés -->
                        <div v-if="allLogLines.length > 0">
                          <div class="mb-4 text-cyan-400">
                            === LOGS COMPLETS ===
                          </div>

                          <pre
                            v-for="(line, index) in allLogLines"
                            :key="`all-${index}`"
                            class="mb-1 whitespace-pre-wrap"
                            :class="getLogLineClass(line.content)"
                          ><span class="text-gray-500 mr-2">[{{ line.timestamp }}]</span><span class="text-blue-400 mr-2">[{{ line.type }}]</span>{{ line.content }}</pre>

                          <!-- Indicateur temps réel -->
                          <div
                            v-if="isDeploymentActive(deployment?.status)"
                            class="flex items-center text-yellow-400 mt-4"
                          >
                            <div class="animate-pulse mr-2">●</div>
                            <span>Streaming en temps réel...</span>
                          </div>
                        </div>

                        <!-- Placeholder -->
                        <div v-else class="text-center py-12 text-gray-500">
                          <CommandLineIcon
                            class="w-12 h-12 mx-auto mb-4 opacity-50"
                          />
                          <p>Aucun log disponible</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Tab: Erreurs -->
                  <div
                    v-else-if="activeTab === 'errors'"
                    class="h-full flex flex-col"
                  >
                    <div class="flex-1 overflow-hidden">
                      <div
                        class="h-full overflow-y-auto bg-red-950 text-red-300 font-mono text-sm p-4 logs-container"
                      >
                        <!-- Erreurs -->
                        <div v-if="errorLines.length > 0">
                          <div class="mb-4 text-red-400">
                            === ERREURS ET AVERTISSEMENTS ===
                          </div>

                          <pre
                            v-for="(error, index) in errorLines"
                            :key="`error-${index}`"
                            class="mb-2 whitespace-pre-wrap p-2 bg-red-900/30 rounded border border-red-800"
                            >{{ error }}</pre
                          >
                        </div>

                        <!-- Aucune erreur -->
                        <div v-else class="text-center py-12 text-red-400">
                          <CheckCircleIcon
                            class="w-12 h-12 mx-auto mb-4 opacity-50"
                          />
                          <p>
                            {{
                              deployment?.status === "success"
                                ? "Aucune erreur détectée ✓"
                                : "Aucune erreur pour le moment"
                            }}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Barre d'outils en bas -->
                <div
                  class="border-t border-gray-200 p-4 bg-gray-50 flex items-center justify-between"
                >
                  <div
                    class="flex items-center space-x-4 text-sm text-gray-600"
                  >
                    <div class="flex items-center">
                      <div class="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                      <span>{{ totalLines }} lignes</span>
                    </div>

                    <div class="flex items-center">
                      <ClockIcon class="w-4 h-4 mr-1" />
                      <span
                        >Mis à jour
                        {{
                          lastUpdated ? formatTime(lastUpdated) : "jamais"
                        }}</span
                      >
                    </div>

                    <div
                      v-if="errorLines.length > 0"
                      class="flex items-center text-red-600"
                    >
                      <ExclamationTriangleIcon class="w-4 h-4 mr-1" />
                      <span>{{ errorLines.length }} erreur(s)</span>
                    </div>
                  </div>

                  <div class="flex items-center space-x-2">
                    <!-- Toggle temps réel -->
                    <label class="flex items-center text-sm">
                      <input
                        v-model="realTimeEnabled"
                        type="checkbox"
                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                        @change="toggleRealTime"
                      />
                      <span class="text-gray-700">Temps réel</span>
                    </label>

                    <!-- Bouton clear logs -->
                    <button
                      @click="clearLogsView"
                      class="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                    >
                      Effacer
                    </button>

                    <!-- Statistiques -->
                    <div
                      class="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded"
                    >
                      {{ getLogStats() }}
                    </div>
                  </div>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import {
  ref,
  reactive,
  computed,
  watch,
  onMounted,
  onUnmounted,
  nextTick,
} from "vue";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from "@headlessui/vue";
import {
  XMarkIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  ArrowDownIcon,
  ArrowDownTrayIcon,
  RocketLaunchIcon,
  CommandLineIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
} from "@heroicons/vue/24/outline";
import { useNotificationsStore } from "@/stores/notifications";
import axios from "axios";

const emit = defineEmits(["close"]);
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  deploymentId: {
    type: String,
    default: null,
  },
});

const notifications = useNotificationsStore();

// État local
const loading = ref(false);
const deployment = ref(null);
const logs = reactive({
  build: "",
  deploy: "",
});

const activeTab = ref("build");
const autoScroll = ref(true);
const realTimeEnabled = ref(true);
const lastUpdated = ref(null);

// Refs pour les containers de logs
const buildLogsContainer = ref(null);
const deployLogsContainer = ref(null);
const allLogsContainer = ref(null);

// Polling
let logsPollingInterval = null;

// Configuration des tabs
const logTabs = computed(() => {
  const buildLineCount = buildLogLines.value.length;
  const deployLineCount = deployLogLines.value.length;
  const errorCount = errorLines.value.length;

  return [
    {
      key: "build",
      name: "Build",
      icon: CommandLineIcon,
      badge: buildLineCount > 0 ? buildLineCount : null,
      badgeClass: buildLineCount > 0 ? "bg-blue-100 text-blue-800" : null,
    },
    {
      key: "deploy",
      name: "Deploy",
      icon: RocketLaunchIcon,
      badge: deployLineCount > 0 ? deployLineCount : null,
      badgeClass: deployLineCount > 0 ? "bg-green-100 text-green-800" : null,
    },
    {
      key: "all",
      name: "Tous",
      icon: DocumentTextIcon,
      badge: allLogLines.value.length > 0 ? allLogLines.value.length : null,
    },
    {
      key: "errors",
      name: "Erreurs",
      icon: ExclamationTriangleIcon,
      badge: errorCount > 0 ? errorCount : null,
      badgeClass: errorCount > 0 ? "bg-red-100 text-red-800" : null,
    },
  ];
});

// Computed pour les lignes de logs
const buildLogLines = computed(() => {
  return logs.build ? logs.build.split("\n").filter((line) => line.trim()) : [];
});

const deployLogLines = computed(() => {
  return logs.deploy
    ? logs.deploy.split("\n").filter((line) => line.trim())
    : [];
});

const allLogLines = computed(() => {
  const combined = [];

  if (logs.build) {
    logs.build.split("\n").forEach((line) => {
      if (line.trim()) {
        combined.push({
          content: line,
          type: "build",
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    });
  }

  if (logs.deploy) {
    logs.deploy.split("\n").forEach((line) => {
      if (line.trim()) {
        combined.push({
          content: line,
          type: "deploy",
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    });
  }

  return combined;
});

const errorLines = computed(() => {
  const errors = [];
  const allText = (logs.build + "\n" + logs.deploy).toLowerCase();

  // Chercher les lignes d'erreur
  [logs.build, logs.deploy].forEach((logText) => {
    if (logText) {
      logText.split("\n").forEach((line) => {
        const lowerLine = line.toLowerCase();
        if (
          lowerLine.includes("error") ||
          lowerLine.includes("failed") ||
          lowerLine.includes("warning") ||
          lowerLine.includes("exception") ||
          lowerLine.includes("❌")
        ) {
          errors.push(line.trim());
        }
      });
    }
  });

  return errors;
});

const totalLines = computed(() => {
  return buildLogLines.value.length + deployLogLines.value.length;
});

// API client
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  withCredentials: true,
});

// Méthodes
const close = () => {
  stopPolling();
  emit("close");
};

const loadDeployment = async () => {
  if (!props.deploymentId) return;

  try {
    loading.value = true;

    const response = await api.get(`/deployments/${props.deploymentId}`);

    if (response.data.success) {
      deployment.value = response.data.deployment;
    } else {
      throw new Error(response.data.error);
    }
  } catch (error) {
    console.error("Erreur chargement déploiement:", error);
    notifications.error("Impossible de charger le déploiement");
  } finally {
    loading.value = false;
  }
};

const loadLogs = async () => {
  if (!props.deploymentId) return;

  try {
    const response = await api.get(`/deployments/${props.deploymentId}/logs`);

    if (response.data.success) {
      const oldBuildLength = logs.build?.length || 0;
      const oldDeployLength = logs.deploy?.length || 0;

      logs.build = response.data.logs.build || "";
      logs.deploy = response.data.logs.deploy || "";

      lastUpdated.value = new Date().toISOString();

      // Auto-scroll si de nouveaux logs
      if (
        (logs.build?.length > oldBuildLength ||
          logs.deploy?.length > oldDeployLength) &&
        autoScroll.value
      ) {
        await nextTick();
        scrollToBottom();
      }
    }
  } catch (error) {
    console.error("Erreur chargement logs:", error);
  }
};

const refreshLogs = async () => {
  await Promise.all([loadDeployment(), loadLogs()]);
};

const startPolling = () => {
  if (logsPollingInterval) return;

  logsPollingInterval = setInterval(async () => {
    if (realTimeEnabled.value && isDeploymentActive(deployment.value?.status)) {
      await loadLogs();
    }
  }, 2000);
};

const stopPolling = () => {
  if (logsPollingInterval) {
    clearInterval(logsPollingInterval);
    logsPollingInterval = null;
  }
};

const toggleRealTime = () => {
  if (realTimeEnabled.value) {
    startPolling();
  } else {
    stopPolling();
  }
};

const toggleAutoScroll = () => {
  autoScroll.value = !autoScroll.value;
  if (autoScroll.value) {
    scrollToBottom();
  }
};

const scrollToBottom = () => {
  const containers = [
    buildLogsContainer.value,
    deployLogsContainer.value,
    allLogsContainer.value,
  ];

  containers.forEach((container) => {
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  });
};

const handleScroll = (event) => {
  const container = event.target;
  const isAtBottom =
    container.scrollTop + container.clientHeight >= container.scrollHeight - 10;

  // Désactiver auto-scroll si l'utilisateur fait défiler vers le haut
  if (!isAtBottom && autoScroll.value) {
    autoScroll.value = false;
  }
};

const downloadLogs = () => {
  const allLogs = `=== LOGS DE DÉPLOIEMENT ===
Déploiement ID: ${props.deploymentId}
Date: ${deployment.value?.started_at}
Status: ${deployment.value?.status}

=== BUILD LOGS ===
${logs.build || "Aucun log de build"}

=== DEPLOY LOGS ===
${logs.deploy || "Aucun log de déploiement"}

=== ERREURS ===
${errorLines.value.join("\n") || "Aucune erreur détectée"}
`;

  const blob = new Blob([allLogs], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `deployment-${props.deploymentId}-logs.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  notifications.success("Logs téléchargés");
};

const clearLogsView = () => {
  // Vider l'affichage local (pas les vrais logs)
  const containers = [
    buildLogsContainer.value,
    deployLogsContainer.value,
    allLogsContainer.value,
  ];

  containers.forEach((container) => {
    if (container) {
      container.innerHTML =
        '<div class="text-center py-4 text-gray-500">Logs effacés localement</div>';
    }
  });
};

// Utilitaires
const isDeploymentActive = (status) => {
  return [
    "pending",
    "cloning",
    "building",
    "deploying",
    "configuring",
  ].includes(status);
};

const getStatusIndicator = (status) => {
  const indicators = {
    success: "w-2 h-2 bg-green-400 rounded-full animate-pulse",
    failed: "w-2 h-2 bg-red-400 rounded-full",
    cancelled: "w-2 h-2 bg-gray-400 rounded-full",
    pending: "w-2 h-2 bg-yellow-400 rounded-full animate-pulse",
    cloning: "w-2 h-2 bg-blue-400 rounded-full animate-pulse",
    building: "w-2 h-2 bg-blue-400 rounded-full animate-pulse",
    deploying: "w-2 h-2 bg-purple-400 rounded-full animate-pulse",
    configuring: "w-2 h-2 bg-indigo-400 rounded-full animate-pulse",
  };
  return indicators[status] || "w-2 h-2 bg-gray-400 rounded-full";
};

const getStatusClass = (status) => {
  const classes = {
    success: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    cancelled: "bg-gray-100 text-gray-800",
    pending: "bg-yellow-100 text-yellow-800",
    cloning: "bg-blue-100 text-blue-800",
    building: "bg-blue-100 text-blue-800",
    deploying: "bg-purple-100 text-purple-800",
    configuring: "bg-indigo-100 text-indigo-800",
  };
  return classes[status] || "bg-gray-100 text-gray-800";
};

const getStatusText = (status) => {
  const texts = {
    success: "Réussi",
    failed: "Échoué",
    cancelled: "Annulé",
    pending: "En attente",
    cloning: "Clonage",
    building: "Construction",
    deploying: "Déploiement",
    configuring: "Configuration",
  };
  return texts[status] || status;
};

const getProgressPercentage = (status) => {
  const percentages = {
    pending: 5,
    cloning: 20,
    building: 60,
    deploying: 85,
    configuring: 95,
    success: 100,
    failed: 100,
    cancelled: 100,
  };
  return percentages[status] || 0;
};

const getLogLineClass = (line) => {
  const lowerLine = line.toLowerCase();

  if (lowerLine.includes("error") || lowerLine.includes("❌")) {
    return "text-red-400";
  }
  if (lowerLine.includes("warning") || lowerLine.includes("⚠️")) {
    return "text-yellow-400";
  }
  if (lowerLine.includes("success") || lowerLine.includes("✅")) {
    return "text-green-400";
  }
  if (lowerLine.includes("info") || lowerLine.includes("ℹ️")) {
    return "text-blue-400";
  }

  return "text-green-400";
};

const getDuration = (startTime, endTime) => {
  if (!startTime) return "N/A";

  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  const duration = Math.round((end - start) / 1000);

  if (duration < 60) {
    return `${duration}s`;
  } else if (duration < 3600) {
    return `${Math.floor(duration / 60)}m ${duration % 60}s`;
  } else {
    return `${Math.floor(duration / 3600)}h ${Math.floor(
      (duration % 3600) / 60
    )}m`;
  }
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString("fr-FR");
};

const formatTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("fr-FR");
};

const getLogStats = () => {
  const buildLines = buildLogLines.value.length;
  const deployLines = deployLogLines.value.length;
  const errors = errorLines.value.length;

  return `${buildLines + deployLines} lignes • ${errors} erreurs`;
};

// Watchers
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen && props.deploymentId) {
      refreshLogs();
      if (realTimeEnabled.value) {
        startPolling();
      }
    } else {
      stopPolling();
    }
  }
);

watch(
  () => props.deploymentId,
  (newId) => {
    if (newId && props.isOpen) {
      refreshLogs();
    }
  }
);

// Lifecycle
onMounted(() => {
  if (props.isOpen && props.deploymentId) {
    refreshLogs();
    if (realTimeEnabled.value) {
      startPolling();
    }
  }
});

onUnmounted(() => {
  stopPolling();
});
</script>

<style scoped>
.logs-container {
  scrollbar-width: thin;
  scrollbar-color: #4b5563 #1f2937;
}

.logs-container::-webkit-scrollbar {
  width: 8px;
}

.logs-container::-webkit-scrollbar-track {
  background: #1f2937;
}

.logs-container::-webkit-scrollbar-thumb {
  background-color: #4b5563;
  border-radius: 4px;
}

.logs-container::-webkit-scrollbar-thumb:hover {
  background-color: #6b7280;
}

/* Animation pour les nouvelles lignes de log */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.log-line-new {
  animation: fadeIn 0.3s ease-out;
}

/* Style pour les lignes importantes */
.log-line-important {
  background-color: rgba(59, 130, 246, 0.1);
  border-left: 3px solid #3b82f6;
  padding-left: 8px;
}

.log-line-error {
  background-color: rgba(239, 68, 68, 0.1);
  border-left: 3px solid #ef4444;
  padding-left: 8px;
}

.log-line-warning {
  background-color: rgba(245, 158, 11, 0.1);
  border-left: 3px solid #f59e0b;
  padding-left: 8px;
}

.log-line-success {
  background-color: rgba(34, 197, 94, 0.1);
  border-left: 3px solid #22c55e;
  padding-left: 8px;
}

/* Animation pour l'indicateur de streaming */
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse-slow {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
