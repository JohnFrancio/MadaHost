// backend/src/routes/github.js
const express = require("express");
const router = express.Router();
const GitHubService = require("../services/githubService");

// Middleware d'authentification
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentification requise" });
  }
  next();
};

// Middleware pour créer le service GitHub
const createGitHubService = (req, res, next) => {
  if (!req.user.githubAccessToken) {
    return res.status(400).json({ error: "Token GitHub manquant" });
  }
  req.githubService = new GitHubService(req.user.githubAccessToken);
  next();
};

/**
 * GET /api/github/repos
 * Récupérer tous les repositories de l'utilisateur
 */
router.get("/repos", requireAuth, createGitHubService, async (req, res) => {
  console.log("📡 API /repos appelée pour:", req.user.username);

  try {
    const {
      type = "all",
      sort = "updated",
      direction = "desc",
      per_page = 100, // Augmenter la limite
      page = 1,
    } = req.query;

    console.log("📋 Paramètres repos:", {
      type,
      sort,
      direction,
      per_page,
      page,
    });

    const repos = await req.githubService.getUserRepos({
      type,
      sort,
      direction,
      per_page: parseInt(per_page),
      page: parseInt(page),
    });

    // Filtrer par recherche si spécifiée
    let filteredRepos = repos;
    const { search } = req.query;

    if (search) {
      const searchLower = search.toLowerCase();
      filteredRepos = repos.filter(
        (repo) =>
          repo.name.toLowerCase().includes(searchLower) ||
          (repo.description &&
            repo.description.toLowerCase().includes(searchLower))
      );
    }

    console.log(`✅ ${filteredRepos.length}/${repos.length} repos retournés`);

    // 👈 IMPORTANT: Format de réponse compatible avec le frontend
    res.json({
      repositories: filteredRepos,
      total: filteredRepos.length,
      page: parseInt(page) || 1,
    });
  } catch (error) {
    console.error("❌ Erreur API /repos:", error);
    console.error("📍 Stack:", error.stack);

    res.status(500).json({
      error: "Erreur lors de la récupération des repositories",
      details: error.message,
      type: error.name,
    });
  }
});

// 🔧 SOLUTION 4: Tester la route directement
// Ajoute cette route de test dans github.js :

router.get("/test", requireAuth, async (req, res) => {
  console.log("🧪 Route de test GitHub");
  console.log("👤 User:", req.user);
  console.log("📋 Session:", req.session);

  // Essayer de récupérer le token
  let token = req.user?.githubAccessToken || req.user?.access_token;

  if (!token) {
    const { createClient } = require("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", req.user.id)
      .single();

    console.log("🔍 Data utilisateur depuis Supabase:", data);
    token = data?.access_token;
  }

  console.log(
    "🔑 Token trouvé:",
    token ? token.substring(0, 8) + "..." : "AUCUN"
  );

  // Test API GitHub direct
  if (token) {
    try {
      const axios = require("axios");
      const response = await axios.get(
        "https://api.github.com/user/repos?per_page=5",
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "MadaHost-App",
          },
        }
      );

      console.log("✅ API GitHub OK:", response.data.length, "repos");

      res.json({
        success: true,
        user: req.user,
        tokenExists: !!token,
        tokenPreview: token ? token.substring(0, 8) + "..." : null,
        githubApiTest: {
          status: "OK",
          repoCount: response.data.length,
          firstRepo: response.data[0]?.name,
        },
      });
    } catch (apiError) {
      console.error("❌ Erreur API GitHub:", apiError.message);
      res.json({
        success: false,
        user: req.user,
        tokenExists: !!token,
        tokenPreview: token ? token.substring(0, 8) + "..." : null,
        githubApiTest: {
          status: "ERROR",
          error: apiError.message,
          status_code: apiError.response?.status,
        },
      });
    }
  } else {
    res.json({
      success: false,
      user: req.user,
      tokenExists: false,
      error: "Aucun token GitHub trouvé",
    });
  }
});

/**
 * GET /api/github/repos/search
 * Rechercher des repositories avec filtres avancés
 */
