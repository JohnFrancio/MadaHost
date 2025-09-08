// backend/server.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const session = require("express-session");
const passport = require("passport");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration CORS améliorée
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
};

// Middlewares de sécurité
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          "*.github.com",
          "*.githubusercontent.com",
        ],
        connectSrc: ["'self'", "https://api.github.com"],
      },
    },
    crossOriginEmbedderPolicy: false, // Nécessaire pour les images GitHub
  })
);

app.use(cors(corsOptions));
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Configuration des sessions sécurisées
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS en production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 heures
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // Pour les cookies cross-origin
    },
    name: "madahost.sid", // Nom personnalisé pour la session
  })
);

// Configuration Passport
app.use(passport.initialize());
app.use(passport.session());

// Middleware de logging des sessions (développement)
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    console.log("Session ID:", req.sessionID);
    console.log("User:", req.user ? req.user.username : "non connecté");
    console.log("---");
    next();
  });
}

// ✅ IMPORTANT: Utiliser le router d'authentification corrigé
const { router: authRouter } = require("./src/routes/auth");
app.use("/api/auth", authRouter);

// Routes des projets
app.use("/api/projects", require("./src/routes/projects"));

// ✅ Route GitHub corrigée
const githubRoutes = require("./src/routes/github");
app.use("/api/github", githubRoutes);

// Routes des déploiements
const deploymentsRoutes = require("./src/routes/deployments");
app.use("/api/deployments", deploymentsRoutes);

// Route de santé détaillée
app.get("/api/health", (req, res) => {
  const health = {
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
    session: {
      connected: !!req.user,
      user: req.user ? req.user.username : null,
      sessionId: req.sessionID,
    },
    config: {
      github: {
        clientId: !!process.env.GITHUB_CLIENT_ID,
        clientSecret: !!process.env.GITHUB_CLIENT_SECRET,
        callbackUrl: process.env.GITHUB_CALLBACK_URL,
      },
      supabase: {
        url: !!process.env.SUPABASE_URL,
        key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      session: {
        secret: !!process.env.SESSION_SECRET,
      },
    },
  };

  res.json(health);
});

// Route pour obtenir les infos utilisateur connecté (version détaillée)
app.get("/api/user", (req, res) => {
  console.log("🔍 Route /api/user appelée");
  console.log("👤 User présent:", !!req.user);
  console.log("📱 Session ID:", req.sessionID);

  if (!req.user) {
    return res.status(401).json({
      error: "Non authentifié",
      authenticated: false,
      sessionExists: !!req.session,
    });
  }

  const response = {
    success: true,
    authenticated: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      displayName: req.user.displayName,
      email: req.user.email,
      avatar: req.user.avatar_url,
      githubId: req.user.github_id,
    },
    session: {
      id: req.sessionID,
      hasGithubToken: !!req.user.access_token,
      tokenPreview: req.user.access_token
        ? req.user.access_token.substring(0, 8) + "..."
        : null,
    },
  };

  console.log("✅ Réponse user:", {
    username: response.user.username,
    hasToken: response.session.hasGithubToken,
  });

  res.json(response);
});

// Route de diagnostic des sessions
app.get("/api/debug/session", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res
      .status(403)
      .json({ error: "Debug non disponible en production" });
  }

  res.json({
    session: {
      id: req.sessionID,
      data: req.session,
      cookie: req.session.cookie,
    },
    user: req.user || null,
    headers: {
      userAgent: req.headers["user-agent"],
      origin: req.headers.origin,
      referer: req.headers.referer,
      cookie: req.headers.cookie,
    },
  });
});

// Middleware de gestion d'erreurs global amélioré
app.use((err, req, res, next) => {
  console.error("❌ Erreur serveur:", err);
  console.error("📍 Stack:", err.stack);
  console.error("🔍 URL:", req.url);
  console.error("👤 User:", req.user ? req.user.username : "non connecté");

  // Erreurs spécifiques
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({
      success: false,
      error: "Token CSRF invalide",
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: "Fichier trop volumineux",
    });
  }

  res.status(err.status || 500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Une erreur est survenue"
        : err.message,
    ...(process.env.NODE_ENV !== "production" && {
      stack: err.stack,
      details: {
        url: req.url,
        method: req.method,
        user: req.user?.username || null,
        timestamp: new Date().toISOString(),
      },
    }),
  });
});

// Middleware pour les routes non trouvées
app.use("*", (req, res) => {
  console.log(`🔍 Route non trouvée: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: "Route non trouvée",
    path: req.originalUrl,
    method: req.method,
  });
});

// Démarrage du serveur avec vérifications
app.listen(PORT, () => {
  console.log("🚀 Serveur MadaHost démarré !");
  console.log(`🔗 API disponible sur: http://localhost:${PORT}`);
  console.log(
    `🌐 Frontend sur: ${process.env.FRONTEND_URL || "http://localhost:5173"}`
  );
  console.log(`🏗️ Environnement: ${process.env.NODE_ENV || "development"}`);

  // Vérifications de configuration
  const missingConfig = [];

  if (!process.env.GITHUB_CLIENT_ID) missingConfig.push("GITHUB_CLIENT_ID");
  if (!process.env.GITHUB_CLIENT_SECRET)
    missingConfig.push("GITHUB_CLIENT_SECRET");
  if (!process.env.SUPABASE_URL) missingConfig.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    missingConfig.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.SESSION_SECRET) missingConfig.push("SESSION_SECRET");

  if (missingConfig.length > 0) {
    console.warn("⚠️ Configuration manquante:", missingConfig.join(", "));
    console.warn("🔧 Vérifiez votre fichier .env");
  } else {
    console.log("✅ Configuration complète");
  }

  console.log("🎯 Routes disponibles:");
  console.log("  - GET  /api/health");
  console.log("  - GET  /api/user");
  console.log("  - GET  /api/auth/github");
  console.log("  - GET  /api/auth/me");
  console.log("  - GET  /api/github/repos");
  console.log("  - GET  /api/github/test");
  console.log("  - GET  /api/projects");
  console.log("");

  console.log("✅ Serveur prêt à recevoir les requêtes");

  // Test de connectivité Supabase
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = require("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    supabase
      .from("users")
      .select("count", { count: "exact", head: true })
      .then(({ count, error }) => {
        if (error) {
          console.warn("⚠️ Connexion Supabase échouée:", error.message);
        } else {
          console.log("✅ Connexion Supabase OK -", count, "utilisateurs");
        }
      })
      .catch((err) => {
        console.warn("⚠️ Test Supabase échoué:", err.message);
      });
  }
});

// Gestion propre de l'arrêt du serveur
process.on("SIGINT", () => {
  console.log("\n🛑 Arrêt du serveur demandé");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Arrêt du serveur (SIGTERM)");
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error("💥 Exception non gérée:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Promise rejetée non gérée:", reason);
  console.error("Promise:", promise);
});
