// backend/src/utils/universalFrameworkHandler.js - VERSION CORRIGÉE
const fs = require("fs").promises;
const path = require("path");

class UniversalFrameworkHandler {
  constructor() {
    this.supportedFrameworks = {
      // CSS Frameworks
      tailwind: {
        dependencies: ["tailwindcss", "autoprefixer", "postcss"],
        configFiles: ["tailwind.config.js", "postcss.config.js"],
        buildCommands: ["npx tailwindcss build"],
        detection: ["@tailwind", "tailwindcss"],
      },
      bootstrap: {
        dependencies: ["bootstrap", "sass"],
        configFiles: [],
        buildCommands: [],
        detection: ["bootstrap", '@import "bootstrap"'],
      },
      bulma: {
        dependencies: ["bulma", "sass"],
        configFiles: [],
        buildCommands: [],
        detection: ["bulma", '@import "bulma"'],
      },
      // Animation Libraries
      aos: {
        dependencies: ["aos"],
        configFiles: [],
        buildCommands: [],
        detection: ["data-aos", "AOS.init", "import AOS"],
      },
      framerMotion: {
        dependencies: ["framer-motion"],
        configFiles: [],
        buildCommands: [],
        detection: ["framer-motion", "motion.", "AnimatePresence"],
      },
      gsap: {
        dependencies: ["gsap"],
        configFiles: [],
        buildCommands: [],
        detection: ["gsap", "TweenMax", "TimelineMax"],
      },
    };
  }

  async detectFrameworks(projectPath, buildLog = "") {
    const detectedFrameworks = new Set();

    try {
      // 1. Vérifier package.json
      const packageJsonPath = path.join(projectPath, "package.json");
      if (await this.fileExists(packageJsonPath)) {
        const packageJson = JSON.parse(
          await fs.readFile(packageJsonPath, "utf8")
        );
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        for (const [framework, config] of Object.entries(
          this.supportedFrameworks
        )) {
          if (config.dependencies.some((dep) => allDeps[dep])) {
            detectedFrameworks.add(framework);
            buildLog += `📦 ${framework} détecté dans package.json\n`;
          }
        }
      }

      // 2. Scanner les fichiers source pour détecter l'utilisation
      await this.scanSourceFiles(projectPath, detectedFrameworks, buildLog);

      return { frameworks: Array.from(detectedFrameworks), log: buildLog };
    } catch (error) {
      buildLog += `⚠️ Erreur détection frameworks: ${error.message}\n`;
      return { frameworks: [], log: buildLog };
    }
  }

  async scanSourceFiles(projectPath, detectedFrameworks, buildLog) {
    const extensions = [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".vue",
      ".css",
      ".scss",
      ".sass",
      ".less",
    ];
    const folders = ["src", "components", "pages", "styles"];

    for (const folder of folders) {
      const folderPath = path.join(projectPath, folder);
      if (await this.fileExists(folderPath)) {
        await this.scanFolder(
          folderPath,
          extensions,
          detectedFrameworks,
          buildLog
        );
      }
    }

    // Scanner aussi les fichiers à la racine
    await this.scanFolder(
      projectPath,
      extensions,
      detectedFrameworks,
      buildLog,
      false
    );
  }

  async scanFolder(
    folderPath,
    extensions,
    detectedFrameworks,
    buildLog,
    recursive = true
  ) {
    try {
      const files = await fs.readdir(folderPath, { withFileTypes: true });

      for (const file of files) {
        const fullPath = path.join(folderPath, file.name);

        if (
          file.isDirectory() &&
          recursive &&
          !file.name.startsWith(".") &&
          file.name !== "node_modules"
        ) {
          await this.scanFolder(
            fullPath,
            extensions,
            detectedFrameworks,
            buildLog,
            true
          );
        } else if (
          file.isFile() &&
          extensions.some((ext) => file.name.endsWith(ext))
        ) {
          await this.scanFile(fullPath, detectedFrameworks, buildLog);
        }
      }
    } catch (error) {
      // Dossier non accessible, on continue
    }
  }

  async scanFile(filePath, detectedFrameworks, buildLog) {
    try {
      const content = await fs.readFile(filePath, "utf8");

      for (const [framework, config] of Object.entries(
        this.supportedFrameworks
      )) {
        if (!detectedFrameworks.has(framework)) {
          if (config.detection.some((pattern) => content.includes(pattern))) {
            detectedFrameworks.add(framework);
            buildLog += `🔍 ${framework} détecté dans ${path.basename(
              filePath
            )}\n`;
          }
        }
      }
    } catch (error) {
      // Fichier non lisible, on continue
    }
  }

