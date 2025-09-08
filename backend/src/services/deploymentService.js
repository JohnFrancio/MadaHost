// backend/src/services/deploymentService.js
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs").promises;
const supabase = require("../config/supabase");

class DeploymentService {
  constructor() {
    this.baseDeployDir = path.join(process.cwd(), "deployments");
    this.basePublicDir = path.join(process.cwd(), "public", "sites");
  }

  async deployProject(deployment, project) {
    const deployId = deployment.id;
    const projectPath = path.join(this.baseDeployDir, deployId);
    const publicPath = path.join(this.basePublicDir, project.id);

    let buildLog = "";

    try {
      // Étape 1: Mise à jour statut
      await this.updateDeploymentStatus(
        deployId,
        "building",
        "Démarrage du build...\n"
      );

      // Étape 2: Préparation dossiers
      await fs.mkdir(projectPath, { recursive: true });
      await fs.mkdir(publicPath, { recursive: true });
      buildLog += "📁 Dossiers créés\n";

      // Étape 3: Clone du repo
      buildLog += `🔄 Clone de ${project.github_repo}...\n`;
      await this.execCommand(
        `git clone https://github.com/${project.github_repo}.git ${projectPath}`
      );

      // Étape 4: Checkout de la branche
      if (project.branch !== "main") {
        await this.execCommand(
          `cd ${projectPath} && git checkout ${project.branch}`
        );
      }
      buildLog += `🌿 Branche ${project.branch} active\n`;

      // Étape 5: Installation des dépendances
      if (project.install_command) {
        buildLog += `📦 Installation: ${project.install_command}\n`;
        await this.updateDeploymentStatus(deployId, "building", buildLog);
        await this.execCommand(
          `cd ${projectPath} && ${project.install_command}`
        );
        buildLog += "✅ Dépendances installées\n";
      }

      // Étape 6: Build
      if (project.build_command) {
        buildLog += `🏗️ Build: ${project.build_command}\n`;
        await this.updateDeploymentStatus(deployId, "building", buildLog);
        await this.execCommand(`cd ${projectPath} && ${project.build_command}`);
        buildLog += "✅ Build réussi\n";
      }

      // Étape 7: Copie vers public
      const sourcePath = path.join(projectPath, project.output_dir || "dist");
      await this.execCommand(`cp -r ${sourcePath}/* ${publicPath}/`);
      buildLog += "📋 Fichiers copiés vers le serveur\n";

      // Étape 8: Générer domaine si nécessaire
      let domain = project.domain;
      if (!domain) {
        domain = `${project.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${
          project.id.split("-")[0]
        }.madahost.dev`;

        // Mettre à jour le projet avec le domaine
        await supabase
          .from("projects")
          .update({
            domain,
            status: "active",
            last_deployed: new Date().toISOString(),
          })
          .eq("id", project.id);
      }

      buildLog += `🌐 Site déployé: https://${domain}\n`;

      // Succès final
      await this.updateDeploymentStatus(
        deployId,
        "success",
        buildLog,
        new Date().toISOString()
      );

      // Nettoyage
      await this.execCommand(`rm -rf ${projectPath}`);
      buildLog += "🧹 Nettoyage terminé\n";

      return {
        success: true,
        domain,
        deploymentId: deployId,
      };
    } catch (error) {
      console.error("❌ Erreur déploiement:", error);
      buildLog += `❌ ERREUR: ${error.message}\n`;

      await this.updateDeploymentStatus(
        deployId,
        "failed",
        buildLog,
        new Date().toISOString()
      );

      // Nettoyage en cas d'erreur
      try {
        await this.execCommand(`rm -rf ${projectPath}`);
      } catch (cleanupError) {
        console.error("Erreur nettoyage:", cleanupError);
      }

      throw error;
    }
  }

  async updateDeploymentStatus(
    deploymentId,
    status,
    buildLog,
    completedAt = null
  ) {
    const updateData = {
      status,
      build_log: buildLog,
    };

    if (completedAt) {
      updateData.completed_at = completedAt;
    }

    await supabase
      .from("deployments")
      .update(updateData)
      .eq("id", deploymentId);
  }

  execCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${error.message}\n${stderr}`));
          return;
        }
        resolve(stdout);
      });
    });
  }
}

module.exports = new DeploymentService();
