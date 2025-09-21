import { createApp, watch } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import App from "./App.vue";
import "./style.css";
import { useThemeStore } from "@/stores/theme";
import { useRealtimeStore } from "@/stores/realtime";
import { useAuthStore } from "@/stores/auth";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// Initialiser le thème avant le montage
const themeStore = useThemeStore();
themeStore.init();

app.mount("#app");

const authStore = useAuthStore();
const realtimeStore = useRealtimeStore();

// Surveiller les changements d'authentification
watch(
  () => authStore.isAuthenticated,
  async (isAuthenticated) => {
    if (isAuthenticated && authStore.user) {
      await realtimeStore.initializeRealtime();
    } else {
      realtimeStore.disconnect();
    }
  }
);

// Initialiser si déjà connecté
if (authStore.isAuthenticated && authStore.user) {
  realtimeStore.initializeRealtime();
}
