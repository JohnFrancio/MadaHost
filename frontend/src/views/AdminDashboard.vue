<script setup>
import { ref, onMounted, computed } from "vue";
import { useAdminStore } from "@/stores/admin";
import { useNotificationsStore } from "@/stores/notifications";
import {
  UsersIcon,
  FolderIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronDownIcon,
  EyeIcon,
  TrashIcon,
  UserPlusIcon,
  UserMinusIcon,
  CalendarIcon,
  ClockIcon,
  XMarkIcon,
  DocumentTextIcon,
  CpuChipIcon,
  GlobeAltIcon,
} from "@heroicons/vue/24/outline";

const adminStore = useAdminStore();
const notifications = useNotificationsStore();

const activeTab = ref("dashboard");
const showUserModal = ref(false);
const showProjectModal = ref(false);
const showLogsModal = ref(false);
const selectedUser = ref(null);
const selectedProject = ref(null);
const selectedLog = ref(null);

// Filtres avancés
const usersFilters = ref({
  search: "",
  role: "all",
  sortBy: "created_at",
  sortOrder: "desc",
  dateRange: "all",
});

const projectsFilters = ref({
  search: "",
  status: "all",
  framework: "all",
  owner: "all",
  sortBy: "created_at",
  sortOrder: "desc",
});

const deploymentsFilters = ref({
  search: "",
  status: "all",
  project: "all",
  dateRange: "7d",
});

const tabs = [
  {
    key: "dashboard",
    name: "Vue d'ensemble",
    icon: CpuChipIcon,
    description: "Statistiques globales",
  },
  {
    key: "users",
    name: "Utilisateurs",
    icon: UsersIcon,
    description: "Gestion des comptes",
  },
  {
    key: "projects",
    name: "Projets",
    icon: FolderIcon,
    description: "Supervision des projets",
  },
  {
    key: "deployments",
    name: "Déploiements",
    icon: RocketLaunchIcon,
    description: "Historique des déploiements",
  },
  {
    key: "logs",
    name: "Activité",
    icon: DocumentTextIcon,
    description: "Logs d'administration",
  },
];

// Computed pour les statistiques améliorées
const dashboardCards = computed(() => [
  {
    title: "Utilisateurs totaux",
    value: adminStore.dashboardStats.totalUsers,
    icon: UsersIcon,
    color: "blue",
    trend: "+12%",
    trendDirection: "up",
    description: "Comptes actifs",
  },
  {
    title: "Projets actifs",
    value: adminStore.dashboardStats.activeProjects,
    icon: CheckCircleIcon,
    color: "green",
    trend: "+8%",
    trendDirection: "up",
    description: "En fonctionnement",
  },
  {
    title: "Total projets",
    value: adminStore.dashboardStats.totalProjects,
    icon: FolderIcon,
    color: "purple",
    trend: "+15%",
    trendDirection: "up",
    description: "Créés à ce jour",
  },
  {
    title: "Déploiements",
    value: adminStore.dashboardStats.totalDeployments,
    icon: RocketLaunchIcon,
    color: "orange",
    trend: "+25%",
    trendDirection: "up",
    description: "Ce mois-ci",
  },
]);

// Options pour les filtres
const frameworkOptions = [
  { value: "all", label: "Tous les frameworks" },
  { value: "Next.js", label: "Next.js" },
  { value: "React", label: "React" },
  { value: "Vue.js", label: "Vue.js" },
  { value: "Angular", label: "Angular" },
  { value: "Svelte", label: "Svelte" },
  { value: "HTML Statique", label: "HTML Statique" },
];

const sortOptions = [
  { value: "created_at", label: "Date de création" },
  { value: "updated_at", label: "Dernière mise à jour" },
  { value: "name", label: "Nom" },
  { value: "status", label: "Statut" },
];

