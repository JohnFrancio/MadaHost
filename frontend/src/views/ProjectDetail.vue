<script setup>
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";

const route = useRoute();
const router = useRouter();

// État
const project = ref(null);
const editableProject = ref({});
const deployments = ref([]);
const editing = ref(false);
const deploying = ref(false);

// Méthodes utilitaires
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

const getStatusClass = (status) => {
  const classMap = {
    active: "bg-green-100 text-green-800",
    building: "bg-yellow-100 text-yellow-800",
    error: "bg-red-100 text-red-800",
    inactive: "bg-gray-100 text-gray-800",
    created: "bg-blue-100 text-blue-800",
  };
  return classMap[status] || "bg-gray-100 text-gray-800";
};

const getDeploymentStatusClass = (status) => {
  const classMap = {
    success: "bg-green-500",
    failed: "bg-red-500",
    pending: "bg-yellow-500",
    building: "bg-blue-500",
  };
  return classMap[status] || "bg-gray-500";
};

const getDeploymentStatusTextClass = (status) => {
  const classMap = {
    success: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    pending: "bg-yellow-100 text-yellow-800",
    building: "bg-blue-100 text-blue-800",
  };
  return classMap[status] || "bg-gray-100 text-gray-800";
};

const getDeploymentStatusText = (status) => {
  const statusMap = {
    success: "Réussi",
    failed: "Échoué",
    pending: "En attente",
    building: "Construction",
  };
  return statusMap[status] || status;
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString("fr-FR");
};

// Actions
const loadProject = async () => {
  try {
    const response = await axios.get(`/api/projects/${route.params.id}`);
    project.value = response.data.project;
    editableProject.value = { ...response.data.project };
  } catch (error) {
    console.error("Erreur lors du chargement du projet:", error);
    router.push("/dashboard");
  }
};

const loadDeployments = async () => {
  try {
    const response = await axios.get(
      `/api/projects/${route.params.id}/deployments`
    );
    deployments.value = response.data.deployments || [];
  } catch (error) {
    console.error("Erreur lors du chargement des déploiements:", error);
  }
};