router.get(
  "/repos/search",
  requireAuth,
  createGitHubService,
  async (req, res) => {
    try {
      const { q: query } = req.query;

      const filters = {
        language: req.query.language,
        framework: req.query.framework,
        hasPages:
          req.query.has_pages === "true"
            ? true
            : req.query.has_pages === "false"
            ? false
            : null,
        isPrivate:
          req.query.is_private === "true"
            ? true
            : req.query.is_private === "false"
            ? false
            : null,
        minStars: parseInt(req.query.min_stars) || 0,
        maxAge: req.query.max_age ? parseInt(req.query.max_age) : null,
      };

      console.log(`🔍 Recherche repos: "${query}" avec filtres:`, filters);

      const repos = await req.githubService.searchRepositories(query, filters);

      console.log(`✅ ${repos.length} repos trouvés`);

      res.json({
        success: true,
        data: repos,
        query,
        filters,
        total: repos.length,
      });
    } catch (error) {
      console.error("❌ Erreur recherche repos:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/github/repos/:owner/:repo
 * Obtenir les détails d'un repository spécifique
 */
router.get(
  "/repos/:owner/:repo",
  requireAuth,
  createGitHubService,
  async (req, res) => {
    try {
      const { owner, repo } = req.params;

      console.log(`📋 Récupération détails: ${owner}/${repo}`);

      const repoDetails = await req.githubService.getRepository(owner, repo);

      console.log(`✅ Détails récupérés pour ${repoDetails.fullName}`);

      res.json({
        success: true,
        data: repoDetails,
      });
    } catch (error) {
      console.error("❌ Erreur récupération détails repo:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/github/repos/:owner/:repo/branches
 * Obtenir les branches d'un repository
 */
router.get(
  "/repos/:owner/:repo/branches",
  requireAuth,
  createGitHubService,
  async (req, res) => {
    try {
      const { owner, repo } = req.params;

      const response = await req.githubService.api.get(
        `/repos/${owner}/${repo}/branches`
      );
      const branches = response.data.map((branch) => ({
        name: branch.name,
        sha: branch.commit.sha,
        protected: branch.protected || false,
      }));

      res.json({
        success: true,
        data: branches,
      });
    } catch (error) {
      console.error("❌ Erreur récupération branches:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/github/repos/:owner/:repo/detect-framework
 * Détecter automatiquement le framework d'un repository
 */
router.post(
  "/repos/:owner/:repo/detect-framework",
  requireAuth,
  createGitHubService,
  async (req, res) => {
    try {
      const { owner, repo } = req.params;

      console.log(`🔍 Détection framework: ${owner}/${repo}`);

      // Récupérer les fichiers à la racine
      const contentsResponse = await req.githubService.api.get(
        `/repos/${owner}/${repo}/contents`
      );

      // Détecter le framework
      const detection = await req.githubService.detectFramework(
        contentsResponse.data
      );

      console.log(
        `✅ Framework détecté: ${detection.framework} (${detection.confidence})`
      );

      // Suggérer la configuration de build
      const buildConfig = this.getBuildConfig(detection.framework);

      res.json({
        success: true,
        data: {
          framework: detection.framework,
          confidence: detection.confidence,
          buildConfig,
        },
      });
    } catch (error) {
      console.error("❌ Erreur détection framework:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/github/repos/:owner/:repo/webhook
 * Créer un webhook pour un repository
 */
router.post(
  "/repos/:owner/:repo/webhook",
  requireAuth,
  createGitHubService,
  async (req, res) => {
    try {
      const { owner, repo } = req.params;
      const { webhookUrl } = req.body;

      if (!webhookUrl) {
        return res.status(400).json({
          success: false,
          error: "URL du webhook requise",
        });
      }

      console.log(`🔗 Création webhook: ${owner}/${repo} -> ${webhookUrl}`);

      const webhook = await req.githubService.createWebhook(
        owner,
        repo,
        webhookUrl
      );

      console.log(`✅ Webhook créé: ID ${webhook.id}`);

      res.json({
        success: true,
        data: webhook,
      });
    } catch (error) {
      console.error("❌ Erreur création webhook:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * DELETE /api/github/repos/:owner/:repo/webhook/:webhookId
 * Supprimer un webhook
 */
router.delete(
  "/repos/:owner/:repo/webhook/:webhookId",
  requireAuth,
  createGitHubService,
  async (req, res) => {
    try {
      const { owner, repo, webhookId } = req.params;

      console.log(
        `🗑️ Suppression webhook: ${owner}/${repo} webhook ${webhookId}`
      );

      await req.githubService.deleteWebhook(owner, repo, webhookId);

      console.log(`✅ Webhook supprimé`);

      res.json({
        success: true,
        message: "Webhook supprimé avec succès",
      });
    } catch (error) {
      console.error("❌ Erreur suppression webhook:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/github/user
 * Obtenir les informations de l'utilisateur GitHub connecté
 */
router.get("/user", requireAuth, createGitHubService, async (req, res) => {
  try {
    const user = await req.githubService.getCurrentUser();

    res.json({
      success: true,
      data: {
        login: user.login,
        name: user.name,
        email: user.email,
        avatar: user.avatar_url,
        bio: user.bio,
        company: user.company,
        location: user.location,
        publicRepos: user.public_repos,
        followers: user.followers,
        following: user.following,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("❌ Erreur récupération utilisateur:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Fonction helper pour obtenir la config de build selon le framework
 */
function getBuildConfig(framework) {
  const configs = {
    "Next.js": {
      buildCommand: "npm run build",
      outputDirectory: "out",
      installCommand: "npm install",
      devCommand: "npm run dev",
    },
    "Nuxt.js": {
      buildCommand: "npm run generate",
      outputDirectory: "dist",
      installCommand: "npm install",
      devCommand: "npm run dev",
    },
    "Vue.js": {
      buildCommand: "npm run build",
      outputDirectory: "dist",
      installCommand: "npm install",
      devCommand: "npm run serve",
    },
    React: {
      buildCommand: "npm run build",
      outputDirectory: "build",
      installCommand: "npm install",
      devCommand: "npm start",
    },
    Angular: {
      buildCommand: "npm run build --prod",
      outputDirectory: "dist",
      installCommand: "npm install",
      devCommand: "npm start",
    },
    Svelte: {
      buildCommand: "npm run build",
      outputDirectory: "public",
      installCommand: "npm install",
      devCommand: "npm run dev",
    },
    Gatsby: {
      buildCommand: "npm run build",
      outputDirectory: "public",
      installCommand: "npm install",
      devCommand: "npm run develop",
    },
    Hugo: {
      buildCommand: "hugo",
      outputDirectory: "public",
      installCommand: "",
      devCommand: "hugo server",
    },
    Jekyll: {
      buildCommand: "bundle exec jekyll build",
      outputDirectory: "_site",
      installCommand: "bundle install",
      devCommand: "bundle exec jekyll serve",
    },
    Astro: {
      buildCommand: "npm run build",
      outputDirectory: "dist",
      installCommand: "npm install",
      devCommand: "npm run dev",
    },
    "HTML Statique": {
      buildCommand: "",
      outputDirectory: ".",
      installCommand: "",
      devCommand: "python -m http.server 8000",
    },
  };

  return (
    configs[framework] || {
      buildCommand: "npm run build",
      outputDirectory: "dist",
      installCommand: "npm install",
      devCommand: "npm start",
    }
  );
}

module.exports = router;
