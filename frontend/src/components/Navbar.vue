<script setup>
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
</script>

<template>
  <nav class="bg-white shadow-sm border-b">
    <div class="container mx-auto px-4">
      <div class="flex justify-between items-center h-16">
        <!-- Logo -->
        <router-link to="/" class="flex items-center space-x-2">
          <div
            class="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center"
          >
            <span class="text-white font-bold">D</span>
          </div>
          <span class="text-xl font-semibold text-gray-900"
            >Deploy Platform</span
          >
        </router-link>

        <!-- Navigation -->
        <div class="flex items-center space-x-4">
          <template v-if="authStore.isAuthenticated">
            <router-link
              to="/dashboard"
              class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
            >
              Dashboard
            </router-link>

            <!-- User menu -->
            <div class="relative">
              <div class="flex items-center space-x-3">
                <img
                  v-if="authStore.user?.avatar_url"
                  :src="authStore.user.avatar_url"
                  :alt="authStore.user.username"
                  class="w-8 h-8 rounded-full"
                />
                <span class="text-sm font-medium text-gray-700">
                  {{ authStore.user?.username }}
                </span>
                <button
                  @click="authStore.logout"
                  class="text-gray-500 hover:text-gray-700 text-sm"
                >
                  Déconnexion
                </button>
              </div>
            </div>
          </template>

          <template v-else>
            <router-link to="/login" class="btn-primary">
              Se connecter
            </router-link>
          </template>
        </div>
      </div>
    </div>
  </nav>
</template>
