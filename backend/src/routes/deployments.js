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
  let primaryFramework = null;

  // ✅ DEBUG: Vérifier le répertoire courant
  console.log(`🔍 [DEBUG] process.cwd(): ${process.cwd()}`);
  console.log(`🔍 [DEBUG] __dirname: ${__dirname}`);

  const deploymentDir = path.join("/app", "temp", deploymentId);
  const subdomain = project.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const outputDir = path.join("/var/www/deployments", subdomain);

  try {
    buildLog += `🚀 [${new Date().toISOString()}] Déploiement de ${
      project.name
    }\n`;
    buildLog += `📁 Temp dir: ${deploymentDir}\n`;
    buildLog += `📁 Output dir: ${outputDir}\n`;

    // ✅ DEBUG: Lister le contenu de /app/temp AVANT création
    try {
      const tempFiles = await fs.readdir("/app/temp");
      console.log(`🔍 [DEBUG] Contenu de /app/temp: ${tempFiles.join(", ")}`);
      buildLog += `🔍 [DEBUG] Dossiers dans /app/temp: ${tempFiles.join(
        ", "
      )}\n`;
    } catch (e) {
      console.log(`🔍 [DEBUG] /app/temp n'existe pas encore`);
    }

    await updateDeploymentLog(deploymentId, buildLog);

    // ✅ VÉRIFIER ET NETTOYER LE DOSSIER SI EXISTE DÉJÀ
    try {
      const existingFiles = await fs.readdir(deploymentDir);
      buildLog += `⚠️ Dossier existe déjà avec ${existingFiles.length} fichiers, nettoyage...\n`;
      console.log(
        `🔍 [DEBUG] Dossier ${deploymentId} existe déjà, nettoyage...`
      );
      await execCommand(`rm -rf "${deploymentDir}"`);
    } catch (e) {
      // Dossier n'existe pas, c'est bon
      console.log(
        `🔍 [DEBUG] Dossier ${deploymentId} n'existe pas, création...`
      );
    }

    // ✅ Créer les dossiers
    await fs.mkdir(deploymentDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    buildLog += `✅ Dossiers créés\n`;

    // ✅ DEBUG: Vérifier que le dossier a été créé
    try {
      const createdFiles = await fs.readdir(deploymentDir);
      console.log(
        `🔍 [DEBUG] Dossier créé avec: ${createdFiles.length} fichiers`
      );
      buildLog += `🔍 [DEBUG] Dossier créé avec: ${createdFiles.length} fichiers\n`;
    } catch (e) {
      console.log(
        `❌ [DEBUG] ERREUR: Impossible de lire le dossier créé: ${e.message}`
      );
      buildLog += `❌ [DEBUG] ERREUR: Impossible de lire le dossier créé: ${e.message}\n`;
    }

    // ==================== CLONAGE ====================
    buildLog += `📥 Clonage du repository ${project.github_repo}...\n`;
    await updateDeploymentLog(deploymentId, buildLog);

    const { data: user } = await supabase
      .from("users")
      .select("access_token")
      .eq("id", project.user_id)
      .single();

    if (!user?.access_token) {
      throw new Error("Token GitHub manquant");
    }

    await supabase
      .from("deployments")
      .update({ status: "cloning", build_log: buildLog })
      .eq("id", deploymentId);

    const cloneCommand = `git clone --depth 1 -b ${
      project.branch || "main"
    } https://${user.access_token}@github.com/${
      project.github_repo
    }.git "${deploymentDir}"`;

    try {
      buildLog += `🔧 Commande: git clone -b ${project.branch || "main"}\n`;
      console.log(`🔍 [DEBUG] Commande clone: ${cloneCommand}`);

      await execCommand(cloneCommand, {}, 180000);
      buildLog += `✅ Repository cloné avec succès\n`;
    } catch (cloneError) {
      buildLog += `❌ Erreur clonage: ${cloneError.message}\n`;
      console.error(`❌ [DEBUG] Erreur clonage: ${cloneError.message}`);
      throw new Error(
        `Impossible de cloner le repository: ${cloneError.message}`
      );
    }

    // ✅ DEBUG INTENSIF: Vérifier le contenu APRÈS clonage
    try {
      const filesAfterClone = await fs.readdir(deploymentDir);
      console.log(
        `🔍 [DEBUG] APRÈS CLONE - ${
          filesAfterClone.length
        } fichiers: ${filesAfterClone.join(", ")}`
      );
      buildLog += `🔍 [DEBUG] APRÈS CLONE - ${
        filesAfterClone.length
      } fichiers: ${filesAfterClone.join(", ")}\n`;

      // Vérifier les fichiers spécifiques
      const packageJsonPath = path.join(deploymentDir, "package.json");
      const viteConfigPath = path.join(deploymentDir, "vite.config.js");

      try {
        await fs.access(packageJsonPath);
        console.log(`✅ [DEBUG] package.json présent`);
        buildLog += `✅ [DEBUG] package.json présent\n`;
      } catch {
        console.log(`❌ [DEBUG] package.json MANQUANT`);
        buildLog += `❌ [DEBUG] package.json MANQUANT\n`;
      }

      try {
        await fs.access(viteConfigPath);
        console.log(`✅ [DEBUG] vite.config.js présent`);
        buildLog += `✅ [DEBUG] vite.config.js présent\n`;
      } catch {
        console.log(`❌ [DEBUG] vite.config.js MANQUANT`);
        buildLog += `❌ [DEBUG] vite.config.js MANQUANT\n`;
      }
    } catch (readError) {
      console.error(
        `❌ [DEBUG] Impossible de lire après clone: ${readError.message}`
      );
      buildLog += `❌ [DEBUG] Impossible de lire après clone: ${readError.message}\n`;
    }

    // ✅ VÉRIFICATION RENFORCÉE du contenu cloné
    try {
      const files = await fs.readdir(deploymentDir);
      buildLog += `📊 ${files.length} fichiers/dossiers dans le repo\n`;
      buildLog += `📋 Contenu: ${files.join(", ")}\n`; // ✅ AJOUT: Lister les fichiers

      if (files.length === 0) {
        throw new Error("Le repository cloné est vide");
      }

      // ✅ VÉRIFICATION: Le dossier contient bien les fichiers du projet
      const hasPackageJson = files.includes("package.json");
      const hasSrc =
        files.includes("src") ||
        files.includes("app") ||
        files.includes("pages");
      buildLog += `📦 package.json présent: ${hasPackageJson}\n`;
      buildLog += `📁 Dossier src présent: ${hasSrc}\n`;
    } catch (readError) {
      buildLog += `❌ Impossible de lire le dossier cloné: ${readError.message}\n`;
      throw new Error("Le clonage a échoué ou le dossier est vide");
    }

    // Commit hash
    try {
      const commitHash = await execCommand(
        `cd "${deploymentDir}" && git rev-parse HEAD`
      );
      await supabase
        .from("deployments")
        .update({ commit_hash: commitHash.trim() })
        .eq("id", deploymentId);
      buildLog += `📋 Commit: ${commitHash.trim().substring(0, 8)}\n`;
    } catch (e) {
      buildLog += `⚠️ Impossible de récupérer le commit hash\n`;
    }

    await updateDeploymentLog(deploymentId, buildLog);

    // ==================== DÉTECTION DES FRAMEWORKS ====================
    buildLog += `🔍 Détection des frameworks...\n`;
    await updateDeploymentLog(deploymentId, buildLog);

    const frameworkHandler = new UniversalFrameworkHandler();
    const {
      frameworks: detectedFrameworks,
      configs: frameworkConfigs,
      log: detectionLog,
    } = await frameworkHandler.detectFrameworks(deploymentDir);
    buildLog += detectionLog;

    let finalBuildCommand = project.build_command || "npm run build";
    let finalOutputDir = project.output_dir || "dist";

    if (frameworkConfigs.length > 0) {
      primaryFramework = frameworkConfigs[0]; // ✅ DÉFINIR ICI
      buildLog += `🎯 Framework principal: ${primaryFramework.name}\n`;

      if (!project.build_command) {
        finalBuildCommand = primaryFramework.config.buildCommand;
      }
      if (!project.output_dir) {
        finalOutputDir = primaryFramework.config.outputDir;
      }
    }

    // ==================== MODIFICATION PACKAGE.JSON (AVANT INSTALLATION!) ====================
    buildLog += `📋 Modification du package.json...\n`;

    try {
      const packageJsonPath = path.join(deploymentDir, "package.json");
      let packageJson;

      try {
        packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
      } catch (readError) {
        buildLog += `⚠️ Pas de package.json trouvé, création d'un nouveau\n`;
        packageJson = {
          name: project.name,
          version: "1.0.0",
          dependencies: {},
          devDependencies: {},
        };
      }

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      let modified = false;
      if (!packageJson.devDependencies) packageJson.devDependencies = {};

      // ✅ FORCER Vite pour React/Vue (primaryFramework est maintenant défini)
      if (
        primaryFramework &&
        (primaryFramework.name === "react" || primaryFramework.name === "vue")
      ) {
        if (!allDeps.vite) {
          packageJson.devDependencies.vite = "^5.2.11";
          modified = true;
          buildLog += `➕ Vite v5.2.11 ajouté au package.json\n`;
        }

        if (
          primaryFramework.name === "react" &&
          !allDeps["@vitejs/plugin-react"]
        ) {
          packageJson.devDependencies["@vitejs/plugin-react"] = "^4.3.1";
          modified = true;
          buildLog += `➕ @vitejs/plugin-react v4.3.1 ajouté\n`;
        } else if (
          primaryFramework.name === "vue" &&
          !allDeps["@vitejs/plugin-vue"]
        ) {
          packageJson.devDependencies["@vitejs/plugin-vue"] = "^5.1.2";
          modified = true;
          buildLog += `➕ @vitejs/plugin-vue v5.1.2 ajouté\n`;
        }

        if (modified) {
          await fs.writeFile(
            packageJsonPath,
            JSON.stringify(packageJson, null, 2)
          );
          buildLog += `💾 package.json modifié et sauvegardé\n`;
        } else {
          buildLog += `✅ Vite déjà présent dans package.json\n`;
        }
      }
    } catch (error) {
      buildLog += `⚠️ Erreur modification package.json: ${error.message}\n`;
    }

    await updateDeploymentLog(deploymentId, buildLog);

    // Setup Tailwind si nécessaire
    if (detectedFrameworks.includes("tailwind")) {
      const { buildLog: setupLog } = await frameworkHandler.setupFrameworks(
        deploymentDir,
        detectedFrameworks,
        buildLog
      );
      buildLog = setupLog;
    }

    // ==================== INSTALLATION ====================
    buildLog += `📦 Installation des dépendances...\n`;
    await supabase
      .from("deployments")
      .update({ status: "building", build_log: buildLog })
      .eq("id", deploymentId);

    await updateDeploymentLog(deploymentId, buildLog);

    // ✅ DEBUG: Vérifier le package.json AVANT installation
    try {
      const packageJsonPath = path.join(deploymentDir, "package.json");
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf8")
      );
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      console.log(`🔍 [DEBUG] Vite dans package.json: ${!!allDeps.vite}`);
      console.log(`🔍 [DEBUG] React dans package.json: ${!!allDeps.react}`);
      buildLog += `🔍 [DEBUG] Vite dans package.json: ${!!allDeps.vite}\n`;
      buildLog += `🔍 [DEBUG] React dans package.json: ${!!allDeps.react}\n`;
    } catch (e) {
      console.log(`❌ [DEBUG] Erreur lecture package.json: ${e.message}`);
    }

    // ✅ Installation avec --legacy-peer-deps
    try {
      await execCommand(
        `cd ${deploymentDir} && npm install --legacy-peer-deps`,
        { NODE_ENV: "production" },
        300000
      );
      buildLog += `✅ npm install terminé\n`;
    } catch (installError) {
      buildLog += `❌ Erreur npm install: ${installError.message}\n`;
      throw new Error(
        `Installation des dépendances échouée: ${installError.message}`
      );
    }

    // ✅ DEBUG: Vérifier si Vite est installé APRÈS npm install
    try {
      const viteCheck = await execCommand(
        `cd ${deploymentDir} && npm list vite 2>/dev/null || echo "VITE_NOT_INSTALLED"`
      );
      console.log(
        `🔍 [DEBUG] Vite après npm install: ${
          viteCheck.includes("vite@") ? "INSTALLÉ" : "NON INSTALLÉ"
        }`
      );
      buildLog += `🔍 [DEBUG] Vite après npm install: ${
        viteCheck.includes("vite@") ? "INSTALLÉ" : "NON INSTALLÉ"
      }\n`;

      if (viteCheck.includes("VITE_NOT_INSTALLED")) {
        buildLog += `⚠️ Vite non installé, installation forcée...\n`;

        // FORCER l'installation de Vite
        await execCommand(
          `cd ${deploymentDir} && npm install vite@latest --save-dev --legacy-peer-deps`,
          {},
          120000
        );
        buildLog += `✅ Vite installé manuellement\n`;

        // Installer le plugin React si nécessaire
        if (primaryFramework && primaryFramework.name === "react") {
          await execCommand(
            `cd ${deploymentDir} && npm install @vitejs/plugin-react@latest --save-dev --legacy-peer-deps`,
            {},
            120000
          );
          buildLog += `✅ @vitejs/plugin-react installé\n`;
        }
      }
    } catch (checkError) {
      console.log(`❌ [DEBUG] Erreur vérification Vite: ${checkError.message}`);
      buildLog += `❌ [DEBUG] Erreur vérification Vite: ${checkError.message}\n`;
    }

    await updateDeploymentLog(deploymentId, buildLog);

    // ==================== BUILD ====================
    buildLog += `🏗️ Build du projet...\n`;
    buildLog += `🔧 Commande: ${finalBuildCommand}\n`;
    await updateDeploymentLog(deploymentId, buildLog);

    try {
      // ✅ Utiliser npx pour exécuter les commandes localement
      await execCommand(
        `cd ${deploymentDir} && ${finalBuildCommand}`,
        {
          NODE_ENV: "production",
          CI: "true",
          GENERATE_SOURCEMAP: "false",
        },
        600000
      );
      buildLog += `✅ Build réussi\n`;
    } catch (buildError) {
      buildLog += `⚠️ Build échoué: ${buildError.message}\n`;
      buildLog += `🔄 Tentative avec npx...\n`;

      try {
        // ✅ Utiliser npx pour forcer l'utilisation des binaires locaux
        await execCommand(
          `cd ${deploymentDir} && npx ${finalBuildCommand}`,
          {
            NODE_ENV: "production",
          },
          600000
        );
        buildLog += `✅ Build réussi avec npx\n`;
      } catch (npxError) {
        buildLog += `❌ Tous les builds ont échoué: ${npxError.message}\n`;
        throw buildError;
      }
    }

    // ==================== COPIE FICHIERS ====================
    await supabase
      .from("deployments")
      .update({ status: "deploying", build_log: buildLog })
      .eq("id", deploymentId);

    buildLog += `📁 Copie des fichiers...\n`;

    // Chercher le dossier de sortie
    const possibleDirs = [
      path.join(deploymentDir, finalOutputDir),
      path.join(deploymentDir, "dist"),
      path.join(deploymentDir, "build"),
      path.join(deploymentDir, "out"),
    ];

    let sourceDir = null;
    for (const dir of possibleDirs) {
      try {
        await fs.access(dir);
        const files = await fs.readdir(dir);
        if (files.includes("index.html")) {
          sourceDir = dir;
          buildLog += `✅ Fichiers trouvés dans: ${path.basename(dir)}\n`;
          break;
        }
      } catch {}
    }

    if (!sourceDir) {
      throw new Error(`Aucun dossier de sortie trouvé`);
    }

    await execCommand(`cp -r "${sourceDir}/"* "${outputDir}/"`);
    buildLog += `✅ Fichiers copiés vers ${outputDir}\n`;

    const copiedFiles = await fs.readdir(outputDir);
    buildLog += `📊 ${copiedFiles.length} fichiers copiés\n`;

    // ==================== SUCCÈS ====================
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
      buildLog += `🎯 Framework: ${primaryFramework.name}\n`;
    }

    await supabase
      .from("deployments")
      .update({
        status: "success",
        build_log: buildLog,
        completed_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);

    // ✅ NETTOYAGE FINAL du dossier temp
    try {
      await execCommand(`rm -rf "${deploymentDir}"`);
      buildLog += `🧹 Dossier temp nettoyé\n`;
    } catch (cleanupError) {
      console.error("❌ Erreur nettoyage final:", cleanupError);
    }
  } catch (error) {
    console.error(`❌ Erreur déploiement ${deploymentId}:`, error);
    buildLog += `❌ [${new Date().toISOString()}] Erreur: ${error.message}\n`;

    await supabase
      .from("deployments")
      .update({
        status: "failed",
        build_log: buildLog,
        completed_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);

    // Nettoyage en cas d'erreur
    try {
      await execCommand(`rm -rf "${deploymentDir}"`);
      buildLog += `🧹 Nettoyage effectué\n`;
    } catch (cleanupError) {
      console.error("❌ Erreur nettoyage:", cleanupError);
    }
  }
}

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

function execCommand(command, envVars = {}, timeout = 600000) {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        timeout,
        env: { ...process.env, ...envVars },
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${error.message}\n${stderr || stdout}`));
        } else {
          resolve(stdout);
        }
      }
    );
  });
}

module.exports = router;