const deployProject = async () => {
  deploying.value = true;
  try {
    const response = await axios.post(
      `/api/projects/${route.params.id}/deploy`
    );
    console.log("Déploiement initié:", response.data);
    // Recharger les données
    await loadDeployments();
    await loadProject();
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

const startEditing = () => {
  editing.value = true;
  editableProject.value = { ...project.value };
};

const cancelEditing = () => {
  editing.value = false;
  editableProject.value = { ...project.value };
};

const saveProject = async () => {
  try {
    const response = await axios.put(
      `/api/projects/${route.params.id}`,
      editableProject.value
    );
    project.value = response.data.project;
    editing.value = false;
    console.log("Projet sauvegardé");
  } catch (error) {
    console.error("Erreur lors de la sauvegarde:", error);
    alert(
      "Erreur lors de la sauvegarde: " +
        (error.response?.data?.error || error.message)
    );
  }
};

const confirmDelete = () => {
  if (
    confirm(
      "Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible."
    )
  ) {
    deleteProject();
  }
};

const deleteProject = async () => {
  try {
    await axios.delete(`/api/projects/${route.params.id}`);
    router.push("/dashboard");
  } catch (error) {
    console.error("Erreur lors de la suppression:", error);
    alert(
      "Erreur lors de la suppression: " +
        (error.response?.data?.error || error.message)
    );
  }
};

const viewLogs = (deployment) => {
  // Afficher les logs dans une alerte pour l'instant
  alert(
    "Logs du déploiement:\n\n" +
      (deployment.build_log || "Aucun log disponible")
  );
};

// Lifecycle
onMounted(async () => {
  await loadProject();
  await loadDeployments();
});
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <!-- En-tête -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <div class="flex items-center gap-4 mb-2">
            <button
              @click="$router.push('/dashboard')"
              class="text-gray-500 hover:text-gray-700"
            >
              ← Retour au dashboard
            </button>
          </div>
          <h1 class="text-3xl font-bold text-gray-900">{{ project?.name }}</h1>
          <p class="text-gray-600 mt-1">{{ project?.github_repo }}</p>
        </div>
        <div class="flex items-center gap-4">
          <span
            :class="getStatusClass(project?.status)"
            class="px-3 py-1 rounded-full text-sm font-medium"
          >
            {{ getStatusText(project?.status) }}
          </span>
          <button
            @click="deployProject"
            :disabled="deploying"
            class="btn-primary"
          >
            {{ deploying ? "Déploiement..." : "Déployer" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Stats rapides -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="card">
        <div class="text-2xl font-bold text-gray-900">
          {{ deployments.length }}
        </div>
        <div class="text-gray-600">Déploiements</div>
      </div>
      <div class="card">
        <div class="text-2xl font-bold text-green-600">
          {{ deployments.filter((d) => d.status === "success").length }}
        </div>
        <div class="text-gray-600">Réussis</div>
      </div>
      <div class="card">
        <div class="text-2xl font-bold text-blue-600">
          {{ project?.framework || "Auto" }}
        </div>
        <div class="text-gray-600">Framework</div>
      </div>
      <div class="card">
        <div class="text-2xl font-bold text-gray-900">
          {{ project?.branch || "main" }}
        </div>
        <div class="text-gray-600">Branche</div>
      </div>
    </div>

    <!-- Informations du projet -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
      <!-- Configuration -->
      <div class="lg:col-span-2">
        <div class="card">
          <h2 class="text-xl font-semibold mb-6">Configuration</h2>
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Commande d'installation
                </label>
                <input
                  v-model="editableProject.install_command"
                  :readonly="!editing"
                  :class="
                    editing ? 'border-blue-300' : 'border-gray-300 bg-gray-50'
                  "
                  class="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Commande de build
                </label>
                <input
                  v-model="editableProject.build_command"
                  :readonly="!editing"
                  :class="
                    editing ? 'border-blue-300' : 'border-gray-300 bg-gray-50'
                  "
                  class="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Dossier de sortie
                </label>
                <input
                  v-model="editableProject.output_dir"
                  :readonly="!editing"
                  :class="
                    editing ? 'border-blue-300' : 'border-gray-300 bg-gray-50'
                  "
                  class="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Branche
                </label>
                <input
                  v-model="editableProject.branch"
                  :readonly="!editing"
                  :class="
                    editing ? 'border-blue-300' : 'border-gray-300 bg-gray-50'
                  "
                  class="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-4">
              <button
                v-if="!editing"
                @click="startEditing"
                class="btn-secondary"
              >
                Modifier
              </button>
              <template v-else>
                <button @click="cancelEditing" class="btn-secondary">
                  Annuler
                </button>
                <button @click="saveProject" class="btn-primary">
                  Sauvegarder
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions et liens -->
      <div class="space-y-6">
        <!-- Lien du site -->
        <div
          class="card"
          v-if="project?.domain && project?.status === 'active'"
        >
          <h3 class="font-semibold mb-3">Site en ligne</h3>
          <a
            :href="`https://${project.domain}`"
            target="_blank"
            class="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
          >
            <span class="text-green-700 font-medium">{{ project.domain }}</span>
            <svg
              class="w-4 h-4 text-green-600"
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
        </div>

        <!-- Actions -->
        <div class="card">
          <h3 class="font-semibold mb-3">Actions</h3>
          <div class="space-y-2">
            <button
              @click="deployProject"
              :disabled="deploying"
              class="w-full btn-primary"
            >
              {{ deploying ? "Déploiement en cours..." : "Redéployer" }}
            </button>
            <a
              :href="`https://github.com/${project?.github_repo}`"
              target="_blank"
              class="w-full btn-secondary text-center block"
            >
              Voir sur GitHub
            </a>
            <button
              @click="confirmDelete"
              class="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Supprimer le projet
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Historique des déploiements -->
    <div class="card">
      <h2 class="text-xl font-semibold mb-6">Historique des déploiements</h2>
      <div class="space-y-4">
        <div
          v-for="deployment in deployments"
          :key="deployment.id"
          class="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
        >
          <div class="flex items-center gap-4">
            <div
              :class="getDeploymentStatusClass(deployment.status)"
              class="w-3 h-3 rounded-full"
            ></div>
            <div>
              <div class="font-medium">
                Déploiement
                {{ deployment.commit_hash?.substring(0, 7) || "latest" }}
              </div>
              <div class="text-sm text-gray-600">
                {{ formatDate(deployment.started_at) }}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span
              :class="getDeploymentStatusTextClass(deployment.status)"
              class="px-2 py-1 rounded text-xs font-medium"
            >
              {{ getDeploymentStatusText(deployment.status) }}
            </span>
            <button
              v-if="deployment.build_log"
              @click="viewLogs(deployment)"
              class="text-blue-600 hover:text-blue-700 text-sm"
            >
              Voir logs
            </button>
          </div>
        </div>
        <div
          v-if="deployments.length === 0"
          class="text-center py-8 text-gray-500"
        >
          Aucun déploiement pour le moment
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="!project" class="text-center py-12">
      <div
        class="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"
      ></div>
      <p class="mt-4 text-gray-600">Chargement du projet...</p>
    </div>
  </div>
</template>
