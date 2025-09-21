<!-- frontend/src/components/messaging/MessageNotificationBadge.vue -->
<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useMessagesStore } from "@/stores/messages";
import { useRealtimeStore } from "@/stores/realtime";
import { ChatBubbleLeftRightIcon, XMarkIcon } from "@heroicons/vue/24/outline";

const authStore = useAuthStore();
const messagesStore = useMessagesStore();
const realtimeStore = useRealtimeStore();

const showIndicator = ref(false);
const dismissed = ref(false);
const showTooltip = ref(false);

const connectionStatus = computed(() => realtimeStore.connectionStatus);
const unreadCount = computed(() => {
  return messagesStore.conversations.reduce((total, conv) => {
    return total + (conv.unread_count || 0);
  }, 0);
});

const displayCount = computed(() => {
  return unreadCount.value > 99 ? "99+" : unreadCount.value.toString();
});

const connectionStatusColor = computed(() => {
  switch (connectionStatus.value) {
    case "connected":
      return "bg-green-400 animate-pulse";
    case "connecting":
      return "bg-yellow-400 animate-pulse";
    case "error":
      return "bg-red-400";
    default:
      return "bg-gray-400";
  }
});

const connectionStatusText = computed(() => {
  switch (connectionStatus.value) {
    case "connected":
      return "Notifications temps réel activées";
    case "connecting":
      return "Connexion en cours...";
    case "error":
      return "Problème de connexion";
    default:
      return "Notifications désactivées";
  }
});

const messagesRoute = computed(() => {
  return authStore.user?.role === "admin" ? "/admin/messages" : "/messages";
});

const dismiss = () => {
  dismissed.value = true;
  showIndicator.value = false;
};

// Afficher l'indicateur selon les changements de statut
watch(connectionStatus, (newStatus, oldStatus) => {
  if (dismissed.value) return;

  // Afficher lors des changements importants
  if (
    (oldStatus === "disconnected" && newStatus === "connected") ||
    (oldStatus === "connected" && newStatus === "error") ||
    (newStatus === "connecting" && oldStatus !== "connecting")
  ) {
    showIndicator.value = true;

    // Auto-masquer après 5 secondes si connecté avec succès
    if (newStatus === "connected") {
      setTimeout(() => {
        showIndicator.value = false;
      }, 5000);
    }
  }
});

// Charger les conversations au montage pour obtenir le compteur
onMounted(async () => {
  try {
    if (authStore.user?.role === "admin") {
      await messagesStore.fetchAllConversations();
    } else {
      await messagesStore.fetchConversations();
    }
  } catch (error) {
    console.error("Erreur chargement conversations pour badge:", error);
  }

  // Afficher l'indicateur si la connexion est en erreur
  if (connectionStatus.value === "error") {
    showIndicator.value = true;
  }
});
</script>

<template>
  <router-link
    :to="messagesRoute"
    class="relative text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 px-3 py-2 rounded-lg text-sm font-medium transition-colors group"
    @mouseenter="showTooltip = true"
    @mouseleave="showTooltip = false"
  >
    <div class="flex items-center gap-2">
      <ChatBubbleLeftRightIcon class="w-5 h-5" />
      <span>Support</span>

      <!-- Badge de compteur -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="scale-0 opacity-0"
        enter-to-class="scale-100 opacity-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="scale-100 opacity-100"
        leave-to-class="scale-0 opacity-0"
      >
        <span
          v-if="unreadCount > 0"
          :class="[
            'bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5',
            'animate-pulse shadow-lg ring-2 ring-red-200',
            unreadCount > 99 ? 'text-[10px]' : '',
          ]"
        >
          {{ displayCount }}
        </span>
      </Transition>

      <!-- Indicateur de connexion WebSocket -->
      <div
        :class="[
          'w-2 h-2 rounded-full transition-colors duration-300',
          connectionStatusColor,
        ]"
        :title="connectionStatusText"
      ></div>
    </div>

    <!-- Tooltip informatif -->
    <div
      v-if="showTooltip"
      class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50"
    >
      <div class="text-center">
        <div v-if="unreadCount > 0">
          {{ unreadCount }} message{{ unreadCount > 1 ? "s" : "" }} non lu{{
            unreadCount > 1 ? "s" : ""
          }}
        </div>
        <div v-else>Aucun nouveau message</div>
        <div class="text-gray-300 text-xs mt-1">{{ connectionStatusText }}</div>
      </div>
      <!-- Flèche du tooltip -->
      <div
        class="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"
      ></div>
    </div>
  </router-link>
</template>
