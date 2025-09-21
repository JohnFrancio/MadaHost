<!-- frontend/src/components/messaging/ConversationList.vue -->
<script setup>
import { ref, computed, onMounted } from "vue";
import { useMessagesStore } from "@/stores/messages";
import { useNotificationsStore } from "@/stores/notifications";
import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  UserCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  EllipsisVerticalIcon,
  PlusIcon,
} from "@heroicons/vue/24/outline";
import {
  ChatBubbleOvalLeftEllipsisIcon,
  FireIcon,
} from "@heroicons/vue/24/solid";
import CreateConversationModal from "./CreateConversationModal.vue";

const props = defineProps({
  selectedConversationId: String,
  adminMode: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["select-conversation"]);

const messagesStore = useMessagesStore();
const notifications = useNotificationsStore();
const showCreateDialog = ref(false);
const currentFilter = ref("all");

const statuses = [
  {
    value: "all",
    label: "Tous",
    icon: ChatBubbleLeftRightIcon,
    color: "text-gray-600",
  },
  { value: "open", label: "Ouverts", icon: ClockIcon, color: "text-green-600" },
  {
    value: "in_progress",
    label: "En cours",
    icon: ExclamationTriangleIcon,
    color: "text-blue-600",
  },
  {
    value: "resolved",
    label: "Résolus",
    icon: CheckCircleIcon,
    color: "text-purple-600",
  },
  {
    value: "closed",
    label: "Fermés",
    icon: XCircleIcon,
    color: "text-gray-600",
  },
];

const statusLabels = {
  open: "Ouvert",
  in_progress: "En cours",
  resolved: "Résolu",
  closed: "Fermé",
};

const priorityLabels = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

const statusStyles = {
  open: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
  in_progress:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
  resolved:
    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800",
  closed:
    "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
};

const priorityStyles = {
  low: "bg-gray-50 text-gray-600 border-gray-200",
  normal: "bg-sky-50 text-sky-600 border-sky-200",
  high: "bg-amber-50 text-amber-600 border-amber-200",
  urgent: "bg-red-50 text-red-600 border-red-200",
};

const loading = computed(() => messagesStore.loading);
const conversations = computed(() => messagesStore.sortedConversations);

const filteredConversations = computed(() => {
  if (currentFilter.value === "all") {
    return conversations.value;
  }
  return messagesStore.conversationsByStatus(currentFilter.value);
});

const statusCounts = computed(() => {
  const counts = {};
  statuses.forEach((status) => {
    if (status.value === "all") {
      counts[status.value] = conversations.value.length;
    } else {
      counts[status.value] = conversations.value.filter(
        (c) => c.status === status.value
      ).length;
    }
  });
  return counts;
});

const getConversationPreview = (conversation) => {
  // Logique pour obtenir un aperçu du dernier message
  return "Cliquez pour voir les messages";
};

const getTimeDifference = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffMinutes = Math.ceil(diffTime / (1000 * 60));
  const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return `${diffMinutes} min`;
  } else if (diffHours < 24) {
    return `${diffHours} h`;
  } else if (diffDays < 7) {
    return `${diffDays} j`;
  } else {
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }
};

const getPriorityIcon = (priority) => {
  switch (priority) {
    case "urgent":
      return FireIcon;
    case "high":
      return ExclamationTriangleIcon;
    default:
      return null;
  }
};

const isUnread = (conversation) => {
  return conversation.unread_count && conversation.unread_count > 0;
};

const isRecent = (conversation) => {
  const diff = Date.now() - new Date(conversation.last_message_at).getTime();
  return diff < 24 * 60 * 60 * 1000; // Moins de 24h
};

const loadConversations = async () => {
  try {
    console.log(
      `🔄 ConversationList: Chargement conversations - Admin: ${props.adminMode}`
    );

    if (props.adminMode) {
      await messagesStore.fetchAllConversations();
    } else {
      await messagesStore.fetchConversations();
    }

    console.log(
      `✅ ConversationList: ${conversations.value.length} conversations chargées`
    );
  } catch (error) {
    console.error("❌ ConversationList: Erreur chargement:", error);
    notifications.error("Erreur lors du chargement des conversations");
  }
};
const handleConversationCreated = async (conversation) => {
  showCreateDialog.value = false;

  // Recharger les conversations après création
  await loadConversations();

  // Sélectionner la nouvelle conversation
  emit("select-conversation", conversation);
  notifications.success("Ticket créé avec succès");
};

