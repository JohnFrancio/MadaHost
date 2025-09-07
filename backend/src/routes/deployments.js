// backend/src/routes/deployments.js
const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const jwt = require("jsonwebtoken");
const { exec } = require("child_process");
const fs = require("fs").promises;
const path = require("path");

// Middleware d'authentification
const requireAuth = (req, res, next) => {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: "Token d'authentification requis" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token invalide" });
  }
};

// Route pour récupérer les déploiements d'un projet
router.get(
  "/projects/:projectId/deployments",
  requireAuth,
  async (req, res) => {
    try {
      const { data: deployments, error } = await supabase
        .from("deployments")
        .select("*")
        .eq("project_id", req.params.projectId)
        .order("started_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error(
          "Erreur lors de la récupération des déploiements:",
          error
        );
        return res
          .status(500)
          .json({ error: "Erreur lors de la récupération des déploiements" });
      }

      res.json(deployments);
    } catch (error) {
      console.error("Erreur:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// Route pour lancer un déploiement
router.post("/projects/:projectId/deploy", requireAuth, async (req, res) => {
  const projectId = req.params.projectId;

  try {
    // Vérifier que le projet appartient à l'utilisateur
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", req.user.userId)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: "Projet non trouvé" });
    }

    // Créer un nouveau déploiement
    const { data: deployment, error: deploymentError } = await supabase
      .from("deployments")
      .insert([
        {
          project_id: projectId,
          status: "pending",
        },
      ])
      .select()
      .single();

    if (deploymentError) {
      console.error(
        "Erreur lors de la création du déploiement:",
        deploymentError
      );
      return res
        .status(500)
        .json({ error: "Impossible de créer le déploiement" });
    }

    // Lancer le processus de déploiement en arrière-plan
    deployProject(deployment.id, project);

    res.json({
      id: deployment.id,
      status: "pending",
      message: "Déploiement lancé",
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
    await supabase
      .from("deployments")
      .update({
        status: "building",
        build_log: "Démarrage du processus de build...\n",
      })
      .eq("id", deploymentId);

    // Créer le dossier temporaire
    await fs.mkdir(deploymentDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    // Étape 1: Cloner le repository
    buildLog += `🔄 Clonage du repository ${project.github_repo}...\n`;
    await execCommand(
      `git clone https://github.com/${project.github_repo}.git ${deploymentDir}`,
      buildLog
    );

    // Changer vers la branche spécifiée
    if (project.branch !== "main" && project.branch !== "master") {
      buildLog += `🔄 Basculement vers la branche ${project.branch}...\n`;
      await execCommand(
        `cd ${deploymentDir} && git checkout ${project.branch}`,
        buildLog
      );
    }

    // Récupérer le hash du commit
    const commitHash = await execCommand(
      `cd ${deploymentDir} && git rev-parse HEAD`
    );

    // Mettre à jour avec le commit hash
    await supabase
      .from("deployments")
      .update({ commit_hash: commitHash.trim() })
      .eq("id", deploymentId);

    // Étape 2: Installer les dépendances
    buildLog += "📦 Installation des dépendances...\n";

    // Vérifier si package.json existe
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

      let installCommand = "npm install";
      if (pnpmLockExists) {
        installCommand = "pnpm install";
      } else if (yarnLockExists) {
        installCommand = "yarn install";
      }

      buildLog += `🔧 Commande d'installation: ${installCommand}\n`;
      await execCommand(`cd ${deploymentDir} && ${installCommand}`, buildLog);
    } catch (error) {
      buildLog += "⚠️ Pas de package.json trouvé, site statique détecté\n";
    }

    // Étape 3: Build du projet
    buildLog += `🏗️ Build du projet...\n`;
    buildLog += `🔧 Commande de build: ${project.build_command}\n`;

    try {
      await execCommand(
        `cd ${deploymentDir} && ${project.build_command}`,
        buildLog
      );
    } catch (buildError) {
      // Si la commande de build échoue, on continue avec les fichiers source
      buildLog += `⚠️ Build échoué, déploiement des fichiers source...\n`;
    }

    // Étape 4: Copier les fichiers vers le dossier public
    buildLog += `📁 Copie des fichiers depuis ${project.output_dir}...\n`;

    const sourceDir = path.join(deploymentDir, project.output_dir);
    try {
      await fs.access(sourceDir);
      await execCommand(`cp -r ${sourceDir}/* ${outputDir}/`, buildLog);
    } catch (error) {
      // Si le dossier de sortie n'existe pas, copier tous les fichiers HTML/CSS/JS
      buildLog += `⚠️ Dossier ${project.output_dir} non trouvé, copie des fichiers source...\n`;
      await execCommand(
        `find ${deploymentDir} -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.png" -o -name "*.jpg" -o -name "*.gif" | xargs cp -t ${outputDir}/`,
        buildLog
      );
    }

    // Générer un domaine temporaire si pas défini
    let domain = project.domain;
    if (!domain) {
      domain = `${project.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${
        project.id.split("-")[0]
      }.madahost.dev`;

      // Mettre à jour le domaine dans le projet
      await supabase
        .from("projects")
        .update({
          domain,
          status: "active",
          last_deployed: new Date().toISOString(),
        })
        .eq("id", project.id);
    }

    buildLog += `✅ Déploiement réussi!\n`;
    buildLog += `🌐 Site disponible sur: https://${domain}\n`;

    // Mettre à jour le déploiement comme réussi
    await supabase
      .from("deployments")
      .update({
        status: "success",
        build_log: buildLog,
        completed_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);

    // Nettoyer le dossier temporaire
    await execCommand(`rm -rf ${deploymentDir}`);
  } catch (error) {
    console.error("Erreur lors du déploiement:", error);
    buildLog += `❌ Erreur: ${error.message}\n`;

    // Marquer le déploiement comme échoué
    await supabase
      .from("deployments")
      .update({
        status: "failed",
        build_log: buildLog,
        completed_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);

    // Nettoyer le dossier temporaire même en cas d'erreur
    try {
      await execCommand(`rm -rf ${deploymentDir}`);
    } catch (cleanupError) {
      console.error("Erreur lors du nettoyage:", cleanupError);
    }
  }
}

// Fonction utilitaire pour exécuter des commandes shell
function execCommand(command, logPrefix = "") {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Erreur lors de l'exécution de: ${command}`, error);
        reject(
          new Error(`${error.message}\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`)
        );
        return;
      }

      if (stderr) {
        console.warn("STDERR:", stderr);
      }

      console.log("STDOUT:", stdout);
      resolve(stdout);
    });
  });
}

// Route pour récupérer les logs d'un déploiement spécifique
router.get("/deployments/:deploymentId/logs", requireAuth, async (req, res) => {
  try {
    const { data: deployment, error } = await supabase
      .from("deployments")
      .select("build_log, deploy_log")
      .eq("id", req.params.deploymentId)
      .single();

    if (error || !deployment) {
      return res.status(404).json({ error: "Déploiement non trouvé" });
    }

    res.json({
      buildLog: deployment.build_log || "",
      deployLog: deployment.deploy_log || "",
    });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
