// backend/src/services/websocket.js
const WebSocket = require("ws");
const url = require("url");
const supabase = require("../config/supabase");

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // userId -> WebSocket connection
    this.userSessions = new Map(); // WebSocket -> userId
  }

  initialize(server) {
    this.wss = new WebSocket.Server({
      server,
      path: "/ws",
      verifyClient: (info) => {
        // Optionnel : vérification d'authentification
        console.log("🔍 Nouvelle tentative de connexion WebSocket");
        return true;
      },
    });

    this.wss.on("connection", (ws, request) => {
      console.log("🔌 Nouvelle connexion WebSocket établie");

      // Envoyer un message de bienvenue immédiatement
      ws.send(
        JSON.stringify({
          type: "connection",
          message: "Connexion WebSocket établie",
          timestamp: new Date().toISOString(),
        })
      );

      ws.on("message", async (message) => {
        try {
          const data = JSON.parse(message);
          console.log("📨 Message reçu via WebSocket:", data.type);
          await this.handleMessage(ws, data);
        } catch (error) {
          console.error("❌ Erreur traitement message WebSocket:", error);
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Message invalide",
            })
          );
        }
      });

      ws.on("close", (code, reason) => {
        console.log(`🔌 Connexion WebSocket fermée (code: ${code})`);
        this.handleDisconnect(ws);
      });

      ws.on("error", (error) => {
        console.error("❌ Erreur WebSocket:", error);
        this.handleDisconnect(ws);
      });

      // Ping périodique pour maintenir la connexion
      ws.isAlive = true;
      ws.on("pong", () => {
        ws.isAlive = true;
      });
    });

    // Ping toutes les 30 secondes pour maintenir les connexions actives
    this.pingInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          console.log("🔌 Connexion WebSocket inactive, fermeture");
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    console.log("🌐 Serveur WebSocket démarré sur /ws");
    console.log(`📊 WebSocket Server configuré avec les options:`, {
      path: "/ws",
      clientTracking: true,
    });
  }

  async handleMessage(ws, data) {
    try {
      switch (data.type) {
        case "auth":
          await this.handleAuth(ws, data);
          break;

        case "join_conversation":
          await this.handleJoinConversation(ws, data);
          break;

        case "leave_conversation":
          this.handleLeaveConversation(ws, data);
          break;

        case "ping":
          ws.send(
            JSON.stringify({
              type: "pong",
              timestamp: new Date().toISOString(),
            })
          );
          break;

        default:
          console.log("🤷 Type de message WebSocket inconnu:", data.type);
          ws.send(
            JSON.stringify({
              type: "error",
              message: `Type de message inconnu: ${data.type}`,
            })
          );
      }
    } catch (error) {
      console.error("❌ Erreur dans handleMessage:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Erreur interne du serveur",
        })
      );
    }
  }

  async handleAuth(ws, data) {
    try {
      const { userId, accessToken } = data;

      console.log(
        `🔐 Tentative d'authentification WebSocket pour userId: ${userId}`
      );

      if (!userId) {
        ws.send(
          JSON.stringify({
            type: "auth_error",
            message: "ID utilisateur manquant",
          })
        );
        return;
      }

      // Vérifier l'utilisateur en base
      const { data: user, error } = await supabase
        .from("users")
        .select("id, username, role")
        .eq("id", userId)
        .single();

      if (error || !user) {
        console.error("❌ Utilisateur non trouvé pour WebSocket:", error);
        ws.send(
          JSON.stringify({
            type: "auth_error",
            message: "Utilisateur non trouvé",
          })
        );
        return;
      }

      // Fermer l'ancienne connexion si elle existe
      const existingWs = this.clients.get(userId);
      if (existingWs && existingWs.readyState === WebSocket.OPEN) {
        console.log(
          `🔄 Fermeture de l'ancienne connexion pour ${user.username}`
        );
        existingWs.close();
      }

      // Enregistrer la nouvelle connexion
      this.clients.set(userId, ws);
      this.userSessions.set(ws, {
        userId,
        username: user.username,
        role: user.role,
        connectedAt: new Date().toISOString(),
      });

      ws.send(
        JSON.stringify({
          type: "auth_success",
          user: { id: user.id, username: user.username, role: user.role },
          message: "Authentification réussie",
        })
      );

      console.log(`✅ Utilisateur ${user.username} authentifié via WebSocket`);

      // Envoyer le nombre de messages non lus
      await this.sendUnreadCount(userId);
    } catch (error) {
      console.error("❌ Erreur authentification WebSocket:", error);
      ws.send(
        JSON.stringify({
          type: "auth_error",
          message: "Erreur d'authentification",
        })
      );
    }
  }

  async handleJoinConversation(ws, data) {
    const session = this.userSessions.get(ws);
    if (!session) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Non authentifié",
        })
      );
      return;
    }

    const { conversationId } = data;
    if (!conversationId) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "ID de conversation manquant",
        })
      );
      return;
    }

    console.log(
      `👥 ${session.username} rejoint la conversation ${conversationId}`
    );

    // Vérifier l'accès à la conversation
    const hasAccess = await this.checkConversationAccess(
      session.userId,
      conversationId,
      session.role
    );
    if (!hasAccess) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Accès non autorisé à cette conversation",
        })
      );
      return;
    }

    // Marquer les messages comme lus
    await this.markMessagesAsRead(conversationId, session.userId);

    // Ajouter à la conversation
    session.currentConversation = conversationId;

    ws.send(
      JSON.stringify({
        type: "conversation_joined",
        conversationId,
        message: "Conversation rejointe avec succès",
      })
    );

    console.log(
      `✅ ${session.username} a rejoint la conversation ${conversationId}`
    );
  }

  handleLeaveConversation(ws, data) {
    const session = this.userSessions.get(ws);
    if (!session) return;

    const { conversationId } = data;

    if (session.currentConversation === conversationId) {
      session.currentConversation = null;
    }

    ws.send(
      JSON.stringify({
        type: "conversation_left",
        conversationId: conversationId || session.currentConversation,
        message: "Conversation quittée",
      })
    );

    console.log(`👋 ${session.username} a quitté la conversation`);
  }

  handleDisconnect(ws) {
    const session = this.userSessions.get(ws);
    if (session) {
      this.clients.delete(session.userId);
      this.userSessions.delete(ws);
      console.log(`👋 ${session.username} déconnecté du WebSocket`);
    }
  }

  // Méthodes pour envoyer des notifications
  async notifyNewMessage(conversationId, message, senderId) {
    try {
      console.log(
        `📢 Notification nouveau message dans conversation ${conversationId}`
      );

      // Récupérer les participants de la conversation avec leurs rôles
      const { data: conversation } = await supabase
        .from("conversations")
        .select(
          `
        user_id, 
        admin_id,
        subject,
        priority,
        users!conversations_user_id_fkey(username, role),
        admin:users!conversations_admin_id_fkey(username, role)
      `
        )
        .eq("id", conversationId)
        .single();

      if (!conversation) {
        console.log("⚠️ Conversation non trouvée pour notification");
        return;
      }

      // Récupérer les infos de l'expéditeur
      const { data: sender } = await supabase
        .from("users")
        .select("username, role")
        .eq("id", senderId)
        .single();

      const participants = [conversation.user_id, conversation.admin_id].filter(
        Boolean
      );

      console.log(`👥 Participants à notifier:`, participants);
      console.log(`📨 Expéditeur: ${sender?.username} (${sender?.role})`);
      console.log(`🚫 Expéditeur exclu:`, senderId);

      for (const participantId of participants) {
        if (participantId === senderId) {
          console.log(`⏭️ Skipping expéditeur ${participantId}`);
          continue;
        }

        const ws = this.clients.get(participantId);
        console.log(
          `🔍 WebSocket pour ${participantId}:`,
          ws ? "CONNECTÉ" : "NON CONNECTÉ"
        );

        if (ws && ws.readyState === WebSocket.OPEN) {
          const session = this.userSessions.get(ws);
          const userType = session?.role === "admin" ? "ADMIN" : "USER";

          console.log(`✅ Envoi notification à ${userType} ${participantId}`);

          // Enrichir le message avec les infos du sender
          const enrichedMessage = {
            ...message,
            sender: {
              ...message.sender,
              role: sender?.role || "user",
            },
          };

          ws.send(
            JSON.stringify({
              type: "new_message",
              conversationId,
              message: enrichedMessage,
              metadata: {
                senderRole: sender?.role,
                conversationSubject: conversation.subject,
                priority: conversation.priority,
              },
            })
          );

          console.log(`✅ Message notifié à ${userType} ${participantId}`);
        } else {
          console.log(`⚠️ ${participantId} non connecté via WebSocket`);
        }

        // Mettre à jour le compteur de messages non lus
        await this.sendUnreadCount(participantId);
      }

      // CORRECTION: Si c'est un message d'utilisateur vers un ticket non assigné,
      // ne pas envoyer de notification admin ici car c'est déjà fait dans les routes
      if (sender?.role !== "admin" && !conversation.admin_id) {
        console.log(
          `📢 Message utilisateur vers ticket non assigné - notification admin déjà envoyée`
        );
      }
    } catch (error) {
      console.error("❌ Erreur notification nouveau message:", error);
    }
  }

  async notifyConversationUpdate(conversationId, updateType, updateData) {
    try {
      console.log(
        `📢 Notification mise à jour conversation ${conversationId}: ${updateType}`
      );

      const { data: conversation } = await supabase
        .from("conversations")
        .select("user_id, admin_id")
        .eq("id", conversationId)
        .single();

      if (!conversation) return;

      const participants = [conversation.user_id, conversation.admin_id].filter(
        Boolean
      );

      for (const participantId of participants) {
        const ws = this.clients.get(participantId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "conversation_update",
              conversationId,
              updateType,
              data: updateData,
            })
          );
        }
      }
    } catch (error) {
      console.error("❌ Erreur notification mise à jour conversation:", error);
    }
  }

  async notifyAdmins(notification) {
    try {
      console.log(`📢 Notification admin: ${notification.title}`);

      // Récupérer tous les admins
      const { data: admins } = await supabase
        .from("users")
        .select("id")
        .eq("role", "admin");

      if (!admins) return;

      let notifiedCount = 0;
      for (const admin of admins) {
        const ws = this.clients.get(admin.id);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "admin_notification",
              ...notification,
            })
          );
          notifiedCount++;
        }
      }

      console.log(`✅ ${notifiedCount} admins notifiés via WebSocket`);
    } catch (error) {
      console.error("❌ Erreur notification admins:", error);
    }
  }

  async sendUnreadCount(userId) {
    try {
      const ws = this.clients.get(userId);
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      console.log(`🔍 Calcul messages non lus pour utilisateur ${userId}`);

      // Compter les messages non lus
      const { data: unreadMessages, error } = await supabase
        .from("messages")
        .select("id, conversation_id, conversations!inner(user_id, admin_id)")
        .eq("is_read", false)
        .neq("sender_id", userId);

      if (error) {
        console.error("❌ Erreur requête messages non lus:", error);
        return;
      }

      console.log(`📊 Messages non lus trouvés:`, unreadMessages?.length || 0);

      if (!unreadMessages || unreadMessages.length === 0) {
        ws.send(JSON.stringify({ type: "unread_count", count: 0 }));
        console.log(
          `📧 Compteur envoyé à utilisateur ${userId}: 0 messages non lus`
        );
        return;
      }

      // Récupérer l'utilisateur pour connaître son rôle
      const { data: user } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .single();

      // Filtrer selon le rôle
      let userUnreadMessages;
      if (user?.role === "admin") {
        // Les admins voient tous les messages non lus des conversations
        userUnreadMessages = unreadMessages.filter((msg) => {
          const conv = msg.conversations;
          return conv.admin_id === userId || conv.admin_id === null; // Messages assignés ou non assignés
        });
        console.log(
          `👑 Admin - Messages filtrés: ${userUnreadMessages.length}`
        );
      } else {
        // Les utilisateurs voient seulement leurs conversations
        userUnreadMessages = unreadMessages.filter((msg) => {
          const conv = msg.conversations;
          return conv.user_id === userId;
        });
        console.log(
          `👤 Utilisateur - Messages filtrés: ${userUnreadMessages.length}`
        );
      }

      const unreadCount = userUnreadMessages.length;

      ws.send(
        JSON.stringify({
          type: "unread_count",
          count: unreadCount,
        })
      );

      console.log(
        `📧 Compteur envoyé à utilisateur ${userId}: ${unreadCount} messages non lus`
      );
    } catch (error) {
      console.error("❌ Erreur calcul messages non lus:", error);
    }
  }

  async checkConversationAccess(userId, conversationId, userRole) {
    try {
      const { data: conversation } = await supabase
        .from("conversations")
        .select("user_id, admin_id")
        .eq("id", conversationId)
        .single();

      if (!conversation) return false;

      return (
        conversation.user_id === userId ||
        conversation.admin_id === userId ||
        userRole === "admin"
      );
    } catch (error) {
      console.error("❌ Erreur vérification accès conversation:", error);
      return false;
    }
  }

  async markMessagesAsRead(conversationId, userId) {
    try {
      const { error } = await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .neq("sender_id", userId)
        .eq("is_read", false);

      if (error) {
        console.error("❌ Erreur marquage messages lus:", error);
      } else {
        console.log(
          `✅ Messages marqués comme lus pour conversation ${conversationId}`
        );
      }
    } catch (error) {
      console.error("❌ Erreur marquage messages lus:", error);
    }
  }

  // Méthode pour obtenir les statistiques de connexions
  getStats() {
    return {
      connectedUsers: this.clients.size,
      totalConnections: this.userSessions.size,
      activeConnections: this.wss ? this.wss.clients.size : 0,
    };
  }

  // Méthode pour fermer proprement le serveur WebSocket
  close() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    if (this.wss) {
      this.wss.clients.forEach((ws) => {
        ws.close();
      });
      this.wss.close();
    }

    this.clients.clear();
    this.userSessions.clear();
    console.log("🔌 Serveur WebSocket fermé");
  }
}

module.exports = new WebSocketManager();
