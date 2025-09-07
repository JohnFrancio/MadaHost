<script setup>
import { computed } from "vue";
import { useNotificationsStore } from "@/stores/notifications";
import Alert from "./Alert.vue";
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";

// Store
const notificationsStore = useNotificationsStore();

// Méthodes
const handleClose = (id) => {
  notificationsStore.remove(id);
};

const handleAction = (id, action) => {
  notificationsStore.handleAction(id, action);
};

// Utilitaires pour la version mobile
const mobileAlertClasses = (type) => {
  const types = {
    success: "border-l-4 border-green-400",
    error: "border-l-4 border-red-400",
    warning: "border-l-4 border-yellow-400",
    info: "border-l-4 border-blue-400",
  };
  return types[type];
};

const getIconComponent = (type) => {
  const icons = {
    success: CheckCircleIcon,
    error: XCircleIcon,
    warning: ExclamationTriangleIcon,
    info: InformationCircleIcon,
  };
  return icons[type];
};

const getIconClasses = (type) => {
  const types = {
    success: "text-green-500",
    error: "text-red-500",
    warning: "text-yellow-500",
    info: "text-blue-500",
  };
  return types[type];
};
</script>

<template>
  <teleport to="body">
    <!-- Container des notifications - Position fixe en haut à droite -->
    <div class="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      <TransitionGroup name="notification" tag="div" class="space-y-2">
        <Alert
          v-for="notification in notificationsStore.activeNotifications"
          :key="notification.id"
          :show="notification.show"
          :type="notification.type"
          :title="notification.title"
          :message="notification.message"
          :auto-close="notification.autoClose"
          :duration="notification.duration"
          :actions="notification.actions"
          @close="handleClose(notification.id)"
          @action="(action) => handleAction(notification.id, action)"
        />
      </TransitionGroup>
    </div>

    <!-- Version mobile - Toast en bas -->
    <div class="fixed bottom-4 left-4 right-4 z-50 space-y-2 sm:hidden">
      <TransitionGroup name="notification-mobile" tag="div" class="space-y-2">
        <div
          v-for="notification in notificationsStore.activeNotifications"
          :key="`mobile-${notification.id}`"
          :class="[
            'max-w-sm w-full mx-auto bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden',
            mobileAlertClasses(notification.type),
          ]"
          class="relative"
        >
          <!-- Version simplifiée pour mobile -->
          <div class="p-4">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <component
                  :is="getIconComponent(notification.type)"
                  :class="getIconClasses(notification.type)"
                  class="h-5 w-5"
                />
              </div>

              <div class="ml-3 flex-1">
                <p class="text-sm font-medium text-gray-900">
                  {{ notification.title }}
                </p>
                <p class="text-sm text-gray-600 mt-1">
                  {{ notification.message }}
                </p>
              </div>

              <button
                @click="handleClose(notification.id)"
                class="ml-2 flex-shrink-0 text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon class="h-5 w-5" />
              </button>
            </div>

            <!-- Actions pour mobile -->
            <div
              v-if="notification.actions && notification.actions.length > 0"
              class="mt-3 flex flex-col space-y-2"
            >
              <button
                v-for="action in notification.actions"
                :key="action.text"
                @click="handleAction(notification.id, action)"
                :class="[
                  'w-full text-sm font-medium rounded-md px-3 py-2 text-center',
                  action.primary
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                ]"
              >
                {{ action.text }}
              </button>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </teleport>
</template>

<style scoped>
/* Animations pour les notifications desktop */
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-move {
  transition: transform 0.3s ease;
}

/* Animations pour les notifications mobile */
.notification-mobile-enter-active,
.notification-mobile-leave-active {
  transition: all 0.3s ease;
}

.notification-mobile-enter-from {
  opacity: 0;
  transform: translateY(100%);
}

.notification-mobile-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.notification-mobile-move {
  transition: transform 0.3s ease;
}
</style>
