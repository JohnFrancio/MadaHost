<!-- frontend/src/components/messaging/ConversationChat.vue -->
<script setup>
import { ref, computed, onMounted, nextTick, watch } from "vue";
import { useMessagesStore } from "@/stores/messages";
import { useAuthStore } from "@/stores/auth";
import { useNotificationsStore } from "@/stores/notifications";
import {
  ChatBubbleLeftIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
  ClockIcon,
  CheckIcon,
  ShieldCheckIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
} from "@heroicons/vue/24/outline";
import {
  ChatBubbleOvalLeftEllipsisIcon,
  FireIcon,
} from "@heroicons/vue/24/solid";
import TicketAssignmentPanel from "./TicketAssignmentPanel.vue";

const props = defineProps({
  conversation: Object,
  showAdminActions: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["conversation-updated"]);

const messagesStore = useMessagesStore();
const authStore = useAuthStore();
const notifications = useNotificationsStore();

const messagesContainer = ref(null);
const messageInput = ref(null);
const newMessage = ref("");
const isTyping = ref(false);

const messages = computed(() => messagesStore.currentMessages);
const loadingMessages = computed(() => messagesStore.loading);
const sending = computed(() => messagesStore.sending);
const currentUserId = computed(() => authStore.user?.id);
const isAdmin = computed(() => authStore.user?.role === "admin");

// Styles et labels
const statusConfig = {
  open: {
    label: "Ouvert",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: ClockIcon,
  },
  in_progress: {
    label: "En cours",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
    icon: ExclamationCircleIcon,
  },
  resolved: {
    label: "Résolu",
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-200 dark:border-purple-800",
    icon: CheckIcon,
  },
  closed: {
    label: "Fermé",
    color: "text-gray-600",
    bg: "bg-gray-50 dark:bg-gray-700",
    border: "border-gray-200 dark:border-gray-600",
    icon: InformationCircleIcon,
  },
};

const priorityConfig = {
  low: { label: "Basse", color: "text-gray-500", icon: null },
  normal: { label: "Normale", color: "text-blue-500", icon: null },
  high: {
    label: "Haute",
    color: "text-amber-500",
    icon: ExclamationCircleIcon,
  },
  urgent: { label: "Urgente", color: "text-red-500", icon: FireIcon },
};

const currentStatus = computed(
  () => statusConfig[props.conversation?.status] || statusConfig.open
);

const currentPriority = computed(
  () => priorityConfig[props.conversation?.priority] || priorityConfig.normal
);

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatMessageTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else if (diffDays < 7) {
    return date.toLocaleDateString("fr-FR", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } else {
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
};

const scrollToBottom = (smooth = true) => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTo({
        top: messagesContainer.value.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  });
};

const sendMessage = async () => {
  if (!newMessage.value.trim() || !props.conversation) return;

  const messageText = newMessage.value.trim();
  newMessage.value = ""; // Clear immediately for better UX

  try {
    await messagesStore.sendMessage(props.conversation.id, {
      content: messageText,
      message_type: "text",
    });
    scrollToBottom();
  } catch (error) {
    // Restore message on error
    newMessage.value = messageText;
    notifications.error(error.message);
  }
};

const handleKeyDown = (event) => {
  if (event.key === "Enter") {
    if (event.shiftKey) {
      // Allow new line with Shift+Enter
      return;
    } else {
      event.preventDefault();
      sendMessage();
    }
  }
};

const handleInput = () => {
  // Auto-resize textarea
  if (messageInput.value) {
    messageInput.value.style.height = "auto";
    messageInput.value.style.height = `${Math.min(
      messageInput.value.scrollHeight,
      120
    )}px`;
  }
};

const changeStatus = async (newStatus) => {
  if (!props.conversation || !isAdmin.value) return;

  try {
    await messagesStore.changeConversationStatus(
      props.conversation.id,
      newStatus
    );
    notifications.success(
      `Statut changé vers "${statusConfig[newStatus].label}"`
    );
  } catch (error) {
    notifications.error(error.message);
  }
};

const handleConversationUpdated = (updatedConversation) => {
  Object.assign(props.conversation, updatedConversation);
  emit("conversation-updated", updatedConversation);
};

// Watchers et lifecycle
watch(
  () => props.conversation,
  async (newConversation) => {
    if (newConversation) {
      messagesStore.setCurrentConversation(newConversation);
      try {
        await messagesStore.fetchMessages(newConversation.id);
        scrollToBottom(false);
      } catch (error) {
        notifications.error("Erreur lors du chargement des messages");
      }
    }
  },
  { immediate: true }
);

watch(
  () => messages.value.length,
  () => {
    scrollToBottom();
  }
);

onMounted(() => {
  if (messageInput.value) {
    messageInput.value.focus();
  }
});
</script>

<template>
  <div
    class="flex flex-col h-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
  >
    <!-- Panneau d'assignation admin -->
    <TicketAssignmentPanel
      v-if="showAdminActions && conversation"
      :conversation="conversation"
      @conversation-updated="handleConversationUpdated"
    />

    <!-- En-tête de conversation modernisé -->
    <div
      v-if="conversation"
      class="flex-shrink-0 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700 p-6 border-b border-gray-200 dark:border-gray-700"
    >
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <!-- Titre et badges -->
          <div class="flex items-start space-x-3 mb-3">
            <div class="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
              <ChatBubbleOvalLeftEllipsisIcon
                class="w-6 h-6 text-primary-600 dark:text-primary-400"
              />
            </div>
            <div class="flex-1">
              <h2
                class="text-xl font-bold text-gray-900 dark:text-white leading-tight mb-2"
              >
                {{ conversation.subject }}
              </h2>
              <div class="flex items-center space-x-3">
                <!-- Badge de statut -->
                <div
                  :class="[
                    'inline-flex items-center px-3 py-1 text-sm font-medium border rounded-full',
                    currentStatus.bg,
                    currentStatus.color,
                    currentStatus.border,
                  ]"
                >
                  <component :is="currentStatus.icon" class="w-4 h-4 mr-1.5" />
                  {{ currentStatus.label }}
                </div>

                <!-- Badge de priorité -->
                <div
                  :class="[
                    'inline-flex items-center px-3 py-1 text-sm font-medium border rounded-full',
                    'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600',
                    currentPriority.color,
                  ]"
                >
                  <component
                    v-if="currentPriority.icon"
                    :is="currentPriority.icon"
                    class="w-4 h-4 mr-1.5"
                  />
                  {{ currentPriority.label }}
                </div>

                <!-- Date de création -->
                <span class="text-sm text-gray-500 dark:text-gray-400">
                  Créé le {{ formatDate(conversation.created_at) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Informations assignation -->
          <div class="flex items-center space-x-4 text-sm">
            <!-- Utilisateur -->
            <div
              class="flex items-center space-x-2 text-gray-600 dark:text-gray-400"
            >
              <UserCircleIcon class="w-4 h-4" />
              <span
                >Par {{ conversation.user?.username || "Utilisateur" }}</span
              >
            </div>

            <!-- Admin assigné -->
            <div
              v-if="conversation.admin"
              class="flex items-center space-x-2 text-gray-600 dark:text-gray-400"
            >
              <ShieldCheckIcon class="w-4 h-4" />
              <span>Assigné à {{ conversation.admin.username }}</span>
              <img
                v-if="conversation.admin.avatar_url"
                :src="conversation.admin.avatar_url"
                :alt="conversation.admin.username"
                class="w-5 h-5 rounded-full"
              />
            </div>
            <div
              v-else-if="showAdminActions"
              class="flex items-center space-x-2 text-amber-600 dark:text-amber-400"
            >
              <ExclamationCircleIcon class="w-4 h-4" />
              <span>Non assigné</span>
            </div>
          </div>
        </div>

        <!-- Actions rapides admin -->
        <div
          v-if="showAdminActions && isAdmin"
          class="flex items-center space-x-2"
        >
          <select
            :value="conversation.status"
            @change="changeStatus($event.target.value)"
            class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          >
            <option value="open">Ouvert</option>
            <option value="in_progress">En cours</option>
            <option value="resolved">Résolu</option>
            <option value="closed">Fermé</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Zone de messages avec design moderne -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50 dark:bg-gray-900"
    >
      <div v-if="loadingMessages" class="text-center py-8">
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-3"
        ></div>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Chargement des messages...
        </p>
      </div>

      <!-- Messages -->
      <div
        v-for="(message, index) in messages"
        :key="message.id"
        :class="[
          'flex',
          message.sender.id === currentUserId ? 'justify-end' : 'justify-start',
        ]"
      >
        <!-- Message de l'autre personne -->
        <div
          v-if="message.sender.id !== currentUserId"
          class="flex space-x-3 max-w-[70%]"
        >
          <div class="flex-shrink-0">
            <img
              v-if="message.sender.avatar_url"
              :src="message.sender.avatar_url"
              :alt="message.sender.username"
              class="w-8 h-8 rounded-full"
            />
            <div
              v-else
              class="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center"
            >
              <UserCircleIcon class="w-5 h-5 text-gray-500" />
            </div>
          </div>
          <div class="flex-1">
            <div class="flex items-center space-x-2 mb-1">
              <span class="text-sm font-medium text-gray-900 dark:text-white">
                {{ message.sender.username }}
              </span>
              <span
                v-if="message.sender.role === 'admin'"
                class="inline-flex items-center px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full"
              >
                <ShieldCheckIcon class="w-3 h-3 mr-1" />
                Admin
              </span>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatMessageTime(message.created_at) }}
              </span>
            </div>
            <div
              class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-md p-4 shadow-sm"
            >
              <div
                class="text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed"
              >
                {{ message.content }}
              </div>
              <div
                v-if="message.edited_at"
                class="text-xs text-gray-500 mt-2 italic"
              >
                Modifié
              </div>
            </div>
          </div>
        </div>

        <!-- Message de l'utilisateur actuel -->
        <div v-else class="flex justify-end max-w-[70%]">
          <div class="text-right">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {{ formatMessageTime(message.created_at) }}
              <span v-if="message.edited_at" class="italic">(modifié)</span>
            </div>
            <div
              class="bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl rounded-tr-md p-4 shadow-sm"
            >
              <div class="whitespace-pre-wrap leading-relaxed">
                {{ message.content }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- État vide -->
      <div
        v-if="!loadingMessages && messages.length === 0"
        class="text-center py-12"
      >
        <div
          class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <ChatBubbleLeftIcon class="w-8 h-8 text-gray-400" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Début de la conversation
        </h3>
        <p class="text-gray-500 dark:text-gray-400">
          C'est ici que votre conversation va commencer
        </p>
      </div>
    </div>

    <!-- Zone de saisie modernisée -->
    <div
      class="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4"
    >
      <div
        v-if="conversation?.status === 'closed'"
        class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
      >
        <div
          class="flex items-center space-x-2 text-amber-700 dark:text-amber-400"
        >
          <InformationCircleIcon class="w-5 h-5" />
          <span class="text-sm font-medium">
            Cette conversation est fermée. Créez un nouveau ticket si vous avez
            besoin d'aide.
          </span>
        </div>
      </div>

      <form @submit.prevent="sendMessage" class="flex items-end space-x-3">
        <div class="flex-1 relative">
          <textarea
            ref="messageInput"
            v-model="newMessage"
            placeholder="Tapez votre message... (Entrée pour envoyer, Shift+Entrée pour nouvelle ligne)"
            rows="1"
            :disabled="conversation?.status === 'closed'"
            @keydown="handleKeyDown"
            @input="handleInput"
            class="w-full resize-none border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:bg-gray-100 disabled:cursor-not-allowed dark:disabled:bg-gray-600 transition-all duration-200"
            :class="{
              'border-red-300 focus:ring-red-500':
                conversation?.status === 'closed',
            }"
            style="min-height: 44px; max-height: 120px"
          />

          <!-- Indicateur de frappe -->
          <div
            v-if="isTyping"
            class="absolute bottom-1 left-4 text-xs text-gray-500 dark:text-gray-400"
          >
            En cours de frappe...
          </div>
        </div>

        <!-- Bouton d'envoi -->
        <button
          type="submit"
          :disabled="
            !newMessage.trim() || sending || conversation?.status === 'closed'
          "
          :class="[
            'flex-shrink-0 p-3 rounded-xl font-medium transition-all duration-200 transform',
            !newMessage.trim() || sending || conversation?.status === 'closed'
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 hover:scale-105 shadow-lg hover:shadow-xl',
          ]"
        >
          <span v-if="sending" class="flex items-center">
            <div
              class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"
            ></div>
            <span class="hidden sm:inline">Envoi...</span>
          </span>
          <span v-else class="flex items-center">
            <PaperAirplaneIcon class="w-5 h-5" />
            <span class="hidden sm:inline ml-2">Envoyer</span>
          </span>
        </button>
      </form>

      <!-- Aide contextuelle -->
      <div
        class="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400"
      >
        <div class="flex items-center space-x-4">
          <span>Entrée pour envoyer • Shift+Entrée pour nouvelle ligne</span>
        </div>
        <div v-if="showAdminActions" class="flex items-center space-x-2">
          <span>Mode administrateur</span>
          <ShieldCheckIcon class="w-3 h-3" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Animation pour les messages */
.message-enter-active {
  transition: all 0.3s ease-out;
}
.message-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

/* Scrollbar personnalisée */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}
.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}
.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
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

/* Animation du bouton d'envoi */
button[type="submit"]:not(:disabled):hover {
  transform: translateY(-1px) scale(1.02);
}

/* Auto-resize textarea */
textarea {
  field-sizing: content;
}
</style>
