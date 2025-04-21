<script setup lang="ts">
  import {
    Wand2Icon,
    MessageSquareIcon,
    ImageIcon,
    HeadphonesIcon,
    VideoIcon,
    InfoIcon,
    ServerIcon,
    CodeIcon,
    TagIcon,
    CalendarIcon,
    BuildingIcon,
    CpuIcon,
    ChevronLeftIcon,
  } from "lucide-vue-next";
  import { ref, computed, onMounted } from "vue";

  const route = useRoute();
  const router = useRouter();
  const { apiCaller } = useApiCaller();
  const { currentTeam } = useUser();

  definePageMeta({
    layout: "saas-app",
  });

  // Define model interface
  interface Model {
    id: number;
    name: string;
    model: string;
    company: string;
    category: string;
    description: string;
    tags: string[];
    updated: string;
    imageUrl?: string;
    fullDescription?: string;
    capabilities?: string[];
    requirements?: {
      minCpu: number;
      recommendedCpu: number;
      minMemory: number;
      recommendedMemory: number;
      gpuRequired: boolean;
      recommendedGpu?: string;
    };
    useCases?: string[];
    versions?: {
      version: string;
      releaseDate: string;
      changes: string[];
    }[];
  }

  const isLoading = ref(true);
  const error = ref<string | null>(null);
  const modelId = computed(() => route.params.id as string);
  const model = ref<Model | null>(null);

  // Deployment state
  const showDeploymentForm = ref(false);
  const deploymentConfig = ref({
    modelName: "",
    cpuCount: 4,
    memoryGB: 16,
    gpuType: "",
    gpuCount: 1,
    region: "us-central1",
    teamId: currentTeam.value?.id,
    apiKeyId: null as string | null,
  });
  const isDeploying = ref(false);
  const deploymentError = ref<string | null>(null);
  const deploymentStatus = ref<string | null>(null);
  const vmName = ref<string | null>(null);
  const apiEndpoint = ref<string | null>(null);
  const isDeploymentReady = ref(false);

  // API keys state
  const apiKeys = ref<any[]>([]);
  const isLoadingApiKeys = ref(false);

  // Load API keys
  const loadApiKeys = async () => {
    isLoadingApiKeys.value = true;
    try {
      const result = await apiCaller.team.listApiKeys.query({
        type: "ALL",
        teamId: currentTeam.value?.id,
      });
      apiKeys.value = result;
      // Set default selected API key if available
      if (result.length > 0) {
        deploymentConfig.value.apiKeyId = result[0].id;
      }
    } catch (error: any) {
      console.error("Error loading API keys:", error);
    } finally {
      isLoadingApiKeys.value = false;
    }
  };

  // Load the model details
  const loadModel = async () => {
    try {
      isLoading.value = true;
      error.value = null;

      // Fetch the model from the API
      const result = await apiCaller.vm.listAvailableModels.query({});

      // Find the model with the matching ID
      const foundModel = result.find((m) => m.id.toString() === modelId.value);

      if (!foundModel) {
        error.value = "Model not found";
        return;
      }

      // In a real API, we would fetch detailed model info from a dedicated endpoint
      // For now, we'll enhance the basic model data with some mock detailed info
      model.value = {
        ...foundModel,
        fullDescription:
          foundModel.description +
          " This model represents cutting-edge AI technology designed to deliver exceptional performance across a wide range of use cases. It has been optimized for deployment in production environments and offers a balance of speed and accuracy.",
        capabilities: [
          "Advanced contextual understanding",
          "State-of-the-art text generation",
          "Robust knowledge base across multiple domains",
          "Excellent code generation capabilities",
          "Complex reasoning and problem-solving",
        ],
        requirements: {
          minCpu: 2,
          recommendedCpu: 4,
          minMemory: 8,
          recommendedMemory: 16,
          gpuRequired:
            foundModel.category === "Image Generation" ||
            foundModel.category === "Video Generation",
          recommendedGpu:
            foundModel.category === "Image Generation" ||
            foundModel.category === "Video Generation"
              ? "nvidia-tesla-t4"
              : undefined,
        },
        useCases: [
          "Enterprise chatbots",
          "Content creation assistance",
          "Research and analysis",
          "Data processing and summarization",
          "Creative writing and ideation",
        ],
        versions: [
          {
            version: "1.0",
            releaseDate: "2023-05-15",
            changes: ["Initial release"],
          },
          {
            version: "1.1",
            releaseDate: "2023-08-01",
            changes: [
              "Improved context handling",
              "Better response coherence",
              "Enhanced reasoning capabilities",
            ],
          },
          {
            version: "1.2",
            releaseDate: "2024-01-10",
            changes: [
              "Optimization for faster inference",
              "Reduced memory footprint",
              "Context window expansion",
            ],
          },
        ],
      };

      // Set deployment defaults based on model requirements
      if (model.value?.requirements) {
        deploymentConfig.value.cpuCount =
          model.value.requirements.recommendedCpu;
        deploymentConfig.value.memoryGB =
          model.value.requirements.recommendedMemory;
        if (
          model.value.requirements.gpuRequired &&
          model.value.requirements.recommendedGpu
        ) {
          deploymentConfig.value.gpuType =
            model.value.requirements.recommendedGpu;
          deploymentConfig.value.gpuCount = 1;
        } else {
          deploymentConfig.value.gpuType = "";
        }
      }

      // Set model name for deployment
      deploymentConfig.value.modelName = model.value.model;
    } catch (err) {
      console.error("Error loading model:", err);
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      isLoading.value = false;
    }
  };

  // Function to format dates
  const formatDate = (timestamp: string | number | Date) => {
    if (!timestamp) return "Unknown";
    return new Date(timestamp).toLocaleString();
  };

  // Open deployment form
  const openDeploymentForm = async () => {
    if (!model.value) return;

    showDeploymentForm.value = true;

    // Load API keys when opening the form if not already loaded
    if (apiKeys.value.length === 0) {
      await loadApiKeys();
    }

    // Set initial API key if available
    if (apiKeys.value.length > 0 && !deploymentConfig.value.apiKeyId) {
      deploymentConfig.value.apiKeyId = apiKeys.value[0].id;
    }
  };

  // Close deployment form
  const closeDeploymentForm = () => {
    showDeploymentForm.value = false;
    deploymentError.value = null;
    deploymentStatus.value = null;
    apiEndpoint.value = null;
    // Reset API key ID
    deploymentConfig.value.apiKeyId = null;
  };

  // Deploy the model
  const deployModel = async () => {
    try {
      deploymentError.value = null;

      // Validate API key selection
      if (!deploymentConfig.value.apiKeyId) {
        deploymentError.value =
          "Please select an API key for VM authentication";
        return;
      }

      isDeploying.value = true;

      // Call the API endpoint using apiCaller
      const result = await apiCaller.vm.createVm.mutate({
        modelName: deploymentConfig.value.modelName,
        cpuCount: Number(deploymentConfig.value.cpuCount),
        memoryGB: Number(deploymentConfig.value.memoryGB),
        gpuType: deploymentConfig.value.gpuType || undefined,
        gpuCount: deploymentConfig.value.gpuType
          ? Number(deploymentConfig.value.gpuCount)
          : undefined,
        region: deploymentConfig.value.region,
        teamId: currentTeam.value?.id || "1",
        apiKeyId: deploymentConfig.value.apiKeyId, // Pass the selected API key ID
      });

      vmName.value = result.vmName;
      deploymentStatus.value = `VM "${result.vmName}" creation initiated. This may take a few minutes.`;

      // Start checking the status periodically
      setTimeout(checkStatus, 30000); // Check after 30 seconds
    } catch (err) {
      deploymentError.value = `Error: ${
        err instanceof Error ? err.message : String(err)
      }`;
    } finally {
      isDeploying.value = false;
    }
  };

  // Function to check VM deployment status
  const checkStatus = async () => {
    try {
      if (!vmName.value) return;

      deploymentStatus.value = "Checking VM status...";

      // Use apiCaller to check status
      const result = await apiCaller.vm.checkVmStatus.query({
        vmName: vmName.value,
        zone: deploymentConfig.value.region,
      });

      if (result.isReady) {
        deploymentStatus.value = `Deployment complete! VM is running.`;
        apiEndpoint.value = result.apiEndpoint;
        isDeploymentReady.value = true;
      } else {
        deploymentStatus.value = `VM status: ${result.vmStatus}. Not ready yet.`;

        // Check again after 30 seconds
        setTimeout(checkStatus, 30000);
      }
    } catch (err) {
      deploymentError.value = `Error checking status: ${
        err instanceof Error ? err.message : String(err)
      }`;
    }
  };

  // Utility functions
  const getGradientClass = (category: string): string => {
    switch (category) {
      case "Text Generation":
        return "from-blue-500 to-indigo-600";
      case "Image Generation":
        return "from-green-500 to-teal-600";
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
      case "Audio Generation":
        return "bg-amber-100 text-amber-800";
      case "Video Generation":
        return "bg-red-100 text-red-800";
      default:
        return "bg-purple-100 text-purple-800";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Text Generation":
        return MessageSquareIcon;
      case "Image Generation":
        return ImageIcon;
      case "Audio Generation":
        return HeadphonesIcon;
      case "Video Generation":
        return VideoIcon;
      default:
        return Wand2Icon;
    }
  };

  // Load model on component mount
  onMounted(() => {
    loadModel();
  });
