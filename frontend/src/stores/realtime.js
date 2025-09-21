// frontend/src/stores/realtime.js - VERSION CORRIGÉE
import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { useMessagesStore } from "./messages";
import { useNotificationsStore } from "./notifications";
import WebSocketService from "@/services/websocket";

export const useRealtimeStore = defineStore("realtime", {
  state: () => ({
    isConnected: false,
    unreadMessagesCount: 0,
    connectionStatus: "disconnected",
  }),

  getters: {
    hasUnreadMessages: (state) => state.unreadMessagesCount > 0,
  },

  actions: {
    async initializeRealtime() {
      const authStore = useAuthStore();

      if (!authStore.isAuthenticated || !authStore.user) {
        console.log("⚠️ Utilisateur non authentifié, WebSocket non initialisé");
        return;
      }

      this.connectionStatus = "connecting";
      this.setupWebSocketListeners();
      WebSocketService.connect(authStore.user);
    },

    setupWebSocketListeners() {
      const authStore = useAuthStore();
      const messagesStore = useMessagesStore();
      const notifications = useNotificationsStore();

      // Authentification réussie
      WebSocketService.on("auth_success", (data) => {
        console.log("✅ Authentification WebSocket réussie");
        this.isConnected = true;
        this.connectionStatus = "connected";
      });

      // Nouveau message reçu
      WebSocketService.on("new_message", (data) => {
        console.log("💬 Nouveau message reçu via WebSocket", data);

        // Si on est sur la même conversation, ajouter le message directement
        if (messagesStore.currentConversation?.id === data.conversationId) {
          messagesStore.currentMessages.push(data.message);
          notifications.success("Nouveau message reçu", {
            duration: 2000,
            showClose: false,
          });
        } else {
          // Notification normale
          const isFromAdmin = data.message.sender.role === "admin";
          const notifTitle = isFromAdmin
            ? `Réponse admin de ${data.message.sender.username}`
            : `Nouveau message de ${data.message.sender.username}`;

          notifications.info(notifTitle, { duration: 5000 });
        }

        // CORRECTION CRITIQUE: Actualiser les conversations selon le rôle
        setTimeout(async () => {
          try {
            if (authStore.user?.role === "admin") {
              console.log("👑 Admin - Actualisation des conversations");
              await messagesStore.fetchAllConversations();
            } else {
              console.log("👤 User - Actualisation des conversations");
              await messagesStore.fetchConversations();
            }
          } catch (error) {
            console.error("❌ Erreur actualisation conversations:", error);
          }
        }, 500); // Délai pour laisser le message se créer côté serveur
      });

      // CORRECTION: Notifications admin améliorées
      WebSocketService.on("admin_notification", (data) => {
        console.log("👑 Notification admin reçue:", data);

        // Afficher la notification
        notifications.info(data.title, {
          description: data.message,
          duration: 8000,
          action: data.data?.conversation_id
            ? {
                label: "Voir le ticket",
                handler: () => {
                  // Naviguer vers la conversation
                  if (window.$router) {
                    window.$router.push(
                      `/messages?conv=${data.data.conversation_id}`
                    );
                  }
                },
              }
            : undefined,
        });

        // CORRECTION: Actualiser les conversations pour les admins avec délai
        if (authStore.user?.role === "admin") {
          console.log("👑 Admin - Actualisation après notification");
          setTimeout(async () => {
            try {
              await messagesStore.fetchAllConversations();
              console.log("✅ Conversations admin actualisées");
            } catch (error) {
              console.error(
                "❌ Erreur actualisation admin conversations:",
                error
              );
            }
          }, 1000); // Délai plus long pour les notifications admin
        }
      });

      // Mise à jour du compteur de messages non lus
      WebSocketService.on("unread_count", (data) => {
        this.unreadMessagesCount = data.count;
        console.log(`📧 Compteur messages non lus: ${data.count}`);
      });

      // Mise à jour de conversation
      WebSocketService.on("conversation_update", (data) => {
        console.log("🔄 Mise à jour conversation via WebSocket");

        const convIndex = messagesStore.conversations.findIndex(
          (c) => c.id === data.conversationId
        );

        if (convIndex !== -1) {
          Object.assign(messagesStore.conversations[convIndex], data.data);
        }

        if (messagesStore.currentConversation?.id === data.conversationId) {
          Object.assign(messagesStore.currentConversation, data.data);
        }

        switch (data.updateType) {
          case "status_changed":
            notifications.info(`Statut changé: ${data.data.status}`);
            break;
          case "assigned":
            notifications.info("Ticket assigné à un administrateur");
            break;
        }
      });

      // Gestion des erreurs et connexions
      WebSocketService.on("auth_error", (data) => {
        console.error("❌ Erreur authentification WebSocket:", data.message);
        this.connectionStatus = "error";
        notifications.error("Erreur de connexion temps réel");
      });

      WebSocketService.on("connected", () => {
        this.connectionStatus = "connected";
      });

      WebSocketService.on("disconnected", () => {
        this.connectionStatus = "disconnected";
        this.isConnected = false;
      });

      WebSocketService.on("error", () => {
        this.connectionStatus = "error";
        this.isConnected = false;
      });
    },

    joinConversation(conversationId) {
      WebSocketService.joinConversation(conversationId);
    },

    leaveConversation() {
      WebSocketService.leaveConversation();
    },

    disconnect() {
      WebSocketService.disconnect();
      this.isConnected = false;
      this.connectionStatus = "disconnected";
      this.unreadMessagesCount = 0;
    },
  },
});
