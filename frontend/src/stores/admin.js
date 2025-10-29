// frontend/src/stores/admin.js - Version complète améliorée
import { defineStore } from "pinia";
import api from "@/utils/axios";

export const useAdminStore = defineStore("admin", {
  state: () => ({
    // État d'accès admin
    isAdmin: false,
    checkingAdmin: false,
    adminCheckDone: false,

    // Dashboard - statistiques améliorées
    dashboardStats: {
      totalUsers: 0,
      totalProjects: 0,
      totalDeployments: 0,
      activeProjects: 0,
      // Nouvelles statistiques
      successfulDeployments: 0,
      failedDeployments: 0,
      newUsersThisMonth: 0,
      activeUsersToday: 0,
    },
    recentDeployments: [],
    recentUsers: [],
    activeProjects: [],
    dashboardLoading: false,

    // Gestion des utilisateurs avec filtres avancés
    users: [],
    usersLoading: false,
    usersPagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
    usersFilters: {
      search: "",
      role: "all",
      sortBy: "created_at",
      sortOrder: "desc",
      dateRange: "all",
    },
    usersStats: {
      total: 0,
      admins: 0,
      users: 0,
      newThisWeek: 0,
      newThisMonth: 0,
    },

    // Gestion des projets avec filtres avancés
    adminProjects: [],
    adminProjectsLoading: false,
    adminProjectsPagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
    adminProjectsFilters: {
      search: "",
      status: "all",
      framework: "all",
      owner: "all",
      sortBy: "created_at",
      sortOrder: "desc",
    },
    projectsStats: {
      total: 0,
      active: 0,
      inactive: 0,
      building: 0,
      error: 0,
      frameworks: {},
    },

    // Gestion des déploiements (nouveau)
    adminDeployments: [],
    adminDeploymentsLoading: false,
    adminDeploymentsPagination: {
      page: 1,
      limit: 30,
      total: 0,
      totalPages: 0,
    },
    adminDeploymentsFilters: {
      search: "",
      status: "all",
      project: "all",
      dateRange: "7d",
      sortBy: "started_at",
      sortOrder: "desc",
    },
    deploymentsStats: {
      total: 0,
      success: 0,
      failed: 0,
      pending: 0,
      building: 0,
      todayCount: 0,
      averageDuration: 0,
    },

    // Logs d'administration améliorés
    adminLogs: [],
    adminLogsLoading: false,
    adminLogsPagination: {
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 0,
    },
    adminLogsFilters: {
      action_type: "all",
      admin_id: "all",
      dateRange: "30d",
      sortBy: "created_at",
      sortOrder: "desc",
    },

    // Analyses et rapports
    analyticsData: {
      userGrowth: [],
      deploymentTrends: [],
      projectsByFramework: [],
      errorRates: [],
    },
    analyticsLoading: false,

    error: null,
    lastUpdate: null,
  }),

  getters: {
    // Statistiques calculées pour utilisateurs
    computedUsersStats: (state) => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      return {
        total: state.users.length,
        admins: state.users.filter((u) => u.role === "admin").length,
        users: state.users.filter((u) => u.role !== "admin").length,
        newThisWeek: state.users.filter((u) => new Date(u.created_at) > weekAgo)
          .length,
        newThisMonth: state.users.filter(
          (u) => new Date(u.created_at) > monthAgo
        ).length,
      };
    },

    // Statistiques calculées pour projets
    computedProjectsStats: (state) => {
      const frameworks = {};
      state.adminProjects.forEach((project) => {
        if (project.framework) {
          frameworks[project.framework] =
            (frameworks[project.framework] || 0) + 1;
        }
      });

      return {
        total: state.adminProjects.length,
        active: state.adminProjects.filter((p) => p.status === "active").length,
        inactive: state.adminProjects.filter((p) => p.status === "inactive")
          .length,
        building: state.adminProjects.filter((p) => p.status === "building")
          .length,
        error: state.adminProjects.filter((p) => p.status === "error").length,
        frameworks,
      };
    },

    // Statistiques calculées pour déploiements
    computedDeploymentsStats: (state) => {
      const today = new Date().toDateString();
      const todayDeployments = state.adminDeployments.filter(
        (d) => new Date(d.started_at).toDateString() === today
      );

      return {
        total: state.adminDeployments.length,
        success: state.adminDeployments.filter((d) => d.status === "success")
          .length,
        failed: state.adminDeployments.filter((d) => d.status === "failed")
          .length,
        pending: state.adminDeployments.filter((d) => d.status === "pending")
          .length,
        building: state.adminDeployments.filter((d) => d.status === "building")
          .length,
        todayCount: todayDeployments.length,
        successRate:
          state.adminDeployments.length > 0
            ? Math.round(
                (state.adminDeployments.filter((d) => d.status === "success")
                  .length /
                  state.adminDeployments.length) *
                  100
              )
            : 0,
      };
    },

    // Données filtrées
    filteredUsers: (state) => {
      let filtered = [...state.users];

      // Filtrage par recherche
      if (state.usersFilters.search) {
        const search = state.usersFilters.search.toLowerCase();
        filtered = filtered.filter(
          (user) =>
            user.username.toLowerCase().includes(search) ||
            (user.email && user.email.toLowerCase().includes(search))
        );
      }

      // Filtrage par rôle
      if (state.usersFilters.role !== "all") {
        filtered = filtered.filter(
          (user) => user.role === state.usersFilters.role
        );
      }

      // Tri
      filtered.sort((a, b) => {
        const aValue = a[state.usersFilters.sortBy];
        const bValue = b[state.usersFilters.sortBy];
        const modifier = state.usersFilters.sortOrder === "asc" ? 1 : -1;

        if (typeof aValue === "string") {
          return aValue.localeCompare(bValue) * modifier;
        }
        return (aValue > bValue ? 1 : -1) * modifier;
      });

      return filtered;
    },

    filteredProjects: (state) => {
      let filtered = [...state.adminProjects];

      // Filtrage par recherche
      if (state.adminProjectsFilters.search) {
        const search = state.adminProjectsFilters.search.toLowerCase();
        filtered = filtered.filter(
          (project) =>
            project.name.toLowerCase().includes(search) ||
            project.github_repo.toLowerCase().includes(search) ||
            (project.users?.username &&
              project.users.username.toLowerCase().includes(search))
        );
      }

      // Filtrage par statut
      if (state.adminProjectsFilters.status !== "all") {
        filtered = filtered.filter(
          (project) => project.status === state.adminProjectsFilters.status
        );
      }

      // Filtrage par framework
      if (state.adminProjectsFilters.framework !== "all") {
        filtered = filtered.filter(
          (project) =>
            project.framework === state.adminProjectsFilters.framework
        );
      }

      // Tri
      filtered.sort((a, b) => {
        const aValue = a[state.adminProjectsFilters.sortBy];
        const bValue = b[state.adminProjectsFilters.sortBy];
        const modifier =
          state.adminProjectsFilters.sortOrder === "asc" ? 1 : -1;

        if (typeof aValue === "string") {
          return aValue.localeCompare(bValue) * modifier;
        }
        return (aValue > bValue ? 1 : -1) * modifier;
      });

      return filtered;
    },

    // Alertes système
    systemAlerts: (state) => {
      const alerts = [];

      // Taux d'échec élevé
      if (state.deploymentsStats.total > 0) {
        const failureRate =
          (state.deploymentsStats.failed / state.deploymentsStats.total) * 100;
        if (failureRate > 20) {
          alerts.push({
            type: "warning",
            message: `Taux d'échec élevé: ${failureRate.toFixed(1)}%`,
            action: "Vérifier les logs de déploiement",
          });
        }
      }

      // Projets en erreur
      if (state.projectsStats.error > 0) {
        alerts.push({
          type: "error",
          message: `${state.projectsStats.error} projets en erreur`,
          action: "Vérifier les projets",
        });
      }

      return alerts;
    },
  },

  actions: {
    // Vérifier les privilèges admin - VERSION OPTIMISÉE
    async checkAdminStatus() {
      if (this.checkingAdmin) return this.isAdmin;
      if (this.adminCheckDone) return this.isAdmin;

      this.checkingAdmin = true;
      try {
        const response = await api.get("/auth/user");
        const userData = response.data?.user;

        if (!userData) {
          this.isAdmin = false;
          return false;
        }

        this.isAdmin = userData.role === "admin";
        this.adminCheckDone = true;

        return this.isAdmin;
      } catch (error) {
        console.error("❌ Erreur vérification admin:", error);
        this.isAdmin = false;
        this.adminCheckDone = true;
        return false;
      } finally {
        this.checkingAdmin = false;
      }
    },

    // Dashboard admin amélioré
    async loadDashboard() {
      this.dashboardLoading = true;
      this.error = null;

      try {
        const response = await api.get("/admin/dashboard");

        if (response.data.success) {
          this.dashboardStats = {
            ...this.dashboardStats,
            ...response.data.stats,
          };
          this.recentDeployments = response.data.recentDeployments || [];
          this.recentUsers = response.data.recentUsers || [];
          this.activeProjects = response.data.activeProjects || [];
          this.lastUpdate = new Date().toISOString();
        }
      } catch (error) {
        console.error("Erreur chargement dashboard admin:", error);
        this.error = "Erreur lors du chargement du dashboard";
        throw error;
      } finally {
        this.dashboardLoading = false;
      }
    },

    // Gestion des utilisateurs avec filtres
    async loadUsers(page = 1, filters = null) {
      this.usersLoading = true;
      this.error = null;

      try {
        const currentFilters = filters || this.usersFilters;
        const params = {
          page,
          limit: this.usersPagination.limit,
          ...currentFilters,
        };

        const response = await api.get("/admin/users", { params });

        if (response.data.success) {
          this.users = response.data.users || [];
          this.usersPagination = {
            ...this.usersPagination,
            ...response.data.pagination,
          };

          // Mettre à jour les statistiques
          this.usersStats = this.computedUsersStats;
        }
      } catch (error) {
        console.error("Erreur chargement utilisateurs:", error);
        this.error = "Erreur lors du chargement des utilisateurs";
        throw error;
      } finally {
        this.usersLoading = false;
      }
    },

    // Gestion des projets avec filtres
    async loadAdminProjects(page = 1, filters = null) {
      this.adminProjectsLoading = true;
      this.error = null;

      try {
        const currentFilters = filters || this.adminProjectsFilters;
        const params = {
          page,
          limit: this.adminProjectsPagination.limit,
          ...currentFilters,
        };

        const response = await api.get("/admin/projects", { params });

        if (response.data.success) {
          this.adminProjects = response.data.projects || [];
          this.adminProjectsPagination = {
            ...this.adminProjectsPagination,
            ...response.data.pagination,
          };

          // Mettre à jour les statistiques
          this.projectsStats = this.computedProjectsStats;
        }
      } catch (error) {
        console.error("Erreur chargement projets admin:", error);
        this.error = "Erreur lors du chargement des projets";
        throw error;
      } finally {
        this.adminProjectsLoading = false;
      }
    },

    // Nouveau: Gestion des déploiements
    async loadAdminDeployments(page = 1, filters = null) {
      this.adminDeploymentsLoading = true;
      this.error = null;

      try {
        const currentFilters = filters || this.adminDeploymentsFilters;
        const params = {
          page,
          limit: this.adminDeploymentsPagination.limit,
          ...currentFilters,
        };

        const response = await api.get("/admin/deployments", { params });

        if (response.data.success) {
          this.adminDeployments = response.data.deployments || [];
          this.adminDeploymentsPagination = {
            ...this.adminDeploymentsPagination,
            ...response.data.pagination,
          };

          // Mettre à jour les statistiques
          this.deploymentsStats = this.computedDeploymentsStats;
        }
      } catch (error) {
        console.error("Erreur chargement déploiements admin:", error);
        this.error = "Erreur lors du chargement des déploiements";
        throw error;
      } finally {
        this.adminDeploymentsLoading = false;
      }
    },

    // Actions sur les utilisateurs
    async updateUserRole(userId, newRole) {
      try {
        const response = await api.patch(`/admin/users/${userId}/role`, {
          role: newRole,
        });

        if (response.data.success) {
          // Mettre à jour l'utilisateur dans la liste
          const userIndex = this.users.findIndex((u) => u.id === userId);
          if (userIndex !== -1) {
            this.users[userIndex] = {
              ...this.users[userIndex],
              role: newRole,
              updated_at: new Date().toISOString(),
            };
          }

          // Rafraîchir les statistiques
          this.usersStats = this.computedUsersStats;

          return response.data;
        }
      } catch (error) {
        console.error("Erreur modification rôle:", error);
        throw error;
      }
    },

    async suspendUser(userId, status = "suspended") {
      try {
        const response = await api.patch(`/admin/users/${userId}/status`, {
          status,
        });

        if (response.data.success) {
          // Recharger la liste des utilisateurs
          await this.loadUsers(this.usersPagination.page);
          return response.data;
        }
      } catch (error) {
        console.error("Erreur modification statut utilisateur:", error);
        throw error;
      }
    },

    async deleteUser(userId, reason = "") {
      try {
        const response = await api.delete(`/admin/users/${userId}`, {
          data: { reason },
        });

        if (response.data.success) {
          // Retirer l'utilisateur de la liste
          this.users = this.users.filter((u) => u.id !== userId);
          this.usersStats = this.computedUsersStats;
          return response.data;
        }
      } catch (error) {
        console.error("Erreur suppression utilisateur:", error);
        throw error;
      }
    },

    // Actions sur les projets
    async deleteAdminProject(projectId, reason = "") {
      try {
        const response = await api.delete(`/admin/projects/${projectId}`, {
          data: { reason },
        });

        if (response.data.success) {
          // Retirer le projet de la liste
          this.adminProjects = this.adminProjects.filter(
            (p) => p.id !== projectId
          );
          this.projectsStats = this.computedProjectsStats;
          return response.data;
        }
      } catch (error) {
        console.error("Erreur suppression projet admin:", error);
        throw error;
      }
    },

    async updateProjectStatus(projectId, status) {
      try {
        const response = await api.patch(
          `/admin/projects/${projectId}/status`,
          {
            status,
          }
        );

        if (response.data.success) {
          // Mettre à jour le projet dans la liste
          const projectIndex = this.adminProjects.findIndex(
            (p) => p.id === projectId
          );
          if (projectIndex !== -1) {
            this.adminProjects[projectIndex] = {
              ...this.adminProjects[projectIndex],
              status,
              updated_at: new Date().toISOString(),
            };
          }

          this.projectsStats = this.computedProjectsStats;
          return response.data;
        }
      } catch (error) {
        console.error("Erreur modification statut projet:", error);
        throw error;
      }
    },

    // Logs d'administration
    async loadAdminLogs(page = 1, filters = null) {
      this.adminLogsLoading = true;
      this.error = null;

      try {
        const currentFilters = filters || this.adminLogsFilters;
        const params = {
          page,
          limit: this.adminLogsPagination.limit,
          ...currentFilters,
        };

        const response = await api.get("/admin/logs", { params });

        if (response.data.success) {
          this.adminLogs = response.data.logs || [];
          this.adminLogsPagination = {
            ...this.adminLogsPagination,
            ...response.data.pagination,
          };
        }
      } catch (error) {
        console.error("Erreur chargement logs admin:", error);
        this.error = "Erreur lors du chargement des logs";
        throw error;
      } finally {
        this.adminLogsLoading = false;
      }
    },

    // Nouveau: Analytics et rapports
    async loadAnalytics(period = "30d") {
      this.analyticsLoading = true;
      this.error = null;

      try {
        const response = await api.get(`/admin/analytics`, {
          params: { period },
        });

        if (response.data.success) {
          this.analyticsData = response.data.analytics;
        }
      } catch (error) {
        console.error("Erreur chargement analytics:", error);
        this.error = "Erreur lors du chargement des analytics";
        throw error;
      } finally {
        this.analyticsLoading = false;
      }
    },

    // Actions de filtrage améliorées
    setUsersFilter(key, value) {
      this.usersFilters[key] = value;
      this.loadUsers(1);
    },

    setAdminProjectsFilter(key, value) {
      this.adminProjectsFilters[key] = value;
      this.loadAdminProjects(1);
    },

    setAdminDeploymentsFilter(key, value) {
      this.adminDeploymentsFilters[key] = value;
      this.loadAdminDeployments(1);
    },

    setAdminLogsFilter(key, value) {
      this.adminLogsFilters[key] = value;
      this.loadAdminLogs(1);
    },

    // Recherche globale
    async globalSearch(query) {
      try {
        const response = await api.get("/admin/search", {
          params: { query },
        });

        return (
          response.data.results || {
            users: [],
            projects: [],
            deployments: [],
          }
        );
      } catch (error) {
        console.error("Erreur recherche globale:", error);
        throw error;
      }
    },

    // Fonctions utilitaires
    clearError() {
      this.error = null;
    },

    refreshAllData() {
      return Promise.all([
        this.loadDashboard(),
        this.loadUsers(),
        this.loadAdminProjects(),
        this.loadAdminLogs(),
      ]);
    },

    // Export de données
    async exportData(type, format = "csv") {
      try {
        const response = await api.get(`/admin/export/${type}`, {
          params: { format },
          responseType: "blob",
        });

        // Créer et télécharger le fichier
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `madahost_${type}_${Date.now()}.${format}`
        );
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Erreur export données:", error);
        throw error;
      }
    },

    // Reset du store
    $reset() {
      this.isAdmin = false;
      this.checkingAdmin = false;
      this.adminCheckDone = false;
      this.dashboardStats = {
        totalUsers: 0,
        totalProjects: 0,
        totalDeployments: 0,
        activeProjects: 0,
        successfulDeployments: 0,
        failedDeployments: 0,
        newUsersThisMonth: 0,
        activeUsersToday: 0,
      };
      this.recentDeployments = [];
      this.recentUsers = [];
      this.activeProjects = [];
      this.users = [];
      this.adminProjects = [];
      this.adminDeployments = [];
      this.adminLogs = [];
      this.analyticsData = {
        userGrowth: [],
        deploymentTrends: [],
        projectsByFramework: [],
        errorRates: [],
      };
      this.error = null;
      this.lastUpdate = null;
    },
  },
});
