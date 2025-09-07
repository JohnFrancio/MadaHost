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

// Configuration CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middlewares de sécurité
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

app.use(cors(corsOptions));
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Configuration des sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 heures
    },
  })
);

// Configuration Passport
app.use(passport.initialize());
app.use(passport.session());

// Configuration de la stratégie GitHub
const GitHubStrategy = require("passport-github2").Strategy;

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "/api/auth/github/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Ici, vous pourriez sauvegarder l'utilisateur en base de données
        const user = {
          id: profile.id,
          username: profile.username,
          displayName: profile.displayName,
          email: profile.emails?.[0]?.value,
          avatar: profile.photos?.[0]?.value,
          githubAccessToken: accessToken,
          githubRefreshToken: refreshToken,
          profile: profile._json,
        };

        console.log("✅ Utilisateur GitHub authentifié:", user.username);
        return done(null, user);
      } catch (error) {
        console.error("❌ Erreur authentification GitHub:", error);
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Routes
app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/projects", require("./src/routes/projects"));
const githubRoutes = require("./src/routes/github");
app.use("/api/github", githubRoutes);
// Route de test
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Route pour obtenir les infos utilisateur connecté
app.get("/api/user", (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  res.json({
    success: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      displayName: req.user.displayName,
      email: req.user.email,
      avatar: req.user.avatar,
    },
  });
});

// Middleware de gestion d'erreurs global
app.use((err, req, res, next) => {
  console.error("❌ Erreur serveur:", err);

  res.status(err.status || 500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Une erreur est survenue"
        : err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// Middleware pour les routes non trouvées
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Route non trouvée",
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log("🚀 Serveur MadaHost démarré !");
  console.log(`📡 API disponible sur: http://localhost:${PORT}`);
  console.log(
    `🔗 Frontend sur: ${process.env.FRONTEND_URL || "http://localhost:5173"}`
  );
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || "development"}`);

  // Vérification de la configuration
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    console.warn("⚠️ Configuration GitHub OAuth incomplète !");
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.warn("⚠️ Configuration Supabase incomplète !");
  }

  console.log("✅ Serveur prêt à recevoir les requêtes");
});
