// backend/src/middleware/admin.js
const supabase = require("../config/supabase");

// Liste des GitHub IDs autorisés comme administrateurs
const ADMIN_GITHUB_IDS = [
  "115089055", // Votre GitHub ID
];

const requireAdmin = async (req, res, next) => {
  console.log("🔐 Vérification privilèges admin...");

  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentification requise",
    });
  }

  try {
    // Vérifier si l'utilisateur est admin via GitHub ID ou rôle en base
    const isAdminByGithubId = ADMIN_GITHUB_IDS.includes(req.user.github_id);
    const isAdminByRole = req.user.role === "admin";

    console.log(
      `User: ${req.user.username}, GitHub ID: ${req.user.github_id}, Role: ${req.user.role}`
    );
    console.log(
      `Admin by GitHub ID: ${isAdminByGithubId}, Admin by role: ${isAdminByRole}`
    );

    if (!isAdminByGithubId && !isAdminByRole) {
      console.log(`❌ Accès admin refusé pour ${req.user.username}`);
      return res.status(403).json({
        success: false,
        error: "Privilèges administrateur requis",
      });
    }

    // Si l'utilisateur est admin par GitHub ID mais pas encore marqué en base
    if (isAdminByGithubId && req.user.role !== "admin") {
      await supabase
        .from("users")
        .update({ role: "admin" })
        .eq("id", req.user.id);

      req.user.role = "admin";
      console.log(`✅ Rôle admin mis à jour pour ${req.user.username}`);
    }

    console.log(`✅ Accès admin accordé à ${req.user.username}`);
    next();
  } catch (error) {
    console.error("❌ Erreur vérification admin:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur",
    });
  }
};

// Fonction pour logger les actions admin
const logAdminAction = async (
  adminId,
  actionType,
  targetType,
  targetId,
  details = {}
) => {
  try {
    await supabase.from("admin_actions").insert({
      admin_id: adminId,
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      details: details,
    });
  } catch (error) {
    console.error("❌ Erreur log action admin:", error);
  }
};

module.exports = {
  requireAdmin,
  logAdminAction,
  ADMIN_GITHUB_IDS,
};
