// backend/src/routes/deployments.js - CORRIGÉ FINAL
// Ajoutez ces annotations au début du fichier backend/src/routes/deployments.js

/**
 * @swagger
 * tags:
 *   name: Deployments
 *   description: Gestion des déploiements de projets
 */

/**
 * @swagger
 * /deployments/projects/{projectId}:
 *   get:
 *     summary: Obtenir les déploiements d'un projet
 *     tags: [Deployments]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du projet
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page de résultats
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Nombre de résultats par page
 *     responses:
 *       200:
 *         description: Liste des déploiements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 deployments:
 *                   type: array
 *
 */
const express = require("express");
const UniversalFrameworkHandler = require("../utils/universalFrameworkHandler");
const router = express.Router();
const supabase = require("../config/supabase");
const { exec } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const { requireAuth } = require("../middleware/auth");

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

// Route pour récupérer UN déploiement spécifique (manquant dans ton backend)
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
          totalDeployments: 0,
          successfulDeployments: 0,
          failedDeployments: 0,
          successRate: 0,
        },
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
      success: true,
      stats: {
        totalDeployments: totalDeployments || 0,
        successfulDeployments: successfulDeployments || 0,
        failedDeployments: failedDeployments || 0,
        successRate,
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
      console.error("❌ Erreur création déploiement:", deploymentError);
      return res.status(500).json({
        success: false,
        error: "Impossible de créer le déploiement",
        details: deploymentError.message,
      });
    }

    // Lancer le processus de déploiement en arrière-plan
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

// Route pour annuler un déploiement (DELETE au lieu de POST)
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

