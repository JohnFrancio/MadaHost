// backend/src/routes/admin.js - Version complète
const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { requireAuth } = require("../middleware/auth");
const { requireAdmin, logAdminAction } = require("../middleware/admin");

// Dashboard admin - statistiques complètes
router.get("/dashboard", requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log(`📊 Dashboard admin demandé par ${req.user.username}`);

    // Statistiques générales
    const [
      { count: totalUsers },
      { count: totalProjects },
      { count: totalDeployments },
      { count: activeProjects },
      { count: successfulDeployments },
      { count: failedDeployments },
    ] = await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }),
      supabase.from("projects").select("*", { count: "exact", head: true }),
      supabase.from("deployments").select("*", { count: "exact", head: true }),
      supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("deployments")
        .select("*", { count: "exact", head: true })
        .eq("status", "success"),
      supabase
        .from("deployments")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed"),
    ]);

    // Nouveaux utilisateurs ce mois
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const { count: newUsersThisMonth } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thisMonth.toISOString());

    // Déploiements récents (améliorés)
    const { data: recentDeployments } = await supabase
      .from("deployments")
      .select(
        `
        *,
        projects (
          name,
          user_id,
          framework,
          domain,
          users (
            username,
            avatar_url,
            role
          )
        )
      `
      )
      .order("started_at", { ascending: false })
      .limit(10);

    // Utilisateurs récents (plus d'infos)
    const { data: recentUsers } = await supabase
      .from("users")
      .select(
        `
        id, 
        username, 
        avatar_url, 
        created_at, 
        role,
        github_id,
        email
      `
      )
      .order("created_at", { ascending: false })
      .limit(10);

    // Projets les plus actifs (améliorés)
    const { data: activeProjectsData } = await supabase
      .from("projects")
      .select(
        `
        *,
        users (
          username,
          avatar_url,
          role
        )
      `
      )
      .eq("status", "active")
      .order("last_deployed", { ascending: false })
      .limit(10);

    // Statistiques par framework
    const { data: frameworkStats } = await supabase
      .from("projects")
      .select("framework")
      .neq("framework", null);

    const frameworks = {};
    frameworkStats?.forEach((project) => {
      if (project.framework) {
        frameworks[project.framework] =
          (frameworks[project.framework] || 0) + 1;
      }
    });

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers || 0,
        totalProjects: totalProjects || 0,
        totalDeployments: totalDeployments || 0,
        activeProjects: activeProjects || 0,
        successfulDeployments: successfulDeployments || 0,
        failedDeployments: failedDeployments || 0,
        newUsersThisMonth: newUsersThisMonth || 0,
        successRate:
          totalDeployments > 0
            ? Math.round(
                ((successfulDeployments || 0) / totalDeployments) * 100
              )
            : 0,
        frameworks,
      },
      recentDeployments: recentDeployments || [],
      recentUsers: recentUsers || [],
      activeProjects: activeProjectsData || [],
    });
  } catch (error) {
    console.error("❌ Erreur dashboard admin:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des statistiques",
    });
  }
});

