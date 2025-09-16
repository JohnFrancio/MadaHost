<script setup>
import { computed } from "vue";
import { useThemeStore } from "@/stores/theme";
import {
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
} from "@heroicons/vue/24/outline";

const themeStore = useThemeStore();

const themes = [
  {
    key: "light",
    name: "Clair",
    icon: SunIcon,
  },
  {
    key: "dark",
    name: "Sombre",
    icon: MoonIcon,
  },
  {
    key: "auto",
    name: "Auto",
    icon: ComputerDesktopIcon,
  },
];

const currentThemeData = computed(() => {
  return themes.find((t) => t.key === themeStore.currentTheme);
});
</script>

<template>
  <div class="relative">
    <!-- Bouton principal -->
    <button
      @click="$refs.dropdown.classList.toggle('hidden')"
      class="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
      :title="`Thème: ${currentThemeData?.name}`"
    >
      <component
        :is="currentThemeData?.icon"
        class="w-5 h-5 text-gray-600 dark:text-gray-300"
      />
    </button>

    <!-- Dropdown -->
    <div
      ref="dropdown"
      class="hidden absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
      @click.stop
    >
      <div class="p-2">
        <div
          class="text-xs font-medium text-gray-500 dark:text-gray-400 px-3 py-2 uppercase tracking-wider"
        >
          Apparence
        </div>

        <button
          v-for="theme in themes"
          :key="theme.key"
          @click="
            themeStore.setTheme(theme.key);
            $refs.dropdown.classList.add('hidden');
          "
          :class="[
            'w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors',
            themeStore.currentTheme === theme.key
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
          ]"
        >
          <component :is="theme.icon" class="w-4 h-4 mr-3" />
          {{ theme.name }}

          <div
            v-if="themeStore.currentTheme === theme.key"
            class="ml-auto w-2 h-2 bg-primary-600 dark:bg-primary-400 rounded-full"
          ></div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Fermer le dropdown quand on clique ailleurs */
@media (hover: hover) {
  .dropdown-enter-active,
  .dropdown-leave-active {
    transition: all 0.2s ease;
  }

  .dropdown-enter-from,
  .dropdown-leave-to {
    opacity: 0;
    transform: translateY(-10px);
  }
}
</style>
