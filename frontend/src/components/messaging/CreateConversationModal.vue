<!-- frontend/src/components/messaging/CreateConversationModal.vue -->
<script setup>
import { ref, computed, onMounted, nextTick } from "vue";
import { useMessagesStore } from "@/stores/messages";
import { useNotificationsStore } from "@/stores/notifications";
import {
  XMarkIcon,
  ChatBubbleBottomCenterTextIcon,
  ExclamationTriangleIcon,
  FireIcon,
  InformationCircleIcon,
  SparklesIcon,
} from "@heroicons/vue/24/outline";

const emit = defineEmits(["close", "created"]);

const messagesStore = useMessagesStore();
const notifications = useNotificationsStore();

const subjectInput = ref(null);
const form = ref({
  subject: "",
  content: "",
  priority: "normal",
  category: "general",
});

const creating = ref(false);
const currentStep = ref(1);

const priorities = [
  {
    value: "low",
    label: "Basse",
    description: "Question générale, pas urgent",
    color: "text-gray-500",
    bgColor: "bg-gray-50 hover:bg-gray-100 border-gray-200",
    icon: InformationCircleIcon,
  },
  {
    value: "normal",
    label: "Normale",
    description: "Besoin d'aide standard",
    color: "text-blue-500",
    bgColor: "bg-blue-50 hover:bg-blue-100 border-blue-200",
    icon: ChatBubbleBottomCenterTextIcon,
  },
  {
    value: "high",
    label: "Haute",
    description: "Problème impactant votre travail",
    color: "text-amber-500",
    bgColor: "bg-amber-50 hover:bg-amber-100 border-amber-200",
    icon: ExclamationTriangleIcon,
  },
  {
    value: "urgent",
    label: "Urgente",
    description: "Problème critique, besoin d'aide immédiate",
    color: "text-red-500",
    bgColor: "bg-red-50 hover:bg-red-100 border-red-200",
    icon: FireIcon,
  },
];

const categories = [
  { value: "general", label: "Question générale", icon: "❓" },
  { value: "technical", label: "Problème technique", icon: "🔧" },
  { value: "account", label: "Compte utilisateur", icon: "👤" },
  { value: "billing", label: "Facturation", icon: "💳" },
  { value: "feature", label: "Demande de fonctionnalité", icon: "✨" },
  { value: "bug", label: "Signaler un bug", icon: "🐛" },
];

const selectedPriority = computed(() =>
  priorities.find((p) => p.value === form.value.priority)
);

const selectedCategory = computed(() =>
  categories.find((c) => c.value === form.value.category)
);

const canProceedToStep2 = computed(() => form.value.subject.trim().length >= 3);

const canSubmit = computed(
  () =>
    form.value.subject.trim() &&
    form.value.content.trim() &&
    form.value.content.trim().length >= 10
);

const createTicket = async () => {
  if (!canSubmit.value) {
    notifications.error("Veuillez remplir tous les champs requis");
    return;
  }

  try {
    creating.value = true;

    console.log("🎫 Création du ticket:", form.value);

    // CORRECTION: Envoyer initialMessage comme attendu par le backend
    const conversation = await messagesStore.createConversation({
      subject: form.value.subject.trim(),
      priority: form.value.priority,
      initialMessage: form.value.content.trim(),
      category: form.value.category,
    });

    console.log("✅ Ticket créé:", conversation);

    // Émettre l'événement created avec la conversation
    emit("created", conversation);

    // Réinitialiser le formulaire
    form.value = {
      subject: "",
      content: "",
      priority: "normal",
      category: "general",
    };
    currentStep.value = 1;

    notifications.success("Ticket créé avec succès");
  } catch (error) {
    console.error("❌ Erreur création ticket:", error);
    notifications.error(
      error.message || "Erreur lors de la création du ticket"
    );
  } finally {
    creating.value = false;
  }
};

const closeModal = () => {
  console.log("🔄 Fermeture du modal");
  emit("close");
};

const nextStep = () => {
  if (canProceedToStep2.value) {
    currentStep.value = 2;
  }
};

const prevStep = () => {
  currentStep.value = 1;
};

const selectPriority = (priority) => {
  form.value.priority = priority;
};

const selectCategory = (category) => {
  form.value.category = category;
};

// Focus sur le premier champ au montage
onMounted(() => {
  nextTick(() => {
    if (subjectInput.value) {
      subjectInput.value.focus();
    }
  });
});
</script>