// Gestion des utilisateurs - Version améliorée
router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      sortBy = "created_at",
      sortOrder = "desc",
      dateRange = "all",
    } = req.query;

    const offset = (page - 1) * limit;

    let query = supabase.from("users").select(
      `
      id,
      github_id,
      username,
      email,
      avatar_url,
      role,
      created_at,
      updated_at
    `,
      { count: "exact" }
    );

    // Filtres de recherche
    if (search) {
      query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (role && role !== "all") {
      query = query.eq("role", role);
    }

    // Filtre par date
    if (dateRange !== "all") {
      const now = new Date();
      let dateThreshold;

      switch (dateRange) {
        case "1d":
          dateThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      if (dateThreshold) {
        query = query.gte("created_at", dateThreshold.toISOString());
      }
    }

    // Tri
    const validSortFields = ["created_at", "updated_at", "username", "role"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "created_at";
    const order =
      sortOrder === "asc" ? { ascending: true } : { ascending: false };

    const {
      data: users,
      error,
      count,
    } = await query.range(offset, offset + limit - 1).order(sortField, order);

    if (error) throw error;

    // Ajouter le nombre de projets pour chaque utilisateur
    const usersWithStats = await Promise.all(
      (users || []).map(async (user) => {
        const { count: projectCount } = await supabase
          .from("projects")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        return {
          ...user,
          projects: { count: projectCount || 0 },
        };
      })
    );

    await logAdminAction(req.user.id, "list_users", "users", null, {
      search,
      role,
      page,
      filters: { sortBy, sortOrder, dateRange },
    });

    res.json({
      success: true,
      users: usersWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("❌ Erreur liste utilisateurs:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des utilisateurs",
    });
  }
});

// Promouvoir/Rétrograder un utilisateur
router.patch(
  "/users/:userId/role",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({
          success: false,
          error: "Rôle invalide",
        });
      }

      // Vérifier que l'utilisateur existe
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (userError || !user) {
        return res.status(404).json({
          success: false,
          error: "Utilisateur non trouvé",
        });
      }

      // Empêcher de se rétrograder soi-même
      if (userId === req.user.id && role === "user") {
        return res.status(400).json({
          success: false,
          error: "Vous ne pouvez pas vous rétrograder vous-même",
        });
      }

      // Mettre à jour le rôle
      const { data: updatedUser, error: updateError } = await supabase
        .from("users")
        .update({ role, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .select()
        .single();

      if (updateError) throw updateError;

      await logAdminAction(
        req.user.id,
        role === "admin" ? "promote_user" : "demote_user",
        "user",
        userId,
        { oldRole: user.role, newRole: role, username: user.username }
      );

      res.json({
        success: true,
        message: `Utilisateur ${
          role === "admin" ? "promu" : "rétrogradé"
        } avec succès`,
        user: updatedUser,
      });
    } catch (error) {
      console.error("❌ Erreur modification rôle:", error);
      res.status(500).json({
        success: false,
        error: "Erreur lors de la modification du rôle",
      });
    }
  }
);

// Suspendre/Activer un utilisateur
router.patch(
  "/users/:userId/status",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      if (!["active", "suspended"].includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Statut invalide",
        });
      }

      // Vérifier que l'utilisateur existe
      const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "Utilisateur non trouvé",
        });
      }

      // Empêcher de se suspendre soi-même
      if (userId === req.user.id && status === "suspended") {
        return res.status(400).json({
          success: false,
          error: "Vous ne pouvez pas vous suspendre vous-même",
        });
      }

      await logAdminAction(
        req.user.id,
        status === "suspended" ? "suspend_user" : "activate_user",
        "user",
        userId,
        { username: user.username, status }
      );

      res.json({
        success: true,
        message: `Utilisateur ${
          status === "suspended" ? "suspendu" : "activé"
        } avec succès`,
      });
    } catch (error) {
      console.error("❌ Erreur modification statut:", error);
      res.status(500).json({
        success: false,
        error: "Erreur lors de la modification du statut",
      });
    }
  }
);

// Supprimer un utilisateur
router.delete("/users/:userId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason = "" } = req.body;

    // Vérifier que l'utilisateur existe
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Utilisateur non trouvé",
      });
    }

    // Empêcher de se supprimer soi-même
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: "Vous ne pouvez pas vous supprimer vous-même",
      });
    }

    // Supprimer d'abord tous les projets et déploiements de l'utilisateur
    const { data: userProjects } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", userId);

    if (userProjects && userProjects.length > 0) {
      const projectIds = userProjects.map((p) => p.id);

      // Supprimer les déploiements
      await supabase.from("deployments").delete().in("project_id", projectIds);

      // Supprimer les projets
      await supabase.from("projects").delete().eq("user_id", userId);
    }

    // Supprimer l'utilisateur
    const { error: deleteError } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (deleteError) throw deleteError;

    await logAdminAction(req.user.id, "delete_user", "user", userId, {
      username: user.username,
      reason,
      projectsDeleted: userProjects?.length || 0,
    });

    res.json({
      success: true,
      message: "Utilisateur supprimé avec succès",
    });
  } catch (error) {
    console.error("❌ Erreur suppression utilisateur:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la suppression de l'utilisateur",
    });
  }
});

