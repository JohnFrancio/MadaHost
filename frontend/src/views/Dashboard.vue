<script setup>
import { ref, computed, onMounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import api from "@/utils/axios";
import NewProjectModal from "@/components/NewProjectModal.vue";

const authStore = useAuthStore();

// État local
const projects = ref([]);
const githubRepos = ref([]);
const loadingRepos = ref(false);
const loadingProjects = ref(false);
const showNewProjectModal = ref(false);
const deploying = ref(false);
const error = ref(null);

// Computed
const activeProjects = computed(
  () => projects.value.filter((p) => p.status === "active").length
);

const totalDeployments = computed(() => {
  // Pour l'instant, on simule
  return projects.value.length * 3;
});

// Méthodes
const getStatusText = (status) => {
  const statusMap = {
    active: "En ligne",
    building: "Construction",
    error: "Erreur",
    inactive: "Inactif",
    created: "Créé",
  };
  return statusMap[status] || status;
};

const loadProjects = async () => {
  try {
    loadingProjects.value = true;
    error.value = null;

    console.log("📡 Chargement des projets...");
    const response = await api.get("/projects"); // ⬅️ Sans /api car déjà dans baseURL

    console.log("✅ Projets chargés:", response.data);
    projects.value = response.data.projects || [];
  } catch (err) {
    console.error("❌ Erreur chargement projets:", err);
    error.value = err.response?.data?.error || err.message;
  } finally {
    loadingProjects.value = false;
  }
};

const loadGitHubRepos = async () => {
  try {
    loadingRepos.value = true;
    const response = await api.get("/projects/github-repos"); // ⬅️ Sans /api
    githubRepos.value = response.data.repos || [];
    console.log("Repos GitHub chargés:", githubRepos.value.length);
  } catch (error) {
    console.error("Erreur lors du chargement des repos:", error);
  } finally {
    loadingRepos.value = false;
  }
};

const onProjectCreated = async (project) => {
  console.log("✅ Nouveau projet créé:", project);
  // Recharger la liste des projets
  await loadProjects();
};

// Lifecycle
onMounted(async () => {
  await loadProjects();
});

const deployProject = async (id) => {
  deploying.value = true;
  try {
    const response = await api.post(`/projects/${id}/deploy`); // ⬅️ Sans /api
    console.log("Déploiement initié:", response.data);
    await loadProjects();
  } catch (error) {
    console.error("Erreur lors du déploiement:", error);
    alert(
      "Erreur lors du déploiement: " +
        (error.response?.data?.error || error.message)
    );
  } finally {
    deploying.value = false;
  }
};
</script>

<template>
  <div class="animate-fade-in-up">
    <!-- Header -->
    <div class="mb-12">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Bienvenue, {{ authStore.user?.username }} ! 👋
          </h1>
          <p class="text-lg text-gray-600 dark:text-gray-400">
            Gérez vos projets et déploiements depuis votre tableau de bord
          </p>
        </div>

        <div class="mt-4 sm:mt-0">
          <button
            @click="showNewProjectModal = true"
            class="btn-primary flex items-center hover-glow"
          >
            <svg
              class="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              ></path>
            </svg>
            Nouveau projet
          </button>
        </div>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
      <div class="metric-card from-blue-500 to-blue-600 animate-fade-in-up">
        <div class="flex items-center justify-between">
          <div
            class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm"
          >
            <svg
              class="w-7 h-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              ></path>
            </svg>
          </div>
          <div class="text-right">
            <div class="metric-value">
              {{ projects.length }}
            </div>
            <div class="metric-label">Projets</div>
          </div>
        </div>
      </div>

      <div
        class="metric-card from-green-500 to-green-600 animate-fade-in-up animation-delay-200"
      >
        <div class="flex items-center justify-between">
          <div
            class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm"
          >
            <svg
              class="w-7 h-7 text-white"
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
          <div class="text-right">
            <div class="metric-value">
              {{ activeProjects }}
            </div>
            <div class="metric-label">En ligne</div>
          </div>
        </div>
      </div>

      <div
        class="metric-card from-purple-500 to-purple-600 animate-fade-in-up animation-delay-400"
      >
        <div class="flex items-center justify-between">
          <div
            class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm"
          >
            <svg
              class="w-7 h-7 text-white"
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
          <div class="text-right">
            <div class="metric-value">
              {{ totalDeployments }}
            </div>
            <div class="metric-label">Déploiements</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions rapides - Masquées car on a le bouton en haut -->
    <div
      v-if="projects.length === 0"
      class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12"
    >
      <!-- Nouveau projet -->
      <div class="card-hover animate-fade-in-up">
        <div class="text-center">
          <div
            class="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6"
          >
            <svg
              class="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              ></path>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-3">
            Créer un projet
          </h2>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Connectez un repo GitHub et déployez votre site en quelques clics
          </p>
          <button
            @click="showNewProjectModal = true"
            class="btn-primary w-full"
          >
            Commencer maintenant
          </button>
        </div>
      </div>

      <!-- Repos GitHub -->
      <div class="card-hover animate-fade-in-up animation-delay-200">
        <div class="text-center">
          <div
            class="w-16 h-16 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-6"
          >
            <svg
              class="w-8 h-8 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
                clip-rule="evenodd"
              ></path>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-3">
            Repositories GitHub
          </h2>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Parcourez vos repositories pour les déployer rapidement
          </p>
          <button
            @click="loadGitHubRepos"
            :disabled="loadingRepos"
            class="btn-secondary w-full"
          >
            {{ loadingRepos ? "Chargement..." : "Parcourir mes repos" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Liste des projets -->
    <div
      v-if="projects.length > 0"
      class="animate-fade-in-up animation-delay-400"
    >
      <div class="flex items-center justify-between mb-8">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
          Vos projets
        </h2>
        <div class="text-sm text-gray-500 dark:text-gray-400">
          {{ projects.length }} projet{{ projects.length > 1 ? "s" : "" }}
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        <div
          v-for="project in projects"
          :key="project.id"
          class="card-hover group"
          @click="$router.push(`/project/${project.id}`)"
        >
          <!-- Header du projet -->
          <div class="flex justify-between items-start mb-6">
            <div class="flex-1">
              <h3
                class="font-bold text-xl text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"
              >
                {{ project.name }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {{ project.github_repo }}
              </p>
            </div>
            <span
              :class="{
                'status-success': project.status === 'active',
                'status-warning': project.status === 'building',
                'status-error': project.status === 'error',
                'status-info':
                  project.status === 'inactive' || project.status === 'created',
              }"
              class="status-badge"
            >
              {{ getStatusText(project.status) }}
            </span>
          </div>

          <!-- Framework badge -->
          <div v-if="project.framework" class="mb-4">
            <span class="badge-primary">
              {{ project.framework }}
            </span>
          </div>

          <!-- URL et actions -->
          <div
            class="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-800"
          >
            <a
              v-if="project.domain && project.status === 'active'"
              :href="`https://${project.domain}`"
              target="_blank"
              @click.stop
              class="link-primary text-sm font-medium flex items-center group/link"
            >
              <span class="truncate max-w-32">{{ project.domain }}</span>
              <svg
                class="w-4 h-4 ml-1 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                ></path>
              </svg>
            </a>
            <span v-else class="text-gray-400 dark:text-gray-500 text-sm">
              En attente de déploiement
            </span>

            <div class="flex items-center gap-2">
              <button
                @click.stop="deployProject(project.id)"
                :disabled="deploying"
                class="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs rounded-lg font-medium transition-all duration-200 hover:shadow-md disabled:opacity-50"
              >
                <svg
                  class="w-3 h-3 mr-1 inline"
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
                {{ deploying ? "..." : "Deploy" }}
              </button>

              <button
                @click.stop
                class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Plus d'options"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  ></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- État vide -->
    <div v-else class="empty-state animate-fade-in-up animation-delay-600">
      <div
        class="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-soft"
      >
        <svg
          class="w-12 h-12 text-gray-400 dark:text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          ></path>
        </svg>
      </div>

      <h3 class="empty-state-title">Aucun projet pour le moment</h3>
      <p class="empty-state-description">
        Créez votre premier projet pour commencer à déployer vos sites web
      </p>

      <button
        @click="showNewProjectModal = true"
        class="btn-primary hover-glow"
      >
        <svg
          class="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          ></path>
        </svg>
        Créer mon premier projet
      </button>
    </div>

    <!-- Modal Nouveau Projet -->
    <NewProjectModal
      :is-open="showNewProjectModal"
      @close="showNewProjectModal = false"
      @created="onProjectCreated"
    />
  </div>
</template>
