// backend/src/services/staticServer.js - VERSION AMÉLIORÉE
const express = require("express");
const path = require("path");
const fs = require("fs").promises;

class StaticServer {
  constructor() {
    this.app = express();
    this.port = process.env.STATIC_PORT || 3002;
    this.publicDir = path.join(__dirname, "../../public");

    this.setupMiddlewares();
    this.setupRoutes();
  }

  setupMiddlewares() {
    // CORS pour les requêtes cross-origin
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type");
      next();
    });

    // Middleware pour définir les bons MIME types
    this.app.use((req, res, next) => {
      const ext = path.extname(req.path);
      const mimeTypes = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
        ".otf": "font/otf",
      };

      if (mimeTypes[ext]) {
        res.type(mimeTypes[ext]);
      }
      next();
    });

    // Logging des requêtes
    this.app.use((req, res, next) => {
      console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.url}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get("/health", (req, res) => {
      res.json({
        status: "OK",
        server: "MadaHost Static Server",
        timestamp: new Date().toISOString(),
        port: this.port,
      });
    });

    // Route pour servir les projets par ID avec support des sous-dossiers
    this.app.get("/project/:projectId/*", async (req, res) => {
      const { projectId } = req.params;
      const filePath = req.params[0] || "index.html";

      await this.serveProjectFile(projectId, filePath, res);
    });

    // Route pour servir les projets par ID sans sous-chemin
    this.app.get("/project/:projectId", async (req, res) => {
      const { projectId } = req.params;
      await this.serveProjectFile(projectId, "index.html", res);
    });

    // Route pour servir les projets par sous-domaine
    this.app.get("*", async (req, res) => {
      const host = req.get("host");

      // Extraire le sous-domaine
      const subdomain = this.extractSubdomain(host);

      if (!subdomain) {
        return res.status(404).json({
          error: "Site non trouvé",
          host: host,
          message:
            "Utilisez un sous-domaine valide (ex: monprojet.madahost.me)",
        });
      }

      // Trouver le projet correspondant au sous-domaine
      const projectId = await this.findProjectByDomain(subdomain);

      if (!projectId) {
        return this.serveNotFoundPage(res, subdomain);
      }

      const filePath = req.path === "/" ? "index.html" : req.path.slice(1);
      await this.serveProjectFile(projectId, filePath, res);
    });
  }

  async serveProjectFile(projectId, filePath, res) {
    try {
      const projectDir = path.join(this.publicDir, projectId);
      let fullPath = path.join(projectDir, filePath);

      console.log(`📂 Servir: ${projectId}/${filePath}`);

      // Vérifier que le fichier est dans le dossier du projet (sécurité)
      if (!fullPath.startsWith(projectDir)) {
        console.log(`🔒 Tentative d'accès refusée: ${fullPath}`);
        return res.status(403).json({ error: "Accès refusé" });
      }

      // Fonction pour essayer plusieurs emplacements de fichiers
      const tryLocations = [
        fullPath, // Emplacement direct
        path.join(projectDir, "assets", filePath), // Dans assets/
        path.join(projectDir, "dist", filePath), // Dans dist/
        path.join(projectDir, "dist", "assets", filePath), // Dans dist/assets/
      ];

      // Essayer chaque emplacement
      for (const location of tryLocations) {
        try {
          const stats = await fs.stat(location);
          if (stats.isFile()) {
            console.log(
              `✅ Fichier trouvé: ${location.replace(this.publicDir, "")}`
            );

            // Headers corrects selon le type de fichier
            const ext = path.extname(location).toLowerCase();

            // Headers de sécurité et cache
            res.set("X-Content-Type-Options", "nosniff");
            res.set("X-Frame-Options", "SAMEORIGIN");

            if (
              [
                ".js",
                ".css",
                ".png",
                ".jpg",
                ".jpeg",
                ".gif",
                ".svg",
                ".woff",
                ".woff2",
                ".ico",
              ].includes(ext)
            ) {
              res.set("Cache-Control", "public, max-age=86400"); // 24h au lieu d'1 an pour éviter les problèmes de cache
            }

            // MIME types corrects avec encodage
            const mimeTypes = {
              ".html": "text/html; charset=utf-8",
              ".js": "application/javascript; charset=utf-8",
              ".css": "text/css; charset=utf-8",
              ".json": "application/json; charset=utf-8",
              ".png": "image/png",
              ".jpg": "image/jpeg",
              ".jpeg": "image/jpeg",
              ".gif": "image/gif",
              ".svg": "image/svg+xml; charset=utf-8",
              ".ico": "image/x-icon",
              ".woff": "font/woff",
              ".woff2": "font/woff2",
              ".ttf": "font/ttf",
              ".otf": "font/otf",
            };

            if (mimeTypes[ext]) {
              res.set("Content-Type", mimeTypes[ext]);
            }

            // Headers spéciaux pour CSS et JS
            if (ext === ".css") {
              res.set("Content-Type", "text/css; charset=utf-8");
              res.set("Cache-Control", "public, max-age=3600"); // Cache plus court pour CSS
            }

            if (ext === ".js") {
              res.set("Content-Type", "application/javascript; charset=utf-8");
              res.set("Cache-Control", "public, max-age=3600"); // Cache plus court pour JS
            }

            return res.sendFile(location);
          }
        } catch (err) {
          // Continue vers l'emplacement suivant
          continue;
        }
      }

      console.log(
        `❌ Fichier non trouvé dans tous les emplacements: ${filePath}`
      );

      // Debug: Lister les fichiers disponibles
      try {
        console.log(`🔍 Debug pour ${projectId}:`);

        const projectFiles = await fs.readdir(projectDir);
        console.log(
          `📁 Racine (${projectFiles.length} fichiers):`,
          projectFiles.slice(0, 5)
        );

        // Vérifier le dossier assets
        const assetsDir = path.join(projectDir, "assets");
        try {
          const assetsFiles = await fs.readdir(assetsDir);
          console.log(
            `📁 Assets (${assetsFiles.length} fichiers):`,
            assetsFiles.slice(0, 5)
          );
        } catch (e) {
          console.log(`📁 Pas de dossier assets/`);
        }

        // Vérifier le dossier dist
        const distDir = path.join(projectDir, "dist");
        try {
          const distFiles = await fs.readdir(distDir);
          console.log(
            `📁 Dist (${distFiles.length} fichiers):`,
            distFiles.slice(0, 5)
          );

          const distAssetsDir = path.join(distDir, "assets");
          try {
            const distAssetsFiles = await fs.readdir(distAssetsDir);
            console.log(
              `📁 Dist/Assets (${distAssetsFiles.length} fichiers):`,
              distAssetsFiles.slice(0, 5)
            );
          } catch (e) {
            console.log(`📁 Pas de dossier dist/assets/`);
          }
        } catch (e) {
          console.log(`📁 Pas de dossier dist/`);
        }
      } catch (debugError) {
        console.log(`❌ Debug impossible: ${debugError.message}`);
      }

      // Fallback vers index.html pour les SPA
      const indexLocations = [
        path.join(projectDir, "index.html"),
        path.join(projectDir, "dist", "index.html"),
      ];

      for (const indexPath of indexLocations) {
        try {
          await fs.access(indexPath);
          console.log(
            `🔄 Fallback SPA vers: ${indexPath.replace(this.publicDir, "")}`
          );
          return res.sendFile(indexPath);
        } catch (e) {
          continue;
        }
      }

      // Si aucun index.html trouvé
      console.log(`❌ Aucun index.html trouvé pour ${projectId}`);
      return this.serveProjectNotFoundPage(res, projectId);
    } catch (error) {
      console.error(`❌ Erreur serveur statique:`, error);
      res.status(500).json({
        error: "Erreur interne du serveur",
        projectId,
        filePath,
        message: error.message,
      });
    }
  }

  extractSubdomain(host) {
    // Retirer le port si présent
    const cleanHost = host.split(":")[0];

    // Patterns pour différents environnements
    const patterns = [
      /^(.+)\.madahost\.me$/, // Production
      /^(.+)\.madahost\.dev$/, // Staging
      /^(.+)\.localhost$/, // Local
    ];

    for (const pattern of patterns) {
      const match = cleanHost.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  async findProjectByDomain(subdomain) {
    try {
      const supabase = require("../config/supabase");

      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("domain", `${subdomain}.madahost.me`)
        .or(
          `domain.eq.${subdomain}.madahost.dev,domain.eq.${subdomain}.localhost:3002`
        )
        .single();

      return project?.id || null;
    } catch (error) {
      console.error("❌ Erreur recherche projet:", error);
      return null;
    }
  }

  serveNotFoundPage(res, subdomain) {
    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Site non trouvé - MadaHost</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 2rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            text-align: center;
            background: rgba(255,255,255,0.1);
            padding: 3rem;
            border-radius: 1rem;
            backdrop-filter: blur(10px);
          }
          h1 { margin: 0 0 1rem; font-size: 2.5rem; }
          p { margin: 0 0 1rem; opacity: 0.9; }
          .subdomain { font-family: monospace; background: rgba(255,255,255,0.2); padding: 0.5rem; border-radius: 0.5rem; }
          a { color: #fff; text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 Site non trouvé</h1>
          <p>Le sous-domaine <span class="subdomain">${subdomain}</span> ne correspond à aucun projet déployé.</p>
          <p>Vérifiez l'URL ou <a href="http://localhost:5173/dashboard">créez un nouveau projet</a>.</p>
          <hr style="margin: 2rem 0; border: 1px solid rgba(255,255,255,0.3);">
          <p style="font-size: 0.9rem; opacity: 0.7;">Powered by MadaHost</p>
        </div>
      </body>
      </html>
    `;

    res.status(404).send(html);
  }

  serveProjectNotFoundPage(res, projectId) {
    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Projet en construction - MadaHost</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 2rem;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            text-align: center;
            background: rgba(255,255,255,0.1);
            padding: 3rem;
            border-radius: 1rem;
            backdrop-filter: blur(10px);
          }
          h1 { margin: 0 0 1rem; font-size: 2.5rem; }
          p { margin: 0 0 1rem; opacity: 0.9; }
          .project-id { font-family: monospace; background: rgba(255,255,255,0.2); padding: 0.5rem; border-radius: 0.5rem; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🏗️ Site en construction</h1>
          <p>Le projet <span class="project-id">${projectId}</span> n'a pas encore été déployé ou ne contient pas de fichiers.</p>
          <p>Le déploiement peut prendre quelques minutes après la création du projet.</p>
          <p><a href="http://localhost:5173/project/${projectId}" style="color: #fff;">Retour au dashboard</a></p>
          <hr style="margin: 2rem 0; border: 1px solid rgba(255,255,255,0.3);">
          <p style="font-size: 0.9rem; opacity: 0.7;">Powered by MadaHost</p>
        </div>
      </body>
      </html>
    `;

    res.status(404).send(html);
  }

  start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(
          `🌐 MadaHost Static Server démarré sur le port ${this.port}`
        );
        console.log(`📡 Health check: http://localhost:${this.port}/health`);
        console.log(
          `🔗 Projets accessibles via /project/:id/ ou sous-domaines`
        );
        resolve(this.server);
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      console.log("🛑 Serveur statique arrêté");
    }
  }
}

module.exports = StaticServer;
