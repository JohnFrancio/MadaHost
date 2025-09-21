<!-- frontend/src/components/messaging/AdminConversationList.vue -->
<script setup>
import { ref, computed, onMounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useMessagesStore } from "@/stores/messages";
import { useNotificationsStore } from "@/stores/notifications";
import { ChatBubbleLeftRightIcon } from "@heroicons/vue/24/outline";
import axios from "axios";

const props = defineProps({
  selectedConversationId: String,
});

const emit = defineEmits(["select-conversation"]);

const authStore = useAuthStore();
const messagesStore = useMessagesStore();
const notifications = useNotificationsStore();

const currentFilter = ref("all");
const assignmentFilter = ref("all"); // 'all', 'unassigned', 'mine'

// Configuration API
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  withCredentials: true,
});

const currentUserId = computed(() => authStore.user?.id);
const loading = computed(() => messagesStore.loading);
const conversations = computed(() => messagesStore.sortedConversations);

// Compteurs pour les filtres
const unassignedCount = computed(
  () => conversations.value.filter((conv) => !conv.admin_id).length
);

const myTicketsCount = computed(
  () =>
    conversations.value.filter((conv) => conv.admin_id === currentUserId.value)
      .length
);

// Filtres combinés
const filteredConversations = computed(() => {
  let filtered = conversations.value;

  // Filtre par statut
  if (currentFilter.value !== "all") {
    filtered = filtered.filter((conv) => conv.status === currentFilter.value);
  }

  // Filtre par assignation
  if (assignmentFilter.value === "unassigned") {
    filtered = filtered.filter((conv) => !conv.admin_id);
  } else if (assignmentFilter.value === "mine") {
    filtered = filtered.filter((conv) => conv.admin_id === currentUserId.value);
  }

  return filtered;
});

// Statuts avec compteurs
const statuses = computed(() => [
  {
    value: "all",
    label: "Tous",
    count: conversations.value.length,
  },
  {
    value: "open",
    label: "Ouverts",
    count: conversations.value.filter((c) => c.status === "open").length,
  },
  {
    value: "in_progress",
    label: "En cours",
    count: conversations.value.filter((c) => c.status === "in_progress").length,
  },
  {
    value: "resolved",
    label: "Résolus",
    count: conversations.value.filter((c) => c.status === "resolved").length,
  },
  {
    value: "closed",
    label: "Fermés",
    count: conversations.value.filter((c) => c.status === "closed").length,
  },
]);

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

const statusColors = {
  open: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  resolved:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const priorityColors = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-100 text-blue-600",
  high: "bg-orange-100 text-orange-600",
  urgent: "bg-red-100 text-red-600",
};

const hasUnreadMessages = (conversation) => {
  return conversation.unread_count && conversation.unread_count > 0;
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return "Aujourd'hui";
  } else if (diffDays === 2) {
    return "Hier";
  } else if (diffDays < 7) {
    return `${diffDays} jours`;
  } else {
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
  }
};

const quickAssignToMe = async (conversation, event) => {
  event.stopPropagation(); // Empêcher la sélection de la conversation

  if (conversation.admin_id) return; // Déjà assigné

  try {
    const response = await api.put(
      `/messages/admin/conversations/${conversation.id}/assign`,
      { admin_id: currentUserId.value }
    );

    if (response.data.success) {
      notifications.success(`Ticket "${conversation.subject}" assigné à vous`);
      await messagesStore.fetchAllConversations();
    }
  } catch (error) {
    notifications.error("Erreur lors de l'assignation rapide");
    console.error("Erreur assignation rapide:", error);
  }
};