// Gestion des projets - Vue admin améliorée
router.get("/projects", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      framework,
      owner,
      sortBy = "created_at",
      sortOrder = "desc",
    } = req.query;

    const offset = (page - 1) * limit;

    let query = supabase.from("projects").select(
      `
      *,
      users (
        id,
        username,
        avatar_url,
        role,
        email
      )
    `,
      { count: "exact" }
    );

    // Filtres de recherche
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,github_repo.ilike.%${search}%,domain.ilike.%${search}%`
      );
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (framework && framework !== "all") {
      query = query.eq("framework", framework);
    }

    if (owner && owner !== "all") {
      query = query.eq("user_id", owner);
    }

    // Tri
    const validSortFields = [
      "created_at",
      "updated_at",
      "name",
      "status",
      "last_deployed",
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "created_at";
    const order =
      sortOrder === "asc" ? { ascending: true } : { ascending: false };

    const {
      data: projects,
      error,
      count,
    } = await query.range(offset, offset + limit - 1).order(sortField, order);

    if (error) throw error;

    // Ajouter les statistiques de déploiement pour chaque projet
    const projectsWithStats = await Promise.all(
      (projects || []).map(async (project) => {
        const [
          { count: totalDeployments },
          { count: successfulDeployments },
          { count: failedDeployments },
        ] = await Promise.all([
          supabase
            .from("deployments")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id),
          supabase
            .from("deployments")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id)
            .eq("status", "success"),
          supabase
            .from("deployments")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id)
            .eq("status", "failed"),
        ]);

        return {
          ...project,
          deployments: {
            total: totalDeployments || 0,
            successful: successfulDeployments || 0,
            failed: failedDeployments || 0,
            successRate:
              totalDeployments > 0
                ? Math.round(
                    ((successfulDeployments || 0) / totalDeployments) * 100
                  )
                : 0,
          },
        };
      })
    );

    res.json({
      success: true,
      projects: projectsWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("❌ Erreur liste projets admin:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des projets",
    });
  }
});

// Modifier le statut d'un projet
router.patch(
  "/projects/:projectId/status",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { status } = req.body;

      const validStatuses = ["active", "inactive", "building", "error"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Statut invalide",
        });
      }

      const { data: project, error: updateError } = await supabase
        .from("projects")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)
        .select(
          `
        *,
        users (username)
      `
        )
        .single();

      if (updateError) throw updateError;

      await logAdminAction(
        req.user.id,
        "update_project_status",
        "project",
        projectId,
        {
          projectName: project.name,
          newStatus: status,
          ownerUsername: project.users?.username,
        }
      );

      res.json({
        success: true,
        message: "Statut du projet mis à jour",
        project,
      });
    } catch (error) {
      console.error("❌ Erreur modification statut projet:", error);
      res.status(500).json({
        success: false,
        error: "Erreur lors de la modification du statut",
      });
    }
  }
);

// Supprimer un projet (admin)
router.delete(
  "/projects/:projectId",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { projectId } = req.params;

      // Récupérer les infos du projet pour les logs
      const { data: project } = await supabase
        .from("projects")
        .select(
          `
        *,
        users (
          username
        )
      `
        )
        .eq("id", projectId)
        .single();

      if (!project) {
        return res.status(404).json({
          success: false,
          error: "Projet non trouvé",
        });
      }

      // Supprimer d'abord tous les déploiements
      await supabase.from("deployments").delete().eq("project_id", projectId);

      // Supprimer le projet
      const { error: deleteError } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);

      if (deleteError) throw deleteError;

      await logAdminAction(
        req.user.id,
        "delete_project",
        "project",
        projectId,
        {
          projectName: project.name,
          ownerUsername: project.users?.username,
          reason: req.body.reason || "Suppression administrative",
        }
      );

      res.json({
        success: true,
        message: "Projet supprimé avec succès",
      });
    } catch (error) {
      console.error("❌ Erreur suppression projet admin:", error);
      res.status(500).json({
        success: false,
        error: "Erreur lors de la suppression du projet",
      });
    }
  }
);

// Déploiements avec filtres avancés
router.get("/deployments", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 30,
      search,
      status,
      project,
      dateRange = "7d",
      sortBy = "started_at",
      sortOrder = "desc",
    } = req.query;

    const offset = (page - 1) * limit;

    let query = supabase.from("deployments").select(
      `
      *,
      projects (
        id,
        name,
        github_repo,
        domain,
        framework,
        users (
          id,
          username,
          avatar_url,
          role
        )
      )
    `,
      { count: "exact" }
    );

    // Filtres de recherche
    if (search) {
      // Note: Le filtrage sur les relations nécessite une approche différente avec Supabase
      query = query.or(`commit_hash.ilike.%${search}%`);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (project && project !== "all") {
      query = query.eq("project_id", project);
    }

    // Filtre par date
    if (dateRange !== "all") {
      const now = new Date();
      let dateThreshold;

      switch (dateRange) {
        case "1d":
          dateThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      if (dateThreshold) {
        query = query.gte("started_at", dateThreshold.toISOString());
      }
    }

    // Tri
    const validSortFields = ["started_at", "completed_at", "status"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "started_at";
    const order =
      sortOrder === "asc" ? { ascending: true } : { ascending: false };

    const {
      data: deployments,
      error,
      count,
    } = await query.range(offset, offset + limit - 1).order(sortField, order);

    if (error) throw error;

    res.json({
      success: true,
      deployments: deployments || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("❌ Erreur liste déploiements admin:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des déploiements",
    });
  }
});

// Logs des actions admin
router.get("/logs", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action_type,
      admin_id,
      dateRange = "30d",
      sortBy = "created_at",
      sortOrder = "desc",
    } = req.query;

    const offset = (page - 1) * limit;

    let query = supabase.from("admin_actions").select(
      `
      *,
      users (
        username,
        avatar_url
      )
    `,
      { count: "exact" }
    );

    if (action_type && action_type !== "all") {
      query = query.eq("action_type", action_type);
    }

    if (admin_id && admin_id !== "all") {
      query = query.eq("admin_id", admin_id);
    }

    // Filtre par date
    if (dateRange !== "all") {
      const now = new Date();
      let dateThreshold;

      switch (dateRange) {
        case "1d":
          dateThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      if (dateThreshold) {
        query = query.gte("created_at", dateThreshold.toISOString());
      }
    }

    const {
      data: logs,
      error,
      count,
    } = await query
      .range(offset, offset + limit - 1)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      logs: logs || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("❌ Erreur récupération logs admin:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des logs",
    });
  }
});

// Route pour récupérer la liste des administrateurs
router.get("/admins", requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log(`👑 Récupération liste des admins par ${req.user.username}`);

    const { data: admins, error } = await supabase
      .from("users")
      .select("id, username, avatar_url, created_at")
      .eq("role", "admin")
      .order("username", { ascending: true });

    if (error) {
      console.error("❌ Erreur récupération admins:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la récupération des administrateurs",
      });
    }

    await logAdminAction(req.user.id, "view_admins", "users", null, {
      count: admins?.length || 0,
    });

    res.json({
      success: true,
      admins: admins || [],
      count: admins?.length || 0,
    });
  } catch (error) {
    console.error("❌ Erreur serveur:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// Recherche globale
router.get("/search", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { query: searchQuery, limit = 10 } = req.query;

    if (!searchQuery) {
      return res.json({
        success: true,
        results: { users: [], projects: [], deployments: [] },
      });
    }

    // Recherche dans les utilisateurs
    const { data: users } = await supabase
      .from("users")
      .select("id, username, email, avatar_url, role")
      .or(`username.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
      .limit(limit);

    // Recherche dans les projets
    const { data: projects } = await supabase
      .from("projects")
      .select(
        `
        id, name, github_repo, status, framework,
        users (username, avatar_url)
      `
      )
      .or(`name.ilike.%${searchQuery}%,github_repo.ilike.%${searchQuery}%`)
      .limit(limit);

    // Recherche dans les déploiements récents
    const { data: deployments } = await supabase
      .from("deployments")
      .select(
        `
        id, status, started_at, commit_hash,
        projects (name, users (username))
      `
      )
      .or(`commit_hash.ilike.%${searchQuery}%`)
      .order("started_at", { ascending: false })
      .limit(limit);

    res.json({
      success: true,
      results: {
        users: users || [],
        projects: projects || [],
        deployments: deployments || [],
      },
    });
  } catch (error) {
    console.error("❌ Erreur recherche globale:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la recherche",
    });
  }
});