// Remplacer la fonction deployProject dans backend/src/routes/deployments.js
async function deployProject(deploymentId, project) {
  try {
    console.log(
      `🚀 Démarrage déploiement ${deploymentId} pour ${project.name}`
    );

    const deploymentDir = path.join(__dirname, "../../temp", deploymentId);
    const outputDir = path.join(__dirname, "../../public", project.id);
    let buildLog = "";

    // Mettre à jour le statut
    buildLog += `🚀 [${new Date().toISOString()}] Démarrage du déploiement...\n`;
    await updateDeploymentLog(deploymentId, buildLog);

    // Créer les dossiers
    await fs.mkdir(deploymentDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    // Récupérer le token GitHub
    const { data: user } = await supabase
      .from("users")
      .select("access_token")
      .eq("id", project.user_id)
      .single();

    if (!user?.access_token) {
      throw new Error("Token GitHub manquant pour l'utilisateur");
    }

    // Cloner avec le token
    buildLog += `📥 [${new Date().toISOString()}] Clonage de ${
      project.github_repo
    }...\n`;
    await updateDeploymentLog(deploymentId, buildLog);

    const cloneCommand = `git clone --depth 1 -b ${
      project.branch || "main"
    } https://${user.access_token}@github.com/${
      project.github_repo
    }.git ${deploymentDir}`;

    await supabase
      .from("deployments")
      .update({ status: "cloning", build_log: buildLog })
      .eq("id", deploymentId);
    await execCommand(cloneCommand);
    buildLog += `✅ Repository cloné avec succès\n`;

    // Récupérer le commit hash
    try {
      const commitHash = await execCommand(
        `cd ${deploymentDir} && git rev-parse HEAD`
      );
      await supabase
        .from("deployments")
        .update({ commit_hash: commitHash.trim() })
        .eq("id", deploymentId);
      buildLog += `📋 Commit: ${commitHash.trim().substring(0, 8)}\n`;
    } catch (error) {
      buildLog += `⚠️ Impossible de récupérer le commit hash\n`;
    }

    // ==================== DÉTECTION ET CONFIGURATION AUTOMATIQUE ====================
    // ==================== DÉTECTION ET CONFIGURATION AUTOMATIQUE ====================
    buildLog += `🔍 [${new Date().toISOString()}] Détection des frameworks...\n`;
    await updateDeploymentLog(deploymentId, buildLog);

    const frameworkHandler = new UniversalFrameworkHandler();

    // Utiliser la nouvelle méthode detectFrameworks qui retourne configs
    const {
      frameworks: detectedFrameworks,
      configs: frameworkConfigs,
      log: detectionLog,
    } = await frameworkHandler.detectFrameworks(deploymentDir);
    buildLog += detectionLog;

    let primaryFramework = null;
    let finalBuildCommand = project.build_command;
    let finalOutputDir = project.output_dir || "dist";
    let finalInstallCommand = project.install_command || "npm install";

    if (frameworkConfigs.length > 0) {
      // Prendre le framework avec la plus haute confidence
      primaryFramework = frameworkConfigs[0];
      buildLog += `🎯 Framework principal détecté: ${
        primaryFramework.name
      } (${Math.round(primaryFramework.confidence * 100)}%)\n`;

      // Utiliser la configuration automatique si pas de configuration manuelle
      if (!project.build_command || project.build_command === "npm run build") {
        finalBuildCommand = primaryFramework.config.buildCommand;
        buildLog += `🔧 Commande de build automatique: ${finalBuildCommand}\n`;
      }

      if (!project.output_dir || project.output_dir === "dist") {
        finalOutputDir = primaryFramework.config.outputDir;
        buildLog += `📁 Dossier de sortie automatique: ${finalOutputDir}\n`;
      }

      if (
        !project.install_command ||
        project.install_command === "npm install"
      ) {
        finalInstallCommand = primaryFramework.config.installCommand;
      }
    }

    // Configuration et installation des dépendances
    const { buildLog: setupLog, missingDeps } =
      await frameworkHandler.setupFrameworks(
        deploymentDir,
        detectedFrameworks,
        buildLog
      );
    buildLog = setupLog;

    // ==================== INSTALLATION DES DÉPENDANCES ====================
    await supabase
      .from("deployments")
      .update({ status: "building", build_log: buildLog })
      .eq("id", deploymentId);

    const packageJsonPath = path.join(deploymentDir, "package.json");
    try {
      await fs.access(packageJsonPath);

      buildLog += `📦 [${new Date().toISOString()}] Installation des dépendances...\n`;
      if (missingDeps.length > 0) {
        buildLog += `🔧 Nouvelles dépendances ajoutées: ${missingDeps.join(
          ", "
        )}\n`;
      }
      await updateDeploymentLog(deploymentId, buildLog);

      buildLog += `🔧 Commande d'installation: ${finalInstallCommand}\n`;
      await execCommand(`cd ${deploymentDir} && ${finalInstallCommand}`);
      buildLog += `✅ Dépendances installées avec succès\n`;
    } catch (error) {
      buildLog += `⚠️ Pas de package.json trouvé ou erreur installation: ${error.message}\n`;
    }

    // ==================== BUILD DU PROJET ====================
    if (finalBuildCommand && finalBuildCommand !== "") {
      buildLog += `🏗️ [${new Date().toISOString()}] Build du projet...\n`;
      buildLog += `🔧 Commande de build: ${finalBuildCommand}\n`;
      await updateDeploymentLog(deploymentId, buildLog);

      try {
        // Variables d'environnement optimisées selon le framework
        let buildEnv = {
          NODE_ENV: "production",
          CI: "true",
          GENERATE_SOURCEMAP: "false",
        };

        if (primaryFramework) {
          buildEnv = { ...buildEnv, ...primaryFramework.config.env };

          // Variables spécifiques par framework
          if (primaryFramework.name === "vue") {
            buildEnv.VUE_APP_NODE_ENV = "production";
          } else if (primaryFramework.name === "react") {
            buildEnv.REACT_APP_NODE_ENV = "production";
          } else if (primaryFramework.name === "nextjs") {
            buildEnv.NEXT_TELEMETRY_DISABLED = "1";
          }
        }

        await execCommand(
          `cd ${deploymentDir} && ${finalBuildCommand}`,
          buildEnv
        );
        buildLog += `✅ Build réussi avec ${
          primaryFramework?.name || "configuration par défaut"
        }\n`;
      } catch (buildError) {
        buildLog += `⚠️ Build échoué: ${buildError.message}\n`;

        // Stratégies de fallback selon le framework
        if (
          primaryFramework?.name === "vue" &&
          buildError.message.includes("terser")
        ) {
          buildLog += `🔄 Tentative build Vue sans minification...\n`;
          try {
            await execCommand(
              `cd ${deploymentDir} && npm run build -- --mode production --minify false`
            );
            buildLog += `✅ Build Vue réussi sans minification\n`;
          } catch (fallbackError) {
            buildLog += `❌ Fallback Vue échoué: ${fallbackError.message}\n`;
            throw buildError;
          }
        } else if (
          primaryFramework?.name === "react" &&
          buildError.message.includes("terser")
        ) {
          buildLog += `🔄 Tentative build React avec Vite alternatif...\n`;
          try {
            // Créer une config Vite simplifiée
            const viteConfigPath = path.join(deploymentDir, "vite.config.js");
            const simpleConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'build',
    minify: false,
    sourcemap: false
  }
})`;
            await fs.writeFile(viteConfigPath, simpleConfig);
            await execCommand(`cd ${deploymentDir} && npm run build`);
            buildLog += `✅ Build React réussi avec config simplifiée\n`;
          } catch (fallbackError) {
            buildLog += `❌ Fallback React échoué: ${fallbackError.message}\n`;
            throw buildError;
          }
        } else {
          // Fallback générique
          buildLog += `🔄 Tentative build générique sans optimisations...\n`;
          try {
            const simpleBuildEnv = { NODE_ENV: "production" };
            await execCommand(
              `cd ${deploymentDir} && npm run build`,
              simpleBuildEnv
            );
            buildLog += `✅ Build générique réussi\n`;
          } catch (genericError) {
            buildLog += `❌ Tous les builds ont échoué: ${genericError.message}\n`;
            throw buildError;
          }
        }
      }
    } else {
      buildLog += `ℹ️ Aucune commande de build spécifiée, copie directe des fichiers\n`;
    }

    // ==================== DÉPLOIEMENT DES FICHIERS ====================
    await supabase
      .from("deployments")
      .update({ status: "deploying", build_log: buildLog })
      .eq("id", deploymentId);

    buildLog += `📁 [${new Date().toISOString()}] Déploiement des fichiers...\n`;
    buildLog += `🔍 Recherche du dossier de sortie: ${finalOutputDir}\n`;
    await updateDeploymentLog(deploymentId, buildLog);

    const sourceDir = path.join(deploymentDir, finalOutputDir);

    // Essayer différents emplacements selon le framework
    const possibleDirs = [
      sourceDir,
      path.join(deploymentDir, "build"), // React CRA
      path.join(deploymentDir, "dist"), // Vue, Vite
      path.join(deploymentDir, "out"), // Next.js
      path.join(deploymentDir, "public"), // Fallback
      deploymentDir, // Dernier recours
    ];

    let foundSourceDir = null;
    for (const dir of possibleDirs) {
      try {
        await fs.access(dir);
        const files = await fs.readdir(dir);
        if (
          files.includes("index.html") ||
          files.some((f) => f.endsWith(".html"))
        ) {
          foundSourceDir = dir;
          buildLog += `✅ Fichiers trouvés dans: ${dir.replace(
            deploymentDir,
            "."
          )}\n`;
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (!foundSourceDir) {
      throw new Error(
        `Aucun dossier de sortie trouvé. Vérifié: ${possibleDirs
          .map((d) => d.replace(deploymentDir, "."))
          .join(", ")}`
      );
    }

    // Copier les fichiers
    try {
      buildLog += `📋 Contenu à copier depuis ${foundSourceDir.replace(
        deploymentDir,
        "."
      )}\n`;
      const sourceContent = await execCommand(`ls -la "${foundSourceDir}"`);
      buildLog +=
        sourceContent.substring(0, 500) +
        (sourceContent.length > 500 ? "...\n" : "\n");

      // Nettoyer et copier
      await execCommand(`rm -rf "${outputDir}"/*`);
      await execCommand(
        `cp -r "${foundSourceDir}/"* "${outputDir}/" 2>/dev/null || true`
      );
      buildLog += `✅ Fichiers copiés vers le serveur statique\n`;

      // Vérifier que les fichiers ont été copiés
      const copiedFiles = await fs.readdir(outputDir);
      buildLog += `📊 Fichiers copiés: ${copiedFiles.length} éléments\n`;

      if (copiedFiles.includes("index.html")) {
        buildLog += `✅ index.html trouvé dans les fichiers copiés\n`;
      } else {
        buildLog += `⚠️ Pas d'index.html trouvé, cherche d'autres fichiers HTML...\n`;
        const htmlFiles = copiedFiles.filter((f) => f.endsWith(".html"));
        if (htmlFiles.length > 0) {
          buildLog += `📄 Fichiers HTML trouvés: ${htmlFiles.join(", ")}\n`;
        }
      }
    } catch (copyError) {
      buildLog += `❌ Erreur lors de la copie: ${copyError.message}\n`;
      throw copyError;
    }

    // Correction des chemins dans les fichiers HTML
    try {
      const htmlFiles = await fs.readdir(outputDir);
      const indexFiles = htmlFiles.filter((f) => f.endsWith(".html"));

      for (const htmlFile of indexFiles) {
        const htmlPath = path.join(outputDir, htmlFile);
        let htmlContent = await fs.readFile(htmlPath, "utf8");
        const originalContent = htmlContent;

        // Corrections des chemins selon le framework
        if (primaryFramework?.name === "vue") {
          // Vue utilise souvent /assets/
          htmlContent = htmlContent
            .replace(/href="\/assets\//g, 'href="./assets/')
            .replace(/src="\/assets\//g, 'src="./assets/');
        } else if (primaryFramework?.name === "react") {
          // React CRA utilise /static/
          htmlContent = htmlContent
            .replace(/href="\/static\//g, 'href="./static/')
            .replace(/src="\/static\//g, 'src="./static/')
            .replace(/href="\/assets\//g, 'href="./assets/')
            .replace(/src="\/assets\//g, 'src="./assets/');
        }

        // Corrections génériques
        htmlContent = htmlContent
          .replace(/href="\//g, 'href="./')
          .replace(/src="\//g, 'src="./');

        if (originalContent !== htmlContent) {
          await fs.writeFile(htmlPath, htmlContent);
          buildLog += `🔧 Chemins corrigés dans ${htmlFile}\n`;
        }
      }
    } catch (fixError) {
      buildLog += `⚠️ Impossible de corriger les chemins HTML: ${fixError.message}\n`;
    }

    // Configuration du domaine
    await supabase
      .from("deployments")
      .update({ status: "configuring", build_log: buildLog })
      .eq("id", deploymentId);

    const domain = `${project.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")}.madahost.me`;

    await supabase
      .from("projects")
      .update({
        domain,
        status: "active",
        last_deployed: new Date().toISOString(),
      })
      .eq("id", project.id);

    // Vérification finale
    try {
      const finalCheck = await execCommand(
        `find "${outputDir}" -name "*.html" -o -name "*.css" -o -name "*.js" | wc -l`
      );
      buildLog += `📊 Vérification finale: ${finalCheck.trim()} fichiers web trouvés\n`;
    } catch (e) {
      buildLog += `⚠️ Impossible de faire la vérification finale\n`;
    }

    buildLog += `✅ [${new Date().toISOString()}] Déploiement réussi!\n`;
    buildLog += `🌐 Site disponible: http://localhost:3002/project/${project.id}/\n`;
    if (primaryFramework) {
      buildLog += `🎯 Framework déployé: ${primaryFramework.name}\n`;
    }

    // Succès final
    await supabase
      .from("deployments")
      .update({
        status: "success",
        build_log: buildLog,
        completed_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);

    // Nettoyer après 10 secondes
    setTimeout(async () => {
      try {
        await execCommand(`rm -rf ${deploymentDir}`);
        console.log(`🧹 Nettoyage terminé: ${deploymentDir}`);
      } catch (error) {
        console.error("❌ Erreur nettoyage:", error);
      }
    }, 10000);
  } catch (error) {
    console.error(`❌ Erreur déploiement ${deploymentId}:`, error);

    let finalLog = buildLog || "";
    finalLog += `❌ [${new Date().toISOString()}] Erreur: ${error.message}\n`;

    // Informations de debug en cas d'erreur
    if (primaryFramework) {
      finalLog += `🔍 Framework détecté: ${primaryFramework.name}\n`;
      finalLog += `🔍 Config utilisée: ${JSON.stringify(
        primaryFramework.config,
        null,
        2
      )}\n`;
    }

    await supabase
      .from("deployments")
      .update({
        status: "failed",
        build_log: finalLog,
        completed_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);

    // Nettoyer en cas d'erreur
    try {
      await execCommand(`rm -rf ${deploymentDir}`);
    } catch (cleanupError) {
      console.error("❌ Erreur nettoyage:", cleanupError);
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
    console.error("❌ Erreur mise à jour logs:", error);
  }
}

function execCommand(command, envVars = {}, timeout = 300000) {
  return new Promise((resolve, reject) => {
    const options = {
      timeout,
      env: { ...process.env, ...envVars },
    };

    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        const errorMessage = `Command: ${command}\nError: ${error.message}\nStdout: ${stdout}\nStderr: ${stderr}`;
        reject(new Error(errorMessage));
        return;
      }
      resolve(stdout);
    });
  });
}

module.exports = router;
