const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { requireAuth } = require("../middleware/auth");
const { requireAdmin, logAdminAction } = require("../middleware/admin");
const WebSocketManager = require("../services/websocket");

// ==================== ROUTES UTILISATEUR ====================

router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    console.log(
      `📧 Récupération compteur messages non lus pour ${req.user.username}`
    );

    const { data: unreadMessages } = await supabase
      .from("messages")
      .select(
        `
        id, 
        conversation_id,
        conversations!inner(user_id, admin_id)
      `
      )
      .eq("is_read", false)
      .neq("sender_id", req.user.id);

    if (!unreadMessages) {
      return res.json({ success: true, count: 0 });
    }

    // Filtrer les messages des conversations où l'utilisateur participe
    const userUnreadMessages = unreadMessages.filter((msg) => {
      const conv = msg.conversations;
      return conv.user_id === req.user.id || conv.admin_id === req.user.id;
    });

    res.json({
      success: true,
      count: userUnreadMessages.length,
    });
  } catch (error) {
    console.error("❌ Erreur compteur messages non lus:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// Obtenir toutes les conversations d'un utilisateur
router.get("/conversations", requireAuth, async (req, res) => {
  try {
    console.log(`📬 Récupération conversations pour ${req.user.username}`);

    const { data: conversations, error } = await supabase
      .from("conversations")
      .select(
        `
        id,
        subject,
        category,
        priority,
        status,
        created_at,
        updated_at,
        last_message_at,
        admin:admin_id(username, avatar_url),
        message_count:messages(count)
      `
      )
      .eq("user_id", req.user.id)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("❌ Erreur récupération conversations:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la récupération des conversations",
      });
    }

    res.json({
      success: true,
      conversations: conversations || [],
    });
  } catch (error) {
    console.error("❌ Erreur serveur:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// Créer une nouvelle conversation (ticket de support)
router.post("/conversations", requireAuth, async (req, res) => {
  try {
    const {
      subject,
      category = "general",
      priority = "normal",
      initialMessage,
    } = req.body;

    if (!subject || !initialMessage) {
      return res.status(400).json({
        success: false,
        error: "Sujet et message initial requis",
      });
    }

    console.log(
      `📝 Nouvelle conversation: ${subject} par ${req.user.username}`
    );

    // Créer la conversation
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .insert({
        user_id: req.user.id,
        subject,
        category,
        priority,
        status: "open",
      })
      .select()
      .single();

    if (conversationError) {
      console.error("❌ Erreur création conversation:", conversationError);
      return res.status(500).json({
        success: false,
        error: "Impossible de créer la conversation",
      });
    }

    // Ajouter le message initial
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        sender_id: req.user.id,
        content: initialMessage,
        message_type: "text",
      })
      .select(
        `
        id,
        content,
        message_type,
        attachments,
        is_read,
        created_at,
        sender:sender_id(id, username, avatar_url, role)
      `
      )
      .single();

    if (messageError) {
      console.error("❌ Erreur création message:", messageError);
      return res.status(500).json({
        success: false,
        error: "Impossible d'ajouter le message",
      });
    }

    // 🔥 NOTIFICATION WEBSOCKET POUR LES ADMINS
    await WebSocketManager.notifyAdmins({
      title: `Nouveau ticket: ${subject}`,
      message: `Nouveau ticket créé par ${req.user.username}`,
      data: {
        conversation_id: conversation.id,
        type: "new_conversation",
        priority,
        category,
      },
    });

    res.json({
      success: true,
      conversation: {
        ...conversation,
        initial_message: message,
      },
      message: "Conversation créée avec succès",
    });
  } catch (error) {
    console.error("❌ Erreur création conversation:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// ⭐ ROUTE AJOUTÉE - Obtenir les messages d'une conversation
router.get(
  "/conversations/:conversationId/messages",
  requireAuth,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      console.log(
        `📖 Récupération messages conversation ${conversationId} pour ${req.user.username} (page ${page})`
      );

      // Vérifier l'accès à la conversation
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("user_id, admin_id, status")
        .eq("id", conversationId)
        .single();

      if (convError || !conversation) {
        return res.status(404).json({
          success: false,
          error: "Conversation non trouvée",
        });
      }

      const isOwner = conversation.user_id === req.user.id;
      const isAssignedAdmin = conversation.admin_id === req.user.id;
      const isGeneralAdmin = req.user.role === "admin";

      if (!isOwner && !isAssignedAdmin && !isGeneralAdmin) {
        return res.status(403).json({
          success: false,
          error: "Accès non autorisé à cette conversation",
        });
      }

      // Récupérer les messages avec pagination
      const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select(
          `
        id,
        content,
        message_type,
        attachments,
        is_read,
        created_at,
        edited_at,
        sender:sender_id(id, username, avatar_url, role)
      `
        )
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (messagesError) {
        console.error("❌ Erreur récupération messages:", messagesError);
        return res.status(500).json({
          success: false,
          error: "Erreur lors de la récupération des messages",
        });
      }

      // Marquer les messages comme lus (sauf ceux envoyés par l'utilisateur actuel)
      if (messages && messages.length > 0) {
        const messagesToMarkAsRead = messages
          .filter((msg) => msg.sender.id !== req.user.id && !msg.is_read)
          .map((msg) => msg.id);

        if (messagesToMarkAsRead.length > 0) {
          await supabase
            .from("messages")
            .update({ is_read: true })
            .in("id", messagesToMarkAsRead);
        }
      }

      // Inverser l'ordre pour avoir les plus anciens en premier
      const orderedMessages = messages ? messages.reverse() : [];

      res.json({
        success: true,
        messages: orderedMessages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: orderedMessages.length === parseInt(limit),
        },
      });
    } catch (error) {
      console.error("❌ Erreur récupération messages:", error);
      res.status(500).json({ success: false, error: "Erreur serveur" });
    }
  }
);

// Envoyer un message dans une conversation (VERSION UNIFIÉE)
router.post(
  "/conversations/:conversationId/messages",
  requireAuth,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { content, message_type = "text", attachments = null } = req.body;

      if (!content || content.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "Le contenu du message est requis",
        });
      }

      console.log(
        `💬 Nouveau message dans conversation ${conversationId} par ${req.user.username}`
      );

      // Vérifier l'accès à la conversation
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("user_id, admin_id, status")
        .eq("id", conversationId)
        .single();

      if (convError || !conversation) {
        return res.status(404).json({
          success: false,
          error: "Conversation non trouvée",
        });
      }

      const isOwner = conversation.user_id === req.user.id;
      const isAssignedAdmin = conversation.admin_id === req.user.id;
      const isGeneralAdmin = req.user.role === "admin";

      if (!isOwner && !isAssignedAdmin && !isGeneralAdmin) {
        return res.status(403).json({
          success: false,
          error: "Accès non autorisé à cette conversation",
        });
      }

      // Rouvrir la conversation si elle était fermée et que c'est l'utilisateur qui écrit
      if (conversation.status === "closed" && isOwner) {
        await supabase
          .from("conversations")
          .update({ status: "open" })
          .eq("id", conversationId);
      }

      // Créer le message
      const { data: message, error: messageError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: req.user.id,
          content: content.trim(),
          message_type,
          attachments,
        })
        .select(
          `
        id,
        content,
        message_type,
        attachments,
        is_read,
        created_at,
        sender:sender_id(id, username, avatar_url, role)
      `
        )
        .single();

      if (messageError) {
        console.error("❌ Erreur création message:", messageError);
        return res.status(500).json({
          success: false,
          error: "Impossible d'envoyer le message",
        });
      }

      // 🔥 NOTIFICATION WEBSOCKET TEMPS RÉEL
      await WebSocketManager.notifyNewMessage(
        conversationId,
        message,
        req.user.id
      );

      // CORRECTION: Logique de notification améliorée
      if (isOwner) {
        // Un utilisateur normal envoie un message
        if (conversation.admin_id) {
          // Il y a un admin assigné, le notifier spécifiquement
          await createUserNotification(
            conversation.admin_id,
            "new_message",
            "Nouveau message dans un ticket assigné",
            `Nouveau message de ${req.user.username} dans le ticket "${
              conversation.subject || "Sans titre"
            }"`,
            { conversation_id: conversationId, message_id: message.id }
          );
          console.log(
            `📧 Notification envoyée à l'admin assigné: ${conversation.admin_id}`
          );
        } else {
          // Pas d'admin assigné, notifier TOUS les admins
          console.log(`📧 Ticket non assigné - notification à tous les admins`);

          await createAdminNotification(
            `Nouveau message - ticket non assigné`,
            `${
              req.user.username
            } a envoyé un message dans un ticket non assigné: "${
              conversation.subject || "Sans titre"
            }"`,
            {
              conversation_id: conversationId,
              message_id: message.id,
              requires_assignment: true,
              user: req.user.username,
              priority: conversation.priority || "normal",
            }
          );

          // AUSSI notifier via WebSocket tous les admins
          await WebSocketManager.notifyAdmins({
            title: "Nouveau message - ticket non assigné",
            message: `${req.user.username} a envoyé un message dans un ticket non assigné`,
            data: {
              conversation_id: conversationId,
              type: "unassigned_message",
              priority: conversation.priority || "normal",
              subject: conversation.subject,
            },
          });
        }
      } else if (isGeneralAdmin || isAssignedAdmin) {
        // Un admin répond à un utilisateur
        await createUserNotification(
          conversation.user_id,
          "new_message",
          "Réponse à votre ticket",
          `${req.user.username} a répondu à votre ticket: "${
            conversation.subject || "Sans titre"
          }"`,
          { conversation_id: conversationId, message_id: message.id }
        );
        console.log(
          `📧 Notification envoyée à l'utilisateur: ${conversation.user_id}`
        );
      }

      // ⭐ AJOUT MANQUANT: Réponse JSON
      res.json({
        success: true,
        message,
      });
    } catch (error) {
      console.error("❌ Erreur envoi message:", error);
      res.status(500).json({ success: false, error: "Erreur serveur" });
    }
  }
);

