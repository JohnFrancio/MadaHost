// backend/src/routes/deployments.js - VERSION AVEC BUILDSERVICE
const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { requireAuth } = require("../middleware/auth");
const BuildService = require("../services/buildService");

// ✅ Instance unique du service
const buildService = new BuildService();

// ==================== ROUTES ====================

// Route pour lancer un déploiement
router.post("/deploy/:projectId", requireAuth, async (req, res) => {
  const projectId = req.params.projectId;
  console.log(
    `🚀 Lancement déploiement projet ${projectId} par ${req.user.username}`
  );

  try {
    // Vérifier que le projet appartient à l'utilisateur
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

    // Vérifier qu'il n'y a pas déjà un déploiement en cours
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

    // Créer le déploiement
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

    // ✅ Lancer le déploiement en arrière-plan avec buildService
    deployProjectWithBuildService(deployment.id, project);

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

// Autres routes (inchangées)
router.get("/projects/:projectId", requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { data: deployments, error } = await supabase
      .from("deployments")
      .select("*")
      .eq("project_id", req.params.projectId)
      .order("started_at", { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la récupération des déploiements",
      });
    }

    res.json({
      success: true,
      deployments: deployments || [],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

router.get("/:deploymentId", requireAuth, async (req, res) => {
  try {
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

    res.json({ success: true, deployment });
  } catch (error) {
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

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
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// ==================== FONCTION DE DÉPLOIEMENT ====================

async function deployProjectWithBuildService(deploymentId, project) {
  let buildLog = "";

  try {
    buildLog += `🚀 [${new Date().toISOString()}] Déploiement de ${
      project.name
    }\n`;
    buildLog += `📦 Repository: ${project.github_repo}\n`;
    buildLog += `🌿 Branche: ${project.branch || "main"}\n\n`;

    await updateDeploymentLog(deploymentId, buildLog, "cloning");

    // ==================== CLONAGE ====================
    buildLog += `📥 Étape 1/4: Clonage du repository...\n`;
    await updateDeploymentLog(deploymentId, buildLog, "cloning");

    const buildPath = await buildService.cloneRepository(project, deploymentId);
    buildLog += `✅ Repository cloné dans: ${buildPath}\n\n`;
    await updateDeploymentLog(deploymentId, buildLog, "cloning");

    // ==================== INSTALLATION ====================
    buildLog += `📦 Étape 2/4: Installation des dépendances...\n`;
    await updateDeploymentLog(deploymentId, buildLog, "building");

    if (project.install_command) {
      buildLog += `🔧 Commande: ${project.install_command}\n`;
      await updateDeploymentLog(deploymentId, buildLog, "building");

      const installResult = await buildService.executeCommand(
        project.install_command,
        buildPath
      );

      // Compter les packages installés
      const packageCount =
        installResult.stdout.match(/added (\d+) package/)?.[1] || "?";
      buildLog += `✅ ${packageCount} packages installés\n\n`;
    }

    await updateDeploymentLog(deploymentId, buildLog, "building");

    // ==================== BUILD ====================
    buildLog += `🏗️ Étape 3/4: Construction du projet...\n`;
    await updateDeploymentLog(deploymentId, buildLog, "building");

    if (project.build_command) {
      buildLog += `🔧 Commande: ${project.build_command}\n`;
      await updateDeploymentLog(deploymentId, buildLog, "building");

      // Préparer les variables d'environnement
      const envVars = {
        NODE_ENV: "production",
        ...JSON.parse(project.env_vars || "{}"),
      };

      const buildResult = await buildService.executeCommand(
        project.build_command,
        buildPath,
        envVars
      );

      buildLog += `✅ Build terminé avec succès\n`;
      buildLog += `📊 Dernières lignes:\n`;
      buildLog += buildResult.stdout.split("\n").slice(-10).join("\n") + "\n\n";
    }

    await updateDeploymentLog(deploymentId, buildLog, "building");

    // ==================== DÉPLOIEMENT ====================
    buildLog += `🚀 Étape 4/4: Déploiement des fichiers...\n`;
    await updateDeploymentLog(deploymentId, buildLog, "deploying");

    const buildOutput = await buildService.buildProject(project, buildPath);
    const deployUrl = await buildService.deployFiles(project, buildOutput);

    buildLog += `✅ Fichiers déployés\n`;
    buildLog += `🌐 Site disponible: ${deployUrl}\n\n`;

    // ==================== NETTOYAGE ====================
    await buildService.cleanup(buildPath);
    buildLog += `🧹 Nettoyage effectué\n`;

    // ==================== SUCCÈS ====================
    buildLog += `\n✨ [${new Date().toISOString()}] Déploiement réussi!\n`;
    buildLog += `🌐 Votre site est en ligne: ${deployUrl}\n`;

    await supabase
      .from("deployments")
      .update({
        status: "success",
        build_log: buildLog,
        completed_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);

    console.log(`✅ Déploiement ${deploymentId} terminé`);
  } catch (error) {
    console.error(`❌ Erreur déploiement ${deploymentId}:`, error);
    buildLog += `\n❌ [${new Date().toISOString()}] ERREUR: ${error.message}\n`;

    // Diagnostic en cas d'erreur
    buildLog += `\n📋 DIAGNOSTIC:\n`;
    buildLog += `- Projet: ${project.name}\n`;
    buildLog += `- Repository: ${project.github_repo}\n`;
    buildLog += `- Erreur: ${error.stack || error.message}\n`;

    await supabase
      .from("deployments")
      .update({
        status: "failed",
        build_log: buildLog,
        completed_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);
  }
}

async function updateDeploymentLog(deploymentId, buildLog, status = null) {
  try {
    const updateData = { build_log: buildLog };
    if (status) updateData.status = status;

    await supabase
      .from("deployments")
      .update(updateData)
      .eq("id", deploymentId);
  } catch (error) {
    console.error("❌ Erreur mise à jour logs:", error);
  }
}

module.exports = router;
