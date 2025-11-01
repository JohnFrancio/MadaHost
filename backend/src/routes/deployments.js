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

  // ✅ CONSTRUIRE L'URL DU REPOSITORY
  const githubRepo = project.github_repo;

  if (!githubRepo) {
    console.error(`❌ Pas de github_repo pour le projet ${project.id}`);
    await supabase
      .from("deployments")
      .update({
        status: "failed",
        build_log: "❌ Erreur: Repository GitHub manquant",
        completed_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);
    return;
  }

  // ✅ Construire l'URL complète (avec gestion du token si disponible)
  const githubToken = process.env.GITHUB_TOKEN;
  const repoUrl = githubToken
    ? `https://${githubToken}@github.com/${githubRepo}.git`
    : `https://github.com/${githubRepo}.git`;

  // ✅ DEBUG: Vérifier le répertoire courant
  console.log(`🔍 [DEBUG] process.cwd(): ${process.cwd()}`);
  console.log(`🔍 [DEBUG] __dirname: ${__dirname}`);
  console.log(`🔍 [DEBUG] GitHub Repo: ${githubRepo}`);
  console.log(
    `🔍 [DEBUG] Repository URL: ${repoUrl.replace(githubToken || "", "***")}`
  );

  const deploymentDir = path.join("/app", "temp", deploymentId);
  const subdomain = project.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const outputDir = path.join("/var/www/deployments", subdomain);

  try {
    buildLog += `🚀 [${new Date().toISOString()}] Déploiement de ${
      project.name
    }\n`;
    buildLog += `📁 Temp dir: ${deploymentDir}\n`;
    buildLog += `📁 Output dir: ${outputDir}\n`;
    buildLog += `📦 Repository: ${githubRepo}\n`;

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

    // ==================== CLONAGE GIT ====================
    buildLog += `📥 Clonage du dépôt: ${repoUrl}\n`;

    // ✅ FORCER CLONE COMPLET
    const cloneCommand = `git clone --depth 1 ${repoUrl} ${deploymentDir}`;
    buildLog += `🔧 Commande: ${cloneCommand}\n`;

    try {
      const cloneOutput = await execCommand(cloneCommand, {}, 180000);
      buildLog += `✅ Clonage terminé\n`;
      buildLog += `📊 Output: ${cloneOutput.substring(0, 500)}\n`;
    } catch (cloneError) {
      buildLog += `❌ Erreur clonage: ${cloneError.message}\n`;
      throw cloneError;
    }

    // ✅ VÉRIFIER QUE LE CLONE A RÉUSSI
    try {
      const lsOutput = await execCommand(`ls -la ${deploymentDir}`);
      buildLog += `📂 Contenu du répertoire:\n${lsOutput}\n`;

      const packageCheck = await execCommand(
        `test -f ${deploymentDir}/package.json && echo "EXISTS" || echo "MISSING"`
      );
      buildLog += `📋 package.json: ${packageCheck.trim()}\n`;

      if (packageCheck.trim() === "MISSING") {
        throw new Error("package.json introuvable après clonage");
      }
    } catch (checkError) {
      buildLog += `❌ Vérification échouée: ${checkError.message}\n`;
      throw checkError;
    }

    await updateDeploymentLog(deploymentId, buildLog);

    // ==================== FORCER VITE DANS PACKAGE.JSON ====================
    buildLog += `📋 Modification forcée du package.json...\n`;

    try {
      const packageJsonPath = path.join(deploymentDir, "package.json");
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf8")
      );

      buildLog += `📦 Package actuel: ${packageJson.name || "inconnu"}\n`;

      // ✅ FORCER devDependencies
      if (!packageJson.devDependencies) packageJson.devDependencies = {};

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      const isReact = allDeps["react"] || allDeps["react-dom"];
      const isVue = allDeps["vue"];

      buildLog += `🔍 Framework: React=${!!isReact}, Vue=${!!isVue}\n`;

      // ✅ TOUJOURS FORCER VITE + PLUGINS
      packageJson.devDependencies.vite = "^5.2.11";

      if (isReact) {
        packageJson.devDependencies["@vitejs/plugin-react"] = "^4.3.1";
        buildLog += `➕ React + Vite forcés\n`;
      } else if (isVue) {
        packageJson.devDependencies["@vitejs/plugin-vue"] = "^5.1.2";
        buildLog += `➕ Vue + Vite forcés\n`;
      } else {
        // Détecter via fichiers
        try {
          await execCommand(
            `test -f ${deploymentDir}/vite.config.js && echo "HAS_VITE"`
          );
          packageJson.devDependencies["@vitejs/plugin-react"] = "^4.3.1";
          buildLog += `➕ Vite.config.js détecté, React plugin ajouté\n`;
        } catch {}
      }

      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      buildLog += `💾 package.json sauvegardé avec Vite\n`;
    } catch (modifyError) {
      buildLog += `❌ Modification package.json échouée: ${modifyError.message}\n`;
      throw modifyError;
    }

    await updateDeploymentLog(deploymentId, buildLog);

    // ==================== NETTOYAGE RADICAL ====================
    buildLog += `🗑️ Nettoyage complet...\n`;
    try {
      await execCommand(
        `cd ${deploymentDir} && rm -rf node_modules package-lock.json yarn.lock pnpm-lock.yaml .vite`
      );
      buildLog += `✅ Caches supprimés\n`;
    } catch (cleanError) {
      buildLog += `⚠️ Nettoyage partiel: ${cleanError.message}\n`;
    }

    await updateDeploymentLog(deploymentId, buildLog);

    // ==================== INSTALLATION AGRESSIVE ====================
    buildLog += `📦 Installation des dépendances...\n`;

    await supabase
      .from("deployments")
      .update({ status: "building", build_log: buildLog })
      .eq("id", deploymentId);

    // ✅ MÉTHODE 1: npm install classique
    buildLog += `🔧 Tentative 1: npm install...\n`;
    try {
      const installOutput = await execCommand(
        `cd ${deploymentDir} && npm install --legacy-peer-deps --no-audit --no-fund --loglevel=verbose`,
        { NODE_ENV: "production" },
        300000
      );
      buildLog += `✅ npm install terminé\n`;
      buildLog += `📊 Dernières lignes:\n${installOutput
        .split("\n")
        .slice(-10)
        .join("\n")}\n`;
    } catch (installError) {
      buildLog += `❌ npm install échoué: ${installError.message}\n`;

      // ✅ MÉTHODE 2: Installation forcée de Vite
      buildLog += `🔧 Tentative 2: Installation forcée de Vite...\n`;
      try {
        await execCommand(
          `cd ${deploymentDir} && npm install --save-dev vite@^5.2.11 @vitejs/plugin-react@^4.3.1 --legacy-peer-deps`
        );
        buildLog += `✅ Vite installé en mode forcé\n`;
      } catch (forceError) {
        buildLog += `❌ Installation forcée échouée: ${forceError.message}\n`;
      }
    }

    await updateDeploymentLog(deploymentId, buildLog);

    // ==================== VÉRIFICATIONS MULTIPLES ====================
    buildLog += `🔍 Vérifications post-installation...\n`;

    // ✅ CHECK 1: node_modules existe?
    try {
      const nmCheck = await execCommand(
        `test -d ${deploymentDir}/node_modules && echo "EXISTS" || echo "MISSING"`
      );
      buildLog += `📁 node_modules: ${nmCheck.trim()}\n`;
    } catch {}

    // ✅ CHECK 2: Vite binary existe?
    try {
      const viteBinCheck = await execCommand(
        `test -f ${deploymentDir}/node_modules/.bin/vite && echo "EXISTS" || echo "MISSING"`
      );
      buildLog += `🔧 vite binary: ${viteBinCheck.trim()}\n`;

      if (viteBinCheck.trim() === "MISSING") {
        buildLog += `❌ VITE BINARY MANQUANT!\n`;

        // ✅ DERNIÈRE TENTATIVE: npx vite
        buildLog += `🔧 Tentative finale: npx vite install...\n`;
        try {
          await execCommand(
            `cd ${deploymentDir} && npx vite@^5.2.11 --version`
          );
          buildLog += `✅ npx vite fonctionnel\n`;
        } catch (npxError) {
          buildLog += `❌ npx vite échoué: ${npxError.message}\n`;
        }
      }
    } catch {}

    // ✅ CHECK 3: package vite existe?
    try {
      const viteCheck = await execCommand(
        `cd ${deploymentDir} && npm list vite`
      );
      buildLog += `📦 npm list vite:\n${viteCheck}\n`;
    } catch (listError) {
      buildLog += `⚠️ npm list vite échoué: ${listError.message}\n`;
    }

    // ✅ CHECK 4: Contenu node_modules/.bin/
    try {
      const binContents = await execCommand(
        `ls -la ${deploymentDir}/node_modules/.bin/ | head -20`
      );
      buildLog += `📂 Binaires disponibles:\n${binContents}\n`;
    } catch {}

    await updateDeploymentLog(deploymentId, buildLog);

    // ==================== BUILD (avec fallbacks) ====================
    buildLog += `🔨 Lancement du build...\n`;

    const buildCommands = [
      "npm run build",
      "npx vite build",
      "node_modules/.bin/vite build",
    ];

    let buildSuccess = false;
    let buildError = null;

    for (const cmd of buildCommands) {
      if (buildSuccess) break;

      buildLog += `🔧 Essai: ${cmd}\n`;
      try {
        const buildOutput = await execCommand(
          `cd ${deploymentDir} && ${cmd}`,
          { NODE_ENV: "production" },
          300000
        );
        buildLog += `✅ Build réussi avec: ${cmd}\n`;
        buildLog += `📊 Output:\n${buildOutput
          .split("\n")
          .slice(-20)
          .join("\n")}\n`;
        buildSuccess = true;
      } catch (error) {
        buildLog += `❌ Échec ${cmd}: ${error.message}\n`;
        buildError = error;
      }

      await updateDeploymentLog(deploymentId, buildLog);
    }

    if (!buildSuccess) {
      buildLog += `❌ Tous les builds ont échoué\n`;
      throw buildError;
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
