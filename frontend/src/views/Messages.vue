<!-- frontend/src/views/Messages.vue -->
<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useMessagesStore } from "@/stores/messages";
import { useRealtimeStore } from "@/stores/realtime";
import {
  ChatBubbleBottomCenterTextIcon,
  SparklesIcon,
  ClockIcon,
  CheckCircleIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/vue/24/outline";
import { ChatBubbleOvalLeftEllipsisIcon } from "@heroicons/vue/24/solid";
import ConversationList from "@/components/messaging/ConversationList.vue";
import ConversationChat from "@/components/messaging/ConversationChat.vue";
import CreateConversationModal from "@/components/messaging/CreateConversationModal.vue";

const route = useRoute();
const authStore = useAuthStore();
const messagesStore = useMessagesStore();
const realtimeStore = useRealtimeStore();

const selectedConversation = ref(null);
const showCreateModal = ref(false);
const searchQuery = ref("");
const showFilters = ref(false);

const isAdmin = computed(() => authStore.user?.role === "admin");
const conversations = computed(() => messagesStore.conversations);
const hasConversations = computed(() => conversations.value.length > 0);

// Statistiques pour l'utilisateur
const userStats = computed(() => {
  const convs = conversations.value;
  return {
    total: convs.length,
    open: convs.filter((c) => c.status === "open").length,
    inProgress: convs.filter((c) => c.status === "in_progress").length,
    resolved: convs.filter((c) => c.status === "resolved").length,
    unread: convs.filter((c) => c.unread_count > 0).length,
  };
});

const connectionStatus = computed(() => realtimeStore.connectionStatus);

const selectConversation = (conversation) => {
  selectedConversation.value = conversation;
  messagesStore.markMessagesAsRead(conversation.id);
};

const createNewTicket = () => {
  showCreateModal.value = true;
};

const handleTicketCreated = (conversation) => {
  showCreateModal.value = false;
  selectConversation(conversation);
};

// Actions rapides
const quickActions = computed(() => [
  {
    id: "new_ticket",
    label: "Nouveau ticket",
    icon: PlusIcon,
    color: "bg-primary-600 hover:bg-primary-700",
    action: createNewTicket,
  },
  {
    id: "unread",
    label: `Messages non lus (${userStats.value.unread})`,
    icon: ChatBubbleOvalLeftEllipsisIcon,
    color: "bg-orange-600 hover:bg-orange-700",
    disabled: userStats.value.unread === 0,
    action: () => {
      const unreadConv = conversations.value.find((c) => c.unread_count > 0);
      if (unreadConv) selectConversation(unreadConv);
    },
  },
]);

// Surveiller les paramètres URL
watch(
  () => route.query.conv,
  (conversationId) => {
    if (conversationId && conversations.value.length > 0) {
      const conversation = conversations.value.find(
        (c) => c.id === conversationId
      );
      if (conversation) {
        selectConversation(conversation);
      }
    }
  }
);

onMounted(() => {
  if (route.query.conv) {
    setTimeout(() => {
      const conversation = conversations.value.find(
        (c) => c.id === route.query.conv
      );
      if (conversation) {
        selectConversation(conversation);
      }
    }, 1000);
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header moderne -->
    <div
      class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10"
    >
      <div class="container mx-auto px-4 py-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-3">
              <div class="p-2 bg-primary-100 dark:bg-primary-900 rounded-xl">
                <ChatBubbleBottomCenterTextIcon
                  class="w-8 h-8 text-primary-600 dark:text-primary-400"
                />
              </div>
              <div>
                <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
                  Support Center
                </h1>
                <p class="text-gray-500 dark:text-gray-400 text-sm">
                  {{
                    isAdmin
                      ? "Gérez les tickets utilisateurs"
                      : "Obtenez de l'aide rapidement"
                  }}
                </p>
              </div>
            </div>
          </div>

          <!-- Statut de connexion temps réel -->
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-2 text-sm">
              <div
                :class="[
                  'w-2 h-2 rounded-full transition-colors',
                  connectionStatus === 'connected'
                    ? 'bg-green-400 animate-pulse'
                    : connectionStatus === 'connecting'
                    ? 'bg-yellow-400 animate-pulse'
                    : 'bg-red-400',
                ]"
              ></div>
              <span class="text-gray-600 dark:text-gray-400">
                {{
                  connectionStatus === "connected"
                    ? "Temps réel actif"
                    : connectionStatus === "connecting"
                    ? "Connexion..."
                    : "Hors ligne"
                }}
              </span>
            </div>

            <!-- Actions rapides -->
            <div class="flex space-x-2">
              <button
                v-for="action in quickActions"
                :key="action.id"
                @click="action.action"
                :disabled="action.disabled"
                :class="[
                  'px-4 py-2 rounded-lg text-white font-medium transition-all duration-200',
                  'transform hover:scale-105 hover:shadow-lg',
                  action.disabled
                    ? 'bg-gray-400 cursor-not-allowed'
                    : action.color,
                ]"
              >
                <component :is="action.icon" class="w-4 h-4 inline mr-2" />
                {{ action.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- Statistiques utilisateur -->
        <div class="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          <div
            class="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-xl"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-blue-100 text-sm">Total</p>
                <p class="text-2xl font-bold">{{ userStats.total }}</p>
              </div>
              <div class="p-2 bg-blue-400 bg-opacity-30 rounded-lg">
                <ChatBubbleBottomCenterTextIcon class="w-5 h-5" />
              </div>
            </div>
          </div>

          <div
            class="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-xl"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-green-100 text-sm">Ouverts</p>
                <p class="text-2xl font-bold">{{ userStats.open }}</p>
              </div>
              <div class="p-2 bg-green-400 bg-opacity-30 rounded-lg">
                <ClockIcon class="w-5 h-5" />
              </div>
            </div>
          </div>

          <div
            class="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-xl"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-orange-100 text-sm">En cours</p>
                <p class="text-2xl font-bold">{{ userStats.inProgress }}</p>
              </div>
              <div class="p-2 bg-orange-400 bg-opacity-30 rounded-lg">
                <SparklesIcon class="w-5 h-5" />
              </div>
            </div>
          </div>

          <div
            class="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-xl"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-purple-100 text-sm">Résolus</p>
                <p class="text-2xl font-bold">{{ userStats.resolved }}</p>
              </div>
              <div class="p-2 bg-purple-400 bg-opacity-30 rounded-lg">
                <CheckCircleIcon class="w-5 h-5" />
              </div>
            </div>
          </div>

          <div
            class="bg-gradient-to-r from-red-500 to-red-600 text-white p-4 rounded-xl"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-red-100 text-sm">Non lus</p>
                <p class="text-2xl font-bold">{{ userStats.unread }}</p>
              </div>
              <div class="p-2 bg-red-400 bg-opacity-30 rounded-lg">
                <div
                  class="w-5 h-5 bg-white rounded-full flex items-center justify-center"
                >
                  <div class="w-2 h-2 bg-red-500 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Interface de chat moderne -->
    <div class="container mx-auto px-4 py-6">
      <!-- État vide avec design moderne -->
      <div v-if="!hasConversations" class="text-center py-20">
        <div
          class="mx-auto w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center mb-8"
        >
          <ChatBubbleBottomCenterTextIcon class="w-12 h-12 text-white" />
        </div>

        <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Bienvenue dans le centre de support
        </h2>
        <p
          class="text-gray-500 dark:text-gray-400 text-lg mb-8 max-w-md mx-auto"
        >
          Créez votre premier ticket pour obtenir de l'aide de notre équipe
        </p>

        <button
          @click="createNewTicket"
          class="inline-flex items-center px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-xl hover:from-primary-700 hover:to-primary-800 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <PlusIcon class="w-6 h-6 mr-2" />
          Créer mon premier ticket
        </button>

        <!-- Suggestions d'aide -->
        <div class="mt-16 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div
            class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div class="text-blue-500 mb-4">
              <svg
                class="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900 dark:text-white mb-2">
              Questions générales
            </h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              Besoin d'aide sur l'utilisation de la plateforme
            </p>
          </div>

          <div
            class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div class="text-orange-500 mb-4">
              <svg
                class="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900 dark:text-white mb-2">
              Problèmes techniques
            </h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              Signaler un bug ou une erreur
            </p>
          </div>

          <div
            class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div class="text-green-500 mb-4">
              <svg
                class="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900 dark:text-white mb-2">
              Demandes de fonctionnalités
            </h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              Proposer des améliorations
            </p>
          </div>
        </div>
      </div>

      <!-- Interface avec conversations -->
      <div
        v-else
        class="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-400px)]"
      >
        <!-- Liste des conversations -->
        <div class="lg:col-span-4 xl:col-span-3">
          <div
            class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <!-- Header de la liste -->
            <div class="p-6 border-b border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                  Mes tickets
                </h3>
                <button
                  @click="createNewTicket"
                  class="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900 rounded-lg transition-colors"
                >
                  <PlusIcon class="w-5 h-5" />
                </button>
              </div>

              <!-- Barre de recherche moderne -->
              <div class="relative mb-4">
                <MagnifyingGlassIcon
                  class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Rechercher un ticket..."
                  class="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
              </div>

              <!-- Filtres rapides -->
              <div class="flex items-center space-x-2 text-xs">
                <button
                  class="px-3 py-1 bg-primary-100 text-primary-700 rounded-full"
                >
                  Tous
                </button>
                <button
                  class="px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  Ouverts
                </button>
                <button
                  class="px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  En cours
                </button>
              </div>
            </div>

            <ConversationList
              :selected-conversation-id="selectedConversation?.id"
              :admin-mode="isAdmin"
              @select-conversation="selectConversation"
              class="max-h-96 overflow-y-auto"
            />
          </div>
        </div>

        <!-- Zone de chat -->
        <div class="lg:col-span-8 xl:col-span-9">
          <div v-if="selectedConversation" class="h-full">
            <ConversationChat
              :conversation="selectedConversation"
              :show-admin-actions="isAdmin"
              class="rounded-2xl shadow-lg overflow-hidden"
            />
          </div>

          <!-- État vide pour sélection -->
          <div
            v-else
            class="h-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center"
          >
            <div class="text-center p-8">
              <div
                class="w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 rounded-2xl flex items-center justify-center mx-auto mb-6"
              >
                <ChatBubbleBottomCenterTextIcon
                  class="w-8 h-8 text-primary-600 dark:text-primary-400"
                />
              </div>
              <h3
                class="text-xl font-semibold text-gray-900 dark:text-white mb-2"
              >
                Sélectionnez une conversation
              </h3>
              <p class="text-gray-500 dark:text-gray-400 mb-6">
                Choisissez un ticket dans la liste pour voir les détails et
                répondre
              </p>

              <!-- Action suggestions -->
              <div class="space-y-2">
                <button
                  @click="createNewTicket"
                  class="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Créer un nouveau ticket
                </button>
                <button
                  v-if="userStats.unread > 0"
                  @click="quickActions[1].action()"
                  class="w-full px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
                >
                  Voir les messages non lus ({{ userStats.unread }})
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de création -->
    <CreateConversationModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @created="handleTicketCreated"
    />
  </div>
</template>

<style scoped>
/* Animations personnalisées */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Améliorations des scrollbars */
.max-h-96::-webkit-scrollbar {
  width: 4px;
}
.max-h-96::-webkit-scrollbar-track {
  background: transparent;
}
.max-h-96::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 2px;
}
.max-h-96::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Dark mode scrollbar */
.dark .max-h-96::-webkit-scrollbar-thumb {
  background: #4b5563;
}
.dark .max-h-96::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}
</style>
