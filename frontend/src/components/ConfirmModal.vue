<!-- frontend/src/components/ConfirmModal.vue -->
<script setup>
import { computed } from "vue";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from "@headlessui/vue";
import {
  ExclamationTriangleIcon,
  TrashIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
} from "@heroicons/vue/24/outline";

const emit = defineEmits(["confirm", "cancel"]);
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  details: {
    type: String,
    default: "",
  },
  confirmText: {
    type: String,
    default: "Confirmer",
  },
  cancelText: {
    type: String,
    default: "Annuler",
  },
  type: {
    type: String,
    default: "warning", // warning, danger, info
    validator: (value) => ["warning", "danger", "info"].includes(value),
  },
  confirmClass: {
    type: String,
    default: "",
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const iconComponent = computed(() => {
  const icons = {
    warning: ExclamationTriangleIcon,
    danger: TrashIcon,
    info: InformationCircleIcon,
  };
  return icons[props.type] || ExclamationTriangleIcon;
});

const iconClass = computed(() => {
  const classes = {
    warning: "text-yellow-600",
    danger: "text-red-600",
    info: "text-blue-600",
  };
  return classes[props.type] || "text-yellow-600";
});

const iconBgClass = computed(() => {
  const classes = {
    warning: "bg-yellow-100",
    danger: "bg-red-100",
    info: "bg-blue-100",
  };
  return classes[props.type] || "bg-yellow-100";
});

const confirmButtonClass = computed(() => {
  if (props.confirmClass) {
    return `inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto disabled:opacity-50 ${props.confirmClass}`;
  }

  const classes = {
    warning: "bg-yellow-600 hover:bg-yellow-500 focus:ring-yellow-500",
    danger: "bg-red-600 hover:bg-red-500 focus:ring-red-500",
    info: "bg-blue-600 hover:bg-blue-500 focus:ring-blue-500",
  };

  const typeClass = classes[props.type] || classes.warning;

  return `inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto disabled:opacity-50 ${typeClass}`;
});
</script>

<template>
  <TransitionRoot :show="isOpen" as="template">
    <Dialog as="div" class="relative z-50" @close="$emit('cancel')">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black bg-opacity-25" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div
          class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0"
        >
          <TransitionChild
            as="template"
            enter="ease-out duration-300"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel
              class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg"
            >
              <div class="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <div class="sm:flex sm:items-start">
                  <div
                    :class="[
                      'mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 sm:h-10 sm:w-10',
                      iconBgClass,
                    ]"
                  >
                    <component
                      :is="iconComponent"
                      :class="['h-6 w-6', iconClass]"
                      aria-hidden="true"
                    />
                  </div>
                  <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                    <DialogTitle
                      as="h3"
                      class="text-base font-semibold leading-6 text-gray-900"
                    >
                      {{ title }}
                    </DialogTitle>
                    <div class="mt-2">
                      <p class="text-sm text-gray-500">
                        {{ message }}
                      </p>
                      <div
                        v-if="details"
                        class="mt-3 p-3 bg-gray-50 rounded-md"
                      >
                        <p class="text-xs text-gray-600">{{ details }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6"
              >
                <button
                  type="button"
                  :class="confirmButtonClass"
                  @click="$emit('confirm')"
                  :disabled="loading"
                >
                  <div
                    v-if="loading"
                    class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
                  ></div>
                  {{ loading ? "En cours..." : confirmText }}
                </button>
                <button
                  type="button"
                  class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto sm:mr-3"
                  @click="$emit('cancel')"
                  :disabled="loading"
                >
                  {{ cancelText }}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
