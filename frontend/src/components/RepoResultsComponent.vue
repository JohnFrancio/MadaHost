<template>
  <div class="space-y-4">
    <!-- En-tête des résultats -->
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-4">
        <h3 class="text-lg font-semibold text-gray-900">
          {{ repositories.length }} repository{{
            repositories.length !== 1 ? "s" : ""
          }}
        </h3>

        <!-- Tri -->
        <select
          v-model="sortBy"
          @change="sortRepositories"
          class="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="updated">Dernière mise à jour</option>
          <option value="name">Nom A-Z</option>
          <option value="stars">Plus d'étoiles</option>
          <option value="size">Taille</option>
          <option value="created">Date de création</option>
        </select>

        <!-- Vue (grille/liste) -->
        <div class="flex border border-gray-300 rounded-md overflow-hidden">
          <button
            @click="viewMode = 'grid'"
            :class="[
              'px-3 py-1 text-sm transition-colors',
              viewMode === 'grid'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50',
            ]"
          >
            <Squares2X2Icon class="w-4 h-4" />
          </button>
          <button
            @click="viewMode = 'list'"
            :class="[
              'px-3 py-1 text-sm border-l border-gray-300 transition-colors',
              viewMode === 'list'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50',
            ]"
          >
            <Bars3Icon class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Actions groupées -->
      <div class="flex items-center space-x-2">
        <button
          v-if="selectedRepos.length > 0"
          @click="deployMultiple"
          class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          <RocketLaunchIcon class="w-4 h-4 inline mr-1" />
          Déployer {{ selectedRepos.length }} projet{{
            selectedRepos.length > 1 ? "s" : ""
          }}
        </button>

        <button
          @click="selectAll"
          class="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          {{ allSelected ? "Désélectionner tout" : "Tout sélectionner" }}
        </button>
      </div>
    </div>

    <!-- Chargement -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div
        class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
      ></div>
      <span class="ml-3 text-gray-600">Chargement des repositories...</span>
    </div>

    <!-- Aucun résultat -->
    <div v-else-if="repositories.length === 0" class="text-center py-12">
      <FolderIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-900">
        Aucun repository trouvé
      </h3>
      <p class="mt-1 text-sm text-gray-500">
        Essayez de modifier vos critères de recherche ou créez un nouveau
        repository.
      </p>
      <div class="mt-6">
        <a
          href="https://github.com/new"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          <PlusIcon class="w-4 h-4 mr-2" />
          Créer un repository
        </a>
      </div>
    </div>

    <!-- Résultats en grille -->
    <div
      v-else-if="viewMode === 'grid'"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      <div
        v-for="repo in sortedRepositories"
        :key="repo.id"
        class="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 cursor-pointer group"
        @click="selectRepository(repo)"
      >
        <div class="p-6">
          <!-- Header avec sélection -->
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center space-x-3 flex-1">
              <!-- Avatar du propriétaire -->
              <img
                :src="repo.owner.avatar"
                :alt="repo.owner.login"
                class="w-8 h-8 rounded-full"
              />
              <div class="min-w-0 flex-1">
                <h4
                  class="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors"
                >
                  {{ repo.name }}
                </h4>
                <p class="text-sm text-gray-500">{{ repo.owner.login }}</p>
              </div>
            </div>

            <!-- Checkbox de sélection -->
            <input
              v-model="selectedRepos"
              :value="repo.id"
              type="checkbox"
              @click.stop
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>

          <!-- Description -->
          <p
            v-if="repo.description"
            class="text-sm text-gray-600 mb-4 line-clamp-2"
          >
            {{ repo.description }}
          </p>

          <!-- Métadonnées -->
          <div
            class="flex items-center justify-between text-sm text-gray-500 mb-4"
          >
            <div class="flex items-center space-x-4">
              <!-- Langage -->
              <div v-if="repo.language" class="flex items-center">
                <div
                  class="w-3 h-3 rounded-full mr-1"
                  :style="{ backgroundColor: getLanguageColor(repo.language) }"
                ></div>
                {{ repo.language }}
              </div>

              <!-- Étoiles -->
              <div v-if="repo.stargazersCount > 0" class="flex items-center">
                <StarIcon class="w-4 h-4 mr-1" />
                {{ formatNumber(repo.stargazersCount) }}
              </div>
            </div>

            <!-- Badges -->
            <div class="flex items-center space-x-1">
              <span
                v-if="repo.private"
                class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600"
              >
                <EyeSlashIcon class="w-3 h-3 mr-1" />
                Privé
              </span>
              <span
                v-if="repo.hasPages"
                class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-600"
              >
                <GlobeAltIcon class="w-3 h-3 mr-1" />
                Pages
              </span>
            </div>
          </div>

          <!-- Framework détecté -->
          <div
            v-if="repo.detectedFramework"
            class="flex items-center justify-between mb-4 p-2 bg-blue-50 rounded-md"
          >
            <div class="flex items-center">
              <CodeBracketIcon class="w-4 h-4 text-blue-600 mr-2" />
              <span class="text-sm text-blue-800">{{
                repo.detectedFramework.framework
              }}</span>
            </div>
            <div class="text-xs text-blue-600">
              {{ Math.round(repo.detectedFramework.confidence * 100) }}% sûr
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-between items-center">
            <div class="flex items-center space-x-2 text-xs text-gray-500">
              <ClockIcon class="w-4 h-4" />
              {{ formatDate(repo.pushedAt) }}
            </div>

            <div class="flex space-x-2">
              <button
                @click.stop="viewRepository(repo)"
                class="px-3 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                <EyeIcon class="w-3 h-3 inline mr-1" />
                Voir
              </button>
              <button
                @click.stop="deployRepository(repo)"
                class="px-3 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
              >
                <RocketLaunchIcon class="w-3 h-3 inline mr-1" />
                Déployer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Résultats en liste -->
    <div
      v-else
      class="bg-white rounded-lg border border-gray-200 overflow-hidden"
    >
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="w-12 px-6 py-3">
                <input
                  v-model="allSelected"
                  type="checkbox"
                  @change="toggleSelectAll"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Repository
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Langage
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Framework
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Étoiles
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Mise à jour
              </th>
              <th
                class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="repo in sortedRepositories"
              :key="repo.id"
              class="hover:bg-gray-50 transition-colors"
            >
              <td class="px-6 py-4">
                <input
                  v-model="selectedRepos"
                  :value="repo.id"
                  type="checkbox"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </td>

              <!-- Repository -->
              <td class="px-6 py-4">
                <div class="flex items-center">
                  <img
                    :src="repo.owner.avatar"
                    :alt="repo.owner.login"
                    class="w-8 h-8 rounded-full mr-3"
                  />
                  <div>
                    <div
                      class="text-sm font-medium text-gray-900 hover:text-blue-600 cursor-pointer"
                      @click="selectRepository(repo)"
                    >
                      {{ repo.name }}
                    </div>
                    <div class="text-sm text-gray-500">
                      {{ repo.description || "Aucune description" }}
                    </div>
                  </div>
                  <div class="ml-4 flex space-x-1">
                    <span
                      v-if="repo.private"
                      class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600"
                    >
                      Privé
                    </span>
                    <span
                      v-if="repo.hasPages"
                      class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-600"
                    >
                      Pages
                    </span>
                  </div>
                </div>
              </td>

              <!-- Langage -->
              <td class="px-6 py-4 text-sm text-gray-900">
                <div v-if="repo.language" class="flex items-center">
                  <div
                    class="w-3 h-3 rounded-full mr-2"
                    :style="{
                      backgroundColor: getLanguageColor(repo.language),
                    }"
                  ></div>
                  {{ repo.language }}
                </div>
                <span v-else class="text-gray-500">-</span>
              </td>

              <!-- Framework -->
              <td class="px-6 py-4 text-sm text-gray-900">
                <div v-if="repo.detectedFramework" class="flex items-center">
                  <CodeBracketIcon class="w-4 h-4 text-blue-600 mr-1" />
                  {{ repo.detectedFramework.framework }}
                  <span class="ml-2 text-xs text-gray-500">
                    ({{ Math.round(repo.detectedFramework.confidence * 100) }}%)
                  </span>
                </div>
                <span v-else class="text-gray-500">-</span>
              </td>

              <!-- Étoiles -->
              <td class="px-6 py-4 text-sm text-gray-900">
                <div class="flex items-center">
                  <StarIcon class="w-4 h-4 text-yellow-400 mr-1" />
                  {{ formatNumber(repo.stargazersCount) }}
                </div>
              </td>

              <!-- Mise à jour -->
              <td class="px-6 py-4 text-sm text-gray-500">
                {{ formatDate(repo.pushedAt) }}
              </td>

              <!-- Actions -->
              <td class="px-6 py-4 text-right text-sm font-medium space-x-2">
                <button
                  @click="viewRepository(repo)"
                  class="text-blue-600 hover:text-blue-900 transition-colors"
                >
                  Voir
                </button>
                <button
                  @click="deployRepository(repo)"
                  class="text-green-600 hover:text-green-900 transition-colors"
                >
                  Déployer
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination -->
    <div
      v-if="repositories.length > 0"
      class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6"
    >
      <div class="flex flex-1 justify-between sm:hidden">
        <button
          :disabled="currentPage <= 1"
          @click="previousPage"
          class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Précédent
        </button>
        <button
          :disabled="currentPage >= totalPages"
          @click="nextPage"
          class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Suivant
        </button>
      </div>
      <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p class="text-sm text-gray-700">
            Affichage de <span class="font-medium">{{ startIndex }}</span> à
            <span class="font-medium">{{ endIndex }}</span> sur
            <span class="font-medium">{{ repositories.length }}</span> résultats
          </p>
        </div>
        <div>
          <nav
            class="isolate inline-flex -space-x-px rounded-md shadow-sm"
            aria-label="Pagination"
          >
            <button
              :disabled="currentPage <= 1"
              @click="previousPage"
              class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <ChevronLeftIcon class="h-5 w-5" />
            </button>

            <button
              v-for="page in visiblePages"
              :key="page"
              @click="goToPage(page)"
              :class="[
                'relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20',
                page === currentPage
                  ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                  : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0',
              ]"
            >
              {{ page }}
            </button>

            <button
              :disabled="currentPage >= totalPages"
              @click="nextPage"
              class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <ChevronRightIcon class="h-5 w-5" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import {
  StarIcon,
  EyeIcon,
  EyeSlashIcon,
  GlobeAltIcon,
  CodeBracketIcon,
  ClockIcon,
  RocketLaunchIcon,
  FolderIcon,
  PlusIcon,
  Squares2X2Icon,
  Bars3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/vue/24/outline";
import { useGitHub } from "@/composables/useGitHub";

const emit = defineEmits(["select", "deploy", "view", "deployMultiple"]);
const props = defineProps({
  repositories: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const { getLanguageColor, formatRepoSize } = useGitHub();

// État local
const sortBy = ref("updated");
const viewMode = ref("grid");
const selectedRepos = ref([]);
const itemsPerPage = 12;
const currentPage = ref(1);

// Computed
const sortedRepositories = computed(() => {
  const repos = [...props.repositories];

  switch (sortBy.value) {
    case "name":
      return repos.sort((a, b) => a.name.localeCompare(b.name));
    case "stars":
      return repos.sort((a, b) => b.stargazersCount - a.stargazersCount);
    case "size":
      return repos.sort((a, b) => b.size - a.size);
    case "created":
      return repos.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    case "updated":
    default:
      return repos.sort((a, b) => new Date(b.pushedAt) - new Date(a.pushedAt));
  }
});

const paginatedRepositories = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return sortedRepositories.value.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(props.repositories.length / itemsPerPage);
});

const startIndex = computed(() => {
  return (currentPage.value - 1) * itemsPerPage + 1;
});

const endIndex = computed(() => {
  return Math.min(currentPage.value * itemsPerPage, props.repositories.length);
});

const visiblePages = computed(() => {
  const pages = [];
  const total = totalPages.value;
  const current = currentPage.value;

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    if (current <= 3) {
      for (let i = 1; i <= 5; i++) {
        pages.push(i);
      }
      pages.push("...", total);
    } else if (current >= total - 2) {
      pages.push(1, "...");
      for (let i = total - 4; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1, "...");
      for (let i = current - 1; i <= current + 1; i++) {
        pages.push(i);
      }
      pages.push("...", total);
    }
  }

  return pages;
});

const allSelected = computed({
  get: () =>
    selectedRepos.value.length === props.repositories.length &&
    props.repositories.length > 0,
  set: (value) => {
    selectedRepos.value = value ? props.repositories.map((r) => r.id) : [];
  },
});

// Méthodes
const sortRepositories = () => {
  currentPage.value = 1;
};

const selectRepository = (repo) => {
  emit("select", repo);
};

const deployRepository = (repo) => {
  emit("deploy", repo);
};

const viewRepository = (repo) => {
  emit("view", repo);
};

const deployMultiple = () => {
  const repos = props.repositories.filter((r) =>
    selectedRepos.value.includes(r.id)
  );
  emit("deployMultiple", repos);
};

const selectAll = () => {
  allSelected.value = !allSelected.value;
};

const toggleSelectAll = () => {
  selectedRepos.value = allSelected.value
    ? props.repositories.map((r) => r.id)
    : [];
};

const goToPage = (page) => {
  if (page !== "..." && page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};

const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toString();
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

// Watchers
watch(
  () => props.repositories,
  () => {
    currentPage.value = 1;
    selectedRepos.value = [];
  }
);
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