// Methods
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatRelativeTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `Il y a ${minutes}min`;
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${days}j`;
};

const getStatusClass = (status) => {
  const classes = {
    active:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300",
    building:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
    error: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300",
    inactive: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    success:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300",
    pending:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
    cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  };
  return (
    classes[status] ||
    "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
  );
};

const getRoleClass = (role) => {
  return role === "admin"
    ? "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300"
    : "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300";
};

const getFrameworkIcon = (framework) => {
  // Retourne une couleur basée sur le framework
  const colors = {
    "Next.js": "text-black dark:text-white",
    React: "text-blue-500",
    "Vue.js": "text-green-500",
    Angular: "text-red-500",
    Svelte: "text-orange-500",
    "HTML Statique": "text-gray-500",
  };
  return colors[framework] || "text-gray-500";
};

const promoteUser = async (user) => {
  try {
    const newRole = user.role === "admin" ? "user" : "admin";
    const action = newRole === "admin" ? "promouvoir" : "rétrograder";

    if (confirm(`Voulez-vous vraiment ${action} ${user.username} ?`)) {
      await adminStore.updateUserRole(user.id, newRole);
      notifications.success(
        `${user.username} ${
          newRole === "admin"
            ? "promu administrateur"
            : "rétrogradé utilisateur"
        }`
      );
    }
  } catch (error) {
    notifications.error("Erreur lors de la modification du rôle");
  }
};

const deleteProject = async (project) => {
  try {
    const reason = prompt(
      `Raison de la suppression du projet "${project.name}" :`
    );
    if (reason !== null) {
      await adminStore.deleteAdminProject(project.id, reason);
      notifications.success("Projet supprimé avec succès");
    }
  } catch (error) {
    notifications.error("Erreur lors de la suppression du projet");
  }
};

const viewUserDetails = (user) => {
  selectedUser.value = user;
  showUserModal.value = true;
};

const viewProjectDetails = (project) => {
  selectedProject.value = project;
  showProjectModal.value = true;
};

const viewLogDetails = (log) => {
  selectedLog.value = log;
  showLogsModal.value = true;
};

const loadTabData = async (tab) => {
  try {
    switch (tab) {
      case "dashboard":
        await adminStore.loadDashboard();
        break;
      case "users":
        await adminStore.loadUsers();
        break;
      case "projects":
        await adminStore.loadAdminProjects();
        break;
      case "deployments":
        // Charger les déploiements (à implémenter dans le store)
        break;
      case "logs":
        await adminStore.loadAdminLogs();
        break;
    }
  } catch (error) {
    notifications.error(`Erreur lors du chargement des données`);
  }
};

const onTabChange = (tab) => {
  activeTab.value = tab;
  loadTabData(tab);
};

const applyFilters = (type) => {
  // Logique pour appliquer les filtres selon le type
  switch (type) {
    case "users":
      adminStore.loadUsers(1);
      break;
    case "projects":
      adminStore.loadAdminProjects(1);
      break;
    case "deployments":
      // Implémenter le filtrage des déploiements
      break;
  }
};

// Lifecycle
onMounted(async () => {
  if (!adminStore.isAdmin) {
    const hasAccess = await adminStore.checkAdminStatus();
    if (!hasAccess) {
      notifications.error("Accès non autorisé");
      return;
    }
  }

  await loadTabData("dashboard");
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
      <!-- Header modernisé -->
      <div class="mb-12">
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center space-x-4">
              <div
                class="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl flex items-center justify-center shadow-xl"
              >
                <ShieldCheckIcon class="w-7 h-7 text-white" />
              </div>
              <div>
                <h1
                  class="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent"
                >
                  Administration
                </h1>
                <p class="text-gray-600 dark:text-gray-400 mt-1 text-lg">
                  Centre de contrôle de la plateforme MadaHost
                </p>
              </div>
            </div>
          </div>

          <div class="flex items-center space-x-4">
            <div
              class="bg-white dark:bg-gray-800 rounded-2xl px-6 py-3 border border-gray-200 dark:border-gray-700 shadow-soft"
            >
              <div class="flex items-center space-x-3">
                <div
                  class="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"
                ></div>
                <span
                  class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Système opérationnel
                </span>
              </div>
            </div>
            <div
              class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-700"
            >
              <ShieldCheckIcon class="w-4 h-4 mr-2" />
              Administrateur
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation tabs modernisée -->
      <div class="mb-8">
        <div
          class="bg-white dark:bg-gray-800 rounded-3xl p-2 shadow-soft border border-gray-200 dark:border-gray-700"
        >
          <nav class="flex space-x-1">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              @click="onTabChange(tab.key)"
              :class="[
                'group relative flex items-center px-6 py-4 rounded-2xl font-medium text-sm transition-all duration-200',
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg transform scale-[1.02]'
                  : 'text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10',
              ]"
            >
              <component
                :is="tab.icon"
                :class="[
                  'w-5 h-5 mr-3 transition-transform duration-200',
                  activeTab === tab.key
                    ? 'text-white'
                    : 'group-hover:scale-110',
                ]"
              />
              <div class="text-left">
                <div class="font-semibold">{{ tab.name }}</div>
                <div
                  :class="[
                    'text-xs opacity-75 mt-0.5',
                    activeTab === tab.key
                      ? 'text-purple-100'
                      : 'text-gray-500 dark:text-gray-500',
                  ]"
                >
                  {{ tab.description }}
                </div>
              </div>
            </button>
          </nav>
        </div>
      </div>

      <!-- Dashboard Tab -->
      <div v-if="activeTab === 'dashboard'" class="space-y-8">
        <!-- Stats Cards améliorées -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            v-for="card in dashboardCards"
            :key="card.title"
            class="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-200 dark:border-gray-700 shadow-soft hover:shadow-medium transition-all duration-300 hover:-translate-y-1"
          >
            <div class="absolute top-0 right-0 w-32 h-32 opacity-5 -mr-8 -mt-8">
              <component :is="card.icon" class="w-full h-full" />
            </div>

            <div class="relative">
              <div class="flex items-center justify-between mb-4">
                <div
                  :class="[
                    'p-3 rounded-2xl shadow-lg',
                    card.color === 'blue'
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                      : card.color === 'green'
                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white'
                      : card.color === 'purple'
                      ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white'
                      : 'bg-gradient-to-br from-orange-500 to-orange-600 text-white',
                  ]"
                >
                  <component :is="card.icon" class="w-6 h-6" />
                </div>

                <div
                  :class="[
                    'flex items-center text-xs font-medium px-2 py-1 rounded-full',
                    card.trendDirection === 'up'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
                  ]"
                >
                  {{ card.trend }}
                </div>
              </div>

              <div>
                <p
                  class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1"
                >
                  {{ card.title }}
                </p>
                <p
                  class="text-3xl font-bold text-gray-900 dark:text-white mb-1"
                >
                  {{ card.value }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-500">
                  {{ card.description }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Activité récente modernisée -->
        <div class="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <!-- Utilisateurs récents -->
          <div
            class="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-200 dark:border-gray-700 shadow-soft"
          >
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Nouveaux utilisateurs
              </h3>
              <UserPlusIcon class="w-5 h-5 text-gray-400" />
            </div>
            <div class="space-y-4">
              <div
                v-for="user in adminStore.recentUsers.slice(0, 5)"
                :key="user.id"
                class="flex items-center space-x-4 p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                @click="viewUserDetails(user)"
              >
                <img
                  :src="user.avatar_url"
                  :alt="user.username"
                  class="w-12 h-12 rounded-2xl ring-2 ring-white dark:ring-gray-700 shadow-md"
                />
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-semibold text-gray-900 dark:text-white truncate"
                  >
                    {{ user.username }}
                  </p>
                  <div class="flex items-center space-x-2">
                    <span
                      :class="getRoleClass(user.role)"
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    >
                      {{ user.role === "admin" ? "Admin" : "User" }}
                    </span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      {{ formatRelativeTime(user.created_at) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Déploiements récents -->
          <div
            class="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-200 dark:border-gray-700 shadow-soft"
          >
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Déploiements récents
              </h3>
              <RocketLaunchIcon class="w-5 h-5 text-gray-400" />
            </div>
            <div class="space-y-4">
              <div
                v-for="deployment in adminStore.recentDeployments.slice(0, 5)"
                :key="deployment.id"
                class="flex items-center space-x-4 p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div
                  :class="[
                    'w-3 h-3 rounded-full',
                    deployment.status === 'success'
                      ? 'bg-emerald-500'
                      : deployment.status === 'failed'
                      ? 'bg-red-500'
                      : deployment.status === 'pending'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-gray-400',
                  ]"
                ></div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-medium text-gray-900 dark:text-white truncate"
                  >
                    {{ deployment.projects?.name }}
                  </p>
                  <div class="flex items-center space-x-2">
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      par {{ deployment.projects?.users?.username }}
                    </span>
                    <span class="text-xs text-gray-400">•</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      {{ formatRelativeTime(deployment.started_at) }}
                    </span>
                  </div>
                </div>
                <span
                  :class="getStatusClass(deployment.status)"
                  class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                >
                  {{ deployment.status }}
                </span>
              </div>
            </div>
          </div>

          <!-- Projets actifs -->
          <div
            class="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-200 dark:border-gray-700 shadow-soft"
          >
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Projets populaires
              </h3>
              <GlobeAltIcon class="w-5 h-5 text-gray-400" />
            </div>
            <div class="space-y-4">
              <div
                v-for="project in adminStore.activeProjects.slice(0, 5)"
                :key="project.id"
                class="flex items-center space-x-4 p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                @click="viewProjectDetails(project)"
              >
                <img
                  :src="project.users?.avatar_url"
                  :alt="project.users?.username"
                  class="w-10 h-10 rounded-xl ring-2 ring-white dark:ring-gray-700 shadow-sm"
                />
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-medium text-gray-900 dark:text-white truncate"
                  >
                    {{ project.name }}
                  </p>
                  <div class="flex items-center space-x-2">
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      {{ project.users?.username }}
                    </span>
                    <span
                      v-if="project.framework"
                      :class="getFrameworkIcon(project.framework)"
                      class="text-xs font-medium"
                    >
                      {{ project.framework }}
                    </span>
                  </div>
                </div>
                <span
                  :class="getStatusClass(project.status)"
                  class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                >
                  {{ project.status }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Users Tab amélioré -->
      <div v-else-if="activeTab === 'users'" class="space-y-6">
        <!-- Filtres avancés pour utilisateurs -->
        <div
          class="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-soft"
        >
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="relative">
              <MagnifyingGlassIcon
                class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              />
              <input
                v-model="usersFilters.search"
                @input="applyFilters('users')"
                type="text"
                placeholder="Rechercher un utilisateur..."
                class="pl-10 w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-all"
              />
            </div>
            <select
              v-model="usersFilters.role"
              @change="applyFilters('users')"
              class="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">Tous les rôles</option>
              <option value="user">Utilisateurs</option>
              <option value="admin">Administrateurs</option>
            </select>
            <select
              v-model="usersFilters.sortBy"
              @change="applyFilters('users')"
              class="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="created_at">Date d'inscription</option>
              <option value="username">Nom d'utilisateur</option>
              <option value="role">Rôle</option>
            </select>
            <select
              v-model="usersFilters.sortOrder"
              @change="applyFilters('users')"
              class="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="desc">Plus récent</option>
              <option value="asc">Plus ancien</option>
            </select>
          </div>
        </div>

        <!-- Liste des utilisateurs modernisée -->
        <div
          class="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-soft overflow-hidden"
        >
          <div
            class="px-8 py-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
          >
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
              Gestion des utilisateurs
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {{ adminStore.users.length }} utilisateurs
            </p>
          </div>

          <div class="divide-y divide-gray-200 dark:divide-gray-700">
            <div
              v-for="user in adminStore.users"
              :key="user.id"
              class="px-8 py-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
            >
              <div class="flex items-center space-x-6">
                <img
                  :src="user.avatar_url"
                  :alt="user.username"
                  class="w-16 h-16 rounded-3xl ring-4 ring-white dark:ring-gray-700 shadow-lg"
                />
                <div>
                  <div class="flex items-center space-x-3">
                    <h4
                      class="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                      {{ user.username }}
                    </h4>
                    <span
                      :class="getRoleClass(user.role)"
                      class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                    >
                      {{
                        user.role === "admin" ? "Administrateur" : "Utilisateur"
                      }}
                    </span>
                  </div>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {{ user.email || "Pas d'email" }}
                  </p>
                  <div
                    class="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400"
                  >
                    <div class="flex items-center">
                      <CalendarIcon class="w-4 h-4 mr-1" />
                      Inscrit le {{ formatDate(user.created_at) }}
                    </div>
                    <div class="flex items-center">
                      <FolderIcon class="w-4 h-4 mr-1" />
                      {{ user.projects?.length || 0 }} projets
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex items-center space-x-3">
                <button
                  @click="viewUserDetails(user)"
                  class="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-2xl transition-colors"
                  title="Voir les détails"
                >
                  <EyeIcon class="w-5 h-5" />
                </button>

                <button
                  @click="promoteUser(user)"
                  :class="[
                    'px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-200 shadow-sm',
                    user.role === 'admin'
                      ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-800/30'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-800/30',
                  ]"
                >
                  <div class="flex items-center">
                    <component
                      :is="user.role === 'admin' ? UserMinusIcon : UserPlusIcon"
                      class="w-4 h-4 mr-2"
                    />
                    {{ user.role === "admin" ? "Rétrograder" : "Promouvoir" }}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Projects Tab modernisé -->
      <div v-else-if="activeTab === 'projects'" class="space-y-6">
        <!-- Filtres avancés pour projets -->
        <div
          class="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-soft"
        >
          <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div class="relative">
              <MagnifyingGlassIcon
                class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              />
              <input
                v-model="projectsFilters.search"
                @input="applyFilters('projects')"
                type="text"
                placeholder="Rechercher un projet..."
                class="pl-10 w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-all"
              />
            </div>
            <select
              v-model="projectsFilters.status"
              @change="applyFilters('projects')"
              class="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="building">En construction</option>
              <option value="error">Erreur</option>
            </select>
            <select
              v-model="projectsFilters.framework"
              @change="applyFilters('projects')"
              class="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
            >
              <option
                v-for="fw in frameworkOptions"
                :key="fw.value"
                :value="fw.value"
              >
                {{ fw.label }}
              </option>
            </select>
            <select
              v-model="projectsFilters.sortBy"
              @change="applyFilters('projects')"
              class="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
            >
              <option
                v-for="sort in sortOptions"
                :key="sort.value"
                :value="sort.value"
              >
                {{ sort.label }}
              </option>
            </select>
            <select
              v-model="projectsFilters.sortOrder"
              @change="applyFilters('projects')"
              class="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="desc">Plus récent</option>
              <option value="asc">Plus ancien</option>
            </select>
          </div>
        </div>

        <!-- Liste des projets modernisée -->
        <div
          class="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-soft overflow-hidden"
        >
          <div
            class="px-8 py-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
          >
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
              Supervision des projets
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {{ adminStore.adminProjects.length }} projets
            </p>
          </div>

          <div class="divide-y divide-gray-200 dark:divide-gray-700">
            <div
              v-for="project in adminStore.adminProjects"
              :key="project.id"
              class="px-8 py-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
            >
              <div class="flex items-center space-x-6">
                <div class="relative">
                  <img
                    :src="project.users?.avatar_url"
                    :alt="project.users?.username"
                    class="w-16 h-16 rounded-3xl ring-4 ring-white dark:ring-gray-700 shadow-lg"
                  />
                  <div
                    v-if="project.framework"
                    :class="[
                      'absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg ring-2 ring-white dark:ring-gray-700',
                      getFrameworkIcon(project.framework).includes('blue')
                        ? 'bg-blue-500 text-white'
                        : getFrameworkIcon(project.framework).includes('green')
                        ? 'bg-green-500 text-white'
                        : getFrameworkIcon(project.framework).includes('red')
                        ? 'bg-red-500 text-white'
                        : getFrameworkIcon(project.framework).includes('orange')
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-500 text-white',
                    ]"
                  >
                    {{ project.framework.charAt(0) }}
                  </div>
                </div>
                <div>
                  <div class="flex items-center space-x-3">
                    <h4
                      class="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                      {{ project.name }}
                    </h4>
                    <span
                      :class="getStatusClass(project.status)"
                      class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                    >
                      {{ project.status }}
                    </span>
                  </div>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {{ project.github_repo }}
                  </p>
                  <div
                    class="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400"
                  >
                    <div class="flex items-center">
                      <UsersIcon class="w-4 h-4 mr-1" />
                      {{ project.users?.username }}
                    </div>
                    <div class="flex items-center">
                      <CalendarIcon class="w-4 h-4 mr-1" />
                      {{ formatDate(project.created_at) }}
                    </div>
                    <div v-if="project.domain" class="flex items-center">
                      <GlobeAltIcon class="w-4 h-4 mr-1" />
                      <a
                        :href="`http://${project.domain}`"
                        target="_blank"
                        class="hover:text-purple-600 underline"
                      >
                        {{ project.domain }}
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex items-center space-x-3">
                <button
                  @click="viewProjectDetails(project)"
                  class="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-2xl transition-colors"
                  title="Voir les détails"
                >
                  <EyeIcon class="w-5 h-5" />
                </button>

                <button
                  @click="deleteProject(project)"
                  class="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-800/30 rounded-2xl text-sm font-medium transition-all duration-200 shadow-sm"
                >
                  <div class="flex items-center">
                    <TrashIcon class="w-4 h-4 mr-2" />
                    Supprimer
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Deployments Tab nouveau -->
      <div v-else-if="activeTab === 'deployments'" class="space-y-6">
        <!-- Filtres pour déploiements -->
        <div
          class="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-soft"
        >
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="relative">
              <MagnifyingGlassIcon
                class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              />
              <input
                v-model="deploymentsFilters.search"
                @input="applyFilters('deployments')"
                type="text"
                placeholder="Rechercher un déploiement..."
                class="pl-10 w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-all"
              />
            </div>
            <select
              v-model="deploymentsFilters.status"
              @change="applyFilters('deployments')"
              class="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">Tous les statuts</option>
              <option value="success">Réussi</option>
              <option value="failed">Échoué</option>
              <option value="pending">En attente</option>
              <option value="building">En cours</option>
              <option value="cancelled">Annulé</option>
            </select>
            <select
              v-model="deploymentsFilters.project"
              @change="applyFilters('deployments')"
              class="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">Tous les projets</option>
              <!-- Options dynamiques basées sur les projets -->
            </select>
            <select
              v-model="deploymentsFilters.dateRange"
              @change="applyFilters('deployments')"
              class="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="1d">Dernières 24h</option>
              <option value="7d">7 derniers jours</option>
              <option value="30d">30 derniers jours</option>
              <option value="all">Tous</option>
            </select>
          </div>
        </div>

        <!-- Liste des déploiements -->
        <div
          class="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-soft overflow-hidden"
        >
          <div
            class="px-8 py-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
          >
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
              Historique des déploiements
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Surveillance en temps réel
            </p>
          </div>

          <div class="divide-y divide-gray-200 dark:divide-gray-700">
            <div
              v-for="deployment in adminStore.recentDeployments"
              :key="deployment.id"
              class="px-8 py-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
            >
              <div class="flex items-center space-x-6">
                <div class="relative">
                  <div
                    :class="[
                      'w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg',
                      deployment.status === 'success'
                        ? 'bg-emerald-100 dark:bg-emerald-900/20'
                        : deployment.status === 'failed'
                        ? 'bg-red-100 dark:bg-red-900/20'
                        : deployment.status === 'pending' ||
                          deployment.status === 'building'
                        ? 'bg-amber-100 dark:bg-amber-900/20'
                        : 'bg-gray-100 dark:bg-gray-800',
                    ]"
                  >
                    <RocketLaunchIcon
                      :class="[
                        'w-6 h-6',
                        deployment.status === 'success'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : deployment.status === 'failed'
                          ? 'text-red-600 dark:text-red-400'
                          : deployment.status === 'pending' ||
                            deployment.status === 'building'
                          ? 'text-amber-600 dark:text-amber-400 animate-pulse'
                          : 'text-gray-600 dark:text-gray-400',
                      ]"
                    />
                  </div>
                  <div
                    :class="[
                      'absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg ring-2 ring-white dark:ring-gray-700',
                      deployment.status === 'success'
                        ? 'bg-emerald-500 text-white'
                        : deployment.status === 'failed'
                        ? 'bg-red-500 text-white'
                        : deployment.status === 'pending' ||
                          deployment.status === 'building'
                        ? 'bg-amber-500 text-white animate-pulse'
                        : 'bg-gray-500 text-white',
                    ]"
                  >
                    #
                  </div>
                </div>
                <div>
                  <div class="flex items-center space-x-3">
                    <h4
                      class="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                      {{ deployment.projects?.name }}
                    </h4>
                    <span
                      :class="getStatusClass(deployment.status)"
                      class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                    >
                      {{ deployment.status }}
                    </span>
                  </div>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Déploiement par {{ deployment.projects?.users?.username }}
                  </p>
                  <div
                    class="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400"
                  >
                    <div class="flex items-center">
                      <ClockIcon class="w-4 h-4 mr-1" />
                      Démarré {{ formatRelativeTime(deployment.started_at) }}
                    </div>
                    <div
                      v-if="deployment.completed_at"
                      class="flex items-center"
                    >
                      <CheckCircleIcon class="w-4 h-4 mr-1" />
                      Terminé {{ formatRelativeTime(deployment.completed_at) }}
                    </div>
                    <div
                      v-if="deployment.commit_hash"
                      class="flex items-center font-mono"
                    >
                      #{{ deployment.commit_hash.substring(0, 7) }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex items-center space-x-3">
                <button
                  class="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-2xl transition-colors"
                  title="Voir les logs"
                >
                  <DocumentTextIcon class="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Logs Tab amélioré -->
      <div v-else-if="activeTab === 'logs'" class="space-y-6">
        <!-- Filtres pour logs -->
        <div
          class="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-soft"
        >
          <div class="flex flex-col sm:flex-row gap-4">
            <select
              v-model="adminStore.adminLogsFilters.action_type"
              @change="adminStore.loadAdminLogs(1)"
              class="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">Toutes les actions</option>
              <option value="promote_user">Promotions</option>
              <option value="demote_user">Rétrogradations</option>
              <option value="delete_project">Suppressions de projets</option>
              <option value="suspend_user">Suspensions</option>
            </select>
          </div>
        </div>

        <!-- Liste des logs modernisée -->
        <div
          class="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-soft overflow-hidden"
        >
          <div
            class="px-8 py-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
          >
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
              Journal d'activité
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Actions administratives
            </p>
          </div>

          <div class="divide-y divide-gray-200 dark:divide-gray-700">
            <div
              v-for="log in adminStore.adminLogs"
              :key="log.id"
              class="px-8 py-6 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
              @click="viewLogDetails(log)"
            >
              <div class="flex items-start space-x-4">
                <img
                  :src="log.users?.avatar_url"
                  :alt="log.users?.username"
                  class="w-12 h-12 rounded-2xl flex-shrink-0 shadow-md ring-2 ring-white dark:ring-gray-700"
                />
                <div class="flex-1">
                  <div class="flex items-center space-x-3">
                    <p class="text-base text-gray-900 dark:text-white">
                      <span class="font-semibold">{{
                        log.users?.username
                      }}</span>
                      a effectué l'action
                      <span
                        class="font-semibold text-purple-600 dark:text-purple-400"
                      >
                        {{ log.action_type.replace("_", " ") }}
                      </span>
                    </p>
                  </div>
                  <div
                    v-if="log.details"
                    class="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl"
                  >
                    <pre
                      class="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap"
                      >{{ JSON.stringify(log.details, null, 2) }}</pre
                    >
                  </div>
                  <p
                    class="text-sm text-gray-500 dark:text-gray-400 mt-2 flex items-center"
                  >
                    <ClockIcon class="w-4 h-4 mr-1" />
                    {{ formatDate(log.created_at) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <!-- Modal détails utilisateur -->
    <div v-if="showUserModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div
        class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"
      >
        <div
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          @click="showUserModal = false"
        ></div>

        <div
          class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-3xl px-8 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-8"
        >
          <div class="flex items-start justify-between mb-6">
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white">
              Détails utilisateur
            </h3>
            <button
              @click="showUserModal = false"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>

          <div v-if="selectedUser" class="space-y-6">
            <div class="flex items-center space-x-4">
              <img
                :src="selectedUser.avatar_url"
                :alt="selectedUser.username"
                class="w-20 h-20 rounded-3xl shadow-lg"
              />
              <div>
                <h4 class="text-xl font-semibold text-gray-900 dark:text-white">
                  {{ selectedUser.username }}
                </h4>
                <p class="text-gray-600 dark:text-gray-400">
                  {{ selectedUser.email || "Pas d'email" }}
                </p>
                <span
                  :class="getRoleClass(selectedUser.role)"
                  class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-2"
                >
                  {{
                    selectedUser.role === "admin"
                      ? "Administrateur"
                      : "Utilisateur"
                  }}
                </span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 text-sm">
              <div class="bg-gray-50 dark:bg-gray-700 rounded-2xl p-4">
                <p class="text-gray-500 dark:text-gray-400">
                  Date d'inscription
                </p>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ formatDate(selectedUser.created_at) }}
                </p>
              </div>
              <div class="bg-gray-50 dark:bg-gray-700 rounded-2xl p-4">
                <p class="text-gray-500 dark:text-gray-400">GitHub ID</p>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ selectedUser.github_id }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal détails projet -->
    <div v-if="showProjectModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div
        class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"
      >
        <div
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          @click="showProjectModal = false"
        ></div>

        <div
          class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-3xl px-8 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-8"
        >
          <div class="flex items-start justify-between mb-6">
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white">
              Détails projet
            </h3>
            <button
              @click="showProjectModal = false"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>

          <div v-if="selectedProject" class="space-y-6">
            <div class="flex items-center space-x-4">
              <img
                :src="selectedProject.users?.avatar_url"
                :alt="selectedProject.users?.username"
                class="w-16 h-16 rounded-3xl shadow-lg"
              />
              <div>
                <h4 class="text-xl font-semibold text-gray-900 dark:text-white">
                  {{ selectedProject.name }}
                </h4>
                <p class="text-gray-600 dark:text-gray-400">
                  {{ selectedProject.github_repo }}
                </p>
                <div class="flex items-center space-x-2 mt-2">
                  <span
                    :class="getStatusClass(selectedProject.status)"
                    class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                  >
                    {{ selectedProject.status }}
                  </span>
                  <span
                    v-if="selectedProject.framework"
                    class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                  >
                    {{ selectedProject.framework }}
                  </span>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 text-sm">
              <div class="bg-gray-50 dark:bg-gray-700 rounded-2xl p-4">
                <p class="text-gray-500 dark:text-gray-400">Propriétaire</p>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ selectedProject.users?.username }}
                </p>
              </div>
              <div class="bg-gray-50 dark:bg-gray-700 rounded-2xl p-4">
                <p class="text-gray-500 dark:text-gray-400">Branche</p>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ selectedProject.branch }}
                </p>
              </div>
              <div class="bg-gray-50 dark:bg-gray-700 rounded-2xl p-4">
                <p class="text-gray-500 dark:text-gray-400">Domaine</p>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ selectedProject.domain || "Non configuré" }}
                </p>
              </div>
              <div class="bg-gray-50 dark:bg-gray-700 rounded-2xl p-4">
                <p class="text-gray-500 dark:text-gray-400">
                  Dernière mise à jour
                </p>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ formatDate(selectedProject.updated_at) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
