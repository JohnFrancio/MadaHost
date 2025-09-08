// backend/src/middleware/auth.js

const requireAuth = (req, res, next) => {
  console.log("🔐 Vérification authentification...");
  console.log("👤 User présent:", !!req.user);
  console.log("📧 Session ID:", req.sessionID);

  if (!req.user) {
    console.log("❌ Utilisateur non authentifié");
    return res.status(401).json({
      error: "Authentification requise",
      redirect: "/login",
      authenticated: false,
    });
  }

  console.log("✅ Utilisateur authentifié:", req.user.username);
  next();
};

const requireGithubToken = (req, res, next) => {
  console.log("🔑 Vérification token GitHub...");

  if (!req.user) {
    console.log("❌ Utilisateur non authentifié");
    return res.status(401).json({
      error: "Authentification requise",
      authenticated: false,
    });
  }

  console.log("🔍 Token présent:", !!req.user.access_token);
  console.log(
    "🔍 Token preview:",
    req.user.access_token
      ? req.user.access_token.substring(0, 8) + "..."
      : "AUCUN"
  );

  if (!req.user.access_token) {
    console.log("❌ Token GitHub manquant");
    return res.status(400).json({
      error: "Token GitHub manquant",
      message: "Reconnectez-vous avec GitHub",
      action: "reconnect",
      authenticated: true,
      hasToken: false,
    });
  }

  console.log("✅ Token GitHub valide");
  next();
};

module.exports = {
  requireAuth,
  requireGithubToken,
};
