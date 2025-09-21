<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useProjectsStore } from "@/stores/projects";
import { useNotificationsStore } from "@/stores/notifications";
import axios from "axios";
import {
  ArrowLeftIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  RocketLaunchIcon,
  CogIcon,
  ChartBarIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@heroicons/vue/24/solid";
import { LinkIcon } from "@heroicons/vue/24/solid";
import ProjectSettings from "@/components/ProjectSettings.vue";
import ProjectSettingsModal from "@/components/ProjectSettingsModal.vue";
import DeploymentLogsModal from "@/components/DeploymentLogsModal.vue";
import ProjectPreview from "@/components/ProjectPreview.vue";

// Composables
const route = useRoute();
const router = useRouter();
const projectsStore = useProjectsStore();
const notifications = useNotificationsStore();

// État local
const loading = ref(true);
const project = ref(null);
const activeTab = ref("overview");
const deployments = ref([]);
const deploymentsLoading = ref(false);
const deploymentStats = reactive({
  total: 0,
  success: 0,
  failed: 0,
  avgTime: 0,
});

const currentDeployment = ref(null);
const isDeploying = ref(false);
const deploymentLogs = ref("");
const showLogsModal = ref(false);
const selectedDeploymentId = ref(null);
const showSettings = ref(false);

// Polling
let deploymentPollInterval = null;
let logsPollInterval = null;

// Configuration des tabs
const tabs = computed(() => [
  {
    key: "overview",
    name: "Aperçu",
    icon: ChartBarIcon,
  },
  {
    key: "deployments",
    name: "Déploiements",
    icon: RocketLaunchIcon,
    badge: deployments.value.length || null,
  },
  {
    key: "settings",
    name: "Paramètres",
    icon: CogIcon,
  },
]);

const envVars = computed(() => {
  if (!project.value?.env_vars) return [];
  try {
    return JSON.parse(project.value.env_vars);
  } catch {
    return [];
  }
});

// Méthodes
const loadProject = async () => {
  try {
    loading.value = true;
    const projectId = route.params.id;

    const api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
      withCredentials: true,
    });

    const response = await api.get(`/projects/${projectId}`);

    if (response.data.success) {
      project.value = response.data.project;
      await Promise.all([
        loadDeployments(),
        loadDeploymentStats(),
        checkCurrentDeployment(),
      ]);
    } else {
      throw new Error(response.data.error);
    }
  } catch (error) {
    console.error("❌ Erreur chargement projet:", error);
    notifications.error("Impossible de charger le projet");
    if (error.response?.status === 404) {
      project.value = null;
    }
  } finally {
    loading.value = false;
  }
};

const loadDeployments = async () => {
  try {
    deploymentsLoading.value = true;
    const api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
      withCredentials: true,
    });

    const response = await api.get(`/deployments/projects/${route.params.id}`);

    if (response.data.success) {
      deployments.value = response.data.deployments;
    }
  } catch (error) {
    console.error("❌ Erreur chargement déploiements:", error);
  } finally {
    deploymentsLoading.value = false;
  }
};

const loadDeploymentStats = async () => {
  try {
    const api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
      withCredentials: true,
    });

    const response = await api.get("/deployments/stats");

    if (response.data.success) {
      Object.assign(deploymentStats, response.data.stats);
    }
  } catch (error) {
    console.error("❌ Erreur stats déploiements:", error);
  }
};

const checkCurrentDeployment = async () => {
  const ongoingDeployment = deployments.value.find((d) =>
    ["pending", "cloning", "building", "deploying", "configuring"].includes(
      d.status
    )
  );

  if (ongoingDeployment) {
    currentDeployment.value = ongoingDeployment;
    isDeploying.value = true;
    startDeploymentPolling();
  }
};

const deployProject = async () => {
  try {
    isDeploying.value = true;

    const api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
      withCredentials: true,
    });

    const response = await api.post(`/deployments/deploy/${route.params.id}`);

    if (response.data.success) {
      notifications.info("Déploiement lancé", {
        title: "🚀 Déploiement démarré",
      });

      // Recharger pour obtenir le nouveau déploiement
      setTimeout(async () => {
        await loadDeployments();
        await checkCurrentDeployment();
      }, 2000);
    }
  } catch (error) {
    console.error("❌ Erreur déploiement:", error);
    notifications.error(
      error.response?.data?.error || "Erreur lors du déploiement"
    );
    isDeploying.value = false;
  }
};

