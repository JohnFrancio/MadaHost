// backend/src/routes/deployments.js - VERSION CORRIGÉE
const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const jwt = require("jsonwebtoken");
const { exec } = require("child_process");
const fs = require("fs").promises;
const path = require("path");

// Middleware d'authentification
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentification requise" });
  }
  next();
};

// Route pour récupérer les déploiements d'un projet
router.get("/projects/:projectId", requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // CORRECTION : Supprimer .offset() qui n'existe pas
    const { data: deployments, error } = await supabase
      .from("deployments")
      .select("*")
      .eq("project_id", req.params.projectId)
      .order("started_at", { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      console.error("Erreur lors de la récupération des déploiements:", error);
      return res.status(500).json({
        error: "Erreur lors de la récupération des déploiements",
        details: error.message,
      });
    }

    res.json(deployments || []);
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// AJOUT : Route pour les statistiques des déploiements
router.get("/stats", requireAuth, async (req, res) => {
  try {
    // Récupérer les statistiques globales pour l'utilisateur
    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", req.user.userId);

    if (!projects || projects.length === 0) {
      return res.json({
        totalDeployments: 0,
        successfulDeployments: 0,
        failedDeployments: 0,
        successRate: 0,
      });
    }

    const projectIds = projects.map((p) => p.id);

    // Compter tous les déploiements
    const { count: totalDeployments } = await supabase
      .from("deployments")
      .select("*", { count: "exact" })
      .in("project_id", projectIds);

    // Compter les déploiements réussis
    const { count: successfulDeployments } = await supabase
      .from("deployments")
      .select("*", { count: "exact" })
      .in("project_id", projectIds)
      .eq("status", "success");

    // Compter les déploiements échoués
    const { count: failedDeployments } = await supabase
      .from("deployments")
      .select("*", { count: "exact" })
      .in("project_id", projectIds)
      .eq("status", "failed");

    const successRate =
      totalDeployments > 0
        ? Math.round((successfulDeployments / totalDeployments) * 100)
        : 0;

    res.json({
      totalDeployments: totalDeployments || 0,
      successfulDeployments: successfulDeployments || 0,
      failedDeployments: failedDeployments || 0,
      successRate,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Route pour lancer un déploiement
router.post("/deploy/:projectId", requireAuth, async (req, res) => {
  const projectId = req.params.projectId;
  console.log(
    `🚀 Lancement du déploiement pour le projet ${projectId} by ${req.user.userId}`
  );
  try {
    // Vérifier que le projet appartient à l'utilisateur
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      // .eq("user_id", req.user.userId)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: "Projet non trouvé" });
    }

    // Vérifier qu'il n'y a pas déjà un déploiement en cours
    const { data: pendingDeployment } = await supabase
      .from("deployments")
      .select("id")
      .eq("project_id", projectId)
      .in("status", ["pending", "building"])
      .limit(1);

    if (pendingDeployment && pendingDeployment.length > 0) {
      return res.status(409).json({
        error: "Un déploiement est déjà en cours pour ce projet",
      });
    }

    // Créer un nouveau déploiement
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
      console.error(
        "Erreur lors de la création du déploiement:",
        deploymentError
      );
      return res.status(500).json({
        error: "Impossible de créer le déploiement",
        details: deploymentError.message,
      });
    }

    // Lancer le processus de déploiement en arrière-plan
    deployProject(deployment.id, project);

    res.json({
      id: deployment.id,
      status: "pending",
      message: "Déploiement lancé",
      projectId: projectId,
    });
  } catch (error) {
    console.error("Erreur lors du lancement du déploiement:", error);
    res.status(500).json({ error: "Erreur lors du lancement du déploiement" });
  }
});

// Fonction pour déployer un projet (processus asynchrone)
async function deployProject(deploymentId, project) {
  const deploymentDir = path.join(__dirname, "../../temp", deploymentId);
  const outputDir = path.join(__dirname, "../../public", project.id);
  let buildLog = "";

  try {
    // Mettre à jour le statut à 'building'
    buildLog += `🚀 [${new Date().toISOString()}] Démarrage du déploiement...\n`;
    await supabase
      .from("deployments")
      .update({
        status: "building",
        build_log: buildLog,
      })
      .eq("id", deploymentId);

    // Créer les dossiers nécessaires
    await fs.mkdir(deploymentDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    // Étape 1: Cloner le repository
    buildLog += `📥 [${new Date().toISOString()}] Clonage de ${
      project.github_repo
    }...\n`;
    await updateDeploymentLog(deploymentId, buildLog);

    try {
      const cloneCommand = `git clone https://github.com/${project.github_repo}.git ${deploymentDir}`;
      await execCommand(cloneCommand);
      buildLog += `✅ Repository cloné avec succès\n`;
    } catch (error) {
      throw new Error(`Erreur lors du clonage: ${error.message}`);
    }

    // Changer vers la branche spécifiée
    if (
      project.branch &&
      project.branch !== "main" &&
      project.branch !== "master"
    ) {
      buildLog += `🔄 Basculement vers la branche ${project.branch}...\n`;
      await updateDeploymentLog(deploymentId, buildLog);

      try {
        await execCommand(
          `cd ${deploymentDir} && git checkout ${project.branch}`
        );
        buildLog += `✅ Basculement vers ${project.branch} réussi\n`;
      } catch (error) {
        buildLog += `⚠️  Impossible de basculer vers ${project.branch}, utilisation de la branche par défaut\n`;
      }
    }

    // Récupérer le hash du commit
    let commitHash = "";
    try {
      commitHash = await execCommand(
        `cd ${deploymentDir} && git rev-parse HEAD`
      );
      commitHash = commitHash.trim();

      // Mettre à jour avec le commit hash
      await supabase
        .from("deployments")
        .update({ commit_hash: commitHash })
        .eq("id", deploymentId);

      buildLog += `📋 Commit: ${commitHash.substring(0, 8)}\n`;
    } catch (error) {
      buildLog += `⚠️  Impossible de récupérer le hash du commit\n`;
    }

    // Étape 2: Installer les dépendances
    buildLog += `📦 [${new Date().toISOString()}] Installation des dépendances...\n`;
    await updateDeploymentLog(deploymentId, buildLog);

    const packageJsonPath = path.join(deploymentDir, "package.json");
    try {
      await fs.access(packageJsonPath);

      // Détecter le gestionnaire de paquets
      const yarnLockExists = await fs
        .access(path.join(deploymentDir, "yarn.lock"))
        .then(() => true)
        .catch(() => false);
      const pnpmLockExists = await fs
        .access(path.join(deploymentDir, "pnpm-lock.yaml"))
        .then(() => true)
        .catch(() => false);

      let installCommand = project.install_command || "npm install";
      if (pnpmLockExists && !project.install_command) {
        installCommand = "pnpm install";
      } else if (yarnLockExists && !project.install_command) {
        installCommand = "yarn install";
      }

      buildLog += `🔧 Commande d'installation: ${installCommand}\n`;
      await updateDeploymentLog(deploymentId, buildLog);

      await execCommand(`cd ${deploymentDir} && ${installCommand}`);
      buildLog += `✅ Dépendances installées avec succès\n`;
    } catch (error) {
      buildLog += `⚠️  Pas de package.json trouvé ou erreur d'installation\n`;
    }

    // Étape 3: Build du projet
    if (project.build_command) {
      buildLog += `🏗️  [${new Date().toISOString()}] Build du projet...\n`;
      buildLog += `🔧 Commande: ${project.build_command}\n`;
      await updateDeploymentLog(deploymentId, buildLog);

      try {
        await execCommand(`cd ${deploymentDir} && ${project.build_command}`);
        buildLog += `✅ Build réussi\n`;
      } catch (buildError) {
        buildLog += `⚠️  Build échoué: ${buildError.message}\n`;
        buildLog += `📁 Déploiement des fichiers source...\n`;
      }
    }

    // Étape 4: Copier les fichiers
    buildLog += `📁 [${new Date().toISOString()}] Copie des fichiers...\n`;
    await updateDeploymentLog(deploymentId, buildLog);

    const outputDirectory = project.output_dir || "dist";
    const sourceDir = path.join(deploymentDir, outputDirectory);

    try {
      await fs.access(sourceDir);
      await execCommand(`cp -r ${sourceDir}/* ${outputDir}/`);
      buildLog += `✅ Fichiers copiés depuis ${outputDirectory}\n`;
    } catch (error) {
      // Si le dossier de sortie n'existe pas, copier les fichiers web
      try {
        await execCommand(
          `find ${deploymentDir} -maxdepth 3 \\( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.png" -o -name "*.jpg" -o -name "*.gif" -o -name "*.svg" \\) -exec cp {} ${outputDir}/ \\;`
        );
        buildLog += `✅ Fichiers web copiés\n`;
      } catch (copyError) {
        throw new Error(
          `Impossible de copier les fichiers: ${copyError.message}`
        );
      }
    }

    // Générer le domaine si nécessaire
    let domain = project.domain;
    if (!domain) {
      const slug = project.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const shortId = project.id.split("-")[0];
      domain = `${slug}-${shortId}.localhost:3001`;

      await supabase
        .from("projects")
        .update({
          domain,
          status: "active",
          last_deployed: new Date().toISOString(),
        })
        .eq("id", project.id);
    }

    buildLog += `✅ [${new Date().toISOString()}] Déploiement réussi!\n`;
    buildLog += `🌐 Site disponible sur: http://${domain}\n`;

    // Marquer comme réussi
    await supabase
      .from("deployments")
      .update({
        status: "success",
        build_log: buildLog,
        completed_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);

    // Nettoyer
    setTimeout(async () => {
      try {
        await execCommand(`rm -rf ${deploymentDir}`);
      } catch (error) {
        console.error("Erreur nettoyage:", error);
      }
    }, 5000);
  } catch (error) {
    console.error("Erreur déploiement:", error);
    buildLog += `❌ [${new Date().toISOString()}] Erreur: ${error.message}\n`;

    await supabase
      .from("deployments")
      .update({
        status: "failed",
        build_log: buildLog,
        completed_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);

    // Nettoyer même en cas d'erreur
    try {
      await execCommand(`rm -rf ${deploymentDir}`);
    } catch (cleanupError) {
      console.error("Erreur nettoyage:", cleanupError);
    }
  }
}

// Fonction utilitaire pour mettre à jour les logs
async function updateDeploymentLog(deploymentId, buildLog) {
  try {
    await supabase
      .from("deployments")
      .update({ build_log: buildLog })
      .eq("id", deploymentId);
  } catch (error) {
    console.error("Erreur mise à jour logs:", error);
  }
}

// Fonction utilitaire pour exécuter des commandes
function execCommand(command, timeout = 300000) {
  return new Promise((resolve, reject) => {
    exec(command, { timeout }, (error, stdout, stderr) => {
      if (error) {
        const errorMessage = `Command: ${command}\nError: ${error.message}\nStdout: ${stdout}\nStderr: ${stderr}`;
        reject(new Error(errorMessage));
        return;
      }
      resolve(stdout);
    });
  });
}

// Route pour récupérer les logs d'un déploiement
router.get("/:deploymentId/logs", requireAuth, async (req, res) => {
  try {
    const { data: deployment, error } = await supabase
      .from("deployments")
      .select("build_log, deploy_log, status")
      .eq("id", req.params.deploymentId)
      .single();

    if (error || !deployment) {
      return res.status(404).json({ error: "Déploiement non trouvé" });
    }

    res.json({
      buildLog: deployment.build_log || "",
      deployLog: deployment.deploy_log || "",
      status: deployment.status,
    });
  } catch (error) {
    console.error("Erreur récupération logs:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Route pour annuler un déploiement
router.post("/:deploymentId/cancel", requireAuth, async (req, res) => {
  try {
    const { data: deployment, error } = await supabase
      .from("deployments")
      .select("*, projects!inner(user_id)")
      .eq("id", req.params.deploymentId)
      .eq("projects.user_id", req.user.userId)
      .single();

    if (error || !deployment) {
      return res.status(404).json({ error: "Déploiement non trouvé" });
    }

    if (deployment.status === "success" || deployment.status === "failed") {
      return res.status(400).json({ error: "Déploiement déjà terminé" });
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

    res.json({ message: "Déploiement annulé" });
  } catch (error) {
    console.error("Erreur annulation:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
