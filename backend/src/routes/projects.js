const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const axios = require("axios");

const router = express.Router();

// Configuration Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware d'authentification
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentification requise" });
  }
  next();
};

// Obtenir tous les projets de l'utilisateur
router.get("/", requireAuth, async (req, res) => {
  try {
    const { data: projects, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Erreur lors de la récupération des projets:", error);
      return res.status(500).json({ error: "Erreur serveur" });
    }

    res.json({
      success: true,
      projects: projects || [],
    });
  } catch (error) {
    console.error("❌ Erreur:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Obtenir les repos GitHub de l'utilisateur avec format normalisé
router.get("/github-repos", requireAuth, async (req, res) => {
  try {
    // Récupérer le token d'accès de l'utilisateur
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("access_token")
      .eq("id", req.user.id)
      .single();

    if (userError || !userData.access_token) {
      return res.status(401).json({
        success: false,
        error: "Token GitHub non trouvé",
        message: "Veuillez vous reconnecter avec GitHub",
      });
    }

    // Appeler l'API GitHub
    const response = await axios.get("https://api.github.com/user/repos", {
      headers: {
        Authorization: `token ${userData.access_token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "MadaHost-App",
      },
      params: {
        sort: "updated",
        per_page: 100,
        type: "all",
        affiliation: "owner,collaborator",
      },
    });

    // Normaliser les données pour le frontend
    const repos = response.data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      owner: {
        login: repo.owner.login,
        avatar: repo.owner.avatar_url,
      },
      language: repo.language,
      stargazersCount: repo.stargazers_count || 0,
      forksCount: repo.forks_count || 0,
      size: repo.size || 0,
      defaultBranch: repo.default_branch || "main",
      hasPages: repo.has_pages || false,
      createdAt: repo.created_at,
      updatedAt: repo.updated_at,
      pushedAt: repo.pushed_at,
      htmlUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      sshUrl: repo.ssh_url,
    }));

    // Analyser les langages disponibles
    const languages = [
      ...new Set(repos.map((r) => r.language).filter(Boolean)),
    ];

    // Analyser les frameworks (basique)
    const frameworks = [];

    res.json({
      success: true,
      repos,
      total: repos.length,
      filters: {
        languages: languages.sort(),
        frameworks: frameworks.sort(),
      },
      pagination: {
        current_page: 1,
        total_pages: 1,
        total_repos: repos.length,
        has_next: false,
        has_prev: false,
      },
    });
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des repos GitHub:", error);

    // Gestion des erreurs spécifiques
    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        error: "Token GitHub expiré",
        message: "Veuillez vous reconnecter avec GitHub",
        code: "TOKEN_EXPIRED",
      });
    }

    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des repos",
      details: error.message,
    });
  }
});

// Créer un nouveau projet avec configuration améliorée
router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      name,
      github_repo,
      branch = "main",
      build_command,
      output_dir,
      install_command,
      framework,
      auto_deploy = true,
      env_vars = [],
    } = req.body;

    // Validation
    if (!name || !github_repo) {
      return res.status(400).json({
        success: false,
        error: "Nom et repository GitHub requis",
      });
    }

    // Générer un sous-domaine unique
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const uniqueId = Date.now().toString(36);
    const subdomain = `${cleanName}-${uniqueId}`;
    const domain = `${subdomain}.madahost.dev`;

    // Définir les commandes par défaut selon le framework
    const getDefaultCommands = (detectedFramework) => {
      const defaults = {
        "Next.js": {
          build_command: "npm run build",
          output_dir: "out",
          install_command: "npm install",
        },
        "Nuxt.js": {
          build_command: "npm run generate",
          output_dir: "dist",
          install_command: "npm install",
        },
        "Vue.js": {
          build_command: "npm run build",
          output_dir: "dist",
          install_command: "npm install",
        },
        React: {
          build_command: "npm run build",
          output_dir: "build",
          install_command: "npm install",
        },
        Angular: {
          build_command: "npm run build",
          output_dir: "dist",
          install_command: "npm install",
        },
        Svelte: {
          build_command: "npm run build",
          output_dir: "public",
          install_command: "npm install",
        },
        Gatsby: {
          build_command: "npm run build",
          output_dir: "public",
          install_command: "npm install",
        },
        Astro: {
          build_command: "npm run build",
          output_dir: "dist",
          install_command: "npm install",
        },
        "HTML Statique": {
          build_command: "",
          output_dir: ".",
          install_command: "",
        },
      };

      return (
        defaults[detectedFramework] || {
          build_command: "npm run build",
          output_dir: "dist",
          install_command: "npm install",
        }
      );
    };

    const defaultCommands = getDefaultCommands(framework);

    const projectData = {
      user_id: req.user.id,
      name,
      github_repo,
      branch,
      build_command: build_command || defaultCommands.build_command,
      output_dir: output_dir || defaultCommands.output_dir,
      install_command: install_command || defaultCommands.install_command,
      domain,
      status: "created",
      framework: framework || null,
      auto_deploy: auto_deploy,
      env_vars: JSON.stringify(env_vars),
    };

    const { data: project, error } = await supabase
      .from("projects")
      .insert(projectData)
      .select()
      .single();

    if (error) {
      console.error("❌ Erreur lors de la création du projet:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la création du projet",
        details: error.message,
      });
    }

    console.log("✅ Projet créé:", project.name);

    res.status(201).json({
      success: true,
      project: {
        ...project,
        env_vars: project.env_vars ? JSON.parse(project.env_vars) : [],
      },
      message: "Projet créé avec succès",
      deploy_url: `https://${domain}`,
    });
  } catch (error) {
    console.error("❌ Erreur:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur",
      details: error.message,
    });
  }
});

// Obtenir un projet spécifique
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .single();

    if (error || !project) {
      return res.status(404).json({
        success: false,
        error: "Projet non trouvé",
      });
    }

    // Parser les variables d'environnement
    const projectWithParsedEnvVars = {
      ...project,
      env_vars: project.env_vars ? JSON.parse(project.env_vars) : [],
    };

    res.json({
      success: true,
      project: projectWithParsedEnvVars,
    });
  } catch (error) {
    console.error("❌ Erreur récupération projet:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur",
    });
  }
});

