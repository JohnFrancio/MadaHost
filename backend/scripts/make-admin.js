// backend/scripts/make-admin.js
const { createClient } = require("@supabase/supabase-js");
const path = require("path");

// Charger le .env depuis le répertoire parent (backend/)
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

console.log(
  "SUPABASE_URL:",
  process.env.SUPABASE_URL ? "Défini" : "Non défini"
);
console.log(
  "SUPABASE_SERVICE_ROLE_KEY:",
  process.env.SUPABASE_SERVICE_ROLE_KEY ? "Défini" : "Non défini"
);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Variables d'environnement Supabase manquantes");
  console.error(
    "Vérifiez que SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont définis dans .env"
  );
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADMIN_GITHUB_IDS = ["115089055"];

async function makeUsersAdmin() {
  try {
    console.log("🔍 Recherche des utilisateurs à promouvoir...");

    for (const githubId of ADMIN_GITHUB_IDS) {
      console.log(`📝 Traitement de l'utilisateur GitHub ID: ${githubId}`);

      // D'abord, vérifier si l'utilisateur existe
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("*")
        .eq("github_id", githubId)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        console.error(
          `❌ Erreur lors de la recherche pour ${githubId}:`,
          checkError
        );
        continue;
      }

      if (!existingUser) {
        console.log(
          `⚠️ Utilisateur avec GitHub ID ${githubId} non trouvé dans la base de données`
        );
        console.log(
          "🔍 L'utilisateur doit se connecter au moins une fois avant d'être promu admin"
        );
        continue;
      }

      console.log(
        `👤 Utilisateur trouvé: ${existingUser.username} (rôle actuel: ${
          existingUser.role || "user"
        })`
      );

      if (existingUser.role === "admin") {
        console.log(`✨ ${existingUser.username} est déjà administrateur`);
        continue;
      }

      // Mettre à jour le rôle
      const { data, error } = await supabase
        .from("users")
        .update({ role: "admin" })
        .eq("github_id", githubId)
        .select();

      if (error) {
        console.error(
          `❌ Erreur lors de la mise à jour pour ${githubId}:`,
          error
        );
        continue;
      }

      if (data && data.length > 0) {
        console.log(`✅ ${data[0].username} est maintenant administrateur`);
      }
    }

    console.log("🎉 Script terminé");
  } catch (error) {
    console.error("❌ Erreur générale du script:", error);
  }
}

makeUsersAdmin();