onMounted(async () => {
  try {
    console.log("🔄 AdminConversationList: Chargement des conversations admin");
    await messagesStore.fetchAllConversations();
    console.log(
      "✅ AdminConversationList: Conversations chargées",
      conversations.value.length
    );
  } catch (error) {
    console.error("❌ AdminConversationList: Erreur lors du chargement", error);
    notifications.error("Erreur lors du chargement des conversations");
  }
});
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-full flex flex-col"
  >
    <div
      class="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
    >
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
          Tickets de support
        </h2>
        <div class="flex gap-2">
          <span class="text-sm text-gray-500">
            {{ conversations.length }} ticket{{
              conversations.length > 1 ? "s" : ""
            }}
          </span>
        </div>
      </div>

      <!-- Filtres améliorés pour admin -->
      <div class="space-y-3">
        <div class="flex gap-2 flex-wrap">
          <button
            v-for="status in statuses"
            :key="status.value"
            @click="currentFilter = status.value"
            :class="[
              'px-3 py-1 text-xs font-medium rounded-full transition-colors',
              currentFilter === status.value
                ? 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
            ]"
          >
            {{ status.label }}
            <span
              v-if="status.count > 0"
              class="ml-1 bg-gray-500 text-white px-1 rounded"
            >
              {{ status.count }}
            </span>
          </button>
        </div>

        <!-- Filtre par assignation -->
        <div class="flex gap-2 text-xs">
          <button
            @click="assignmentFilter = 'all'"
            :class="[
              'px-2 py-1 rounded transition-colors',
              assignmentFilter === 'all'
                ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-800'
                : 'bg-gray-100 hover:bg-gray-200',
            ]"
          >
            Tous
          </button>
          <button
            @click="assignmentFilter = 'unassigned'"
            :class="[
              'px-2 py-1 rounded transition-colors',
              assignmentFilter === 'unassigned'
                ? 'bg-orange-600 text-white'
                : 'bg-orange-100 text-orange-600 hover:bg-orange-200',
            ]"
          >
            Non assignés ({{ unassignedCount }})
          </button>
          <button
            @click="assignmentFilter = 'mine'"
            :class="[
              'px-2 py-1 rounded transition-colors',
              assignmentFilter === 'mine'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 text-blue-600 hover:bg-blue-200',
            ]"
          >
            Mes tickets ({{ myTicketsCount }})
          </button>
        </div>
      </div>
    </div>

    <div
      class="flex-1 divide-y divide-gray-200 dark:divide-gray-700 overflow-y-auto"
    >
      <div v-if="loading" class="p-4 text-center">
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"
        ></div>
        <p class="text-sm text-gray-500 mt-2">Chargement des tickets...</p>
      </div>

      <div
        v-for="conversation in filteredConversations"
        :key="conversation.id"
        @click="$emit('select-conversation', conversation)"
        :class="[
          'p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors relative',
          selectedConversationId === conversation.id
            ? 'bg-primary-50 dark:bg-primary-900/20 border-r-4 border-primary-600'
            : '',
        ]"
      >
        <div class="flex justify-between items-start">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h3
                class="text-sm font-medium text-gray-900 dark:text-white truncate"
              >
                {{ conversation.subject }}
              </h3>

              <!-- Indicateurs visuels -->
              <div class="flex gap-1">
                <span
                  v-if="!conversation.admin_id"
                  class="w-2 h-2 bg-orange-500 rounded-full"
                  title="Non assigné"
                ></span>
                <span
                  v-if="conversation.admin_id === currentUserId"
                  class="w-2 h-2 bg-blue-500 rounded-full"
                  title="Votre ticket"
                ></span>
                <span
                  v-if="hasUnreadMessages(conversation)"
                  class="w-2 h-2 bg-red-500 rounded-full animate-pulse"
                  title="Nouveaux messages"
                ></span>
              </div>

              <!-- Bouton d'assignation rapide -->
              <button
                v-if="!conversation.admin_id"
                @click="quickAssignToMe(conversation, $event)"
                class="ml-2 px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                title="S'assigner ce ticket"
              >
                M'assigner
              </button>
            </div>

            <!-- Informations détaillées -->
            <div
              class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1"
            >
              <span
                :class="statusColors[conversation.status]"
                class="px-2 py-1 rounded-full"
              >
                {{ statusLabels[conversation.status] }}
              </span>
              <span
                :class="priorityColors[conversation.priority]"
                class="px-2 py-1 rounded-full"
              >
                {{ priorityLabels[conversation.priority] }}
              </span>
              <span>{{ formatDate(conversation.last_message_at) }}</span>
            </div>

            <!-- Utilisateur et admin -->
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-1">
                <span class="text-gray-600">Par:</span>
                <span class="font-medium">{{
                  conversation.user?.username
                }}</span>
              </div>

              <div v-if="conversation.admin" class="flex items-center gap-1">
                <img
                  v-if="conversation.admin.avatar_url"
                  :src="conversation.admin.avatar_url"
                  :alt="conversation.admin.username"
                  class="w-4 h-4 rounded-full"
                />
                <span class="text-gray-600">{{
                  conversation.admin.username
                }}</span>
                <span
                  v-if="conversation.admin.id === currentUserId"
                  class="text-blue-600"
                  >(vous)</span
                >
              </div>
              <div v-else class="text-orange-600 font-medium">Non assigné</div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="!loading && filteredConversations.length === 0"
        class="p-8 text-center"
      >
        <div class="text-gray-400 mb-2">
          <ChatBubbleLeftRightIcon class="w-12 h-12 mx-auto" />
        </div>
        <p class="text-gray-500 dark:text-gray-400">Aucun ticket trouvé</p>
        <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
          {{
            assignmentFilter === "unassigned"
              ? "Tous les tickets sont assignés"
              : "Essayez de changer les filtres"
          }}
        </p>
      </div>
    </div>
  </div>
</template>
