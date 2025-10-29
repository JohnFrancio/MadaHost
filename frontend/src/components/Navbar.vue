<!-- frontend/src/components/Navbar.vue - Version améliorée -->
<script setup>
import { useAuthStore } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";
import { useRealtimeStore } from "@/stores/realtime";
import ThemeSwitcher from "./ThemeSwitcher.vue";
import {
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  ChatBubbleBottomCenterTextIcon,
} from "@heroicons/vue/24/outline";
import { ref, onMounted, computed, watch } from "vue";

const authStore = useAuthStore();
const themeStore = useThemeStore();
const realtimeStore = useRealtimeStore();
const mobileMenuOpen = ref(false);

// État local pour l'admin
const isAdmin = ref(false);
const checkingAdmin = ref(false);

// Messages non lus
const unreadMessagesCount = computed(() => realtimeStore.unreadMessagesCount);

// Fonction pour vérifier le statut admin
const checkAdminStatus = async () => {
  if (!authStore.isAuthenticated) {
    isAdmin.value = false;
    return;
  }

  try {
    checkingAdmin.value = true;
    const { useAdminStore } = await import("@/stores/admin");
    const adminStore = useAdminStore();
    const hasAccess = await adminStore.checkAdminStatus();
    isAdmin.value = hasAccess;
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
      checkAdminStatus();
    } else {
      isAdmin.value = false;
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (authStore.isAuthenticated) {
    checkAdminStatus();
  }
});
</script>

<template>
  <nav
    class="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800 transition-colors sticky top-0 z-40 backdrop-blur-lg bg-white/90 dark:bg-gray-900/90"
  >
    <div class="container mx-auto px-4">
      <div class="flex justify-between items-center h-16">
        <!-- Logo -->
        <router-link to="/" class="flex items-center space-x-3 group">
          <div
            class="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-200 group-hover:scale-105"
          >
            <span class="text-white font-bold text-lg">M</span>
          </div>
          <div class="hidden sm:block">
            <span
              class="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent"
            >
              MadaHost
            </span>
            <div class="text-xs text-gray-500 dark:text-gray-400 -mt-1">
              Deploy Platform
            </div>
          </div>
        </router-link>

        <!-- Navigation Desktop -->
        <div class="hidden md:flex items-center space-x-1">
          <template v-if="authStore.isAuthenticated">
            <router-link
              to="/dashboard"
              class="relative px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all group"
            >
              Dashboard
              <span
                class="absolute inset-x-4 bottom-0 h-0.5 bg-primary-600 dark:bg-primary-400 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"
              ></span>
            </router-link>

            <router-link
              v-if="isAdmin"
              to="/admin"
              class="relative px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all group"
            >
              Administration
              <span
                class="absolute inset-x-4 bottom-0 h-0.5 bg-primary-600 dark:bg-primary-400 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"
              ></span>
            </router-link>

            <router-link
              to="/messages"
              class="relative px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all group"
            >
              <div class="flex items-center space-x-2">
                <ChatBubbleBottomCenterTextIcon class="w-5 h-5" />
                <span>Support</span>
                <!-- Badge notifications -->
                <span
                  v-if="unreadMessagesCount > 0"
                  class="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse"
                >
                  {{ unreadMessagesCount > 9 ? "9+" : unreadMessagesCount }}
                </span>
              </div>
              <span
                class="absolute inset-x-4 bottom-0 h-0.5 bg-primary-600 dark:bg-primary-400 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"
              ></span>
            </router-link>
          </template>

          <template v-else>
            <a
              href="#docs"
              class="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              Documentation
            </a>
            <a
              href="#pricing"
              class="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              Tarifs
            </a>
          </template>
        </div>

        <!-- Actions droite -->
        <div class="flex items-center space-x-3">
          <!-- Theme Switcher -->
          <ThemeSwitcher />

          <!-- User Menu Desktop -->
          <template v-if="authStore.isAuthenticated">
            <div class="hidden md:flex items-center space-x-3">
              <div
                class="flex items-center space-x-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
              >
                <img
                  v-if="authStore.user?.avatar_url"
                  :src="authStore.user.avatar_url"
                  :alt="authStore.user.username"
                  class="w-8 h-8 rounded-full ring-2 ring-white dark:ring-gray-800 object-cover"
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
                class="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                title="Se déconnecter"
              >
                <ArrowRightOnRectangleIcon class="w-5 h-5" />
              </button>
            </div>
          </template>

          <template v-else>
            <router-link
              to="/login"
              class="hidden md:inline-flex btn-primary text-sm px-5 py-2"
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
                class="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <img
                  v-if="authStore.user?.avatar_url"
                  :src="authStore.user.avatar_url"
                  :alt="authStore.user.username"
                  class="w-10 h-10 rounded-full object-cover"
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
                class="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium"
              >
                Dashboard
              </router-link>

              <router-link
                v-if="isAdmin"
                to="/admin"
                @click="mobileMenuOpen = false"
                class="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium"
              >
                Administration
              </router-link>

              <router-link
                to="/messages"
                @click="mobileMenuOpen = false"
                class="flex items-center justify-between px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium"
              >
                <span>Support</span>
                <span
                  v-if="unreadMessagesCount > 0"
                  class="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 rounded-full"
                >
                  {{ unreadMessagesCount > 9 ? "9+" : unreadMessagesCount }}
                </span>
              </router-link>

              <div class="h-px bg-gray-200 dark:bg-gray-800"></div>

              <!-- Déconnexion mobile -->
              <button
                @click="authStore.logout"
                class="w-full flex items-center px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium"
              >
                <ArrowRightOnRectangleIcon class="w-5 h-5 mr-2" />
                Se déconnecter
              </button>
            </template>

            <template v-else>
              <a
                href="#docs"
                @click="mobileMenuOpen = false"
                class="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium"
              >
                Documentation
              </a>
              <a
                href="#pricing"
                @click="mobileMenuOpen = false"
                class="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium"
              >
                Tarifs
              </a>

              <div class="h-px bg-gray-200 dark:bg-gray-800"></div>

              <router-link
                to="/login"
                @click="mobileMenuOpen = false"
                class="block w-full text-center btn-primary py-3"
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

<style scoped>
/* Effet de flou pour la navbar sticky */
@supports (backdrop-filter: blur(10px)) {
  nav {
    backdrop-filter: blur(10px);
  }
}

/* Animation pour le badge de notifications */
@keyframes ping {
  75%,
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
