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

// ==================== FONCTION PRINCIPALE DE DÉPLOIEMENT ====================

async function deployProject(deploymentId, project) {
  let primaryFramework = null;
  let buildLog = "";
  const deploymentDir = path.join(__dirname, "../../temp", deploymentId);

  try {
    console.log(
      `🚀 Démarrage déploiement ${deploymentId} pour ${project.name}`
    );

    const subdomain = project.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const outputDir = path.join("/var/www/deployed", subdomain);

    buildLog += `🚀 [${new Date().toISOString()}] Démarrage du déploiement...\n`;
    buildLog += `📁 Dossier de sortie: ${outputDir}\n`;
    await updateDeploymentLog(deploymentId, buildLog);

    await fs.mkdir(deploymentDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

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

    await execCommand(cloneCommand, {}, 300000, null, deploymentDir);
    buildLog += `✅ Repository cloné avec succès\n`;

    try {
      const commitHash = await execCommand(
        "git rev-parse HEAD",
        {},
        30000,
        deploymentDir,
        deploymentDir
      );

      await supabase
        .from("deployments")
        .update({ commit_hash: commitHash.trim() })
        .eq("id", deploymentId);
      buildLog += `📋 Commit: ${commitHash.trim().substring(0, 8)}\n`;
    } catch (error) {
      buildLog += `⚠️ Impossible de récupérer le commit hash\n`;
    }

    // ==================== DÉTECTION FRAMEWORKS ====================
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

      // Dans la détection des frameworks - AJOUTEZ cette vérification
      if (
        primaryFramework?.name === "react" ||
        primaryFramework?.name === "vue"
      ) {
        // ✅ Vérifier si le projet utilise Vite explicitement
        const packageJsonPath = path.join(deploymentDir, "package.json");
        try {
          const packageJson = JSON.parse(
            await fs.readFile(packageJsonPath, "utf8")
          );
          const scripts = packageJson.scripts || {};
          const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
          };

          const usesVite = scripts.build?.includes("vite") || allDeps.vite;

          if (usesVite) {
            buildLog += `⚡ Projet configuré avec Vite\n`;

            // ✅ S'assurer que les plugins Vite sont présents
            if (
              primaryFramework.name === "react" &&
              !allDeps["@vitejs/plugin-react"]
            ) {
              buildLog += `➕ Ajout de @vitejs/plugin-react...\n`;
              await execCommand(
                "npm install @vitejs/plugin-react@^4.0.0 --save-dev --no-audit --no-fund",
                {},
                120000,
                deploymentDir,
                deploymentDir
              );
            }

            if (
              primaryFramework.name === "vue" &&
              !allDeps["@vitejs/plugin-vue"]
            ) {
              buildLog += `➕ Ajout de @vitejs/plugin-vue...\n`;
              await execCommand(
                "npm install @vitejs/plugin-react@^4.0.0 --save-dev --no-audit --no-fund",
                {},
                120000,
                deploymentDir,
                deploymentDir
              );
            }
          }
        } catch (error) {
          buildLog += `⚠️ Impossible de vérifier la config Vite: ${error.message}\n`;
        }
      }

      // ✅ CORRECTION: Utiliser les bonnes commandes selon le framework
      if (primaryFramework.name === "nextjs") {
        // Next.js utilise ses propres commandes
        finalBuildCommand = "npm run build";
        finalOutputDir = ".next"; // ou "out" si export statique
        finalInstallCommand = "npm install";

        buildLog += `📦 Next.js détecté - Configuration spéciale\n`;

        // Vérifier si export statique est configuré
        const packageJsonPath = path.join(deploymentDir, "package.json");
        try {
          const packageJson = JSON.parse(
            await fs.readFile(packageJsonPath, "utf8")
          );
          if (packageJson.scripts?.export) {
            finalBuildCommand = "npm run build && npm run export";
            finalOutputDir = "out";
            buildLog += `📤 Export statique Next.js configuré\n`;
          }
        } catch (e) {
          buildLog += `⚠️ Impossible de vérifier l'export statique\n`;
        }
      } else {
        // Pour les autres frameworks, utiliser la config détectée
        if (
          !project.build_command ||
          project.build_command === "npm run build"
        ) {
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
    }

    // Setup des frameworks (mais pas pour Next.js !)
    // ==================== MODIFICATION DU PACKAGE.JSON ====================
    if (
      primaryFramework?.name === "react" ||
      primaryFramework?.name === "vue"
    ) {
      try {
        const packageJsonPath = path.join(deploymentDir, "package.json");
        const packageJson = JSON.parse(
          await fs.readFile(packageJsonPath, "utf8")
        );

        buildLog += `📋 [${new Date().toISOString()}] Vérification des dépendances...\n`;

        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        let modified = false;

        // ✅ Ajouter Vite si manquant
        if (!allDeps.vite) {
          if (!packageJson.devDependencies) packageJson.devDependencies = {};
          packageJson.devDependencies.vite = "^5.0.0";
          modified = true;
          buildLog += `➕ Ajout de Vite v5.0.0\n`;
        }

        // ✅ Ajouter le plugin React/Vue si manquant
        if (
          primaryFramework.name === "react" &&
          !allDeps["@vitejs/plugin-react"]
        ) {
          packageJson.devDependencies["@vitejs/plugin-react"] = "^4.2.0";
          modified = true;
          buildLog += `➕ Ajout de @vitejs/plugin-react v4.2.0\n`;
        } else if (
          primaryFramework.name === "vue" &&
          !allDeps["@vitejs/plugin-vue"]
        ) {
          packageJson.devDependencies["@vitejs/plugin-vue"] = "^5.0.0";
          modified = true;
          buildLog += `➕ Ajout de @vitejs/plugin-vue v5.0.0\n`;
        }

        if (modified) {
          await fs.writeFile(
            packageJsonPath,
            JSON.stringify(packageJson, null, 2)
          );
          buildLog += `💾 package.json mis à jour\n`;
        } else {
          buildLog += `✅ Toutes les dépendances nécessaires sont présentes\n`;
        }

        await updateDeploymentLog(deploymentId, buildLog);
      } catch (error) {
        buildLog += `⚠️ Erreur modification package.json: ${error.message}\n`;
      }
    }

    // ==================== INSTALLATION DES DÉPENDANCES ====================
    const packageJsonPath = path.join(deploymentDir, "package.json");
    try {
      await fs.access(packageJsonPath);

      buildLog += `📦 [${new Date().toISOString()}] Installation des dépendances...\n`;
      buildLog += `🔧 Commande d'installation: ${finalInstallCommand}\n`;
      await updateDeploymentLog(deploymentId, buildLog);

      // ✅ Installation AVEC node_modules/.bin dans le PATH
      const installOutput = await execCommand(
        finalInstallCommand,
        { npm_config_platform: "linux" },
        300000,
        deploymentDir,
        deploymentDir
      );

      buildLog += `✅ Dépendances installées avec succès\n`;

      // ✅ VÉRIFICATION CRITIQUE: Tester Vite immédiatement
      try {
        // Test direct avec le PATH configuré
        const viteVersion = await execCommand(
          "vite --version",
          {},
          30000,
          deploymentDir
        );
        buildLog += `✅ Vite accessible: v${viteVersion.trim()}\n`;
      } catch (viteError) {
        buildLog += `⚠️ Vite non accessible directement, test avec npx...\n`;

        try {
          // Test avec npx (fallback)
          const viteVersionNpx = await execCommand(
            "npx vite --version",
            {},
            30000,
            deploymentDir
          );
          buildLog += `✅ Vite accessible via npx: v${viteVersionNpx.trim()}\n`;
        } catch (npxError) {
          buildLog += `❌ Vite non trouvé, installation forcée...\n`;

          // Installation explicite
          await execCommand(
            "npm install vite@^5.0.0 --save-dev --no-audit --no-fund",
            {},
            180000,
            deploymentDir
          );
          buildLog += `✅ Vite installé explicitement\n`;

          // Vérification finale
          const viteFinal = await execCommand(
            "vite --version",
            {},
            30000,
            deploymentDir
          );
          buildLog += `✅ Vite maintenant accessible: v${viteFinal.trim()}\n`;
        }
      }

      await updateDeploymentLog(deploymentId, buildLog);
    } catch (error) {
      buildLog += `❌ Erreur installation: ${error.message}\n`;
      await updateDeploymentLog(deploymentId, buildLog);
      throw error;
    }

    // ==================== BUILD DU PROJET ====================
    if (finalBuildCommand && finalBuildCommand !== "") {
      buildLog += `🏗️ [${new Date().toISOString()}] Build du projet...\n`;
      buildLog += `🔧 Commande de build: ${finalBuildCommand}\n`;
      await updateDeploymentLog(deploymentId, buildLog);

      try {
        // ✅ STRATÉGIE DE BUILD ROBUSTE
        let buildSuccessful = false;
        let buildError = null;

        // Essai 1: Commande originale avec PATH configuré
        try {
          const buildOutput = await execCommand(
            finalBuildCommand,
            { NODE_ENV: "production" },
            600000,
            deploymentDir,
            deploymentDir
          );
          buildLog += `✅ Build réussi (méthode standard)\n`;
          buildSuccessful = true;
        } catch (error1) {
          buildError = error1;
          buildLog += `⚠️ Build standard échoué: ${error1.message}\n`;

          // Essai 2: Remplacer vite par npx vite
          if (finalBuildCommand.includes("vite build")) {
            buildLog += `🔄 Tentative avec npx...\n`;
            await updateDeploymentLog(deploymentId, buildLog);

            try {
              const npxCommand = finalBuildCommand.replace(
                "vite build",
                "npx vite build"
              );
              const npxOutput = await execCommand(
                npxCommand,
                {
                  NODE_ENV: "production",
                  CI: "true",
                },
                600000,
                deploymentDir
              );
              buildLog += `✅ Build réussi avec npx\n`;
              buildSuccessful = true;
            } catch (error2) {
              buildLog += `❌ Build avec npx échoué: ${error2.message}\n`;
            }
          }

          // Essai 3: Commande npm run build directe
          if (!buildSuccessful) {
            buildLog += `🔄 Tentative avec npm run build direct...\n`;
            await updateDeploymentLog(deploymentId, buildLog);

            try {
              const npmOutput = await execCommand(
                "npm run build",
                {
                  NODE_ENV: "production",
                  CI: "true",
                },
                600000,
                deploymentDir
              );
              buildLog += `✅ Build réussi avec npm run build\n`;
              buildSuccessful = true;
            } catch (error3) {
              buildLog += `❌ Toutes les méthodes de build ont échoué\n`;
            }
          }
        }

        if (!buildSuccessful) {
          throw (
            buildError || new Error("Build failed avec toutes les méthodes")
          );
        }
      } catch (buildError) {
        buildLog += `❌ Erreur build finale: ${buildError.message}\n`;
        throw buildError;
      }
    } else {
      buildLog += `ℹ️ Aucune commande de build spécifiée, copie des fichiers statiques\n`;
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

    const possibleDirs = [
      sourceDir,
      path.join(deploymentDir, "out"),
      path.join(deploymentDir, ".next"),
      path.join(deploymentDir, "build"),
      path.join(deploymentDir, "dist"),
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

    try {
      buildLog += `📋 Copie depuis ${foundSourceDir.replace(
        deploymentDir,
        "."
      )}\n`;

      await execCommand(
        `rm -rf "${outputDir}"/*`,
        {},
        30000,
        null,
        deploymentDir
      );
      await execCommand(
        `cp -r "${foundSourceDir}/"* "${outputDir}/" 2>/dev/null || true`,
        {},
        30000,
        null,
        deploymentDir
      );
      buildLog += `✅ Fichiers copiés vers ${outputDir}\n`;

      const copiedFiles = await fs.readdir(outputDir);
      buildLog += `📊 Fichiers copiés: ${copiedFiles.length} éléments\n`;

      if (copiedFiles.includes("index.html")) {
        buildLog += `✅ index.html trouvé\n`;
      }
    } catch (copyError) {
      buildLog += `❌ Erreur copie: ${copyError.message}\n`;
      throw copyError;
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

    buildLog += `✅ [${new Date().toISOString()}] Déploiement réussi!\n`;
    buildLog += `🌐 Site disponible: https://${domain}\n`;
    if (primaryFramework) {
      buildLog += `🎯 Framework déployé: ${primaryFramework.name}\n`;
    }

    await supabase
      .from("deployments")
      .update({
        status: "success",
        build_log: buildLog,
        completed_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);

    setTimeout(async () => {
      try {
        await execCommand(
          `rm -rf ${deploymentDir}`,
          {},
          30000,
          null,
          deploymentDir
        );
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

    try {
      await execCommand(
        `rm -rf ${deploymentDir}`,
        {},
        30000,
        null,
        deploymentDir
      );
    } catch (cleanupError) {
      console.error("❌ Erreur nettoyage:", cleanupError);
    }
  }
}

// ==================== FONCTIONS UTILITAIRES ====================

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

// ✅ CORRECTION: Fonction execCommand avec deploymentDir en paramètre
function execCommand(
  command,
  envVars = {},
  timeout = 300000,
  cwd = null,
  deploymentDir = null
) {
  return new Promise((resolve, reject) => {
    // ✅ CORRECTION: Utiliser cwd OU deploymentDir, avec fallback sécurisé
    const currentDir = cwd || deploymentDir || process.cwd();

    if (!currentDir) {
      return reject(new Error("Aucun répertoire de travail spécifié"));
    }

    // ✅ PATH CRITIQUE: Inclure node_modules/.bin du projet
    const nodeBinPath = path.join(currentDir, "node_modules", ".bin");
    const customPath = `${nodeBinPath}:${process.env.PATH}`;

    const options = {
      timeout,
      cwd: currentDir,
      env: {
        ...process.env,
        ...envVars,
        PATH: customPath,
        NODE_ENV: "production",
      },
      maxBuffer: 10 * 1024 * 1024,
    };

    console.log(`🔧 Exécution: ${command}`);
    console.log(`📁 CWD: ${options.cwd}`);
    console.log(`🔧 PATH: ${customPath}`);

    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Erreur commande: ${command}`);
        console.error(`📋 Stdout: ${stdout}`);
        console.error(`📋 Stderr: ${stderr}`);

        const errorMessage = `Command: ${command}\nError: ${error.message}\nStdout: ${stdout}\nStderr: ${stderr}`;
        reject(new Error(errorMessage));
        return;
      }

      if (stdout) console.log(`📋 Output: ${stdout}`);
      if (stderr && !stderr.includes("warning"))
        console.log(`⚠️ Warnings: ${stderr}`);

      resolve(stdout);
    });
  });
}

module.exports = router;
