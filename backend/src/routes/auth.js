const express = require("express");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

// Configuration Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration Passport GitHub
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log(
          "🔑 Authentification GitHub réussie pour:",
          profile.username
        );
        console.log("🔑 Token reçu:", accessToken?.substring(0, 8) + "...");

        // Vérifier si l'utilisateur existe déjà
        const { data: existingUser, error: fetchError } = await supabase
          .from("users")
          .select("*")
          .eq("github_id", profile.id.toString())
          .single();

        if (fetchError && fetchError.code !== "PGRST116") {
          console.error(
            "❌ Erreur lors de la recherche utilisateur:",
            fetchError
          );
          return done(fetchError);
        }

        let user;
        if (existingUser) {
          // Mettre à jour les infos existantes AVEC le token
          const { data: updatedUser, error: updateError } = await supabase
            .from("users")
            .update({
              username: profile.username,
              email: profile.emails?.[0]?.value || null,
              avatar_url: profile.photos?.[0]?.value || null,
              access_token: accessToken, // ✅ IMPORTANT: Sauvegarder le token
              updated_at: new Date().toISOString(),
            })
            .eq("github_id", profile.id.toString())
            .select()
            .single();

          if (updateError) {
            console.error("❌ Erreur lors de la mise à jour:", updateError);
            return done(updateError);
          }
          user = updatedUser;
        } else {
          // Créer un nouvel utilisateur AVEC le token
          const { data: newUser, error: createError } = await supabase
            .from("users")
            .insert({
              github_id: profile.id.toString(),
              username: profile.username,
              email: profile.emails?.[0]?.value || null,
              avatar_url: profile.photos?.[0]?.value || null,
              access_token: accessToken, // ✅ IMPORTANT: Sauvegarder le token
            })
            .select()
            .single();

          if (createError) {
            console.error("❌ Erreur lors de la création:", createError);
            return done(createError);
          }
          user = newUser;
        }

        console.log("✅ Utilisateur sauvegardé avec token");
        return done(null, user);
      } catch (error) {
        console.error("❌ Erreur dans la stratégie GitHub:", error);
        return done(error);
      }
    }
  )
);

// Sérialisation pour les sessions
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// ✅ CORRECTION: Désérialisation avec le token GitHub
passport.deserializeUser(async (id, done) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, github_id, username, email, avatar_url, access_token") // ✅ Inclure access_token
      .eq("id", id)
      .single();

    if (error) {
      console.error("❌ Erreur désérialisation:", error);
      return done(error);
    }

    // ✅ Ajouter le token dans l'objet user pour les routes
    if (user) {
      user.githubAccessToken = user.access_token;
    }

    done(null, user);
  } catch (error) {
    console.error("❌ Erreur désérialisation:", error);
    done(error);
  }
});

// Initialiser Passport
router.use(passport.initialize());
router.use(passport.session());

// Route pour démarrer l'authentification GitHub
router.get(
  "/github",
  passport.authenticate("github", {
    scope: ["user:email", "repo", "read:user"], // ✅ Ajouter read:user
  })
);

// Route de callback GitHub
router.get(
  "/github/callback",
  passport.authenticate("github", { failureRedirect: "/login" }),
  (req, res) => {
    console.log("✅ Authentification réussie, redirection vers le frontend");
    // Rediriger vers le frontend avec succès
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
);

// ✅ CORRECTION: Route pour obtenir les infos de l'utilisateur connecté
router.get("/me", (req, res) => {
  console.log("🔍 Route /me appelée");
  console.log("👤 User:", req.user ? "présent" : "absent");
  console.log("🔑 Token:", req.user?.access_token ? "présent" : "absent");

  if (!req.user) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      avatar_url: req.user.avatar_url,
      hasGithubToken: !!req.user.access_token,
    },
  });
});

// Route de déconnexion
router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("❌ Erreur lors de la déconnexion:", err);
      return res.status(500).json({ error: "Erreur lors de la déconnexion" });
    }
    req.session.destroy((err) => {
      if (err) {
        console.error("❌ Erreur lors de la destruction de session:", err);
        return res.status(500).json({ error: "Erreur lors de la déconnexion" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Déconnexion réussie" });
    });
  });
});

// ✅ Middleware pour vérifier l'authentification
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: "Authentification requise",
      redirect: "/login",
    });
  }
  next();
};

// ✅ Middleware pour vérifier le token GitHub
const requireGithubToken = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: "Authentification requise",
    });
  }

  if (!req.user.access_token) {
    return res.status(400).json({
      error: "Token GitHub manquant",
      message: "Reconnectez-vous avec GitHub",
      action: "reconnect",
    });
  }

  next();
};

// Route protégée de test
router.get("/profile", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ✅ Exporter les middlewares aussi
module.exports = {
  router,
  requireAuth,
  requireGithubToken,
};
