// backend/src/utils/universalFrameworkHandler.js - VERSION CORRIGÉE
const fs = require("fs").promises;
const path = require("path");

class UniversalFrameworkHandler {
  constructor() {
    this.supportedFrameworks = {
      // Frameworks JS - ORDRE DE PRIORITÉ IMPORTANT
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
        dependencies: ["vue", "@vitejs/plugin-vue", "vite", "terser"],
        configFiles: ["vite.config.js", "vite.config.ts"],
        buildCommands: ["npm run build"],
        detection: ["vue", ".vue", "createApp", "Vue.createApp", "from 'vue'"],
        config: {
          buildCommand: "npm run build",
          outputDir: "dist",
          installCommand: "npm install",
          requiredDeps: ["vue", "vite", "@vitejs/plugin-vue", "terser"],
          env: { NODE_ENV: "production" },
        },
      },

      react: {
        dependencies: [
          "react",
          "react-dom",
          "@vitejs/plugin-react",
          "vite",
          "terser",
        ],
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
          requiredDeps: [
            "react",
            "react-dom",
            "vite",
            "@vitejs/plugin-react",
            "terser",
          ],
          env: { NODE_ENV: "production" },
        },
      },

      // CSS Frameworks
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

      // ✅ CORRECTION : Détecter le framework RÉEL
      let mainFramework = null;

      // 1. Vérifier Next.js (doit avoir "next" ET les scripts Next.js)
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

      // 2. Vérifier Vue.js
      if (!mainFramework && allDeps["vue"]) {
        mainFramework = "vue";
        buildLog += `🎯 Framework JS principal détecté: vue\n`;
      }

      // 3. Vérifier React (MAIS PAS si Next.js est détecté)
      if (!mainFramework && allDeps["react"] && !allDeps["next"]) {
        mainFramework = "react";
        buildLog += `🎯 Framework JS principal détecté: react\n`;
      }

      // Ajouter le framework détecté
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

    // Installer les dépendances manquantes
    const missingDeps = await this.installMissingDependencies(
      projectPath,
      frameworks,
      buildLog
    );

    // Créer les fichiers de configuration
    buildLog = await this.createConfigFiles(projectPath, frameworks, buildLog);

    return { buildLog, missingDeps };
  }

  async installMissingDependencies(projectPath, frameworks, buildLog) {
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
      if (!packageJson.devDependencies) packageJson.devDependencies = {};

      const latestVersions = {
        tailwindcss: "^3.3.0",
        autoprefixer: "^10.4.0",
        postcss: "^8.4.0",
        terser: "^5.19.0",
        vue: "^3.3.4",
        "@vitejs/plugin-vue": "^4.4.0",
        react: "^18.2.0",
        "react-dom": "^18.2.0",
        "@vitejs/plugin-react": "^4.1.0",
        vite: "^4.4.9",
        next: "^14.0.0",
      };

      for (const dep of missingDeps) {
        packageJson.devDependencies[dep] = latestVersions[dep] || "latest";
      }

      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }

    return missingDeps;
  }

  async createConfigFiles(projectPath, frameworks, buildLog) {
    // Tailwind Config
    if (frameworks.includes("tailwind")) {
      buildLog = await this.createTailwindConfig(projectPath, buildLog);
      buildLog = await this.createPostCSSConfig(projectPath, buildLog);
    }

    // Vite Config pour React/Vue
    if (frameworks.includes("react") || frameworks.includes("vue")) {
      buildLog = await this.createSmartViteConfig(
        projectPath,
        frameworks,
        buildLog
      );
    }

    return buildLog;
  }

  async createTailwindConfig(projectPath, buildLog) {
    const configPath = path.join(projectPath, "tailwind.config.js");
    if (!(await this.fileExists(configPath))) {
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
      await fs.writeFile(configPath, config);
      buildLog += `⚙️ tailwind.config.js créé\n`;
    }
    return buildLog;
  }

  async createPostCSSConfig(projectPath, buildLog) {
    const configPath = path.join(projectPath, "postcss.config.js");
    if (!(await this.fileExists(configPath))) {
      const config = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`;
      await fs.writeFile(configPath, config);
      buildLog += `⚙️ postcss.config.js créé\n`;
    }
    return buildLog;
  }

  async createSmartViteConfig(projectPath, frameworks, buildLog) {
    const configPath = path.join(projectPath, "vite.config.js");

    let pluginImports = [];
    let plugins = [];
    let outputDir = "dist";

    if (frameworks.includes("vue")) {
      pluginImports.push("import vue from '@vitejs/plugin-vue'");
      plugins.push("vue()");
    } else if (frameworks.includes("react")) {
      pluginImports.push("import react from '@vitejs/plugin-react'");
      plugins.push("react()");
      outputDir = "dist"; // React avec Vite utilise "dist"
    }

    const config = `import { defineConfig } from 'vite'
${pluginImports.join("\n")}

export default defineConfig({
  plugins: [${plugins.join(", ")}],
  base: './',
  build: {
    outDir: '${outputDir}',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      }
    }
  }
})`;

    await fs.writeFile(configPath, config);
    buildLog += `⚙️ Configuration Vite optimisée créée pour ${frameworks.join(
      ", "
    )}\n`;

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
