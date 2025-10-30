// backend/src/routes/deployments.js - VERSION COMPLÈTE DOCKER
const express = require("express");
const UniversalFrameworkHandler = require("../utils/universalFrameworkHandler");
const router = express.Router();
const supabase = require("../config/supabase");
const { exec } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const { requireAuth } = require("../middleware/auth");

// ==================== ROUTES ====================

// Route pour récupérer les déploiements d'un projet
router.get("/projects/:projectId", requireAuth, async (req, res) => {
  try {
    console.log(`📋 Récupération déploiements projet ${req.params.projectId}`);

    const { page = 1, limit = 20 } = req.query;

    const { data: deployments, error } = await supabase
      .from("deployments")
      .select("*")
      .eq("project_id", req.params.projectId)
      .order("started_at", { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      console.error("❌ Erreur récupération déploiements:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la récupération des déploiements",
        details: error.message,
      });
    }

    res.json({
      success: true,
      deployments: deployments || [],
    });
  } catch (error) {
    console.error("❌ Erreur:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur",
    });
  }
});

// Route pour récupérer UN déploiement spécifique
router.get("/:deploymentId", requireAuth, async (req, res) => {
  try {
    console.log(`🔍 Récupération déploiement ${req.params.deploymentId}`);

    const { data: deployment, error } = await supabase
      .from("deployments")
      .select("*, projects!inner(user_id, name)")
      .eq("id", req.params.deploymentId)
      .eq("projects.user_id", req.user.id)
      .single();

    if (error || !deployment) {
      return res.status(404).json({
        success: false,
        error: "Déploiement non trouvé",
      });
    }

    res.json({
      success: true,
      deployment,
    });
  } catch (error) {
    console.error("❌ Erreur récupération déploiement:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur",
    });
  }
});

// Route pour les statistiques des déploiements
router.get("/stats", requireAuth, async (req, res) => {
  try {
    console.log(`📊 Récupération stats pour ${req.user.username}`);

    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", req.user.id);

    if (!projects || projects.length === 0) {
      return res.json({
        success: true,
        stats: {
          total: 0,
          success: 0,
          failed: 0,
          avgTime: 0,
        },
      });
    }

    const projectIds = projects.map((p) => p.id);

    // Compter tous les déploiements
    const { count: total } = await supabase
      .from("deployments")
      .select("*", { count: "exact", head: true })
      .in("project_id", projectIds);

    // Compter les déploiements réussis
    const { count: success } = await supabase
      .from("deployments")
      .select("*", { count: "exact", head: true })
      .in("project_id", projectIds)
      .eq("status", "success");

    // Compter les déploiements échoués
    const { count: failed } = await supabase
      .from("deployments")
      .select("*", { count: "exact", head: true })
      .in("project_id", projectIds)
      .eq("status", "failed");

    // Calculer le temps moyen
    const { data: completedDeployments } = await supabase
      .from("deployments")
      .select("started_at, completed_at")
      .in("project_id", projectIds)
      .eq("status", "success")
      .not("completed_at", "is", null);

    let avgTime = 0;
    if (completedDeployments && completedDeployments.length > 0) {
      const totalTime = completedDeployments.reduce((acc, d) => {
        const start = new Date(d.started_at);
        const end = new Date(d.completed_at);
        return acc + (end - start) / 1000; // en secondes
      }, 0);
      avgTime = Math.round(totalTime / completedDeployments.length);
    }

    res.json({
      success: true,
      stats: {
        total: total || 0,
        success: success || 0,
        failed: failed || 0,
        avgTime,
      },
    });
  } catch (error) {
    console.error("❌ Erreur récupération statistiques:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur",
    });
  }
});

// Route pour lancer un déploiement

router.post("/deploy/:projectId", requireAuth, async (req, res) => {
  const projectId = req.params.projectId;
  console.log(
    `🚀 Lancement déploiement projet ${projectId} par ${req.user.username}`
  );

  try {
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

    const { data: pendingDeployment } = await supabase
      .from("deployments")
      .select("id")
      .eq("project_id", projectId)
      .in("status", [
        "pending",
        "building",
        "cloning",
        "deploying",
        "configuring",
      ])
      .limit(1);

    if (pendingDeployment && pendingDeployment.length > 0) {
      return res.status(409).json({
        success: false,
        error: "Un déploiement est déjà en cours pour ce projet",
      });
    }

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

    deployProject(deployment.id, project);

    res.json({
      success: true,
      deployment: {
        id: deployment.id,
        status: "pending",
        projectId: projectId,
      },
      message: "Déploiement lancé",
    });
  } catch (error) {
    console.error("❌ Erreur lancement déploiement:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du lancement du déploiement",
    });
  }
});

