<!-- frontend/src/views/Home.vue - Version avec violet/bleu et plein écran -->
<script setup>
import { ref, computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import {
  CheckIcon,
  XMarkIcon,
  RocketLaunchIcon,
  BoltIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  CpuChipIcon,
  GlobeAltIcon,
  CodeBracketIcon,
  ServerIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
  SparklesIcon,
  ChatBubbleBottomCenterTextIcon,
} from "@heroicons/vue/24/outline";

const authStore = useAuthStore();

// Configuration des prix
const pricing = {
  gratuit: {
    name: "Gratuit",
    subtitle: "Pour découvrir",
    price: 0,
    description: "Parfait pour tester et apprendre",
    features: [
      { text: "3 projets maximum", included: true },
      { text: "5 déploiements/mois par projet", included: true },
      { text: "Déploiement manuel uniquement", included: true },
      { text: "Sous-domaine .madahost.me", included: true },
      { text: "Frameworks JS de base", included: true },
      { text: "100 MB espace disque/projet", included: true },
      { text: "10 GB bande passante/mois", included: true },
      { text: "Support communautaire", included: true },
      { text: "CI/CD automatique", included: false },
      { text: "Domaine personnalisé", included: false },
      { text: "Variables d'environnement", included: false },
    ],
    cta: "Commencer gratuitement",
    popular: false,
  },
  personnel: {
    name: "Personnel",
    subtitle: "Pour freelances",
    price: 35000,
    description: "Idéal pour développeurs indépendants",
    features: [
      { text: "10 projets maximum", included: true },
      { text: "Déploiements illimités", included: true },
      { text: "CI/CD automatique", included: true },
      { text: "1 domaine personnalisé", included: true },
      { text: "Tous les frameworks supportés", included: true },
      { text: "500 MB espace disque/projet", included: true },
      { text: "100 GB bande passante/mois", included: true },
      { text: "Support prioritaire (<24h)", included: true },
      { text: "Variables d'environnement", included: true },
      { text: "Analytics de base", included: true },
      { text: "Historique 30 déploiements", included: true },
    ],
    cta: "Choisir Personnel",
    popular: true,
  },
  entreprise: {
    name: "Entreprise",
    subtitle: "Pour équipes",
    price: 120000,
    description: "Solution complète pour agences et startups",
    features: [
      { text: "Projets illimités", included: true },
      { text: "Déploiements illimités", included: true },
      { text: "CI/CD avancé (multi-branches)", included: true },
      { text: "5 domaines personnalisés", included: true },
      { text: "Tous frameworks + Docker", included: true },
      { text: "2 GB espace disque/projet", included: true },
      { text: "500 GB bande passante/mois", included: true },
      { text: "Support dédié (<4h)", included: true },
      { text: "Gestion d'équipe (5 membres)", included: true },
      { text: "Analytics avancés + A/B testing", included: true },
      { text: "Rollback instantané", included: true },
      { text: "CDN intégré + SLA 99.9%", included: true },
    ],
    cta: "Choisir Entreprise",
    popular: false,
  },
};

// Technologies
const technologies = [
  { name: "React", color: "from-blue-400 to-blue-600", icon: "⚛️" },
  { name: "Vue.js", color: "from-green-400 to-green-600", icon: "🖖" },
  {
    name: "Next.js",
    color: "from-gray-700 to-gray-900 dark:from-white dark:to-gray-300",
    icon: "▲",
  },
  { name: "Nuxt", color: "from-green-500 to-teal-600", icon: "💚" },
  { name: "Svelte", color: "from-orange-500 to-red-600", icon: "🔥" },
  { name: "Astro", color: "from-purple-500 to-pink-600", icon: "🚀" },
];
</script>

<template>
  <div class="w-full overflow-x-hidden">
    <!-- Hero Section - Plein écran avec dégradés adaptés -->
    <section
      class="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-100 to-purple-100 dark:from-slate-950 dark:via-purple-950 dark:to-slate-950"
    >
      <!-- Animated background elements -->
      <div class="absolute inset-0 overflow-hidden">
        <div
          class="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 dark:bg-purple-500/20 rounded-full blur-3xl animate-pulse"
        ></div>
        <div
          class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 dark:bg-blue-500/20 rounded-full blur-3xl animate-pulse"
          style="animation-delay: 1s"
        ></div>
        <div
          class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 dark:bg-violet-500/10 rounded-full blur-3xl"
        ></div>
      </div>

      <div class="relative max-w-7xl mx-auto text-center z-10 px-4 py-20">
        <!-- Badge -->
        <div
          class="inline-flex items-center px-4 py-2 bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-blue-200 dark:border-purple-500/30 rounded-full mb-8 shadow-lg animate-fade-in-up"
        >
          <SparklesIcon
            class="w-4 h-4 text-yellow-500 dark:text-yellow-400 mr-2"
          />
          <span class="text-gray-700 dark:text-white/90 text-sm font-medium"
            >Plateforme de déploiement nouvelle génération</span
          >
          <div
            class="w-2 h-2 bg-green-400 rounded-full ml-3 animate-pulse"
          ></div>
        </div>

        <!-- Titre principal -->
        <h1
          class="text-6xl md:text-8xl font-black text-gray-900 dark:text-white mb-6 leading-tight animate-fade-in-up animation-delay-200"
        >
          Déployez en
          <span
            class="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 text-transparent bg-clip-text"
          >
            un instant
          </span>
        </h1>

        <p
          class="text-xl md:text-2xl text-gray-700 dark:text-white/70 mb-12 max-w-3xl mx-auto leading-relaxed animate-fade-in-up animation-delay-400"
        >
          La plateforme de déploiement moderne pensée pour les développeurs
          malgaches. Déployez vos projets
          <strong class="text-gray-900 dark:text-white"
            >React, Vue, Next.js</strong
          >
          en quelques clics.
        </p>

        <!-- CTA Buttons -->
        <div
          class="flex flex-col sm:flex-row justify-center items-center gap-4 mb-16 animate-fade-in-up animation-delay-600"
        >
          <router-link
            v-if="!authStore.isAuthenticated"
            to="/login"
            class="group px-8 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-500 dark:via-purple-500 dark:to-pink-500 text-white rounded-2xl text-lg font-bold hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-105 flex items-center"
          >
            <RocketLaunchIcon class="w-6 h-6 mr-2 group-hover:animate-bounce" />
            Commencer gratuitement
          </router-link>
          <router-link
            v-else
            to="/dashboard"
            class="group px-8 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-500 dark:via-purple-500 dark:to-pink-500 text-white rounded-2xl text-lg font-bold hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-105 flex items-center"
          >
            <ChartBarIcon class="w-6 h-6 mr-2" />
            Aller au Dashboard
          </router-link>

          <a
            href="#docs"
            class="px-8 py-4 bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-blue-200 dark:border-purple-500/30 text-gray-900 dark:text-white rounded-2xl text-lg font-bold hover:bg-white dark:hover:bg-white/10 transition-all flex items-center shadow-lg"
          >
            <DocumentTextIcon class="w-6 h-6 mr-2" />
            Documentation
          </a>
        </div>

        <!-- Stats -->
        <div
          class="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto animate-fade-in-up animation-delay-800"
        >
          <div
            class="bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-blue-200 dark:border-purple-500/30 rounded-2xl p-6 hover:shadow-lg transition-all"
          >
            <div
              class="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 text-transparent bg-clip-text mb-2"
            >
              99.9%
            </div>
            <div class="text-gray-700 dark:text-white/60 text-sm">Uptime</div>
          </div>
          <div
            class="bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-blue-200 dark:border-purple-500/30 rounded-2xl p-6 hover:shadow-lg transition-all"
          >
            <div
              class="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 text-transparent bg-clip-text mb-2"
            >
              &lt;5s
            </div>
            <div class="text-gray-700 dark:text-white/60 text-sm">
              Temps de build
            </div>
          </div>
          <div
            class="bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-blue-200 dark:border-purple-500/30 rounded-2xl p-6 hover:shadow-lg transition-all"
          >
            <div
              class="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 text-transparent bg-clip-text mb-2"
            >
              SSL
            </div>
            <div class="text-gray-700 dark:text-white/60 text-sm">
              Gratuit inclus
            </div>
          </div>
          <div
            class="bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-blue-200 dark:border-purple-500/30 rounded-2xl p-6 hover:shadow-lg transition-all"
          >
            <div
              class="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 text-transparent bg-clip-text mb-2"
            >
              24/7
            </div>
            <div class="text-gray-700 dark:text-white/60 text-sm">Support</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section - Plein écran -->
    <section class="relative py-32 px-4 bg-white dark:bg-gray-900 w-full">
      <div class="max-w-7xl mx-auto">
        <div class="text-center mb-20">
          <h2
            class="text-5xl md:text-6xl font-black text-gray-900 dark:text-white mb-6"
          >
            Pourquoi choisir
            <span
              class="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 text-transparent bg-clip-text"
            >
              MadaHost </span
            >?
          </h2>
          <p class="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Une plateforme complète avec tout ce dont vous avez besoin pour
            déployer et gérer vos projets web
          </p>
        </div>

        <div class="grid md:grid-cols-3 gap-8">
          <!-- Feature 1 -->
          <div
            class="group bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 border border-blue-200 dark:border-purple-500/30 rounded-3xl p-8 hover:shadow-2xl hover:scale-105 transition-all duration-300"
          >
            <div
              class="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg"
            >
              <BoltIcon class="w-8 h-8 text-white" />
            </div>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Déploiement ultra-rapide
            </h3>
            <p class="text-gray-600 dark:text-gray-300 leading-relaxed">
              Connectez votre repo GitHub et déployez en moins de 30 secondes.
              Build automatique avec détection de framework.
            </p>
          </div>

          <!-- Feature 2 -->
          <div
            class="group bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-800 border border-green-200 dark:border-purple-500/30 rounded-3xl p-8 hover:shadow-2xl hover:scale-105 transition-all duration-300"
          >
            <div
              class="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg"
            >
              <ShieldCheckIcon class="w-8 h-8 text-white" />
            </div>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Sécurité maximale
            </h3>
            <p class="text-gray-600 dark:text-gray-300 leading-relaxed">
              SSL automatique, protection DDoS, variables d'environnement
              sécurisées et monitoring 24/7.
            </p>
          </div>

          <!-- Feature 3 -->
          <div
            class="group bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-800 border border-purple-200 dark:border-purple-500/30 rounded-3xl p-8 hover:shadow-2xl hover:scale-105 transition-all duration-300"
          >
            <div
              class="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg"
            >
              <CpuChipIcon class="w-8 h-8 text-white" />
            </div>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              CI/CD intelligent
            </h3>
            <p class="text-gray-600 dark:text-gray-300 leading-relaxed">
              Déploiement automatique sur chaque commit, rollback instantané,
              preview deployments pour les pull requests.
            </p>
          </div>

          <!-- Feature 4 -->
          <div
            class="group bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-800 border border-orange-200 dark:border-purple-500/30 rounded-3xl p-8 hover:shadow-2xl hover:scale-105 transition-all duration-300"
          >
            <div
              class="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg"
            >
              <GlobeAltIcon class="w-8 h-8 text-white" />
            </div>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              CDN global
            </h3>
            <p class="text-gray-600 dark:text-gray-300 leading-relaxed">
              Vos sites servis via CDN Cloudflare pour des performances
              optimales partout dans le monde.
            </p>
          </div>

          <!-- Feature 5 -->
          <div
            class="group bg-gradient-to-br from-pink-50 to-rose-50 dark:from-gray-800 dark:to-gray-800 border border-pink-200 dark:border-purple-500/30 rounded-3xl p-8 hover:shadow-2xl hover:scale-105 transition-all duration-300"
          >
            <div
              class="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg"
            >
              <ChartBarIcon class="w-8 h-8 text-white" />
            </div>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Analytics détaillés
            </h3>
            <p class="text-gray-600 dark:text-gray-300 leading-relaxed">
              Suivez les performances de vos sites avec des analytics en temps
              réel et des rapports détaillés.
            </p>
          </div>

          <!-- Feature 6 -->
          <div
            class="group bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-gray-800 dark:to-gray-800 border border-yellow-200 dark:border-purple-500/30 rounded-3xl p-8 hover:shadow-2xl hover:scale-105 transition-all duration-300"
          >
            <div
              class="w-16 h-16 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg"
            >
              <ServerIcon class="w-8 h-8 text-white" />
            </div>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Infrastructure locale
            </h3>
            <p class="text-gray-600 dark:text-gray-300 leading-relaxed">
              Hébergement sur VPS avec latence réduite pour Madagascar et
              l'Afrique. Support en français.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Technologies Section -->
    <section
      class="relative py-32 px-4 bg-gradient-to-br from-blue-50 to-purple-100 dark:from-slate-950 dark:to-purple-950 w-full"
    >
      <div class="max-w-7xl mx-auto text-center">
        <h2
          class="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-6"
        >
          Compatible avec vos
          <span
            class="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 text-transparent bg-clip-text"
          >
            technologies préférées
          </span>
        </h2>
        <p class="text-xl text-gray-600 dark:text-gray-300 mb-16">
          Détection automatique du framework et configuration optimisée
        </p>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          <div
            v-for="tech in technologies"
            :key="tech.name"
            class="group bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-blue-200 dark:border-purple-500/30 rounded-2xl p-8 hover:shadow-xl hover:scale-110 transition-all duration-300"
          >
            <div
              :class="`w-16 h-16 bg-gradient-to-br ${tech.color} rounded-xl flex items-center justify-center mx-auto mb-4 text-3xl group-hover:scale-110 transition-transform shadow-lg`"
            >
              {{ tech.icon }}
            </div>
            <div class="text-gray-900 dark:text-white font-semibold">
              {{ tech.name }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing Section -->
    <section
      id="pricing"
      class="relative py-32 px-4 bg-white dark:bg-gray-900 w-full"
    >
      <div class="max-w-7xl mx-auto">
        <div class="text-center mb-20">
          <h2
            class="text-5xl md:text-6xl font-black text-gray-900 dark:text-white mb-6"
          >
            Tarifs
            <span
              class="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 text-transparent bg-clip-text"
            >
              transparents
            </span>
          </h2>
          <p
            class="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8"
          >
            Des prix adaptés au marché malgache, sans frais cachés
          </p>
        </div>

        <div class="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <!-- Plan Gratuit -->
          <div
            class="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-800 border border-gray-200 dark:border-purple-500/30 rounded-3xl p-8 hover:shadow-xl transition-all"
          >
            <div class="mb-6">
              <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {{ pricing.gratuit.name }}
              </h3>
              <p class="text-gray-600 dark:text-gray-400 text-sm">
                {{ pricing.gratuit.subtitle }}
              </p>
            </div>

            <div class="mb-8">
              <div class="flex items-baseline">
                <span class="text-5xl font-black text-gray-900 dark:text-white"
                  >0</span
                >
                <span class="text-gray-600 dark:text-gray-400 ml-2"
                  >Ar/mois</span
                >
              </div>
              <p class="text-gray-600 dark:text-gray-400 text-sm mt-2">
                {{ pricing.gratuit.description }}
              </p>
            </div>

            <router-link
              to="/login"
              class="block w-full text-center px-6 py-3 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-xl font-semibold transition-all mb-8 border border-gray-300 dark:border-gray-600"
            >
              {{ pricing.gratuit.cta }}
            </router-link>

            <div class="space-y-4">
              <div
                v-for="feature in pricing.gratuit.features"
                :key="feature.text"
                class="flex items-start"
              >
                <CheckIcon
                  v-if="feature.included"
                  class="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5"
                />
                <XMarkIcon
                  v-else
                  class="w-5 h-5 text-gray-300 dark:text-gray-600 mr-3 flex-shrink-0 mt-0.5"
                />
                <span
                  :class="
                    feature.included
                      ? 'text-gray-700 dark:text-gray-300'
                      : 'text-gray-400 dark:text-gray-600'
                  "
                  class="text-sm"
                >
                  {{ feature.text }}
                </span>
              </div>
            </div>
          </div>

          <!-- Plan Personnel (Popular) -->
          <div
            class="relative bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-600/20 dark:via-purple-600/20 dark:to-pink-600/20 backdrop-blur-xl border-2 border-purple-500 dark:border-purple-400 rounded-3xl p-8 shadow-2xl shadow-purple-500/50 transform scale-105"
          >
            <div class="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span
                class="px-4 py-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white text-sm font-bold rounded-full shadow-lg"
              >
                ⭐ Le plus populaire
              </span>
            </div>

            <div class="mb-6 mt-4">
              <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {{ pricing.personnel.name }}
              </h3>
              <p class="text-gray-600 dark:text-gray-300 text-sm">
                {{ pricing.personnel.subtitle }}
              </p>
            </div>

            <div class="mb-8">
              <div class="flex items-baseline">
                <span class="text-5xl font-black text-gray-900 dark:text-white"
                  >35,000</span
                >
                <span class="text-gray-600 dark:text-gray-300 ml-2"
                  >Ar/mois</span
                >
              </div>
              <p class="text-gray-700 dark:text-gray-200 text-sm mt-2">
                {{ pricing.personnel.description }}
              </p>
            </div>

            <router-link
              to="/login"
              class="block w-full text-center px-6 py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition-all mb-8 shadow-lg hover:shadow-xl"
            >
              {{ pricing.personnel.cta }}
            </router-link>

            <div class="space-y-4">
              <div
                v-for="feature in pricing.personnel.features"
                :key="feature.text"
                class="flex items-start"
              >
                <CheckIcon
                  class="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5"
                />
                <span class="text-gray-700 dark:text-gray-200 text-sm">{{
                  feature.text
                }}</span>
              </div>
            </div>
          </div>

          <!-- Plan Entreprise -->
          <div
            class="bg-gradient-to-br from-gray-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 border border-gray-200 dark:border-purple-500/30 rounded-3xl p-8 hover:shadow-xl transition-all"
          >
            <div class="mb-6">
              <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {{ pricing.entreprise.name }}
              </h3>
              <p class="text-gray-600 dark:text-gray-400 text-sm">
                {{ pricing.entreprise.subtitle }}
              </p>
            </div>

            <div class="mb-8">
              <div class="flex items-baseline">
                <span class="text-5xl font-black text-gray-900 dark:text-white"
                  >120,000</span
                >
                <span class="text-gray-600 dark:text-gray-400 ml-2"
                  >Ar/mois</span
                >
              </div>
              <p class="text-gray-600 dark:text-gray-400 text-sm mt-2">
                {{ pricing.entreprise.description }}
              </p>
            </div>

            <router-link
              to="/login"
              class="block w-full text-center px-6 py-3 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-xl font-semibold transition-all mb-8 border border-gray-300 dark:border-gray-600"
            >
              {{ pricing.entreprise.cta }}
            </router-link>

            <div class="space-y-4">
              <div
                v-for="feature in pricing.entreprise.features"
                :key="feature.text"
                class="flex items-start"
              >
                <CheckIcon
                  class="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5"
                />
                <span class="text-gray-700 dark:text-gray-300 text-sm">{{
                  feature.text
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Add-ons -->
        <div class="mt-16 text-center">
          <p class="text-gray-600 dark:text-gray-300 mb-6">
            Options supplémentaires disponibles :
          </p>
          <div class="flex flex-wrap justify-center gap-4">
            <div
              class="px-4 py-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:bg-white/5 border border-blue-200 dark:border-purple-500/30 rounded-xl text-gray-700 dark:text-gray-300 text-sm"
            >
              +1 GB espace disque : 10,000 Ar/mois
            </div>
            <div
              class="px-4 py-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:bg-white/5 border border-blue-200 dark:border-purple-500/30 rounded-xl text-gray-700 dark:text-gray-300 text-sm"
            >
              +100 GB bande passante : 5,000 Ar/mois
            </div>
            <div
              class="px-4 py-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:bg-white/5 border border-blue-200 dark:border-purple-500/30 rounded-xl text-gray-700 dark:text-gray-300 text-sm"
            >
              Membre d'équipe additionnel : 15,000 Ar/mois
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Documentation Section -->
    <section
      id="docs"
      class="relative py-32 px-4 bg-white dark:bg-gray-900 w-full"
    >
      <div class="max-w-7xl mx-auto">
        <div class="text-center mb-20">
          <h2
            class="text-5xl md:text-6xl font-black text-gray-900 dark:text-white mb-6"
          >
            Documentation
            <span
              class="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 text-transparent bg-clip-text"
            >
              complète
            </span>
          </h2>
          <p class="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Tout ce dont vous avez besoin pour démarrer et maîtriser MadaHost
          </p>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <div
            class="group bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 border border-blue-200 dark:border-purple-500/30 rounded-2xl p-8 hover:shadow-xl hover:scale-105 transition-all duration-300"
          >
            <RocketLaunchIcon
              class="w-12 h-12 text-blue-600 dark:text-purple-400 mb-6 group-hover:scale-110 transition-transform"
            />
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3">
              Démarrage rapide
            </h3>
            <p class="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
              Déployez votre premier projet en 5 minutes
            </p>
          </div>

          <div
            class="group bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-800 border border-purple-200 dark:border-purple-500/30 rounded-2xl p-8 hover:shadow-xl hover:scale-105 transition-all duration-300"
          >
            <CodeBracketIcon
              class="w-12 h-12 text-purple-600 dark:text-purple-400 mb-6 group-hover:scale-110 transition-transform"
            />
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3">
              Frameworks supportés
            </h3>
            <p class="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
              React, Vue, Next.js, Nuxt, Svelte, Astro...
            </p>
          </div>

          <div
            class="group bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-800 border border-green-200 dark:border-purple-500/30 rounded-2xl p-8 hover:shadow-xl hover:scale-105 transition-all duration-300"
          >
            <ServerIcon
              class="w-12 h-12 text-green-600 dark:text-green-400 mb-6 group-hover:scale-110 transition-transform"
            />
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3">
              Configuration avancée
            </h3>
            <p class="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
              Variables d'environnement, domaines personnalisés
            </p>
          </div>

          <div
            class="group bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-800 border border-orange-200 dark:border-purple-500/30 rounded-2xl p-8 hover:shadow-xl hover:scale-105 transition-all duration-300"
          >
            <CloudArrowUpIcon
              class="w-12 h-12 text-orange-600 dark:text-orange-400 mb-6 group-hover:scale-110 transition-transform"
            />
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3">
              CI/CD automatique
            </h3>
            <p class="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
              Déploiement automatique sur chaque commit
            </p>
          </div>
        </div>

        <!-- Quick Start Guide -->
        <div
          class="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-600/20 dark:via-purple-600/20 dark:to-pink-600/20 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-12 shadow-xl"
        >
          <h3
            class="text-3xl font-bold text-gray-900 dark:text-white mb-8 flex items-center"
          >
            <span class="text-4xl mr-3">🚀</span>
            Guide de démarrage rapide
          </h3>

          <div class="grid md:grid-cols-3 gap-8 mb-8">
            <div class="flex items-start space-x-4">
              <div
                class="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
              >
                1
              </div>
              <div>
                <h4
                  class="text-lg font-semibold text-gray-900 dark:text-white mb-2"
                >
                  Connectez GitHub
                </h4>
                <p class="text-gray-600 dark:text-gray-300 text-sm">
                  Autorisez MadaHost à accéder à vos repositories via OAuth
                  sécurisé
                </p>
              </div>
            </div>

            <div class="flex items-start space-x-4">
              <div
                class="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
              >
                2
              </div>
              <div>
                <h4
                  class="text-lg font-semibold text-gray-900 dark:text-white mb-2"
                >
                  Sélectionnez un projet
                </h4>
                <p class="text-gray-600 dark:text-gray-300 text-sm">
                  Choisissez le repository que vous souhaitez déployer
                </p>
              </div>
            </div>

            <div class="flex items-start space-x-4">
              <div
                class="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
              >
                3
              </div>
              <div>
                <h4
                  class="text-lg font-semibold text-gray-900 dark:text-white mb-2"
                >
                  Déployez instantanément
                </h4>
                <p class="text-gray-600 dark:text-gray-300 text-sm">
                  Un clic et votre site est en ligne avec SSL automatique
                </p>
              </div>
            </div>
          </div>

          <!-- Code example -->
          <div
            class="bg-gray-900 dark:bg-black/50 rounded-2xl p-6 font-mono text-sm shadow-xl border border-gray-700 dark:border-purple-500/30"
          >
            <div class="flex items-center justify-between mb-4">
              <span class="text-green-400 flex items-center">
                <span
                  class="w-3 h-3 bg-green-400 rounded-full mr-2 animate-pulse"
                ></span>
                $ Exemple de déploiement
              </span>
              <span class="text-gray-400">Durée moyenne : 30s</span>
            </div>
            <div class="space-y-2 text-gray-300">
              <div class="flex items-center">
                <span class="text-green-400 mr-2">✓</span>
                Clone du repository...
              </div>
              <div class="flex items-center">
                <span class="text-green-400 mr-2">✓</span>
                Détection du framework: <span class="text-blue-400">React</span>
              </div>
              <div class="flex items-center">
                <span class="text-green-400 mr-2">✓</span>
                Installation des dépendances...
              </div>
              <div class="flex items-center">
                <span class="text-green-400 mr-2">✓</span>
                Build du projet...
              </div>
              <div class="flex items-center">
                <span class="text-green-400 mr-2">✓</span>
                Déploiement sur CDN...
              </div>
              <div class="flex items-center">
                <span class="text-green-400 mr-2">✓</span>
                Configuration SSL...
              </div>
              <div class="flex items-center text-green-400 font-bold mt-4">
                <span class="mr-2">🎉</span>
                Déployé avec succès sur
                <span class="text-purple-400 ml-1"
                  >https://mon-projet.madahost.me</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <section
      class="relative py-32 px-4 bg-gradient-to-br from-blue-50 to-purple-100 dark:from-slate-950 dark:to-purple-950 w-full"
    >
      <div class="max-w-4xl mx-auto">
        <div class="text-center mb-16">
          <h2
            class="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-6"
          >
            Questions
            <span
              class="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 text-transparent bg-clip-text"
            >
              fréquentes
            </span>
          </h2>
          <p class="text-gray-600 dark:text-gray-300">
            Trouvez rapidement les réponses à vos questions
          </p>
        </div>

        <div class="space-y-4">
          <details
            class="group bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-blue-200 dark:border-purple-500/30 rounded-2xl p-6 hover:shadow-lg transition-all"
          >
            <summary
              class="cursor-pointer text-lg font-semibold text-gray-900 dark:text-white flex items-center justify-between"
            >
              Comment fonctionne le déploiement automatique ?
              <svg
                class="w-6 h-6 text-gray-600 dark:text-gray-400 group-open:rotate-180 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </summary>
            <p class="mt-4 text-gray-600 dark:text-gray-300 leading-relaxed">
              Avec le CI/CD automatique, chaque fois que vous poussez un commit
              sur votre branche principale, MadaHost détecte le changement,
              clone votre repository, installe les dépendances, build le projet
              et le déploie automatiquement. Le tout en moins d'une minute !
            </p>
          </details>

          <details
            class="group bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-blue-200 dark:border-purple-500/30 rounded-2xl p-6 hover:shadow-lg transition-all"
          >
            <summary
              class="cursor-pointer text-lg font-semibold text-gray-900 dark:text-white flex items-center justify-between"
            >
              Puis-je utiliser mon propre domaine ?
              <svg
                class="w-6 h-6 text-gray-600 dark:text-gray-400 group-open:rotate-180 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </summary>
            <p class="mt-4 text-gray-600 dark:text-gray-300 leading-relaxed">
              Oui ! À partir du plan Personnel, vous pouvez connecter votre
              propre domaine. Il suffit de pointer vos DNS vers nos serveurs et
              nous nous occupons de la configuration SSL automatique avec Let's
              Encrypt.
            </p>
          </details>

          <details
            class="group bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-blue-200 dark:border-purple-500/30 rounded-2xl p-6 hover:shadow-lg transition-all"
          >
            <summary
              class="cursor-pointer text-lg font-semibold text-gray-900 dark:text-white flex items-center justify-between"
            >
              Quels frameworks sont supportés ?
              <svg
                class="w-6 h-6 text-gray-600 dark:text-gray-400 group-open:rotate-180 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </summary>
            <p class="mt-4 text-gray-600 dark:text-gray-300 leading-relaxed">
              MadaHost supporte tous les frameworks JavaScript modernes : React,
              Vue.js, Next.js, Nuxt, Svelte, Astro, Angular, et bien d'autres.
              La détection est automatique ! Pour les plans Entreprise, nous
              supportons également les conteneurs Docker personnalisés.
            </p>
          </details>

          <details
            class="group bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-blue-200 dark:border-purple-500/30 rounded-2xl p-6 hover:shadow-lg transition-all"
          >
            <summary
              class="cursor-pointer text-lg font-semibold text-gray-900 dark:text-white flex items-center justify-between"
            >
              Que se passe-t-il si mon déploiement échoue ?
              <svg
                class="w-6 h-6 text-gray-600 dark:text-gray-400 group-open:rotate-180 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </summary>
            <p class="mt-4 text-gray-600 dark:text-gray-300 leading-relaxed">
              Pas de panique ! Vous avez accès aux logs détaillés en temps réel
              pour identifier le problème. Votre site précédent reste en ligne
              jusqu'à ce qu'un nouveau déploiement réussisse. Vous pouvez aussi
              faire un rollback instantané vers une version précédente.
            </p>
          </details>

          <details
            class="group bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-blue-200 dark:border-purple-500/30 rounded-2xl p-6 hover:shadow-lg transition-all"
          >
            <summary
              class="cursor-pointer text-lg font-semibold text-gray-900 dark:text-white flex items-center justify-between"
            >
              Comment gérer les variables d'environnement ?
              <svg
                class="w-6 h-6 text-gray-600 dark:text-gray-400 group-open:rotate-180 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </summary>
            <p class="mt-4 text-gray-600 dark:text-gray-300 leading-relaxed">
              Dans les paramètres de votre projet, vous pouvez ajouter des
              variables d'environnement qui seront injectées lors du build.
              Elles sont stockées de manière sécurisée et chiffrées. Le plan
              Entreprise permet même de gérer des variables par branche.
            </p>
          </details>
        </div>
      </div>
    </section>

    <!-- CTA Final -->
    <section
      class="relative py-32 px-4 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-purple-950 dark:to-slate-950 w-full overflow-hidden"
    >
      <!-- Animated background -->
      <div class="absolute inset-0 overflow-hidden opacity-30 dark:opacity-20">
        <div
          class="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/30 dark:bg-purple-500/30 rounded-full blur-3xl animate-pulse"
        ></div>
        <div
          class="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/30 dark:bg-blue-500/30 rounded-full blur-3xl animate-pulse"
          style="animation-delay: 1s"
        ></div>
      </div>

      <div class="max-w-5xl mx-auto text-center relative z-10">
        <div
          class="bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-blue-200 dark:border-purple-500/30 rounded-3xl p-16 shadow-2xl"
        >
          <h2
            class="text-4xl md:text-6xl font-black text-gray-900 dark:text-white mb-6"
          >
            Prêt à déployer votre prochain projet ?
          </h2>
          <p
            class="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto"
          >
            Rejoignez les développeurs malgaches qui font confiance à MadaHost
            pour leurs déploiements
          </p>

          <div class="flex flex-col sm:flex-row justify-center gap-4 mb-8">
            <router-link
              v-if="!authStore.isAuthenticated"
              to="/login"
              class="px-10 py-5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-500 dark:via-purple-500 dark:to-pink-500 text-white rounded-2xl text-lg font-bold hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-105"
            >
              Commencer gratuitement
            </router-link>
            <router-link
              v-else
              to="/dashboard"
              class="px-10 py-5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-500 dark:via-purple-500 dark:to-pink-500 text-white rounded-2xl text-lg font-bold hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-105"
            >
              Aller au Dashboard
            </router-link>

            <a
              href="#pricing"
              class="px-10 py-5 bg-white dark:bg-white/10 backdrop-blur-xl border border-blue-200 dark:border-purple-500/30 text-gray-900 dark:text-white rounded-2xl text-lg font-bold hover:bg-gray-50 dark:hover:bg-white/20 transition-all"
            >
              Voir les tarifs
            </a>
          </div>

          <p class="text-gray-600 dark:text-gray-400 text-sm">
            ✓ Aucune carte bancaire requise &nbsp;&nbsp; ✓ Déploiement en 30
            secondes &nbsp;&nbsp; ✓ Support 24/7
          </p>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer
      class="relative py-16 px-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 w-full"
    >
      <div class="max-w-7xl mx-auto">
        <div class="grid md:grid-cols-4 gap-12 mb-12">
          <div>
            <router-link to="/" class="flex items-center space-x-3 mb-4">
              <div
                class="w-10 h-10 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 dark:from-blue-500 dark:via-purple-500 dark:to-pink-500 rounded-xl flex items-center justify-center shadow-lg"
              >
                <span class="text-white font-bold text-lg">M</span>
              </div>
              <h3 class="text-2xl font-bold text-gray-900 dark:text-white">
                MadaHost
              </h3>
            </router-link>
            <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              La plateforme de déploiement moderne pensée pour les développeurs
              malgaches.
            </p>
          </div>

          <div>
            <h4 class="text-gray-900 dark:text-white font-semibold mb-4">
              Produit
            </h4>
            <ul class="space-y-2 text-gray-600 dark:text-gray-400 text-sm">
              <li>
                <a
                  href="#features"
                  class="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >Fonctionnalités</a
                >
              </li>
              <li>
                <a
                  href="#pricing"
                  class="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >Tarifs</a
                >
              </li>
              <li>
                <router-link
                  to="/dashboard"
                  class="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >Dashboard</router-link
                >
              </li>
            </ul>
          </div>

          <div>
            <h4 class="text-gray-900 dark:text-white font-semibold mb-4">
              Support
            </h4>
            <ul class="space-y-2 text-gray-600 dark:text-gray-400 text-sm">
              <li>
                <router-link
                  to="/messages"
                  class="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >Centre d'aide</router-link
                >
              </li>
              <li>
                <router-link
                  to="/messages"
                  class="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >Nous contacter</router-link
                >
              </li>
            </ul>
          </div>

          <div>
            <h4 class="text-gray-900 dark:text-white font-semibold mb-4">
              Légal
            </h4>
            <ul class="space-y-2 text-gray-600 dark:text-gray-400 text-sm">
              <li>
                <a
                  href="#"
                  class="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >Conditions d'utilisation</a
                >
              </li>
              <li>
                <a
                  href="#"
                  class="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >Politique de confidentialité</a
                >
              </li>
            </ul>
          </div>
        </div>

        <div
          class="pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center"
        >
          <p class="text-gray-600 dark:text-gray-400 text-sm">
            © 2025 MadaHost. Tous droits réservés.
          </p>
          <div class="flex space-x-6 mt-4 md:mt-0">
            <a
              href="https://github.com"
              target="_blank"
              class="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                />
              </svg>
            </a>
            <a
              href="#"
              class="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path
                  d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Animations personnalisées */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.6s ease-out;
}

.animation-delay-200 {
  animation-delay: 0.2s;
}

.animation-delay-400 {
  animation-delay: 0.4s;
}

.animation-delay-600 {
  animation-delay: 0.6s;
}

.animation-delay-800 {
  animation-delay: 0.8s;
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Hover effect for cards */
.group:hover {
  transform: translateY(-5px);
}
</style>
