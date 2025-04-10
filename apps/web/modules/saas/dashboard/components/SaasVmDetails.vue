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
    SearchIcon,
    DownloadIcon,
    FilterIcon,
    XIcon,
    AlertCircleIcon,
    InfoIcon,
    CheckCircleIcon,
    ClockIcon,
  } from "lucide-vue-next";
  import { ref, onMounted, computed, onUnmounted, watch } from "vue";

  const props = defineProps<{
    vmId: string;
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

  // Extract VM name and zone from the vmId
  const getVmNameAndZone = () => {
    // Assuming vmId format is "vmName___zone"
    const [vmName, zone] = props.vmId.split("___");
    return { vmName, zone };
  };

  // Load VM details
  const loadVmDetails = async () => {
    try {
      isLoading.value = true;
      error.value = null;

      // Use the checkVmStatus endpoint since we don't have a getVmDetails endpoint
      const { vmName, zone } = getVmNameAndZone();

      if (!vmName || !zone) {
        throw new Error("Invalid VM ID format");
      }

      const response = await apiCaller.vm.checkVmStatus.query({
        vmName,
        zone,
      });

      // Handle if the initial status is "success"
      let vmStatus = response.vmStatus || response.status;

      // If we get a "success" status on load, treat it as an unknown state
      // and we'll determine the actual state during polling
      if (vmStatus === "success") {
        console.log(
          `Received "success" status on initial load for VM ${vmName}`,
        );

        // Use a placeholder status until we can determine the actual state
        // This is better than showing "success" to the user
        vmStatus = "CHECKING STATUS...";

        // Start polling immediately to get the actual state
        setTimeout(() => {
          if (vm.value) startPolling();
        }, 1000);
      }

      // Create a VM object from the response
      vm.value = {
        id: props.vmId,
        name: response.name,
        status: vmStatus,
        zone: response.zone,
        creationTimestamp: response.creationTimestamp,
        apiEndpoint: response.apiEndpoint,
        labels: response.labels || {},
        // Additional properties with sensible defaults
        machineType: "n1-standard-4", // Default assumption
        memoryMb: 16384, // Default 16GB
        diskSizeGb: 100, // Default 100GB
        acceleratorType: "None",
        // Add computed properties
        modelDetails: {
          category: getCategoryFromModelName(response.labels?.model_name || ""),
          company: getCompanyFromModelName(response.labels?.model_name || ""),
          description:
            "A deployed AI model instance running on your infrastructure.",
          tags: ["Deployed", vmStatus, response.zone.split("-")[0]],
        },
        specs: {
          cpu: "4", // Default assumption
          memory: "16 GB",
          storage: "100 GB SSD",
          accelerator: "None",
        },
      };

      // Start polling if VM is in a transitional state
      if (
        ["PROVISIONING", "STAGING", "STOPPING", "CHECKING STATUS..."].includes(
          vm.value.status,
        )
      ) {
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
        const { vmName, zone } = getVmNameAndZone();

        // Get the VM status
        const response = await apiCaller.vm.checkVmStatus.query({
          vmName,
          zone,
        });

        console.log(
          `Polling VM ${vmName}: received status ${
            response.vmStatus || response.status
          }`,
        );

        // Check if we got a "success" status
        if (response.vmStatus === "success" || response.status === "success") {
          console.log(
            `Received "success" status for VM ${vmName}, determining actual state based on action`,
          );

          // Determine the correct final state based on what operation we were performing
          if (isStartingVm.value) {
            // We were starting the VM, so set status to RUNNING
            console.log(`VM ${vmName} was starting, setting status to RUNNING`);
            vm.value.status = "RUNNING";
            isStartingVm.value = false;

            // Stop polling as we've reached a final state
            stopPolling();
          } else if (isStoppingVm.value) {
            // We were stopping the VM, so set status to TERMINATED
            console.log(
              `VM ${vmName} was stopping, setting status to TERMINATED`,
            );
            vm.value.status = "TERMINATED";
            isStoppingVm.value = false;

            // Stop polling as we've reached a final state
            stopPolling();
          } else {
            // If we're not sure what operation was in progress, make another status check after a delay
            // This should rarely happen, but we handle it just in case
            console.log(
              `VM ${vmName} has "success" status but unknown operation, continuing to poll...`,
            );
            // Keep the current status, don't set to "success"
          }
        } else {
          // For actual GCP statuses (not "success"), update the VM status
          vm.value.status = response.vmStatus || response.status;

          // Update apiEndpoint if available
          if (response.apiEndpoint) {
            vm.value.apiEndpoint = response.apiEndpoint;
          }

          // If we've reached a final state, stop polling
          if (["RUNNING", "TERMINATED"].includes(vm.value.status)) {
            console.log(`VM ${vmName} reached final state: ${vm.value.status}`);
            stopPolling();

            // Clear the action flags
            isStartingVm.value = false;
            isStoppingVm.value = false;
          }
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

      const { vmName, zone } = getVmNameAndZone();

      // Call the API to start the VM
      await apiCaller.vm.startVm.mutate({
        vmName,
        zone,
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

      const { vmName, zone } = getVmNameAndZone();

      // Call the API to stop the VM
      await apiCaller.vm.stopVm.mutate({
        vmName,
        zone,
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

  // Handle back button click
  const goBack = () => {
    emit("back");
  };

  // Logs functionality
  const vmLogs = ref<any[]>([]);
  const isLoadingLogs = ref(false);
  const logsError = ref<string | null>(null);
  const logSearchQuery = ref("");
  const logFilter = ref("all");
  const logsAutoRefresh = ref(false);
  const logsAutoRefreshInterval = ref<number | null>(null);
  const logsLimit = ref(100);
  const showLogDetails = ref<number | null>(null);
  const logPageToken = ref<string | null>(null);
  const hasMoreLogs = ref(false);
  
  // Logs filter options
  const logFilterOptions = [
    { id: "all", label: "All Logs" },
    { id: "error", label: "Errors" },
    { id: "warning", label: "Warnings" },
    { id: "info", label: "Info" },
    { id: "debug", label: "Debug" },
  ];
  
  // Load logs
  const loadVmLogs = async (loadMore = false) => {
    if (!vm.value) return;
    
    if (!loadMore) {
      isLoadingLogs.value = true;
      logPageToken.value = null;
    }
    
    logsError.value = null;
    
    try {
      const { vmName, zone } = getVmNameAndZone();
      
      const params: any = {
        vmName,
        zone,
        limit: logsLimit.value,
        filter: logFilter.value !== "all" ? logFilter.value : undefined,
        search: logSearchQuery.value || undefined,
        pageToken: loadMore ? logPageToken.value : undefined
      };
      
      // This would be the actual API call to get logs
      const response = await apiCaller.vm.getVmLogs.query(params);
      
      // Transform logs for display
      const transformedLogs = (response.logs || []).map((log: any, index: number) => {
        return {
          id: loadMore ? vmLogs.value.length + index : index,
          timestamp: log.timestamp || new Date().toISOString(),
          severity: log.severity || "INFO",
          message: log.message || log.textPayload || "No message",
          json: log.jsonPayload || {},
          source: log.source || log.resource?.labels?.instance_id || vmName,
          raw: log
        };
      });
      
      if (loadMore) {
        vmLogs.value = [...vmLogs.value, ...transformedLogs];
      } else {
        vmLogs.value = transformedLogs;
      }
      
      // Handle pagination
      logPageToken.value = response.nextPageToken || null;
      hasMoreLogs.value = !!response.nextPageToken;
      
    } catch (err) {
      console.error("Error loading VM logs:", err);
      logsError.value = `Error loading logs: ${err instanceof Error ? err.message : String(err)}`;
      
      // For development - mock some logs when the API is not available
      if (!vmLogs.value.length) {
        mockVmLogs();
      }
    } finally {
      isLoadingLogs.value = false;
    }
  };
  
  // Toggle auto-refresh for logs
  const toggleLogsAutoRefresh = () => {
    logsAutoRefresh.value = !logsAutoRefresh.value;
    
    if (logsAutoRefresh.value) {
      // Refresh logs every 10 seconds
      logsAutoRefreshInterval.value = window.setInterval(() => {
        if (activeTab.value === "logs") {
          loadVmLogs();
        }
      }, 10000);
    } else if (logsAutoRefreshInterval.value) {
      clearInterval(logsAutoRefreshInterval.value);
      logsAutoRefreshInterval.value = null;
    }
  };
  
  // Download logs as JSON
  const downloadLogs = () => {
    if (!vmLogs.value.length) return;
    
    const dataStr = JSON.stringify(vmLogs.value, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileDefaultName = `vm-logs-${vm.value?.name}-${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };
  
  // Clear search and filters
  const clearLogsFilter = () => {
    logSearchQuery.value = "";
    logFilter.value = "all";
    loadVmLogs();
  };
  
  // Get log severity class for styling
  const getLogSeverityClass = (severity: string) => {
    const severityLower = severity.toLowerCase();
    if (severityLower.includes('error') || severityLower === 'fatal' || severityLower === 'critical') {
      return 'bg-red-100 text-red-800';
    } else if (severityLower.includes('warn')) {
      return 'bg-yellow-100 text-yellow-800';
    } else if (severityLower === 'info') {
      return 'bg-blue-100 text-blue-800';
    } else if (severityLower === 'debug') {
      return 'bg-gray-100 text-gray-800';
    }
    return 'bg-gray-100 text-gray-600';
  };
  
  // Get severity icon
  const getLogSeverityIcon = (severity: string) => {
    const severityLower = severity.toLowerCase();
    if (severityLower.includes('error') || severityLower === 'fatal' || severityLower === 'critical') {
      return AlertCircleIcon;
    } else if (severityLower.includes('warn')) {
      return InfoIcon;
    } else if (severityLower === 'info') {
      return CheckCircleIcon;
    } else {
      return ClockIcon;
    }
  };
  
  // Format log timestamp
  const formatLogTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      return timestamp;
    }
  };
  
  // For development - create mock logs
  const mockVmLogs = () => {
    const severities = ["INFO", "WARNING", "ERROR", "DEBUG"];
    const actions = [
      "VM instance started",
      "Loading model into memory",
      "Model loaded successfully",
      "API server starting",
      "API server started on port 8080",
      "Received request for model inference",
      "Processed request in 245ms",
      "Failed to load configuration",
      "Out of memory error when loading large tensor",
      "Rate limiting applied to incoming requests",
      "Health check passed",
      "System utilization at 75%",
      "Garbage collection triggered",
      "Updating model weights",
      "Downloading model updates",
      "Connection from unauthorized IP blocked",
    ];
    
    const mockLogs = [];
    
    // Generate 50 random logs with timestamps spreading over the last day
    for (let i = 0; i < 50; i++) {
      const timestamp = new Date(Date.now() - Math.random() * 86400000).toISOString();
      const severity = severities[Math.floor(Math.random() * severities.length)];
      const action = actions[Math.floor(Math.random() * actions.length)];
      
      mockLogs.push({
        id: i,
        timestamp,
        severity,
        message: `[${vm.value?.name}] ${action}`,
        source: vm.value?.name || 'vm',
        json: { 
          vm: vm.value?.name,
          action,
          details: {
            resourceId: `projects/my-project/zones/${vm.value?.zone}/instances/${vm.value?.name}`,
            ipAddress: "10.0.0." + Math.floor(Math.random() * 255)
          }
        },
        raw: {}
      });
    }
    
    // Sort by timestamp descending
    mockLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    vmLogs.value = mockLogs;
    hasMoreLogs.value = true;
  };
  
  // Watch for tab changes to load logs when needed
  watch(activeTab, (newTab) => {
    if (newTab === 'logs' && vm.value && vmLogs.value.length === 0) {
      loadVmLogs();
    }
  });
  
  // Clean up auto-refresh on unmount
  onUnmounted(() => {
    if (logsAutoRefreshInterval.value) {
      clearInterval(logsAutoRefreshInterval.value);
    }
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
  onUnmounted(() => {
    stopPolling();
  });

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
        @click="goBack"
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
          <div
            v-if="vm.status === 'RUNNING'"
            class="bg-white shadow rounded-lg p-6"
          >
            <h2 class="text-lg font-medium mb-4">API Endpoint</h2>
            <div class="mb-2">
              <div class="flex justify-between items-center">
                <p class="text-sm text-gray-500 mb-2">API URL</p>
                <div class="flex space-x-2">
                  <button
                    @click="copyToClipboard(vm.apiEndpoint)"
                    class="text-indigo-600 hover:text-indigo-800"
                    title="Copy to clipboard"
                  >
                    <ClipboardCopyIcon class="h-4 w-4" />
                  </button>
                  <a
                    v-if="vm.apiEndpoint"
                    :href="vm.apiEndpoint"
                    target="_blank"
                    class="text-indigo-600 hover:text-indigo-800"
                    title="Open in new tab"
                  >
                    <ExternalLinkIcon class="h-4 w-4" />
                  </a>
                </div>
              </div>
              <div
                class="bg-gray-100 p-3 rounded-md font-mono text-sm break-all"
              >
                {{ vm.apiEndpoint || "Not available" }}
              </div>
              <div v-if="copySuccess" class="mt-1 text-xs text-green-600">
                Copied to clipboard!
              </div>
            </div>
          </div>
        </div>

        <!-- Logs Tab -->
        <div v-else-if="activeTab === 'logs'" class="space-y-6">
          <div class="bg-white shadow rounded-lg overflow-hidden">
            <div class="p-6 border-b border-gray-100">
              <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-semibold text-gray-900">VM Logs</h2>
                <div class="flex space-x-2">
                  <button
                    class="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200"
                    :class="logsAutoRefresh 
                      ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' 
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'"
                    @click="toggleLogsAutoRefresh"
                    title="Auto refresh logs"
                  >
                    <RefreshCwIcon
                      class="h-4 w-4 mr-1.5"
                      :class="{ 'animate-spin': logsAutoRefresh }"
                    />
                    {{ logsAutoRefresh ? 'Auto-refreshing' : 'Auto-refresh' }}
                  </button>
                  <button
                    class="inline-flex items-center px-3 py-1.5 bg-gray-50 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors duration-200"
                    @click="loadVmLogs"
                    :disabled="isLoadingLogs"
                    title="Refresh logs"
                  >
                    <RefreshCwIcon
                      class="h-4 w-4 mr-1.5"
                      :class="{ 'animate-spin': isLoadingLogs }"
                    />
                    Refresh
                  </button>
                  <button
                    v-if="vmLogs.length > 0"
                    class="inline-flex items-center px-3 py-1.5 bg-gray-50 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors duration-200"
                    @click="downloadLogs"
                    title="Download logs as JSON"
                  >
                    <DownloadIcon class="h-4 w-4 mr-1.5" />
                    Download
                  </button>
                </div>
              </div>

              <!-- Search and Filters -->
              <div class="mb-4 flex flex-col md:flex-row gap-3">
                <div class="flex-1 relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SearchIcon class="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    v-model="logSearchQuery"
                    @keyup.enter="loadVmLogs"
                    placeholder="Search logs..."
                    class="pl-10 block w-full rounded-md border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div class="flex gap-2">
                  <select
                    v-model="logFilter"
                    @change="loadVmLogs"
                    class="rounded-md border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option v-for="option in logFilterOptions" :key="option.id" :value="option.id">
                      {{ option.label }}
                    </option>
                  </select>
                  <button
                    v-if="logSearchQuery || logFilter !== 'all'"
                    class="inline-flex items-center justify-center w-9 h-9 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                    @click="clearLogsFilter"
                    title="Clear filters"
                  >
                    <XIcon class="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Loading state -->
            <div v-if="isLoadingLogs && !vmLogs.length" class="py-16 text-center bg-gray-50">
              <div class="relative w-16 h-16 mx-auto mb-4">
                <div class="absolute inset-0 rounded-full border-4 border-t-indigo-600 border-r-indigo-500 border-b-indigo-400 border-l-indigo-600 animate-spin"></div>
              </div>
              <p class="text-gray-600 font-medium">Loading logs...</p>
            </div>

            <!-- Error state -->
            <div v-else-if="logsError && !vmLogs.length" class="p-6">
              <div class="bg-red-50 border border-red-100 rounded-lg p-4">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <AlertCircleIcon class="h-5 w-5 text-red-500" />
                  </div>
                  <div class="ml-3">
                    <h3 class="text-sm font-medium text-red-800">Error loading logs</h3>
                    <div class="mt-2 text-sm text-red-700">
                      <p>{{ logsError }}</p>
                    </div>
                    <div class="mt-4">
                      <button
                        type="button"
                        @click="loadVmLogs"
                        class="inline-flex items-center px-3 py-1.5 rounded-md bg-red-50 text-sm font-medium text-red-800 hover:bg-red-100 transition-colors duration-200"
                      >
                        <RefreshCwIcon class="h-4 w-4 mr-1.5" />
                        Try again
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Logs Table View -->
            <div v-else-if="vmLogs.length > 0" class="bg-white">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th scope="col" class="pl-6 pr-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Severity
                      </th>
                      <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Message
                      </th>
                      <th scope="col" class="pl-3 pr-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <template v-for="log in vmLogs" :key="log.id">
                      <tr class="hover:bg-gray-50 transition-colors duration-150">
                        <td class="pl-6 pr-3 py-3 whitespace-nowrap text-xs text-gray-500">
                          {{ formatLogTimestamp(log.timestamp) }}
                        </td>
                        <td class="px-3 py-3 whitespace-nowrap">
                          <span 
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" 
                            :class="getLogSeverityClass(log.severity)"
                          >
                            <component :is="getLogSeverityIcon(log.severity)" class="h-3 w-3 mr-1" />
                            {{ log.severity }}
                          </span>
                        </td>
                        <td class="px-3 py-3 text-xs text-gray-900">
                          <div class="truncate max-w-md">{{ log.message }}</div>
                        </td>
                        <td class="pl-3 pr-6 py-3 whitespace-nowrap text-right text-xs">
                          <button 
                            @click="showLogDetails = showLogDetails === log.id ? null : log.id"
                            class="inline-flex items-center px-2.5 py-1.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors duration-200"
                          >
                            {{ showLogDetails === log.id ? 'Hide Details' : 'View Details' }}
                          </button>
                        </td>
                      </tr>
                      <tr v-if="showLogDetails === log.id" :key="`detail-${log.id}`" class="bg-gray-50">
                        <td colspan="4" class="px-6 py-4">
                          <div class="text-sm">
                            <h4 class="font-medium text-gray-900 mb-3">Log Details</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                              <div>
                                <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Timestamp</p>
                                <p class="text-sm">{{ formatLogTimestamp(log.timestamp) }}</p>
                              </div>
                              <div>
                                <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Source</p>
                                <p class="text-sm">{{ log.source }}</p>
                              </div>
                            </div>
                            <div class="mb-4">
                              <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Message</p>
                              <p class="text-sm break-words bg-white p-3 rounded-md border border-gray-200">{{ log.message }}</p>
                            </div>
                            <div>
                              <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Payload</p>
                              <pre class="text-xs bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto shadow-sm">{{ JSON.stringify(log.json, null, 2) }}</pre>
                            </div>
                            <div class="mt-4 flex justify-end">
                              <button
                                @click="showLogDetails = null"
                                class="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>
            
            <!-- Empty State -->
            <div v-else class="py-16 text-center bg-gray-50">
              <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <TerminalIcon class="h-8 w-8 text-gray-400" />
              </div>
              <h3 class="text-lg font-medium text-gray-900 mb-2">No logs available</h3>
              <p class="text-gray-500 max-w-md mx-auto">
                {{ vm && vm.status !== 'RUNNING' ? 'Start the VM to view logs' : 'No logs found for this VM' }}
              </p>
              <button
                v-if="vm && vm.status === 'TERMINATED'"
                @click="startVm"
                :disabled="isStartingVm"
                class="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
              >
                <PlayIcon v-if="!isStartingVm" class="h-4 w-4 mr-1.5" />
                <LoaderIcon v-else class="h-4 w-4 mr-1.5 animate-spin" />
                Start VM
              </button>
            </div>

            <!-- Load more logs -->
            <div v-if="hasMoreLogs && vmLogs.length > 0" class="bg-white border-t border-gray-100 p-4 text-center">
              <button
                @click="loadVmLogs(true)"
                :disabled="isLoadingLogs"
                class="inline-flex items-center px-4 py-2 border border-indigo-200 rounded-md shadow-sm text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
              >
                <LoaderIcon v-if="isLoadingLogs" class="h-4 w-4 mr-1.5 animate-spin" />
                <span v-else class="mr-1.5">+</span>
                Load More Logs
              </button>
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