  async setupFrameworks(projectPath, frameworks, buildLog = "") {
    buildLog += `🛠️  Configuration des frameworks: ${frameworks.join(", ")}\n`;

    // 1. Installer les dépendances manquantes
    const missingDeps = await this.installMissingDependencies(
      projectPath,
      frameworks,
      buildLog
    );

    // 2. Créer les fichiers de configuration manquants
    buildLog = await this.createConfigFiles(projectPath, frameworks, buildLog);

    // 3. Configurer les builds spéciaux
    buildLog = await this.setupSpecialBuilds(projectPath, frameworks, buildLog);

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

    for (const framework of frameworks) {
      const config = this.supportedFrameworks[framework];
      if (config) {
        for (const dep of config.dependencies) {
          if (!allDeps[dep]) {
            missingDeps.push(dep);
          }
        }
      }
    }

    if (missingDeps.length > 0) {
      buildLog += `📥 Installation des dépendances manquantes: ${missingDeps.join(
        ", "
      )}\n`;

      // Ajouter à package.json
      if (!packageJson.devDependencies) packageJson.devDependencies = {};

      const latestVersions = {
        tailwindcss: "^3.3.0",
        autoprefixer: "^10.4.0",
        postcss: "^8.4.0",
        sass: "^1.66.0",
        aos: "^2.3.4",
        "framer-motion": "^10.16.0",
        gsap: "^3.12.0",
        bootstrap: "^5.3.0",
        bulma: "^0.9.4",
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

    // Vite Config pour tous les frameworks - VERSION CORRIGÉE
    buildLog = await this.createUniversalViteConfig(
      projectPath,
      frameworks,
      buildLog
    );

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
    "./components/**/*.{js,ts,jsx,tsx,vue}",
    "./pages/**/*.{js,ts,jsx,tsx,vue}",
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

  async createUniversalViteConfig(projectPath, frameworks, buildLog) {
    const configPath = path.join(projectPath, "vite.config.js");

    // CORRECTION : Génération correcte du fichier vite.config.js
    const frameworkPlugins = [];
    const cssPreprocessorOptions = {};
    const optimizeDepsIncludes = [];

    if (frameworks.includes("framerMotion")) {
      frameworkPlugins.push(`'framer-motion/babel'`);
    }

    if (frameworks.includes("bootstrap")) {
      cssPreprocessorOptions.scss = `additionalData: '@import "bootstrap/scss/bootstrap";'`;
    }

    if (frameworks.includes("aos")) {
      optimizeDepsIncludes.push('"aos"');
    }
    if (frameworks.includes("gsap")) {
      optimizeDepsIncludes.push('"gsap"');
    }
    if (frameworks.includes("framerMotion")) {
      optimizeDepsIncludes.push('"framer-motion"');
    }

    const config = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(${
      frameworkPlugins.length > 0
        ? `{
      babel: {
        plugins: [${frameworkPlugins.join(", ")}]
      }
    }`
        : ""
    })
  ],
  base: './',
  build: {
    assetsDir: 'assets',
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
        assetFileNames: 'assets/[name]-[hash].[ext]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  }${
    Object.keys(cssPreprocessorOptions).length > 0
      ? `,
  css: {
    preprocessorOptions: {
      ${Object.entries(cssPreprocessorOptions)
        .map(([key, value]) => `${key}: { ${value} }`)
        .join(",\n      ")}
    }
  }`
      : ""
  }${
      optimizeDepsIncludes.length > 0
        ? `,
  optimizeDeps: {
    include: [${optimizeDepsIncludes.join(", ")}]
  }`
        : ""
    },
  server: {
    hmr: false
  }
})`;

    await fs.writeFile(configPath, config);
    buildLog += `⚙️ vite.config.js universel créé avec frameworks: ${frameworks.join(
      ", "
    )}\n`;

    return buildLog;
  }

  async setupSpecialBuilds(projectPath, frameworks, buildLog) {
    // Pour AOS, s'assurer que les styles sont importés
    if (frameworks.includes("aos")) {
      buildLog = await this.ensureAOSStyles(projectPath, buildLog);
    }

    // Pour Bootstrap/Bulma, s'assurer des imports
    if (frameworks.includes("bootstrap") || frameworks.includes("bulma")) {
      buildLog = await this.ensureCSSFrameworkImports(
        projectPath,
        frameworks,
        buildLog
      );
    }

    return buildLog;
  }

  async ensureAOSStyles(projectPath, buildLog) {
    const possibleCSSFiles = [
      "src/index.css",
      "src/main.css",
      "src/App.css",
      "src/styles/index.css",
    ];

    for (const cssFile of possibleCSSFiles) {
      const cssPath = path.join(projectPath, cssFile);
      if (await this.fileExists(cssPath)) {
        let content = await fs.readFile(cssPath, "utf8");

        if (!content.includes("aos/dist/aos.css")) {
          content = `@import 'aos/dist/aos.css';\n${content}`;
          await fs.writeFile(cssPath, content);
          buildLog += `🎨 Import AOS CSS ajouté à ${cssFile}\n`;
        }
        break;
      }
    }

    return buildLog;
  }

  async ensureCSSFrameworkImports(projectPath, frameworks, buildLog) {
    const possibleCSSFiles = ["src/index.css", "src/main.css", "src/App.css"];

    for (const cssFile of possibleCSSFiles) {
      const cssPath = path.join(projectPath, cssFile);
      if (await this.fileExists(cssPath)) {
        let content = await fs.readFile(cssPath, "utf8");
        let modified = false;

        if (
          frameworks.includes("bootstrap") &&
          !content.includes("bootstrap")
        ) {
          content = `@import 'bootstrap/dist/css/bootstrap.min.css';\n${content}`;
          modified = true;
          buildLog += `🅱️ Import Bootstrap ajouté\n`;
        }

        if (frameworks.includes("bulma") && !content.includes("bulma")) {
          content = `@import 'bulma/css/bulma.css';\n${content}`;
          modified = true;
          buildLog += `🔷 Import Bulma ajouté\n`;
        }

        if (modified) {
          await fs.writeFile(cssPath, content);
        }
        break;
      }
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