<template>
  <!-- Backdrop avec animation -->
  <Transition
    enter-active-class="transition-opacity duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      @click.self="closeModal"
    >
      <!-- Modal avec animation -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 scale-95 translate-y-4"
        enter-to-class="opacity-100 scale-100 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 scale-100 translate-y-0"
        leave-to-class="opacity-0 scale-95 translate-y-4"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        >
          <!-- Header avec gradient -->
          <div
            class="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="p-2 bg-white bg-opacity-20 rounded-lg">
                  <ChatBubbleBottomCenterTextIcon class="w-6 h-6" />
                </div>
                <div>
                  <h2 class="text-xl font-bold">
                    Créer un nouveau ticket de support
                  </h2>
                  <p class="text-primary-100 text-sm">
                    Étape {{ currentStep }} sur 2 - Décrivez votre problème
                  </p>
                </div>
              </div>
              <button
                @click="closeModal"
                class="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                :disabled="creating"
              >
                <XMarkIcon class="w-5 h-5" />
              </button>
            </div>

            <!-- Progress bar -->
            <div
              class="mt-4 w-full bg-primary-400 bg-opacity-30 rounded-full h-2"
            >
              <div
                class="bg-white h-2 rounded-full transition-all duration-300 ease-out"
                :style="{ width: `${(currentStep / 2) * 100}%` }"
              ></div>
            </div>
          </div>

          <!-- Contenu -->
          <div class="p-6 overflow-y-auto max-h-[60vh]">
            <!-- Étape 1: Informations de base -->
            <div v-if="currentStep === 1" class="space-y-6">
              <div class="text-center mb-6">
                <div
                  class="mx-auto w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 rounded-full flex items-center justify-center mb-4"
                >
                  <SparklesIcon
                    class="w-8 h-8 text-blue-600 dark:text-blue-300"
                  />
                </div>
                <h3
                  class="text-lg font-semibold text-gray-900 dark:text-white mb-2"
                >
                  Quel est votre problème ?
                </h3>
                <p class="text-gray-500 dark:text-gray-400">
                  Commençons par un titre clair et concis
                </p>
              </div>

              <!-- Sujet -->
              <div>
                <label
                  for="subject"
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Sujet du ticket *
                </label>
                <input
                  id="subject"
                  ref="subjectInput"
                  v-model="form.subject"
                  type="text"
                  required
                  placeholder="Ex: Problème de connexion, Erreur lors de l'enregistrement..."
                  class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                  :class="{
                    'border-green-300 bg-green-50':
                      form.subject.trim().length >= 3,
                    'border-red-300 bg-red-50':
                      form.subject.trim().length > 0 &&
                      form.subject.trim().length < 3,
                  }"
                  maxlength="200"
                />
                <div class="mt-2 flex justify-between items-center">
                  <div
                    v-if="form.subject.trim().length > 0"
                    :class="[
                      'text-xs',
                      form.subject.trim().length >= 3
                        ? 'text-green-600'
                        : 'text-red-600',
                    ]"
                  >
                    {{
                      form.subject.trim().length >= 3
                        ? "✓ Titre valide"
                        : "Minimum 3 caractères requis"
                    }}
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ form.subject.length }}/200
                  </div>
                </div>
              </div>

              <!-- Catégorie -->
              <div>
                <label
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3"
                >
                  Catégorie
                </label>
                <div class="grid grid-cols-2 gap-3">
                  <button
                    v-for="category in categories"
                    :key="category.value"
                    @click="selectCategory(category.value)"
                    type="button"
                    :class="[
                      'flex items-center space-x-3 p-3 border-2 rounded-xl transition-all duration-200 text-left',
                      form.category === category.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500',
                    ]"
                  >
                    <span class="text-xl">{{ category.icon }}</span>
                    <span class="font-medium text-sm">{{
                      category.label
                    }}</span>
                  </button>
                </div>
              </div>

              <!-- Priorité -->
              <div>
                <label
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3"
                >
                  Niveau de priorité
                </label>
                <div class="space-y-2">
                  <button
                    v-for="priority in priorities"
                    :key="priority.value"
                    @click="selectPriority(priority.value)"
                    type="button"
                    :class="[
                      'w-full flex items-center space-x-4 p-4 border-2 rounded-xl transition-all duration-200 text-left',
                      form.priority === priority.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500 hover:shadow-sm',
                    ]"
                  >
                    <div :class="['p-2 rounded-lg', priority.bgColor]">
                      <component
                        :is="priority.icon"
                        :class="['w-5 h-5', priority.color]"
                      />
                    </div>
                    <div class="flex-1">
                      <div :class="['font-semibold', priority.color]">
                        {{ priority.label }}
                      </div>
                      <div class="text-sm text-gray-500 dark:text-gray-400">
                        {{ priority.description }}
                      </div>
                    </div>
                    <div
                      v-if="form.priority === priority.value"
                      class="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center"
                    >
                      <div class="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <!-- Étape 2: Description détaillée -->
            <div v-if="currentStep === 2" class="space-y-6">
              <div class="text-center mb-6">
                <div
                  class="mx-auto w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-800 dark:to-green-700 rounded-full flex items-center justify-center mb-4"
                >
                  <ChatBubbleBottomCenterTextIcon
                    class="w-8 h-8 text-green-600 dark:text-green-300"
                  />
                </div>
                <h3
                  class="text-lg font-semibold text-gray-900 dark:text-white mb-2"
                >
                  Décrivez votre problème
                </h3>
                <p class="text-gray-500 dark:text-gray-400">
                  Plus de détails nous aideront à mieux vous assister
                </p>
              </div>

              <!-- Résumé de l'étape 1 -->
              <div
                class="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl border border-gray-200 dark:border-gray-600"
              >
                <h4 class="font-medium text-gray-900 dark:text-white mb-2">
                  Résumé de votre demande:
                </h4>
                <div
                  class="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400"
                >
                  <div class="flex items-center space-x-2">
                    <span class="font-medium">{{ form.subject }}</span>
                  </div>
                  <div class="flex items-center space-x-2">
                    <span>{{ selectedCategory.icon }}</span>
                    <span>{{ selectedCategory.label }}</span>
                  </div>
                  <div
                    :class="[
                      'flex items-center space-x-2',
                      selectedPriority.color,
                    ]"
                  >
                    <component :is="selectedPriority.icon" class="w-4 h-4" />
                    <span>{{ selectedPriority.label }}</span>
                  </div>
                </div>
              </div>

              <!-- Message -->
              <div>
                <label
                  for="content"
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Description détaillée *
                </label>
                <textarea
                  id="content"
                  v-model="form.content"
                  required
                  rows="6"
                  placeholder="Décrivez votre problème en détail. Incluez les étapes que vous avez déjà essayées et toute information qui pourrait nous aider..."
                  class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none transition-all duration-200"
                  :class="{
                    'border-green-300 bg-green-50':
                      form.content.trim().length >= 10,
                    'border-red-300 bg-red-50':
                      form.content.trim().length > 0 &&
                      form.content.trim().length < 10,
                  }"
                  maxlength="2000"
                ></textarea>
                <div class="mt-2 flex justify-between items-center">
                  <div
                    v-if="form.content.trim().length > 0"
                    :class="[
                      'text-xs',
                      form.content.trim().length >= 10
                        ? 'text-green-600'
                        : 'text-red-600',
                    ]"
                  >
                    {{
                      form.content.trim().length >= 10
                        ? "✓ Description suffisante"
                        : "Minimum 10 caractères requis"
                    }}
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ form.content.length }}/2000
                  </div>
                </div>
              </div>

              <!-- Conseils -->
              <div
                class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800"
              >
                <h4
                  class="flex items-center font-medium text-blue-800 dark:text-blue-200 mb-2"
                >
                  <InformationCircleIcon class="w-5 h-5 mr-2" />
                  Conseils pour une meilleure assistance
                </h4>
                <ul class="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• Décrivez les étapes exactes qui causent le problème</li>
                  <li>• Mentionnez les messages d'erreur que vous voyez</li>
                  <li>• Indiquez votre navigateur et système d'exploitation</li>
                  <li>• Expliquez ce que vous attendiez qu'il se passe</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div
            class="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700"
          >
            <div class="flex items-center space-x-2">
              <div
                v-if="currentStep === 1"
                class="text-sm text-gray-500 dark:text-gray-400"
              >
                Étape 1 sur 2
              </div>
              <button
                v-else
                @click="prevStep"
                type="button"
                class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                :disabled="creating"
              >
                ← Retour
              </button>
            </div>

            <div class="flex space-x-3">
              <button
                @click="closeModal"
                type="button"
                class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                :disabled="creating"
              >
                Annuler
              </button>

              <!-- Étape 1: Bouton Continuer -->
              <button
                v-if="currentStep === 1"
                @click="nextStep"
                type="button"
                :disabled="!canProceedToStep2"
                :class="[
                  'px-6 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2',
                  canProceedToStep2
                    ? 'bg-primary-600 text-white hover:bg-primary-700 transform hover:scale-105 shadow-lg hover:shadow-xl'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed',
                ]"
              >
                <span>Continuer</span>
                <span>→</span>
              </button>

              <!-- Étape 2: Bouton Créer -->
              <button
                v-else
                @click="createTicket"
                type="submit"
                :disabled="creating || !canSubmit"
                :class="[
                  'px-6 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2',
                  canSubmit && !creating
                    ? 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 transform hover:scale-105 shadow-lg hover:shadow-xl'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed',
                ]"
              >
                <span v-if="creating" class="flex items-center">
                  <div
                    class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
                  ></div>
                  Création...
                </span>
                <span v-else class="flex items-center">
                  <ChatBubbleBottomCenterTextIcon class="w-4 h-4 mr-2" />
                  Créer le ticket
                </span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
/* Smooth transitions for all interactive elements */
* {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Custom focus styles */
input:focus,
textarea:focus,
button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Gradient text for priority labels */
.priority-urgent {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Custom scrollbar */
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
</style>
