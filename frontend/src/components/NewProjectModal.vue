<script setup>
import { ref, reactive, computed, watch, onMounted } from "vue";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from "@headlessui/vue";
import {
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
  RocketLaunchIcon,
  MagnifyingGlassIcon,
  StarIcon,
  ClockIcon,
  FolderIcon,
  PlusIcon,
  EyeIcon,
  ChevronRightIcon,
} from "@heroicons/vue/24/solid";
import { useGitHub } from "@/composables/useGitHub";
import { useNotificationsStore } from "@/stores/notifications";
import axios from "axios";

const emit = defineEmits(["close", "created"]);
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
});

const {
  getAllRepos,
  getRepoBranches,
  detectFramework,
  loading: githubLoading,
  getLanguageColor,
  normalizeRepoData,
} = useGitHub();

const notifications = useNotificationsStore();

// État du modal
const currentStep = ref(1);
const selectedRepo = ref(null);
const detectedFramework = ref(null);
const availableBranches = ref(["main"]);
const searchQuery = ref("");
const filteredRepos = ref([]);
const allRepos = ref([]);

// État de création
const isCreating = ref(false);
const creationStatus = ref("");
const creationError = ref("");
const createdProject = ref(null);

// Configuration du projet
const projectConfig = reactive({
  name: "",
  branch: "main",
  buildCommand: "",
  outputDirectory: "",
  installCommand: "",
  autoDeployEnabled: true,
  customDomain: "",
  envVars: [],
  framework: "",
});

// Computed
const isConfigurationValid = computed(() => {
  return projectConfig.name && projectConfig.branch && selectedRepo.value;
});

// Méthodes
const searchRepositories = () => {
  if (!searchQuery.value.trim()) {
    filteredRepos.value = allRepos.value;
    return;
  }

  const query = searchQuery.value.toLowerCase();
  filteredRepos.value = allRepos.value.filter(
    (repo) =>
      repo.name.toLowerCase().includes(query) ||
      repo.description?.toLowerCase().includes(query) ||
      repo.language?.toLowerCase().includes(query)
  );
};

const selectRepository = (repo) => {
  selectedRepo.value = normalizeRepoData(repo);
  projectConfig.name = repo.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
};

const goToStep = async (step) => {
  if (step === 2 && selectedRepo.value) {
    await loadRepositoryConfig();
  }
  currentStep.value = step;
};

const loadRepositoryConfig = async () => {
  if (!selectedRepo.value) return;

  try {
    // Charger les branches
    const branches = await getRepoBranches(
      selectedRepo.value.owner.login,
      selectedRepo.value.name
    );
    availableBranches.value = branches.map((b) => b.name);

    // Détecter le framework
    console.log("🔍 Détection du framework...");
    const detection = await detectFramework(
      selectedRepo.value.owner.login,
      selectedRepo.value.name
    );

    detectedFramework.value = detection;
    console.log("✅ Framework détecté:", detection);

    // Appliquer la configuration automatique
    if (detection.buildConfig) {
      projectConfig.buildCommand = detection.buildConfig.buildCommand || "";
      projectConfig.outputDirectory =
        detection.buildConfig.outputDirectory || "";
      projectConfig.installCommand = detection.buildConfig.installCommand || "";
      projectConfig.framework = detection.framework || "";
    }

    // Définir la branche par défaut
    projectConfig.branch = selectedRepo.value.defaultBranch || "main";
  } catch (error) {
    console.error("Erreur configuration repo:", error);

    // Configuration par défaut en cas d'erreur
    projectConfig.buildCommand = "npm run build";
    projectConfig.outputDirectory = "dist";
    projectConfig.installCommand = "npm install";
    projectConfig.framework = "Node.js/JavaScript";

    notifications.warning(
      "Impossible de détecter le framework automatiquement",
      {
        title: "⚠️ Détection framework",
        message:
          "Configuration par défaut appliquée. Vous pouvez la modifier manuellement.",
      }
    );
  }
};

