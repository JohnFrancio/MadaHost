// backend/src/routes/deployments.js - VERSION MISE À JOUR
const express = require("express");
const router = express.Router();
const BuildService = require("../services/buildService");
const supabase = require("../config/supabase");
const { requireAuth } = require("./auth");

const buildService = new BuildService();

/**
 * POST /api/deployments/deploy/:projectId
 * Déclencher un nouveau déploiement
 */
router.post("/deploy/:projectId", requireAuth, async (req, res) => {
  const { projectId } = req.params;

  try {
    console.log(`🚀 Démarrage déploiement projet: ${projectId}`);

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
    const { data: ongoingDeployment } = await supabase
      .from("deployments")
      .select("id")
      .eq("project_id", projectId)
      .in("status", [
        "pending",
        "cloning",
        "building",
        "deploying",
        "configuring",
      ])
      .single();

    if (ongoingDeployment) {
      return res.status(409).json({
        success: false,
        error: "Un déploiement est déjà en cours pour ce projet",
        ongoingDeploymentId: ongoingDeployment.id,
      });
    }

    // Lancer le déploiement en arrière-plan
    buildService
      .deployProject(projectId)
      .then((result) => {
        console.log(`✅ Déploiement terminé: ${projectId}`, result);
      })
      .catch((error) => {
        console.error(`❌ Déploiement échoué: ${projectId}`, error);
      });

    res.json({
      success: true,
      message: "Déploiement lancé",
      projectId,
      estimatedTime: "2-5 minutes",
    });
  } catch (error) {
    console.error("❌ Erreur API déploiement:", error);
    res.status(500).json({
      success: false,
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
});

/**
 * GET /api/deployments/projects/:projectId
 * Obtenir les déploiements d'un projet
 */
router.get("/projects/:projectId", requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    // Vérifier l'accès au projet
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", req.user.id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({
        success: false,
        error: "Projet non trouvé",
      });
    }

    // Récupérer les déploiements
    const { data: deployments, error } = await supabase
      .from("deployments")
      .select("*")
      .eq("project_id", projectId)
      .order("started_at", { ascending: false })
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      deployments: deployments || [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: deployments?.length || 0,
      },
    });
  } catch (error) {
    console.error("❌ Erreur récupération déploiements:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des déploiements",
    });
  }
});

/**
 * GET /api/deployments/:deploymentId
 * Obtenir les détails d'un déploiement
 */
router.get("/:deploymentId", requireAuth, async (req, res) => {
  try {
    const { deploymentId } = req.params;

    // Récupérer le déploiement avec vérification d'accès
    const { data: deployment, error } = await supabase
      .from("deployments")
      .select(
        `
        *,
        projects!inner (
          id,
          name,
          user_id
        )
      `
      )
      .eq("id", deploymentId)
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
      error: "Erreur lors de la récupération du déploiement",
    });
  }
});

/**
 * GET /api/deployments/:deploymentId/logs
 * Obtenir les logs d'un déploiement (streaming)
 */
router.get("/:deploymentId/logs", requireAuth, async (req, res) => {
  try {
    const { deploymentId } = req.params;

    // Récupérer le déploiement avec vérification d'accès
    const { data: deployment, error } = await supabase
      .from("deployments")
      .select(
        `
        build_log,
        deploy_log,
        projects!inner (
          user_id
        )
      `
      )
      .eq("id", deploymentId)
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
    });
  } catch (error) {
    console.error("❌ Erreur récupération logs:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des logs",
    });
  }
});

/**
 * DELETE /api/deployments/:deploymentId
 * Annuler un déploiement en cours
 */
router.delete("/:deploymentId", requireAuth, async (req, res) => {
  try {
    const { deploymentId } = req.params;

    // Récupérer le déploiement avec vérification d'accès
    const { data: deployment, error } = await supabase
      .from("deployments")
      .select(
        `
        *,
        projects!inner (
          user_id
        )
      `
      )
      .eq("id", deploymentId)
      .eq("projects.user_id", req.user.id)
      .single();

    if (error || !deployment) {
      return res.status(404).json({
        success: false,
        error: "Déploiement non trouvé",
      });
    }

    // Vérifier si le déploiement peut être annulé
    const cancellableStatuses = [
      "pending",
      "cloning",
      "building",
      "deploying",
      "configuring",
    ];

    if (!cancellableStatuses.includes(deployment.status)) {
      return res.status(400).json({
        success: false,
        error: "Ce déploiement ne peut pas être annulé",
        currentStatus: deployment.status,
      });
    }

    // Marquer comme annulé
    const { error: updateError } = await supabase
      .from("deployments")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
        build_log:
          (deployment.build_log || "") +
          "\n\n❌ Déploiement annulé par l'utilisateur",
      })
      .eq("id", deploymentId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    res.json({
      success: true,
      message: "Déploiement annulé",
    });
  } catch (error) {
    console.error("❌ Erreur annulation déploiement:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de l'annulation du déploiement",
    });
  }
});

/**
 * GET /api/deployments/stats
 * Statistiques des déploiements de l'utilisateur
 */
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const { data: deployments, error } = await supabase
      .from("deployments")
      .select(
        `
        status,
        started_at,
        completed_at,
        projects!inner (
          user_id
        )
      `
      )
      .eq("projects.user_id", req.user.id);

    if (error) {
      throw new Error(error.message);
    }

    // Calculer les statistiques
    const stats = {
      total: deployments.length,
      success: deployments.filter((d) => d.status === "success").length,
      failed: deployments.filter((d) => d.status === "failed").length,
      pending: deployments.filter((d) =>
        ["pending", "cloning", "building", "deploying", "configuring"].includes(
          d.status
        )
      ).length,
      cancelled: deployments.filter((d) => d.status === "cancelled").length,
      avgDeployTime: 0,
    };

    // Calculer le temps moyen de déploiement
    const completedDeployments = deployments.filter(
      (d) => d.status === "success" && d.started_at && d.completed_at
    );

    if (completedDeployments.length > 0) {
      const totalTime = completedDeployments.reduce((acc, d) => {
        const duration = new Date(d.completed_at) - new Date(d.started_at);
        return acc + duration;
      }, 0);

      stats.avgDeployTime = Math.round(
        totalTime / completedDeployments.length / 1000
      ); // en secondes
    }

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("❌ Erreur stats déploiements:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du calcul des statistiques",
    });
  }
});

module.exports = router;
