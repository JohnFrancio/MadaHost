// backend/src/services/buildService.js
const { execSync, spawn } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const supabase = require("../config/supabase");

class BuildService {
  constructor() {
    // ✅ Chemins cohérents avec le Dockerfile
    this.buildsDir = path.join(__dirname, "../../builds");
    this.publicDir = path.join(__dirname, "../../public");
    this.tempDir = path.join(__dirname, "../../temp");
    this.deployedDir = "/var/www/deployed"; // ✅ Dossier partagé avec Nginx

    this.initDirectories();
  }

  async initDirectories() {
    try {
      console.log("📁 Initialisation des dossiers...");

      await fs.mkdir(this.buildsDir, { recursive: true });
      console.log(`✅ Créé: ${this.buildsDir}`);

      await fs.mkdir(this.publicDir, { recursive: true });
      console.log(`✅ Créé: ${this.publicDir}`);

      await fs.mkdir(this.tempDir, { recursive: true });
      console.log(`✅ Créé: ${this.tempDir}`);

      await fs.mkdir(this.deployedDir, { recursive: true });
      console.log(`✅ Créé: ${this.deployedDir}`);

      console.log("✅ Tous les dossiers sont prêts");
    } catch (error) {
      console.error("❌ Erreur création dossiers:", error);
      throw error;
    }
  }

  /**
   * Déployer un projet complet
   */
  async deployProject(projectId) {
    const deploymentId = await this.createDeployment(projectId);

    try {
      const project = await this.getProject(projectId);

      console.log(`🚀 Démarrage déploiement: ${project.name}`);

      // Étapes de déploiement
      await this.updateDeploymentStatus(
        deploymentId,
        "cloning",
        "Clonage du repository..."
      );
      const buildPath = await this.cloneRepository(project, deploymentId);

      await this.updateDeploymentStatus(
        deploymentId,
        "building",
        "Construction du projet..."
      );
      const buildOutput = await this.buildProject(project, buildPath);

      await this.updateDeploymentStatus(
        deploymentId,
        "deploying",
        "Déploiement des fichiers..."
      );
      const deployUrl = await this.deployFiles(project, buildOutput);

      await this.updateDeploymentStatus(
        deploymentId,
        "success",
        "Déploiement réussi !"
      );

      // Nettoyer les fichiers temporaires
      await this.cleanup(buildPath);

      return {
        success: true,
        deploymentId,
        url: `https://${project.name}.madahost.me`,
        message: "Déploiement réussi",
      };
    } catch (error) {
      console.error("❌ Erreur déploiement:", error);
      await this.updateDeploymentStatus(
        deploymentId,
        "failed",
        `Erreur: ${error.message}`
      );

      return {
        success: false,
        deploymentId,
        error: error.message,
      };
    }
  }

  /**
   * Cloner le repository GitHub
   */
  // Dans buildService.js, méthode cloneRepository (ligne ~86)
  async cloneRepository(project, deploymentId) {
    const buildPath = path.join(this.tempDir, `build-${deploymentId}`);

    try {
      await fs.mkdir(this.tempDir, { recursive: true });

      // ✅ CORRECTION: Utiliser GITHUB_TOKEN depuis .env au lieu de la BDD
      const githubToken = process.env.GITHUB_TOKEN;
      const repoUrl = githubToken
        ? `https://${githubToken}@github.com/${project.github_repo}.git`
        : `https://github.com/${project.github_repo}.git`;

      const cloneCmd = `git clone --depth 1 -b ${
        project.branch || "main"
      } "${repoUrl}" "${buildPath}"`;

      console.log(
        `📂 Clonage: ${project.github_repo}@${project.branch || "main"}`
      );
      execSync(cloneCmd, { stdio: "pipe" });

      // Récupérer le hash du commit
      const commitHash = execSync("git rev-parse HEAD", {
        cwd: buildPath,
        encoding: "utf8",
      }).trim();

      await supabase
        .from("deployments")
        .update({ commit_hash: commitHash })
        .eq("id", deploymentId);

      console.log(`✅ Repository cloné: ${commitHash.substring(0, 8)}`);
      return buildPath;
    } catch (error) {
      console.error("❌ Erreur clonage:", error);
      throw new Error(`Impossible de cloner le repository: ${error.message}`);
    }
  }

