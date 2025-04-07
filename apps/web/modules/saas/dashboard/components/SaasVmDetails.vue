<script setup lang="ts">
  import {
    ArrowLeftIcon,
    ServerIcon,
    PowerIcon,
    StopCircleIcon,
    PlayIcon,
    LoaderIcon,
    ClipboardCopyIcon,
    ExternalLinkIcon,
    TerminalIcon,
    ActivityIcon,
    RefreshCwIcon,
  } from "lucide-vue-next";
  import { ref, onMounted, computed } from "vue";

  const props = defineProps<{
    vmId: string;
    onBack: () => void;
  }>();

  const emit = defineEmits(["back"]);

  // API Caller and User
  const { apiCaller } = useApiCaller();
  const { currentTeam } = useUser();

  // VM data and loading state
  const vm = ref<any>(null);
  const isLoading = ref(true);
  const error = ref<string | null>(null);

  // VM action states
  const isStartingVm = ref(false);
  const isStoppingVm = ref(false);
  const vmActionError = ref<string | null>(null);
  const copySuccess = ref(false);

  // VM status polling
  const isPolling = ref(false);
  const pollingInterval = ref<number | null>(null);

  // Tabs for different sections
  const activeTab = ref("overview");
  const tabs = [
    { id: "overview", label: "Overview", icon: ServerIcon },
    { id: "logs", label: "Logs", icon: TerminalIcon },
    { id: "performance", label: "Performance", icon: ActivityIcon },
  ];

  // Load VM details
  const loadVmDetails = async () => {
    try {
      isLoading.value = true;
      error.value = null;

      // This is a mock of what your API call might look like
      // Replace with your actual API call
      const response = await apiCaller.vm.getVmDetails.query({
        vmId: props.vmId,
      });

      // Enrich VM with additional details
      vm.value = {
        ...response,
        modelDetails: {
          category: getCategoryFromModelName(response.labels?.model_name || ""),
          company: getCompanyFromModelName(response.labels?.model_name || ""),
          description:
            "A deployed AI model instance running on your infrastructure.",
          tags: ["Deployed", response.status, response.zone.split("-")[0]],
        },
        specs: {
          cpu: response.machineType?.split("-").pop() || "4",
          memory: `${response.memoryMb || 16} GB`,
          storage: `${response.diskSizeGb || 100} GB SSD`,
          accelerator: response.acceleratorType || "None",
        },
      };

      // Start polling if VM is in a transitional state
      if (["PROVISIONING", "STAGING", "STOPPING"].includes(vm.value.status)) {
        startPolling();
      }
    } catch (err) {
      console.error("Error loading VM details:", err);
      error.value = `Error loading VM details: ${
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

  // Helper function to format dates
  const formatDate = (timestamp: string | number | Date) => {
    if (!timestamp) return "Unknown";
    return new Date(timestamp).toLocaleString();
  };

  // Helper functions for UI
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

  // VM status polling
  const startPolling = () => {
    if (isPolling.value) return;

    isPolling.value = true;

    // Poll every 5 seconds
    pollingInterval.value = window.setInterval(async () => {
      try {
        // Replace with your actual status check API call
        const response = await apiCaller.vm.checkVmStatus.query({
          vmName: vm.value.name,
          zone: vm.value.zone,
        });

        // Update the VM status
        vm.value.status = response.status;

        // If we've reached a final state, stop polling
        if (["RUNNING", "TERMINATED"].includes(response.status)) {
          stopPolling();

          // Clear the action flags
          isStartingVm.value = false;
          isStoppingVm.value = false;
        }
      } catch (error) {
        console.error(`Error polling VM status:`, error);
      }
    }, 5000);
  };

  const stopPolling = () => {
    if (pollingInterval.value) {
      clearInterval(pollingInterval.value);
      pollingInterval.value = null;
    }
    isPolling.value = false;
  };

  // VM actions
  const startVm = async () => {
    try {
      isStartingVm.value = true;
      vmActionError.value = null;

      // Replace with your actual start VM API call
      await apiCaller.vm.startVm.mutate({
        vmName: vm.value.name,
        zone: vm.value.zone,
      });

      // Update VM status
      vm.value.status = "PROVISIONING";

      // Start polling
      startPolling();
    } catch (err) {
      console.error(`Error starting VM:`, err);
      vmActionError.value = `Error starting VM: ${
        err instanceof Error ? err.message : String(err)
      }`;
      isStartingVm.value = false;
    }
  };

  const stopVm = async () => {
    try {
      isStoppingVm.value = true;
      vmActionError.value = null;

      // Replace with your actual stop VM API call
      await apiCaller.vm.stopVm.mutate({
        vmName: vm.value.name,
        zone: vm.value.zone,
      });

      // Update VM status
      vm.value.status = "STOPPING";

      // Start polling
      startPolling();
    } catch (err) {
      console.error(`Error stopping VM:`, err);
      vmActionError.value = `Error stopping VM: ${
        err instanceof Error ? err.message : String(err)
      }`;
      isStoppingVm.value = false;
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    if (text) {
      navigator.clipboard.writeText(text).then(
        () => {
          copySuccess.value = true;
          setTimeout(() => {
            copySuccess.value = false;
          }, 2000);
        },
        (err) => console.error("Failed to copy text: ", err),
      );
    }
  };

  // Get VM logs (mock function - replace with actual implementation)
  const vmLogs = computed(() => {
    if (!vm.value || vm.value.status !== "RUNNING") {
      return ["VM is not running. Start the VM to view logs."];
    }

    return [
      "[2025-04-06 08:12:34] VM started successfully",
      "[2025-04-06 08:12:35] Loading model into memory...",
      "[2025-04-06 08:13:22] Model loaded successfully",
      "[2025-04-06 08:13:23] API server started on port 8080",
      "[2025-04-06 08:13:24] Ready to accept requests",
    ];
  });

  // Get VM performance data (mock function - replace with actual implementation)
  const performanceData = computed(() => {
    if (!vm.value || vm.value.status !== "RUNNING") {
      return null;
    }

    return {
      cpu: "42%",
      memory: "8.2 GB / 16 GB",
      disk: "34 GB / 100 GB",
      network: {
        in: "1.2 MB/s",
        out: "3.4 MB/s",
      },
      requests: {
        total: 1247,
        rate: "12/min",
        avgLatency: "218ms",
      },
    };
  });

  // Clean up on component unmount
  const onUnmounted = () => {
    stopPolling();
  };

  // Initial load
  onMounted(() => {
    loadVmDetails();
  });
</script>

<template>
  <div class="space-y-6">
    <!-- Back button and refresh -->
    <div class="flex justify-between items-center">
      <button
        @click="$emit('back')"
        class="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeftIcon class="h-4 w-4 mr-1" />
        Back to Deployed Models
      </button>

      <button
        @click="loadVmDetails"
        class="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900"
        :disabled="isLoading"
      >
        <RefreshCwIcon
          class="h-4 w-4 mr-1"
          :class="{ 'animate-spin': isLoading }"
        />
        Refresh
      </button>
    </div>

    <!-- Loading state -->
    <div
      v-if="isLoading && !vm"
      class="flex flex-col items-center justify-center py-16"
    >
      <div class="relative w-16 h-16 mb-4">
        <div
          class="absolute inset-0 rounded-full border-4 border-t-crypto-purple-600 border-r-crypto-purple-500 border-b-indigo-400 border-l-crypto-blue-600 animate-spin"
        ></div>
      </div>
      <p class="text-gray-600">Loading VM details...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="bg-red-50 rounded-lg p-8 text-center">
      <div
        class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6 text-red-600"
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
      </div>
      <h3 class="text-lg font-medium text-red-900 mb-2">
        Failed to load VM details
      </h3>
      <p class="text-red-600">{{ error }}</p>
      <button
        @click="loadVmDetails"
        class="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
      >
        Try Again
      </button>
    </div>

    <!-- VM details -->
    <div v-else-if="vm" class="space-y-6">
      <!-- Header section with VM name and status -->
      <div
        class="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-gray-200 pb-4"
      >
        <div>
          <h1 class="text-2xl font-semibold flex items-center gap-2">
            <ServerIcon class="h-6 w-6 text-indigo-600" />
            {{ vm.name }}
          </h1>
          <p class="text-gray-500">
            {{ vm.labels?.model_name || "Custom Model" }}
          </p>
        </div>

        <div class="flex flex-col md:items-end gap-2">
          <span
            class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
            :class="getStatusClass(vm.status)"
          >
            <span v-if="isStartingVm || isStoppingVm || isPolling" class="mr-2">
              <LoaderIcon class="h-3 w-3 animate-spin" />
            </span>
            {{ vm.status }}
          </span>

          <div class="flex gap-2">
            <!-- Start button for terminated VMs -->
            <button
              v-if="vm.status === 'TERMINATED'"
              @click="startVm"
              :disabled="isStartingVm"
              class="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 flex items-center"
            >
              <LoaderIcon
                v-if="isStartingVm"
                class="h-3 w-3 mr-1 animate-spin"
              />
              <PlayIcon v-else class="h-3 w-3 mr-1" />
              Start VM
            </button>

            <!-- Stop button for running VMs -->
            <button
              v-if="vm.status === 'RUNNING'"
              @click="stopVm"
              :disabled="isStoppingVm"
              class="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 flex items-center"
            >
              <LoaderIcon
                v-if="isStoppingVm"
                class="h-3 w-3 mr-1 animate-spin"
              />
              <StopCircleIcon v-else class="h-3 w-3 mr-1" />
              Stop VM
            </button>
          </div>

          <!-- Action error -->
          <div v-if="vmActionError" class="text-xs text-red-500">
            {{ vmActionError }}
          </div>
        </div>
      </div>

      <!-- Tabs for different sections -->
      <div>
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center"
              :class="{
                'border-indigo-500 text-indigo-600': activeTab === tab.id,
                'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300':
                  activeTab !== tab.id,
              }"
            >
              <component :is="tab.icon" class="h-4 w-4 mr-2" />
              {{ tab.label }}
            </button>
          </nav>
        </div>
      </div>

      <!-- Tab content -->
      <div>
        <!-- Overview Tab -->
        <div v-if="activeTab === 'overview'" class="space-y-6">
          <!-- General Information -->
          <div class="bg-white shadow rounded-lg p-6">
            <h2 class="text-lg font-medium mb-4">General Information</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p class="text-sm text-gray-500">Model Name</p>
                <p class="font-medium">
                  {{ vm.labels?.model_name || "Custom Model" }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Company</p>
                <p class="font-medium">
                  {{ vm.modelDetails?.company || "Custom" }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Category</p>
                <p class="font-medium">
                  {{ vm.modelDetails?.category || "AI Model" }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Created</p>
                <p class="font-medium">
                  {{ formatDate(vm.creationTimestamp) }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Region/Zone</p>
                <p class="font-medium">{{ vm.zone }}</p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Last Status Change</p>
                <p class="font-medium">
                  {{ formatDate(vm.lastStatusUpdate || vm.creationTimestamp) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Hardware Specifications -->
          <div class="bg-white shadow rounded-lg p-6">
            <h2 class="text-lg font-medium mb-4">Hardware Specifications</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p class="text-sm text-gray-500">CPU</p>
                <p class="font-medium">{{ vm.specs?.cpu }} vCPUs</p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Memory</p>
                <p class="font-medium">{{ vm.specs?.memory }}</p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Storage</p>
                <p class="font-medium">{{ vm.specs?.storage }}</p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Accelerator</p>
                <p class="font-medium">{{ vm.specs?.accelerator }}</p>
              </div>
            </div>
          </div>

          <!-- API Endpoint (only if VM is running) -->
        </div>

        <!-- Logs Tab -->
        <div v-else-if="activeTab === 'logs'" class="space-y-6">
          <div class="bg-white shadow rounded-lg p-6">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-lg font-medium">VM Logs</h2>
              <button
                class="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
                @click="loadVmDetails"
              >
                <RefreshCwIcon class="h-4 w-4 mr-1" />
                Refresh Logs
              </button>
            </div>

            <div
              class="bg-gray-900 text-gray-300 p-4 rounded-md font-mono text-sm h-96 overflow-y-auto"
            >
              <p v-for="(log, index) in vmLogs" :key="index" class="my-1">
                {{ log }}
              </p>
            </div>
          </div>
        </div>

        <!-- Performance Tab -->
        <div v-else-if="activeTab === 'performance'" class="space-y-6">
          <div
            v-if="vm.status !== 'RUNNING'"
            class="bg-white shadow rounded-lg p-6 text-center"
          >
            <p class="text-gray-500">
              VM is not running. Start the VM to view performance metrics.
            </p>
            <button
              v-if="vm.status === 'TERMINATED'"
              @click="startVm"
              :disabled="isStartingVm"
              class="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <LoaderIcon
                v-if="isStartingVm"
                class="h-4 w-4 mr-1 animate-spin"
              />
              <PlayIcon v-else class="h-4 w-4 mr-1" />
              Start VM
            </button>
          </div>

          <template v-else-if="performanceData">
            <!-- Resource Usage -->
            <div class="bg-white shadow rounded-lg p-6">
              <h2 class="text-lg font-medium mb-4">Resource Usage</h2>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p class="text-sm text-gray-500 mb-1">CPU Usage</p>
                  <p class="font-medium text-lg">{{ performanceData.cpu }}</p>
                  <div class="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                    <div
                      class="bg-blue-600 h-2.5 rounded-full"
                      :style="{ width: performanceData.cpu }"
                    ></div>
                  </div>
                </div>
                <div>
                  <p class="text-sm text-gray-500 mb-1">Memory Usage</p>
                  <p class="font-medium text-lg">
                    {{ performanceData.memory }}
                  </p>
                  <div class="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                    <div
                      class="bg-purple-600 h-2.5 rounded-full"
                      style="width: 51%"
                    ></div>
                  </div>
                </div>
                <div>
                  <p class="text-sm text-gray-500 mb-1">Disk Usage</p>
                  <p class="font-medium text-lg">{{ performanceData.disk }}</p>
                  <div class="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                    <div
                      class="bg-green-600 h-2.5 rounded-full"
                      style="width: 34%"
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Network Traffic -->
            <div class="bg-white shadow rounded-lg p-6">
              <h2 class="text-lg font-medium mb-4">Network Traffic</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p class="text-sm text-gray-500">Inbound</p>
                  <p class="font-medium text-lg">
                    {{ performanceData.network.in }}
                  </p>
                </div>
                <div>
                  <p class="text-sm text-gray-500">Outbound</p>
                  <p class="font-medium text-lg">
                    {{ performanceData.network.out }}
                  </p>
                </div>
              </div>
            </div>

            <!-- API Requests -->
            <div class="bg-white shadow rounded-lg p-6">
              <h2 class="text-lg font-medium mb-4">API Requests</h2>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p class="text-sm text-gray-500">Total Requests</p>
                  <p class="font-medium text-lg">
                    {{ performanceData.requests.total }}
                  </p>
                </div>
                <div>
                  <p class="text-sm text-gray-500">Request Rate</p>
                  <p class="font-medium text-lg">
                    {{ performanceData.requests.rate }}
                  </p>
                </div>
                <div>
                  <p class="text-sm text-gray-500">Average Latency</p>
                  <p class="font-medium text-lg">
                    {{ performanceData.requests.avgLatency }}
                  </p>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .shadow-neon {
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
  }
</style>
