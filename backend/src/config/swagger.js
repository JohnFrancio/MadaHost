// backend/src/config/swagger.js
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "MadaHost API",
      version: "1.0.0",
      description: "API de déploiement de sites web statiques avec GitHub",
      contact: {
        name: "MadaHost Support",
        url: "https://madahost.me",
        email: "support@madahost.me",
      },
    },
    servers: [
      {
        url: "http://localhost:3001",
        description: "Serveur de développement",
      },
      {
        url: "https://api.madahost.me",
        description: "Serveur de production",
      },
    ],
    components: {
      securitySchemes: {
        sessionAuth: {
          type: "apiKey",
          in: "cookie",
          name: "connect.sid",
          description: "Authentification par session cookie",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "ID unique de l'utilisateur",
            },
            username: {
              type: "string",
              description: "Nom d'utilisateur GitHub",
            },
            email: {
              type: "string",
              format: "email",
              description: "Adresse email",
            },
            avatar_url: {
              type: "string",
              format: "uri",
              description: "URL de l'avatar",
            },
            role: {
              type: "string",
              enum: ["user", "admin"],
              description: "Rôle de l'utilisateur",
            },
            github_id: {
              type: "string",
              description: "ID GitHub",
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Project: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "ID unique du projet",
            },
            name: {
              type: "string",
              description: "Nom du projet",
            },
            github_repo: {
              type: "string",
              description: "Repository GitHub (format: owner/repo)",
            },
            branch: {
              type: "string",
              default: "main",
              description: "Branche à déployer",
            },
            domain: {
              type: "string",
              description: "Domaine du projet",
            },
            status: {
              type: "string",
              enum: ["created", "active", "inactive", "building", "error"],
              description: "Statut du projet",
            },
            framework: {
              type: "string",
              description: "Framework détecté",
            },
            build_command: {
              type: "string",
              description: "Commande de build",
            },
            output_dir: {
              type: "string",
              description: "Dossier de sortie",
            },
            install_command: {
              type: "string",
              description: "Commande d'installation",
            },
            env_vars: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  value: { type: "string" },
                },
              },
              description: "Variables d'environnement",
            },
            auto_deploy: {
              type: "boolean",
              default: true,
              description: "Déploiement automatique",
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
            updated_at: {
              type: "string",
              format: "date-time",
            },
            last_deployed: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Deployment: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "ID unique du déploiement",
            },
            project_id: {
              type: "string",
              description: "ID du projet",
            },
            status: {
              type: "string",
              enum: [
                "pending",
                "cloning",
                "building",
                "deploying",
                "configuring",
                "success",
                "failed",
                "cancelled",
              ],
              description: "Statut du déploiement",
            },
            commit_hash: {
              type: "string",
              description: "Hash du commit déployé",
            },
            build_log: {
              type: "string",
              description: "Logs de build",
            },
            deploy_log: {
              type: "string",
              description: "Logs de déploiement",
            },
            started_at: {
              type: "string",
              format: "date-time",
            },
            completed_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
        GitHubRepository: {
          type: "object",
          properties: {
            id: {
              type: "number",
              description: "ID du repository GitHub",
            },
            name: {
              type: "string",
              description: "Nom du repository",
            },
            fullName: {
              type: "string",
              description: "Nom complet (owner/repo)",
            },
            description: {
              type: "string",
              description: "Description du repository",
            },
            private: {
              type: "boolean",
              description: "Repository privé",
            },
            language: {
              type: "string",
              description: "Langage principal",
            },
            defaultBranch: {
              type: "string",
              description: "Branche par défaut",
            },
            htmlUrl: {
              type: "string",
              format: "uri",
              description: "URL GitHub",
            },
            owner: {
              type: "object",
              properties: {
                login: { type: "string" },
                avatar: { type: "string", format: "uri" },
              },
            },
          },
        },
        Conversation: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "ID unique de la conversation",
            },
            subject: {
              type: "string",
              description: "Sujet de la conversation",
            },
            category: {
              type: "string",
              enum: ["general", "technical", "billing", "feature_request"],
              description: "Catégorie",
            },
            priority: {
              type: "string",
              enum: ["low", "normal", "high", "urgent"],
              description: "Priorité",
            },
            status: {
              type: "string",
              enum: ["open", "in_progress", "resolved", "closed"],
              description: "Statut",
            },
            user_id: {
              type: "string",
              description: "ID de l'utilisateur",
            },
            admin_id: {
              type: "string",
              description: "ID de l'admin assigné",
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
            updated_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Message: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "ID unique du message",
            },
            conversation_id: {
              type: "string",
              description: "ID de la conversation",
            },
            sender_id: {
              type: "string",
              description: "ID de l'expéditeur",
            },
            content: {
              type: "string",
              description: "Contenu du message",
            },
            message_type: {
              type: "string",
              enum: ["text", "image", "file"],
              description: "Type de message",
            },
            attachments: {
              type: "array",
              items: { type: "string" },
              description: "Pièces jointes",
            },
            is_read: {
              type: "boolean",
              description: "Message lu",
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
        AdminStats: {
          type: "object",
          properties: {
            totalUsers: { type: "number" },
            totalProjects: { type: "number" },
            totalDeployments: { type: "number" },
            activeProjects: { type: "number" },
            successfulDeployments: { type: "number" },
            failedDeployments: { type: "number" },
            newUsersThisMonth: { type: "number" },
            successRate: { type: "number" },
            frameworks: {
              type: "object",
              additionalProperties: { type: "number" },
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            error: {
              type: "string",
              description: "Message d'erreur",
            },
            details: {
              type: "string",
              description: "Détails de l'erreur",
            },
          },
        },
        Success: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            message: {
              type: "string",
              description: "Message de succès",
            },
          },
        },
      },
    },
    security: [
      {
        sessionAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.js"], // Chemin vers vos fichiers de routes
};

const specs = swaggerJsdoc(options);

module.exports = {
  specs,
  swaggerUi,
  serve: swaggerUi.serve,
  setup: swaggerUi.setup(specs, {
    explorer: true,
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info .title { color: #1a365d; }
    `,
    customSiteTitle: "MadaHost API Documentation",
  }),
};
