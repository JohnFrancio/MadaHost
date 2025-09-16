// frontend/src/stores/theme.js
import { defineStore } from "pinia";

export const useThemeStore = defineStore("theme", {
  state: () => ({
    currentTheme: "light", // light, dark, auto
    systemPreference: "light",
  }),

  getters: {
    isDark: (state) => {
      if (state.currentTheme === "auto") {
        return state.systemPreference === "dark";
      }
      return state.currentTheme === "dark";
    },
    
    themeClass: (state) => {
      return state.isDark ? "dark" : "light";
    },
  },

  actions: {
    setTheme(theme) {
      this.currentTheme = theme;
      this.applyTheme();
      this.saveToStorage();
    },

    applyTheme() {
      const html = document.documentElement;
      
      if (this.isDark) {
        html.classList.add("dark");
      } else {
        html.classList.remove("dark");
      }
    },

    detectSystemPreference() {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      this.systemPreference = mediaQuery.matches ? "dark" : "light";
      
      // Écouter les changements
      mediaQuery.addEventListener("change", (e) => {
        this.systemPreference = e.matches ? "dark" : "light";
        if (this.currentTheme === "auto") {
          this.applyTheme();
        }
      });
    },

    loadFromStorage() {
      const saved = localStorage.getItem("madahost-theme");
      if (saved && ["light", "dark", "auto"].includes(saved)) {
        this.currentTheme = saved;
      }
    },

    saveToStorage() {
      localStorage.setItem("madahost-theme", this.currentTheme);
    },

    init() {
      this.detectSystemPreference();
      this.loadFromStorage();
      this.applyTheme();
    },
  },
});