// Mettre à jour un projet
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Si env_vars est fourni, le convertir en JSON
    if (updates.env_vars) {
      updates.env_vars = JSON.stringify(updates.env_vars);
    }

    const { data: project, error } = await supabase
      .from("projects")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error || !project) {
      return res.status(404).json({
        success: false,
        error: "Projet non trouvé ou mise à jour impossible",
      });
    }

    res.json({
      success: true,
      project: {
        ...project,
        env_vars: project.env_vars ? JSON.parse(project.env_vars) : [],
      },
      message: "Projet mis à jour avec succès",
    });
  } catch (error) {
    console.error("❌ Erreur mise à jour projet:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur",
    });
  }
});

// Supprimer un projet
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Supprimer les déploiements associés
    await supabase.from("deployments").delete().eq("project_id", id);

    // Supprimer le projet
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id);

    if (error) {
      return res.status(404).json({
        success: false,
        error: "Projet non trouvé",
      });
    }

    res.json({
      success: true,
      message: "Projet supprimé avec succès",
    });
  } catch (error) {
    console.error("❌ Erreur suppression projet:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur",
    });
  }
});

// Déclencher un déploiement
// Route pour déployer un projet (version améliorée)
router.post("/:id/deploy", requireAuth, async (req, res) => {
  const projectId = req.params.id;

  try {
    // 1. Vérifier que le projet appartient à l'utilisateur
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", req.user.id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({
        success: false,
        error: "Projet non trouvé",
      });
    }

    // 2. Vérifier qu'il n'y a pas déjà un déploiement en cours
    const { data: activeDeployments } = await supabase
      .from("deployments")
      .select("id")
      .eq("project_id", projectId)
      .in("status", ["pending", "building"]);

    if (activeDeployments && activeDeployments.length > 0) {
      return res.status(409).json({
        success: false,
        error: "Un déploiement est déjà en cours pour ce projet",
        activeDeployment: activeDeployments[0].id,
      });
    }

    // 3. Créer un nouveau déploiement
    const { data: deployment, error: deploymentError } = await supabase
      .from("deployments")
      .insert([
        {
          project_id: projectId,
          status: "pending",
          started_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (deploymentError) {
      console.error("❌ Erreur création déploiement:", deploymentError);
      return res.status(500).json({
        success: false,
        error: "Impossible de créer le déploiement",
        details: deploymentError.message,
      });
    }

    // 4. Lancer le déploiement en arrière-plan
    const DeploymentService = require("../services/deploymentService");

    // Déploiement asynchrone
    DeploymentService.deployProject(deployment, project)
      .then((result) => {
        console.log("✅ Déploiement réussi:", result);
      })
      .catch((error) => {
        console.error("❌ Déploiement échoué:", error);
      });

    // 5. Répondre immédiatement avec les infos du déploiement
    res.status(202).json({
      success: true,
      deployment: {
        id: deployment.id,
        status: "pending",
        started_at: deployment.started_at,
        project_id: projectId,
      },
      message: "Déploiement lancé avec succès",
      tracking: {
        deploymentId: deployment.id,
        statusUrl: `/api/deployments/${deployment.id}`,
        logsUrl: `/api/deployments/${deployment.id}/logs`,
      },
    });
  } catch (error) {
    console.error("❌ Erreur lors du déploiement:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du lancement du déploiement",
      details: error.message,
    });
  }
});

