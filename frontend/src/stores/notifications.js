// frontend/src/stores/notifications.js
import { defineStore } from "pinia";

export const useNotificationsStore = defineStore("notifications", {
  state: () => ({
    notifications: [],
    maxNotifications: 5,
  }),

  getters: {
    activeNotifications: (state) => state.notifications.filter((n) => n.show),
    notificationCount: (state) => state.notifications.length,
  },

  actions: {
    // Ajouter une notification
    add(notification) {
      const id = Date.now() + Math.random();

      const newNotification = {
        id,
        show: true,
        type: "info",
        title: "",
        message: "",
        autoClose: true,
        duration: 5000,
        actions: [],
        ...notification,
      };

      // Ajouter au début de la liste
      this.notifications.unshift(newNotification);

      // Limiter le nombre de notifications
      if (this.notifications.length > this.maxNotifications) {
        this.notifications = this.notifications.slice(0, this.maxNotifications);
      }

      return id;
    },

    // Méthodes de commodité pour différents types
    success(message, options = {}) {
      return this.add({
        type: "success",
        message,
        title: options.title || "✅ Succès",
        duration: options.duration || 4000,
        ...options,
      });
    },

    error(message, options = {}) {
      return this.add({
        type: "error",
        message,
        title: options.title || "❌ Erreur",
        autoClose: options.autoClose !== undefined ? options.autoClose : false,
        duration: options.duration || 8000,
        ...options,
      });
    },

    warning(message, options = {}) {
      return this.add({
        type: "warning",
        message,
        title: options.title || "⚠️ Attention",
        duration: options.duration || 6000,
        ...options,
      });
    },

    info(message, options = {}) {
      return this.add({
        type: "info",
        message,
        title: options.title || "ℹ️ Information",
        duration: options.duration || 5000,
        ...options,
      });
    },

    // Notifications spécialisées pour l'application
    projectCreated(projectName, deployUrl) {
      return this.success(
        `Le projet "${projectName}" a été créé avec succès !`,
        {
          title: "🚀 Projet créé",
          actions: deployUrl
            ? [
                {
                  text: "Voir le site",
                  primary: true,
                  action: () => window.open(deployUrl, "_blank"),
                },
              ]
            : [],
        }
      );
    },

    deploymentStarted(projectName) {
      return this.info(
        `Le déploiement du projet "${projectName}" a commencé...`,
        {
          title: "⚙️ Déploiement en cours",
          autoClose: false,
        }
      );
    },

    deploymentSuccess(projectName, deployUrl) {
      return this.success(
        `Le projet "${projectName}" a été déployé avec succès !`,
        {
          title: "🎉 Déploiement réussi",
          actions: [
            {
              text: "Voir le site",
              primary: true,
              action: () => window.open(deployUrl, "_blank"),
            },
          ],
        }
      );
    },

    deploymentFailed(projectName, error) {
      return this.error(
        `Le déploiement du projet "${projectName}" a échoué: ${error}`,
        {
          title: "💥 Déploiement échoué",
          actions: [
            {
              text: "Voir les logs",
              primary: false,
              action: () => {
                // Navigation vers les logs
                console.log("Navigation vers les logs");
              },
            },
          ],
        }
      );
    },

    githubConnectionError() {
      return this.error(
        "Votre connexion GitHub a expiré. Reconnectez-vous pour continuer.",
        {
          title: "🔑 Connexion GitHub expirée",
          actions: [
            {
              text: "Se reconnecter",
              primary: true,
              action: () => {
                window.location.href = "/api/auth/github";
              },
            },
          ],
        }
      );
    },

    // Fermer une notification
    remove(id) {
      const index = this.notifications.findIndex((n) => n.id === id);
      if (index > -1) {
        this.notifications[index].show = false;
        // Supprimer après la transition
        setTimeout(() => {
          this.notifications.splice(index, 1);
        }, 300);
      }
    },

    // Fermer toutes les notifications
    clear() {
      this.notifications.forEach((notification) => {
        notification.show = false;
      });

      // Vider après les transitions
      setTimeout(() => {
        this.notifications = [];
      }, 300);
    },

    // Marquer une notification comme lue
    markAsRead(id) {
      const notification = this.notifications.find((n) => n.id === id);
      if (notification) {
        notification.read = true;
      }
    },

    // Gestion des actions
    handleAction(notificationId, action) {
      if (action.action && typeof action.action === "function") {
        action.action();
      }

      // Fermer la notification si demandé
      if (action.close !== false) {
        this.remove(notificationId);
      }
    },
  },
});
