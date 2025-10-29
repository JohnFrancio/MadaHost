import { defineStore } from "pinia";
import api from "@/utils/axios";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    isAuthenticated: false,
    loading: false,
  }),

  getters: {
    getUser: (state) => state.user,
    isLoggedIn: (state) => state.isAuthenticated,
  },

  actions: {
    async checkAuth() {
      try {
        this.loading = true;
        const response = await api.get("/auth/me");
        this.user = response.data.user;
        this.isAuthenticated = true;

        console.log("User data from auth:", response.data.user);

        // Ne pas charger le store admin ici, laisser le router s'en occuper
      } catch (error) {
        this.user = null;
        this.isAuthenticated = false;
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      try {
        await api.post("/auth/logout");
        this.user = null;
        this.isAuthenticated = false;
        // Rediriger vers la page d'accueil
        window.location.href = "/";
      } catch (error) {
        console.error("Erreur lors de la déconnexion:", error);
      }
    },

    loginWithGitHub() {
      window.location.href = `${import.meta.env.VITE_API_URL}/auth/github`;
    },
  },
});