const startDeploymentPolling = () => {
  // Polling du status du déploiement
  deploymentPollInterval = setInterval(async () => {
    if (!currentDeployment.value) return;

    try {
      const api = axios.create({
        baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
        withCredentials: true,
      });

      const response = await api.get(
        `/deployments/${currentDeployment.value.id}`
      );

      if (response.data.success) {
        const updated = response.data.deployment;
        currentDeployment.value = updated;

        // Si terminé, arrêter le polling
        if (["success", "failed", "cancelled"].includes(updated.status)) {
          clearInterval(deploymentPollInterval);
          clearInterval(logsPollInterval);
          isDeploying.value = false;

          if (updated.status === "success") {
            notifications.deploymentSuccess(
              project.value.name,
              `https://${project.value.domain}`
            );
            // Recharger le projet pour avoir le nouveau domain
            await loadProject();
          } else if (updated.status === "failed") {
            notifications.deploymentFailed(
              project.value.name,
              updated.build_log
            );
          }

          currentDeployment.value = null;
          await loadDeployments();
        }
      }
    } catch (error) {
      console.error("❌ Erreur polling déploiement:", error);
    }
  }, 3000);

  // Polling des logs
  logsPollInterval = setInterval(async () => {
    if (!currentDeployment.value) return;

    try {
      const api = axios.create({
        baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
        withCredentials: true,
      });

      const response = await api.get(
        `/deployments/${currentDeployment.value.id}/logs`
      );

      if (response.data.success) {
        deploymentLogs.value = response.data.logs.build || "";
      }
    } catch (error) {
      console.error("❌ Erreur récupération logs:", error);
    }
  }, 2000);
};

const cancelDeployment = async () => {
  if (!currentDeployment.value) return;

  try {
    const api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
      withCredentials: true,
    });

    await api.delete(`/deployments/${currentDeployment.value.id}`);

    notifications.info("Déploiement annulé");

    // Nettoyer les états
    clearInterval(deploymentPollInterval);
    clearInterval(logsPollInterval);
    currentDeployment.value = null;
    isDeploying.value = false;

    await loadDeployments();
  } catch (error) {
    console.error("❌ Erreur annulation:", error);
    notifications.error("Impossible d'annuler le déploiement");
  }
};

const viewDeploymentLogs = (deploymentId) => {
  selectedDeploymentId.value = deploymentId;
  showLogsModal.value = true;
};

// Handlers d'événements
const onProjectUpdated = (updatedProject) => {
  project.value = { ...project.value, ...updatedProject };
  notifications.success("Projet mis à jour");
};

const onProjectDeleted = () => {
  notifications.success("Projet supprimé");
  router.push("/dashboard");
};

// Utilitaires
const getStatusClass = (status) => {
  const classes = {
    active: "bg-green-100 text-green-800",
    building: "bg-yellow-100 text-yellow-800",
    error: "bg-red-100 text-red-800",
    inactive: "bg-gray-100 text-gray-800",
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

const getDeploymentStatusText = (status) => {
  const texts = {
    pending: "En attente",
    cloning: "Clonage du repository",
    building: "Construction du projet",
    deploying: "Déploiement des fichiers",
    configuring: "Configuration du domaine",
    success: "Déploiement réussi",
    failed: "Déploiement échoué",
    cancelled: "Annulé",
  };
  return texts[status] || status;
};

const getDeploymentStatusClass = (status) => {
  const classes = {
    pending: "bg-yellow-100 text-yellow-800",
    cloning: "bg-blue-100 text-blue-800",
    building: "bg-blue-100 text-blue-800",
    deploying: "bg-blue-100 text-blue-800",
    configuring: "bg-blue-100 text-blue-800",
    success: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    cancelled: "bg-gray-100 text-gray-800",
  };
  return classes[status] || "bg-gray-100 text-gray-800";
};

const getDeploymentStatusIcon = (status) => {
  const classes = {
    success:
      "w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600",
    failed:
      "w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-600",
    pending:
      "w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600",
    cancelled:
      "w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600",
  };
  return (
    classes[status] ||
    "w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600"
  );
};

const getDeploymentIcon = (status) => {
  const icons = {
    success: CheckCircleIcon,
    failed: ExclamationCircleIcon,
    cancelled: XCircleIcon,
    pending: ClockIcon,
  };
  return icons[status] || ClockIcon;
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

const getDeploymentDuration = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
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
      hour: "2-digit",
      minute: "2-digit",
    });
  }
};

