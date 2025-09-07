const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const axios = require("axios");

const router = express.Router();

// Configuration Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware d'authentification
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentification requise" });
  }
  next();
};

// Obtenir tous les projets de l'utilisateur
router.get("/", requireAuth, async (req, res) => {
  try {
    const { data: projects, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Erreur lors de la récupération des projets:", error);
      return res.status(500).json({ error: "Erreur serveur" });
    }

    res.json({ projects });
  } catch (error) {
    console.error("❌ Erreur:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Obtenir les repos GitHub de l'utilisateur
router.get("/github-repos", requireAuth, async (req, res) => {
  try {
    // Récupérer le token d'accès de l'utilisateur
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("access_token")
      .eq("id", req.user.id)
      .single();

    if (userError || !userData.access_token) {
      return res.status(401).json({ error: "Token GitHub non trouvé" });
    }

    // Appeler l'API GitHub
    const response = await axios.get("https://api.github.com/user/repos", {
      headers: {
        Authorization: `token ${userData.access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
      params: {
        sort: "updated",
        per_page: 50,
        type: "owner",
      },
    });

    const repos = response.data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      private: repo.private,
      html_url: repo.html_url,
      default_branch: repo.default_branch,
      updated_at: repo.updated_at,
      language: repo.language,
    }));

    res.json({ repos });
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des repos GitHub:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des repos" });
  }
});

// Créer un nouveau projet
router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      name,
      github_repo,
      branch = "main",
      build_command,
      output_dir,
    } = req.body;

    if (!name || !github_repo) {
      return res.status(400).json({ error: "Nom et repo GitHub requis" });
    }

    // Générer un sous-domaine unique
    const subdomain = `${name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")}-${Date.now()}`;
    const domain = `${subdomain}.madahost.dev`; // Tu peux changer le domaine principal

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        user_id: req.user.id,
        name,
        github_repo,
        branch,
        build_command: build_command || "npm run build",
        output_dir: output_dir || "dist",
        domain,
        status: "created",
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Erreur lors de la création du projet:", error);
      return res
        .status(500)
        .json({ error: "Erreur lors de la création du projet" });
    }

    console.log("✅ Projet créé:", project.name);
    res.status(201).json({ project });
  } catch (error) {
    console.error("❌ Erreur:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
