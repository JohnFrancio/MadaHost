// frontend/src/router/index.js
import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import Home from "@/views/Home.vue";
import Dashboard from "@/views/Dashboard.vue";
import Login from "@/views/Login.vue";

const routes = [
  {
    path: "/",
    name: "Home",
    component: Home,
  },
  {
    path: "/login",
    name: "Login",
    component: Login,
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  {
    path: "/project/:id",
    name: "ProjectDetail",
    component: () => import("@/views/ProjectDetail.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/admin",
    name: "Admin",
    component: () => import("@/views/AdminDashboard.vue"),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: "/messages",
    name: "Messages",
    component: () => import("@/views/Messages.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/admin/messages",
    name: "AdminMessages",
    component: () => import("@/views/AdminMessages.vue"),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Guard corrigé
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // Vérifier l'authentification d'abord
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return next("/login");
  }

  // Pour les routes admin, vérifier les privilèges
  if (to.meta.requiresAdmin) {
    try {
      // Import dynamique du store admin
      const { useAdminStore } = await import("@/stores/admin");
      const adminStore = useAdminStore();

      // Vérifier le statut admin
      const hasAccess = await adminStore.checkAdminStatus();
      if (!hasAccess) {
        console.warn("Accès admin refusé, redirection vers dashboard");
        return next("/dashboard");
      }
    } catch (error) {
      console.error("Erreur vérification admin:", error);
      return next("/dashboard");
    }
  }

  next();
});

export default router;