// Route pour obtenir le statut d'un déploiement spécifique
router.get(
  "/deployments/:deploymentId/status",
  requireAuth,
  async (req, res) => {
    try {
      const { data: deployment, error } = await supabase
        .from("deployments")
        .select(
          `
        *,
        projects!inner(
          id,
          name,
          user_id,
          domain,
          github_repo
        )
      `
        )
        .eq("id", req.params.deploymentId)
        .eq("projects.user_id", req.user.id)
        .single();

      if (error || !deployment) {
        return res.status(404).json({
          success: false,
          error: "Déploiement non trouvé",
        });
      }

      // Calculer la progression si en cours
      let progress = 0;
      let estimatedTimeRemaining = null;

      if (deployment.status === "building") {
        const startTime = new Date(deployment.started_at);
        const now = new Date();
        const elapsedMs = now - startTime;
        const elapsedMinutes = elapsedMs / (1000 * 60);

        // Progression basée sur le temps (max 5 minutes)
        progress = Math.min(90, (elapsedMinutes / 5) * 90);
        estimatedTimeRemaining = Math.max(0, 5 - elapsedMinutes);
      } else if (deployment.status === "success") {
        progress = 100;
      } else if (deployment.status === "failed") {
        progress = 0;
      }

      res.json({
        success: true,
        deployment: {
          ...deployment,
          progress,
          estimatedTimeRemaining,
        },
      });
    } catch (error) {
      console.error("❌ Erreur statut déploiement:", error);
      res.status(500).json({
        success: false,
        error: "Erreur lors de la récupération du statut",
      });
    }
  }
);

// Route pour récupérer UN projet spécifique
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .single();

    if (error) {
      console.error("Erreur Supabase:", error);
      return res.status(404).json({ error: "Projet non trouvé" });
    }

    res.json({ project });
  } catch (error) {
    console.error("Erreur lors de la récupération du projet:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Route pour mettre à jour un projet
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const {
      install_command,
      build_command,
      output_dir,
      branch,
      auto_deploy,
      env_vars,
    } = req.body;

    const { data: project, error } = await supabase
      .from("projects")
      .update({
        install_command,
        build_command,
        output_dir,
        branch,
        auto_deploy,
        env_vars,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) {
      console.error("Erreur Supabase:", error);
      return res.status(404).json({ error: "Projet non trouvé" });
    }

    res.json({ project, message: "Projet mis à jour avec succès" });
  } catch (error) {
    console.error("Erreur lors de la mise à jour:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Route pour supprimer un projet
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user.id);

    if (error) {
      console.error("Erreur Supabase:", error);
      return res.status(404).json({ error: "Projet non trouvé" });
    }

    res.json({ message: "Projet supprimé avec succès" });
  } catch (error) {
    console.error("Erreur lors de la suppression:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Route pour récupérer les déploiements d'un projet
router.get("/:id/deployments", requireAuth, async (req, res) => {
  try {
    // Vérifier que le projet appartient à l'utilisateur
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .single();

    if (!project) {
      return res.status(404).json({ error: "Projet non trouvé" });
    }

    // Récupérer les déploiements
    const { data: deployments, error } = await supabase
      .from("deployments")
      .select("*")
      .eq("project_id", req.params.id)
      .order("started_at", { ascending: false });

    if (error) {
      console.error("Erreur Supabase:", error);
      return res.status(500).json({ error: "Erreur serveur" });
    }

    res.json({ deployments });
  } catch (error) {
    console.error("Erreur lors de la récupération des déploiements:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Route pour déployer un projet - AMÉLIORATION
router.post("/:id/deploy", requireAuth, async (req, res) => {
  const projectId = req.params.id;

  try {
    // 1. Vérifier que le projet appartient à l'utilisateur
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", req.user.id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: "Projet non trouvé" });
    }

    // 2. Mettre à jour le statut du projet
    await supabase
      .from("projects")
      .update({ status: "building" })
      .eq("id", projectId);

    // 3. Déclencher le déploiement en arrière-plan
    const deploymentService = require("../services/deploymentService");

    // Démarrer le déploiement de façon asynchrone
    deploymentService
      .deployProject(projectId)
      .then((result) => {
        console.log(`✅ Déploiement réussi pour ${project.name}`);
      })
      .catch((error) => {
        console.error(`❌ Déploiement échoué pour ${project.name}:`, error);
      });

    res.json({
      message: "Déploiement initié avec succès",
      status: "building",
    });
  } catch (error) {
    console.error("Erreur lors de l'initiation du déploiement:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