</script>

<template>
  <div class="container max-w-6xl py-8">
    <!-- Back button and header -->
    <div class="flex items-center mb-6">
      <button
        @click="router.push('/app/model-library')"
        class="flex items-center text-gray-400 hover:text-gray-200 transition-colors mr-4"
      >
        <ChevronLeftIcon class="h-5 w-5 mr-1" />
        <span>Back to Library</span>
      </button>
      <SaasPageHeader class="mb-0">
        <template #title>Model Details</template>
        <template #subtitle
          >Explore and deploy AI models for your team</template
        >
      </SaasPageHeader>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="bg-card rounded-lg border p-8 text-foreground">
      <div class="flex flex-col gap-4 items-center justify-center py-12">
        <svg
          class="animate-spin h-12 w-12 text-primary"
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
        <p class="text-xl font-medium">Loading model information...</p>
      </div>
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      class="bg-destructive/10 rounded-lg border border-destructive p-8 text-foreground"
    >
      <div class="flex flex-col gap-4 items-center justify-center py-12">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-12 w-12 text-destructive"
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
        <p class="text-xl font-medium text-destructive">{{ error }}</p>
        <button
          @click="loadModel"
          class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>

    <!-- Model details content -->
    <div v-else-if="model" class="space-y-6">
      <!-- Hero section with model banner -->
      <div
        class="relative overflow-hidden h-64 bg-gradient-to-br rounded-t-lg border border-b-0"
        :class="getGradientClass(model.category)"
      >
        <img
          v-if="model.imageUrl"
          :src="model.imageUrl"
          class="w-full h-full object-cover opacity-30"
        />
        <div class="absolute inset-0 flex flex-col justify-center p-8">
          <span
            class="inline-flex items-center rounded-full px-3 py-0.5 text-sm font-medium shadow-sm mb-4 w-48"
            :class="getTagClass(model.category)"
          >
            <component
              :is="getCategoryIcon(model.category)"
              class="h-4 w-4 mr-1"
            />
            {{ model.category }}
          </span>
          <h1 class="text-4xl font-bold text-white mb-2">{{ model.name }}</h1>
          <div class="flex items-center text-white/80">
            <BuildingIcon class="h-4 w-4 mr-1" />
            <span class="mr-4">{{ model.company }}</span>
            <CalendarIcon class="h-4 w-4 mr-1" />
            <span>Updated: {{ formatDate(model.updated) }}</span>
          </div>
        </div>
      </div>

      <!-- Main content area -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left column - Main info -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Overview card -->
          <div class="bg-card rounded-lg border p-6 text-foreground">
            <h2 class="text-2xl font-semibold mb-4 flex items-center">
              <InfoIcon class="h-5 w-5 mr-2" />
              Overview
            </h2>
            <p class="text-foreground/80 whitespace-pre-line mb-6">
              {{ model.fullDescription }}
            </p>

            <!-- Tags -->
            <div class="flex flex-wrap gap-2 mb-4">
              <div class="flex items-center text-sm font-medium mr-2">
                <TagIcon class="h-4 w-4 mr-1" />
                Tags:
              </div>
              <span
                v-for="(tag, index) in model.tags"
                :key="index"
                class="text-xs bg-muted px-2 py-1 rounded"
              >
                {{ tag }}
              </span>
            </div>
          </div>

          <!-- Capabilities card -->
          <div class="bg-card rounded-lg border p-6 text-foreground">
            <h2 class="text-2xl font-semibold mb-4 flex items-center">
              <Wand2Icon class="h-5 w-5 mr-2" />
              Capabilities
            </h2>
            <ul class="list-disc pl-6 space-y-2">
              <li
                v-for="(capability, index) in model.capabilities"
                :key="index"
                class="text-foreground/80"
              >
                {{ capability }}
              </li>
            </ul>
          </div>

          <!-- Use Cases card -->
          <div class="bg-card rounded-lg border p-6 text-foreground">
            <h2 class="text-2xl font-semibold mb-4 flex items-center">
              <CodeIcon class="h-5 w-5 mr-2" />
              Use Cases
            </h2>
            <ul class="list-disc pl-6 space-y-2">
              <li
                v-for="(useCase, index) in model.useCases"
                :key="index"
                class="text-foreground/80"
              >
                {{ useCase }}
              </li>
            </ul>
          </div>

          <!-- Version History -->
          <div class="bg-card rounded-lg border p-6 text-foreground">
            <h2 class="text-2xl font-semibold mb-4 flex items-center">
              <CalendarIcon class="h-5 w-5 mr-2" />
              Version History
            </h2>
            <div class="space-y-4">
              <div
                v-for="(version, index) in model.versions"
                :key="index"
                class="border-l-2 border-primary/30 pl-4 pb-4"
              >
                <div class="flex items-center mb-2">
                  <span class="font-semibold mr-2"
                    >Version {{ version.version }}</span
                  >
                  <span class="text-sm text-foreground/60">{{
                    formatDate(version.releaseDate)
                  }}</span>
                </div>
                <ul class="list-disc pl-6 space-y-1">
                  <li
                    v-for="(change, changeIndex) in version.changes"
                    :key="changeIndex"
                    class="text-sm text-foreground/80"
                  >
                    {{ change }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Right column - Deployment and requirements -->
        <div class="space-y-6">
          <!-- Deploy button card -->
          <div class="bg-card rounded-lg border p-6 text-foreground">
            <h2 class="text-2xl font-semibold mb-4 flex items-center">
              <ServerIcon class="h-5 w-5 mr-2" />
              Deploy Model
            </h2>
            <p class="text-foreground/80 mb-6">
              Deploy this model to your private instance to start using it in
              your applications.
            </p>
            <button
              @click="openDeploymentForm"
              class="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 rounded-md transition-colors flex items-center justify-center"
            >
              <ServerIcon class="h-5 w-5 mr-2" />
              Deploy Now
            </button>
          </div>

          <!-- System Requirements -->
          <div class="bg-card rounded-lg border p-6 text-foreground">
            <h2 class="text-xl font-semibold mb-4 flex items-center">
              <CpuIcon class="h-5 w-5 mr-2" />
              System Requirements
            </h2>
            <div class="space-y-4">
              <div>
                <h3 class="font-medium mb-2">CPU</h3>
                <div class="flex items-center justify-between">
                  <span class="text-foreground/80">Minimum</span>
                  <span class="font-medium"
                    >{{ model.requirements?.minCpu }} cores</span
                  >
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-foreground/80">Recommended</span>
                  <span class="font-medium"
                    >{{ model.requirements?.recommendedCpu }} cores</span
                  >
                </div>
              </div>

              <div>
                <h3 class="font-medium mb-2">Memory</h3>
                <div class="flex items-center justify-between">
                  <span class="text-foreground/80">Minimum</span>
                  <span class="font-medium"
                    >{{ model.requirements?.minMemory }} GB</span
                  >
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-foreground/80">Recommended</span>
                  <span class="font-medium"
                    >{{ model.requirements?.recommendedMemory }} GB</span
                  >
                </div>
              </div>

              <div>
                <h3 class="font-medium mb-2">GPU</h3>
                <div
                  v-if="model.requirements?.gpuRequired"
                  class="flex items-center justify-between"
                >
                  <span class="text-foreground/80">Required</span>
                  <span class="font-medium">Yes</span>
                </div>
                <div v-else class="flex items-center justify-between">
                  <span class="text-foreground/80">Required</span>
                  <span class="font-medium">No (CPU only)</span>
                </div>
                <div
                  v-if="model.requirements?.recommendedGpu"
                  class="flex items-center justify-between"
                >
                  <span class="text-foreground/80">Recommended</span>
                  <span class="font-medium">{{
                    model.requirements?.recommendedGpu
                  }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Model ID info -->
          <div class="bg-card rounded-lg border p-6 text-foreground">
            <h2 class="text-xl font-semibold mb-4">Model Information</h2>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-foreground/80">Model ID</span>
                <span class="font-mono text-sm bg-muted px-2 py-1 rounded">{{
                  model.id
                }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-foreground/80">Model Name</span>
                <span class="font-mono text-sm bg-muted px-2 py-1 rounded">{{
                  model.model
                }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Deployment Modal -->
    <div
      v-if="showDeploymentForm"
      class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    >
      <div
        class="bg-[#1b2931] rounded-lg shadow-xl border-2 border-[#3c3c3c] w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold text-gray-100">
              Deploy {{ model?.name }}
            </h2>
            <button
              @click="closeDeploymentForm"
              class="text-gray-400 hover:text-gray-200 transition-colors"
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
            v-if="deploymentError"
            class="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6"
          >
            {{ deploymentError }}
          </div>

          <div
            v-if="deploymentStatus"
            class="bg-blue-900/50 border border-blue-500 text-blue-200 px-4 py-3 rounded-lg mb-6"
          >
            <p><strong>Status:</strong> {{ deploymentStatus }}</p>
            <p v-if="apiEndpoint" class="mt-2">
              <strong>API Endpoint:</strong> {{ apiEndpoint }}
            </p>
            <button
              v-if="!isDeploymentReady && vmName"
              @click="checkStatus"
              class="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              <svg
                v-if="!isDeploying"
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                class="animate-spin h-4 w-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Check Status
            </button>
          </div>

          <!-- Deployment Form -->
          <form @submit.prevent="deployModel" class="space-y-6">
            <div class="grid grid-cols-1 gap-6">
              <!-- Model Name Field -->
              <div>
                <label
                  class="block text-gray-300 text-sm font-medium mb-2"
                  for="modelName"
                >
                  LLM Model
                </label>
                <input
                  v-model="deploymentConfig.modelName"
                  id="modelName"
                  readonly
                  class="w-full px-3 py-2 rounded-md border border-gray-600 bg-gray-800/50 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <!-- API Key Selection -->
              <div>
                <label
                  class="block text-gray-300 text-sm font-medium mb-2"
                  for="apiKeyId"
                >
                  API Key
                </label>
                <div class="relative">
                  <select
                    v-model="deploymentConfig.apiKeyId"
                    id="apiKeyId"
                    required
                    class="w-full px-3 py-2 rounded-md border border-gray-600 bg-gray-800/50 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                  >
                    <option v-if="isLoadingApiKeys" value="" disabled>
                      Loading API Keys...
                    </option>
                    <option v-else-if="apiKeys.length === 0" value="" disabled>
                      No API Keys Available
                    </option>
                    <option
                      v-for="key in apiKeys"
                      :key="key.id"
                      :value="key.id"
                    >
                      {{ key.name }} ({{
                        key.type === "PERSONAL" ? "Personal" : "Team"
                      }})
                    </option>
                  </select>
                  <div
                    class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400"
                  >
                    <svg
                      class="fill-current h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                    >
                      <path
                        d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <!-- CPU Cores -->
              <div>
                <label
                  class="block text-gray-300 text-sm font-medium mb-2"
                  for="cpuCount"
                >
                  CPU Cores
                </label>
                <div class="relative">
                  <select
                    v-model="deploymentConfig.cpuCount"
                    id="cpuCount"
                    required
                    class="w-full px-3 py-2 rounded-md border border-gray-600 bg-gray-800/50 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                  >
                    <option :value="2">2 Cores</option>
                    <option :value="4">4 Cores</option>
                    <option :value="8">8 Cores</option>
                    <option :value="16">16 Cores</option>
                  </select>
                  <div
                    class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400"
                  >
                    <svg
                      class="fill-current h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                    >
                      <path
                        d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <!-- Memory -->
              <div>
                <label
                  class="block text-gray-300 text-sm font-medium mb-2"
                  for="memoryGB"
                >
                  Memory (GB)
                </label>
                <div class="relative">
                  <select
                    v-model="deploymentConfig.memoryGB"
                    id="memoryGB"
                    required
                    class="w-full px-3 py-2 rounded-md border border-gray-600 bg-gray-800/50 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                  >
                    <option :value="8">8 GB</option>
                    <option :value="16">16 GB</option>
                    <option :value="32">32 GB</option>
                    <option :value="64">64 GB</option>
                  </select>
                  <div
                    class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400"
                  >
                    <svg
                      class="fill-current h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                    >
                      <path
                        d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <!-- GPU Type -->
              <div>
                <label
                  class="block text-gray-300 text-sm font-medium mb-2"
                  for="gpuType"
                >
                  GPU Type
                </label>
                <div class="relative">
                  <select
                    v-model="deploymentConfig.gpuType"
                    id="gpuType"
                    class="w-full px-3 py-2 rounded-md border border-gray-600 bg-gray-800/50 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                  >
                    <option value="">No GPU</option>
                    <option value="nvidia-tesla-t4">NVIDIA Tesla T4</option>
                    <option value="nvidia-tesla-v100">NVIDIA Tesla V100</option>
                    <option value="nvidia-a100">NVIDIA A100</option>
                  </select>
                  <div
                    class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400"
                  >
                    <svg
                      class="fill-current h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                    >
                      <path
                        d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <!-- GPU Count (conditional) -->
              <div v-if="deploymentConfig.gpuType">
                <label
                  class="block text-gray-300 text-sm font-medium mb-2"
                  for="gpuCount"
                >
                  GPU Count
                </label>
                <div class="relative">
                  <select
                    v-model="deploymentConfig.gpuCount"
                    id="gpuCount"
                    class="w-full px-3 py-2 rounded-md border border-gray-600 bg-gray-800/50 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                  >
                    <option :value="1">1 GPU</option>
                    <option :value="2">2 GPUs</option>
                    <option :value="4">4 GPUs</option>
                  </select>
                  <div
                    class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400"
                  >
                    <svg
                      class="fill-current h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                    >
                      <path
                        d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <!-- Region -->
              <div>
                <label
                  class="block text-gray-300 text-sm font-medium mb-2"
                  for="region"
                >
                  Region
                </label>
                <div class="relative">
                  <select
                    v-model="deploymentConfig.region"
                    id="region"
                    required
                    class="w-full px-3 py-2 rounded-md border border-gray-600 bg-gray-800/50 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                  >
                    <option value="us-central1">US Central (Iowa)</option>
                    <option value="us-east1">US East (South Carolina)</option>
                    <option value="us-west1-a">US West (Oregon)</option>
                    <option value="us-west4-a">US West (Las Vegas)</option>
                    <option value="europe-west4">
                      Europe West (Netherlands)
                    </option>
                    <option value="asia-northeast3">Asia East (Taiwan)</option>
                  </select>
                  <div
                    class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400"
                  >
                    <svg
                      class="fill-current h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                    >
                      <path
                        d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <!-- Form Footer/Actions -->
            <div class="flex justify-end gap-3 pt-4 border-t border-gray-700">
              <button
                type="button"
                @click="closeDeploymentForm"
                class="px-4 py-2 border border-gray-600 rounded-md text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="isDeploying || !deploymentConfig.apiKeyId"
                class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  v-if="isDeploying"
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
                {{ isDeploying ? "Deploying Model..." : "Deploy Model" }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
