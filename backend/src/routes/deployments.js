// backend/src/routes/deployments.js - CORRIGÉ FINAL
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
    await supabase
      .from("deployments")
      .update({
        status: "cloning",
        build_log: buildLog,
      })
      .eq("id", deploymentId);

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

    // ==================== DÉTECTION ET INSTALLATION AUTOMATIQUE ====================

    buildLog += `🔍 [${new Date().toISOString()}] Détection des frameworks et dépendances...\n`;
    await updateDeploymentLog(deploymentId, buildLog);

    const frameworkHandler = new UniversalFrameworkHandler();
    const { frameworks, log: detectionLog } =
      await frameworkHandler.detectFrameworks(deploymentDir);
    buildLog += detectionLog;

    if (frameworks.length === 0) {
      buildLog += `ℹ️ Aucun framework CSS/JS spécial détecté\n`;
    } else {
      buildLog += `🎯 Frameworks détectés: ${frameworks.join(", ")}\n`;
    }

    // Configuration et installation des dépendances manquantes
    const { buildLog: setupLog, missingDeps } =
      await frameworkHandler.setupFrameworks(
        deploymentDir,
        frameworks,
        buildLog
      );
    buildLog = setupLog;

    // ==================== FIN DÉTECTION ====================

    // Installation des dépendances (avec les nouvelles dépendances)
    await supabase
      .from("deployments")
      .update({ status: "building", build_log: buildLog })
      .eq("id", deploymentId);

    const packageJsonPath = path.join(deploymentDir, "package.json");
    try {
      await fs.access(packageJsonPath);

      buildLog += `📦 [${new Date().toISOString()}] Installation des dépendances...\n`;
      if (missingDeps.length > 0) {
        buildLog += `🔧 Nouvelles dépendances: ${missingDeps.join(", ")}\n`;
      }
      await updateDeploymentLog(deploymentId, buildLog);

      const installCmd = project.install_command || "npm install";
      buildLog += `🔧 Commande: ${installCmd}\n`;

      await execCommand(`cd ${deploymentDir} && ${installCmd}`);
      buildLog += `✅ Dépendances installées\n`;
    } catch (error) {
      buildLog += `⚠️ Pas de package.json ou erreur installation\n`;
    }

    // Build du projet
    if (project.build_command) {
      buildLog += `🏗️ [${new Date().toISOString()}] Build du projet...\n`;
      buildLog += `🔧 Commande: ${project.build_command}\n`;
      await updateDeploymentLog(deploymentId, buildLog);

      try {
        // Variables d'environnement optimisées
        const buildEnv = {
          NODE_ENV: "production",
          TAILWIND_MODE: frameworks.includes("tailwind") ? "build" : undefined,
          VITE_NODE_ENV: "production",
          CI: "true",
        };

        await execCommand(
          `cd ${deploymentDir} && ${project.build_command}`,
          buildEnv
        );
        buildLog += `✅ Build réussi\n`;
      } catch (buildError) {
        buildLog += `⚠️ Build échoué: ${buildError.message}\n`;

        // Tentative de build sans minification en cas d'erreur terser
        if (buildError.message.includes("terser")) {
          buildLog += `🔄 Tentative build sans minification...\n`;
          try {
            // Modifier temporairement vite.config.js pour désactiver terser
            const viteConfigPath = path.join(deploymentDir, "vite.config.js");
            const noMinifyConfig = `import { defineConfig } from 'vite'
              import react from '@vitejs/plugin-react'

              export default defineConfig({
                plugins: [react()],
                base: './',
                build: {
                  minify: false,  // Désactiver la minification
                  outDir: 'dist',
                  assetsDir: 'assets'
                }
              })`;
            await fs.writeFile(viteConfigPath, noMinifyConfig);

            await execCommand(
              `cd ${deploymentDir} && ${project.build_command}`
            );
            buildLog += `✅ Build réussi sans minification\n`;
          } catch (e) {
            buildLog += `❌ Échec build alternatif: ${e.message}\n`;
            throw buildError; // Rethrow l'erreur originale
          }
        } else {
          throw buildError;
        }
      }
    }

    // Copie des fichiers - logique existante améliorée
    await supabase
      .from("deployments")
      .update({ status: "deploying", build_log: buildLog })
      .eq("id", deploymentId);

    buildLog += `📁 [${new Date().toISOString()}] Copie des fichiers...\n`;
    await updateDeploymentLog(deploymentId, buildLog);

    const outputDirectory = project.output_dir || "dist";
    const sourceDir = path.join(deploymentDir, outputDirectory);

    buildLog += `🔍 Vérification dossier source: ${sourceDir}\n`;

    try {
      await fs.access(sourceDir);
      buildLog += `✅ Dossier ${outputDirectory} trouvé\n`;

      // Debug: lister le contenu du dossier source
      const sourceContent = await execCommand(`ls -la "${sourceDir}"`);
      buildLog += `📁 Contenu source:\n${sourceContent}`;

      // Nettoyer et recréer le dossier de destination
      await execCommand(`rm -rf "${outputDir}"/*`);
      await execCommand(`mkdir -p "${outputDir}"`);

      // Copier avec preservation des liens symboliques et permissions
      await execCommand(
        `cp -r "${sourceDir}/"* "${outputDir}/" 2>/dev/null || true`
      );
      buildLog += `✅ Fichiers copiés depuis ${outputDirectory}\n`;

      // Vérifier que les assets ont été copiés
      const assetsDir = path.join(outputDir, "assets");
      if (
        await fs
          .access(assetsDir)
          .then(() => true)
          .catch(() => false)
      ) {
        const assetsContent = await execCommand(`ls -la "${assetsDir}"`);
        buildLog += `📁 Assets copiés:\n${assetsContent}`;
      }
    } catch (error) {
      buildLog += `⚠️ Dossier ${outputDirectory} introuvable, copie alternative...\n`;

      try {
        // Alternative avec rsync
        await execCommand(
          `rsync -av --include="*/" --include="*.html" --include="*.css" --include="*.js" --include="*.png" --include="*.jpg" --include="*.svg" --include="*.ico" --include="*.gif" --include="*.woff*" --include="*.ttf" --exclude="*" "${deploymentDir}/" "${outputDir}/"`
        );
        buildLog += `✅ Fichiers statiques copiés avec rsync\n`;
      } catch (rsyncError) {
        // Dernière tentative avec find
        await execCommand(
          `find "${deploymentDir}" -maxdepth 3 \\( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.png" -o -name "*.jpg" -o -name "*.gif" -o -name "*.svg" -o -name "*.ico" -o -name "*.woff*" -o -name "*.ttf" \\) -exec cp {} "${outputDir}/" \\; 2>/dev/null || true`
        );
        buildLog += `✅ Fichiers statiques copiés (méthode basique)\n`;
      }
    }

    // Correction des chemins dans index.html
    const indexPath = path.join(outputDir, "index.html");
    try {
      let indexContent = await fs.readFile(indexPath, "utf8");

      buildLog += `🔧 [${new Date().toISOString()}] Correction des chemins dans index.html...\n`;

      // Remplacer les chemins absolus par des chemins relatifs
      const originalContent = indexContent;
      indexContent = indexContent
        .replace(/href="\/assets\//g, 'href="./assets/')
        .replace(/src="\/assets\//g, 'src="./assets/')
        .replace(/href="\//g, 'href="./')
        .replace(/src="\//g, 'src="./');

      if (originalContent !== indexContent) {
        await fs.writeFile(indexPath, indexContent);
        buildLog += `✅ Chemins corrigés dans index.html\n`;
      } else {
        buildLog += `ℹ️ Chemins déjà corrects dans index.html\n`;
      }

      // Vérifier les références CSS/JS
      const cssMatches = indexContent.match(/href="[^"]*\.css"/g) || [];
      const jsMatches = indexContent.match(/src="[^"]*\.js"/g) || [];

      buildLog += `🎨 Références CSS: ${cssMatches.length}, JS: ${jsMatches.length}\n`;
    } catch (indexFixError) {
      buildLog += `⚠️ Impossible de corriger index.html: ${indexFixError.message}\n`;
    }

    // Configuration domaine
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
      const finalStructure = await execCommand(
        `find "${outputDir}" -type f | head -10`
      );
      buildLog += `📊 Structure finale (10 premiers fichiers):\n${finalStructure}`;
    } catch (e) {
      buildLog += `⚠️ Impossible de lister la structure finale\n`;
    }

    buildLog += `✅ [${new Date().toISOString()}] Déploiement réussi!\n`;
    buildLog += `🌐 Site disponible: http://localhost:3002/project/${project.id}/\n`;

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
      await execCommand(
        `rm -rf ${path.join(__dirname, "../../temp", deploymentId)}`
      );
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