// Lifecycle
onMounted(() => {
  loadProject();
});

onUnmounted(() => {
  if (deploymentPollInterval) {
    clearInterval(deploymentPollInterval);
  }
  if (logsPollInterval) {
    clearInterval(logsPollInterval);
  }
});
</script>

<template>
  <div class="max-w-6xl mx-auto px-6">
    <!-- Loading général -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div
        class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
      ></div>
      <span class="ml-3 text-gray-600">Chargement du projet...</span>
    </div>

    <!-- Projet introuvable -->
    <div v-else-if="!project" class="text-center py-12">
      <div
        class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"
      >
        <XCircleIcon class="w-8 h-8 text-red-600" />
      </div>
      <h3 class="text-lg font-medium text-gray-900 mb-2">Projet non trouvé</h3>
      <p class="text-gray-600">
        Ce projet n'existe pas ou vous n'avez pas l'autorisation de le
        consulter.
      </p>
      <router-link to="/dashboard" class="mt-4 inline-block btn-primary">
        Retour au Dashboard
      </router-link>
    </div>

    <!-- Contenu principal -->
    <div v-else>
      <!-- Header du projet -->
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <router-link
              to="/dashboard"
              class="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeftIcon class="w-5 h-5" />
            </router-link>

            <div>
              <h1 class="text-3xl font-bold text-gray-900">
                {{ project.name }}
              </h1>
              <div class="flex items-center space-x-4 mt-2">
                <span class="text-gray-600">{{ project.github_repo }}</span>
                <span
                  :class="getStatusClass(project.status)"
                  class="px-2 py-1 rounded-full text-xs font-medium"
                >
                  {{ getStatusText(project.status) }}
                </span>
                <a
                  v-if="project.domain"
                  :href="`https://${project.domain}`"
                  target="_blank"
                  class="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                >
                  {{ project.domain }}
                  <LinkIcon class="w-4 h-4 ml-1" />
                </a>
              </div>
            </div>
          </div>

          <!-- Actions principales -->
          <div class="flex space-x-3">
            <button
              @click="deployProject"
              :disabled="isDeploying"
              class="btn-primary flex items-center"
            >
              <RocketLaunchIcon class="w-4 h-4 mr-2" />
              {{ isDeploying ? "Déploiement..." : "Déployer" }}
            </button>

            <button
              @click="showSettings = true"
              class="btn-secondary flex items-center"
            >
              <CogIcon class="w-4 h-4 mr-2" />
              Paramètres
            </button>
          </div>
        </div>
      </div>

      <!-- Status de déploiement actuel -->
      <div v-if="currentDeployment" class="mb-8">
        <div class="bg-white rounded-lg border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900">
              Déploiement en cours
            </h2>
            <div class="flex items-center space-x-2">
              <div
                class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"
              ></div>
              <span class="text-sm text-gray-600">{{
                getDeploymentStatusText(currentDeployment.status)
              }}</span>
            </div>
          </div>

          <!-- Barre de progression -->
          <div class="mb-4">
            <div class="bg-gray-200 rounded-full h-2">
              <div
                class="bg-blue-600 h-2 rounded-full transition-all duration-500"
                :style="{
                  width: getProgressPercentage(currentDeployment.status) + '%',
                }"
              ></div>
            </div>
            <div class="flex justify-between text-xs text-gray-500 mt-1">
              <span>Début</span>
              <span>{{
                getDeploymentStatusText(currentDeployment.status)
              }}</span>
              <span>Terminé</span>
            </div>
          </div>

          <!-- Logs en temps réel -->
          <div
            class="bg-gray-900 rounded-lg p-4 text-green-400 font-mono text-sm max-h-64 overflow-y-auto"
          >
            <div v-if="deploymentLogs">
              <pre>{{ deploymentLogs }}</pre>
            </div>
            <div v-else class="text-gray-500">
              En attente des logs de déploiement...
            </div>
          </div>

          <!-- Actions déploiement -->
          <div class="flex justify-between items-center mt-4">
            <div class="text-sm text-gray-600">
              Démarré {{ formatDate(currentDeployment.started_at) }}
            </div>
            <button
              @click="cancelDeployment"
              class="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Annuler le déploiement
            </button>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="mb-6">
        <nav class="flex space-x-8">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            @click="activeTab = tab.key"
            :class="[
              'whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === tab.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ]"
          >
            <component :is="tab.icon" class="w-4 h-4 inline mr-2" />
            {{ tab.name }}
            <span
              v-if="tab.badge"
              class="ml-2 bg-gray-100 text-gray-900 py-1 px-2 rounded-full text-xs"
            >
              {{ tab.badge }}
            </span>
          </button>
        </nav>
      </div>

      <!-- Contenu des tabs -->
      <div class="bg-white rounded-lg border border-gray-200">
        <!-- Tab: Aperçu -->
        <div v-if="activeTab === 'overview'" class="p-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Informations du projet -->
            <div class="space-y-6">
              <div>
                <h3 class="text-lg font-medium text-gray-900 mb-4">
                  Informations du projet
                </h3>

                <dl class="space-y-4">
                  <div class="flex justify-between">
                    <dt class="text-gray-600">Repository:</dt>
                    <dd class="font-mono text-gray-900">
                      <a
                        :href="`https://github.com/${project.github_repo}`"
                        target="_blank"
                        class="text-blue-600 hover:text-blue-800"
                      >
                        {{ project.github_repo }}
                      </a>
                    </dd>
                  </div>

                  <div class="flex justify-between">
                    <dt class="text-gray-600">Branche:</dt>
                    <dd class="font-mono text-gray-900">
                      {{ project.branch }}
                    </dd>
                  </div>

                  <div class="flex justify-between">
                    <dt class="text-gray-600">Framework:</dt>
                    <dd class="text-gray-900">
                      {{ project.framework || "Non spécifié" }}
                    </dd>
                  </div>

                  <div class="flex justify-between">
                    <dt class="text-gray-600">Commande de build:</dt>
                    <dd class="font-mono text-gray-900 text-sm">
                      {{ project.build_command || "Aucune" }}
                    </dd>
                  </div>

                  <div class="flex justify-between">
                    <dt class="text-gray-600">Dossier de sortie:</dt>
                    <dd class="font-mono text-gray-900 text-sm">
                      {{ project.output_dir || "dist" }}
                    </dd>
                  </div>

                  <div class="flex justify-between">
                    <dt class="text-gray-600">Auto-deploy:</dt>
                    <dd>
                      <span
                        :class="
                          project.auto_deploy
                            ? 'text-green-600'
                            : 'text-gray-500'
                        "
                      >
                        {{ project.auto_deploy ? "Activé" : "Désactivé" }}
                      </span>
                    </dd>
                  </div>

                  <div class="flex justify-between">
                    <dt class="text-gray-600">Créé:</dt>
                    <dd class="text-gray-900">
                      {{ formatDate(project.created_at) }}
                    </dd>
                  </div>

                  <div class="flex justify-between">
                    <dt class="text-gray-600">Dernier déploiement:</dt>
                    <dd class="text-gray-900">
                      {{
                        project.last_deployed
                          ? formatDate(project.last_deployed)
                          : "Jamais"
                      }}
                    </dd>
                  </div>
                </dl>
              </div>

              <!-- Variables d'environnement -->
              <div v-if="envVars.length > 0">
                <h4 class="text-md font-medium text-gray-900 mb-3">
                  Variables d'environnement
                </h4>
                <div class="space-y-2">
                  <div
                    v-for="(envVar, index) in envVars"
                    :key="index"
                    class="flex justify-between items-center p-2 bg-gray-50 rounded"
                  >
                    <span class="font-mono text-sm text-gray-900">{{
                      envVar.key
                    }}</span>
                    <span class="text-sm text-gray-500">••••••••</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Statistiques -->
            <div class="space-y-6">
              <div>
                <h3 class="text-lg font-medium text-gray-900 mb-4">
                  Statistiques
                </h3>

                <div class="grid grid-cols-2 gap-4 mb-6">
                  <div class="bg-green-50 p-4 rounded-lg">
                    <div class="text-2xl font-bold text-green-600">
                      {{ deploymentStats.success }}
                    </div>
                    <div class="text-sm text-green-600">
                      Déploiements réussis
                    </div>
                  </div>

                  <div class="bg-red-50 p-4 rounded-lg">
                    <div class="text-2xl font-bold text-red-600">
                      {{ deploymentStats.failed }}
                    </div>
                    <div class="text-sm text-red-600">Échecs</div>
                  </div>

                  <div class="bg-blue-50 p-4 rounded-lg">
                    <div class="text-2xl font-bold text-blue-600">
                      {{ deploymentStats.total }}
                    </div>
                    <div class="text-sm text-blue-600">Total</div>
                  </div>

                  <div class="bg-yellow-50 p-4 rounded-lg">
                    <div class="text-2xl font-bold text-yellow-600">
                      {{ deploymentStats.avgTime }}s
                    </div>
                    <div class="text-sm text-yellow-600">Temps moyen</div>
                  </div>
                </div>
              </div>

              <!-- Aperçu du projet déployé -->
              <ProjectPreview :project="project" />
            </div>
          </div>
        </div>

        <!-- Tab: Déploiements -->
        <div v-else-if="activeTab === 'deployments'" class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-medium text-gray-900">
              Historique des déploiements
            </h3>
            <button @click="loadDeployments" class="btn-secondary text-sm">
              <ArrowPathIcon class="w-4 h-4 mr-2" />
              Actualiser
            </button>
          </div>

          <!-- Loading déploiements -->
          <div
            v-if="deploymentsLoading"
            class="flex items-center justify-center py-8"
          >
            <div
              class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"
            ></div>
            <span class="ml-3 text-gray-600"
              >Chargement des déploiements...</span
            >
          </div>

          <!-- Liste des déploiements -->
          <div v-else-if="deployments.length > 0" class="space-y-4">
            <div
              v-for="deployment in deployments"
              :key="deployment.id"
              class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                  <div :class="getDeploymentStatusIcon(deployment.status)">
                    <component
                      :is="getDeploymentIcon(deployment.status)"
                      class="w-5 h-5"
                    />
                  </div>

                  <div>
                    <div class="font-medium text-gray-900">
                      Déploiement #{{ deployment.id.split("-")[0] }}
                    </div>
                    <div class="text-sm text-gray-600">
                      {{ formatDate(deployment.started_at) }}
                      <span
                        v-if="deployment.commit_hash"
                        class="ml-2 font-mono"
                      >
                        ({{ deployment.commit_hash.substring(0, 7) }})
                      </span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center space-x-3">
                  <span
                    :class="getDeploymentStatusClass(deployment.status)"
                    class="px-2 py-1 rounded-full text-xs font-medium"
                  >
                    {{ getDeploymentStatusText(deployment.status) }}
                  </span>

                  <button
                    @click="viewDeploymentLogs(deployment.id)"
                    class="text-gray-600 hover:text-gray-800 text-sm"
                  >
                    Voir les logs
                  </button>
                </div>
              </div>

              <!-- Durée et infos supplémentaires -->
              <div
                v-if="deployment.completed_at"
                class="mt-3 text-sm text-gray-600"
              >
                Durée:
                {{
                  getDeploymentDuration(
                    deployment.started_at,
                    deployment.completed_at
                  )
                }}
              </div>
            </div>
          </div>

          <!-- Aucun déploiement -->
          <div v-else class="text-center py-8">
            <RocketLaunchIcon class="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 class="text-lg font-medium text-gray-900 mb-2">
              Aucun déploiement
            </h4>
            <p class="text-gray-600 mb-4">
              Ce projet n'a pas encore été déployé.
            </p>
            <button @click="deployProject" class="btn-primary">
              Lancer le premier déploiement
            </button>
          </div>
        </div>

        <!-- Tab: Paramètres -->
        <div v-else-if="activeTab === 'settings'" class="p-6">
          <ProjectSettings
            :project="project"
            @updated="onProjectUpdated"
            @deleted="onProjectDeleted"
          />
        </div>
      </div>

      <!-- Modal des logs -->
      <DeploymentLogsModal
        :isOpen="showLogsModal"
        :deploymentId="selectedDeploymentId"
        @close="showLogsModal = false"
      />

      <!-- Modal des paramètres -->
      <ProjectSettingsModal
        :isOpen="showSettings"
        :project="project"
        @close="showSettings = false"
        @updated="onProjectUpdated"
      />
    </div>
  </div>
</template>

<style scoped>
.btn-primary {
  @apply bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-secondary {
  @apply bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors;
}

/* Animation pour les logs qui défilent */
.logs-container {
  scrollbar-width: thin;
  scrollbar-color: #4b5563 #1f2937;
}

.logs-container::-webkit-scrollbar {
  width: 6px;
}

.logs-container::-webkit-scrollbar-track {
  background: #1f2937;
}

.logs-container::-webkit-scrollbar-thumb {
  background-color: #4b5563;
  border-radius: 3px;
}

/* Animation de la barre de progression */
.progress-bar {
  transition: width 0.5s ease-in-out;
}

/* Styles pour les tabs */
.tab-indicator {
  transition: all 0.2s ease-in-out;
}
</style>
