<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";

// Props
const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  type: {
    type: String,
    default: "info", // success, error, warning, info
    validator: (value) =>
      ["success", "error", "warning", "info"].includes(value),
  },
  title: {
    type: String,
    default: "",
  },
  message: {
    type: String,
    required: true,
  },
  autoClose: {
    type: Boolean,
    default: true,
  },
  duration: {
    type: Number,
    default: 5000, // 5 secondes
  },
  actions: {
    type: Array,
    default: () => [],
  },
});

// Émissions
const emit = defineEmits(["close", "action"]);

// État local
const progressWidth = ref(100);
let progressTimer = null;
let autoCloseTimer = null;

// Classes calculées selon le type
const alertClasses = computed(() => {
  const base = "border-l-4";
  const types = {
    success: "border-green-400 bg-green-50",
    error: "border-red-400 bg-red-50",
    warning: "border-yellow-400 bg-yellow-50",
    info: "border-blue-400 bg-blue-50",
  };
  return `${base} ${types[props.type]}`;
});

const barClasses = computed(() => {
  const types = {
    success: "bg-green-500",
    error: "bg-red-500",
    warning: "bg-yellow-500",
    info: "bg-blue-500",
  };
  return types[props.type];
});

const iconClasses = computed(() => {
  const types = {
    success: "text-green-400",
    error: "text-red-400",
    warning: "text-yellow-400",
    info: "text-blue-400",
  };
  return types[props.type];
});

const iconComponent = computed(() => {
  const icons = {
    success: CheckCircleIcon,
    error: XCircleIcon,
    warning: ExclamationTriangleIcon,
    info: InformationCircleIcon,
  };
  return icons[props.type];
});

// Méthodes
const close = () => {
  clearTimers();
  emit("close");
};

const handleAction = (action) => {
  emit("action", action);
  if (action.close !== false) {
    close();
  }
};

const startAutoClose = () => {
  if (!props.autoClose || props.duration <= 0) return;

  clearTimers();

  // Timer pour la barre de progression
  const interval = 100; // Mise à jour toutes les 100ms
  const steps = props.duration / interval;
  let currentStep = 0;

  progressTimer = setInterval(() => {
    currentStep++;
    progressWidth.value = Math.max(0, 100 - (currentStep / steps) * 100);

    if (currentStep >= steps) {
      clearInterval(progressTimer);
    }
  }, interval);

  // Timer pour fermer automatiquement
  autoCloseTimer = setTimeout(() => {
    close();
  }, props.duration);
};

const clearTimers = () => {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
  }
};

// Watchers
watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      progressWidth.value = 100;
      startAutoClose();
    } else {
      clearTimers();
    }
  }
);

// Lifecycle
onMounted(() => {
  if (props.show) {
    startAutoClose();
  }
});

onUnmounted(() => {
  clearTimers();
});
</script>

<template>
  <transition
    enter-active-class="transform ease-out duration-300 transition"
    enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
    enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
    leave-active-class="transition ease-in duration-100"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="show"
      :class="[
        'max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden',
        alertClasses,
      ]"
      class="relative"
    >
      <!-- Barre colorée selon le type -->
      <div :class="barClasses" class="absolute left-0 top-0 bottom-0 w-1"></div>

      <div class="p-4 pl-6">
        <div class="flex items-start">
          <!-- Icône -->
          <div class="flex-shrink-0">
            <component
              :is="iconComponent"
              :class="iconClasses"
              class="h-6 w-6"
              aria-hidden="true"
            />
          </div>

          <!-- Contenu -->
          <div class="ml-3 w-0 flex-1 pt-0.5">
            <p v-if="title" class="text-sm font-medium text-gray-900">
              {{ title }}
            </p>
            <p class="text-sm text-gray-600" :class="{ 'mt-1': title }">
              {{ message }}
            </p>

            <!-- Actions optionnelles -->
            <div
              v-if="actions && actions.length > 0"
              class="mt-3 flex space-x-2"
            >
              <button
                v-for="action in actions"
                :key="action.text"
                @click="handleAction(action)"
                :class="[
                  'text-sm font-medium rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-offset-2',
                  action.primary
                    ? 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-primary-500',
                ]"
              >
                {{ action.text }}
              </button>
            </div>
          </div>

          <!-- Bouton fermeture -->
          <div class="ml-4 flex-shrink-0 flex">
            <button
              @click="close"
              class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <span class="sr-only">Fermer</span>
              <XMarkIcon class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <!-- Barre de progression pour auto-close -->
      <div
        v-if="autoClose && show"
        class="absolute bottom-0 left-0 right-0 h-1 bg-gray-200"
      >
        <div
          :class="barClasses"
          class="h-full transition-all duration-100 ease-linear"
          :style="{ width: `${progressWidth}%` }"
        ></div>
      </div>
    </div>
  </transition>
</template>
