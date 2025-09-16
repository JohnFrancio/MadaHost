import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import App from "./App.vue";
import "./style.css";
import { useThemeStore } from "@/stores/theme";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// Initialiser le thème avant le montage
const themeStore = useThemeStore();
themeStore.init();

app.mount("#app");