router.post(
  "/conversations/:conversationId/auto-assign",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { conversationId } = req.params;

      console.log(
        `🤖 Auto-assignation du ticket ${conversationId} à ${req.user.username}`
      );

      // Vérifier que le ticket n'est pas déjà assigné
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("admin_id, subject")
        .eq("id", conversationId)
        .single();

      if (convError || !conversation) {
        return res.status(404).json({
          success: false,
          error: "Conversation non trouvée",
        });
      }

      if (conversation.admin_id) {
        return res.status(400).json({
          success: false,
          error: "Ticket déjà assigné",
        });
      }

      // Assigner à l'admin qui fait la demande
      const { data: updatedConversation, error } = await supabase
        .from("conversations")
        .update({
          admin_id: req.user.id,
          status: "in_progress",
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId)
        .select(
          `
        *,
        user:user_id(username),
        admin:admin_id(username)
      `
        )
        .single();

      if (error) {
        console.error("❌ Erreur auto-assignation:", error);
        return res.status(500).json({
          success: false,
          error: "Impossible d'assigner le ticket",
        });
      }

      // Notification WebSocket
      await WebSocketManager.notifyConversationUpdate(
        conversationId,
        "assigned",
        {
          admin_id: req.user.id,
          status: "in_progress",
          admin: { username: req.user.username },
        }
      );

      await logAdminAction(
        req.user.id,
        "auto_assign_conversation",
        "conversation",
        conversationId,
        { action: "self_assignment" }
      );

      res.json({
        success: true,
        conversation: updatedConversation,
        message: "Ticket assigné à vous avec succès",
      });
    } catch (error) {
      console.error("❌ Erreur auto-assignation:", error);
      res.status(500).json({ success: false, error: "Erreur serveur" });
    }
  }
);