const createProject = async () => {
  if (!isConfigurationValid.value) return;

  isCreating.value = true;
  creationError.value = "";
  currentStep.value = 3;

  try {
    creationStatus.value = "Validation de la configuration...";
    await new Promise((resolve) => setTimeout(resolve, 800));

    creationStatus.value = "Création du projet...";

    // Appel API pour créer le projet
    const projectData = {
      name: projectConfig.name,
      github_repo: selectedRepo.value.fullName,
      branch: projectConfig.branch,
      build_command: projectConfig.buildCommand,
      output_dir: projectConfig.outputDirectory,
      install_command: projectConfig.installCommand,
      framework: projectConfig.framework,
      auto_deploy: projectConfig.autoDeployEnabled,
      env_vars: projectConfig.envVars.filter((v) => v.key && v.value),
    };

    const api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
      withCredentials: true,
    });

    const response = await api.post("/projects", projectData);

    if (response.data.success) {
      creationStatus.value = "Configuration du webhook GitHub...";
      await new Promise((resolve) => setTimeout(resolve, 1000));

      creationStatus.value = "Finalisation...";
      await new Promise((resolve) => setTimeout(resolve, 500));

      const project = {
        ...response.data.project,
        repository: selectedRepo.value,
        url: response.data.deploy_url,
      };

      createdProject.value = project;

      // Notification de succès
      notifications.projectCreated(project.name, project.url);

      emit("created", project);
    } else {
      throw new Error(response.data.error || "Erreur lors de la création");
    }
  } catch (error) {
    console.error("Erreur création projet:", error);
    creationError.value =
      error.response?.data?.error ||
      error.message ||
      "Une erreur inattendue est survenue";

    // Notification d'erreur
    notifications.error(creationError.value, {
      title: "❌ Erreur création projet",
    });
  } finally {
    isCreating.value = false;
    creationStatus.value = "";
  }
};

const retryCreation = () => {
  creationError.value = "";
  createProject();
};

const addEnvVar = () => {
  projectConfig.envVars.push({ key: "", value: "" });
};

const removeEnvVar = (index) => {
  projectConfig.envVars.splice(index, 1);
};

const viewProject = () => {
  if (createdProject.value) {
    // Ici vous pourriez utiliser le router pour naviguer
    $router.push(`/project/${createdProject.value.id}`);
  }
  close();
};

const deployNow = () => {
  if (createdProject.value) {
    console.log("Démarrage du déploiement pour:", createdProject.value.name);

    // Appeler l'API de déploiement
    const api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
      withCredentials: true,
    });

    api
      .post(`/projects/${createdProject.value.id}/deploy`)
      .then(() => {
        notifications.deploymentStarted(createdProject.value.name);
      })
      .catch((error) => {
        notifications.error("Impossible de lancer le déploiement", {
          details: error.message,
        });
      });
  }
  close();
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now - date) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    return "À l'instant";
  } else if (diffInHours < 24) {
    return `Il y a ${Math.floor(diffInHours)}h`;
  } else if (diffInHours < 168) {
    return `Il y a ${Math.floor(diffInHours / 24)}j`;
  } else {
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
};

const close = () => {
  emit("close");
  // Reset après un délai pour éviter les animations saccadées
  setTimeout(reset, 300);
};

const reset = () => {
  currentStep.value = 1;
  selectedRepo.value = null;
  detectedFramework.value = null;
  availableBranches.value = ["main"];
  searchQuery.value = "";
  filteredRepos.value = [];
  isCreating.value = false;
  creationStatus.value = "";
  creationError.value = "";
  createdProject.value = null;

  Object.assign(projectConfig, {
    name: "",
    branch: "main",
    buildCommand: "",
    outputDirectory: "",
    installCommand: "",
    autoDeployEnabled: true,
    customDomain: "",
    envVars: [],
    framework: "",
  });
};

// Watchers
watch(
  () => props.isOpen,
  async (isOpen) => {
    if (isOpen) {
      await loadInitialData();
    }
  }
);

watch(searchQuery, () => {
  searchRepositories();
});

// Lifecycle
const loadInitialData = async () => {
  try {
    console.log("📥 Chargement des repositories...");
    const repos = await getAllRepos({
      type: "all",
      sort: "updated",
      per_page: 100,
    });

    // Normaliser les données
    allRepos.value = repos.map(normalizeRepoData);
    filteredRepos.value = allRepos.value;

    console.log(`✅ ${allRepos.value.length} repos chargés`);
  } catch (error) {
    console.error("Erreur chargement repos:", error);
    allRepos.value = [];
    filteredRepos.value = [];

    notifications.error("Impossible de charger vos repositories", {
      title: "❌ Erreur GitHub",
      message: "Vérifiez votre connexion GitHub et réessayez.",
    });
  }
};

