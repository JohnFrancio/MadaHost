const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: "Authentification requise",
      redirect: "/login",
    });
  }
  next();
};

const requireGithubToken = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: "Authentification requise",
    });
  }

  if (!req.user.github_token) {
    return res.status(400).json({
      error: "Token GitHub manquant",
      message: "Reconnectez-vous avec GitHub",
      action: "reconnect",
    });
  }

  next();
};

module.exports = {
  requireAuth,
  requireGithubToken,
};