// Route pour récupérer les logs d'un déploiement
router.get("/:deploymentId/logs", requireAuth, async (req, res) => {
  try {
    const { data: deployment, error } = await supabase
      .from("deployments")
      .select("build_log, deploy_log, status, projects!inner(user_id)")
      .eq("id", req.params.deploymentId)
      .eq("projects.user_id", req.user.id)
      .single();

    if (error || !deployment) {
      return res.status(404).json({
        success: false,
        error: "Déploiement non trouvé",
      });
    }

    res.json({
      success: true,
      logs: {
        build: deployment.build_log || "",
        deploy: deployment.deploy_log || "",
      },
      status: deployment.status,
    });
  } catch (error) {
    console.error("❌ Erreur récupération logs:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur",
    });
  }
});

// Route pour annuler un déploiement
router.delete("/:deploymentId", requireAuth, async (req, res) => {
  try {
    console.log(`❌ Annulation déploiement ${req.params.deploymentId}`);

    const { data: deployment, error } = await supabase
      .from("deployments")
      .select("*, projects!inner(user_id)")
      .eq("id", req.params.deploymentId)
      .eq("projects.user_id", req.user.id)
      .single();

    if (error || !deployment) {
      return res.status(404).json({
        success: false,
        error: "Déploiement non trouvé",
      });
    }

    if (deployment.status === "success" || deployment.status === "failed") {
      return res.status(400).json({
        success: false,
        error: "Déploiement déjà terminé",
      });
    }

    // Marquer comme annulé
    await supabase
      .from("deployments")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
        build_log:
          (deployment.build_log || "") +
          "\n❌ Déploiement annulé par l'utilisateur",
      })
      .eq("id", req.params.deploymentId);

    res.json({
      success: true,
      message: "Déploiement annulé",
    });
  } catch (error) {
    console.error("❌ Erreur annulation:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur",
    });
  }
});

async function deployProject(deploymentId, project) {
  let buildLog = "";
  const deploymentDir = path.join(__dirname, "../../temp", deploymentId);
  const subdomain = project.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const outputDir = path.join("/var/www/deployed", subdomain);

  try {
    buildLog += `🚀 Déploiement de ${project.name}\n`;
    await fs.mkdir(deploymentDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    // CLONAGE
    const { data: user } = await supabase
      .from("users")
      .select("access_token")
      .eq("id", project.user_id)
      .single();

    await execCommand(
      `git clone --depth 1 -b ${project.branch || "main"} https://${
        user.access_token
      }@github.com/${project.github_repo}.git ${deploymentDir}`
    );
    buildLog += `✅ Repository cloné\n`;

    // INSTALLATION - CRITIQUE
    buildLog += `📦 Installation des dépendances...\n`;

    // ✅ FORCER VITE DANS PACKAGE.JSON
    const packageJsonPath = path.join(deploymentDir, "package.json");
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));

    if (!packageJson.devDependencies) packageJson.devDependencies = {};
    if (!packageJson.devDependencies.vite) {
      packageJson.devDependencies.vite = "^5.2.0";
      packageJson.devDependencies["@vitejs/plugin-react"] = "^4.3.0";
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      buildLog += `✅ Vite ajouté au package.json\n`;
    }

    // ✅ INSTALLATION COMPLÈTE
    await execCommand(`cd ${deploymentDir} && npm install --legacy-peer-deps`);
    buildLog += `✅ npm install terminé\n`;

    // ✅ VÉRIFICATION VITE
    try {
      await fs.access(path.join(deploymentDir, "node_modules/.bin/vite"));
      buildLog += `✅ Vite installé\n`;
    } catch {
      buildLog += `⚠️ Vite manquant, réinstallation...\n`;
      await execCommand(
        `cd ${deploymentDir} && npm install vite@latest @vitejs/plugin-react@latest --save-dev --force`
      );
    }

    // BUILD
    buildLog += `🏗️ Build...\n`;
    await execCommand(`cd ${deploymentDir} && npm run build`, {
      NODE_ENV: "production",
      CI: "true",
    });
    buildLog += `✅ Build réussi\n`;

    // COPIE FICHIERS
    const distDir = path.join(deploymentDir, "dist");
    await execCommand(`cp -r "${distDir}/"* "${outputDir}/"`);
    buildLog += `✅ Fichiers déployés\n`;

    // SUCCÈS
    const domain = `${subdomain}.madahost.me`;
    await supabase
      .from("projects")
      .update({
        domain,
        status: "active",
        last_deployed: new Date().toISOString(),
      })
      .eq("id", project.id);

    await supabase
      .from("deployments")
      .update({
        status: "success",
        build_log: buildLog,
        completed_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);

    buildLog += `✅ Déploiement réussi: https://${domain}\n`;
  } catch (error) {
    buildLog += `❌ Erreur: ${error.message}\n`;
    await supabase
      .from("deployments")
      .update({
        status: "failed",
        build_log: buildLog,
        completed_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);
  }

  // Nettoyage
  setTimeout(
    () => execCommand(`rm -rf ${deploymentDir}`).catch(() => {}),
    5000
  );
}

function execCommand(command, envVars = {}) {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        timeout: 600000,
        env: { ...process.env, ...envVars },
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) reject(new Error(`${error.message}\n${stderr}`));
        else resolve(stdout);
      }
    );
  });
}

module.exports = router;
