<!-- frontend/src/components/messaging/TicketAssignmentPanel.vue -->

<script setup>
import { ref, computed, onMounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useMessagesStore } from "@/stores/messages";
import { useNotificationsStore } from "@/stores/notifications";
import axios from "axios";

const props = defineProps({
  conversation: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["conversation-updated"]);

const authStore = useAuthStore();
const messagesStore = useMessagesStore();
const notifications = useNotificationsStore();

const availableAdmins = ref([]);
const assigning = ref(false);
const statusChanging = ref(false);

const currentUserId = computed(() => authStore.user?.id);

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  withCredentials: true,
});

const loadAvailableAdmins = async () => {
  try {
    const response = await api.get("/admin/admins");
    if (response.data.success) {
      availableAdmins.value = response.data.admins;
    }
  } catch (error) {
    console.error("Erreur chargement admins:", error);
  }
};

const handleAssignmentChange = async (adminId) => {
  if (adminId === (props.conversation.admin_id || "")) return;

  try {
    assigning.value = true;

    const response = await api.put(
      `/messages/admin/conversations/${props.conversation.id}/assign`,
      { admin_id: adminId || null }
    );

    if (response.data.success) {
      emit("conversation-updated", response.data.conversation);

      const assignedTo = adminId
        ? availableAdmins.value.find((a) => a.id === adminId)?.username
        : "personne";

      notifications.success(`Ticket assigné à ${assignedTo}`);

      // Rafraîchir les conversations admin
      await messagesStore.fetchAllConversations();
    }
  } catch (error) {
    notifications.error("Erreur lors de l'assignation");
    console.error("Erreur assignation:", error);
  } finally {
    assigning.value = false;
  }
};

const assignToMe = () => {
  handleAssignmentChange(currentUserId.value);
};

const changeStatus = async (newStatus) => {
  try {
    statusChanging.value = true;

    const response = await api.put(
      `/messages/admin/conversations/${props.conversation.id}/status`,
      { status: newStatus }
    );

    if (response.data.success) {
      emit("conversation-updated", response.data.conversation);
      notifications.success(`Statut changé vers "${newStatus}"`);

      // Rafraîchir les conversations admin
      await messagesStore.fetchAllConversations();
    }
  } catch (error) {
    notifications.error("Erreur lors du changement de statut");
    console.error("Erreur changement statut:", error);
  } finally {
    statusChanging.value = false;
  }
};

onMounted(() => {
  loadAvailableAdmins();
});
</script>
<template>
  <div
    class="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800"
  >
    <div class="space-y-3">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white">
        Gestion du ticket
      </h4>

      <!-- Assignation -->
      <div>
        <label
          class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Assigné à
        </label>
        <div class="flex gap-2">
          <select
            :value="conversation.admin_id || ''"
            @change="handleAssignmentChange($event.target.value)"
            :disabled="assigning"
            class="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white"
          >
            <option value="">Non assigné</option>
            <option
              v-for="admin in availableAdmins"
              :key="admin.id"
              :value="admin.id"
            >
              {{ admin.username }}
              {{ admin.id === currentUserId ? " (vous)" : "" }}
            </option>
          </select>
          <button
            @click="assignToMe"
            :disabled="assigning || conversation.admin_id === currentUserId"
            class="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <span v-if="assigning">...</span>
            <span v-else>Moi</span>
          </button>
        </div>
      </div>

      <!-- Actions rapides -->
      <div class="flex gap-2">
        <button
          @click="changeStatus('in_progress')"
          :disabled="statusChanging || conversation.status === 'in_progress'"
          class="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          En cours
        </button>
        <button
          @click="changeStatus('resolved')"
          :disabled="statusChanging || conversation.status === 'resolved'"
          class="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
        >
          Résolu
        </button>
        <button
          @click="changeStatus('closed')"
          :disabled="statusChanging || conversation.status === 'closed'"
          class="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400"
        >
          Fermer
        </button>
      </div>

      <!-- Info sur l'assignation actuelle -->
      <div
        v-if="conversation.admin"
        class="text-xs text-gray-500 dark:text-gray-400"
      >
        Assigné à {{ conversation.admin.username }}
        <span
          v-if="conversation.admin.id === currentUserId"
          class="text-primary-600"
          >(vous)</span
        >
      </div>
      <div v-else class="text-xs text-orange-600 dark:text-orange-400">
        🟠 Ticket non assigné
      </div>
    </div>
  </div>
</template>
