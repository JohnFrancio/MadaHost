// Ajoutez ces annotations au début du fichier backend/src/routes/github.js

/**
 * @swagger
 * tags:
 *   name: GitHub
 *   description: Intégration avec l'API GitHub
 */

/**
 * @swagger
 * /github/repos:
 *   get:
 *     summary: Obtenir tous les repositories de l'utilisateur
 *     tags: [GitHub]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, owner, member]
 *           default: all
 *         description: Type de repositories
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created, updated, pushed, full_name]
 *           default: updated
 *         description: Critère de tri
 *       - in: query
 *         name: direction
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Direction du tri
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 100
 *         description: Nombre de résultats par page
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page de résultats
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Terme de recherche
 *     responses:
 *       200:
 *         description: Liste des repositories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GitHubRepository'
 *                 repositories:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GitHubRepository'
 *                 total:
 *                   type: number
 *                 page:
 *                   type: number
 *       400:
 *         description: Token GitHub manquant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur

/**
 * @swagger
 * /github/repos/{owner}/{repo}/branches:
 *   get:
 *     summary: Obtenir les branches d'un repository
 *     tags: [GitHub]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: owner
 *         required: true
 *         schema:
 *           type: string
 *         description: Propriétaire du repository
 *       - in: path
 *         name: repo
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du repository
 *     responses:
 *       200:
 *         description: Liste des branches
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       sha:
 *                         type: string
 *                       protected:
 *                         type: boolean
 *       500:
 *         description: Erreur serveur

/**
 * @swagger
 * /github/repos/{owner}/{repo}/detect-framework:
 *   post:
 *     summary: Détecter automatiquement le framework d'un repository
 *     tags: [GitHub]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: owner
 *         required: true
 *         schema:
 *           type: string
 *         description: Propriétaire du repository
 *       - in: path
 *         name: repo
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du repository
 *     responses:
 *       200:
 *         description: Framework détecté
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     framework:
 *                       type: string
 *                       description: Framework détecté
 *                     confidence:
 *                       type: number
 *                       description: Niveau de confiance (0-1)
 *                     buildCommand:
 *                       type: string
 *                       description: Commande de build recommandée
 *                     outputDir:
 *                       type: string
 *                       description: Dossier de sortie recommandé
 *                     installCommand:
 *                       type: string
 *                       description: Commande d'installation recommandée
 *       500:
 *         description: Erreur serveur

/**
 * @swagger
 * /github/user:
 *   get:
 *     summary: Obtenir les informations de l'utilisateur GitHub connecté
 *     tags: [GitHub]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Informations utilisateur GitHub
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     login:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                     bio:
 *                       type: string
 *                     company:
 *                       type: string
 *                     location:
 *                       type: string
 *                     publicRepos:
 *                       type: number
 *                     followers:
 *                       type: number
 *                     following:
 *                       type: number
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: Erreur serveur

/**
 * @swagger
 * /github/test:
 *   get:
 *     summary: Route de test pour débugger l'intégration GitHub
 *     tags: [GitHub]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Informations de debug
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 tokenExists:
 *                   type: boolean
 *                 tokenPreview:
 *                   type: string
 *                 githubApiTest:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     repoCount:
 *                       type: number
 *                     firstRepo:
 *                       type: string
 *       500:
 *         description: Erreur serveur
 */
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
const createGitHubService = async (req, res, next) => {
  try {
    // Récupérer le token depuis différentes sources possibles
    let token = req.user.githubAccessToken || req.user.access_token;

    if (!token) {
      // Essayer de récupérer depuis Supabase
      const { createClient } = require("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: userData } = await supabase
        .from("users")
        .select("access_token")
        .eq("id", req.user.id)
        .single();

      token = userData?.access_token;
    }

    if (!token) {
      return res.status(400).json({
        error: "Token GitHub manquant",
        message: "Veuillez vous reconnecter avec GitHub",
      });
    }

    req.githubService = new GitHubService(token);
    next();
  } catch (error) {
    console.error("❌ Erreur création service GitHub:", error);
    return res.status(500).json({ error: "Erreur interne" });
  }
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
      per_page = 100,
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

    // 🔧 FIX: Format de réponse compatible avec le frontend
    res.json({
      success: true,
      data: filteredRepos, // Le frontend attend data, pas repositories
      repositories: filteredRepos, // Garde pour compatibilité
      total: filteredRepos.length,
      page: parseInt(page) || 1,
    });
  } catch (error) {
    console.error("❌ Erreur API /repos:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des repositories",
      details: error.message,
    });
  }
});

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

      const branches = await req.githubService.getRepoBranches(owner, repo);

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

      // Récupérer les fichiers à la racine et package.json
      const detection = await req.githubService.detectFramework(owner, repo);

      console.log(
        `✅ Framework détecté: ${detection.framework} (${Math.round(
          detection.confidence * 100
        )}%)`
      );

      res.json({
        success: true,
        data: detection,
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

// Route de test pour debug
router.get("/test", requireAuth, async (req, res) => {
  console.log("🧪 Route de test GitHub");
  console.log("👤 User:", req.user);

  try {
    let token = req.user?.githubAccessToken || req.user?.access_token;

    if (!token) {
      const { createClient } = require("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data } = await supabase
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

    if (token) {
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
    } else {
      res.json({
        success: false,
        user: req.user,
        tokenExists: false,
        error: "Aucun token GitHub trouvé",
      });
    }
  } catch (error) {
    console.error("❌ Erreur test:", error);
    res.json({
      success: false,
      error: error.message,
      details: error.response?.data,
    });
  }
});

module.exports = router;
