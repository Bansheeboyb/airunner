<script setup lang="ts">
  import {
    Wand2Icon,
    MessageSquareIcon,
    ImageIcon,
    HeadphonesIcon,
    VideoIcon,
  } from "lucide-vue-next";
  import { z } from "zod";
  import { computed, ref } from "vue";

  const { currentTeam } = useUser();

  const { apiCaller } = useApiCaller();

  const formSchema = toTypedSchema(
    z.object({
      topic: z.string().min(1),
    }),
  );

  const { handleSubmit, values } = useForm({
    validationSchema: formSchema,
    initialValues: {
      topic: "",
    },
  });

  const topicValue = computed(() => {
    return values.topic || "";
  });

  const { data, pending, refresh, status } = useAsyncData(
    () => {
      return apiCaller.ai.generateProductNames.query({
        topic: topicValue.value,
      });
    },
    {
      immediate: false,
    },
  );

  const onSubmit = handleSubmit(async () => {
    refresh();
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
  }

  const models = ref<Model[]>([]);
  const isLoading = ref(true);
  const isInitialLoad = ref(true);
  const fetchError = ref<string | null>(null);

  // Function to load models
  const loadModels = async (categories = [], searchQuery = "") => {
    try {
      // Only set isLoading to true on initial load
      if (isInitialLoad.value) {
        isLoading.value = true;
      } else {
        // For category/search changes, we'll keep showing the existing data
        // while new data loads in the background
      }

      fetchError.value = null;

      const result = await apiCaller.vm.listAvailableModels.query({
        category: "", // We're not filtering by category at the API level anymore
        searchQuery: searchQuery || undefined,
      });

      models.value = result;
    } catch (err) {
      console.error("Error loading models:", err);
      fetchError.value = err instanceof Error ? err.message : String(err);
    } finally {
      isLoading.value = false;
      isInitialLoad.value = false;
    }
  };

  // Search and filter state
  const searchQuery = ref("");

  // Define fixed categories
  const fixedCategories = [
    "Text Generation",
    "Image Generation",
    "Video Generation",
    "Audio Generation",
  ];

  // Selected categories for filtering (now an array for multiple selection)
  const selectedCategories = ref([]);

  // API keys state
  const apiKeys = ref<any[]>([]);
  const isLoadingApiKeys = ref(false);
  const selectedApiKey = ref<string | null>(null);

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
        selectedApiKey.value = result[0].id;
      }
    } catch (error: any) {
      console.error("Error loading API keys:", error);
    } finally {
      isLoadingApiKeys.value = false;
    }
  };

  // Deployment state
  const showDeploymentForm = ref(false);
  const selectedModelForDeployment = ref<Model | null>(null);
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
  const error = ref<string | null>(null);
  const deploymentStatus = ref<string | null>(null);
  const vmName = ref<string | null>(null);
  const apiEndpoint = ref<string | null>(null);
  const isDeploymentReady = ref(false);
  interface Vm {
    id: string;
    name: string;
    labels?: { model_name?: string };
    status: string;
    zone: string;
    creationTimestamp: string;
    apiEndpoint?: string;
  }

  const userVms = ref<Vm[]>([]);

  // Show deployment form for a specific model
  const openDeploymentForm = async (
    model:
      | Model
      | {
          id: number;
          name: string;
          model: string;
          company: string;
          category: string;
          description: string;
          tags: string[];
          updated: string;
        }
      | null,
  ) => {
    selectedModelForDeployment.value = model;
    deploymentConfig.value.modelName = model?.model || "";
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
    selectedModelForDeployment.value = null;
    error.value = null;
    deploymentStatus.value = null;
    apiEndpoint.value = null;
    // Reset API key ID
    deploymentConfig.value.apiKeyId = null;
  };

  // Deploy the model
  const deployModel = async () => {
    try {
      error.value = null;
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
        apiKeyId: deploymentConfig.value.apiKeyId, // Include API key ID
      });

      vmName.value = result.vmName;
      deploymentStatus.value = `VM "${result.vmName}" creation initiated. This may take a few minutes.`;

      // Start checking the status periodically
      setTimeout(checkStatus, 30000); // Check after 30 seconds

      // Refresh VM list
      setTimeout(loadUserVms, 5000);
    } catch (err) {
      error.value = `Error: ${
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

        // Refresh VM list
        await loadUserVms();
      } else {
        deploymentStatus.value = `VM status: ${result.vmStatus}. Not ready yet.`;

        // Check again after 30 seconds
        setTimeout(checkStatus, 30000);
      }
    } catch (err) {
      error.value = `Error checking status: ${
        err instanceof Error ? err.message : String(err)
      }`;
    }
  };

  // Function to load user's VMs
  const loadUserVms = async () => {
    try {
      interface VmResponse {
        vms: Vm[];
      }

      const { vms }: VmResponse = await apiCaller.vm.listUserVms.query();
      userVms.value = vms || [];
    } catch (err) {
      console.error("Error loading VMs:", err);
      error.value = `Error loading VMs: ${
        err instanceof Error ? err.message : String(err)
      }`;
    }
  };

  // Helper function to format dates
  const formatDate = (timestamp: string | number | Date) => {
    if (!timestamp) return "Unknown";
    return new Date(timestamp).toLocaleString();
  };

  // Toggle category selection
  const toggleCategorySelection = (category) => {
    const index = selectedCategories.value.indexOf(category);
    if (index === -1) {
      selectedCategories.value.push(category);
    } else {
      selectedCategories.value.splice(index, 1);
    }
  };

  const filteredModels = computed(() => {
    return models.value.filter((model) => {
      const matchesSearch =
        searchQuery.value === "" ||
        model.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        model.description
          .toLowerCase()
          .includes(searchQuery.value.toLowerCase()) ||
        model.company.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        model.tags.some((tag) =>
          tag.toLowerCase().includes(searchQuery.value.toLowerCase()),
        );

      // If no categories are selected or "All Models" is selected, show all models
      const matchesCategory =
        selectedCategories.value.length === 0 ||
        selectedCategories.value.includes(model.category);

      return matchesSearch && matchesCategory;
    });
  });

  const filteredModelsByCategory = computed(() => {
    type GroupedModels = Record<string, Model[]>;
    const groupedModels: GroupedModels = {};

    // Initialize with all categories that might be in filtered results
    const categories = [
      ...new Set(filteredModels.value.map((model) => model.category)),
    ];
    categories.forEach((category) => {
      groupedModels[category] = [];
    });

    // Populate with filtered models
    filteredModels.value.forEach((model) => {
      if (!groupedModels[model.category]) {
        groupedModels[model.category] = [];
      }
      groupedModels[model.category].push(model);
    });

    return groupedModels;
  });

  watch(
    [searchQuery, selectedCategories],
    ([newSearchQuery, newSelectedCategories]) => {
      loadModels(newSelectedCategories, newSearchQuery);
    },
  );

  // Load user's VMs and API keys on component mount
  onMounted(async () => {
    loadModels();
    await loadUserVms();
    await loadApiKeys();
  });

  // Define CSS variables to use primary color from your theme
  const primaryColor = "text-primary"; // Assuming your theme uses text-primary class

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
</script>

<template>
  <div class="container max-w-6xl mx-auto px-4 py-2">
    <!-- Search and Filter Section -->
    <div class="mb-8">
      <div
        class="flex flex-col md:flex-row gap-4 items-center justify-between pb-4"
      >
        <div class="relative w-full md:w-64 ml-auto">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search models..."
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <div
            class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      </div>

      <!--  Category Navigation with Checkboxes -->
      <ul
        v-if="isInitialLoad && isLoading"
        class="no-scrollbar -mx-8 -mb-4 mt-6 flex list-none items-center justify-start gap-6 overflow-x-auto px-8 text-sm"
      >
        <li>
          <div class="h-8 bg-gray-300 rounded w-24 animate-pulse"></div>
        </li>
        <li v-for="i in 4" :key="i">
          <div class="h-8 bg-gray-300 rounded w-28 animate-pulse"></div>
        </li>
      </ul>

      <!-- Fixed Category Navigation with checkboxes -->
      <ul
        v-else
        class="no-scrollbar -mx-8 -mb-4 mt-6 flex list-none items-center justify-start gap-6 overflow-x-auto px-8 text-sm"
      >
        <li>
          <div class="flex items-center gap-2 px-1 pb-3 text-sm">
            <label class="flex items-center cursor-pointer">
              <input
                type="checkbox"
                :checked="selectedCategories.length === 0"
                @click="selectedCategories = []"
                class="form-checkbox h-4 w-4 text-indigo-600"
              />
              <span
                class="ml-2 transition-colors"
                :class="
                  selectedCategories.length === 0
                    ? 'font-bold text-primary'
                    : ''
                "
              >
                All Models
              </span>
            </label>
          </div>
        </li>
        <li v-for="category in fixedCategories" :key="category">
          <div class="flex items-center gap-2 px-1 pb-3 text-sm">
            <label class="flex items-center cursor-pointer">
              <input
                type="checkbox"
                :checked="selectedCategories.includes(category)"
                @click="toggleCategorySelection(category)"
                class="form-checkbox h-4 w-4 text-indigo-600"
              />
              <span
                class="ml-2 transition-colors"
                :class="
                  selectedCategories.includes(category)
                    ? 'font-bold text-primary'
                    : ''
                "
              >
                {{ category }}
              </span>
            </label>
          </div>
        </li>
      </ul>
    </div>

    <!-- Skeleton Loader (only show during initial load) -->
    <div v-if="isInitialLoad && isLoading" class="mb-12 mt-12">
      <div class="h-8 w-48 bg-gray-300 rounded mb-6 animate-pulse"></div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="i in 6"
          :key="i"
          class="bg-[#1b2931] rounded-2xl shadow-sm overflow-hidden border-2 border-[#3c3c3c] animate-pulse"
        >
          <!-- Skeleton Header -->
          <div class="relative h-40 bg-gray-700"></div>

          <!-- Skeleton Content -->
          <div class="p-5 flex-grow flex flex-col">
            <!-- Skeleton Model Info -->
            <div class="mb-4">
              <div class="flex items-center mb-2">
                <div
                  class="flex-shrink-0 w-8 h-8 rounded-full mr-3 bg-gray-700"
                ></div>
                <div class="h-5 bg-gray-700 rounded w-32"></div>
              </div>
              <div class="h-4 bg-gray-700 rounded w-24 mb-2"></div>
            </div>

            <!-- Skeleton Description -->
            <div class="h-4 bg-gray-700 rounded w-full mb-2"></div>
            <div class="h-4 bg-gray-700 rounded w-5/6 mb-4"></div>

            <!-- Skeleton Tags -->
            <div class="flex flex-wrap gap-2 mb-4">
              <div class="h-6 bg-gray-700 rounded w-16"></div>
              <div class="h-6 bg-gray-700 rounded w-20"></div>
              <div class="h-6 bg-gray-700 rounded w-24"></div>
            </div>

            <!-- Spacer -->
            <div class="flex-grow"></div>

            <!-- Skeleton Footer -->
            <div
              class="flex items-center justify-between text-xs pt-3 border-t border-gray-700"
            >
              <div class="h-4 bg-gray-700 rounded w-20"></div>
              <div class="flex gap-2">
                <div class="h-6 bg-gray-700 rounded w-16"></div>
                <div class="h-6 bg-gray-700 rounded w-16"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div
      v-else-if="fetchError"
      class="bg-red-50 rounded-lg p-8 text-center mb-12 mt-12"
    >
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
      <p class="text-red-600">{{ fetchError }}</p>
      <button
        @click="loadModels()"
        class="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
      >
        Try Again
      </button>
    </div>

    <!-- Models Grid -->
    <div
      v-else
      v-for="(modelGroup, category) in filteredModelsByCategory"
      :key="category"
      class="mb-12 mt-12"
    >
      <h2 class="text-2xl font-semibold mb-6">{{ category }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="model in modelGroup"
          :key="model.id"
          class="bg-[#1b2931] rounded-2xl shadow-sm overflow-hidden border-2 border-[ADBFD1] transition-all duration-300 hover:shadow-neon hover:scale-[1.02] group hover:shadow-crypto-blue-500 shadow-crypto-blue-500/50"
        >
          <!-- Card Header with Image -->
          <div class="relative h-40 overflow-hidden">
            <img
              :src="model.imageUrl"
              :alt="model.name"
              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <!-- Category Tag - Moved to top right for better visibility -->
            <span
              class="absolute top-2 right-2 text-xs font-medium px-3 py-1 rounded-full shadow-sm"
              :class="getTagClass(model.category)"
            >
              {{ model.category }}
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
                  :class="getGradientClass(model.category)"
                >
                  <MessageSquareIcon
                    v-if="model.category === 'Text Generation'"
                    class="size-4 text-white"
                  />
                  <ImageIcon
                    v-else-if="model.category === 'Image Generation'"
                    class="size-4 text-white"
                  />
                  <HeadphonesIcon
                    v-else-if="model.category === 'Audio Generation'"
                    class="size-4 text-white"
                  />
                  <VideoIcon
                    v-else-if="model.category === 'Video Generation'"
                    class="size-4 text-white"
                  />
                  <Wand2Icon v-else class="size-4 text-white" />
                </div>
                <span class="font-medium text-gray-300">{{ model.name }}</span>
              </div>

              <!-- Company name with better typography -->
              <p class="text-gray-400 text-sm mb-2 font-medium">
                {{ model.company }}
              </p>
            </div>

            <!-- Model description - Limited to 2 lines -->
            <p class="text-gray-600 text-sm mb-4 line-clamp-2">
              {{ model.description }}
            </p>

            <!-- Tags section -->
            <div class="flex flex-wrap gap-2 mb-4">
              <span
                v-for="(tag, index) in model.tags"
                :key="index"
                class="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded"
              >
                {{ tag }}
              </span>
            </div>

            <!-- Spacer to push footer to bottom -->
            <div class="flex-grow"></div>

            <!-- Card Footer with clearer separation -->
            <div
              class="flex items-center justify-between text-xs pt-3 border-t border-gray-700"
            >
              <!-- Updated Date -->
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
                <span>{{ model.updated }}</span>
              </div>

              <!-- Action Buttons - More prominent -->
              <div class="flex gap-2">
                <button
                  class="text-indigo-600 hover:text-indigo-700 font-medium text-xs"
                >
                  View Details
                </button>
                <button
                  @click="openDeploymentForm(model)"
                  class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
                >
                  Deploy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State (when not loading and no results) -->
    <div
      v-if="
        !isInitialLoad &&
        !isLoading &&
        !fetchError &&
        Object.keys(filteredModelsByCategory).length === 0
      "
      class="bg-gray-50 rounded-lg p-8 text-center mb-12 mt-12"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-12 w-12 mx-auto text-gray-400 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h3 class="text-lg font-medium text-gray-900 mb-2">No models found</h3>
      <p class="text-gray-600">Try adjusting your search or filter criteria</p>
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
              Deploy {{ selectedModelForDeployment?.name }}
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
            v-if="error"
            class="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6"
          >
            {{ error }}
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
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <svg 
                v-else 
                xmlns="http://www.w3.org/2000/svg" 
                class="animate-spin h-4 w-4 mr-2" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
                    <option v-if="isLoadingApiKeys" value="" disabled>Loading API Keys...</option>
                    <option v-else-if="apiKeys.length === 0" value="" disabled>No API Keys Available</option>
                    <option v-for="key in apiKeys" :key="key.id" :value="key.id">
                      {{ key.name }} ({{ key.type === 'PERSONAL' ? 'Personal' : 'Team' }})
                    </option>
                  </select>
                  <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
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
                  <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
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
                  <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
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
                  <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
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
                  <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
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
                    <option value="europe-west4">Europe West (Netherlands)</option>
                    <option value="asia-northeast3">Asia East (Taiwan)</option>
                  </select>
                  <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
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
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
</style>
