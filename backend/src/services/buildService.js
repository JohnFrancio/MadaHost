// backend/src/services/buildService.js
const { execSync, spawn } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const supabase = require("../config/supabase");
const { createHash } = require("crypto");

class BuildService {
  constructor() {
    this.buildsDir = path.join(__dirname, "../../builds");
    this.publicDir = path.join(__dirname, "../../public");
    this.tempDir = path.join(__dirname, "../../temp");

    this.initDirectories();
  }

  async initDirectories() {
    try {
      await fs.mkdir(this.buildsDir, { recursive: true });
      await fs.mkdir(this.publicDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error("❌ Erreur création dossiers:", error);
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
        "configuring",
        "Configuration du domaine..."
      );
      await this.configureNginx(project);

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
  async cloneRepository(project, deploymentId) {
    const buildPath = path.join(this.tempDir, `build-${deploymentId}`);

    try {
      // Récupérer le token GitHub de l'utilisateur
      const { data: user } = await supabase
        .from("users")
        .select("access_token")
        .eq("id", project.user_id)
        .single();

      if (!user?.access_token) {
        throw new Error("Token GitHub manquant");
      }

      const repoUrl = `https://${user.access_token}@github.com/${project.github_repo}.git`;

      // Cloner le repository
      const cloneCmd = `git clone --depth 1 -b ${project.branch} "${repoUrl}" "${buildPath}"`;

      console.log(`📂 Clonage: ${project.github_repo}@${project.branch}`);
      execSync(cloneCmd, { stdio: "pipe" });

      // Récupérer le hash du commit
      const commitHash = execSync("git rev-parse HEAD", {
        cwd: buildPath,
        encoding: "utf8",
      }).trim();

      // Sauvegarder le commit hash
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
      await fs.rmdir(outputPath, { recursive: true }).catch(() => {});
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
    const webPath = path.join(this.publicDir, project.name);

    try {
      // Nettoyer le dossier web
      await fs.rmdir(webPath, { recursive: true }).catch(() => {});

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
   * Configurer Nginx pour le nouveau site
   */
  async configureNginx(project) {
    const siteName = project.name;
    const domain = `${siteName}.madahost.me`;
    const webRoot = path.join(this.publicDir, siteName);

    // Configuration Nginx pour le site
    const nginxConfig = `server {
    listen 80;
    listen 443 ssl http2;
    server_name ${domain};

    # SSL Configuration (si certificat disponible)
    ssl_certificate /etc/ssl/certs/madahost.me.pem;
    ssl_certificate_key /etc/ssl/private/madahost.me.key;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # Document root
    root ${webRoot};
    index index.html index.htm;
    
    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Security
    location ~ /\\. {
        deny all;
    }
}`;

    const configPath = `/etc/nginx/sites-available/${siteName}`;
    const enabledPath = `/etc/nginx/sites-enabled/${siteName}`;

    try {
      // Écrire la configuration (nécessite les permissions)
      console.log(`⚙️  Configuration Nginx: ${domain}`);

      // En développement, juste logger la config
      if (process.env.NODE_ENV !== "production") {
        console.log("📝 Configuration Nginx (mode dev):");
        console.log(nginxConfig);
        return;
      }

      // En production, écrire vraiment les fichiers
      await fs.writeFile(configPath, nginxConfig);

      // Créer le lien symbolique
      try {
        await fs.unlink(enabledPath).catch(() => {});
        await fs.symlink(configPath, enabledPath);
      } catch (symlinkError) {
        console.warn(
          "⚠️  Impossible de créer le lien symbolique:",
          symlinkError.message
        );
      }

      // Tester et recharger Nginx
      try {
        execSync("nginx -t");
        execSync("systemctl reload nginx");
        console.log(`✅ Nginx configuré: ${domain}`);
      } catch (nginxError) {
        console.warn("⚠️  Impossible de recharger Nginx:", nginxError.message);
      }
    } catch (error) {
      console.warn("⚠️  Configuration Nginx échouée:", error.message);
      // Ne pas faire échouer le déploiement pour ça
    }
  }

  /**
   * Utilitaires
   */
  async executeCommand(command, cwd, env = {}) {
    return new Promise((resolve, reject) => {
      const childEnv = { ...process.env, ...env };

      const child = spawn("sh", ["-c", command], {
        cwd,
        env: childEnv,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
        console.log(`📋 ${data.toString().trim()}`);
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
        console.log(`⚠️  ${data.toString().trim()}`);
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(
            new Error(`Command failed with code ${code}: ${stderr || stdout}`)
          );
        }
      });

      child.on("error", (error) => {
        reject(new Error(`Execution error: ${error.message}`));
      });
    });
  }

  async copyDirectory(src, dest) {
    const copyCmd = `cp -r "${src}"/* "${dest}"/`;
    execSync(copyCmd);
  }

  async copyStaticFiles(src, dest) {
    // Copier les fichiers web courants
    const extensions = [
      "*.html",
      "*.css",
      "*.js",
      "*.png",
      "*.jpg",
      "*.gif",
      "*.ico",
      "*.svg",
    ];

    for (const ext of extensions) {
      try {
        const findCmd = `find "${src}" -name "${ext}" -exec cp {} "${dest}/" \\;`;
        execSync(findCmd);
      } catch {
        // Ignorer si pas de fichiers trouvés
      }
    }
  }

  async cleanup(buildPath) {
    try {
      await fs.rmdir(buildPath, { recursive: true });
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
