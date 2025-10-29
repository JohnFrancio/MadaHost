import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://api.madahost.me/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Intercepteur pour les requêtes
api.interceptors.request.use(
  (config) => {
    console.log("🚀 Requête:", config.method.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error("❌ Erreur requête:", error);
    return Promise.reject(error);
  }
);

// Intercepteur pour les réponses
api.interceptors.response.use(
  (response) => {
    console.log("✅ Réponse:", response.config.url, response.status);
    return response;
  },
  (error) => {
    console.error(
      "❌ Erreur réponse:",
      error.config?.url,
      error.response?.status
    );

    // Rediriger vers login si non authentifié
    if (error.response?.status === 401) {
      console.warn("⚠️ Non authentifié, redirection...");
      window.location.href = "/";
    }

    return Promise.reject(error);
  }
);

export default api;
