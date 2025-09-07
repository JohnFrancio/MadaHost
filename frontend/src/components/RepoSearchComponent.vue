<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
    <!-- Titre et toggle filtres avancés -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900">
        <MagnifyingGlassIcon class="w-5 h-5 inline mr-2" />
        Rechercher dans vos repositories
      </h3>
      <button
        @click="showAdvancedFilters = !showAdvancedFilters"
        class="text-sm text-blue-600 hover:text-blue-800 transition-colors"
      >
        {{ showAdvancedFilters ? "Masquer" : "Filtres avancés" }}
      </button>
    </div>

    <!-- Barre de recherche principale -->
    <div class="relative mb-4">
      <MagnifyingGlassIcon
        class="w-5 h-5 absolute left-3 top-3 text-gray-400"
      />
      <input
        v-model="searchQuery"
        @input="onSearchInput"
        type="text"
        placeholder="Rechercher par nom ou description..."
        class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      <!-- Bouton clear -->
      <button
        v-if="searchQuery"
        @click="clearSearch"
        class="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
      >
        <XMarkIcon class="w-4 h-4" />
      </button>
    </div>

    <!-- Filtres rapides -->
    <div class="flex flex-wrap gap-2 mb-4">
      <button
        v-for="filter in quickFilters"
        :key="filter.key"
        @click="applyQuickFilter(filter)"
        :class="[
          'px-3 py-1 text-xs rounded-full border transition-colors',
          isQuickFilterActive(filter)
            ? 'bg-blue-100 border-blue-300 text-blue-700'
            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100',
        ]"
      >
        <component :is="filter.icon" class="w-3 h-3 inline mr-1" />
        {{ filter.label }}
      </button>
    </div>

    <!-- Filtres avancés (collapsible) -->
    <transition name="slide-down">
      <div
        v-if="showAdvancedFilters"
        class="border-t border-gray-200 pt-4 space-y-4"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <!-- Langage -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Langage</label
            >
            <select
              v-model="filters.language"
              @change="onFilterChange"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">Tous les langages</option>
              <option
                v-for="lang in availableLanguages"
                :key="lang"
                :value="lang"
              >
                {{ lang }}
              </option>
            </select>
          </div>

          <!-- Framework -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Framework</label
            >
            <select
              v-model="filters.framework"
              @change="onFilterChange"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">Tous les frameworks</option>
              <option value="react">React</option>
              <option value="vue">Vue.js</option>
              <option value="angular">Angular</option>
              <option value="next">Next.js</option>
              <option value="nuxt">Nuxt.js</option>
              <option value="svelte">Svelte</option>
              <option value="gatsby">Gatsby</option>
            </select>
          </div>

          <!-- Type de repository -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Type</label
            >
            <select
              v-model="filters.isPrivate"
              @change="onFilterChange"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option :value="null">Public et Privé</option>
              <option :value="false">Public uniquement</option>
              <option :value="true">Privé uniquement</option>
            </select>
          </div>

          <!-- GitHub Pages -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >GitHub Pages</label
            >
            <select
              v-model="filters.hasPages"
              @change="onFilterChange"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option :value="null">Tous</option>
              <option :value="true">Avec Pages</option>
              <option :value="false">Sans Pages</option>
            </select>
          </div>

          <!-- Étoiles minimum -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Étoiles minimum: {{ filters.minStars }}
            </label>
            <input
              v-model.number="filters.minStars"
              @input="onFilterChange"
              type="range"
              min="0"
              max="100"
              step="1"
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          <!-- Activité récente -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Activité récente</label
            >
            <select
              v-model="filters.maxAge"
              @change="onFilterChange"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option :value="null">Toute période</option>
              <option :value="7">Cette semaine</option>
              <option :value="30">Ce mois</option>
              <option :value="90">3 derniers mois</option>
              <option :value="365">Cette année</option>
            </select>
          </div>
        </div>

        <!-- Actions filtres -->
        <div
          class="flex justify-between items-center pt-4 border-t border-gray-200"
        >
          <div class="text-sm text-gray-500">
            {{ totalResults }} résultat{{
              totalResults !== 1 ? "s" : ""
            }}
            trouvé{{ totalResults !== 1 ? "s" : "" }}
          </div>
          <div class="space-x-2">
            <button
              @click="resetFilters"
              class="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Réinitialiser
            </button>
            <button
              @click="exportResults"
              :disabled="totalResults === 0"
              class="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowDownTrayIcon class="w-4 h-4 inline mr-1" />
              Exporter
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Indicateurs de filtres actifs -->
    <div v-if="hasActiveFilters" class="flex flex-wrap gap-2 mt-4">
      <div class="text-xs text-gray-500 mr-2">Filtres actifs:</div>
      <span
        v-for="(filter, key) in activeFiltersDisplay"
        :key="key"
        class="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
      >
        {{ filter }}
        <button
          @click="removeFilter(key)"
          class="ml-1 hover:bg-blue-200 rounded-full p-0.5"
        >
          <XMarkIcon class="w-3 h-3" />
        </button>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from "vue";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  StarIcon,
  EyeIcon,
  EyeSlashIcon,
  DocumentTextIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  CodeBracketIcon,
} from "@heroicons/vue/24/outline";
import { useGitHub } from "@/composables/useGitHub";

