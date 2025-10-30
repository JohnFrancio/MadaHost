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
      // Dans la détection des frameworks - AJOUTER cette vérification
      if (
        primaryFramework?.name === "react" ||
        primaryFramework?.name === "vue"
      ) {
        try {
          const packageJsonPath = path.join(deploymentDir, "package.json");
          const packageJson = JSON.parse(
            await fs.readFile(packageJsonPath, "utf8")
          );
          const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
          };

          // ✅ VÉRIFIER LA VERSION DE VITE
          if (allDeps.vite) {
            buildLog += `⚡ Vite détecté: ${allDeps.vite}\n`;

            // ✅ S'ASSURER QUE LES PLUGINS SONT COMPATIBLES
            if (primaryFramework.name === "react") {
              if (!allDeps["@vitejs/plugin-react"]) {
                buildLog += `➕ Installation de @vitejs/plugin-react...\n`;
                await execCommand(
                  "npm install @vitejs/plugin-react@^4.0.0 --save-dev --force",
                  {},
                  120000,
                  deploymentDir,
                  deploymentDir
                );
              }

              // ✅ CRÉER/CORRIGER LA CONFIG VITE SI NÉCESSAIRE
              const viteConfigPath = path.join(deploymentDir, "vite.config.js");
              try {
                await fs.access(viteConfigPath);
                buildLog += `✅ vite.config.js présent\n`;
              } catch {
                buildLog += `📝 Création de vite.config.js...\n`;
                const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})`;
                await fs.writeFile(viteConfigPath, viteConfig);
              }
            }
          }
        } catch (error) {
          buildLog += `⚠️ Erreur configuration Vite: ${error.message}\n`;
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

      // ✅ UTILISER NODE DIRECTEMENT POUR ÉVITER NPM
      try {
        // Lire package.json
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        };

        buildLog += `🔧 Installation avec Node.js direct...\n`;

        // Créer un script d'installation minimal
        const installScript = `
          const { execSync } = require('child_process');
          const fs = require('fs');
          
          console.log('📦 Installation des dépendances...');
          
          // Créer node_modules si nécessaire
          if (!fs.existsSync('node_modules')) {
            fs.mkdirSync('node_modules', { recursive: true });
          }
          
          // Installer les dépendances critiques une par une
          const deps = ${JSON.stringify(allDeps)};
          const criticalDeps = ['vite', 'react', 'react-dom', '@vitejs/plugin-react'];
          
          for (const dep of criticalDeps) {
            if (deps[dep]) {
              console.log('📦 Installing ' + dep);
              try {
                execSync('node -e "\\\\\\"require(\\\\\\\\\\\\\"child_process\\\\\\\\\\\\\").execSync(\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\`npm install ${dep}@${deps[dep]} --no-save\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\`, {stdio: \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\'inherit\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\'})\\\\\\\""', { 
                  stdio: 'inherit',
                  shell: true 
                });
              } catch (e) {
                console.log('⚠️ Failed to install ' + dep + ', trying alternative method');
                // Méthode alternative
                execSync('curl -s https://registry.npmjs.org/${dep} | node -e "\\\\\\"const data = JSON.parse(require(\\\\\\\\\\\\\"fs\\\\\\\\\\\\\").readFileSync(0, \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\'utf8\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\')); console.log(data.versions[\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\'${deps[dep].replace(/^\\^/, \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\'\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\')}\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\'].dist.tarball)\\\\\\\"" | xargs curl -s | tar -xz', {
                  stdio: 'inherit',
                  shell: true
                });
              }
            }kageJsonPath = path.join(deploymentDir, "package.json");
    try {
      await fs.access(packageJsonPath);

      buildLog += `📦 [${new Date().toISOString()}] Installation des dépendances...\n`;

      // ✅ UTILISER NODE DIRECTEMENT POUR ÉVITER NPM
      try {
        // Lire package.json
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        };

        buildLog += `🔧 Installation avec Node.js direct...\n`;

        // Créer un script d'installation minimal
        const installScript = `
          const { execSync } = require('child_process');
          const fs = require('fs');
          
          console.log('📦 Installation des dépendances...');
          
          // Créer node_modules si nécessaire
          if (!fs.existsSync('node_modules')) {
            fs.mkdirSync('node_modules', { recursive: true });
          }
          
          // Installer les dépendances critiques une par une
          const deps = ${JSON.stringify(allDeps)};
          const criticalDeps = ['vite', 'react', 'react-dom', '@vitejs/plugin-react'];
          
          for (const dep of criticalDeps) {
            if (deps[dep]) {
              console.log('📦 Installing ' + dep);
              try {
                execSync('node -e "\\\\\\"require(\\\\\\\\\\\\\"child_process\\\\\\\\\\\\\").execSync(\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\`npm install ${dep}@${deps[dep]} --no-save\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\`, {stdio: \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\'inherit\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\'})\\\\\\\""', { 
                  stdio: 'inherit',
                  shell: true 
                });
              } catch (e) {
                console.log('⚠️ Failed to install ' + dep + ', trying alternative method');
                // Méthode alternative
                execSync('curl -s https://registry.npmjs.org/${dep} | node -e "\\\\\\"const data = JSON.parse(require(\\\\\\\\\\\\\"fs\\\\\\\\\\\\\").readFileSync(0, \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\'utf8\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\')); console.log(data.versions[\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\'${deps[dep].replace(/^\\^/, \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\'\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\')}\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\'].dist.tarball)\\\\\\\"" | xargs curl -s | tar -xz', {
                  stdio: 'inherit',
                  shell: true
                });
              }
            }
          }
          
          console.log('✅ Installation terminée');
        `;

        // Écrire et exécuter le script
        const scriptPath = path.join(deploymentDir, 'install.js');
        await fs.writeFile(scriptPath, installScript);
        
        await execCommand(
          `node install.js`,
          {},
          300000,
          deploymentDir,
          deploymentDir
        );
        
        buildLog += `✅ Dépendances installées avec Node.js\n`;

      } catch (installError) {
        buildLog += `❌ Installation échouée: ${installError.message}\n`;
        throw installError;
      }

      await updateDeploymentLog(deploymentId, buildLog);
    } catch (error) {
      buildLog += `❌ Erreur installation: ${error.message}\n`;
      await updateDeploymentLog(deploymentId, buildLog);
      throw error;
    }
          }
          
          console.log('✅ Installation terminée');
        `;

        // Écrire et exécuter le script
        const scriptPath = path.join(deploymentDir, 'install.js');
        await fs.writeFile(scriptPath, installScript);
        
        await execCommand(
          `node install.js`,
          {},
          300000,
          deploymentDir,
          deploymentDir
        );
        
        buildLog += `✅ Dépendances installées avec Node.js\n`;

      } catch (installError) {
        buildLog += `❌ Installation échouée: ${installError.message}\n`;
        throw installError;
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
        // ✅ NETTOYAGE DU CACHE VITE AVANT BUILD
        buildLog += `🧹 Nettoyage du cache Vite...\n`;
        await updateDeploymentLog(deploymentId, buildLog);

        try {
          await execCommand(
            "rm -rf node_modules/.vite*",
            {},
            30000,
            deploymentDir,
            deploymentDir
          );
        } catch (cleanError) {
          // Ignorer si le cache n'existe pas
        }

        // ✅ BUILD AVEC VARIABLES D'ENVIRONNEMENT CRITIQUES
        const buildEnv = {
          NODE_ENV: "production",
          CI: "true",
          GENERATE_SOURCEMAP: "false",
          // ✅ FORCER LA RÉSOLUTION DES MODULES
          NODE_OPTIONS: "--preserve-symlinks --preserve-symlinks-main",
          // ✅ VARIABLES NPM CRITIQUES
          npm_config_platform: "linux",
          npm_config_arch: "x64",
          // ✅ CHEMIN ABSOLU POUR NODE_MODULES
          NODE_PATH: path.join(deploymentDir, "node_modules"),
        };

        let buildSuccessful = false;
        let finalError = null;

        // Essai 1: Build standard avec environnement corrigé
        try {
          buildLog += `🔄 Tentative de build standard...\n`;
          await updateDeploymentLog(deploymentId, buildLog);

          const buildOutput = await execCommand(
            finalBuildCommand,
            buildEnv,
            600000,
            deploymentDir,
            deploymentDir
          );
          buildLog += `✅ Build réussi!\n`;
          buildSuccessful = true;
        } catch (error1) {
          finalError = error1;
          buildLog += `❌ Build standard échoué: ${error1.message}\n`;

          // Essai 2: Utiliser npx avec cache désactivé
          try {
            buildLog += `🔄 Tentative avec npx et cache désactivé...\n`;
            await updateDeploymentLog(deploymentId, buildLog);

            const npxCommand = finalBuildCommand.replace(
              "vite build",
              "npx --no-install vite build --force"
            );
            const npxOutput = await execCommand(
              npxCommand,
              {
                ...buildEnv,
                // ✅ DÉSACTIVER LE CACHE VITE
                VITE_CACHE_DIR: "/tmp/vite-cache",
              },
              600000,
              deploymentDir,
              deploymentDir
            );
            buildLog += `✅ Build réussi avec npx!\n`;
            buildSuccessful = true;
          } catch (error2) {
            buildLog += `❌ npx échoué: ${error2.message}\n`;

            // Essai 3: Build manuel avec chemin direct
            try {
              buildLog += `🔄 Tentative avec build manuel...\n`;
              await updateDeploymentLog(deploymentId, buildLog);

              // Lire la config Vite pour comprendre la structure
              const packageJsonPath = path.join(deploymentDir, "package.json");
              const packageJson = JSON.parse(
                await fs.readFile(packageJsonPath, "utf8")
              );
              const buildScript = packageJson.scripts?.build;

              if (buildScript && buildScript.includes("vite")) {
                // Utiliser le binaire Vite directement
                const directBuild = await execCommand(
                  "./node_modules/.bin/vite build --force",
                  buildEnv,
                  600000,
                  deploymentDir,
                  deploymentDir
                );
                buildLog += `✅ Build réussi avec binaire direct!\n`;
                buildSuccessful = true;
              }
            } catch (error3) {
              buildLog += `❌ Build manuel échoué: ${error3.message}\n`;
            }
          }
        }

        if (!buildSuccessful) {
          throw (
            finalError || new Error("Toutes les méthodes de build ont échoué")
          );
        }
      } catch (buildError) {
        buildLog += `❌ Erreur build finale: ${buildError.message}\n`;

        // ✅ DEBUG AVANCÉ
        try {
          buildLog += `🔍 Debug: Vérification de l'installation...\n`;
          const debugInfo = await execCommand(
            "npm list vite && ls -la node_modules/.bin/vite && pwd && ls -la",
            {},
            30000,
            deploymentDir,
            deploymentDir
          );
          buildLog += `📋 Debug info: ${debugInfo}\n`;
        } catch (debugError) {
          buildLog += `❌ Debug échoué: ${debugError.message}\n`;
        }

        throw buildError;
      }
    } else {
      buildLog += `ℹ️ Aucune commande de build spécifiée\n`;
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
// deployments.js - REMPLACEZ complètement la fonction execCommand
function execCommand(
  command,
  envVars = {},
  timeout = 300000,
  cwd = null,
  deploymentDir = null
) {
  return new Promise((resolve, reject) => {
    try {
      // ✅ DÉTERMINATION DU RÉPERTOIRE
      const currentDir = cwd || deploymentDir || process.cwd();

      if (!currentDir) {
        return reject(new Error("Aucun répertoire de travail spécifié"));
      }

      // ✅ CHEMIN ABSOLU pour node_modules/.bin
      const nodeBinPath = path.join(currentDir, "node_modules", ".bin");

      // ✅ PATH CORRIGÉ: Utiliser le chemin absolu du système
      const customPath = `${nodeBinPath}:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin`;

      // ✅ VÉRIFIER SI VITE EXISTE DANS node_modules/.bin
      const viteBinaryPath = path.join(nodeBinPath, "vite");

      console.log(`🔧 Exécution: ${command}`);
      console.log(`📁 CWD: ${currentDir}`);
      console.log(`🔧 PATH: ${customPath}`);
      console.log(`🔍 Vite binary path: ${viteBinaryPath}`);

      const options = {
        timeout,
        cwd: currentDir,
        env: {
          ...process.env,
          ...envVars,
          PATH: customPath, // ✅ PATH personnalisé
          NODE_ENV: "production",
          // ✅ Variables npm critiques
          npm_config_platform: "linux",
          npm_config_arch: "x64",
        },
        maxBuffer: 10 * 1024 * 1024,
      };

      // ✅ VÉRIFICATION PRÉALABLE (debug)
      fs.access(viteBinaryPath)
        .then(() => console.log(`✅ Vite binary existe: ${viteBinaryPath}`))
        .catch(() => console.log(`❌ Vite binary manquant: ${viteBinaryPath}`));

      exec(command, options, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ Erreur commande: ${command}`);
          console.error(`📋 Stdout: ${stdout}`);
          console.error(`📋 Stderr: ${stderr}`);

          // ✅ DEBUG: Lister le contenu de node_modules/.bin
          const debugCommand = `ls -la ${nodeBinPath} | head -10`;
          exec(
            debugCommand,
            { cwd: currentDir },
            (debugError, debugStdout, debugStderr) => {
              console.log(`🔍 Contenu de node_modules/.bin:`);
              console.log(debugStdout || debugStderr || "Aucun contenu");
            }
          );

          const errorMessage = `Command: ${command}\nError: ${error.message}\nStdout: ${stdout}\nStderr: ${stderr}`;
          reject(new Error(errorMessage));
          return;
        }

        if (stdout) console.log(`📋 Output: ${stdout}`);
        if (stderr && !stderr.includes("warning"))
          console.log(`⚠️ Warnings: ${stderr}`);

        resolve(stdout);
      });
    } catch (setupError) {
      reject(new Error(`Erreur configuration commande: ${setupError.message}`));
    }
  });
}

// deployments.js - AJOUTEZ cette route
router.get("/debug/vite-check/:deploymentId", requireAuth, async (req, res) => {
  try {
    const deploymentDir = path.join(
      __dirname,
      "../../temp",
      req.params.deploymentId
    );

    const checks = {
      deploymentDir: {
        path: deploymentDir,
        exists: await fs
          .access(deploymentDir)
          .then(() => true)
          .catch(() => false),
      },
      nodeModules: {
        path: path.join(deploymentDir, "node_modules"),
        exists: await fs
          .access(path.join(deploymentDir, "node_modules"))
          .then(() => true)
          .catch(() => false),
      },
      vite: {
        package: await fs
          .access(path.join(deploymentDir, "node_modules", "vite"))
          .then(() => true)
          .catch(() => false),
        binary: await fs
          .access(path.join(deploymentDir, "node_modules", ".bin", "vite"))
          .then(() => true)
          .catch(() => false),
        packageJson: await fs
          .readFile(
            path.join(deploymentDir, "node_modules", "vite", "package.json"),
            "utf8"
          )
          .then(JSON.parse)
          .then((pkg) => ({ version: pkg.version }))
          .catch((e) => null),
      },
      binContents: await execCommand(
        "ls -la",
        {},
        30000,
        path.join(deploymentDir, "node_modules", ".bin"),
        deploymentDir
      )
        .then((output) => output)
        .catch((e) => e.message),
      pathTest: await execCommand(
        "echo $PATH",
        {},
        30000,
        deploymentDir,
        deploymentDir
      )
        .then((output) => output.trim())
        .catch((e) => e.message),
      whichVite: await execCommand(
        'which vite || echo "not found"',
        {},
        30000,
        deploymentDir,
        deploymentDir
      )
        .then((output) => output.trim())
        .catch((e) => e.message),
    };

    res.json(checks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;
