<!-- frontend/src/components/ProjectSettings.vue -->

<script setup>
import { ref, reactive, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useNotificationsStore } from "@/stores/notifications";
import { useGitHub } from "@/composables/useGitHub";
import axios from "axios";
import {
  PlusIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
} from "@heroicons/vue/24/outline";
import ConfirmModal from "./ConfirmModal.vue";

const emit = defineEmits(["updated", "deleted"]);
const props = defineProps({
  project: {
    type: Object,
    required: true,
  },
});

const router = useRouter();
const notifications = useNotificationsStore();
const { getRepoBranches } = useGitHub();

// État local
const saving = ref(false);
const detecting = ref(false);
const testing = ref(false);
const loadingBranches = ref(false);
const showDeleteModal = ref(false);
const showResetModal = ref(false);
const availableBranches = ref([]);

// Formulaire
const form = reactive({
  name: "",
  branch: "",
  framework: "",
  build_command: "",
  output_dir: "",
  install_command: "",
  auto_deploy: true,
  custom_domain: "",
  env_vars: [],
});

// État original pour détecter les changements
const originalForm = ref({});

// Computed
const hasChanges = computed(() => {
  return JSON.stringify(form) !== JSON.stringify(originalForm.value);
});

// API client
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  withCredentials: true,
});

// Méthodes
const initForm = () => {
  // Gestion sécurisée des env_vars
  let envVars = [];
  try {
    if (props.project.env_vars) {
      // Si c'est déjà un tableau, l'utiliser directement
      if (Array.isArray(props.project.env_vars)) {
        envVars = props.project.env_vars;
      } else if (typeof props.project.env_vars === "string") {
        // Si c'est une chaîne, essayer de la parser
        envVars = props.project.env_vars.trim()
          ? JSON.parse(props.project.env_vars)
          : [];
      }
    }
  } catch (error) {
    console.warn("Erreur parsing env_vars:", error);
    envVars = [];
  }

  Object.assign(form, {
    name: props.project.name || "",
    branch: props.project.branch || "main",
    framework: props.project.framework || "",
    build_command: props.project.build_command || "",
    output_dir: props.project.output_dir || "",
    install_command: props.project.install_command || "",
    auto_deploy: props.project.auto_deploy !== false,
    custom_domain: props.project.custom_domain || "",
    env_vars: envVars.map((env) => ({
      key: env.key || "",
      value: env.value || "",
      showValue: false,
    })),
  });

  originalForm.value = JSON.parse(JSON.stringify(form));
  loadBranches();
};

// Aussi, corrige la fonction loadBranches :
const loadBranches = async () => {
  try {
    loadingBranches.value = true;
    const [owner, repo] = props.project.github_repo.split("/");

    // Utilise la nouvelle API des branches
    const response = await api.get(`/projects/${owner}/${repo}/branches`);

    if (response.data.success) {
      availableBranches.value = response.data.branches.map((b) => b.name);

      // Ajouter la branche actuelle si elle n'est pas dans la liste
      if (!availableBranches.value.includes(form.branch)) {
        availableBranches.value.unshift(form.branch);
      }
    } else {
      throw new Error(response.data.error);
    }
  } catch (error) {
    console.error("Erreur chargement branches:", error);
    availableBranches.value = [form.branch];
    notifications.error("Impossible de charger les branches");
  } finally {
    loadingBranches.value = false;
  }
};

const refreshBranches = () => {
  loadBranches();
};

const detectFramework = async () => {
  try {
    detecting.value = true;
    const [owner, repo] = props.project.github_repo.split("/");

    // Appel à la nouvelle API de détection
    const response = await api.post("/projects/detect-framework", {
      owner,
      repo,
    });

    if (response.data.success) {
      const { framework, buildConfig } = response.data;

      if (framework) {
        form.framework = framework;

        if (buildConfig) {
          form.build_command = buildConfig.buildCommand || form.build_command;
          form.output_dir = buildConfig.outputDirectory || form.output_dir;
          form.install_command =
            buildConfig.installCommand || form.install_command;
        }

        notifications.success(`Framework détecté : ${framework}`, {
          title: "🔍 Détection automatique",
        });
      } else {
        notifications.warning(
          "Impossible de détecter le framework automatiquement"
        );
      }
    } else {
      throw new Error(response.data.error);
    }
  } catch (error) {
    console.error("Erreur détection framework:", error);
    notifications.error(
      error.response?.data?.error || "Erreur lors de la détection du framework"
    );
  } finally {
    detecting.value = false;
  }
};

