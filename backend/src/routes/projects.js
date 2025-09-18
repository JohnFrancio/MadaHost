const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const { exec } = require("child_process");

const router = express.Router();

// Configuration Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware d'authentification
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentification requise",
    });
  }
  next();
};

// Fonction utilitaire pour exécuter des commandes
function execCommand(command, timeout = 30000) {
  return new Promise((resolve, reject) => {
    exec(command, { timeout }, (error, stdout, stderr) => {
      if (error) {
        reject(
          new Error(`${error.message}\nStdout: ${stdout}\nStderr: ${stderr}`)
        );
        return;
      }
      resolve(stdout);
    });
  });
}

// 1. Obtenir tous les projets de l'utilisateur
router.get("/", requireAuth, async (req, res) => {
  try {
    const { data: projects, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Erreur lors de la récupération des projets:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur serveur",
      });
    }

    // Parser les env_vars pour chaque projet
    const projectsWithParsedEnv = projects.map((project) => ({
      ...project,
      env_vars: project.env_vars ? JSON.parse(project.env_vars) : [],
    }));

    res.json({
      success: true,
      projects: projectsWithParsedEnv,
    });
  } catch (error) {
    console.error("❌ Erreur:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur",
    });
  }
});

// 2. Obtenir UN projet spécifique
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

// 3. Obtenir les repos GitHub
router.get("/github-repos", requireAuth, async (req, res) => {
  try {
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
      defaultBranch: repo.default_branch || "main",
      htmlUrl: repo.html_url,
    }));

    res.json({
      success: true,
      repos,
      total: repos.length,
    });
  } catch (error) {
    console.error("❌ Erreur repos GitHub:", error);

    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        error: "Token GitHub expiré",
        message: "Veuillez vous reconnecter avec GitHub",
      });
    }

    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des repos",
    });
  }
});

// 4. Créer un nouveau projet
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
    const domain = `${subdomain}.madahost.me`;

    // Commandes par défaut selon le framework
    const getDefaultCommands = (detectedFramework) => {
      const defaults = {
        "Next.js": {
          build_command: "npm run build",
          output_dir: "out",
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
      auto_deploy,
      env_vars: JSON.stringify(env_vars),
    };

    const { data: project, error } = await supabase
      .from("projects")
      .insert(projectData)
      .select()
      .single();

    if (error) {
      console.error("❌ Erreur création projet:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la création du projet",
      });
    }

    res.status(201).json({
      success: true,
      project: {
        ...project,
        env_vars: project.env_vars ? JSON.parse(project.env_vars) : [],
      },
      message: "Projet créé avec succès",
    });
  } catch (error) {
    console.error("❌ Erreur:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur",
    });
  }
});

// 5. Mettre à jour un projet
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Vérifier que le projet appartient à l'utilisateur
    const { data: existingProject, error: checkError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();

    if (checkError || !existingProject) {
      return res.status(404).json({
        success: false,
        error: "Projet non trouvé",
      });
    }

    // Convertir env_vars en JSON si fourni
    if (updates.env_vars && Array.isArray(updates.env_vars)) {
      updates.env_vars = JSON.stringify(updates.env_vars);
    }

    // Ajouter la date de mise à jour
    updates.updated_at = new Date().toISOString();

    const { data: project, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) {
      console.error("❌ Erreur mise à jour:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la mise à jour",
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

// 6. Supprimer un projet
router.delete("/:id", requireAuth, async (req, res) => {
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

    // Supprimer d'abord tous les déploiements du projet
    await supabase.from("deployments").delete().eq("project_id", id);

    // Supprimer les fichiers du projet (si ils existent)
    const outputDir = path.join(__dirname, "../../public", id);
    try {
      await execCommand(`rm -rf "${outputDir}"`);
      console.log(`🧹 Fichiers supprimés: ${outputDir}`);
    } catch (cleanupError) {
      console.warn("⚠️ Erreur nettoyage fichiers:", cleanupError.message);
    }

    // Supprimer le projet
    const { error: deleteError } = await supabase
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id);

    if (deleteError) {
      throw deleteError;
    }

    res.json({
      success: true,
      message: "Projet supprimé avec succès",
    });
  } catch (error) {
    console.error("❌ Erreur suppression projet:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la suppression du projet",
    });
  }
});

// 7. Route pour obtenir les branches d'un repo GitHub
router.get("/:owner/:repo/branches", requireAuth, async (req, res) => {
  try {
    const { owner, repo } = req.params;

    const { data: userData } = await supabase
      .from("users")
      .select("access_token")
      .eq("id", req.user.id)
      .single();

    if (!userData?.access_token) {
      return res.status(401).json({
        success: false,
        error: "Token GitHub non trouvé",
      });
    }

    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/branches`,
      {
        headers: {
          Authorization: `token ${userData.access_token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    const branches = response.data.map((branch) => ({
      name: branch.name,
      sha: branch.commit.sha,
      protected: branch.protected || false,
    }));

    res.json({
      success: true,
      branches,
    });
  } catch (error) {
    console.error("❌ Erreur récupération branches:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des branches",
    });
  }
});

// 8. Détecter le framework d'un projet GitHub
router.post("/detect-framework", requireAuth, async (req, res) => {
  try {
    const { owner, repo } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({
        success: false,
        error: "Owner et repo requis",
      });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("access_token")
      .eq("id", req.user.id)
      .single();

    if (!userData?.access_token) {
      return res.status(401).json({
        success: false,
        error: "Token GitHub non trouvé",
      });
    }

    // Récupérer le package.json pour détecter le framework
    let packageJson = null;
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/contents/package.json`,
        {
          headers: {
            Authorization: `token ${userData.access_token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (response.data.content) {
        const content = Buffer.from(response.data.content, "base64").toString();
        packageJson = JSON.parse(content);
      }
    } catch (error) {
      console.log("Package.json non trouvé, détection basique");
    }

    let framework = null;
    let buildConfig = null;

    if (packageJson) {
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Détection du framework
      if (dependencies.next) {
        framework = "Next.js";
        buildConfig = {
          buildCommand: "npm run build",
          outputDirectory: "out",
          installCommand: "npm install",
        };
      } else if (dependencies.nuxt) {
        framework = "Nuxt.js";
        buildConfig = {
          buildCommand: "npm run generate",
          outputDirectory: "dist",
          installCommand: "npm install",
        };
      } else if (dependencies.vue) {
        framework = "Vue.js";
        buildConfig = {
          buildCommand: "npm run build",
          outputDirectory: "dist",
          installCommand: "npm install",
        };
      } else if (dependencies.react) {
        framework = "React";
        buildConfig = {
          buildCommand: "npm run build",
          outputDirectory: "build",
          installCommand: "npm install",
        };
      } else if (dependencies["@angular/core"]) {
        framework = "Angular";
        buildConfig = {
          buildCommand: "npm run build",
          outputDirectory: "dist",
          installCommand: "npm install",
        };
      } else if (dependencies.svelte) {
        framework = "Svelte";
        buildConfig = {
          buildCommand: "npm run build",
          outputDirectory: "public",
          installCommand: "npm install",
        };
      } else if (dependencies.astro) {
        framework = "Astro";
        buildConfig = {
          buildCommand: "npm run build",
          outputDirectory: "dist",
          installCommand: "npm install",
        };
      }
    }

    res.json({
      success: true,
      framework,
      buildConfig,
      packageJson: packageJson
        ? {
            name: packageJson.name,
            version: packageJson.version,
            scripts: packageJson.scripts,
          }
        : null,
    });
  } catch (error) {
    console.error("❌ Erreur détection framework:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la détection du framework",
    });
  }
});

module.exports = router;