onMounted(() => {
  if (props.isOpen) {
    loadInitialData();
  }
});
</script>

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
        <div class="fixed inset-0 bg-black bg-opacity-25" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div
          class="flex min-h-full items-center justify-center p-4 text-center"
        >
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
              class="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all"
            >
              <!-- Header -->
              <div
                class="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50"
              >
                <div>
                  <DialogTitle
                    class="text-xl font-semibold text-gray-900 flex items-center"
                  >
                    <RocketLaunchIcon class="w-6 h-6 text-blue-600 mr-2" />
                    Créer un nouveau projet
                  </DialogTitle>
                  <p class="mt-1 text-sm text-gray-500">
                    Sélectionnez un repository GitHub et configurez votre
                    déploiement
                  </p>
                </div>
                <button
                  @click="close"
                  class="rounded-md bg-white text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 p-1"
                >
                  <XMarkIcon class="h-6 w-6" />
                </button>
              </div>

              <!-- Indicateur d'étapes -->
              <div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-8">
                    <div class="flex items-center">
                      <div
                        :class="[
                          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                          currentStep >= 1
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-600',
                        ]"
                      >
                        1
                      </div>
                      <span class="ml-2 text-sm font-medium text-gray-700"
                        >Sélection</span
                      >
                    </div>
                    <div class="flex-1 h-1 bg-gray-200 mx-4 rounded">
                      <div
                        :class="[
                          'h-full bg-blue-600 rounded transition-all duration-300',
                          currentStep >= 2 ? 'w-full' : 'w-0',
                        ]"
                      ></div>
                    </div>
                    <div class="flex items-center">
                      <div
                        :class="[
                          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                          currentStep >= 2
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-600',
                        ]"
                      >
                        2
                      </div>
                      <span class="ml-2 text-sm font-medium text-gray-700"
                        >Configuration</span
                      >
                    </div>
                    <div class="flex-1 h-1 bg-gray-200 mx-4 rounded">
                      <div
                        :class="[
                          'h-full bg-blue-600 rounded transition-all duration-300',
                          currentStep >= 3 ? 'w-full' : 'w-0',
                        ]"
                      ></div>
                    </div>
                    <div class="flex items-center">
                      <div
                        :class="[
                          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                          currentStep >= 3
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-600',
                        ]"
                      >
                        3
                      </div>
                      <span class="ml-2 text-sm font-medium text-gray-700"
                        >Création</span
                      >
                    </div>
                  </div>
                </div>
              </div>

              <!-- Contenu principal -->
              <div class="max-h-[70vh] overflow-y-auto">
                <!-- Étape 1: Recherche et sélection du repository -->
                <div v-if="currentStep === 1" class="p-6">
                  <h3 class="text-lg font-medium text-gray-900 mb-4">
                    Choisissez un repository GitHub
                  </h3>

                  <!-- Barre de recherche -->
                  <div class="mb-6">
                    <div class="relative">
                      <MagnifyingGlassIcon
                        class="w-5 h-5 absolute left-3 top-3 text-gray-400"
                      />
                      <input
                        v-model="searchQuery"
                        @input="searchRepositories"
                        type="text"
                        placeholder="Rechercher dans vos repositories..."
                        class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <!-- Chargement -->
                  <div
                    v-if="githubLoading"
                    class="flex items-center justify-center py-12"
                  >
                    <div
                      class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
                    ></div>
                    <span class="ml-3 text-gray-600"
                      >Chargement de vos repositories...</span
                    >
                  </div>

                  <!-- Liste des repositories -->
                  <div
                    v-else
                    class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto"
                  >
                    <div
                      v-for="repo in filteredRepos"
                      :key="repo.id"
                      @click="selectRepository(repo)"
                      :class="[
                        'border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md',
                        selectedRepo?.id === repo.id
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300',
                      ]"
                    >
                      <div class="flex items-start space-x-3">
                        <img
                          :src="repo.owner.avatar"
                          :alt="repo.owner.login"
                          class="w-8 h-8 rounded-full flex-shrink-0"
                        />
                        <div class="flex-1 min-w-0">
                          <h4 class="font-medium text-gray-900 truncate">
                            {{ repo.name }}
                          </h4>
                          <p class="text-sm text-gray-500 truncate">
                            {{ repo.owner.login }}
                          </p>
                          <p
                            v-if="repo.description"
                            class="text-sm text-gray-600 mt-1 line-clamp-2"
                          >
                            {{ repo.description }}
                          </p>
                          <div
                            class="flex items-center mt-2 space-x-3 text-xs text-gray-500"
                          >
                            <span
                              v-if="repo.language"
                              class="flex items-center"
                            >
                              <span
                                class="w-2 h-2 rounded-full mr-1"
                                :style="{
                                  backgroundColor: getLanguageColor(
                                    repo.language
                                  ),
                                }"
                              ></span>
                              {{ repo.language }}
                            </span>
                            <span
                              v-if="repo.stargazersCount > 0"
                              class="flex items-center"
                            >
                              <StarIcon class="w-3 h-3 mr-1" />
                              {{ repo.stargazersCount }}
                            </span>
                            <span class="flex items-center">
                              <ClockIcon class="w-3 h-3 mr-1" />
                              {{ formatDate(repo.pushedAt) }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Aucun repository -->
                  <div
                    v-if="!githubLoading && filteredRepos.length === 0"
                    class="text-center py-12"
                  >
                    <FolderIcon class="mx-auto h-12 w-12 text-gray-400" />
                    <h3 class="mt-2 text-sm font-medium text-gray-900">
                      Aucun repository trouvé
                    </h3>
                    <p class="mt-1 text-sm text-gray-500">
                      {{
                        searchQuery
                          ? "Essayez une autre recherche."
                          : "Créez votre premier repository sur GitHub."
                      }}
                    </p>
                  </div>
                </div>

                <!-- Étape 2: Configuration du projet -->
                <div v-else-if="currentStep === 2" class="p-6">
                  <!-- Repository sélectionné -->
                  <div
                    class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center space-x-3">
                        <img
                          :src="selectedRepo.owner.avatar"
                          :alt="selectedRepo.owner.login"
                          class="w-10 h-10 rounded-full"
                        />
                        <div>
                          <h4 class="font-semibold text-blue-900">
                            {{ selectedRepo.name }}
                          </h4>
                          <p class="text-sm text-blue-600">
                            {{ selectedRepo.fullName }}
                          </p>
                        </div>
                      </div>
                      <button
                        @click="goToStep(1)"
                        class="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Changer
                      </button>
                    </div>
                  </div>

                  <!-- Framework détecté -->
                  <div
                    v-if="detectedFramework"
                    class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6"
                  >
                    <div class="flex items-center">
                      <CheckCircleIcon class="w-5 h-5 text-green-600 mr-3" />
                      <div>
                        <h4 class="font-medium text-green-900">
                          Framework détecté
                        </h4>
                        <p class="text-sm text-green-700">
                          {{ detectedFramework.framework }}
                          <span v-if="detectedFramework.confidence">
                            ({{
                              Math.round(detectedFramework.confidence * 100)
                            }}% de confiance)
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Formulaire de configuration -->
                  <div class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <!-- Nom du projet -->
                      <div>
                        <label
                          class="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Nom du projet *
                        </label>
                        <input
                          v-model="projectConfig.name"
                          type="text"
                          required
                          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="mon-projet"
                        />
                        <p class="mt-1 text-xs text-gray-500">
                          URL: https://{{
                            projectConfig.name || "nom-du-projet"
                          }}.madahost.me
                        </p>
                      </div>

                      <!-- Branche -->
                      <div>
                        <label
                          class="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Branche de déploiement *
                        </label>
                        <select
                          v-model="projectConfig.branch"
                          required
                          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option
                            v-for="branch in availableBranches"
                            :key="branch"
                            :value="branch"
                          >
                            {{ branch }}
                          </option>
                        </select>
                      </div>

                      <!-- Commande de build -->
                      <div>
                        <label
                          class="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Commande de build
                        </label>
                        <input
                          v-model="projectConfig.buildCommand"
                          type="text"
                          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                          placeholder="npm run build"
                        />
                      </div>

                      <!-- Répertoire de sortie -->
                      <div>
                        <label
                          class="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Répertoire de sortie
                        </label>
                        <input
                          v-model="projectConfig.outputDirectory"
                          type="text"
                          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                          placeholder="dist"
                        />
                      </div>

                      <!-- Commande d'installation -->
                      <div class="md:col-span-2">
                        <label
                          class="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Commande d'installation
                        </label>
                        <input
                          v-model="projectConfig.installCommand"
                          type="text"
                          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                          placeholder="npm install"
                        />
                      </div>
                    </div>

                    <!-- Variables d'environnement -->
                    <div>
                      <div class="flex items-center justify-between mb-3">
                        <label class="text-sm font-medium text-gray-700">
                          Variables d'environnement
                        </label>
                        <button
                          type="button"
                          @click="addEnvVar"
                          class="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                        >
                          <PlusIcon class="w-4 h-4 mr-1" />
                          Ajouter une variable
                        </button>
                      </div>

                      <div
                        v-if="projectConfig.envVars.length > 0"
                        class="space-y-2"
                      >
                        <div
                          v-for="(envVar, index) in projectConfig.envVars"
                          :key="index"
                          class="flex gap-2"
                        >
                          <input
                            v-model="envVar.key"
                            type="text"
                            placeholder="VARIABLE_NAME"
                            class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                          />
                          <input
                            v-model="envVar.value"
                            type="text"
                            placeholder="valeur"
                            class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                          />
                          <button
                            type="button"
                            @click="removeEnvVar(index)"
                            class="px-2 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                          >
                            <XMarkIcon class="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- Options avancées -->
                    <div class="border-t border-gray-200 pt-6">
                      <div class="flex items-center space-x-4 mb-4">
                        <input
                          v-model="projectConfig.autoDeployEnabled"
                          type="checkbox"
                          class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label class="text-sm font-medium text-gray-700">
                          Déploiement automatique sur push
                        </label>
                      </div>

                      <div>
                        <label
                          class="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Domaine personnalisé (optionnel)
                        </label>
                        <input
                          v-model="projectConfig.customDomain"
                          type="text"
                          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="monsite.com"
                        />
                      </div>
                    </div>

                    <!-- Aperçu -->
                    <div
                      class="bg-gray-50 border border-gray-200 rounded-lg p-4"
                    >
                      <h4 class="font-medium text-gray-900 mb-3">
                        Aperçu de la configuration
                      </h4>
                      <div
                        class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm"
                      >
                        <div class="space-y-2">
                          <div class="flex justify-between">
                            <span class="text-gray-600">Repository:</span>
                            <span class="font-mono text-gray-900">{{
                              selectedRepo.fullName
                            }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-gray-600">Branche:</span>
                            <span class="font-mono text-gray-900">{{
                              projectConfig.branch
                            }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-gray-600">Framework:</span>
                            <span class="text-gray-900">{{
                              detectedFramework?.framework || "Non détecté"
                            }}</span>
                          </div>
                        </div>
                        <div class="space-y-2">
                          <div class="flex justify-between">
                            <span class="text-gray-600">URL:</span>
                            <span class="font-mono text-blue-600">
                              {{
                                projectConfig.name || "nom-du-projet"
                              }}.madahost.dev
                            </span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-gray-600">Auto-deploy:</span>
                            <span
                              :class="
                                projectConfig.autoDeployEnabled
                                  ? 'text-green-600'
                                  : 'text-gray-500'
                              "
                            >
                              {{
                                projectConfig.autoDeployEnabled
                                  ? "Activé"
                                  : "Désactivé"
                              }}
                            </span>
                          </div>
                          <div
                            v-if="projectConfig.customDomain"
                            class="flex justify-between"
                          >
                            <span class="text-gray-600">Domaine:</span>
                            <span class="font-mono text-green-600">{{
                              projectConfig.customDomain
                            }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Étape 3: Confirmation et création -->
                <div v-else-if="currentStep === 3" class="p-6">
                  <div class="text-center">
                    <!-- En cours de création -->
                    <div v-if="isCreating" class="mb-6">
                      <div
                        class="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"
                      ></div>
                      <h3 class="text-lg font-medium text-gray-900">
                        {{ creationStatus }}
                      </h3>
                      <p class="text-sm text-gray-500 mt-2">
                        Cela peut prendre quelques instants...
                      </p>
                    </div>

                    <!-- Erreur -->
                    <div v-else-if="creationError" class="mb-6">
                      <XCircleIcon
                        class="h-16 w-16 text-red-500 mx-auto mb-4"
                      />
                      <h3 class="text-lg font-medium text-red-900">
                        Erreur lors de la création
                      </h3>
                      <p
                        class="text-sm text-red-600 mt-2 bg-red-50 p-3 rounded-lg"
                      >
                        {{ creationError }}
                      </p>
                      <div class="mt-6 space-x-3">
                        <button
                          @click="goToStep(2)"
                          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          Retour à la configuration
                        </button>
                        <button
                          @click="retryCreation"
                          class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                        >
                          Réessayer
                        </button>
                      </div>
                    </div>

                    <!-- Succès -->
                    <div v-else class="mb-6">
                      <CheckCircleIcon
                        class="h-16 w-16 text-green-500 mx-auto mb-4"
                      />
                      <h3 class="text-lg font-medium text-green-900">
                        Projet créé avec succès !
                      </h3>
                      <p class="text-sm text-gray-500 mt-2">
                        Votre projet
                        <strong>{{ createdProject?.name }}</strong> est
                        maintenant configuré
                      </p>

                      <!-- Informations du projet créé -->
                      <div
                        v-if="createdProject"
                        class="mt-6 bg-green-50 border border-green-200 rounded-lg p-4"
                      >
                        <div class="text-left space-y-2 text-sm">
                          <div class="flex justify-between">
                            <span class="text-gray-600"
                              >URL de déploiement:</span
                            >
                            <a
                              :href="createdProject.url"
                              target="_blank"
                              class="font-mono text-blue-600 hover:text-blue-800"
                            >
                              {{ createdProject.url }}
                            </a>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-gray-600">Repository:</span>
                            <span class="font-mono">{{
                              createdProject.repository?.fullName ||
                              createdProject.github_repo
                            }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-gray-600">Branche:</span>
                            <span class="font-mono">{{
                              createdProject.branch
                            }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-gray-600">Framework:</span>
                            <span class="text-gray-900">{{
                              createdProject.framework || "Non spécifié"
                            }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-gray-600">Auto-deploy:</span>
                            <span
                              :class="
                                createdProject.auto_deploy
                                  ? 'text-green-600'
                                  : 'text-gray-500'
                              "
                            >
                              {{
                                createdProject.auto_deploy
                                  ? "Activé"
                                  : "Désactivé"
                              }}
                            </span>
                          </div>
                        </div>
                      </div>

                      <!-- Actions -->
                      <div class="flex justify-center space-x-4 mt-6">
                        <button
                          @click="viewProject"
                          class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                        >
                          <EyeIcon class="w-4 h-4 mr-2" />
                          Voir le site
                        </button>
                        <button
                          @click="deployNow"
                          class="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                        >
                          <RocketLaunchIcon class="w-4 h-4 mr-2" />
                          Déployer maintenant
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div
                class="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50"
              >
                <div class="text-sm text-gray-500">
                  Étape {{ currentStep }} sur 3
                </div>

                <div class="flex space-x-3">
                  <button
                    v-if="currentStep > 1 && !isCreating"
                    @click="goToStep(currentStep - 1)"
                    class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Précédent
                  </button>

                  <button
                    v-if="currentStep === 1"
                    @click="close"
                    class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>

                  <button
                    v-if="currentStep === 1 && selectedRepo"
                    @click="goToStep(2)"
                    class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                  >
                    Continuer
                    <ChevronRightIcon class="w-4 h-4 ml-2" />
                  </button>

                  <button
                    v-if="currentStep === 2 && !isCreating"
                    @click="createProject"
                    :disabled="!isConfigurationValid"
                    class="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    <RocketLaunchIcon class="w-4 h-4 mr-2" />
                    Créer le projet
                  </button>

                  <button
                    v-if="currentStep === 3 && !isCreating && !creationError"
                    @click="close"
                    class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<style scoped>
/* Line clamp utility */
.line-clamp-2 {
  display: -webkit-box;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Animations fluides */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

/* Amélioration des focus states */
.focus\:ring-2:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px rgb(59 130 246 / 0.5);
}

/* Style pour les inputs monospace */
.font-mono {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas,
    "Liberation Mono", Menlo, monospace;
}

/* Animation pour le loader */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Hover effects pour les cartes de repository */
.hover\:shadow-md:hover {
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}
</style>
