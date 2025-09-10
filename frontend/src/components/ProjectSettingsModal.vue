<!-- frontend/src/components/ProjectSettingsModal.vue -->
<script setup>
import { ref, reactive, computed, watch, onMounted } from "vue";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from "@headlessui/vue";
import {
  XMarkIcon,
  CogIcon,
  RocketLaunchIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
} from "@heroicons/vue/24/outline";
import { useNotificationsStore } from "@/stores/notifications";
import axios from "axios";
import ProjectSettings from "./ProjectSettings.vue";

const emit = defineEmits(["close", "updated"]);
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  project: {
    type: Object,
    default: null,
  },
});

const notifications = useNotificationsStore();

// État local
const activeTab = ref("config");
const savingDeploymentSettings = ref(false);
const savingSecuritySettings = ref(false);
const creatingWebhook = ref(false);
const deletingWebhook = ref(false);
const testingWebhook = ref(false);
const addingDomain = ref(false);
const renewingSSL = ref(false);

const customDomain = ref("");
const webhookStatus = ref("inactive");
const serverIP = ref("192.168.1.100"); // À remplacer par l'IP réelle
const sslExpiry = ref("2025-12-31");

// Configuration des onglets
const tabs = computed(() => [
  {
    key: "config",
    name: "Configuration",
    icon: CogIcon,
  },
  {
    key: "deployments",
    name: "Déploiements",
    icon: RocketLaunchIcon,
    badge: buildStats.total || null,
  },
  {
    key: "domain",
    name: "Domaine & SSL",
    icon: GlobeAltIcon,
  },
  {
    key: "security",
    name: "Sécurité",
    icon: ShieldCheckIcon,
  },
]);

// Paramètres réactifs
const deploymentSettings = reactive({
  auto_deploy: true,
  pr_previews: false,
  notify_success: true,
  notify_failure: true,
});

const securitySettings = reactive({
  rate_limiting: true,
  hotlink_protection: false,
  geo_blocking: false,
});

const buildStats = reactive({
  total: 0,
  success: 0,
  failed: 0,
  avgTime: 0,
  successRate: 0,
});

const configuredDomains = ref([]);
const securityEvents = ref([]);

// API client
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  withCredentials: true,
});

// Méthodes
const close = () => {
  emit("close");
};

const onProjectUpdated = (updatedProject) => {
  emit("updated", updatedProject);
};

const onProjectDeleted = () => {
  close();
};

const saveDeploymentSettings = async () => {
  try {
    savingDeploymentSettings.value = true;

    // TODO: Implémenter la sauvegarde des paramètres de déploiement
    await new Promise((resolve) => setTimeout(resolve, 1000));

    notifications.success("Paramètres de déploiement sauvegardés");
  } catch (error) {
    notifications.error("Erreur lors de la sauvegarde");
  } finally {
    savingDeploymentSettings.value = false;
  }
};

const createWebhook = async () => {
  try {
    creatingWebhook.value = true;

    // TODO: Implémenter la création du webhook
    await new Promise((resolve) => setTimeout(resolve, 2000));

    webhookStatus.value = "active";
    notifications.success("Webhook créé avec succès");
  } catch (error) {
    notifications.error("Erreur lors de la création du webhook");
  } finally {
    creatingWebhook.value = false;
  }
};

const deleteWebhook = async () => {
  try {
    deletingWebhook.value = true;

    // TODO: Implémenter la suppression du webhook
    await new Promise((resolve) => setTimeout(resolve, 1000));

    webhookStatus.value = "inactive";
    notifications.success("Webhook supprimé");
  } catch (error) {
    notifications.error("Erreur lors de la suppression");
  } finally {
    deletingWebhook.value = false;
  }
};

const testWebhook = async () => {
  try {
    testingWebhook.value = true;

    // TODO: Implémenter le test du webhook
    await new Promise((resolve) => setTimeout(resolve, 1500));

    notifications.success("Test du webhook réussi");
  } catch (error) {
    notifications.error("Test du webhook échoué");
  } finally {
    testingWebhook.value = false;
  }
};

const addCustomDomain = async () => {
  if (!customDomain.value) return;

  try {
    addingDomain.value = true;

    // TODO: Implémenter l'ajout du domaine personnalisé
    await new Promise((resolve) => setTimeout(resolve, 2000));

    configuredDomains.value.push({
      name: customDomain.value,
      status: "pending",
      ssl: false,
    });

    customDomain.value = "";
    notifications.success("Domaine ajouté. Vérification DNS en cours...");
  } catch (error) {
    notifications.error("Erreur lors de l'ajout du domaine");
  } finally {
    addingDomain.value = false;
  }
};