const emit = defineEmits(["search", "filtersChange"]);
const props = defineProps({
  availableLanguages: {
    type: Array,
    default: () => [],
  },
  totalResults: {
    type: Number,
    default: 0,
  },
});

const { searchRepos, loading } = useGitHub();

// État local
const searchQuery = ref("");
const showAdvancedFilters = ref(false);
let searchTimeout = null;

// Filtres
const filters = reactive({
  language: "",
  framework: "",
  isPrivate: null,
  hasPages: null,
  minStars: 0,
  maxAge: null,
});

// Filtres rapides
const quickFilters = ref([
  {
    key: "starred",
    label: "Populaires",
    icon: StarIcon,
    apply: () => {
      filters.minStars = 5;
    },
  },
  {
    key: "public",
    label: "Public",
    icon: EyeIcon,
    apply: () => {
      filters.isPrivate = false;
    },
  },
  {
    key: "private",
    label: "Privé",
    icon: EyeSlashIcon,
    apply: () => {
      filters.isPrivate = true;
    },
  },
  {
    key: "pages",
    label: "Avec Pages",
    icon: DocumentTextIcon,
    apply: () => {
      filters.hasPages = true;
    },
  },
  {
    key: "recent",
    label: "Récents",
    icon: ClockIcon,
    apply: () => {
      filters.maxAge = 30;
    },
  },
  {
    key: "javascript",
    label: "JavaScript",
    icon: CodeBracketIcon,
    apply: () => {
      filters.language = "JavaScript";
    },
  },
]);

// Computed
const hasActiveFilters = computed(() => {
  return (
    searchQuery.value ||
    filters.language ||
    filters.framework ||
    filters.isPrivate !== null ||
    filters.hasPages !== null ||
    filters.minStars > 0 ||
    filters.maxAge !== null
  );
});

const activeFiltersDisplay = computed(() => {
  const active = {};

  if (searchQuery.value) active.query = `"${searchQuery.value}"`;
  if (filters.language) active.language = filters.language;
  if (filters.framework) active.framework = filters.framework;
  if (filters.isPrivate === true) active.type = "Privé";
  if (filters.isPrivate === false) active.type = "Public";
  if (filters.hasPages === true) active.pages = "Avec Pages";
  if (filters.hasPages === false) active.pages = "Sans Pages";
  if (filters.minStars > 0) active.stars = `≥${filters.minStars} ⭐`;
  if (filters.maxAge === 7) active.activity = "Cette semaine";
  if (filters.maxAge === 30) active.activity = "Ce mois";
  if (filters.maxAge === 90) active.activity = "3 mois";
  if (filters.maxAge === 365) active.activity = "Cette année";

  return active;
});

// Méthodes
const onSearchInput = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    performSearch();
  }, 300); // Debounce de 300ms
};

const onFilterChange = () => {
  performSearch();
};

const performSearch = () => {
  const searchParams = {
    q: searchQuery.value,
    ...filters,
  };

  emit("search", searchParams);
  emit("filtersChange", { query: searchQuery.value, filters: { ...filters } });
};

const applyQuickFilter = (filter) => {
  // Réinitialiser d'abord si le filtre est déjà actif
  if (isQuickFilterActive(filter)) {
    resetFilters();
  } else {
    resetFilters();
    filter.apply();
    performSearch();
  }
};

const isQuickFilterActive = (filter) => {
  switch (filter.key) {
    case "starred":
      return filters.minStars > 0;
    case "public":
      return filters.isPrivate === false;
    case "private":
      return filters.isPrivate === true;
    case "pages":
      return filters.hasPages === true;
    case "recent":
      return filters.maxAge === 30;
    case "javascript":
      return filters.language === "JavaScript";
    default:
      return false;
  }
};

const removeFilter = (filterKey) => {
  if (filterKey === "query") {
    searchQuery.value = "";
  } else {
    filters[filterKey] = filterKey === "minStars" ? 0 : null;
  }
  performSearch();
};

const resetFilters = () => {
  searchQuery.value = "";
  Object.assign(filters, {
    language: "",
    framework: "",
    isPrivate: null,
    hasPages: null,
    minStars: 0,
    maxAge: null,
  });
  performSearch();
};

const clearSearch = () => {
  searchQuery.value = "";
  performSearch();
};

const exportResults = () => {
  const exportData = {
    query: searchQuery.value,
    filters: { ...filters },
    timestamp: new Date().toISOString(),
    totalResults: props.totalResults,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `github-search-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Watchers
watch(
  () => props.availableLanguages,
  (newLanguages) => {
    // Mettre à jour les options de langage si nécessaire
  },
  { immediate: true }
);

// Lifecycle
onMounted(() => {
  // Charger la recherche initiale
  performSearch();
});
</script>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  transform-origin: top;
  max-height: 500px;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: scaleY(0);
  max-height: 0;
}

/* Style pour le slider */
.slider::-webkit-slider-thumb {
  appearance: none;
  height: 20px;
  width: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
}

.slider::-moz-range-thumb {
  height: 20px;
  width: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: none;
}
</style>
