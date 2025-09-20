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
      vue: {
        dependencies: ["vue", "@vitejs/plugin-vue", "vite", "terser"],
        configFiles: ["vite.config.js"],
        buildCommands: ["npm run build"],
        detection: ["vue", ".vue", "createApp", "Vue.createApp"],
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
        configFiles: ["vite.config.js"],
        buildCommands: ["npm run build"],
        detection: ["react", "react-dom", "jsx", "React.", "import React"],
        config: {
          buildCommand: "npm run build",
          outputDir: "build",
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

      nextjs: {
        dependencies: ["next", "react", "react-dom"],
        configFiles: ["next.config.js"],
        buildCommands: ["npm run build", "npm run export"],
        detection: ["next", "Next.js", "import next"],
        config: {
          buildCommand: "npm run build && npm run export",
          outputDir: "out",
          installCommand: "npm install",
          requiredDeps: ["next", "react", "react-dom"],
          env: { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
        },
      },

      nuxt: {
        dependencies: ["nuxt"],
        configFiles: ["nuxt.config.js", "nuxt.config.ts"],
        buildCommands: ["npm run build", "npm run generate"],
        detection: ["nuxt", "Nuxt", "defineNuxtConfig"],
        config: {
          buildCommand: "npm run generate",
          outputDir: "dist",
          installCommand: "npm install",
          requiredDeps: ["nuxt"],
          env: { NODE_ENV: "production" },
        },
      },

      angular: {
        dependencies: ["@angular/core", "@angular/cli"],
        configFiles: ["angular.json"],
        buildCommands: ["npm run build"],
        detection: ["@angular", "ng build", "angular.json"],
        config: {
          buildCommand: "npm run build",
          outputDir: "dist",
          installCommand: "npm install",
          requiredDeps: ["@angular/core", "@angular/cli"],
          env: { NODE_ENV: "production" },
        },
      },

      svelte: {
        dependencies: ["svelte", "@sveltejs/kit", "vite"],
        configFiles: ["vite.config.js", "svelte.config.js"],
        buildCommands: ["npm run build"],
        detection: ["svelte", ".svelte", "SvelteKit"],
        config: {
          buildCommand: "npm run build",
          outputDir: "build",
          installCommand: "npm install",
          requiredDeps: ["svelte", "@sveltejs/kit", "vite"],
          env: { NODE_ENV: "production" },
        },
      },
    };
  }

  async detectFrameworks(projectPath, buildLog = "") {
    const detectedFrameworks = new Set();
    const frameworkConfigs = [];

    try {
      // 1. Vérifier package.json pour JS frameworks ET CSS frameworks
      const packageJsonPath = path.join(projectPath, "package.json");

      if (allDeps["next"] && allDeps["react"]) {
        // Vérifier aussi la présence de scripts Next.js typiques
        const scripts = packageJson.scripts || {};
        if (
          scripts.build &&
          (scripts.build.includes("next") ||
            scripts.export ||
            scripts.start?.includes("next"))
        ) {
          detectedFrameworks.add("nextjs");
          frameworkConfigs.push({
            name: "nextjs",
            config: this.supportedFrameworks.nextjs.config,
            confidence: 0.9,
          });
        }
      } else if (allDeps["vite"] && allDeps["react"]) {
        // C'est probablement React + Vite
        detectedFrameworks.add("react");
        frameworkConfigs.push({
          name: "react",
          config: this.supportedFrameworks.react.config,
          confidence: 0.9,
        });
      }

      if (await this.fileExists(packageJsonPath)) {
        const packageJson = JSON.parse(
          await fs.readFile(packageJsonPath, "utf8")
        );
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        // Détecter les frameworks JS avec priorité
        const jsFrameworkPriority = ["nextjs", "vue", "react"];
        for (const framework of jsFrameworkPriority) {
          const config = this.supportedFrameworks[framework];
          if (config && config.dependencies.some((dep) => allDeps[dep])) {
            detectedFrameworks.add(framework);
            frameworkConfigs.push({
              name: framework,
              config: config.config,
              confidence: 0.9,
            });
            buildLog += `🎯 Framework JS principal détecté: ${framework}\n`;
            break; // Un seul framework JS principal
          }
        }

        // Détecter les frameworks CSS séparément
        const cssFrameworks = [
          "tailwind",
          "bootstrap",
          "bulma",
          "aos",
          "framerMotion",
          "gsap",
        ];
        for (const framework of cssFrameworks) {
          const config = this.supportedFrameworks[framework];
          if (config && config.dependencies.some((dep) => allDeps[dep])) {
            detectedFrameworks.add(framework);
            buildLog += `🎨 Framework CSS/Animation détecté: ${framework}\n`;
          }
        }
      }

      // 2. Scanner les fichiers source
      await this.scanSourceFiles(projectPath, detectedFrameworks, buildLog);

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

    // Vérifier si c'est un projet Vite et ajouter terser automatiquement
    if (frameworks.includes("vue") && !allDeps.vue) {
      missingDeps.push("vue", "@vitejs/plugin-vue", "vite");
    }

    // Gestion spéciale pour React
    if (frameworks.includes("react") && !allDeps.react) {
      missingDeps.push("react", "react-dom", "@vitejs/plugin-react", "vite");
    }

    // IMPORTANT: Terser pour Vite (toujours nécessaire)
    const isViteProject =
      frameworks.includes("vue") ||
      frameworks.includes("react") ||
      allDeps.vite;
    if (isViteProject && !allDeps.terser) {
      missingDeps.push("terser");
      buildLog += `🔧 Terser ajouté automatiquement pour projet Vite\n`;
    }

    // Ajouter les dépendances des frameworks détectés
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
        terser: "^5.19.0", // CRUCIAL pour Vite
        vue: "^3.3.4",
        "@vitejs/plugin-vue": "^4.4.0",
        react: "^18.2.0",
        "react-dom": "^18.2.0",
        "@vitejs/plugin-react": "^4.1.0",
        vite: "^4.4.9",
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
    buildLog = await this.createSmartViteConfig(
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
  // backend/src/utils/universalFrameworkHandler.js - CORRECTION DÉTECTION FRAMEWORKS

  // AJOUTER cette méthode dans votre classe UniversalFrameworkHandler existante

  async detectFrameworks(projectPath, buildLog = "") {
    const detectedFrameworks = new Set();
    const frameworkConfigs = [];

    try {
      buildLog += `🔍 Analyse du projet...\n`;

      // 1. Vérifier package.json pour JS frameworks ET CSS frameworks
      const packageJsonPath = path.join(projectPath, "package.json");
      if (await this.fileExists(packageJsonPath)) {
        const packageJson = JSON.parse(
          await fs.readFile(packageJsonPath, "utf8")
        );
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        buildLog += `📦 Analyse des dépendances package.json...\n`;

        // Détecter les frameworks JS avec priorité et config
        const jsFrameworkPriority = [
          "nextjs",
          "nuxt",
          "angular",
          "vue",
          "react",
          "svelte",
        ];

        for (const framework of jsFrameworkPriority) {
          const config = this.supportedFrameworks[framework];
          if (config && config.config) {
            // Frameworks avec configuration complète
            if (config.dependencies.some((dep) => allDeps[dep])) {
              detectedFrameworks.add(framework);
              frameworkConfigs.push({
                name: framework,
                config: config.config,
                confidence: 0.9,
              });
              buildLog += `🎯 Framework JS principal détecté: ${framework}\n`;
              break; // Un seul framework JS principal
            }
          }
        }

        // Détecter les frameworks CSS séparément
        const cssFrameworks = [
          "tailwind",
          "bootstrap",
          "bulma",
          "aos",
          "framerMotion",
          "gsap",
        ];
        for (const framework of cssFrameworks) {
          const config = this.supportedFrameworks[framework];
          if (config && config.dependencies.some((dep) => allDeps[dep])) {
            detectedFrameworks.add(framework);
            buildLog += `🎨 Framework CSS/Animation détecté: ${framework}\n`;
          }
        }
      }

      // 2. Scanner les fichiers source pour détection supplémentaire
      await this.scanSourceFiles(projectPath, detectedFrameworks, buildLog);

      // 3. Si aucun framework JS détecté, essayer de détecter via les scripts npm
      if (frameworkConfigs.length === 0) {
        const packageJsonPath = path.join(projectPath, "package.json");
        if (await this.fileExists(packageJsonPath)) {
          const packageJson = JSON.parse(
            await fs.readFile(packageJsonPath, "utf8")
          );
          const scripts = packageJson.scripts || {};

          if (scripts.build && scripts.build.includes("vue")) {
            frameworkConfigs.push({
              name: "vue",
              config: this.supportedFrameworks.vue.config,
              confidence: 0.7,
            });
            buildLog += `🔍 Vue.js détecté via scripts npm\n`;
          } else if (scripts.build && scripts.build.includes("react")) {
            frameworkConfigs.push({
              name: "react",
              config: this.supportedFrameworks.react.config,
              confidence: 0.7,
            });
            buildLog += `🔍 React détecté via scripts npm\n`;
          }
        }
      }

      return {
        frameworks: Array.from(detectedFrameworks),
        configs: frameworkConfigs.sort((a, b) => b.confidence - a.confidence),
        log: buildLog,
      };
    } catch (error) {
      buildLog += `⚠️ Erreur détection frameworks: ${error.message}\n`;
      return {
        frameworks: [],
        configs: [],
        log: buildLog,
      };
    }
  }

  // MODIFIER aussi votre méthode createSmartViteConfig existante pour gérer les erreurs
  async createSmartViteConfig(projectPath, frameworks, buildLog) {
    const configPath = path.join(projectPath, "vite.config.js");

    try {
      // Déterminer le framework principal
      let mainFramework = null;
      let pluginImports = [];
      let plugins = [];

      if (frameworks.includes("vue")) {
        mainFramework = "vue";
        pluginImports.push("import vue from '@vitejs/plugin-vue'");
        plugins.push("vue()");
      } else if (frameworks.includes("react")) {
        mainFramework = "react";
        pluginImports.push("import react from '@vitejs/plugin-react'");
        plugins.push("react()");
      }

      // Configuration de base selon le framework
      let outputDir = "dist";
      if (mainFramework === "react") {
        outputDir = "build";
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
        assetFileNames: 'assets/[name]-[hash].[ext]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    },
    // Options de fallback en cas de problème avec terser
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      mangle: true,
    }
  },
  server: {
    port: 3000,
    hmr: true
  },
  optimizeDeps: {
    include: [${frameworks.includes("aos") ? '"aos"' : ""}${
        frameworks.includes("gsap") ? ', "gsap"' : ""
      }${frameworks.includes("framerMotion") ? ', "framer-motion"' : ""}]
  }
})`;

      await fs.writeFile(configPath, config);
      buildLog += `⚙️ Configuration Vite optimisée créée pour ${
        mainFramework || "générique"
      }\n`;

      return buildLog;
    } catch (error) {
      buildLog += `⚠️ Erreur création config Vite: ${error.message}\n`;
      return buildLog;
    }
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
