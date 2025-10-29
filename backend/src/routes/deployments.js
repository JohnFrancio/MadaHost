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

// ==================== FONCTION PRINCIPALE DE DÉPLOIEMENT ====================

async function deployProject(deploymentId, project) {
  let primaryFramework = null;
  const deploymentDir = path.join(__dirname, "../../temp", deploymentId);

  try {
    console.log(
      `🚀 Démarrage déploiement ${deploymentId} pour ${project.name}`
    );

    // ✅ IMPORTANT: Générer le sous-domaine et le dossier de sortie
    const subdomain = project.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const outputDir = path.join("/var/www/deployed", subdomain);

    let buildLog = "";

    // Mettre à jour le statut
    buildLog += `🚀 [${new Date().toISOString()}] Démarrage du déploiement...\n`;
    buildLog += `📁 Dossier de sortie: /var/www/deployed/${subdomain}\n`;
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

    // ==================== CLONAGE ====================
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

    // ==================== DÉTECTION ET CONFIGURATION ====================
    buildLog += `🔍 [${new Date().toISOString()}] Détection des frameworks...\n`;
    await updateDeploymentLog(deploymentId, buildLog);

    const frameworkHandler = new UniversalFrameworkHandler();

    const {
      frameworks: detectedFrameworks,
      configs: frameworkConfigs,
      log: detectionLog,
    } = await frameworkHandler.detectFrameworks(deploymentDir);
    buildLog += detectionLog;

    let finalBuildCommand = project.build_command;
    let finalOutputDir = project.output_dir || "dist";
    let finalInstallCommand = project.install_command || "npm install";

    if (frameworkConfigs.length > 0) {
      primaryFramework = frameworkConfigs[0];
      buildLog += `🎯 Framework principal détecté: ${
        primaryFramework.name
      } (${Math.round(primaryFramework.confidence * 100)}%)\n`;

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

    // Setup des frameworks
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
      const installOutput = await execCommand(
        `cd ${deploymentDir} && ${finalInstallCommand}`
      );
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
        let buildEnv = {
          NODE_ENV: "production",
          CI: "true",
          GENERATE_SOURCEMAP: "false",
        };

        if (primaryFramework) {
          buildEnv = { ...buildEnv, ...primaryFramework.config.env };

          if (primaryFramework.name === "vue") {
            buildEnv.VUE_APP_NODE_ENV = "production";
          } else if (primaryFramework.name === "react") {
            buildEnv.REACT_APP_NODE_ENV = "production";
          } else if (primaryFramework.name === "nextjs") {
            buildEnv.NEXT_TELEMETRY_DISABLED = "1";
          }
        }

        const buildOutput = await execCommand(
          `cd ${deploymentDir} && ${finalBuildCommand}`,
          buildEnv
        );
        buildLog += `✅ Build réussi avec ${
          primaryFramework?.name || "configuration par défaut"
        }\n`;
      } catch (buildError) {
        buildLog += `⚠️ Build échoué: ${buildError.message}\n`;

        // Stratégies de fallback
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
          buildLog += `🔄 Tentative build React avec config simplifiée...\n`;
          try {
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

    // Essayer différents emplacements
    const possibleDirs = [
      sourceDir,
      path.join(deploymentDir, "build"),
      path.join(deploymentDir, "dist"),
      path.join(deploymentDir, "out"),
      path.join(deploymentDir, "public"),
      deploymentDir,
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

    // Copier les fichiers vers le volume Docker
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
      buildLog += `✅ Fichiers copiés vers /var/www/deployed/${subdomain}\n`;

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

        if (primaryFramework?.name === "vue") {
          htmlContent = htmlContent
            .replace(/href="\/assets\//g, 'href="./assets/')
            .replace(/src="\/assets\//g, 'src="./assets/');
        } else if (primaryFramework?.name === "react") {
          htmlContent = htmlContent
            .replace(/href="\/static\//g, 'href="./static/')
            .replace(/src="\/static\//g, 'src="./static/')
            .replace(/href="\/assets\//g, 'href="./assets/')
            .replace(/src="\/assets\//g, 'src="./assets/');
        }

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

    // ==================== CONFIGURATION DU DOMAINE ====================
    await supabase
      .from("deployments")
      .update({ status: "configuring", build_log: buildLog })
      .eq("id", deploymentId);

    const domain = `${subdomain}.madahost.me`;

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
    buildLog += `🌐 Site disponible: https://${domain}\n`;
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

// ==================== FONCTIONS UTILITAIRES ====================

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
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
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