const verifyDomain = async (domainName) => {
  try {
    // TODO: Implémenter la vérification du domaine
    const domain = configuredDomains.value.find((d) => d.name === domainName);
    if (domain) {
      domain.status = "active";
      domain.ssl = true;
    }

    notifications.success(`Domaine ${domainName} vérifié`);
  } catch (error) {
    notifications.error("Erreur lors de la vérification");
  }
};

const removeDomain = async (domainName) => {
  try {
    configuredDomains.value = configuredDomains.value.filter(
      (d) => d.name !== domainName
    );
    notifications.success("Domaine supprimé");
  } catch (error) {
    notifications.error("Erreur lors de la suppression");
  }
};

const renewSSL = async () => {
  try {
    renewingSSL.value = true;
    await new Promise((resolve) => setTimeout(resolve, 3000));
    notifications.success("Certificat SSL renouvelé");
  } catch (error) {
    notifications.error("Erreur lors du renouvellement");
  } finally {
    renewingSSL.value = false;
  }
};

const saveSecuritySettings = async () => {
  try {
    savingSecuritySettings.value = true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    notifications.success("Paramètres de sécurité sauvegardés");
  } catch (error) {
    notifications.error("Erreur lors de la sauvegarde");
  } finally {
    savingSecuritySettings.value = false;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const loadData = async () => {
  try {
    // Charger les stats des builds
    buildStats.total = 15;
    buildStats.success = 12;
    buildStats.failed = 3;
    buildStats.avgTime = 45;
    buildStats.successRate = Math.round(
      (buildStats.success / buildStats.total) * 100
    );

    // Charger les événements de sécurité (mock data)
    securityEvents.value = [
      {
        id: 1,
        type: "blocked",
        message: "Tentative de force brute bloquée",
        ip: "192.168.1.100",
        timestamp: new Date().toISOString(),
      },
      {
        id: 2,
        type: "suspicious",
        message: "Activité suspecte détectée",
        ip: "10.0.0.1",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
      },
    ];
  } catch (error) {
    console.error("Erreur chargement données:", error);
  }
};

// Watchers
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      loadData();
    }
  }
);

// Lifecycle
onMounted(() => {
  if (props.isOpen) {
    loadData();
  }
});
</script>