  /**
   * Construire le projet
   */
  async buildProject(project, buildPath) {
    const outputPath = path.join(this.buildsDir, `${project.id}`);

    try {
      // Nettoyer le dossier de sortie
      await fs.rm(outputPath, { recursive: true, force: true });
      await fs.mkdir(outputPath, { recursive: true });

      console.log(
        `🔨 Construction avec: ${project.install_command || "npm install"}`
      );

      // Installation des dépendances
      if (project.install_command && project.install_command.trim()) {
        await this.executeCommand(project.install_command, buildPath);
      }

      // Build du projet
      if (project.build_command && project.build_command.trim()) {
        console.log(`🏗️  Build avec: ${project.build_command}`);
        await this.executeCommand(project.build_command, buildPath, {
          NODE_ENV: "production",
          PUBLIC_PATH: `https://${project.name}.madahost.me/`,
          ...JSON.parse(project.env_vars || "{}"),
        });
      }

      // Copier les fichiers buildés
      const sourcePath = path.join(buildPath, project.output_dir || "dist");

      // Vérifier si le dossier de sortie existe
      try {
        await fs.access(sourcePath);
        console.log(`📁 Copie depuis: ${sourcePath}`);
        await this.copyDirectory(sourcePath, outputPath);
      } catch {
        // Si pas de dossier de build, copier les fichiers statiques
        console.log("📄 Aucun dossier de build, copie des fichiers statiques");
        await this.copyStaticFiles(buildPath, outputPath);
      }

      // Créer un fichier .deployment avec les métadonnées
      const deploymentInfo = {
        projectId: project.id,
        projectName: project.name,
        deployedAt: new Date().toISOString(),
        framework: project.framework,
        branch: project.branch,
        buildCommand: project.build_command,
        domain: `${project.name}.madahost.me`,
      };

      await fs.writeFile(
        path.join(outputPath, ".deployment.json"),
        JSON.stringify(deploymentInfo, null, 2)
      );

      console.log(`✅ Build terminé: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error("❌ Erreur build:", error);
      throw new Error(`Build échoué: ${error.message}`);
    }
  }

  /**
   * Déployer les fichiers vers le serveur web
   */
  async deployFiles(project, buildOutput) {
    // ✅ Utiliser le dossier partagé avec Nginx
    const webPath = path.join(this.deployedDir, project.name);

    try {
      console.log(`📋 Déploiement vers: ${webPath}`);

      // Nettoyer le dossier web
      await fs.rm(webPath, { recursive: true, force: true });
      await fs.mkdir(webPath, { recursive: true });

      // Copier les fichiers buildés
      await this.copyDirectory(buildOutput, webPath);

      // Créer un fichier index.html si manquant (pour les SPAs)
      const indexPath = path.join(webPath, "index.html");
      try {
        await fs.access(indexPath);
      } catch {
        console.log("📝 Création index.html par défaut");
        const defaultIndex = `<!DOCTYPE html>
<html>
<head>
  <title>${project.name} - MadaHost</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <h1>${project.name}</h1>
  <p>Site déployé avec succès sur MadaHost!</p>
  <p>Framework: ${project.framework || "Non spécifié"}</p>
</body>
</html>`;
        await fs.writeFile(indexPath, defaultIndex);
      }

      // Mettre à jour le projet avec le domaine
      const domain = `${project.name}.madahost.me`;
      await supabase
        .from("projects")
        .update({
          domain,
          status: "active",
          last_deployed: new Date().toISOString(),
        })
        .eq("id", project.id);

      console.log(`✅ Fichiers déployés: https://${domain}`);
      return `https://${domain}`;
    } catch (error) {
      console.error("❌ Erreur déploiement fichiers:", error);
      throw new Error(`Impossible de déployer: ${error.message}`);
    }
  }

  /**
   * Utilitaires
   */
  // buildService.js - Méthode executeCommand (ligne ~300)

  // buildService.js - Méthode executeCommand corrigée
  async executeCommand(command, cwd, env = {}) {
    return new Promise((resolve, reject) => {
      // ✅ CORRECTION: Chemin absolu pour node_modules/.bin
      const nodeBinPath = path.join(cwd, "node_modules", ".bin");
      const childEnv = {
        ...process.env,
        ...env,
        PATH: `${nodeBinPath}:${process.env.PATH}`,
        // ✅ Variables critiques pour npm
        npm_config_cache: "/tmp/npm_cache",
        NODE_ENV: env.NODE_ENV || "production",
      };

      console.log(`🔧 Exécution: ${command}`);
      console.log(`📁 CWD: ${cwd}`);
      console.log(`🔧 PATH: ${childEnv.PATH}`);

      const child = spawn("sh", ["-c", command], {
        cwd,
        env: childEnv,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        const output = data.toString();
        stdout += output;
        console.log(`📋 ${output.trim()}`);
      });

      child.stderr.on("data", (data) => {
        const output = data.toString();
        stderr += output;
        console.log(`⚠️  ${output.trim()}`);
      });

      child.on("close", (code) => {
        if (code === 0) {
          console.log(`✅ Commande réussie: ${command}`);
          resolve({ stdout, stderr });
        } else {
          console.error(`❌ Commande échouée (${code}): ${command}`);
          console.error(`📋 Stderr: ${stderr}`);
          reject(
            new Error(`Command failed with code ${code}: ${stderr || stdout}`)
          );
        }
      });

      child.on("error", (error) => {
        console.error(`💥 Erreur execution: ${error.message}`);
        reject(new Error(`Execution error: ${error.message}`));
      });

      // Timeout de sécurité
      setTimeout(() => {
        if (child.exitCode === null) {
          child.kill();
          reject(new Error(`Command timeout: ${command}`));
        }
      }, 600000); // 10 minutes
    });
  }

  async copyDirectory(src, dest) {
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  async copyStaticFiles(src, dest) {
    const extensions = [
      ".html",
      ".css",
      ".js",
      ".png",
      ".jpg",
      ".gif",
      ".ico",
      ".svg",
    ];

    const copyRecursive = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await copyRecursive(srcPath);
        } else {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            const relativePath = path.relative(src, srcPath);
            const destPath = path.join(dest, relativePath);
            await fs.mkdir(path.dirname(destPath), { recursive: true });
            await fs.copyFile(srcPath, destPath);
          }
        }
      }
    };

    await copyRecursive(src);
  }

  async cleanup(buildPath) {
    try {
      await fs.rm(buildPath, { recursive: true, force: true });
      console.log(`🧹 Nettoyage: ${buildPath}`);
    } catch (error) {
      console.warn("⚠️  Nettoyage échoué:", error.message);
    }
  }

  // Méthodes de base de données
  async createDeployment(projectId) {
    const { data, error } = await supabase
      .from("deployments")
      .insert({
        project_id: projectId,
        status: "pending",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error)
      throw new Error(`Impossible de créer le déploiement: ${error.message}`);
    return data.id;
  }

  async getProject(projectId) {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (error) throw new Error(`Projet non trouvé: ${error.message}`);
    return data;
  }

  async updateDeploymentStatus(deploymentId, status, buildLog = "") {
    const updateData = {
      status,
      build_log: buildLog,
    };

    if (status === "success" || status === "failed") {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("deployments")
      .update(updateData)
      .eq("id", deploymentId);

    if (error) {
      console.error("❌ Erreur mise à jour déploiement:", error);
    } else {
      console.log(`📊 Status: ${status} - ${buildLog}`);
    }
  }
}

module.exports = BuildService;
