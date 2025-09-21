// frontend/src/stores/messages.js - Corrections importantes
import { defineStore } from "pinia";
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  withCredentials: true,
});

export const useMessagesStore = defineStore("messages", {
  state: () => ({
    conversations: [],
    currentConversation: null,
    currentMessages: [],
    loading: false,
    creating: false,
    sending: false,
    stats: {
      total: 0,
      by_status: {},
      by_priority: {},
    },
  }),

  getters: {
    unreadConversations: (state) =>
      state.conversations.filter(
        (conv) => conv.unread_count && conv.unread_count > 0
      ),

    conversationsByStatus: (state) => (status) =>
      state.conversations.filter((conv) => conv.status === status),

    sortedConversations: (state) =>
      [...state.conversations].sort(
        (a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)
      ),
  },

  actions: {
    // ==================== ACTIONS UTILISATEUR ====================

    async fetchConversations() {
      try {
        console.log("📡 Store: Récupération conversations utilisateur");
        this.loading = true;
        const response = await api.get("/messages/conversations");

        if (response.data.success) {
          this.conversations = response.data.conversations || [];
          console.log(
            "✅ Store: Conversations utilisateur chargées",
            this.conversations.length
          );
        } else {
          console.error("❌ Store: Réponse API incorrecte", response.data);
          throw new Error(response.data.message || "Erreur API");
        }
      } catch (error) {
        console.error("❌ Store: Erreur récupération conversations:", error);
        this.conversations = []; // Reset en cas d'erreur
        throw new Error(
          error.response?.data?.error ||
            error.message ||
            "Erreur lors de la récupération des conversations"
        );
      } finally {
        this.loading = false;
      }
    },

    async createConversation(conversationData) {
      try {
        console.log("🎫 Store: Création conversation", conversationData);
        this.creating = true;

        // S'assurer que les données requises sont présentes
        const payload = {
          subject: conversationData.subject,
          priority: conversationData.priority || "normal",
          category: conversationData.category || "general",
          initialMessage: conversationData.initialMessage, // ← AJOUTÉ
        };

        const response = await api.post("/messages/conversations", payload);

        console.log("📡 Store: Réponse création", response.data);

        if (response.data.success) {
          const newConversation = response.data.conversation;

          // Ajouter la nouvelle conversation en tête de liste
          this.conversations.unshift(newConversation);

          console.log("✅ Store: Conversation créée", newConversation.id);
          return newConversation;
        } else {
          throw new Error(
            response.data.message || "Erreur création conversation"
          );
        }
      } catch (error) {
        console.error("❌ Store: Erreur création conversation:", error);
        throw new Error(
          error.response?.data?.error ||
            error.message ||
            "Erreur lors de la création de la conversation"
        );
      } finally {
        this.creating = false;
      }
    },

    async fetchMessages(conversationId, page = 1) {
      try {
        console.log(
          `📡 Store: Récupération messages conversation ${conversationId}, page ${page}`
        );
        this.loading = true;

        const response = await api.get(
          `/messages/conversations/${conversationId}/messages?page=${page}`
        );

        if (response.data.success) {
          if (page === 1) {
            this.currentMessages = response.data.messages || [];
          } else {
            // Ajouter les messages plus anciens au début
            this.currentMessages.unshift(...(response.data.messages || []));
          }

          console.log(
            "✅ Store: Messages chargés",
            this.currentMessages.length
          );

          // Marquer les messages comme lus
          this.markMessagesAsRead(conversationId);
        }
      } catch (error) {
        console.error("❌ Store: Erreur récupération messages:", error);
        throw new Error(
          error.response?.data?.error ||
            error.message ||
            "Erreur lors de la récupération des messages"
        );
      } finally {
        this.loading = false;
      }
    },

    async sendMessage(conversationId, messageData) {
      try {
        console.log(
          `📨 Store: Envoi message conversation ${conversationId}`,
          messageData
        );
        this.sending = true;

        const response = await api.post(
          `/messages/conversations/${conversationId}/messages`,
          messageData
        );

        if (response.data.success) {
          const newMessage = response.data.message;

          // Ajouter le nouveau message à la liste
          this.currentMessages.push(newMessage);

          // Mettre à jour la conversation dans la liste
          const convIndex = this.conversations.findIndex(
            (c) => c.id === conversationId
          );

          if (convIndex !== -1) {
            this.conversations[convIndex].last_message_at =
              newMessage.created_at;
            // Réordonner les conversations
            const conv = this.conversations.splice(convIndex, 1)[0];
            this.conversations.unshift(conv);
          }

          console.log("✅ Store: Message envoyé", newMessage.id);
          return newMessage;
        }
      } catch (error) {
        console.error("❌ Store: Erreur envoi message:", error);
        throw new Error(
          error.response?.data?.error ||
            error.message ||
            "Erreur lors de l'envoi du message"
        );
      } finally {
        this.sending = false;
      }
    },

    setCurrentConversation(conversation) {
      console.log(
        "🎯 Store: Définition conversation courante",
        conversation?.id
      );
      this.currentConversation = conversation;
      this.currentMessages = [];
    },

    // ==================== ACTIONS ADMIN ====================

    async fetchAllConversations(filters = {}) {
      try {
        console.log("📡 Store: Récupération conversations admin", filters);
        this.loading = true;

        const params = new URLSearchParams();
        if (filters.status) params.append("status", filters.status);
        if (filters.priority) params.append("priority", filters.priority);
        if (filters.page) params.append("page", filters.page);
        if (filters.limit) params.append("limit", filters.limit);

        const response = await api.get(
          `/messages/admin/conversations?${params}`
        );

        if (response.data.success) {
          this.conversations = response.data.conversations || [];
          this.stats = response.data.stats || {};
          console.log(
            "✅ Store: Conversations admin chargées",
            this.conversations.length
          );
        } else {
          throw new Error(response.data.message || "Erreur API admin");
        }
      } catch (error) {
        console.error(
          "❌ Store: Erreur admin récupération conversations:",
          error
        );
        this.conversations = [];
        throw new Error(
          error.response?.data?.error ||
            error.message ||
            "Erreur lors de la récupération des conversations"
        );
      } finally {
        this.loading = false;
      }
    },

    async assignConversation(conversationId, adminId) {
      try {
        console.log(
          `🎯 Store: Attribution conversation ${conversationId} à ${adminId}`
        );

        const response = await api.put(
          `/messages/admin/conversations/${conversationId}/assign`,
          { admin_id: adminId }
        );

        if (response.data.success) {
          // Mettre à jour la conversation dans la liste
          const convIndex = this.conversations.findIndex(
            (c) => c.id === conversationId
          );

          if (convIndex !== -1) {
            this.conversations[convIndex] = response.data.conversation;
          }

          console.log("✅ Store: Conversation assignée");
          return response.data.conversation;
        }
      } catch (error) {
        console.error("❌ Store: Erreur attribution conversation:", error);
        throw new Error(
          error.response?.data?.error ||
            error.message ||
            "Erreur lors de l'attribution"
        );
      }
    },

    async changeConversationStatus(conversationId, status) {
      try {
        console.log(
          `📝 Store: Changement statut conversation ${conversationId} vers ${status}`
        );

        const response = await api.put(
          `/messages/admin/conversations/${conversationId}/status`,
          { status }
        );

        if (response.data.success) {
          // Mettre à jour la conversation dans la liste
          const convIndex = this.conversations.findIndex(
            (c) => c.id === conversationId
          );

          if (convIndex !== -1) {
            this.conversations[convIndex] = response.data.conversation;
          }

          console.log("✅ Store: Statut changé");
          return response.data.conversation;
        }
      } catch (error) {
        console.error("❌ Store: Erreur changement statut:", error);
        throw new Error(
          error.response?.data?.error ||
            error.message ||
            "Erreur lors du changement de statut"
        );
      }
    },

    // ==================== ACTIONS UTILITAIRES ====================

    clearCurrentConversation() {
      this.currentConversation = null;
      this.currentMessages = [];
    },

    markMessagesAsRead(conversationId) {
      const convIndex = this.conversations.findIndex(
        (c) => c.id === conversationId
      );

      if (convIndex !== -1) {
        this.conversations[convIndex].unread_count = 0;
        console.log(
          `📖 Store: Messages marqués comme lus pour conversation ${conversationId}`
        );
      }
    },

    // Polling pour les nouveaux messages (optionnel)
    async refreshCurrentConversation() {
      if (!this.currentConversation) return;

      const lastMessageTime =
        this.currentMessages.length > 0
          ? this.currentMessages[this.currentMessages.length - 1].created_at
          : null;

      try {
        const response = await api.get(
          `/messages/conversations/${this.currentConversation.id}/messages?page=1`
        );

        if (response.data.success) {
          const newMessages = response.data.messages || [];

          if (lastMessageTime) {
            // Ne garder que les nouveaux messages
            const recentMessages = newMessages.filter(
              (msg) => new Date(msg.created_at) > new Date(lastMessageTime)
            );

            if (recentMessages.length > 0) {
              this.currentMessages.push(...recentMessages);
              console.log(
                `🔄 Store: ${recentMessages.length} nouveaux messages ajoutés`
              );
            }
          } else {
            this.currentMessages = newMessages;
          }
        }
      } catch (error) {
        console.error("❌ Store: Erreur refresh conversation:", error);
      }
    },
  },
});
