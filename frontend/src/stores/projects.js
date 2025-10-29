// frontend/src/stores/projects.js
import { defineStore } from "pinia";
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://api.madahost.me/api",
  withCredentials: true,
});

export const useProjectsStore = defineStore("projects", {
  state: () => ({
    // Projets utilisateur
    projects: [],
    currentProject: null,

    // Repos GitHub
    githubRepos: [],
    githubReposLoading: false,
    githubReposError: null,
    githubReposFilters: {
      languages: [],
      frameworks: [],
    },

    // États de chargement
    loading: false,
    creating: false,
    error: null,

    // Filtres et recherche
    searchQuery: "",
    selectedLanguage: "",
    selectedFramework: "",
    sortBy: "updated", // updated, name, stars

    // Pagination
    pagination: {
      current_page: 1,
      total_pages: 1,
      total_repos: 0,
      has_next: false,
      has_prev: false,
    },
  }),

  getters: {
    // Projets filtrés
    filteredProjects: (state) => {
      let filtered = state.projects;

      if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (project) =>
            project.name.toLowerCase().includes(query) ||
            project.repo_name.toLowerCase().includes(query)
        );
      }

      return filtered;
    },

    // Repos GitHub filtrés
    filteredGithubRepos: (state) => {
      let filtered = state.githubRepos;

      // Filtre par recherche
      if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (repo) =>
            repo.name.toLowerCase().includes(query) ||
            repo.description?.toLowerCase().includes(query) ||
            repo.language?.toLowerCase().includes(query)
        );
      }

      // Filtre par langage
      if (state.selectedLanguage) {
        filtered = filtered.filter(
          (repo) => repo.language === state.selectedLanguage
        );
      }

      // Filtre par framework
      if (state.selectedFramework) {
        filtered = filtered.filter(
          (repo) => repo.framework === state.selectedFramework
        );
      }

      // Tri
      switch (state.sortBy) {
        case "name":
          filtered.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case "stars":
          filtered.sort((a, b) => b.stargazers_count - a.stargazers_count);
          break;
        case "updated":
        default:
          filtered.sort(
            (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
          );
      }

      return filtered;
    },

    // Statistiques
    projectsStats: (state) => {
      const totalProjects = state.projects.length;
      const activeProjects = state.projects.filter(
        (p) => p.status === "deployed"
      ).length;
      const frameworks = [...new Set(state.projects.map((p) => p.framework))];

      return {
        total: totalProjects,
        active: activeProjects,
        inactive: totalProjects - activeProjects,
        frameworks: frameworks.length,
      };
    },

    // Repos stats
    githubStats: (state) => ({
      total: state.githubRepos.length,
      languages: state.githubReposFilters.languages.length,
      frameworks: state.githubReposFilters.frameworks.length,
      private: state.githubRepos.filter((r) => r.private).length,
      public: state.githubRepos.filter((r) => !r.private).length,
    }),
  },

  actions: {
    // Charger les projets de l'utilisateur
    async loadProjects() {
      this.loading = true;
      this.error = null;

      try {
        const response = await api.get("/projects");
        this.projects = response.data.projects || [];
      } catch (error) {
        console.error("Erreur chargement projets:", error);
        this.error =
          error.response?.data?.message || "Erreur de chargement des projets";
        throw error;
      } finally {
        this.loading = false;
      }
    },

    // Charger les repos GitHub
    async loadGithubRepos(options = {}) {
      this.githubReposLoading = true;
      this.githubReposError = null;

      try {
        const params = {
          page: options.page || 1,
          limit: options.limit || 20,
        };

        const response = await api.get("/projects/github-repos", { params });

        if (response.data.success) {
          this.githubRepos = response.data.repos || [];
          this.pagination = response.data.pagination || {};
          this.githubReposFilters = response.data.filters || {
            languages: [],
            frameworks: [],
          };
        }
      } catch (error) {
        console.error("Erreur chargement repos GitHub:", error);
        this.githubReposError =
          error.response?.data?.message ||
          "Erreur de chargement des repositories";

        // Si token expiré, rediriger vers la reconnexion
        if (error.response?.status === 401) {
          this.githubReposError = "Connexion GitHub expirée. Reconnectez-vous.";
        }

        throw error;
      } finally {
        this.githubReposLoading = false;
      }
    },

    // Charger les détails d'un repo spécifique
    async loadGithubRepoDetails(owner, repo) {
      try {
        const response = await api.get(
          `/projects/github-repos/${owner}/${repo}`
        );
        return response.data.repo;
      } catch (error) {
        console.error("Erreur détails repo:", error);
        throw error;
      }
    },

    // Créer un nouveau projet
    // Créer un nouveau projet
    async createProject(projectData) {
      this.creating = true;
      this.error = null;

      try {
        console.log("Création projet avec données:", projectData);

        const response = await api.post("/projects", projectData);

        if (response.data.success) {
          // Ajouter le nouveau projet à la liste
          this.projects.unshift(response.data.project);
          console.log("Projet créé et ajouté à la liste");

          return {
            success: true,
            project: response.data.project,
            message: response.data.message || "Projet créé avec succès",
            deploy_url: response.data.deploy_url,
          };
        } else {
          throw new Error(response.data.error || "Erreur inconnue");
        }
      } catch (error) {
        console.error("Erreur création projet:", error);
        this.error =
          error.response?.data?.error ||
          error.message ||
          "Erreur lors de la création du projet";

        return {
          success: false,
          error: this.error,
          details: error.response?.data,
        };
      } finally {
        this.creating = false;
      }
    },

    // Supprimer un projet
    async deleteProject(projectId) {
      try {
        await api.delete(`/projects/${projectId}`);

        // Retirer de la liste locale
        this.projects = this.projects.filter((p) => p.id !== projectId);

        return { success: true };
      } catch (error) {
        console.error("Erreur suppression projet:", error);
        throw error;
      }
    },

    // Mettre à jour un projet
    async updateProject(projectId, updates) {
      try {
        const response = await api.patch(`/projects/${projectId}`, updates);

        // Mettre à jour dans la liste locale
        const index = this.projects.findIndex((p) => p.id === projectId);
        if (index !== -1) {
          this.projects[index] = {
            ...this.projects[index],
            ...response.data.project,
          };
        }

        return { success: true, project: response.data.project };
      } catch (error) {
        console.error("Erreur mise à jour projet:", error);
        throw error;
      }
    },

    // Déclencher un déploiement
    async deployProject(projectId) {
      try {
        const response = await api.post(`/projects/${projectId}/deploy`);
        return response.data;
      } catch (error) {
        console.error("Erreur déploiement:", error);
        throw error;
      }
    },

    // Actions de filtrage et recherche
    setSearchQuery(query) {
      this.searchQuery = query;
    },

    setLanguageFilter(language) {
      this.selectedLanguage = language;
    },

    setFrameworkFilter(framework) {
      this.selectedFramework = framework;
    },

    setSortBy(sortBy) {
      this.sortBy = sortBy;
    },

    clearFilters() {
      this.searchQuery = "";
      this.selectedLanguage = "";
      this.selectedFramework = "";
      this.sortBy = "updated";
    },

    // Sélectionner un projet actuel
    setCurrentProject(project) {
      this.currentProject = project;
    },

    // Nettoyer les erreurs
    clearError() {
      this.error = null;
      this.githubReposError = null;
    },

    // Reset du store
    $reset() {
      this.projects = [];
      this.currentProject = null;
      this.githubRepos = [];
      this.githubReposLoading = false;
      this.githubReposError = null;
      this.loading = false;
      this.creating = false;
      this.error = null;
      this.searchQuery = "";
      this.selectedLanguage = "";
      this.selectedFramework = "";
      this.sortBy = "updated";
      this.pagination = {
        current_page: 1,
        total_pages: 1,
        total_repos: 0,
        has_next: false,
        has_prev: false,
      };
    },
  },
});