// ==================== ROUTES ADMIN ====================

// Obtenir toutes les conversations (admin)
router.get(
  "/admin/conversations",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { status, priority, page = 1, limit = 20 } = req.query;

      console.log(
        `🛠️ Admin: récupération conversations (statut: ${status || "tous"})`
      );

      let query = supabase
        .from("conversations")
        .select(
          `
        id,
        subject,
        category,
        priority,
        status,
        created_at,
        updated_at,
        last_message_at,
        user:user_id(username, avatar_url),
        admin:admin_id(username, avatar_url),
        unread_count:messages(count)
      `
        )
        .order("last_message_at", { ascending: false });

      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      if (priority && priority !== "all") {
        query = query.eq("priority", priority);
      }

      query = query.range((page - 1) * limit, page * limit - 1);

      const { data: conversations, error } = await query;

      if (error) {
        console.error("❌ Erreur admin récupération conversations:", error);
        return res.status(500).json({
          success: false,
          error: "Erreur lors de la récupération des conversations",
        });
      }

      // Statistiques
      const { data: stats } = await supabase
        .from("conversations")
        .select("status, priority, id")
        .then(({ data }) => {
          const statusCount =
            data?.reduce((acc, conv) => {
              acc[conv.status] = (acc[conv.status] || 0) + 1;
              return acc;
            }, {}) || {};

          const priorityCount =
            data?.reduce((acc, conv) => {
              acc[conv.priority] = (acc[conv.priority] || 0) + 1;
              return acc;
            }, {}) || {};

          return {
            data: {
              total: data?.length || 0,
              by_status: statusCount,
              by_priority: priorityCount,
            },
          };
        });

      await logAdminAction(
        req.user.id,
        "view_conversations",
        "conversations",
        null,
        { filters: { status, priority } }
      );

      res.json({
        success: true,
        conversations: conversations || [],
        stats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      console.error("❌ Erreur admin conversations:", error);
      res.status(500).json({ success: false, error: "Erreur serveur" });
    }
  }
);

