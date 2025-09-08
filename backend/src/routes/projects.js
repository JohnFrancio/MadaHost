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
router.post("/:id/deploy", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le projet appartient à l'utilisateur
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({
        success: false,
        error: "Projet non trouvé",
      });
    }

    // Créer un nouveau déploiement
    const { data: deployment, error: deploymentError } = await supabase
      .from("deployments")
      .insert([
        {
          project_id: id,
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
      });
    }

    // TODO: Lancer le processus de déploiement en arrière-plan
    // deployProject(deployment.id, project);

    res.json({
      success: true,
      deployment: {
        id: deployment.id,
        status: "pending",
        started_at: deployment.started_at,
      },
      message: "Déploiement lancé",
    });
  } catch (error) {
    console.error("❌ Erreur déploiement:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du lancement du déploiement",
    });
  }
});

module.exports = router;
