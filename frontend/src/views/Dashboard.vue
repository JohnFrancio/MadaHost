<script setup>
import { ref, computed, onMounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import axios from "axios";
import NewProjectModal from "@/components/NewProjectModal.vue";

const authStore = useAuthStore();

// État local
const projects = ref([]);
const githubRepos = ref([]);
const loadingRepos = ref(false);
const showNewProjectModal = ref(false);

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
    const response = await axios.get("/api/projects");
    projects.value = response.data.projects || [];
  } catch (error) {
    console.error("Erreur lors du chargement des projets:", error);
  }
};

const loadGitHubRepos = async () => {
  try {
    loadingRepos.value = true;
    const response = await axios.get("/api/projects/github-repos");
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
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">
        Bienvenue, {{ authStore.user?.username }} ! 👋
      </h1>
      <p class="text-gray-600 mt-2">
        Gérez vos projets et déploiements depuis votre tableau de bord MadaHost
      </p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="card">
        <div class="flex items-center">
          <div
            class="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center"
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              ></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-2xl font-semibold text-gray-900">
              {{ projects.length }}
            </p>
            <p class="text-gray-600">Projets</p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center">
          <div
            class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center"
          >
            <svg
              class="w-6 h-6 text-green-600"
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
          <div class="ml-4">
            <p class="text-2xl font-semibold text-gray-900">
              {{ activeProjects }}
            </p>
            <p class="text-gray-600">Actifs</p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center">
          <div
            class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center"
          >
            <svg
              class="w-6 h-6 text-yellow-600"
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
          <div class="ml-4">
            <p class="text-2xl font-semibold text-gray-900">
              {{ totalDeployments }}
            </p>
            <p class="text-gray-600">Déploiements</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions rapides -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Nouveau projet -->
      <div class="card">
        <h2 class="text-xl font-semibold mb-4">Nouveau projet</h2>
        <p class="text-gray-600 mb-4">
          Connectez un repo GitHub et déployez votre site en quelques clics
        </p>
        <button
          @click="showNewProjectModal = true"
          class="flex justify-center items-center btn-primary w-full"
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
          Créer un projet
        </button>
      </div>

      <!-- Repos GitHub -->
      <div class="card">
        <h2 class="text-xl font-semibold mb-4">Vos repos GitHub</h2>
        <p class="text-gray-600 mb-4">
          Parcourez vos repositories pour les déployer rapidement
        </p>
        <button
          @click="loadGitHubRepos"
          :disabled="loadingRepos"
          class="flex justify-center items-center btn-secondary w-full"
        >
          <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
              clip-rule="evenodd"
            ></path>
          </svg>
          {{ loadingRepos ? "Chargement..." : "Voir mes repos" }}
        </button>
      </div>
    </div>

    <!-- Liste des projets -->
    <div class="mt-12" v-if="projects.length > 0">
      <h2 class="text-2xl font-semibold mb-6">Vos projets</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div
          v-for="project in projects"
          :key="project.id"
          class="card hover:shadow-md transition-shadow cursor-pointer"
        >
          <div class="flex justify-between items-start mb-4">
            <h3 class="font-semibold text-lg">{{ project.name }}</h3>
            <span
              :class="{
                'bg-green-100 text-green-800': project.status === 'active',
                'bg-yellow-100 text-yellow-800': project.status === 'building',
                'bg-red-100 text-red-800': project.status === 'error',
                'bg-gray-100 text-gray-800': project.status === 'inactive',
              }"
              class="px-2 py-1 rounded-full text-xs font-medium"
            >
              {{ getStatusText(project.status) }}
            </span>
          </div>

          <p class="text-gray-600 text-sm mb-4">{{ project.github_repo }}</p>

          <div class="flex justify-between items-center">
            <a
              v-if="project.domain && project.status === 'active'"
              :href="`https://${project.domain}`"
              target="_blank"
              class="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              {{ project.domain }} ↗
            </a>
            <span v-else class="text-gray-400 text-sm">
              En attente de déploiement
            </span>

            <button class="text-gray-500 hover:text-gray-700">
              <svg
                class="w-5 h-5"
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

    <!-- État vide -->
    <div v-else class="text-center py-12">
      <div
        class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"
      >
        <svg
          class="w-12 h-12 text-gray-400"
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
      <h3 class="text-xl font-medium text-gray-900 mb-2">
        Aucun projet pour le moment
      </h3>
      <p class="text-gray-600 mb-6">
        Créez votre premier projet pour commencer à déployer vos sites web
      </p>
      <button @click="showNewProjectModal = true" class="btn-primary">
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