<template>
  <TransitionRoot :show="isOpen" as="template">
    <Dialog as="div" class="relative z-50" @close="close">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black bg-opacity-50" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="ease-out duration-300"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel
              class="w-full max-w-4xl transform overflow-hidden rounded-xl bg-white shadow-xl transition-all"
            >
              <!-- Header -->
              <div
                class="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50"
              >
                <div>
                  <DialogTitle
                    class="text-xl font-semibold text-gray-900 flex items-center"
                  >
                    <CogIcon class="w-6 h-6 text-blue-600 mr-2" />
                    Paramètres du projet
                  </DialogTitle>
                  <p class="mt-1 text-sm text-gray-600">
                    {{ project?.name }} - Configuration et gestion
                  </p>
                </div>
                <button
                  @click="close"
                  class="rounded-md bg-white text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 p-2"
                >
                  <XMarkIcon class="h-6 w-6" />
                </button>
              </div>

              <!-- Onglets -->
              <div class="border-b border-gray-200 bg-gray-50">
                <nav class="flex space-x-8 px-6">
                  <button
                    v-for="tab in tabs"
                    :key="tab.key"
                    @click="activeTab = tab.key"
                    :class="[
                      'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                      activeTab === tab.key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                    ]"
                  >
                    <component :is="tab.icon" class="w-4 h-4 inline mr-2" />
                    {{ tab.name }}
                    <span
                      v-if="tab.badge"
                      class="ml-2 bg-gray-100 text-gray-900 py-1 px-2 rounded-full text-xs"
                    >
                      {{ tab.badge }}
                    </span>
                  </button>
                </nav>
              </div>

              <!-- Contenu -->
              <div class="max-h-[70vh] overflow-y-auto">
                <!-- Tab: Configuration -->
                <div v-if="activeTab === 'config'" class="p-6">
                  <ProjectSettings
                    :project="project"
                    @updated="onProjectUpdated"
                    @deleted="onProjectDeleted"
                  />
                </div>

                <!-- Tab: Déploiements -->
                <div v-else-if="activeTab === 'deployments'" class="p-6">
                  <div class="space-y-6">
                    <!-- Configuration des déploiements -->
                    <div class="bg-gray-50 rounded-lg p-4">
                      <h3 class="text-lg font-medium text-gray-900 mb-4">
                        Configuration des déploiements
                      </h3>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Auto-deploy -->
                        <div class="space-y-4">
                          <div>
                            <label class="flex items-center">
                              <input
                                v-model="deploymentSettings.auto_deploy"
                                type="checkbox"
                                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span
                                class="ml-2 text-sm font-medium text-gray-700"
                              >
                                Déploiement automatique sur push
                              </span>
                            </label>
                            <p class="mt-1 text-xs text-gray-500">
                              Déclenche automatiquement un déploiement lors d'un
                              push sur la branche principale
                            </p>
                          </div>

                          <div>
                            <label class="flex items-center">
                              <input
                                v-model="deploymentSettings.pr_previews"
                                type="checkbox"
                                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span
                                class="ml-2 text-sm font-medium text-gray-700"
                              >
                                Aperçus des Pull Requests
                              </span>
                            </label>
                            <p class="mt-1 text-xs text-gray-500">
                              Crée automatiquement des aperçus pour les PR
                              (bientôt disponible)
                            </p>
                          </div>
                        </div>

                        <!-- Notifications -->
                        <div class="space-y-4">
                          <div>
                            <label class="flex items-center">
                              <input
                                v-model="deploymentSettings.notify_success"
                                type="checkbox"
                                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span
                                class="ml-2 text-sm font-medium text-gray-700"
                              >
                                Notifier les déploiements réussis
                              </span>
                            </label>
                          </div>

                          <div>
                            <label class="flex items-center">
                              <input
                                v-model="deploymentSettings.notify_failure"
                                type="checkbox"
                                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span
                                class="ml-2 text-sm font-medium text-gray-700"
                              >
                                Notifier les échecs de déploiement
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <!-- Actions -->
                      <div class="mt-6 flex justify-end">
                        <button
                          @click="saveDeploymentSettings"
                          :disabled="savingDeploymentSettings"
                          class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          {{
                            savingDeploymentSettings
                              ? "Sauvegarde..."
                              : "Sauvegarder"
                          }}
                        </button>
                      </div>
                    </div>

                    <!-- Webhooks -->
                    <div class="bg-white border border-gray-200 rounded-lg p-4">
                      <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">
                          Webhooks GitHub
                        </h3>
                        <span
                          :class="
                            webhookStatus === 'active'
                              ? 'text-green-600'
                              : 'text-yellow-600'
                          "
                          class="text-sm font-medium"
                        >
                          {{
                            webhookStatus === "active"
                              ? "✅ Actif"
                              : "⚠️ Inactif"
                          }}
                        </span>
                      </div>

                      <p class="text-sm text-gray-600 mb-4">
                        Les webhooks permettent le déploiement automatique lors
                        des push GitHub.
                      </p>

                      <div class="bg-gray-50 rounded-lg p-3 mb-4">
                        <div class="text-xs text-gray-600 mb-1">
                          URL du webhook :
                        </div>
                        <div
                          class="font-mono text-sm text-gray-900 bg-white p-2 rounded border"
                        >
                          https://api.madahost.me/api/webhooks/github/{{
                            project?.id
                          }}
                        </div>
                      </div>

                      <div class="flex space-x-3">
                        <button
                          @click="createWebhook"
                          :disabled="creatingWebhook"
                          class="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
                        >
                          {{
                            creatingWebhook ? "Création..." : "Créer le webhook"
                          }}
                        </button>

                        <button
                          v-if="webhookStatus === 'active'"
                          @click="deleteWebhook"
                          :disabled="deletingWebhook"
                          class="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
                        >
                          {{ deletingWebhook ? "Suppression..." : "Supprimer" }}
                        </button>

                        <button
                          @click="testWebhook"
                          :disabled="testingWebhook"
                          class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          {{ testingWebhook ? "Test..." : "Tester" }}
                        </button>
                      </div>
                    </div>

                    <!-- Historique des builds -->
                    <div class="bg-white border border-gray-200 rounded-lg p-4">
                      <h3 class="text-lg font-medium text-gray-900 mb-4">
                        Performance des builds
                      </h3>

                      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div class="text-center p-3 bg-green-50 rounded-lg">
                          <div class="text-2xl font-bold text-green-600">
                            {{ buildStats.success }}
                          </div>
                          <div class="text-sm text-green-600">Réussis</div>
                        </div>

                        <div class="text-center p-3 bg-red-50 rounded-lg">
                          <div class="text-2xl font-bold text-red-600">
                            {{ buildStats.failed }}
                          </div>
                          <div class="text-sm text-red-600">Échecs</div>
                        </div>

                        <div class="text-center p-3 bg-blue-50 rounded-lg">
                          <div class="text-2xl font-bold text-blue-600">
                            {{ buildStats.avgTime }}s
                          </div>
                          <div class="text-sm text-blue-600">Temps moyen</div>
                        </div>
                      </div>

                      <div class="text-sm text-gray-600">
                        Taux de réussite : {{ buildStats.successRate }}%
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Tab: Domaine & SSL -->
                <div v-else-if="activeTab === 'domain'" class="p-6">
                  <div class="space-y-6">
                    <!-- Domaine principal -->
                    <div class="bg-white border border-gray-200 rounded-lg p-6">
                      <h3 class="text-lg font-medium text-gray-900 mb-4">
                        Domaine principal
                      </h3>

                      <div class="space-y-4">
                        <div>
                          <label
                            class="block text-sm font-medium text-gray-700 mb-2"
                          >
                            Domaine par défaut (madahost.me)
                          </label>
                          <div class="bg-gray-50 p-3 rounded-lg border">
                            <div class="font-mono text-sm">
                              https://{{ project?.name }}.madahost.me
                            </div>
                            <div class="flex items-center mt-2">
                              <div
                                class="w-2 h-2 bg-green-400 rounded-full mr-2"
                              ></div>
                              <span class="text-xs text-green-600"
                                >SSL actif</span
                              >
                            </div>
                          </div>
                        </div>

                        <div>
                          <label
                            class="block text-sm font-medium text-gray-700 mb-2"
                          >
                            Domaine personnalisé
                          </label>
                          <div class="flex gap-3">
                            <input
                              v-model="customDomain"
                              type="text"
                              placeholder="monsite.com"
                              class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button
                              @click="addCustomDomain"
                              :disabled="addingDomain"
                              class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                              {{ addingDomain ? "Ajout..." : "Ajouter" }}
                            </button>
                          </div>

                          <div class="mt-2 p-3 bg-blue-50 rounded-lg">
                            <div class="text-xs font-medium text-blue-800 mb-1">
                              Instructions DNS :
                            </div>
                            <div class="text-xs text-blue-700">
                              <div>
                                • Créez un enregistrement CNAME :
                                <code>www.monsite.com → madahost.me</code>
                              </div>
                              <div>
                                • Ou un enregistrement A :
                                <code>monsite.com → {{ serverIP }}</code>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Domaines configurés -->
                    <div
                      v-if="configuredDomains.length > 0"
                      class="bg-white border border-gray-200 rounded-lg p-6"
                    >
                      <h3 class="text-lg font-medium text-gray-900 mb-4">
                        Domaines configurés
                      </h3>

                      <div class="space-y-3">
                        <div
                          v-for="domain in configuredDomains"
                          :key="domain.name"
                          class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div class="flex items-center space-x-3">
                            <div>
                              <div class="font-medium text-gray-900">
                                {{ domain.name }}
                              </div>
                              <div class="flex items-center text-xs">
                                <div
                                  :class="[
                                    'w-2 h-2 rounded-full mr-2',
                                    domain.status === 'active'
                                      ? 'bg-green-400'
                                      : domain.status === 'pending'
                                      ? 'bg-yellow-400'
                                      : 'bg-red-400',
                                  ]"
                                ></div>
                                <span
                                  :class="[
                                    domain.status === 'active'
                                      ? 'text-green-600'
                                      : domain.status === 'pending'
                                      ? 'text-yellow-600'
                                      : 'text-red-600',
                                  ]"
                                >
                                  {{
                                    domain.status === "active"
                                      ? "Actif"
                                      : domain.status === "pending"
                                      ? "En attente"
                                      : "Erreur"
                                  }}
                                </span>
                                <span class="ml-2 text-gray-500"
                                  >SSL: {{ domain.ssl ? "Oui" : "Non" }}</span
                                >
                              </div>
                            </div>
                          </div>

                          <div class="flex space-x-2">
                            <button
                              @click="verifyDomain(domain.name)"
                              class="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Vérifier
                            </button>
                            <button
                              @click="removeDomain(domain.name)"
                              class="text-red-600 hover:text-red-800 text-sm"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Certificats SSL -->
                    <div class="bg-white border border-gray-200 rounded-lg p-6">
                      <h3 class="text-lg font-medium text-gray-900 mb-4">
                        Certificats SSL
                      </h3>

                      <div class="space-y-4">
                        <div
                          class="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                        >
                          <div>
                            <div class="font-medium text-green-900">
                              *.madahost.me
                            </div>
                            <div class="text-sm text-green-600">
                              Expire le {{ formatDate(sslExpiry) }}
                            </div>
                          </div>
                          <div class="text-green-600">
                            <CheckCircleIcon class="w-5 h-5" />
                          </div>
                        </div>

                        <div class="flex justify-between items-center">
                          <div class="text-sm text-gray-600">
                            Renouvellement automatique activé
                          </div>
                          <button
                            @click="renewSSL"
                            :disabled="renewingSSL"
                            class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {{
                              renewingSSL ? "Renouvellement..." : "Renouveler"
                            }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Tab: Sécurité -->
                <div v-else-if="activeTab === 'security'" class="p-6">
                  <div class="space-y-6">
                    <!-- Protection DDoS -->
                    <div class="bg-white border border-gray-200 rounded-lg p-6">
                      <h3 class="text-lg font-medium text-gray-900 mb-4">
                        Protection et sécurité
                      </h3>

                      <div class="space-y-4">
                        <div>
                          <label class="flex items-center">
                            <input
                              v-model="securitySettings.rate_limiting"
                              type="checkbox"
                              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span
                              class="ml-2 text-sm font-medium text-gray-700"
                            >
                              Limitation du taux de requêtes
                            </span>
                          </label>
                          <p class="mt-1 text-xs text-gray-500">
                            Limite les requêtes à 100/minute par IP
                          </p>
                        </div>

                        <div>
                          <label class="flex items-center">
                            <input
                              v-model="securitySettings.hotlink_protection"
                              type="checkbox"
                              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span
                              class="ml-2 text-sm font-medium text-gray-700"
                            >
                              Protection contre le hotlinking
                            </span>
                          </label>
                          <p class="mt-1 text-xs text-gray-500">
                            Empêche l'utilisation de vos images sur d'autres
                            sites
                          </p>
                        </div>

                        <div>
                          <label class="flex items-center">
                            <input
                              v-model="securitySettings.geo_blocking"
                              type="checkbox"
                              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span
                              class="ml-2 text-sm font-medium text-gray-700"
                            >
                              Blocage géographique (Premium)
                            </span>
                          </label>
                          <p class="mt-1 text-xs text-gray-500">
                            Bloquer l'accès depuis certains pays
                          </p>
                        </div>
                      </div>

                      <div class="mt-6 flex justify-end">
                        <button
                          @click="saveSecuritySettings"
                          :disabled="savingSecuritySettings"
                          class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          {{
                            savingSecuritySettings
                              ? "Sauvegarde..."
                              : "Sauvegarder"
                          }}
                        </button>
                      </div>
                    </div>

                    <!-- Logs de sécurité -->
                    <div class="bg-white border border-gray-200 rounded-lg p-6">
                      <h3 class="text-lg font-medium text-gray-900 mb-4">
                        Événements récents
                      </h3>

                      <div class="space-y-3">
                        <div
                          v-for="event in securityEvents"
                          :key="event.id"
                          class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div class="flex items-center space-x-3">
                            <div
                              :class="[
                                'w-2 h-2 rounded-full',
                                event.type === 'blocked'
                                  ? 'bg-red-400'
                                  : event.type === 'suspicious'
                                  ? 'bg-yellow-400'
                                  : 'bg-blue-400',
                              ]"
                            ></div>
                            <div>
                              <div class="text-sm font-medium text-gray-900">
                                {{ event.message }}
                              </div>
                              <div class="text-xs text-gray-500">
                                {{ event.ip }} -
                                {{ formatDate(event.timestamp) }}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div
                class="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50"
              >
                <div class="text-sm text-gray-500">
                  Projet créé le {{ formatDate(project?.created_at) }}
                </div>

                <div class="flex space-x-3">
                  <button
                    @click="close"
                    class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<style scoped>
.font-mono {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas,
    "Liberation Mono", Menlo, monospace;
}
</style>
