// frontend/src/services/websocket.js
class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000;
    this.listeners = new Map();
    this.isConnected = false;
    this.currentUser = null;
    this.currentConversationId = null;
    this.connectionStatus = "disconnected"; // 'connecting', 'connected', 'disconnected', 'error'
  }

  connect(user) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log("⚠️ WebSocket déjà connecté");
      return;
    }

    this.currentUser = user;
    this.connectionStatus = "connecting";

    // Construire l'URL WebSocket
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = import.meta.env.VITE_WS_URL || "localhost:3001";
    const wsUrl = `${protocol}//${host}/ws`;

    console.log("🔌 Tentative de connexion WebSocket à:", wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("🔌 Connexion WebSocket établie avec succès");
        this.isConnected = true;
        this.connectionStatus = "connected";
        this.reconnectAttempts = 0;

        // S'authentifier automatiquement
        this.authenticate(user);

        // Émettre l'événement de connexion
        this.emit("connected", { user });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📨 Message WebSocket reçu:", data.type);
          this.handleMessage(data);
        } catch (error) {
          console.error("❌ Erreur parsing message WebSocket:", error);
        }
      };

      this.ws.onclose = (event) => {
        console.log(
          `🔌 Connexion WebSocket fermée (code: ${event.code}, raison: ${event.reason})`
        );
        this.isConnected = false;
        this.connectionStatus = "disconnected";

        // Émettre l'événement de déconnexion
        this.emit("disconnected", { code: event.code, reason: event.reason });

        // Tentative de reconnexion si ce n'était pas volontaire
        if (event.code !== 1000 && this.currentUser) {
          // 1000 = fermeture normale
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error("❌ Erreur WebSocket:", error);
        this.isConnected = false;
        this.connectionStatus = "error";

        // Émettre l'événement d'erreur
        this.emit("error", { error });
      };
    } catch (error) {
      console.error("❌ Erreur création WebSocket:", error);
      this.connectionStatus = "error";
      this.emit("error", { error });
    }
  }

  authenticate(user) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log("🔐 Authentification WebSocket pour:", user.username);
      this.send({
        type: "auth",
        userId: user.id,
        accessToken: "dummy_token", // Remplacer par un vrai token si nécessaire
      });
    } else {
      console.warn(
        "⚠️ Tentative d'authentification sur WebSocket non connecté"
      );
    }
  }

  disconnect() {
    console.log("🔌 Fermeture volontaire de la connexion WebSocket");

    if (this.ws) {
      // Code 1000 = fermeture normale
      this.ws.close(1000, "Déconnexion volontaire");
      this.ws = null;
    }

    this.isConnected = false;
    this.connectionStatus = "disconnected";
    this.currentUser = null;
    this.currentConversationId = null;
    this.reconnectAttempts = 0;

    // Nettoyer les listeners
    this.listeners.clear();
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
        console.log("📤 Message WebSocket envoyé:", data.type);
      } catch (error) {
        console.error("❌ Erreur envoi message WebSocket:", error);
      }
    } else {
      console.warn("⚠️ WebSocket non connecté, message non envoyé:", data.type);

      // Tenter de se reconnecter si un utilisateur est défini
      if (this.currentUser && this.connectionStatus !== "connecting") {
        console.log("🔄 Tentative de reconnexion pour envoyer le message...");
        this.connect(this.currentUser);
      }
    }
  }

  handleMessage(data) {
    // Gérer les messages spéciaux
    switch (data.type) {
      case "connection":
        console.log("✅ Connexion WebSocket confirmée par le serveur");
        break;

      case "auth_success":
        console.log("✅ Authentification WebSocket réussie");
        this.emit("authenticated", data.user);
        break;

      case "auth_error":
        console.error("❌ Erreur authentification WebSocket:", data.message);
        this.emit("auth_error", data);
        break;

      case "pong":
        // Réponse au ping, ne rien faire de spécial
        break;

      case "error":
        console.error("❌ Erreur du serveur WebSocket:", data.message);
        this.emit("server_error", data);
        break;
    }

    // Émettre l'événement vers les listeners spécifiques
    const listeners = this.listeners.get(data.type);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error("❌ Erreur dans listener WebSocket:", error);
        }
      });
    }

    // Émettre l'événement global
    this.emit("message", data);
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("❌ Nombre maximum de tentatives de reconnexion atteint");
      this.connectionStatus = "error";
      this.emit("reconnect_failed", { attempts: this.reconnectAttempts });
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `🔄 Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
    );

    this.emit("reconnecting", {
      attempt: this.reconnectAttempts,
      max: this.maxReconnectAttempts,
    });

    setTimeout(() => {
      if (this.currentUser && !this.isConnected) {
        this.connect(this.currentUser);
      }
    }, this.reconnectInterval * this.reconnectAttempts); // Délai progressif
  }

  // Méthodes pour gérer les conversations
  joinConversation(conversationId) {
    console.log(`👥 Rejoindre la conversation ${conversationId}`);
    this.currentConversationId = conversationId;
    this.send({
      type: "join_conversation",
      conversationId,
    });
  }

  leaveConversation() {
    if (this.currentConversationId) {
      console.log(`👋 Quitter la conversation ${this.currentConversationId}`);
      this.send({
        type: "leave_conversation",
        conversationId: this.currentConversationId,
      });
      this.currentConversationId = null;
    }
  }

  // Système d'événements amélioré
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);

    // Retourner une fonction pour se désabonner
    return () => this.off(eventType, callback);
  }

  off(eventType, callback) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(eventType, data) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Erreur dans listener ${eventType}:`, error);
        }
      });
    }
  }

  // Ping manuel pour tester la connexion
  ping() {
    if (this.isConnected) {
      this.send({ type: "ping", timestamp: new Date().toISOString() });
    }
  }

  // Obtenir le statut de la connexion
  getStatus() {
    return {
      isConnected: this.isConnected,
      connectionStatus: this.connectionStatus,
      reconnectAttempts: this.reconnectAttempts,
      currentUser: this.currentUser?.username || null,
      currentConversation: this.currentConversationId,
      readyState: this.ws?.readyState || null,
    };
  }

  // Méthodes utilitaires
  isReadyStateOpen() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  isReadyStateConnecting() {
    return this.ws && this.ws.readyState === WebSocket.CONNECTING;
  }

  isReadyStateClosed() {
    return !this.ws || this.ws.readyState === WebSocket.CLOSED;
  }
}

export default new WebSocketService();
