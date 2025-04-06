<script setup lang="ts">
  import {
    Wand2Icon,
    MessageSquareIcon,
    ImageIcon,
    HeadphonesIcon,
    VideoIcon,
    ServerIcon,
    CloudIcon,
    TrashIcon,
    AlertTriangleIcon,
    PlayIcon,
    StopCircleIcon,
    PowerIcon,
    LoaderIcon,
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

  // Delete confirmation state
  const showDeleteConfirmation = ref(false);
  const vmToDelete = ref<Vm | null>(null);
  const isDeleting = ref(false);
  const deleteError = ref<string | null>(null);
  const deleteSuccess = ref<string | null>(null);

  // Start/Stop state
  const isStartingVm = ref<{ [key: string]: boolean }>({});
  const isStoppingVm = ref<{ [key: string]: boolean }>({});
  const vmActionError = ref<{ [key: string]: string }>({});

  // Polling timers
  const pollingTimers = ref<{ [key: string]: number }>({});

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

  // Function to check a specific VM's status
  const checkVmStatus = async (vm: Vm) => {
    try {
      console.log(`Polling status for VM ${vm.name}...`);
      const response = await apiCaller.vm.checkVmStatus.query({
        vmName: vm.name,
        zone: vm.zone,
      });

      console.log(`VM ${vm.name} current status:`, response.status);

      // Update VM status in the local state
      const vmIndex = userVms.value.findIndex((v) => v.id === vm.id);
      if (vmIndex !== -1) {
        // Only update the status if it's a valid GCP status
        if (
          [
            "PROVISIONING",
            "STAGING",
            "RUNNING",
            "STOPPING",
            "TERMINATED",
            "SUSPENDED",
            "REPAIRING",
          ].includes(response.status)
        ) {
          const oldStatus = userVms.value[vmIndex].status;
          userVms.value[vmIndex].status = response.status;
          console.log(
            `VM ${vm.name} status updated: ${oldStatus} -> ${response.status}`,
          );
        }

        // Clear loading states if we've reached a terminal state
        if (response.status === "RUNNING") {
          isStartingVm.value[vm.id] = false;
        } else if (response.status === "TERMINATED") {
          isStoppingVm.value[vm.id] = false;
        }

        // IMPORTANT: Always continue polling for VM status until we reach a terminal state
        // This is the key fix to ensure we don't stop polling too early
        if (response.status === "RUNNING" || response.status === "TERMINATED") {
          console.log(
            `VM ${vm.name} reached final state: ${response.status}, stopping polling`,
          );
          clearTimeout(pollingTimers.value[vm.id]);
          delete pollingTimers.value[vm.id];
        } else {
          console.log(
            `VM ${vm.name} still in transition (${response.status}), continuing polling...`,
          );
          // Continue polling until we reach a final state
          pollingTimers.value[vm.id] = setTimeout(() => {
            checkVmStatus(vm);
          }, 5000) as unknown as number;
        }
      }
    } catch (err) {
      console.error(`Error checking status for VM ${vm.name}:`, err);
      // Log error but DON'T stop polling - try again after a delay
      console.log(`Will retry polling for VM ${vm.name} after error`);
      pollingTimers.value[vm.id] = setTimeout(() => {
        checkVmStatus(vm);
      }, 8000) as unknown as number; // Longer delay after error
    }
  };

  // Start VM function
  const startVm = async (vm: Vm) => {
    try {
      // Set starting state for this VM
      isStartingVm.value[vm.id] = true;
      vmActionError.value[vm.id] = "";

      await apiCaller.vm.startVm.mutate({
        vmName: vm.name,
        zone: vm.zone,
      });

      console.log(`Start operation initiated for VM ${vm.name}`);

      // Update the VM status locally to show the transition
      const vmIndex = userVms.value.findIndex((v) => v.id === vm.id);
      if (vmIndex !== -1) {
        userVms.value[vmIndex].status = "PROVISIONING"; // Set to provisioning as a transition state
      }

      // Clear any existing polling timer for this VM
      if (pollingTimers.value[vm.id]) {
        clearTimeout(pollingTimers.value[vm.id]);
      }

      // Start polling for status updates - keep polling until we reach RUNNING
      console.log(`Starting polling for VM ${vm.name} after start operation`);
      pollingTimers.value[vm.id] = setTimeout(() => {
        checkVmStatus(vm);
      }, 2000) as unknown as number;
    } catch (err) {
      console.error("Error starting VM:", err);
      vmActionError.value[vm.id] = `Error starting VM: ${
        err instanceof Error ? err.message : String(err)
      }`;
      isStartingVm.value[vm.id] = false;
    }
  };

  // Stop VM function
  const stopVm = async (vm: Vm) => {
    try {
      // Set stopping state for this VM
      isStoppingVm.value[vm.id] = true;
      vmActionError.value[vm.id] = "";

      await apiCaller.vm.stopVm.mutate({
        vmName: vm.name,
        zone: vm.zone,
      });

      console.log(`Stop operation initiated for VM ${vm.name}`);

      // Update the VM status locally to show the transition
      const vmIndex = userVms.value.findIndex((v) => v.id === vm.id);
      if (vmIndex !== -1) {
        userVms.value[vmIndex].status = "STOPPING"; // Set to stopping as a transition state
      }

      // Clear any existing polling timer for this VM
      if (pollingTimers.value[vm.id]) {
        clearTimeout(pollingTimers.value[vm.id]);
      }

      // Start polling for status updates - keep polling until we reach TERMINATED
      console.log(`Starting polling for VM ${vm.name} after stop operation`);
      pollingTimers.value[vm.id] = setTimeout(() => {
        checkVmStatus(vm);
      }, 2000) as unknown as number;
    } catch (err) {
      console.error("Error stopping VM:", err);
      vmActionError.value[vm.id] = `Error stopping VM: ${
        err instanceof Error ? err.message : String(err)
      }`;
      isStoppingVm.value[vm.id] = false;
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

  // Delete VM actions
  const confirmDelete = (vm: Vm) => {
    vmToDelete.value = vm;
    showDeleteConfirmation.value = true;
  };

  const cancelDelete = () => {
    vmToDelete.value = null;
    showDeleteConfirmation.value = false;
    deleteError.value = null;
    deleteSuccess.value = null;
  };

  const executeDelete = async () => {
    if (!vmToDelete.value) return;

    try {
      isDeleting.value = true;
      deleteError.value = null;
      deleteSuccess.value = null;

      await apiCaller.vm.deleteVm.mutate({
        vmName: vmToDelete.value.name,
        zone: vmToDelete.value.zone,
      });

      deleteSuccess.value = `VM '${vmToDelete.value.name}' has been successfully deleted.`;

      // Remove the VM from the list
      userVms.value = userVms.value.filter(
        (vm) => vm.id !== vmToDelete.value?.id,
      );

      // Close after 2 seconds
      setTimeout(() => {
        cancelDelete();
      }, 2000);
    } catch (err) {
      console.error("Error deleting VM:", err);
      deleteError.value = `Error deleting VM: ${
        err instanceof Error ? err.message : String(err)
      }`;
    } finally {
      isDeleting.value = false;
    }
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

  // Clear all polling timers when component is unmounted
  onUnmounted(() => {
    Object.values(pollingTimers.value).forEach((timer) => {
      clearTimeout(timer);
    });
  });

  // Load user's VMs on component mount
  onMounted(async () => {
    await loadUserVms();

    // Start polling for VMs in transitional states
    userVms.value.forEach((vm) => {
      if (["PROVISIONING", "STAGING", "STOPPING"].includes(vm.status)) {
        pollingTimers.value[vm.id] = setTimeout(() => {
          checkVmStatus(vm);
        }, 5000) as unknown as number;
      }
    });
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

      <!-- Refresh Button -->
      <div class="flex justify-end mb-6">
        <button
          @click="loadUserVms"
          class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center"
        >
          <LoaderIcon class="h-4 w-4 mr-2" />
          Refresh Status
        </button>
      </div>

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

                <!-- Display error messages for VM actions if any -->
                <div
                  v-if="vmActionError[vm.id]"
                  class="mt-2 text-xs text-red-500"
                >
                  {{ vmActionError[vm.id] }}
                </div>
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

                <!-- Action Buttons - Depending on VM Status -->
                <div class="flex space-x-2">
                  <!-- View API button for running VMs -->
                  <button
                    v-if="vm.status === 'RUNNING'"
                    @click="viewApiEndpoint(vm)"
                    class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
                  >
                    View API
                  </button>

                  <!-- Stop button for running VMs -->
                  <button
                    v-if="vm.status === 'RUNNING'"
                    @click="stopVm(vm)"
                    :disabled="isStoppingVm[vm.id]"
                    class="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 flex items-center"
                  >
                    <LoaderIcon
                      v-if="isStoppingVm[vm.id]"
                      class="h-3 w-3 mr-1 animate-spin"
                    />
                    <StopCircleIcon v-else class="h-3 w-3 mr-1" />
                    Stop
                  </button>

                  <!-- Start button for terminated VMs -->
                  <button
                    v-if="vm.status === 'TERMINATED'"
                    @click="startVm(vm)"
                    :disabled="isStartingVm[vm.id]"
                    class="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 flex items-center"
                  >
                    <LoaderIcon
                      v-if="isStartingVm[vm.id]"
                      class="h-3 w-3 mr-1 animate-spin"
                    />
                    <PlayIcon v-else class="h-3 w-3 mr-1" />
                    Start
                  </button>

                  <!-- Delete button for terminated VMs -->
                  <button
                    v-if="vm.status === 'TERMINATED'"
                    @click="confirmDelete(vm)"
                    class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 flex items-center"
                  >
                    <TrashIcon class="h-3 w-3 mr-1" />
                    Delete
                  </button>

                  <!-- Status indicator for transitioning states -->
                  <div
                    v-if="
                      ['PROVISIONING', 'STAGING', 'STOPPING'].includes(
                        vm.status,
                      )
                    "
                    class="flex items-center bg-gray-600 text-gray-300 px-3 py-1.5 rounded-md text-xs font-medium"
                  >
                    <LoaderIcon class="h-3 w-3 mr-1 animate-spin" />
                    {{
                      vm.status === "STOPPING" ? "Stopping..." : "Starting..."
                    }}
                  </div>

                  <!-- Not Available button for other states -->
                  <button
                    v-if="
                      ![
                        'RUNNING',
                        'TERMINATED',
                        'PROVISIONING',
                        'STAGING',
                        'STOPPING',
                      ].includes(vm.status)
                    "
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

    <!-- Delete Confirmation Modal -->
    <div
      v-if="showDeleteConfirmation"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div
        class="bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all"
      >
        <div class="text-center mb-5">
          <div
            class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-5"
          >
            <AlertTriangleIcon class="h-8 w-8 text-red-600" />
          </div>

          <h3 class="text-xl font-bold text-gray-900 mb-2">
            Confirm VM Deletion
          </h3>
          <p class="text-gray-600">
            Are you sure you want to permanently delete the VM
            <span class="font-semibold text-gray-900">{{
              vmToDelete?.name
            }}</span
            >?
          </p>
          <p class="text-gray-600 mt-2">
            This action cannot be undone and all associated data will be
            permanently lost.
          </p>
        </div>

        <!-- Status messages -->
        <div
          v-if="deleteError"
          class="mb-5 p-3 bg-red-100 text-red-700 rounded-md"
        >
          <p>{{ deleteError }}</p>
        </div>

        <div
          v-if="deleteSuccess"
          class="mb-5 p-3 bg-green-100 text-green-700 rounded-md"
        >
          <p>{{ deleteSuccess }}</p>
        </div>

        <!-- Action buttons -->
        <div class="flex justify-center gap-4 mt-6">
          <button
            @click="cancelDelete"
            class="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md font-medium transition-colors duration-200"
            :disabled="isDeleting"
          >
            Cancel
          </button>

          <button
            @click="executeDelete"
            class="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors duration-200 flex items-center justify-center"
            :disabled="isDeleting"
          >
            <svg
              v-if="isDeleting"
              class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>{{ isDeleting ? "Deleting..." : "Delete VM" }}</span>
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
