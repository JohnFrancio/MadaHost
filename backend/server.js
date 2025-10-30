// backend/server.js - VERSION AVEC REDIS
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const session = require("express-session");
const passport = require("passport");
require("dotenv").config();
const http = require("http");
const WebSocketManager = require("./src/services/websocket");
const { serve, setup } = require("./src/config/swagger");
const supabase = require("./src/config/supabase");

// ✅ Import Redis
const RedisStore = require("connect-redis").default;
const { createClient } = require("redis");

const app = express();
const PORT = process.env.PORT || 3001;

// ========================================
// ✅ Configuration Redis
// ========================================
let redisClient = null;
let redisStore = null;

const initRedis = async () => {
  if (process.env.REDIS_URL) {
    try {
      redisClient = createClient({
        url: process.env.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        },
      });

      redisClient.on("error", (err) => {
        console.error("❌ Redis Error:", err);
      });

      redisClient.on("connect", () => {
        console.log("✅ Redis connecté");
      });

      redisClient.on("reconnecting", () => {
        console.log("🔄 Redis reconnexion...");
      });

      await redisClient.connect();

      redisStore = new RedisStore({
        client: redisClient,
        prefix: "madahost:sess:",
        ttl: 86400, // 24 heures
      });

      console.log("🔴 Redis configuré pour les sessions");
    } catch (error) {
      console.error("❌ Erreur connexion Redis:", error);
      console.warn("⚠️  Utilisation de MemoryStore (fallback)");
    }
  } else {
    console.warn(
      "⚠️  REDIS_URL non configuré, utilisation de MemoryStore (non recommandé en production)"
    );
  }
};

// Initialiser Redis avant de démarrer le serveur
initRedis();

// ========================================
// Configuration CORS
// ========================================
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "https://madahost.me",
      "https://www.madahost.me",
      "http://localhost:5173",
      "http://localhost:3000",
    ];

    if (process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`❌ Origine non autorisée: ${origin}`);
      callback(new Error("Non autorisé par CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cookie",
    "X-Requested-With",
  ],
  exposedHeaders: ["Set-Cookie"],
  optionsSuccessStatus: 200,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ========================================
// Configuration Helmet
// ========================================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://api.github.com",
          "https://madahost.me",
          "https://api.madahost.me",
          "wss://api.madahost.me",
        ],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Middlewares de parsing
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ========================================
// ✅ Configuration Session AVEC Redis
// ========================================
const sessionConfig = {
  secret: process.env.SESSION_SECRET || "your-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    domain: process.env.NODE_ENV === "production" ? ".madahost.me" : undefined,
    path: "/",
  },
  name: "madahost.sid",
  proxy: true,
  rolling: true,
};

// ✅ Ajouter Redis store si disponible
if (redisStore) {
  sessionConfig.store = redisStore;
}

app.use(session(sessionConfig));

// ========================================
// Configuration Passport
// ========================================
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  console.log("📝 Sérialisation utilisateur:", user.id, user.username);
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    console.log("📖 Désérialisation utilisateur ID:", id);

    const { data: user, error } = await supabase
      .from("users")
      .select(
        "id, github_id, username, email, avatar_url, access_token, role, created_at, updated_at"
      )
      .eq("id", id)
      .single();

    if (error) {
      console.error("❌ Erreur désérialisation:", error.message);
      return done(error, null);
    }

    if (!user) {
      console.error("❌ Utilisateur introuvable:", id);
      return done(null, false);
    }

    console.log(
      "✅ Utilisateur désérialisé:",
      user.username,
      "- Role:",
      user.role
    );
    done(null, user);
  } catch (error) {
    console.error("❌ Exception désérialisation:", error);
    done(error, null);
  }
});

// ========================================
// Middleware de logging (dev)
// ========================================
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "production" && req.path !== "/ws") {
    console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.path}`);
    console.log("Session ID:", req.sessionID);
    console.log(
      "User:",
      req.user ? `${req.user.username} (${req.user.id})` : "non connecté"
    );
    console.log("Origin:", req.headers.origin);
    console.log("Cookie:", req.headers.cookie ? "✅ présent" : "❌ absent");
  }
  next();
});

// ========================================
// Swagger Documentation
// ========================================
app.use("/api-docs", serve, setup);
app.get("/docs", (req, res) => {
  res.redirect("/api-docs");
});

// ========================================
// Route API racine
// ========================================
app.get("/api", (req, res) => {
  res.json({
    name: "MadaHost API",
    version: "1.0.0",
    description: "API de déploiement de sites web statiques avec GitHub",
    documentation: {
      swagger: `${req.protocol}://${req.get("host")}/api-docs`,
    },
    endpoints: {
      auth: "/api/auth",
      projects: "/api/projects",
      deployments: "/api/deployments",
      github: "/api/github",
      messages: "/api/messages",
      admin: "/api/admin",
    },
    status: "running",
  });
});

// ========================================
// Routes API
// ========================================
const { router: authRouter } = require("./src/routes/auth");
app.use("/api/auth", authRouter);

app.use("/api/projects", require("./src/routes/projects"));
app.use("/api/github", require("./src/routes/github"));
app.use("/api/deployments", require("./src/routes/deployments.js"));
app.use("/api/admin", require("./src/routes/admin"));
app.use("/api/messages", require("./src/routes/messages"));

// ========================================
// Route WebSocket status
// ========================================
app.get("/api/ws-status", (req, res) => {
  const stats = WebSocketManager.getStats();
  res.json({
    status: "WebSocket server active",
    connectedUsers: stats.connectedUsers,
    totalConnections: stats.totalConnections,
    activeConnections: stats.activeConnections,
    timestamp: new Date().toISOString(),
  });
});