// Assigner une conversation à un admin
router.put(
  "/admin/conversations/:conversationId/assign",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { admin_id } = req.body;

      console.log(
        `👥 Attribution conversation ${conversationId} à ${
          admin_id || "aucun admin"
        }`
      );

      if (admin_id) {
        const { data: admin } = await supabase
          .from("users")
          .select("id, username, role")
          .eq("id", admin_id)
          .eq("role", "admin")
          .single();

        if (!admin) {
          return res.status(400).json({
            success: false,
            error: "Admin non trouvé",
          });
        }
      }

      const { data: conversation, error } = await supabase
        .from("conversations")
        .update({
          admin_id,
          status: admin_id ? "in_progress" : "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId)
        .select(
          `
        *,
        user:user_id(username),
        admin:admin_id(username)
      `
        )
        .single();

      if (error) {
        console.error("❌ Erreur attribution conversation:", error);
        return res.status(500).json({
          success: false,
          error: "Impossible d'attribuer la conversation",
        });
      }

      // 🔥 NOTIFICATION WEBSOCKET
      await WebSocketManager.notifyConversationUpdate(
        conversationId,
        "assigned",
        {
          admin_id,
          status: admin_id ? "in_progress" : "open",
          admin: conversation.admin,
        }
      );

      await logAdminAction(
        req.user.id,
        "assign_conversation",
        "conversation",
        conversationId,
        { assigned_to: admin_id }
      );

      res.json({
        success: true,
        conversation,
        message: admin_id
          ? "Conversation attribuée avec succès"
          : "Attribution supprimée",
      });
    } catch (error) {
      console.error("❌ Erreur attribution:", error);
      res.status(500).json({ success: false, error: "Erreur serveur" });
    }
  }
);

// Changer le statut d'une conversation (admin)
router.put(
  "/admin/conversations/:conversationId/status",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { status } = req.body;

      const validStatuses = ["open", "in_progress", "resolved", "closed"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Statut invalide",
        });
      }

      console.log(
        `🔄 Changement statut conversation ${conversationId} vers ${status}`
      );

      const updateData = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === "closed" || status === "resolved") {
        updateData.closed_at = new Date().toISOString();
      }

      const { data: conversation, error } = await supabase
        .from("conversations")
        .update(updateData)
        .eq("id", conversationId)
        .select()
        .single();

      if (error) {
        console.error("❌ Erreur changement statut:", error);
        return res.status(500).json({
          success: false,
          error: "Impossible de changer le statut",
        });
      }

      // 🔥 NOTIFICATION WEBSOCKET
      await WebSocketManager.notifyConversationUpdate(
        conversationId,
        "status_changed",
        { status, updated_at: updateData.updated_at }
      );

      await logAdminAction(
        req.user.id,
        "change_conversation_status",
        "conversation",
        conversationId,
        { new_status: status }
      );

      res.json({
        success: true,
        conversation,
        message: `Statut changé vers "${status}"`,
      });
    } catch (error) {
      console.error("❌ Erreur changement statut:", error);
      res.status(500).json({ success: false, error: "Erreur serveur" });
    }
  }
);

// Fonctions utilitaires pour les notifications
async function createUserNotification(userId, type, title, message, data = {}) {
  try {
    await supabase.from("notifications").insert({
      user_id: userId,
      type,
      title,
      message,
      data,
    });
  } catch (error) {
    console.error("❌ Erreur création notification utilisateur:", error);
  }
}

async function createAdminNotification(title, message, data = {}) {
  try {
    // Récupérer tous les admins
    const { data: admins } = await supabase
      .from("users")
      .select("id")
      .eq("role", "admin");

    if (admins && admins.length > 0) {
      const notifications = admins.map((admin) => ({
        user_id: admin.id,
        type: "admin_notification",
        title,
        message,
        data,
      }));

      await supabase.from("notifications").insert(notifications);
    }
  } catch (error) {
    console.error("❌ Erreur création notification admin:", error);
  }
}

module.exports = router;