// Export de données
router.get("/export/:type", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const { format = "csv" } = req.query;

    let data = [];
    let filename = `madahost_${type}_${Date.now()}`;

    switch (type) {
      case "users":
        const { data: usersData } = await supabase
          .from("users")
          .select("username, email, role, created_at, updated_at");
        data = usersData;
        break;

      case "projects":
        const { data: projectsData } = await supabase.from("projects").select(`
            name, github_repo, status, framework, domain, created_at,
            users (username)
          `);
        data = projectsData;
        break;

      case "deployments":
        const { data: deploymentsData } = await supabase
          .from("deployments")
          .select(
            `
            status, started_at, completed_at, commit_hash,
            projects (name, users (username))
          `
          )
          .order("started_at", { ascending: false })
          .limit(1000);
        data = deploymentsData;
        break;

      default:
        return res.status(400).json({
          success: false,
          error: "Type d'export non supporté",
        });
    }

    if (format === "csv") {
      const csv = convertToCSV(data);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}.csv"`
      );
      res.send(csv);
    } else if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}.json"`
      );
      res.json(data);
    } else {
      return res.status(400).json({
        success: false,
        error: "Format non supporté",
      });
    }

    await logAdminAction(req.user.id, "export_data", type, null, {
      format,
      recordCount: data.length,
    });
  } catch (error) {
    console.error("❌ Erreur export:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de l'export",
    });
  }
});