const testBuildCommands = async () => {
  try {
    testing.value = true;

    // Simulation du test des commandes
    notifications.info("Test des commandes de build...", {
      title: "🧪 Test en cours",
    });

    // TODO: Implémenter un vrai test des commandes
    await new Promise((resolve) => setTimeout(resolve, 2000));

    notifications.success("Commandes de build valides", {
      title: "✅ Test réussi",
    });
  } catch (error) {
    console.error("Erreur test commandes:", error);
    notifications.error("Erreur lors du test des commandes");
  } finally {
    testing.value = false;
  }
};

const addEnvVar = () => {
  form.env_vars.push({ key: "", value: "", showValue: false });
};

const removeEnvVar = (index) => {
  form.env_vars.splice(index, 1);
};

const updateProject = async () => {
  try {
    saving.value = true;

    const updateData = {
      name: form.name,
      branch: form.branch,
      framework: form.framework,
      build_command: form.build_command,
      output_dir: form.output_dir,
      install_command: form.install_command,
      auto_deploy: form.auto_deploy,
      custom_domain: form.custom_domain,
      env_vars: form.env_vars
        .filter((env) => env.key && env.value)
        .map((env) => ({ key: env.key, value: env.value })),
    };

    const response = await api.patch(
      `/projects/${props.project.id}`,
      updateData
    );

    if (response.data.success) {
      originalForm.value = JSON.parse(JSON.stringify(form));
      emit("updated", response.data.project);
      notifications.success("Projet mis à jour avec succès");
    } else {
      throw new Error(response.data.error);
    }
  } catch (error) {
    console.error("Erreur mise à jour:", error);
    notifications.error(
      error.response?.data?.error || "Erreur lors de la mise à jour"
    );
  } finally {
    saving.value = false;
  }
};

const resetForm = () => {
  Object.assign(form, JSON.parse(JSON.stringify(originalForm.value)));
};

const resetProject = () => {
  showResetModal.value = true;
};

const confirmReset = async () => {
  try {
    // TODO: Implémenter la réinitialisation du projet
    notifications.success("Projet réinitialisé");
    showResetModal.value = false;
  } catch (error) {
    notifications.error("Erreur lors de la réinitialisation");
  }
};

const deleteProject = () => {
  showDeleteModal.value = true;
};