onMounted(async () => {
  await loadConversations();
});
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden h-full flex flex-col"
  >
    <!-- En-tête avec filtres modernes -->
    <div
      class="flex-shrink-0 p-4 border-b border-gray-100 dark:border-gray-700"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ props.adminMode ? "Tickets" : "Mes conversations" }}
        </h3>
        <button
          @click="showCreateDialog = true"
          class="p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors transform hover:scale-105"
          title="Créer un nouveau ticket"
        >
          <PlusIcon class="w-4 h-4" />
        </button>
      </div>

      <!-- Filtres par statut avec compteurs -->
      <div
        class="grid grid-cols-3 gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg mb-4"
      >
        <button
          v-for="status in statuses.slice(0, 3)"
          :key="status.value"
          @click="currentFilter = status.value"
          :class="[
            'flex items-center justify-center px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
            currentFilter === status.value
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white',
          ]"
        >
          <component :is="status.icon" class="w-3 h-3 mr-1" />
          <span class="hidden sm:inline">{{ status.label }}</span>
          <span
            v-if="statusCounts[status.value] > 0"
            class="ml-1 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-500 rounded text-xs"
          >
            {{ statusCounts[status.value] }}
          </span>
        </button>
      </div>

      <!-- Filtres supplémentaires en ligne -->
      <div class="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
        <button
          v-for="status in statuses.slice(3)"
          :key="status.value"
          @click="currentFilter = status.value"
          :class="[
            'flex items-center px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors',
            currentFilter === status.value
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400',
          ]"
        >
          <component :is="status.icon" class="w-3 h-3 mr-1" />
          {{ status.label }}
          <span v-if="statusCounts[status.value] > 0" class="ml-1">
            {{ statusCounts[status.value] }}
          </span>
        </button>
      </div>
    </div>

    <!-- Liste des conversations modernisée -->
    <div
      class="flex-1 divide-y divide-gray-100 dark:divide-gray-700 overflow-y-auto"
    >
      <div v-if="loading" class="p-8 text-center">
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-3"
        ></div>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Chargement des conversations...
        </p>
      </div>

      <!-- Liste des conversations -->
      <div
        v-for="conversation in filteredConversations"
        :key="conversation.id"
        @click="$emit('select-conversation', conversation)"
        :class="[
          'relative p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-all duration-200',
          'group hover:shadow-sm',
          selectedConversationId === conversation.id
            ? 'bg-primary-50 dark:bg-primary-900/20 border-r-4 border-primary-500'
            : '',
        ]"
      >
        <!-- Indicateurs visuels côté gauche -->
        <div class="absolute left-0 top-4 flex flex-col space-y-1">
          <div
            v-if="isUnread(conversation)"
            class="w-1 h-8 bg-primary-500 rounded-r-full"
          ></div>
          <div
            v-if="conversation.priority === 'urgent'"
            class="w-1 h-4 bg-red-500 rounded-r-full"
          ></div>
        </div>

        <div class="ml-2 flex items-start space-x-3">
          <!-- Avatar/Icon -->
          <div class="flex-shrink-0 relative">
            <div
              :class="[
                'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                isUnread(conversation)
                  ? 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
              ]"
            >
              <ChatBubbleOvalLeftEllipsisIcon class="w-5 h-5" />
            </div>

            <!-- Badge de priorité -->
            <div
              v-if="
                conversation.priority === 'urgent' ||
                conversation.priority === 'high'
              "
              class="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center animate-pulse"
              :class="
                conversation.priority === 'urgent'
                  ? 'bg-red-500'
                  : 'bg-amber-500'
              "
            >
              <component
                :is="getPriorityIcon(conversation.priority)"
                class="w-2.5 h-2.5 text-white"
              />
            </div>

            <!-- Badge non lu -->
            <div
              v-if="isUnread(conversation)"
              class="absolute -bottom-1 -right-1 w-5 h-5 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs font-bold animate-bounce"
            >
              {{
                conversation.unread_count > 9 ? "9+" : conversation.unread_count
              }}
            </div>
          </div>

          <!-- Contenu principal -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between mb-1">
              <h4
                :class="[
                  'text-sm font-medium truncate flex-1 mr-2',
                  isUnread(conversation)
                    ? 'text-gray-900 dark:text-white font-semibold'
                    : 'text-gray-700 dark:text-gray-300',
                ]"
              >
                {{ conversation.subject }}
              </h4>
              <div class="flex items-center space-x-1">
                <!-- Temps -->
                <span
                  :class="[
                    'text-xs whitespace-nowrap',
                    isRecent(conversation)
                      ? 'text-primary-600 dark:text-primary-400 font-medium'
                      : 'text-gray-500 dark:text-gray-400',
                  ]"
                >
                  {{ getTimeDifference(conversation.last_message_at) }}
                </span>
              </div>
            </div>

            <!-- Aperçu et métadonnées -->
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
              {{ getConversationPreview(conversation) }}
            </p>

            <!-- Badges de statut et priorité -->
            <div class="flex items-center space-x-2 flex-wrap gap-y-1">
              <span
                :class="[
                  'inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full',
                  statusStyles[conversation.status],
                ]"
              >
                {{ statusLabels[conversation.status] }}
              </span>

              <span
                v-if="conversation.priority !== 'normal'"
                :class="[
                  'inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full',
                  priorityStyles[conversation.priority],
                ]"
              >
                {{ priorityLabels[conversation.priority] }}
              </span>

              <!-- Admin assigné -->
              <div
                v-if="conversation.admin"
                class="flex items-center space-x-1"
              >
                <UserCircleIcon class="w-3 h-3 text-gray-400" />
                <span class="text-xs text-gray-500 truncate max-w-20">
                  {{ conversation.admin.username }}
                </span>
              </div>
            </div>

            <!-- Indicateurs supplémentaires -->
            <div class="mt-2 flex items-center space-x-2">
              <div v-if="isRecent(conversation)">
                <span
                  class="inline-flex items-center px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded-full"
                >
                  <div
                    class="w-1.5 h-1.5 bg-green-400 rounded-full mr-1 animate-pulse"
                  ></div>
                  Récent
                </span>
              </div>

              <div
                v-if="conversation.priority === 'urgent'"
                class="flex items-center"
              >
                <span
                  class="inline-flex items-center px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full"
                >
                  <FireIcon class="w-3 h-3 mr-1" />
                  Urgent
                </span>
              </div>
            </div>
          </div>

          <!-- Menu actions (visible au hover) -->
          <div class="opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <EllipsisVerticalIcon class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- État vide -->
      <div
        v-if="!loading && filteredConversations.length === 0"
        class="p-8 text-center"
      >
        <div
          class="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <ChatBubbleLeftRightIcon class="w-8 h-8 text-gray-400" />
        </div>
        <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">
          Aucune conversation trouvée
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {{
            currentFilter === "all"
              ? "Vous n'avez pas encore de tickets de support"
              : `Aucun ticket avec le statut "${
                  statuses.find((s) => s.value === currentFilter)?.label
                }"`
          }}
        </p>
        <button
          @click="showCreateDialog = true"
          class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-sm font-medium rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
        >
          <PlusIcon class="w-4 h-4 mr-2" />
          Créer un ticket
        </button>
      </div>
    </div>

    <!-- Modal de création -->
    <CreateConversationModal
      v-if="showCreateDialog"
      @close="showCreateDialog = false"
      @created="handleConversationCreated"
    />
  </div>
</template>

<style scoped>
/* Masquer la scrollbar horizontale */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Animations personnalisées */
@keyframes bounce-subtle {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}

.animate-bounce-subtle {
  animation: bounce-subtle 2s infinite;
}

/* Scrollbar verticale personnalisée */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}
.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}
.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 2px;
}
.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Dark mode scrollbar */
.dark .overflow-y-auto::-webkit-scrollbar-thumb {
  background: #4b5563;
}
.dark .overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}

/* Hover effects */
.group:hover {
  transform: translateX(2px);
}

/* Amélioration des transitions */
.transition-all {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
