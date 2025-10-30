// backend/src/utils/universalFrameworkHandler.js - VERSION FINALE SANS CRÉATION CONFIG
const fs = require("fs").promises;
const path = require("path");

class UniversalFrameworkHandler {
  constructor() {
    this.supportedFrameworks = {
      nextjs: {
        dependencies: ["next", "react", "react-dom"],
        configFiles: ["next.config.js", "next.config.mjs"],
        buildCommands: ["npm run build"],
        detection: ["next", "Next.js", "import next", "from 'next"],
        config: {
          buildCommand: "npm run build",
          outputDir: "out",
          installCommand: "npm install",
          requiredDeps: ["next", "react", "react-dom"],
          env: { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
        },
      },

      vue: {
        dependencies: ["vue", "@vitejs/plugin-vue", "vite"],
        configFiles: ["vite.config.js", "vite.config.ts"],
        buildCommands: ["npm run build"],
        detection: ["vue", ".vue", "createApp", "Vue.createApp", "from 'vue'"],
        config: {
          buildCommand: "npm run build",
          outputDir: "dist",
          installCommand: "npm install",
          requiredDeps: ["vue", "vite", "@vitejs/plugin-vue"],
          env: { NODE_ENV: "production" },
        },
      },

      react: {
        dependencies: ["react", "react-dom", "@vitejs/plugin-react", "vite"],
        configFiles: ["vite.config.js", "vite.config.ts"],
        buildCommands: ["npm run build"],
        detection: [
          "react",
          "react-dom",
          "jsx",
          "React.",
          "import React",
          "from 'react'",
        ],
        config: {
          buildCommand: "npm run build",
          outputDir: "dist",
          installCommand: "npm install",
          requiredDeps: ["react", "react-dom", "vite", "@vitejs/plugin-react"],
          env: { NODE_ENV: "production" },
        },
      },

      tailwind: {
        dependencies: ["tailwindcss", "autoprefixer", "postcss"],
        configFiles: ["tailwind.config.js"],
        detection: ["@tailwind", "tailwindcss"],
      },
    };
  }

  async detectFrameworks(projectPath, buildLog = "") {
    const detectedFrameworks = new Set();
    const frameworkConfigs = [];

    try {
      buildLog += `🔍 Analyse du projet...\n`;

      const packageJsonPath = path.join(projectPath, "package.json");
      if (!(await this.fileExists(packageJsonPath))) {
        buildLog += `⚠️ Pas de package.json trouvé\n`;
        return { frameworks: [], configs: [], log: buildLog };
      }

      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf8")
      );
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
      const scripts = packageJson.scripts || {};

      buildLog += `📦 Analyse des dépendances package.json...\n`;

      let mainFramework = null;

      // Détecter Next.js
      if (allDeps["next"]) {
        if (
          scripts.build?.includes("next") ||
          scripts.start?.includes("next") ||
          scripts.dev?.includes("next")
        ) {
          mainFramework = "nextjs";
          buildLog += `🎯 Framework JS principal détecté: nextjs\n`;
        }
      }

      // Détecter Vue.js
      if (!mainFramework && allDeps["vue"]) {
        mainFramework = "vue";
        buildLog += `🎯 Framework JS principal détecté: vue\n`;
      }

      // Détecter React
      if (!mainFramework && allDeps["react"] && !allDeps["next"]) {
        mainFramework = "react";
        buildLog += `🎯 Framework JS principal détecté: react\n`;
      }

      if (mainFramework) {
        detectedFrameworks.add(mainFramework);
        frameworkConfigs.push({
          name: mainFramework,
          config: this.supportedFrameworks[mainFramework].config,
          confidence: 0.9,
        });
      }

      // Détecter Tailwind
      if (allDeps["tailwindcss"]) {
        detectedFrameworks.add("tailwind");
        buildLog += `🎨 Framework CSS/Animation détecté: tailwind\n`;
      }

      return {
        frameworks: Array.from(detectedFrameworks),
        configs: frameworkConfigs,
        log: buildLog,
      };
    } catch (error) {
      buildLog += `⚠️ Erreur détection frameworks: ${error.message}\n`;
      return { frameworks: [], configs: [], log: buildLog };
    }
  }

  async setupFrameworks(projectPath, frameworks, buildLog = "") {
    buildLog += `🛠️  Configuration des frameworks: ${frameworks.join(", ")}\n`;

    // ✅ CHANGEMENT : On vérifie seulement les dépendances, on ne crée PAS de configs
    const missingDeps = await this.checkMissingDependencies(
      projectPath,
      frameworks,
      buildLog
    );

    // On crée seulement les configs Tailwind si nécessaire (pas de conflit)
    if (frameworks.includes("tailwind")) {
      buildLog = await this.createTailwindConfigIfNeeded(projectPath, buildLog);
    }

    return { buildLog, missingDeps };
  }

  async checkMissingDependencies(projectPath, frameworks, buildLog) {
    const packageJsonPath = path.join(projectPath, "package.json");
    let packageJson = {};

    if (await this.fileExists(packageJsonPath)) {
      packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
    }

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    const missingDeps = [];

    // Vérifier les dépendances selon le framework
    for (const framework of frameworks) {
      const config = this.supportedFrameworks[framework];
      if (config?.dependencies) {
        for (const dep of config.dependencies) {
          if (!allDeps[dep]) {
            missingDeps.push(dep);
          }
        }
      }
    }

    if (missingDeps.length > 0) {
      buildLog += `⚠️ Dépendances manquantes détectées: ${missingDeps.join(
        ", "
      )}\n`;
      buildLog += `ℹ️  Ces dépendances seront installées lors du npm install\n`;
    } else {
      buildLog += `✅ Toutes les dépendances nécessaires sont présentes\n`;
    }

    return missingDeps;
  }

  async createTailwindConfigIfNeeded(projectPath, buildLog) {
    // Tailwind Config - Seulement si absent
    const tailwindConfigPath = path.join(projectPath, "tailwind.config.js");
    if (!(await this.fileExists(tailwindConfigPath))) {
      const config = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,vue}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;
      await fs.writeFile(tailwindConfigPath, config);
      buildLog += `⚙️ tailwind.config.js créé\n`;
    } else {
      buildLog += `✅ tailwind.config.js existe déjà\n`;
    }

    // PostCSS Config - Seulement si absent
    const postcssConfigPath = path.join(projectPath, "postcss.config.js");
    if (!(await this.fileExists(postcssConfigPath))) {
      const config = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`;
      await fs.writeFile(postcssConfigPath, config);
      buildLog += `⚙️ postcss.config.js créé\n`;
    } else {
      buildLog += `✅ postcss.config.js existe déjà\n`;
    }

    return buildLog;
  }

  async fileExists(filePath) {
    return fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);
  }
}

module.exports = UniversalFrameworkHandler;
