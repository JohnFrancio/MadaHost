<!-- frontend/src/views/AdminMessages.vue -->

<script setup>
import { ref, computed, onMounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useMessagesStore } from "@/stores/messages";
import { ChatBubbleBottomCenterTextIcon } from "@heroicons/vue/24/outline";
import AdminConversationList from "@/components/messaging/AdminConversationList.vue";
import ConversationChat from "@/components/messaging/ConversationChat.vue";

const authStore = useAuthStore();
const messagesStore = useMessagesStore();

const selectedConversation = ref(null);

// Statistiques computées
const conversations = computed(() => messagesStore.conversations);
const unassignedCount = computed(
  () =>
    conversations.value.filter(
      (conv) => !conv.admin_id && conv.status !== "closed"
    ).length
);
const myTicketsCount = computed(
  () =>
    conversations.value.filter((conv) => conv.admin_id === authStore.user?.id)
      .length
);
const openCount = computed(
  () => conversations.value.filter((conv) => conv.status === "open").length
);
const totalCount = computed(() => conversations.value.length);

const selectConversation = (conversation) => {
  selectedConversation.value = conversation;
  messagesStore.markMessagesAsRead(conversation.id);
};

const handleConversationUpdated = (updatedConversation) => {
  // Mettre à jour la conversation sélectionnée
  if (selectedConversation.value?.id === updatedConversation.id) {
    Object.assign(selectedConversation.value, updatedConversation);
  }

  // Rafraîchir la liste des conversations
  messagesStore.fetchAllConversations();
};

const showNextUnassigned = () => {
  const unassigned = conversations.value.find(
    (conv) => !conv.admin_id && conv.status !== "closed"
  );
  if (unassigned) {
    selectConversation(unassigned);
  }
};

const showMyTickets = () => {
  const myTicket = conversations.value.find(
    (conv) => conv.admin_id === authStore.user?.id
  );
  if (myTicket) {
    selectConversation(myTicket);
  }
};

onMounted(() => {
  // Le chargement est géré par AdminConversationList
});
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        Gestion des tickets de support
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mt-1">
        Gérez et répondez aux demandes de support des utilisateurs
      </p>
    </div>

    <!-- Statistiques rapides -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div
        class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
      >
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div
              class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center"
            >
              <span class="text-orange-600 font-bold">!</span>
            </div>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              Non assignés
            </p>
            <p class="text-lg font-bold text-orange-600">
              {{ unassignedCount }}
            </p>
          </div>
        </div>
      </div>

      <div
        class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
      >
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div
              class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"
            >
              <span class="text-blue-600 font-bold">@</span>
            </div>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              Mes tickets
            </p>
            <p class="text-lg font-bold text-blue-600">{{ myTicketsCount }}</p>
          </div>
        </div>
      </div>

      <div
        class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
      >
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div
              class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center"
            >
              <span class="text-green-600 font-bold">✓</span>
            </div>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              Ouverts
            </p>
            <p class="text-lg font-bold text-green-600">{{ openCount }}</p>
          </div>
        </div>
      </div>

      <div
        class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
      >
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div
              class="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center"
            >
              <span class="text-gray-600 font-bold">#</span>
            </div>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              Total
            </p>
            <p class="text-lg font-bold text-gray-900 dark:text-white">
              {{ totalCount }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-300px)]">
      <!-- Liste des conversations admin -->
      <div class="lg:col-span-1">
        <AdminConversationList
          :selected-conversation-id="selectedConversation?.id"
          @select-conversation="selectConversation"
        />
      </div>

      <!-- Interface de chat avec panneau admin -->
      <div class="lg:col-span-2">
        <div v-if="selectedConversation" class="h-full">
          <ConversationChat
            :conversation="selectedConversation"
            :show-admin-actions="true"
            @conversation-updated="handleConversationUpdated"
          />
        </div>

        <!-- État vide -->
        <div
          v-else
          class="h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-center"
        >
          <div class="text-center">
            <ChatBubbleBottomCenterTextIcon
              class="w-16 h-16 text-gray-400 mx-auto mb-4"
            />
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Sélectionnez un ticket
            </h3>
            <p class="text-gray-500 dark:text-gray-400">
              Choisissez un ticket dans la liste pour commencer à répondre
            </p>

            <!-- Actions rapides -->
            <div class="mt-4 space-y-2">
              <button
                v-if="unassignedCount > 0"
                @click="showNextUnassigned"
                class="block w-full px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Voir le prochain ticket non assigné ({{ unassignedCount }})
              </button>
              <button
                v-if="myTicketsCount > 0"
                @click="showMyTickets"
                class="block w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Voir mes tickets ({{ myTicketsCount }})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
