// frontend/src/composables/useGitHub.js
import { ref, reactive } from "vue";
import axios from "axios";

export function useGitHub() {
  const loading = ref(false);
  const error = ref(null);
  const repos = ref([]);
  const repoDetails = ref(null);
  const searchResults = ref([]);
  const user = ref(null);

  // Configuration axios avec credentials
  const api = axios.create({
    baseURL: "http://localhost:3001/api",
    withCredentials: true,
  });

  // État des filtres pour la recherche
  const searchFilters = reactive({
    query: "",
    language: "",
    framework: "",
    hasPages: null,
    isPrivate: null,
    minStars: 0,
    maxAge: null,
  });

  /**
   * Récupérer tous les repositories de l'utilisateur
   */
  const getAllRepos = async (options = {}) => {
    loading.value = true;
    error.value = null;

    try {
      console.log("📥 Récupération des repositories...");

      const response = await api.get("/github/repos", { params: options });

      if (response.data.success) {
        repos.value = response.data.data;
        console.log(`✅ ${repos.value.length} repositories récupérés`);
        return repos.value;
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      console.error("❌ Erreur récupération repos:", err);
      error.value = err.response?.data?.error || err.message;
      repos.value = [];
      return [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * Rechercher des repositories avec filtres
   */
  const searchRepos = async (customFilters = {}) => {
    loading.value = true;
    error.value = null;

    try {
      const filters = { ...searchFilters, ...customFilters };

      // Nettoyer les filtres vides
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(
          ([_, value]) => value !== null && value !== "" && value !== undefined
        )
      );

      console.log("🔍 Recherche avec filtres:", cleanFilters);

      const response = await api.get("/github/repos/search", {
        params: cleanFilters,
      });

      if (response.data.success) {
        searchResults.value = response.data.data;
        console.log(`✅ ${searchResults.value.length} résultats trouvés`);
        return searchResults.value;
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      console.error("❌ Erreur recherche repos:", err);
      error.value = err.response?.data?.error || err.message;
      searchResults.value = [];
      return [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * Obtenir les détails d'un repository
   */
  const getRepoDetails = async (owner, repoName) => {
    loading.value = true;
    error.value = null;

    try {
      console.log(`📋 Récupération détails: ${owner}/${repoName}`);

      const response = await api.get(`/github/repos/${owner}/${repoName}`);

      if (response.data.success) {
        repoDetails.value = response.data.data;
        console.log(`✅ Détails récupérés pour ${repoDetails.value.fullName}`);
        return repoDetails.value;
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      console.error("❌ Erreur récupération détails:", err);
      error.value = err.response?.data?.error || err.message;
      repoDetails.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Obtenir les branches d'un repository
   */
  const getRepoBranches = async (owner, repoName) => {
    loading.value = true;
    error.value = null;

    try {
      console.log(`🌿 Récupération branches: ${owner}/${repoName}`);

      const response = await api.get(
        `/github/repos/${owner}/${repoName}/branches`
      );

      if (response.data.success) {
        console.log(`✅ ${response.data.data.length} branches récupérées`);
        return response.data.data;
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      console.error("❌ Erreur récupération branches:", err);
      error.value = err.response?.data?.error || err.message;
      return [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * Détecter automatiquement le framework
   */
  const detectFramework = async (owner, repoName) => {
    loading.value = true;
    error.value = null;

    try {
      console.log(`🔍 Détection framework: ${owner}/${repoName}`);

      const response = await api.post(
        `/github/repos/${owner}/${repoName}/detect-framework`
      );

      if (response.data.success) {
        const detection = response.data.data;
        console.log(
          `✅ Framework détecté: ${detection.framework} (${Math.round(
            detection.confidence * 100
          )}%)`
        );
        return detection;
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      console.error("❌ Erreur détection framework:", err);
      error.value = err.response?.data?.error || err.message;
      return {
        framework: "Inconnu",
        confidence: 0,
        buildConfig: {
          buildCommand: "npm run build",
          outputDirectory: "dist",
          installCommand: "npm install",
        },
      };
    } finally {
      loading.value = false;
    }
  };

  /**
   * Créer un webhook pour un repository
   */
  const createWebhook = async (owner, repoName, webhookUrl) => {
    loading.value = true;
    error.value = null;

    try {
      console.log(`🔗 Création webhook: ${owner}/${repoName}`);

      const response = await api.post(
        `/github/repos/${owner}/${repoName}/webhook`,
        {
          webhookUrl,
        }
      );

      if (response.data.success) {
        console.log(`✅ Webhook créé: ID ${response.data.data.id}`);
        return response.data.data;
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      console.error("❌ Erreur création webhook:", err);
      error.value = err.response?.data?.error || err.message;
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Supprimer un webhook
   */
  const deleteWebhook = async (owner, repoName, webhookId) => {
    loading.value = true;
    error.value = null;

    try {
      console.log(`🗑️ Suppression webhook: ${owner}/${repoName}`);

      const response = await api.delete(
        `/github/repos/${owner}/${repoName}/webhook/${webhookId}`
      );

      if (response.data.success) {
        console.log(`✅ Webhook supprimé`);
        return true;
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      console.error("❌ Erreur suppression webhook:", err);
      error.value = err.response?.data?.error || err.message;
      return false;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Obtenir les informations de l'utilisateur GitHub
   */
  const getGitHubUser = async () => {
    loading.value = true;
    error.value = null;

    try {
      console.log("👤 Récupération infos utilisateur GitHub...");

      const response = await api.get("/github/user");

      if (response.data.success) {
        user.value = response.data.data;
        console.log(`✅ Utilisateur: ${user.value.login}`);
        return user.value;
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      console.error("❌ Erreur récupération utilisateur:", err);
      error.value = err.response?.data?.error || err.message;
      user.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Filtrer les repositories côté client
   */
  const filterRepos = (reposList, filters) => {
    let filtered = [...reposList];

    // Filtre par nom/description
    if (filters.query) {
      const query = filters.query.toLowerCase();
      filtered = filtered.filter(
        (repo) =>
          repo.name.toLowerCase().includes(query) ||
          (repo.description && repo.description.toLowerCase().includes(query))
      );
    }

    // Filtre par langage
    if (filters.language) {
      filtered = filtered.filter(
        (repo) =>
          repo.language &&
          repo.language.toLowerCase() === filters.language.toLowerCase()
      );
    }

    // Filtre par type (public/privé)
    if (filters.isPrivate !== null) {
      filtered = filtered.filter((repo) => repo.private === filters.isPrivate);
    }

    // Filtre par GitHub Pages
    if (filters.hasPages !== null) {
      filtered = filtered.filter((repo) => repo.hasPages === filters.hasPages);
    }

    // Filtre par nombre d'étoiles
    if (filters.minStars > 0) {
      filtered = filtered.filter(
        (repo) => repo.stargazersCount >= filters.minStars
      );
    }

    // Filtre par âge (jours)
    if (filters.maxAge) {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() - filters.maxAge);
      filtered = filtered.filter((repo) => new Date(repo.pushedAt) >= maxDate);
    }

    return filtered;
  };

  /**
   * Obtenir les langages uniques des repos
   */
  const getUniqueLanguages = (reposList) => {
    const languages = reposList
      .map((repo) => repo.language)
      .filter((lang) => lang)
      .reduce((acc, lang) => {
        acc[lang] = (acc[lang] || 0) + 1;
        return acc;
      }, {});

    return Object.entries(languages)
      .sort((a, b) => b[1] - a[1])
      .map(([lang]) => lang);
  };

  /**
   * Formater la taille d'un repository
   */
  const formatRepoSize = (sizeInKb) => {
    if (sizeInKb < 1024) return `${sizeInKb} KB`;
    if (sizeInKb < 1024 * 1024) return `${(sizeInKb / 1024).toFixed(1)} MB`;
    return `${(sizeInKb / (1024 * 1024)).toFixed(1)} GB`;
  };

  /**
   * Obtenir la couleur associée à un langage
   */
  const getLanguageColor = (language) => {
    const colors = {
      JavaScript: "#f1e05a",
      TypeScript: "#2b7489",
      Vue: "#4FC08D",
      React: "#61dafb",
      HTML: "#e34c26",
      CSS: "#563d7c",
      Python: "#3572A5",
      Java: "#b07219",
      "C++": "#f34b7d",
      "C#": "#239120",
      PHP: "#4F5D95",
      Ruby: "#701516",
      Go: "#00ADD8",
      Rust: "#dea584",
      Swift: "#ffac45",
    };
    return colors[language] || "#808080";
  };

  return {
    // État
    loading,
    error,
    repos,
    repoDetails,
    searchResults,
    user,
    searchFilters,

    // Actions principales
    getAllRepos,
    searchRepos,
    getRepoDetails,
    getRepoBranches,
    detectFramework,
    createWebhook,
    deleteWebhook,
    getGitHubUser,

    // Utilitaires
    filterRepos,
    getUniqueLanguages,
    formatRepoSize,
    getLanguageColor,
  };
}