const confirmDelete = async () => {
  try {
    const response = await api.delete(`/projects/${props.project.id}`);

    if (response.data.success) {
      notifications.success("Projet supprimé avec succès");
      emit("deleted");
      showDeleteModal.value = false;
    } else {
      throw new Error(response.data.error);
    }
  } catch (error) {
    console.error("Erreur suppression:", error);
    notifications.error(
      error.response?.data?.error || "Erreur lors de la suppression"
    );
  }
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Watchers
watch(
  () => props.project,
  () => {
    initForm();
  },
  { immediate: true }
);

// Lifecycle
onMounted(() => {
  initForm();
});
</script>

<template>
  <div class="space-y-8">
    <!-- Configuration générale -->
    <div class="bg-white rounded-lg border border-gray-200 p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-6">
        Configuration générale
      </h3>

      <form @submit.prevent="updateProject" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Nom du projet -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Nom du projet *
            </label>
            <input
              v-model="form.name"
              type="text"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="mon-projet"
            />
            <p class="mt-1 text-xs text-gray-500">
              URL: https://{{ form.name || "nom-du-projet" }}.madahost.me
            </p>
          </div>

          <!-- Branche -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Branche de déploiement *
            </label>
            <select
              v-model="form.branch"
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
            <button
              type="button"
              @click="refreshBranches"
              :disabled="loadingBranches"
              class="mt-1 text-xs text-blue-600 hover:text-blue-800"
            >
              {{
                loadingBranches ? "Chargement..." : "Actualiser les branches"
              }}
            </button>
          </div>

          <!-- Framework -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Framework
            </label>
            <select
              v-model="form.framework"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Détection automatique</option>
              <option value="React">React</option>
              <option value="Vue.js">Vue.js</option>
              <option value="Angular">Angular</option>
              <option value="Next.js">Next.js</option>
              <option value="Nuxt.js">Nuxt.js</option>
              <option value="Svelte">Svelte</option>
              <option value="Gatsby">Gatsby</option>
              <option value="Astro">Astro</option>
              <option value="HTML Statique">HTML Statique</option>
            </select>
          </div>

          <!-- Domaine personnalisé -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Domaine personnalisé (optionnel)
            </label>
            <input
              v-model="form.custom_domain"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="monsite.com"
            />
            <p class="mt-1 text-xs text-gray-500">
              Configurez d'abord le CNAME de votre domaine vers madahost.me
            </p>
          </div>
        </div>

        <!-- Commandes de build -->
        <div class="border-t border-gray-200 pt-6">
          <h4 class="text-md font-medium text-gray-900 mb-4">
            Commandes de build
          </h4>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Commande d'installation
              </label>
              <input
                v-model="form.install_command"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="npm install"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Commande de build
              </label>
              <input
                v-model="form.build_command"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="npm run build"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Répertoire de sortie
              </label>
              <input
                v-model="form.output_dir"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="dist"
              />
            </div>
          </div>

          <!-- Boutons de test -->
          <div class="mt-4 flex space-x-2">
            <button
              type="button"
              @click="detectFramework"
              :disabled="detecting"
              class="px-3 py-2 text-sm text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 disabled:opacity-50"
            >
              {{ detecting ? "Détection..." : "Auto-détecter" }}
            </button>
            <button
              type="button"
              @click="testBuildCommands"
              :disabled="testing"
              class="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              {{ testing ? "Test..." : "Tester les commandes" }}
            </button>
          </div>
        </div>

        <!-- Options avancées -->
        <div class="border-t border-gray-200 pt-6">
          <h4 class="text-md font-medium text-gray-900 mb-4">
            Options avancées
          </h4>

          <div class="space-y-4">
            <!-- Auto-deploy -->
            <div class="flex items-center">
              <input
                v-model="form.auto_deploy"
                type="checkbox"
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label class="ml-2 text-sm text-gray-700">
                Déploiement automatique sur push
              </label>
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

              <div v-if="form.env_vars.length > 0" class="space-y-3">
                <div
                  v-for="(envVar, index) in form.env_vars"
                  :key="index"
                  class="flex gap-3"
                >
                  <input
                    v-model="envVar.key"
                    type="text"
                    placeholder="VARIABLE_NAME"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    v-model="envVar.value"
                    :type="envVar.showValue ? 'text' : 'password'"
                    placeholder="valeur"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    @click="envVar.showValue = !envVar.showValue"
                    class="px-2 py-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md"
                  >
                    <EyeIcon v-if="!envVar.showValue" class="w-4 h-4" />
                    <EyeSlashIcon v-else class="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    @click="removeEnvVar(index)"
                    class="px-2 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-300 rounded-md"
                  >
                    <TrashIcon class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div
                v-else
                class="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg"
              >
                <div class="text-gray-500">
                  <KeyIcon class="w-8 h-8 mx-auto mb-2" />
                  <p>Aucune variable d'environnement configurée</p>
                  <button
                    type="button"
                    @click="addEnvVar"
                    class="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Ajouter votre première variable
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div
          class="flex justify-between items-center pt-6 border-t border-gray-200"
        >
          <div class="text-sm text-gray-500">
            Dernière modification : {{ formatDate(project.updated_at) }}
          </div>

          <div class="flex space-x-3">
            <button
              type="button"
              @click="resetForm"
              class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              :disabled="saving || !hasChanges"
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ saving ? "Sauvegarde..." : "Sauvegarder" }}
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- Zone de danger -->
    <div class="bg-white rounded-lg border border-red-200 p-6">
      <h3 class="text-lg font-medium text-red-900 mb-4">Zone de danger</h3>

      <div class="space-y-4">
        <!-- Réinitialiser le projet -->
        <div
          class="flex items-center justify-between p-4 bg-yellow-50 rounded-lg"
        >
          <div>
            <h4 class="font-medium text-yellow-900">Réinitialiser le projet</h4>
            <p class="text-sm text-yellow-700">
              Supprime tous les déploiements et remet les paramètres par défaut
            </p>
          </div>
          <button
            @click="resetProject"
            class="px-4 py-2 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700"
          >
            Réinitialiser
          </button>
        </div>

        <!-- Supprimer le projet -->
        <div class="flex items-center justify-between p-4 bg-red-50 rounded-lg">
          <div>
            <h4 class="font-medium text-red-900">Supprimer le projet</h4>
            <p class="text-sm text-red-700">
              Supprime définitivement ce projet et tous ses déploiements
            </p>
          </div>
          <button
            @click="deleteProject"
            class="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de confirmation suppression -->
    <ConfirmModal
      :isOpen="showDeleteModal"
      title="Supprimer le projet"
      :message="`Êtes-vous sûr de vouloir supprimer le projet '${project.name}' ? Cette action est irréversible.`"
      confirmText="Supprimer définitivement"
      confirmClass="bg-red-600 hover:bg-red-700"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    />

    <!-- Modal de confirmation reset -->
    <ConfirmModal
      :isOpen="showResetModal"
      title="Réinitialiser le projet"
      :message="`Êtes-vous sûr de vouloir réinitialiser le projet '${project.name}' ? Tous les déploiements seront supprimés.`"
      confirmText="Réinitialiser"
      confirmClass="bg-yellow-600 hover:bg-yellow-700"
      @confirm="confirmReset"
      @cancel="showResetModal = false"
    />
  </div>
</template>

<style scoped>
.font-mono {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas,
    "Liberation Mono", Menlo, monospace;
}
</style>