// Analytics et rapports
router.get("/analytics", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { period = "30d" } = req.query;

    // Calculer la date de début selon la période
    const now = new Date();
    let startDate;

    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Croissance des utilisateurs
    const { data: userGrowth } = await supabase
      .from("users")
      .select("created_at")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true });

    // Tendances des déploiements
    const { data: deploymentTrends } = await supabase
      .from("deployments")
      .select("started_at, status")
      .gte("started_at", startDate.toISOString())
      .order("started_at", { ascending: true });

    // Projets par framework
    const { data: projectsByFramework } = await supabase
      .from("projects")
      .select("framework")
      .neq("framework", null);

    // Taux d'erreur par jour
    const { data: errorRates } = await supabase
      .from("deployments")
      .select("started_at, status")
      .gte("started_at", startDate.toISOString())
      .in("status", ["success", "failed"])
      .order("started_at", { ascending: true });

    // Traitement des données pour les graphiques
    const processedData = {
      userGrowth: processTimeSeriesData(userGrowth, "created_at"),
      deploymentTrends: processDeploymentTrends(deploymentTrends),
      projectsByFramework: processFrameworkData(projectsByFramework),
      errorRates: processErrorRates(errorRates),
    };

    res.json({
      success: true,
      analytics: processedData,
      period,
    });
  } catch (error) {
    console.error("❌ Erreur analytics admin:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des analytics",
    });
  }
});

// Fonctions utilitaires pour le traitement des données
function processTimeSeriesData(data, dateField) {
  const dailyCounts = {};

  data?.forEach((item) => {
    const date = new Date(item[dateField]).toDateString();
    dailyCounts[date] = (dailyCounts[date] || 0) + 1;
  });

  return Object.entries(dailyCounts)
    .map(([date, count]) => ({
      date,
      count,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function processDeploymentTrends(data) {
  const dailyStats = {};

  data?.forEach((deployment) => {
    const date = new Date(deployment.started_at).toDateString();
    if (!dailyStats[date]) {
      dailyStats[date] = { success: 0, failed: 0, total: 0 };
    }
    dailyStats[date][deployment.status] =
      (dailyStats[date][deployment.status] || 0) + 1;
    dailyStats[date].total += 1;
  });

  return Object.entries(dailyStats)
    .map(([date, stats]) => ({
      date,
      ...stats,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function processFrameworkData(data) {
  const frameworks = {};

  data?.forEach((project) => {
    if (project.framework) {
      frameworks[project.framework] = (frameworks[project.framework] || 0) + 1;
    }
  });

  return Object.entries(frameworks).map(([name, count]) => ({
    name,
    count,
  }));
}

function processErrorRates(data) {
  const dailyRates = {};

  data?.forEach((deployment) => {
    const date = new Date(deployment.started_at).toDateString();
    if (!dailyRates[date]) {
      dailyRates[date] = { success: 0, failed: 0 };
    }
    dailyRates[date][deployment.status] += 1;
  });

  return Object.entries(dailyRates)
    .map(([date, stats]) => ({
      date,
      errorRate:
        stats.failed + stats.success > 0
          ? Math.round((stats.failed / (stats.failed + stats.success)) * 100)
          : 0,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function convertToCSV(data) {
  if (!data || data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(",")];

  data.forEach((row) => {
    const values = headers.map((header) => {
      const value = row[header];
      if (typeof value === "object" && value !== null) {
        return JSON.stringify(value).replace(/"/g, '""');
      }
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  });

  return csvRows.join("\n");
}

module.exports = router;
