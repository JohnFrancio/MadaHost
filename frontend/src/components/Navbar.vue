<script setup>
import { useAuthStore } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";
import ThemeSwitcher from "./ThemeSwitcher.vue";
import {
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
} from "@heroicons/vue/24/outline";
import { ref, onMounted, computed, watch } from "vue";
// Ajoutez ceci dans la section <script setup> de votre Navbar.vue
import { useRealtimeStore } from "@/stores/realtime";

// Ajoutez cette ligne avec vos autres imports de stores
const realtimeStore = useRealtimeStore();

// Ajoutez cette computed property
const unreadMessagesCount = computed(() => realtimeStore.unreadMessagesCount);

const authStore = useAuthStore();
const themeStore = useThemeStore();
const mobileMenuOpen = ref(false);

// État local pour l'admin
const isAdmin = ref(false);
const checkingAdmin = ref(false);

// Fonction pour vérifier le statut admin
const checkAdminStatus = async () => {
  if (!authStore.isAuthenticated) {
    isAdmin.value = false;
    return;
  }

  try {
    checkingAdmin.value = true;
    // Import dynamique du store admin
    const { useAdminStore } = await import("@/stores/admin");
    const adminStore = useAdminStore();

    const hasAccess = await adminStore.checkAdminStatus();
    isAdmin.value = hasAccess;

    console.log("Admin status checked:", hasAccess);
  } catch (error) {
    console.error("Erreur vérification admin:", error);
    isAdmin.value = false;
  } finally {
    checkingAdmin.value = false;
  }
};

// Watch pour réagir aux changements d'authentification
watch(
  () => authStore.isAuthenticated,
  (newVal) => {
    if (newVal) {
      // Utilisateur connecté, vérifier le statut admin
      checkAdminStatus();
    } else {
      // Utilisateur déconnecté, reset admin
      isAdmin.value = false;
    }
  },
  { immediate: true }
);

onMounted(() => {
  // Vérification initiale si déjà connecté
  if (authStore.isAuthenticated) {
    checkAdminStatus();
  }
});
</script>

<template>
  <nav
    class="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800 transition-colors"
  >
    <div class="container mx-auto px-4">
      <div class="flex justify-between items-center h-16">
        <!-- Logo -->
        <router-link to="/" class="flex items-center space-x-3 group">
          <div
            class="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-200"
          >
            <span class="text-white font-bold text-lg">M</span>
          </div>
          <div class="hidden sm:block">
            <span
              class="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent"
              >MadaHost</span
            >
            <div class="text-xs text-gray-500 dark:text-gray-400 -mt-1">
              Deploy Platform
            </div>
          </div>
        </router-link>

        <!-- Navigation Desktop -->
        <div class="hidden md:flex items-center space-x-8">
          <template v-if="authStore.isAuthenticated">
            <router-link
              to="/dashboard"
              class="text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative group"
            >
              Dashboard
              <div
                class="absolute inset-x-0 bottom-0 h-0.5 bg-primary-600 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"
              ></div>
            </router-link>

            <!-- Lien admin avec vérification directe -->
            <router-link
              v-if="isAdmin"
              to="/admin"
              class="text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative group"
            >
              Administration
              <div
                class="absolute inset-x-0 bottom-0 h-0.5 bg-primary-600 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"
              ></div>
            </router-link>
            <router-link
              to="/messages"
              class="text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative group"
            >
              Support
              <div
                class="absolute inset-x-0 bottom-0 h-0.5 bg-primary-600 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"
              ></div>
              <!-- Badge de notifications non lues (optionnel) -->
              <span
                v-if="unreadMessagesCount > 0"
                class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center"
              >
                {{ unreadMessagesCount > 99 ? "99+" : unreadMessagesCount }}
              </span>
            </router-link>
          </template>
        </div>

        <!-- Actions droite -->
        <div class="flex items-center space-x-4">
          <!-- Theme Switcher -->
          <ThemeSwitcher />

          <!-- User Menu Desktop -->
          <template v-if="authStore.isAuthenticated">
            <div class="hidden md:flex items-center space-x-4">
              <div
                class="flex items-center space-x-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              >
                <img
                  v-if="authStore.user?.avatar_url"
                  :src="authStore.user.avatar_url"
                  :alt="authStore.user.username"
                  class="w-8 h-8 rounded-full ring-2 ring-white dark:ring-gray-800"
                />
                <UserCircleIcon v-else class="w-8 h-8 text-gray-400" />
                <div class="text-left">
                  <div
                    class="text-sm font-medium text-gray-900 dark:text-white"
                  >
                    {{ authStore.user?.username }}
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">
                    {{ isAdmin ? "Administrateur" : "Développeur" }}
                  </div>
                </div>
              </div>

              <button
                @click="authStore.logout"
                class="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Se déconnecter"
              >
                <ArrowRightOnRectangleIcon class="w-5 h-5" />
              </button>
            </div>
          </template>

          <template v-else>
            <router-link
              to="/login"
              class="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Se connecter
            </router-link>
          </template>

          <!-- Mobile menu button -->
          <button
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Bars3Icon v-if="!mobileMenuOpen" class="w-6 h-6" />
            <XMarkIcon v-else class="w-6 h-6" />
          </button>
        </div>
      </div>

      <!-- Mobile Menu -->
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="mobileMenuOpen"
          class="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
        >
          <div class="px-4 py-4 space-y-3">
            <template v-if="authStore.isAuthenticated">
              <!-- User info mobile -->
              <div
                class="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <img
                  v-if="authStore.user?.avatar_url"
                  :src="authStore.user.avatar_url"
                  :alt="authStore.user.username"
                  class="w-10 h-10 rounded-full"
                />
                <UserCircleIcon v-else class="w-10 h-10 text-gray-400" />
                <div>
                  <div class="font-medium text-gray-900 dark:text-white">
                    {{ authStore.user?.username }}
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    {{ isAdmin ? "Administrateur" : "Développeur" }}
                  </div>
                </div>
              </div>

              <!-- Navigation mobile -->
              <router-link
                to="/dashboard"
                @click="mobileMenuOpen = false"
                class="block px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Dashboard
              </router-link>
              <router-link
                to="/messages"
                class="text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative group"
              >
                Support
                <!-- Badge de notifications non lues (optionnel) -->
                <span
                  v-if="unreadMessagesCount > 0"
                  class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center"
                >
                  {{ unreadMessagesCount > 99 ? "99+" : unreadMessagesCount }}
                </span>
              </router-link>

              <!-- Lien admin mobile -->
              <router-link
                v-if="isAdmin"
                to="/admin"
                @click="mobileMenuOpen = false"
                class="block px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Administration
              </router-link>

              <!-- Déconnexion mobile -->
              <button
                @click="authStore.logout"
                class="w-full flex items-center px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <ArrowRightOnRectangleIcon class="w-5 h-5 mr-2" />
                Se déconnecter
              </button>
            </template>

            <template v-else>
              <router-link
                to="/login"
                @click="mobileMenuOpen = false"
                class="block w-full text-center bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-3 rounded-lg font-medium"
              >
                Se connecter
              </router-link>
            </template>
          </div>
        </div>
      </transition>
    </div>
  </nav>
</template>
