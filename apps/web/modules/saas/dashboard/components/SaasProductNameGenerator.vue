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
  }

  // Sample model data
  const models = ref<Model[]>([
    {
      id: 1,
      name: "PHI Mini Instruct",
      model: "phi-4-mini-instruct",
      company: "Microsoft",
      category: "Text Generation",
      description:
        "Advanced language model with improved reasoning and context window. Capable of complex reasoning and creative text generation.",
      tags: ["Language Model", "ChatBot", "API Available"],
      updated: "March 2025",
    },
    {
      id: 2,
      name: "Claude 3.7 Sonnet",
      model: "claude-3.7-sonnet",
      company: "Anthropic",
      category: "Text Generation",
      description:
        "Advanced reasoning model with extended thinking capability for complex problem solving and detailed responses.",
      tags: ["Language Model", "Reasoning", "Enterprise"],
      updated: "February 2025",
    },
    {
      id: 3,
      name: "DALL-E 3",
      model: "dall-e-3",
      company: "OpenAI",
      category: "Image Generation",
      description:
        "Creates photorealistic images and art from natural language descriptions with high fidelity and accuracy.",
      tags: ["High Resolution", "Creative", "API Available"],
      updated: "January 2025",
    },
    {
      id: 4,
      name: "Midjourney V6",
      model: "midjourney-v6",
      company: "Midjourney",
      category: "Image Generation",
      description:
        "Advanced image generation model with improved coherence and art direction capabilities.",
      tags: ["High Detail", "Art", "Discord"],
      updated: "December 2024",
    },
    {
      id: 5,
      name: "Stable Diffusion XL",
      model: "stable-diffusion-xl",
      company: "Stability AI",
      category: "Image Generation",
      description:
        "Open-source image generation model with high quality outputs and extensive customization options.",
      tags: ["Open Source", "Customizable", "Community"],
      updated: "November 2024",
    },
    {
      id: 6,
      name: "Whisper v3",
      model: "whisper-v3",
      company: "OpenAI",
      category: "Audio Transcription",
      description:
        "Multilingual speech recognition system with high accuracy across dozens of languages.",
      tags: ["Multilingual", "Real-time", "Noise Resistant"],
      updated: "February 2025",
    },
    {
      id: 7,
      name: "Suno AI",
      model: "suno-ai",
      company: "Suno",
      category: "Audio Generation",
      description:
        "Creates high-quality music from text prompts with vocals, instrumentation, and professional sound.",
      tags: ["Music", "Creative", "Voice"],
      updated: "March 2025",
    },
    {
      id: 8,
      name: "Llama 3",
      model: "llama-3",
      company: "Meta",
      category: "Text Generation",
      description:
        "Open-source large language model with powerful capabilities for a wide range of applications.",
      tags: ["Open Source", "Multilingual", "Fine-tunable"],
      updated: "January 2025",
    },
    {
      id: 9,
      name: "Pika 2.0",
      model: "pika-2.0",
      company: "Pika Labs",
      category: "Video Generation",
      description:
        "Generates high-quality videos from text descriptions with advanced motion control and scene consistency.",
      tags: ["High Quality", "Cinematic", "Text-to-Video"],
      updated: "February 2025",
    },
    {
      id: 10,
      name: "Gen-2",
      model: "gen-2",
      company: "Runway",
      category: "Video Generation",
      description:
        "Professional video generation model with advanced editing capabilities and style transfer.",
      tags: ["Professional", "Editing", "Style Transfer"],
      updated: "December 2024",
    },
    {
      id: 11,
      name: "Gemini Pro",
      model: "gemini-pro",
      company: "Google",
      category: "Text Generation",
      description:
        "Multimodal model built for reasoning and understanding across text, images, audio, and more.",
      tags: ["Multimodal", "Enterprise", "API Available"],
      updated: "January 2025",
    },
    {
      id: 12,
      name: "Deepgram Nova",
      model: "deepgram-nova",
      company: "Deepgram",
      category: "Audio Transcription",
      description:
        "Enterprise speech recognition with support for real-time transcription and speaker diarization.",
      tags: ["Enterprise", "Real-time", "Speaker ID"],
      updated: "December 2024",
    },
  ]);

  // Search and filter state
  const searchQuery = ref("");
  const selectedCategory = ref("");

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
  const openDeploymentForm = (
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
  };

  // Close deployment form
  const closeDeploymentForm = () => {
    showDeploymentForm.value = false;
    selectedModelForDeployment.value = null;
    error.value = null;
    deploymentStatus.value = null;
    apiEndpoint.value = null;
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

  // Computed properties
  const uniqueCategories = computed(() => {
    const categories = models.value.map((model) => model.category);
    return [...new Set(categories)];
  });

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

      const matchesCategory =
        selectedCategory.value === "" ||
        model.category === selectedCategory.value;

      return matchesSearch && matchesCategory;
    });
  });

  const filteredModelsByCategory = computed(() => {
    type GroupedModels = Record<string, Model[]>;
    const groupedModels: GroupedModels = {};

    filteredModels.value.forEach((model) => {
      if (!groupedModels[model.category]) {
        groupedModels[model.category] = [];
      }
      groupedModels[model.category].push(model);
    });

    return groupedModels;
  });

  // Load user's VMs on component mount
  onMounted(async () => {
    await loadUserVms();
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

      <!-- Category Navigation -->
      <ul
        class="no-scrollbar -mx-8 -mb-4 mt-6 flex list-none items-center justify-start gap-6 overflow-x-auto px-8 text-sm"
      >
        <li>
          <button
            @click="selectedCategory = ''"
            class="flex items-center gap-2 border-b-2 px-1 pb-3 text-sm transition-colors"
            :class="
              selectedCategory === ''
                ? 'border-primary font-bold text-primary'
                : 'border-transparent'
            "
          >
            <span>All Models</span>
          </button>
        </li>
        <li v-for="category in uniqueCategories" :key="category">
          <button
            @click="selectedCategory = category"
            class="flex items-center gap-2 border-b-2 px-1 pb-3 text-sm transition-colors"
            :class="
              selectedCategory === category
                ? 'border-primary font-bold text-primary'
                : 'border-transparent'
            "
          >
            <span>{{ category }}</span>
          </button>
        </li>
      </ul>
    </div>

    <!-- Models Grid -->
    <div
      v-for="(modelGroup, category) in filteredModelsByCategory"
      :key="category"
      class="mb-12 mt-12"
    >
      <h2 class="text-2xl font-semibold mb-6">{{ category }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="model in modelGroup"
          :key="model.id"
          class="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 transition-all duration-300 hover:shadow-lg hover:shadow-crypto-blue-500"
        >
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center">
                <div
                  class="flex-shrink-0 w-10 h-10 rounded-full mr-3 bg-gradient-to-br"
                  :class="getGradientClass(model.category)"
                >
                  <div
                    class="w-full h-full flex items-center justify-center text-white"
                  >
                    <MessageSquareIcon
                      v-if="model.category === 'Text Generation'"
                      class="size-5"
                    />
                    <ImageIcon
                      v-else-if="model.category === 'Image Generation'"
                      class="size-5"
                    />
                    <HeadphonesIcon
                      v-else-if="
                        model.category === 'Audio Transcription' ||
                        model.category === 'Audio Generation'
                      "
                      class="size-5"
                    />
                    <VideoIcon
                      v-else-if="model.category === 'Video Generation'"
                      class="size-5"
                    />
                    <Wand2Icon v-else class="size-5" />
                  </div>
                </div>
                <div>
                  <h3 class="font-semibold text-lg">{{ model.name }}</h3>
                  <div class="flex items-center text-sm text-gray-500">
                    <span>{{ model.company }}</span>
                  </div>
                </div>
              </div>
              <span
                class="text-xs font-medium px-2.5 py-0.5 rounded-full"
                :class="getTagClass(model.category)"
              >
                {{ model.category }}
              </span>
            </div>

            <p class="text-gray-600 text-sm mb-4 line-clamp-2">
              {{ model.description }}
            </p>

            <div class="flex flex-wrap gap-2 mb-4">
              <span
                v-for="(tag, index) in model.tags"
                :key="index"
                class="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded"
              >
                {{ tag }}
              </span>
            </div>

            <div class="flex items-center justify-between text-sm">
              <div class="flex items-center text-gray-600">
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
              <div class="flex gap-2">
                <button
                  class="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  View Details
                </button>
                <button
                  @click="openDeploymentForm(model)"
                  class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md text-xs font-medium"
                >
                  Deploy Model
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="Object.keys(filteredModelsByCategory).length === 0"
      class="bg-gray-50 rounded-lg p-8 text-center"
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
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div
        class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div class="p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">
              Deploy {{ selectedModelForDeployment?.name }}
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

          <div
            v-if="deploymentStatus"
            class="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4"
          >
            <p><strong>Status:</strong> {{ deploymentStatus }}</p>
            <p v-if="apiEndpoint">
              <strong>API Endpoint:</strong> {{ apiEndpoint }}
            </p>
            <button
              v-if="!isDeploymentReady && vmName"
              @click="checkStatus"
              class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-2"
            >
              Check Status
            </button>
          </div>

          <!-- Deployment Form -->
          <form @submit.prevent="deployModel" class="space-y-4">
            <div>
              <label
                class="block text-gray-700 text-sm font-bold mb-2"
                for="modelName"
              >
                LLM Model
              </label>
              <input
                v-model="deploymentConfig.modelName"
                id="modelName"
                readonly
                class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight bg-gray-100"
              />
            </div>

            <div>
              <label
                class="block text-gray-700 text-sm font-bold mb-2"
                for="cpuCount"
              >
                CPU Cores
              </label>
              <select
                v-model="deploymentConfig.cpuCount"
                id="cpuCount"
                required
                class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight"
              >
                <option :value="2">2 Cores</option>
                <option :value="4">4 Cores</option>
                <option :value="8">8 Cores</option>
                <option :value="16">16 Cores</option>
              </select>
            </div>

            <div>
              <label
                class="block text-gray-700 text-sm font-bold mb-2"
                for="memoryGB"
              >
                Memory (GB)
              </label>
              <select
                v-model="deploymentConfig.memoryGB"
                id="memoryGB"
                required
                class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight"
              >
                <option :value="8">8 GB</option>
                <option :value="16">16 GB</option>
                <option :value="32">32 GB</option>
                <option :value="64">64 GB</option>
              </select>
            </div>

            <div>
              <label
                class="block text-gray-700 text-sm font-bold mb-2"
                for="gpuType"
              >
                GPU Type
              </label>
              <select
                v-model="deploymentConfig.gpuType"
                id="gpuType"
                class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight"
              >
                <option value="">No GPU</option>
                <option value="nvidia-tesla-t4">NVIDIA Tesla T4</option>
                <option value="nvidia-tesla-v100">NVIDIA Tesla V100</option>
                <option value="nvidia-a100">NVIDIA A100</option>
              </select>
            </div>

            <div v-if="deploymentConfig.gpuType">
              <label
                class="block text-gray-700 text-sm font-bold mb-2"
                for="gpuCount"
              >
                GPU Count
              </label>
              <select
                v-model="deploymentConfig.gpuCount"
                id="gpuCount"
                class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight"
              >
                <option :value="1">1 GPU</option>
                <option :value="2">2 GPUs</option>
                <option :value="4">4 GPUs</option>
              </select>
            </div>

            <div>
              <label
                class="block text-gray-700 text-sm font-bold mb-2"
                for="region"
              >
                Region
              </label>
              <select
                v-model="deploymentConfig.region"
                id="region"
                required
                class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight"
              >
                <option value="us-central1">US Central (Iowa)</option>
                <option value="us-east1">US East (South Carolina)</option>
                <option value="us-west1-a">US West (Oregon)</option>
                <option value="us-west4-a">US West (Las Vegas)</option>
                <option value="europe-west4">Europe West (Netherlands)</option>
                <option value="asia-northeast3">Asia East (Taiwan)</option>
              </select>
            </div>

            <div class="flex justify-end gap-2 pt-4">
              <button
                type="button"
                @click="closeDeploymentForm"
                class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="isDeploying"
                class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded"
              >
                {{ isDeploying ? "Deploying..." : "Deploy Model" }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Recently Deployed Models Section -->
    <div v-if="userVms.length > 0" class="mt-12 mb-8">
      <h2 class="text-2xl font-semibold mb-6">Your Deployed Models</h2>
      <div class="overflow-x-auto bg-white rounded-xl shadow-md">
        <table class="min-w-full">
          <thead class="bg-gray-50">
            <tr>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Name
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Model
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Region
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Created
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="vm in userVms" :key="vm.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">{{ vm.name }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                {{ vm.labels?.model_name || "Unknown" }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  :class="{
                    'px-2 py-1 rounded text-xs font-semibold': true,
                    'bg-green-100 text-green-800': vm.status === 'RUNNING',
                    'bg-yellow-100 text-yellow-800':
                      vm.status === 'PROVISIONING',
                    'bg-red-100 text-red-800': vm.status === 'TERMINATED',
                  }"
                >
                  {{ vm.status }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">{{ vm.zone }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                {{ formatDate(vm.creationTimestamp) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <button
                  v-if="vm.status === 'RUNNING'"
                  @click="
                    apiEndpoint = vm.apiEndpoint ?? null;
                    deploymentStatus = `VM '${vm.name}' is running.`;
                    showDeploymentForm = true;
                  "
                  class="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                >
                  View API Endpoint
                </button>
              </td>
            </tr>
          </tbody>
        </table>
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