// ========================================
// Routes de santé
// ========================================
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    redis: redisClient?.isReady ? "connected" : "disconnected",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
    session: {
      connected: !!req.user,
      user: req.user ? req.user.username : null,
      sessionId: req.sessionID,
      store: redisStore ? "redis" : "memory",
    },
    websocket: WebSocketManager.getStats(),
    redis: {
      connected: redisClient?.isReady || false,
      url: process.env.REDIS_URL ? "configured" : "not configured",
    },
    config: {
      github: {
        clientId: !!process.env.GITHUB_CLIENT_ID,
        callbackUrl: process.env.GITHUB_CALLBACK_URL,
      },
      supabase: {
        configured: !!(
          process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ),
      },
      session: {
        cookieDomain:
          process.env.NODE_ENV === "production" ? ".madahost.me" : "localhost",
        cookieSecure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      },
    },
  });
});

// ========================================
// Route utilisateur
// ========================================
app.get("/api/user", (req, res) => {
  console.log("\n🔍 Route /api/user appelée");
  console.log("📱 Session ID:", req.sessionID);
  console.log(
    "👤 User:",
    req.user ? `${req.user.username} (${req.user.role})` : "null"
  );
  console.log("🍪 Cookie header:", req.headers.cookie ? "présent" : "absent");

  if (!req.user) {
    return res.status(401).json({
      error: "Non authentifié",
      authenticated: false,
      sessionExists: !!req.session,
      debug: {
        sessionId: req.sessionID,
        hasCookie: !!req.headers.cookie,
        origin: req.headers.origin,
      },
    });
  }

  res.json({
    success: true,
    authenticated: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      displayName: req.user.username,
      email: req.user.email,
      avatar: req.user.avatar_url,
      githubId: req.user.github_id,
      role: req.user.role || "user",
    },
    session: {
      id: req.sessionID,
      hasGithubToken: !!req.user.access_token,
    },
  });
});

// ========================================
// Création serveur HTTP + WebSocket
// ========================================
const server = http.createServer(app);

console.log("🔧 Initialisation du serveur WebSocket...");
WebSocketManager.initialize(server);

// ========================================
// Gestion d'erreurs
// ========================================
app.use((err, req, res, next) => {
  console.error("\n❌ Erreur serveur:", err.message);
  console.error("📍 Stack:", err.stack);
  console.error("🔍 URL:", req.url);

  res.status(err.status || 500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Une erreur est survenue"
        : err.message,
    ...(process.env.NODE_ENV !== "production" && {
      stack: err.stack,
    }),
  });
});

// Routes 404
app.use("*", (req, res) => {
  if (!req.originalUrl.includes("/ws")) {
    console.log(`🔍 Route non trouvée: ${req.method} ${req.originalUrl}`);
  }
  res.status(404).json({
    success: false,
    error: "Route non trouvée",
    path: req.originalUrl,
    method: req.method,
  });
});

// ========================================
// Démarrage du serveur
// ========================================
server.listen(PORT, async () => {
  console.log("\n🚀 Serveur MadaHost démarré !");
  console.log(`🔗 API: http://localhost:${PORT}`);
  console.log(
    `🌐 Frontend: ${process.env.FRONTEND_URL || "http://localhost:5173"}`
  );
  console.log(`🏗️ Environnement: ${process.env.NODE_ENV || "development"}\n`);

  // Vérifications config
  const missing = [];
  if (!process.env.GITHUB_CLIENT_ID) missing.push("GITHUB_CLIENT_ID");
  if (!process.env.GITHUB_CLIENT_SECRET) missing.push("GITHUB_CLIENT_SECRET");
  if (!process.env.SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.SESSION_SECRET) missing.push("SESSION_SECRET");

  if (missing.length > 0) {
    console.warn("⚠️  Configuration manquante:", missing.join(", "));
  } else {
    console.log("✅ Configuration complète");
  }

  console.log("\n🍪 Configuration Cookie:");
  console.log(
    `  - Domain: ${
      process.env.NODE_ENV === "production" ? ".madahost.me" : "localhost"
    }`
  );
  console.log(`  - Secure: ${process.env.NODE_ENV === "production"}`);
  console.log(
    `  - SameSite: ${process.env.NODE_ENV === "production" ? "none" : "lax"}`
  );

  console.log("\n🔴 Session Store:");
  console.log(`  - Type: ${redisStore ? "Redis" : "Memory (non recommandé)"}`);
  if (redisClient) {
    console.log(
      `  - Redis: ${redisClient.isReady ? "✅ Connecté" : "❌ Déconnecté"}`
    );
  }
  console.log("");

  console.log("✅ Serveur prêt à recevoir les requêtes\n");
});

// ========================================
// Shutdown propre
// ========================================
const gracefulShutdown = async () => {
  console.log("\n🛑 Arrêt des serveurs...");
  try {
    if (WebSocketManager) WebSocketManager.close();

    // Fermer Redis proprement
    if (redisClient) {
      await redisClient.quit();
      console.log("✅ Redis déconnecté");
    }

    server.close((err) => {
      if (err) {
        console.error("❌ Erreur fermeture:", err);
        process.exit(1);
      }
      console.log("✅ Serveur fermé proprement");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Erreur arrêt:", error);
    process.exit(1);
  }
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
process.on("uncaughtException", (err) => {
  console.error("💥 Exception non gérée:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("💥 Promise rejetée:", reason);
  process.exit(1);
});

module.exports = app;
