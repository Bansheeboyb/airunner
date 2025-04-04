<script setup lang="ts">
  import {
    Wand2Icon,
    MessageSquareIcon,
    ImageIcon,
    HeadphonesIcon,
    VideoIcon,
    ServerIcon,
    CloudIcon,
  } from "lucide-vue-next";
  import { ref, onMounted, computed } from "vue";

  const { apiCaller } = useApiCaller();
  const { currentTeam } = useUser();

  // Loading state
  const isLoading = ref(true);

  // Deployment state
  const showDeploymentForm = ref(false);
  const error = ref<string | null>(null);
  const deploymentStatus = ref<string | null>(null);
  const apiEndpoint = ref<string | null>(null);
  const selectedVm = ref<Vm | null>(null);

  interface Vm {
    id: string;
    name: string;
    labels?: { model_name?: string };
    status: string;
    zone: string;
    creationTimestamp: string;
    apiEndpoint?: string;
    modelDetails?: {
      category: string;
      company: string;
      description: string;
      tags: string[];
      imageUrl?: string;
    };
  }

  const userVms = ref<Vm[]>([]);

  // Function to load user's VMs
  const loadUserVms = async () => {
    try {
      isLoading.value = true;
      error.value = null;

      interface VmResponse {
        vms: Vm[];
      }

      const { vms }: VmResponse = await apiCaller.vm.listUserVms.query();

      // Enrich VMs with model details based on model_name
      if (vms && vms.length > 0) {
        vms.forEach((vm) => {
          const modelName = vm.labels?.model_name || "";
          // Default values if we can't match the model
          vm.modelDetails = {
            category: getCategoryFromModelName(modelName),
            company: getCompanyFromModelName(modelName),
            description:
              "A deployed AI model instance running on your infrastructure.",
            tags: ["Deployed", vm.status, vm.zone.split("-")[0]],
            imageUrl: getImageUrlFromModelName(modelName),
          };
        });
      }

      userVms.value = vms || [];
    } catch (err) {
      console.error("Error loading VMs:", err);
      error.value = `Error loading VMs: ${
        err instanceof Error ? err.message : String(err)
      }`;
    } finally {
      isLoading.value = false;
    }
  };

  // Helper functions to derive model information from model names
  const getCategoryFromModelName = (modelName: string): string => {
    if (
      modelName.includes("claude") ||
      modelName.includes("llama") ||
      modelName.includes("phi") ||
      modelName.includes("gemini")
    ) {
      return "Text Generation";
    } else if (
      modelName.includes("dall") ||
      modelName.includes("midjourney") ||
      modelName.includes("diffusion")
    ) {
      return "Image Generation";
    } else if (
      modelName.includes("whisper") ||
      modelName.includes("deepgram")
    ) {
      return "Audio Transcription";
    } else if (modelName.includes("suno")) {
      return "Audio Generation";
    } else if (modelName.includes("pika") || modelName.includes("gen-2")) {
      return "Video Generation";
    } else {
      return "AI Model";
    }
  };

  const getCompanyFromModelName = (modelName: string): string => {
    if (modelName.includes("claude")) {
      return "Anthropic";
    } else if (modelName.includes("llama")) {
      return "Meta";
    } else if (modelName.includes("phi")) {
      return "Microsoft";
    } else if (modelName.includes("gemini")) {
      return "Google";
    } else if (modelName.includes("dall") || modelName.includes("whisper")) {
      return "OpenAI";
    } else if (modelName.includes("midjourney")) {
      return "Midjourney";
    } else if (modelName.includes("diffusion")) {
      return "Stability AI";
    } else if (modelName.includes("suno")) {
      return "Suno";
    } else if (modelName.includes("pika")) {
      return "Pika Labs";
    } else if (modelName.includes("gen-2")) {
      return "Runway";
    } else if (modelName.includes("deepgram")) {
      return "Deepgram";
    } else {
      return "Custom";
    }
  };

  const getImageUrlFromModelName = (modelName: string): string => {
    // Placeholder logic for model images - in a real implementation,
    // you might have a mapping of model names to images
    if (modelName.includes("claude")) {
      return "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRb_buBcn9wPL3l7UX1aoknZFgDX-RyoUf7YQ&s";
    } else if (modelName.includes("llama")) {
      return "https://calaltrading.ae/grid/99/110/ERA_CMS_IMG_22_1727332957.webp";
    } else if (modelName.includes("phi")) {
      return "https://pub-e93d5c9fdf134c89830082377f6df465.r2.dev/2024/12/Phi-4-Microsofts-Small-AI-Model-Beats-the-Giants-at-Math.webp";
    } else {
      // Default image
      return "";
    }
  };

  // Helper function to format dates
  const formatDate = (timestamp: string | number | Date) => {
    if (!timestamp) return "Unknown";
    return new Date(timestamp).toLocaleString();
  };

  // Helper functions for UI
  const getGradientClass = (category: string): string => {
    switch (category) {
      case "Text Generation":
        return "from-blue-500 to-indigo-600";
      case "Image Generation":
        return "from-green-500 to-teal-600";
      case "Audio Transcription":
      case "Audio Generation":
        return "from-amber-500 to-orange-600";
      case "Video Generation":
        return "from-red-500 to-pink-600";
      default:
        return "from-purple-500 to-violet-600";
    }
  };

  const getTagClass = (category: string): string => {
    switch (category) {
      case "Text Generation":
        return "bg-blue-100 text-blue-800";
      case "Image Generation":
        return "bg-green-100 text-green-800";
      case "Audio Transcription":
      case "Audio Generation":
        return "bg-amber-100 text-amber-800";
      case "Video Generation":
        return "bg-red-100 text-red-800";
      default:
        return "bg-purple-100 text-purple-800";
    }
  };

  const getStatusClass = (status: string): string => {
    switch (status) {
      case "RUNNING":
        return "bg-green-100 text-green-800";
      case "PROVISIONING":
      case "STAGING":
        return "bg-yellow-100 text-yellow-800";
      case "TERMINATED":
      case "STOPPING":
      case "STOPPED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Modal actions
  const viewApiEndpoint = (vm: Vm) => {
    selectedVm.value = vm;
    apiEndpoint.value = vm.apiEndpoint ?? null;
    deploymentStatus.value = `VM '${vm.name}' is running.`;
    showDeploymentForm.value = true;
  };

  // Copy to clipboard
  const copyToClipboard = (text: string | null) => {
    if (text) {
      navigator.clipboard.writeText(text).then(
        () => console.log("Copied to clipboard"),
        (err) => console.error("Failed to copy text: ", err),
      );
    }
  };

  // Close deployment form
  const closeDeploymentForm = () => {
    showDeploymentForm.value = false;
    selectedVm.value = null;
    error.value = null;
    deploymentStatus.value = null;
    apiEndpoint.value = null;
  };

  // Computed properties
  const filteredByStatus = computed(() => {
    // Group VMs by status
    const result: Record<string, Vm[]> = {};
    userVms.value.forEach((vm) => {
      if (!result[vm.status]) {
        result[vm.status] = [];
      }
      result[vm.status].push(vm);
    });
    return result;
  });

  // Load user's VMs on component mount
  onMounted(async () => {
    await loadUserVms();
  });
</script>

<template>
  <div class="container max-w-6xl mx-auto px-4 py-2 mt-12 mb-8">
    <h2 class="text-2xl font-semibold mb-6">Your Deployed Models</h2>

    <!-- Loading state -->
    <div
      v-if="isLoading"
      class="flex flex-col items-center justify-center py-16"
    >
      <!-- Loading spinner animation -->
      <div class="relative w-24 h-24 mb-6">
        <!-- Outer spinning circle -->
        <div
          class="absolute inset-0 rounded-full border-4 border-t-crypto-purple-600 border-r-crypto-purple-500 border-b-indigo-400 border-l-crypto-blue-600 animate-spin"
        ></div>

        <!-- Inner spinning circle (opposite direction) -->
        <div
          class="absolute inset-3 rounded-full border-4 border-t-crypto-purple-600 border-b-crypto-teal-400 animate-spin-slow"
        ></div>

        <!-- Center icon -->
        <div class="absolute inset-0 flex items-center justify-center">
          <CloudIcon class="h-8 w-8 text-crypto-blue-500" />
        </div>
      </div>

      <h3 class="text-xl font-medium text-gray-400 mb-2">
        Retrieving your deployed models
      </h3>
      <p class="text-gray-600">
        Please wait while we connect to your infrastructure
      </p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="bg-red-50 rounded-lg p-8 text-center mb-12">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-12 w-12 mx-auto text-red-400 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <h3 class="text-lg font-medium text-red-900 mb-2">
        Failed to load models
      </h3>
      <p class="text-red-600">{{ error }}</p>
      <button
        @click="loadUserVms"
        class="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
      >
        Try Again
      </button>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="userVms.length === 0"
      class="bg-gray-50 rounded-lg p-8 text-center"
    >
      <ServerIcon class="h-12 w-12 mx-auto text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">
        No deployed models found
      </h3>
      <p class="text-gray-600">You haven't deployed any models yet</p>
    </div>

    <!-- Status Navigation -->
    <template v-else>
      <ul
        class="no-scrollbar -mx-8 -mb-4 mt-6 flex list-none items-center justify-start gap-6 overflow-x-auto px-8 text-sm"
      >
        <li v-for="(vms, status) in filteredByStatus" :key="status">
          <div class="flex items-center gap-2 px-1 pb-3 text-sm">
            <span
              :class="{
                'px-2 py-1 rounded text-xs font-semibold': true,
                'bg-green-100 text-green-800': status === 'RUNNING',
                'bg-yellow-100 text-yellow-800':
                  status === 'PROVISIONING' || status === 'STAGING',
                'bg-red-100 text-red-800':
                  status === 'TERMINATED' ||
                  status === 'STOPPING' ||
                  status === 'STOPPED',
                'bg-gray-100 text-gray-800': ![
                  'RUNNING',
                  'PROVISIONING',
                  'STAGING',
                  'TERMINATED',
                  'STOPPING',
                  'STOPPED',
                ].includes(status),
              }"
            >
              {{ status }}: {{ vms.length }}
            </span>
          </div>
        </li>
      </ul>

      <!-- Deployed Models Grid -->
      <div
        v-for="(vms, status) in filteredByStatus"
        :key="status"
        class="mb-12 mt-8"
      >
        <h3 class="text-xl font-semibold mb-4">{{ status }}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="vm in vms"
            :key="vm.id"
            class="bg-[#1b2931] rounded-2xl shadow-sm overflow-hidden border-2 border-[ADBFD1] transition-all duration-300 hover:shadow-neon hover:scale-[1.02] group hover:shadow-crypto-blue-500 shadow-crypto-blue-500/50"
          >
            <!-- Card Header with Image -->
            <div class="relative h-40 overflow-hidden">
              <img
                v-if="vm.modelDetails?.imageUrl"
                :src="vm.modelDetails.imageUrl"
                :alt="vm.name"
                class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center bg-gradient-to-br"
                :class="
                  getGradientClass(vm.modelDetails?.category || 'AI Model')
                "
              >
                <ServerIcon class="h-12 w-12 text-white opacity-50" />
              </div>

              <!-- Category Tag - Moved to top right for better visibility -->
              <span
                class="absolute top-2 right-2 text-xs font-medium px-3 py-1 rounded-full shadow-sm"
                :class="getTagClass(vm.modelDetails?.category || 'AI Model')"
              >
                {{ vm.modelDetails?.category || "AI Model" }}
              </span>
            </div>

            <!-- Card Content with better spacing and organization -->
            <div class="p-5 flex-grow flex flex-col">
              <!-- Model Info Section -->
              <div class="mb-4">
                <!-- Company and Model Identifier -->
                <div class="flex items-center mb-2">
                  <div
                    class="flex-shrink-0 w-8 h-8 rounded-full mr-3 bg-gradient-to-br flex items-center justify-center"
                    :class="
                      getGradientClass(vm.modelDetails?.category || 'AI Model')
                    "
                  >
                    <MessageSquareIcon
                      v-if="vm.modelDetails?.category === 'Text Generation'"
                      class="size-4 text-white"
                    />
                    <ImageIcon
                      v-else-if="
                        vm.modelDetails?.category === 'Image Generation'
                      "
                      class="size-4 text-white"
                    />
                    <HeadphonesIcon
                      v-else-if="
                        vm.modelDetails?.category === 'Audio Transcription' ||
                        vm.modelDetails?.category === 'Audio Generation'
                      "
                      class="size-4 text-white"
                    />
                    <VideoIcon
                      v-else-if="
                        vm.modelDetails?.category === 'Video Generation'
                      "
                      class="size-4 text-white"
                    />
                    <ServerIcon v-else class="size-4 text-white" />
                  </div>
                  <span class="font-medium text-gray-300">{{
                    vm.labels?.model_name || "Custom Model"
                  }}</span>
                </div>

                <!-- Model Name with better typography -->
                <p class="text-gray-400 text-sm mb-2 font-medium">
                  {{ vm.modelDetails?.company || "Custom" }}
                </p>
              </div>

              <!-- Status Badge - More prominent -->
              <div class="mb-4">
                <span
                  class="inline-block text-xs px-3 py-1 rounded-md font-medium"
                  :class="getStatusClass(vm.status)"
                >
                  {{ vm.status }}
                </span>
              </div>

              <!-- Spacer to push footer to bottom -->
              <div class="flex-grow"></div>

              <!-- Card Footer with clearer separation -->
              <div
                class="flex items-center justify-between text-xs pt-3 border-t border-gray-700"
              >
                <!-- Creation Date -->
                <div class="flex items-center text-gray-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>{{ formatDate(vm.creationTimestamp) }}</span>
                </div>

                <!-- Action Button - More prominent -->
                <button
                  v-if="vm.status === 'RUNNING'"
                  @click="viewApiEndpoint(vm)"
                  class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
                >
                  View API
                </button>
                <button
                  v-else
                  class="bg-gray-600 text-gray-300 px-3 py-1.5 rounded-md text-xs font-medium cursor-not-allowed opacity-50"
                  disabled
                >
                  Not Available
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- API Endpoint Modal -->
    <div
      v-if="showDeploymentForm"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold">
            {{ selectedVm?.name }}
          </h2>
          <button
            @click="closeDeploymentForm"
            class="text-gray-400 hover:text-gray-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- Status and Error Messages -->
        <div
          v-if="error"
          class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
        >
          {{ error }}
        </div>

        <div class="bg-gray-100 p-4 rounded-md mb-4">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p class="text-sm text-gray-500">Model</p>
              <p class="font-medium">
                {{ selectedVm?.labels?.model_name || "Custom Model" }}
              </p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Status</p>
              <p class="font-medium">{{ selectedVm?.status }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Region</p>
              <p class="font-medium">{{ selectedVm?.zone }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Created</p>
              <p class="font-medium">
                {{ formatDate(selectedVm?.creationTimestamp || "") }}
              </p>
            </div>
          </div>
        </div>

        <div v-if="deploymentStatus" @click="copyToClipboard(apiEndpoint)">
          <p><strong>Status:</strong> {{ deploymentStatus }}</p>
          <div v-if="apiEndpoint" class="mt-4">
            <p class="mb-2"><strong>API Endpoint:</strong></p>
            <div class="bg-gray-100 p-3 rounded-md font-mono text-sm break-all">
              {{ apiEndpoint }}
            </div>
            <div class="mt-3 flex gap-2">
              <button
                @click="copyToClipboard(apiEndpoint)"
                class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded"
              >
                Copy to Clipboard
              </button>
              <a
                :href="apiEndpoint"
                target="_blank"
                rel="noopener noreferrer"
                class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded flex items-center"
              >
                <span>Open API</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 ml-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div class="flex justify-end mt-6">
          <button
            @click="closeDeploymentForm"
            class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Hide scrollbar for Chrome, Safari and Opera */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }

  /* Hide scrollbar for IE, Edge and Firefox */
  .no-scrollbar {
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
  }

  /* Animation for slower spinning (for inner circle) */
  @keyframes spin-slow {
    to {
      transform: rotate(-360deg);
    }
  }

  .animate-spin-slow {
    animation: spin-slow 4s linear infinite;
  }
</style>
