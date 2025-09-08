const axios = require("axios");

class GitHubService {
  constructor(accessToken) {
    if (!accessToken) {
      throw new Error("Token d'accès GitHub requis");
    }

    this.accessToken = accessToken;
    this.api = axios.create({
      baseURL: "https://api.github.com",
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "MadaHost-App",
      },
      timeout: 30000,
    });

    // Intercepteur pour logger les requêtes
    this.api.interceptors.request.use(
      (config) => {
        console.log(
          `📡 GitHub API: ${config.method?.toUpperCase()} ${config.url}`
        );
        return config;
      },
      (error) => {
        console.error("❌ Erreur config requête GitHub:", error);
        return Promise.reject(error);
      }
    );

    // Intercepteur pour gérer les réponses et erreurs
    this.api.interceptors.response.use(
      (response) => {
        const remaining = response.headers["x-ratelimit-remaining"];
        const limit = response.headers["x-ratelimit-limit"];
        console.log(
          `✅ GitHub API: ${response.status} - Rate limit: ${remaining}/${limit}`
        );
        return response;
      },
      (error) => {
        if (error.response) {
          const { status, statusText, headers } = error.response;
          console.error(`❌ GitHub API Error: ${status} ${statusText}`);

          if (headers["x-ratelimit-remaining"] === "0") {
            const resetTime = new Date(
              parseInt(headers["x-ratelimit-reset"]) * 1000
            );
            console.error(`⏰ Rate limit reset at: ${resetTime.toISOString()}`);
          }

          // Messages d'erreur plus explicites
          switch (status) {
            case 401:
              error.message = "Token GitHub invalide ou expiré";
              break;
            case 403:
              if (headers["x-ratelimit-remaining"] === "0") {
                error.message = "Limite de taux API GitHub dépassée";
              } else {
                error.message = "Accès refusé aux ressources GitHub";
              }
              break;
            case 404:
              error.message = "Ressource GitHub non trouvée";
              break;
            case 422:
              error.message = "Paramètres de requête GitHub invalides";
              break;
            default:
              error.message = `Erreur API GitHub: ${status} ${statusText}`;
          }
        } else if (error.code === "ECONNABORTED") {
          error.message = "Timeout de connexion à l'API GitHub";
        } else if (
          error.code === "ENOTFOUND" ||
          error.code === "ECONNREFUSED"
        ) {
          error.message = "Impossible de se connecter à l'API GitHub";
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Récupérer les repositories de l'utilisateur
   */
  async getUserRepos(options = {}) {
    const {
      page = 1,
      per_page = 100,
      sort = "updated",
      direction = "desc",
      type = "all",
      visibility = null,
      affiliation = null,
    } = options;

    console.log(
      `📚 Récupération repos - Page: ${page}, PerPage: ${per_page}, Sort: ${sort}`
    );

    try {
      // Construire les paramètres selon les règles GitHub API
      const params = {
        page,
        per_page,
        sort,
        direction,
      };

      // ✅ CORRECTION: Selon la doc GitHub, on ne peut pas mélanger type et affiliation
      if (visibility || affiliation) {
        // Utiliser affiliation et visibility (plus flexible)
        if (affiliation) {
          params.affiliation = affiliation;
        } else {
          params.affiliation = "owner,collaborator,organization_member";
        }

        if (visibility) {
          params.visibility = visibility; // all, public, private
        }
      } else {
        // Utiliser type (plus simple mais moins flexible)
        params.type = type; // all, owner, public, private, member
      }

      console.log(`📋 Paramètres envoyés:`, params);

      const response = await this.api.get("/user/repos", { params });

      console.log(`✅ ${response.data.length} repos récupérés`);
      return response.data;
    } catch (error) {
      console.error("❌ Erreur getUserRepos:", error.message);
      throw error;
    }
  }

  /**
   * Récupérer un repository spécifique
   */
  async getRepository(owner, repo) {
    console.log(`📖 Récupération repo: ${owner}/${repo}`);

    try {
      const response = await this.api.get(`/repos/${owner}/${repo}`);
      console.log(`✅ Repo récupéré: ${response.data.full_name}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getRepository ${owner}/${repo}:`, error.message);
      throw error;
    }
  }

  /**
   * Récupérer les branches d'un repository
   */
  async getRepoBranches(owner, repo) {
    console.log(`🌿 Récupération branches: ${owner}/${repo}`);

    try {
      const response = await this.api.get(`/repos/${owner}/${repo}/branches`);
      console.log(`✅ ${response.data.length} branches récupérées`);
      return response.data;
    } catch (error) {
      console.error(
        `❌ Erreur getRepoBranches ${owner}/${repo}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Récupérer les informations de l'utilisateur connecté
   */
  async getCurrentUser() {
    console.log("👤 Récupération utilisateur GitHub");

    try {
      const response = await this.api.get("/user");
      console.log(`✅ Utilisateur récupéré: ${response.data.login}`);
      return response.data;
    } catch (error) {
      console.error("❌ Erreur getCurrentUser:", error.message);
      throw error;
    }
  }

  /**
   * Récupérer le contenu d'un fichier
   */
  async getFileContent(owner, repo, path, branch = "main") {
    console.log(`📄 Récupération fichier: ${owner}/${repo}/${path}`);

    try {
      const response = await this.api.get(
        `/repos/${owner}/${repo}/contents/${path}`,
        {
          params: { ref: branch },
        }
      );

      if (response.data.content) {
        const content = Buffer.from(response.data.content, "base64").toString(
          "utf8"
        );
        console.log(`✅ Fichier récupéré (${content.length} chars)`);
        return content;
      }

      return null;
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`ℹ️ Fichier non trouvé: ${path}`);
        return null;
      }
      console.error(`❌ Erreur getFileContent ${path}:`, error.message);
      throw error;
    }
  }

  /**
   * Détecter le framework d'un repository
   */
  async detectFramework(owner, repo, branch = "main") {
    console.log(`🔍 Détection framework: ${owner}/${repo}`);

    try {
      const detectionRules = [
        {
          files: ["package.json"],
          handler: async () => {
            const packageJson = await this.getFileContent(
              owner,
              repo,
              "package.json",
              branch
            );
            if (!packageJson) return null;

            try {
              const pkg = JSON.parse(packageJson);
              const deps = { ...pkg.dependencies, ...pkg.devDependencies };

              // Ordre de priorité pour la détection
              if (deps.next) return { framework: "Next.js", confidence: 0.95 };
              if (deps.nuxt) return { framework: "Nuxt.js", confidence: 0.95 };
              if (deps.gatsby) return { framework: "Gatsby", confidence: 0.95 };
              if (deps.astro) return { framework: "Astro", confidence: 0.95 };
              if (deps["@angular/core"])
                return { framework: "Angular", confidence: 0.9 };
              if (deps.react) return { framework: "React", confidence: 0.8 };
              if (deps.vue) return { framework: "Vue.js", confidence: 0.8 };
              if (deps.svelte) return { framework: "Svelte", confidence: 0.8 };
              if (deps.express)
                return { framework: "Express.js", confidence: 0.7 };
              if (deps.vite) return { framework: "Vite", confidence: 0.6 };

              return { framework: "Node.js", confidence: 0.5 };
            } catch (parseError) {
              console.error("❌ Erreur parsing package.json:", parseError);
              return null;
            }
          },
        },
        {
          files: ["index.html", "main.html"],
          handler: async () => {
            return { framework: "HTML Statique", confidence: 0.8 };
          },
        },
        {
          files: ["_config.yml", "Gemfile"],
          handler: async () => {
            return { framework: "Jekyll", confidence: 0.9 };
          },
        },
        {
          files: ["config.toml", "config.yaml", "hugo.toml"],
          handler: async () => {
            return { framework: "Hugo", confidence: 0.9 };
          },
        },
        {
          files: ["Dockerfile"],
          handler: async () => {
            return { framework: "Docker", confidence: 0.7 };
          },
        },
      ];

      // Tester chaque règle de détection
      for (const rule of detectionRules) {
        for (const file of rule.files) {
          try {
            const exists = await this.getFileContent(owner, repo, file, branch);
            if (exists) {
              const result = await rule.handler();
              if (result) {
                const buildConfig = this.getBuildConfig(result.framework);
                console.log(
                  `✅ Framework détecté: ${result.framework} (${Math.round(
                    result.confidence * 100
                  )}%)`
                );
                return {
                  ...result,
                  buildConfig,
                };
              }
            }
          } catch (error) {
            // Fichier non trouvé, continuer
            continue;
          }
        }
      }

      console.log("❓ Aucun framework détecté");
      return {
        framework: "Inconnu",
        confidence: 0.1,
        buildConfig: this.getBuildConfig("Inconnu"),
      };
    } catch (error) {
      console.error(
        `❌ Erreur detectFramework ${owner}/${repo}:`,
        error.message
      );
      return {
        framework: "Erreur",
        confidence: 0,
        buildConfig: null,
      };
    }
  }

  /**
   * Obtenir la configuration de build suggérée selon le framework
   */
  getBuildConfig(framework) {
    const configs = {
      "Next.js": {
        buildCommand: "npm run build",
        outputDirectory: "out",
        installCommand: "npm install",
        devCommand: "npm run dev",
        env: { NODE_ENV: "production" },
      },
      "Nuxt.js": {
        buildCommand: "npm run generate",
        outputDirectory: "dist",
        installCommand: "npm install",
        devCommand: "npm run dev",
        env: { NODE_ENV: "production" },
      },
      "Vue.js": {
        buildCommand: "npm run build",
        outputDirectory: "dist",
        installCommand: "npm install",
        devCommand: "npm run serve",
        env: { NODE_ENV: "production" },
      },
      React: {
        buildCommand: "npm run build",
        outputDirectory: "build",
        installCommand: "npm install",
        devCommand: "npm start",
        env: { NODE_ENV: "production", GENERATE_SOURCEMAP: "false" },
      },
      Angular: {
        buildCommand: "npm run build --prod",
        outputDirectory: "dist",
        installCommand: "npm install",
        devCommand: "npm start",
        env: { NODE_ENV: "production" },
      },
      Svelte: {
        buildCommand: "npm run build",
        outputDirectory: "public",
        installCommand: "npm install",
        devCommand: "npm run dev",
        env: { NODE_ENV: "production" },
      },
      Gatsby: {
        buildCommand: "npm run build",
        outputDirectory: "public",
        installCommand: "npm install",
        devCommand: "npm run develop",
        env: { NODE_ENV: "production" },
      },
      Astro: {
        buildCommand: "npm run build",
        outputDirectory: "dist",
        installCommand: "npm install",
        devCommand: "npm run dev",
        env: { NODE_ENV: "production" },
      },
      Hugo: {
        buildCommand: "hugo",
        outputDirectory: "public",
        installCommand: "",
        devCommand: "hugo server",
        env: { HUGO_ENV: "production" },
      },
      Jekyll: {
        buildCommand: "bundle exec jekyll build",
        outputDirectory: "_site",
        installCommand: "bundle install",
        devCommand: "bundle exec jekyll serve",
        env: { JEKYLL_ENV: "production" },
      },
      "HTML Statique": {
        buildCommand: "",
        outputDirectory: ".",
        installCommand: "",
        devCommand: "python -m http.server 8000",
        env: {},
      },
    };

    return (
      configs[framework] || {
        buildCommand: "npm run build",
        outputDirectory: "dist",
        installCommand: "npm install",
        devCommand: "npm start",
        env: { NODE_ENV: "production" },
      }
    );
  }
}

module.exports = GitHubService;
