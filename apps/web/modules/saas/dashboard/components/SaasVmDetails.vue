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
        instanceId: response.instanceId || null, // Store the instance ID from the API response
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
  
  // Helper function to calculate uptime
  const computeUptime = (startTime: string | number | Date) => {
    if (!startTime) return "Unknown";
    
    const start = new Date(startTime).getTime();
    const now = Date.now();
    const uptimeMs = now - start;
    
    // Convert to readable format
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };
  
  // Helper function to get model type icon
  const getModelTypeIcon = (category: string) => {
    if (!category) return ServerIcon;
    
    const categoryLower = category.toLowerCase();
    
    if (categoryLower.includes('text') || categoryLower.includes('generation')) {
      return function ChatIcon() {
        return h('svg', {
          xmlns: 'http://www.w3.org/2000/svg',
          viewBox: '0 0 24 24',
          fill: 'none', 
          stroke: 'currentColor',
          'stroke-width': 2,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          class: 'lucide lucide-message-square-text'
        }, [
          h('path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' }),
          h('path', { d: 'M13 8H7' }),
          h('path', { d: 'M17 12H7' })
        ]);
      };
    } else if (categoryLower.includes('image')) {
      return function ImageIcon() {
        return h('svg', {
          xmlns: 'http://www.w3.org/2000/svg',
          viewBox: '0 0 24 24',
          fill: 'none', 
          stroke: 'currentColor',
          'stroke-width': 2,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        }, [
          h('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2, ry: 2 }),
          h('circle', { cx: 8.5, cy: 8.5, r: 1.5 }),
          h('polyline', { points: '21 15 16 10 5 21' })
        ]);
      };
    } else if (categoryLower.includes('audio') || categoryLower.includes('speech')) {
      return function AudioIcon() {
        return h('svg', {
          xmlns: 'http://www.w3.org/2000/svg',
          viewBox: '0 0 24 24',
          fill: 'none', 
          stroke: 'currentColor',
          'stroke-width': 2,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        }, [
          h('path', { d: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z' }),
          h('path', { d: 'M19 10v2a7 7 0 0 1-14 0v-2' }),
          h('line', { x1: 12, y1: 19, x2: 12, y2: 22 })
        ]);
      };
    } else if (categoryLower.includes('video')) {
      return function VideoIcon() {
        return h('svg', {
          xmlns: 'http://www.w3.org/2000/svg',
          viewBox: '0 0 24 24',
          fill: 'none', 
          stroke: 'currentColor',
          'stroke-width': 2,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        }, [
          h('path', { d: 'M22 8l-6 4 6 4V8z' }),
          h('rect', { x: 2, y: 6, width: 14, height: 12, rx: 2, ry: 2 })
        ]);
      };
    }
    
    // Default icon
    return ServerIcon;
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
  
  // Load logs from GCP Cloud Logging
  const loadVmLogs = async (loadMore = false) => {
    if (!vm.value) return;
    
    if (!loadMore) {
      isLoadingLogs.value = true;
      logPageToken.value = null;
    }
    
    logsError.value = null;
    
    try {
      const { vmName, zone } = getVmNameAndZone();
      
      // Build GCP compatible log filter
      let filterString = `resource.type="gce_instance" resource.labels.instance_id="${vmName}"`;
      
      // Add severity filter if specified
      if (logFilter.value !== "all") {
        filterString += ` severity=${logFilter.value.toUpperCase()}`;
      }
      
      // Add text search if provided
      if (logSearchQuery.value) {
        filterString += ` textPayload:"${logSearchQuery.value}" OR jsonPayload:"${logSearchQuery.value}"`;
      }
      
      // Get the instance ID from the VM object
      const instanceId = vm.value.instanceId || null;
      console.log("Using dynamic instance ID from VM:", instanceId);
      
      const params = {
        vmName,
        zone,
        instanceId, // Use the real instance ID from the VM
        filter: filterString,
        limit: logsLimit.value,
        pageToken: loadMore ? logPageToken.value : undefined,
        orderBy: "timestamp desc" // Most recent logs first
      };
      
      console.log("Sending log fetch params with dynamic instanceId:", params);
      
      // Check if the VM is running or if we don't have an instance ID
      if (vm.value.status !== "RUNNING" || !instanceId) {
        // If VM is not running or we don't have an instance ID, show appropriate message
        if (!vmLogs.value.length) {
          // Only use mock data in development
          if (process.env.NODE_ENV === 'development') {
            mockVmLogs();
          } else {
            let message = vm.value.status !== "RUNNING" 
              ? "VM is not running. Start the VM to view actual logs."
              : "Instance ID not available. Unable to fetch logs.";
              
            vmLogs.value = [{
              id: 0,
              timestamp: new Date().toISOString(),
              severity: "INFO",
              message: message,
              json: {},
              source: vmName,
              raw: {}
            }];
          }
        }
        isLoadingLogs.value = false;
        return;
      }
      
      // Always use mock data in development mode since GCP credentials might not be available
      // This provides a consistent experience in development without requiring real GCP credentials
      if (process.env.NODE_ENV === 'development') {
        console.warn("Using mock data for development environment");
        mockVmLogs();
        isLoadingLogs.value = false;
        return;
      }
      
      // In production, try to use the real API endpoint
      let response;
      try {
        console.log("Fetching logs with instance ID:", instanceId);
        response = await apiCaller.vm.getVmLogs.query(params);
        
        // Log success for debugging
        console.log(`Successfully fetched ${response?.logs?.length || 0} logs for instance ID: ${instanceId || 'N/A'}`);
        if (response?.logs?.length > 0) {
          console.log("First log sample:", response.logs[0]);
        } else {
          console.log("No logs found for instance ID:", instanceId);
        }
      } catch (apiError) {
        console.error("API endpoint error:", apiError);
        console.error("Error details:", {
          message: apiError.message,
          data: apiError.data,
          shape: apiError.shape,
        });
        
        // Try to extract as much info as possible from the error
        const errorMessage = apiError.message || "Unknown error";
        const errorData = apiError.data ? JSON.stringify(apiError.data) : "";
        
        // Provide a more detailed error message
        throw new Error(`Unable to fetch logs: ${errorMessage} ${errorData}`);
      }
      
      // Verify the response structure and prepare for transformation
      if (!response || typeof response !== 'object') {
        console.error("Unexpected response format:", response);
        throw new Error("Invalid response format from log API");
      }
      
      // Ensure logs property exists, if not try to find logs in the response
      if (!response.logs && response.entries) {
        console.log("Response contains entries instead of logs, adapting...");
        response.logs = response.entries;
      } else if (!response.logs && Array.isArray(response)) {
        console.log("Response is an array, adapting...");
        response = { logs: response, nextPageToken: null };
      } else if (!response.logs) {
        console.log("No logs found in response, creating empty array");
        response.logs = [];
      }
      
      // Log the structure we're working with
      console.log("Processing response with structure:", Object.keys(response));
      
      // Transform logs for display
      const transformedLogs = (response.logs || []).map((log: any, index: number) => {
        // Handle various log entry formats
        const logEntry = {
          id: loadMore ? vmLogs.value.length + index : index,
          timestamp: log.timestamp || new Date().toISOString(),
          severity: log.severity || "INFO",
          message: log.message || log.textPayload || 
                  (log.jsonPayload?.message) || 
                  (log.protoPayload?.status?.message) || 
                  "No message",
          json: log.jsonPayload || {},
          source: log.source || 
                 (log.resource?.labels?.instance_id) || 
                 (log.labels?.instance_name) || 
                 vmName,
          raw: log
        };
        
        return logEntry;
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
      if (!vmLogs.value.length && process.env.NODE_ENV === 'development') {
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
          // Reset page token for auto-refresh to avoid token mismatch errors
          logPageToken.value = null;
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
    logPageToken.value = null; // Reset page token when clearing filters
    loadVmLogs();
  };
  
  // Get log severity class for styling
  const getLogSeverityClass = (severity: string) => {
    const severityLower = severity.toLowerCase();
    if (severityLower.includes('error') || severityLower === 'fatal' || severityLower === 'critical') {
      return 'bg-red-900/50 text-red-300';
    } else if (severityLower.includes('warn')) {
      return 'bg-yellow-900/50 text-yellow-300';
    } else if (severityLower === 'info') {
      return 'bg-blue-900/50 text-blue-300';
    } else if (severityLower === 'debug') {
      return 'bg-gray-700 text-gray-300';
    }
    return 'bg-gray-700 text-gray-300';
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
  
  // For development - create realistic GCP-like mock logs
  const mockVmLogs = () => {
    // Model-specific actions based on VM labels
    const modelName = vm.value?.labels?.model_name || "unknown-model";
    const modelType = modelName.includes("llama") || modelName.includes("claude") || modelName.includes("gemini") 
                     ? "LLM" 
                     : modelName.includes("diffusion") || modelName.includes("dall") 
                     ? "Image Generation" 
                     : "AI Model";
    
    // GCP log levels
    const severities = ["INFO", "WARNING", "ERROR", "DEBUG", "NOTICE"];
    
    // Generate appropriate actions based on model type
    const bootActions = [
      { severity: "INFO", message: "Starting VM instance" },
      { severity: "INFO", message: `Downloading ${modelName} model files` },
      { severity: "INFO", message: "Initializing runtime environment" },
      { severity: "INFO", message: "Configuring network interfaces" },
      { severity: "INFO", message: "Preparing storage volumes" },
      { severity: "INFO", message: "Starting container services" },
      { severity: "INFO", message: `Initializing ${modelType} runtime` },
    ];
    
    const llmSpecificActions = [
      { severity: "INFO", message: "Loading model weights into memory" },
      { severity: "INFO", message: "Model loaded successfully" },
      { severity: "INFO", message: "Starting inference API server" },
      { severity: "INFO", message: "API server listening on port 8080" },
      { severity: "INFO", message: "Health check passed" },
      { severity: "DEBUG", message: "Tokenizer initialized with vocabulary size 32000" },
      { severity: "INFO", message: "Model serving ready on 0.0.0.0:8080" },
    ];
    
    const errorActions = [
      { severity: "WARNING", message: "High memory usage detected (85%)" },
      { severity: "WARNING", message: "Rate limiting applied to incoming requests" },
      { severity: "ERROR", message: "Failed to load configuration file at /etc/model-config.json" },
      { severity: "ERROR", message: "Out of memory error when loading large tensor batch" },
      { severity: "ERROR", message: "API request timed out after 30 seconds" },
      { severity: "WARNING", message: "Slow disk I/O detected - check storage performance" },
      { severity: "ERROR", message: "Connection refused to metadata service" },
    ];
    
    const runtimeActions = [
      { severity: "INFO", message: "Processing inference request" },
      { severity: "INFO", message: "Request processed in 245ms" },
      { severity: "DEBUG", message: "Input tokens: 124, Output tokens: 356" },
      { severity: "DEBUG", message: "Batch size: 4, Sequence length: 512" },
      { severity: "INFO", message: "Garbage collection triggered" },
      { severity: "INFO", message: "System utilization at 75%" },
      { severity: "INFO", message: "New client connection established" },
      { severity: "INFO", message: "Connection from 203.0.113.42 accepted" },
      { severity: "WARNING", message: "Connection from unauthorized IP 198.51.100.123 blocked" },
      { severity: "INFO", message: "Serving model parameters: temperature=0.7, top_p=0.95" },
    ];
    
    // Combine all possible actions with appropriate weighting
    const allActions = [
      ...bootActions,
      ...llmSpecificActions,
      ...Array(15).fill(0).flatMap(() => runtimeActions), // More runtime logs
      ...Array(3).fill(0).flatMap(() => errorActions),    // Fewer error logs
    ];
    
    const mockLogs = [];
    const now = Date.now();
    const vmStartTime = now - 3600000; // VM started 1 hour ago
    
    // Generate boot sequence logs
    bootActions.forEach((action, i) => {
      const bootTime = vmStartTime + (i * 5000); // 5 seconds between boot steps
      mockLogs.push(createMockLog(action, bootTime, i));
    });
    
    // Generate 50 more random logs
    for (let i = bootActions.length; i < 50 + bootActions.length; i++) {
      const randomAction = allActions[Math.floor(Math.random() * allActions.length)];
      const timestamp = now - Math.random() * 3600000; // Past hour
      mockLogs.push(createMockLog(randomAction, timestamp, i));
    }
    
    // Add a few very recent logs
    for (let i = 0; i < 5; i++) {
      const randomAction = runtimeActions[Math.floor(Math.random() * runtimeActions.length)];
      const recentTime = now - (i * 10000); // Last 50 seconds
      mockLogs.push(createMockLog(randomAction, recentTime, mockLogs.length));
    }
    
    // Sort by timestamp descending (newest first)
    mockLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    vmLogs.value = mockLogs;
    hasMoreLogs.value = true;
    
    // Helper to create a mock log with GCP-like structure
    function createMockLog(action, timestampMs, id) {
      const timestamp = new Date(timestampMs).toISOString();
      const insertId = crypto.randomUUID ? crypto.randomUUID() : `mock-log-${id}-${Date.now()}`;
      const traceId = `projects/airunner/traces/${Math.random().toString(36).substring(2, 15)}`;
      
      // Create resource and labels similar to GCP
      const resource = {
        type: "gce_instance",
        labels: {
          instance_id: vm.value?.name || "unknown",
          zone: vm.value?.zone || "us-central1-a",
          project_id: "airunner"
        }
      };
      
      // Generate realistic json payload
      const jsonPayload = {
        message: action.message,
        serviceName: "airunner-vm-agent",
        model: modelName,
        instanceName: vm.value?.name,
        hostname: `${vm.value?.name || "vm"}.c.airunner.internal`,
      };
      
      // Add request details for runtime logs
      if (action.message.includes("Processing") || action.message.includes("Request processed")) {
        jsonPayload.request = {
          id: `req-${Math.random().toString(36).substring(2, 10)}`,
          method: "POST",
          path: "/v1/completions",
          clientIp: `203.0.113.${Math.floor(Math.random() * 255)}`,
          processingTimeMs: Math.floor(100 + Math.random() * 500),
        };
      }
      
      // Add error details for error logs
      if (action.severity === "ERROR") {
        jsonPayload.error = {
          code: Math.floor(Math.random() * 5) + 1,
          stack: `Error: ${action.message}\n    at processRequest (/app/server.js:142:23)\n    at async handleAPIRequest (/app/server.js:89:12)`,
        };
      }
      
      return {
        id,
        insertId,
        timestamp,
        severity: action.severity,
        message: action.message,
        json: jsonPayload,
        source: resource.labels.instance_id,
        traceId,
        resource,
        raw: {
          insertId,
          timestamp,
          severity: action.severity,
          textPayload: action.message,
          jsonPayload,
          resource,
          logName: `projects/airunner/logs/vm-${resource.labels.instance_id}`,
          receiveTimestamp: new Date(timestampMs + 50).toISOString(), // Slight delay for receive vs event time
          trace: traceId,
        }
      };
    }
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
        <!-- Overview Tab - Enhanced Enterprise Design -->
        <div v-if="activeTab === 'overview'" class="space-y-6">
          <!-- VM Status Card -->
          <div class="bg-gray-900 shadow-xl rounded-lg overflow-hidden border border-gray-800">
            <div class="p-6 border-b border-gray-800">
              <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 class="text-xl font-semibold text-gray-100 flex items-center">
                    <ServerIcon class="h-5 w-5 mr-2 text-indigo-400" />
                    Deployment Status
                  </h2>
                  <p class="text-gray-400 mt-1">Real-time VM instance information</p>
                </div>
                <div class="flex flex-col items-end">
                  <div class="flex items-center mb-2">
                    <span 
                      class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                      :class="getStatusClass(vm.status)"
                    >
                      <LoaderIcon v-if="isPolling" class="h-3 w-3 mr-1 animate-spin" />
                      {{ vm.status }}
                    </span>
                    <span class="ml-2 text-gray-400 text-xs">Instance ID: {{ vm.instanceId || 'N/A' }}</span>
                  </div>
                  <div class="flex space-x-2">
                    <span class="text-gray-400 text-xs">Last update: {{ formatDate(new Date()) }}</span>
                    <button 
                      @click="loadVmDetails" 
                      class="text-indigo-400 hover:text-indigo-300 transition-colors"
                      title="Refresh status"
                    >
                      <RefreshCwIcon class="h-3.5 w-3.5" :class="{ 'animate-spin': isLoading }" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- VM Stats Tiles -->
            <div class="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-800">
              <div class="p-6">
                <div class="flex items-center justify-between">
                  <h3 class="text-gray-300 font-medium">Uptime</h3>
                  <ClockIcon class="h-5 w-5 text-indigo-400" />
                </div>
                <p class="text-2xl font-bold text-gray-100 mt-2">
                  {{ vm.status === 'RUNNING' ? computeUptime(vm.lastStatusUpdate || vm.creationTimestamp) : 'Not running' }}
                </p>
                <p class="text-gray-400 text-sm mt-1">
                  {{ vm.status === 'RUNNING' ? 'Since ' + formatDate(vm.lastStatusUpdate || vm.creationTimestamp) : 'Start the VM to begin' }}
                </p>
              </div>
              
              <div class="p-6">
                <div class="flex items-center justify-between">
                  <h3 class="text-gray-300 font-medium">API Status</h3>
                  <ExternalLinkIcon class="h-5 w-5 text-indigo-400" />
                </div>
                <p class="text-2xl font-bold text-gray-100 mt-2">
                  {{ vm.status === 'RUNNING' && vm.apiEndpoint ? 'Available' : 'Unavailable' }}
                </p>
                <p class="text-gray-400 text-sm mt-1">
                  {{ vm.status === 'RUNNING' && vm.apiEndpoint ? 'Endpoint ready' : 'VM must be running' }}
                </p>
              </div>
              
              <div class="p-6">
                <div class="flex items-center justify-between">
                  <h3 class="text-gray-300 font-medium">Model Type</h3>
                  <component :is="getModelTypeIcon(vm.modelDetails?.category)" class="h-5 w-5 text-indigo-400" />
                </div>
                <p class="text-2xl font-bold text-gray-100 mt-2">
                  {{ vm.modelDetails?.company || 'Custom' }}
                </p>
                <p class="text-gray-400 text-sm mt-1">{{ vm.modelDetails?.category || 'AI Model' }}</p>
              </div>
            </div>
          </div>
          
          <!-- Model Information Card -->
          <div class="bg-gray-900 shadow-xl rounded-lg overflow-hidden border border-gray-800">
            <div class="p-6 border-b border-gray-800">
              <h2 class="text-xl font-semibold text-gray-100 flex items-center">
                <component :is="getModelTypeIcon(vm.modelDetails?.category)" class="h-5 w-5 mr-2 text-indigo-400" />
                Model Information
              </h2>
            </div>
            
            <div class="p-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                <div>
                  <div class="flex items-center text-gray-400 mb-1">
                    <span class="text-xs uppercase tracking-wider">Model Name</span>
                  </div>
                  <p class="text-gray-100 font-medium text-lg">
                    {{ vm.labels?.model_name || "Custom Model" }}
                  </p>
                </div>
                
                <div>
                  <div class="flex items-center text-gray-400 mb-1">
                    <span class="text-xs uppercase tracking-wider">Provider</span>
                  </div>
                  <p class="text-gray-100 font-medium text-lg flex items-center">
                    {{ vm.modelDetails?.company || "Custom" }}
                    <span 
                      v-if="vm.modelDetails?.company" 
                      class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-indigo-300"
                    >
                      Verified
                    </span>
                  </p>
                </div>
                
                <div>
                  <div class="flex items-center text-gray-400 mb-1">
                    <span class="text-xs uppercase tracking-wider">Category</span>
                  </div>
                  <p class="text-gray-100 font-medium">
                    {{ vm.modelDetails?.category || "AI Model" }}
                  </p>
                </div>
                
                <div>
                  <div class="flex items-center text-gray-400 mb-1">
                    <span class="text-xs uppercase tracking-wider">Created</span>
                  </div>
                  <p class="text-gray-100 font-medium">
                    {{ formatDate(vm.creationTimestamp) }}
                  </p>
                </div>
                
                <div>
                  <div class="flex items-center text-gray-400 mb-1">
                    <span class="text-xs uppercase tracking-wider">Region/Zone</span>
                  </div>
                  <p class="text-gray-100 font-medium flex items-center">
                    <span class="inline-block w-2 h-2 rounded-full bg-green-400 mr-2"></span>
                    {{ vm.zone }}
                  </p>
                </div>
                
                <div>
                  <div class="flex items-center text-gray-400 mb-1">
                    <span class="text-xs uppercase tracking-wider">Last Status Change</span>
                  </div>
                  <p class="text-gray-100 font-medium">
                    {{ formatDate(vm.lastStatusUpdate || vm.creationTimestamp) }}
                  </p>
                </div>
              </div>
              
              <!-- Model Tags -->
              <div class="mt-6 pt-6 border-t border-gray-800">
                <div class="flex items-center text-gray-400 mb-3">
                  <span class="text-xs uppercase tracking-wider">Tags</span>
                </div>
                <div class="flex flex-wrap gap-2">
                  <span 
                    v-for="(tag, index) in vm.modelDetails?.tags || ['AI', 'Model']" 
                    :key="index"
                    class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-900/50 text-indigo-300"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Hardware Specifications Card -->
          <div class="bg-gray-900 shadow-xl rounded-lg overflow-hidden border border-gray-800">
            <div class="p-6 border-b border-gray-800">
              <h2 class="text-xl font-semibold text-gray-100 flex items-center">
                <ServerIcon class="h-5 w-5 mr-2 text-indigo-400" />
                Hardware Specifications
              </h2>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-800">
              <div class="p-6">
                <div class="flex items-center mb-2">
                  <div class="w-8 h-8 rounded-md bg-indigo-900/50 flex items-center justify-center mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-indigo-400">
                      <path d="M18 20V10" />
                      <path d="M12 20V4" />
                      <path d="M6 20v-6" />
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-gray-300 font-medium">CPU</h3>
                    <p class="text-gray-100 text-lg font-semibold">{{ vm.specs?.cpu || '4' }} vCPUs</p>
                  </div>
                </div>
                <div class="mt-2 h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                  <div class="bg-indigo-500 h-full rounded-full" style="width: 25%"></div>
                </div>
                <p class="text-xs text-gray-400 mt-1">25% allocated</p>
              </div>
              
              <div class="p-6">
                <div class="flex items-center mb-2">
                  <div class="w-8 h-8 rounded-md bg-purple-900/50 flex items-center justify-center mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-purple-400">
                      <path d="M6 19v-3"></path>
                      <path d="M10 19v-9"></path>
                      <path d="M14 19v-5"></path>
                      <path d="M18 19v-8"></path>
                      <path d="M22 6l-4-4"></path>
                      <path d="M18 2v4h4"></path>
                      <path d="M2 14l4-4"></path>
                      <path d="M6 10v4h-4"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-gray-300 font-medium">Memory</h3>
                    <p class="text-gray-100 text-lg font-semibold">{{ vm.specs?.memory || '16 GB' }}</p>
                  </div>
                </div>
                <div class="mt-2 h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                  <div class="bg-purple-500 h-full rounded-full" style="width: 80%"></div>
                </div>
                <p class="text-xs text-gray-400 mt-1">80% allocated</p>
              </div>
              
              <div class="p-6">
                <div class="flex items-center mb-2">
                  <div class="w-8 h-8 rounded-md bg-green-900/50 flex items-center justify-center mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-green-400">
                      <path d="M21 5c0-1.1-.9-2-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5Z"></path>
                      <path d="M9 21v-7H5V9.5h4V5h6v4.5h4V14h-4v7H9Z"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-gray-300 font-medium">Storage</h3>
                    <p class="text-gray-100 text-lg font-semibold">{{ vm.specs?.storage || '100 GB SSD' }}</p>
                  </div>
                </div>
                <div class="mt-2 h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                  <div class="bg-green-500 h-full rounded-full" style="width: 40%"></div>
                </div>
                <p class="text-xs text-gray-400 mt-1">40% utilized</p>
              </div>
              
              <div class="p-6">
                <div class="flex items-center mb-2">
                  <div class="w-8 h-8 rounded-md bg-yellow-900/50 flex items-center justify-center mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-yellow-400">
                      <path d="M15 15V9h4v1h-3v5h3v1h-4Z"></path>
                      <path d="M9 9h5v6H9Z"></path>
                      <path d="M4 14h.01"></path>
                      <rect width="20" height="14" x="2" y="5" rx="2"></rect>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-gray-300 font-medium">Accelerator</h3>
                    <p class="text-gray-100 text-lg font-semibold">{{ vm.specs?.accelerator || 'None' }}</p>
                  </div>
                </div>
                <div class="mt-2 h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                  <div class="bg-yellow-500 h-full rounded-full" style="width: 0%"></div>
                </div>
                <p class="text-xs text-gray-400 mt-1">Not available</p>
              </div>
            </div>
          </div>

          <!-- API Endpoint Card (only if VM is running) -->
          <div
            v-if="vm.status === 'RUNNING'"
            class="bg-gray-900 shadow-xl rounded-lg overflow-hidden border border-gray-800"
          >
            <div class="p-6 border-b border-gray-800">
              <h2 class="text-xl font-semibold text-gray-100 flex items-center">
                <ExternalLinkIcon class="h-5 w-5 mr-2 text-indigo-400" />
                API Endpoint
              </h2>
              <p class="text-gray-400 mt-1">Access your model through this endpoint</p>
            </div>
            
            <div class="p-6">
              <div class="mb-4">
                <div class="flex justify-between items-center mb-3">
                  <div class="flex items-center text-gray-400">
                    <span class="text-xs uppercase tracking-wider">Endpoint URL</span>
                    <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/50 text-green-300">ACTIVE</span>
                  </div>
                  <div class="flex space-x-2">
                    <button
                      @click="copyToClipboard(vm.apiEndpoint)"
                      class="p-1 rounded text-indigo-400 hover:text-indigo-300 hover:bg-gray-800 transition-colors"
                      title="Copy to clipboard"
                    >
                      <ClipboardCopyIcon class="h-4 w-4" />
                    </button>
                    <a
                      v-if="vm.apiEndpoint"
                      :href="vm.apiEndpoint"
                      target="_blank"
                      class="p-1 rounded text-indigo-400 hover:text-indigo-300 hover:bg-gray-800 transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLinkIcon class="h-4 w-4" />
                    </a>
                  </div>
                </div>
                
                <div class="bg-gray-800 p-4 rounded-md font-mono text-sm text-gray-200 break-all border border-gray-700">
                  {{ vm.apiEndpoint || "Not available" }}
                </div>
                
                <div v-if="copySuccess" class="mt-2 text-xs text-green-400 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3 mr-1">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Copied to clipboard!
                </div>
              </div>
              
              <!-- API Call Example -->
              <div class="mt-6 pt-6 border-t border-gray-800">
                <div class="flex items-center text-gray-400 mb-3">
                  <span class="text-xs uppercase tracking-wider">CURL Example</span>
                </div>
                <div class="bg-gray-800 p-4 rounded-md font-mono text-xs text-gray-300 overflow-x-auto border border-gray-700">
                  <pre>curl -X POST \
  {{ vm.apiEndpoint || "http://your-api-endpoint/api/generate" }} \
  -H 'Content-Type: application/json' \
  -d '{
  "prompt": "Hello, world!",
  "max_tokens": 100,
  "temperature": 0.7
}'</pre>
                </div>
                <button
                  @click="copyToClipboard(`curl -X POST \\
  ${vm.apiEndpoint || 'http://your-api-endpoint/api/generate'} \\
  -H 'Content-Type: application/json' \\
  -d '{\
  \"prompt\": \"Hello, world!\",\
  \"max_tokens\": 100,\
  \"temperature\": 0.7\
}'`)"
                  class="mt-2 flex items-center text-xs text-indigo-400 hover:text-indigo-300"
                >
                  <ClipboardCopyIcon class="h-3 w-3 mr-1" />
                  Copy example
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Logs Tab - Dark Theme Version -->
        <div v-else-if="activeTab === 'logs'" class="space-y-6">
          <div class="bg-gray-900 shadow-xl rounded-lg overflow-hidden border border-gray-800">
            <div class="p-6 border-b border-gray-800">
              <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-semibold text-gray-100">VM Logs</h2>
                <div class="flex space-x-2">
                  <button
                    class="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200"
                    :class="logsAutoRefresh 
                      ? 'bg-indigo-900/60 text-indigo-300 hover:bg-indigo-800/70' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'"
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
                    class="inline-flex items-center px-3 py-1.5 bg-gray-800 text-gray-300 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors duration-200"
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
                    class="inline-flex items-center px-3 py-1.5 bg-gray-800 text-gray-300 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors duration-200"
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
                    <SearchIcon class="h-4 w-4 text-gray-500" />
                  </div>
                  <input
                    type="text"
                    v-model="logSearchQuery"
                    @keyup.enter="logPageToken = null; loadVmLogs()"
                    placeholder="Search logs..."
                    class="pl-10 block w-full rounded-md bg-gray-800 border-gray-700 text-gray-300 placeholder-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div class="flex gap-2">
                  <select
                    v-model="logFilter"
                    @change="logPageToken = null; loadVmLogs()"
                    class="rounded-md bg-gray-800 border-gray-700 text-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option v-for="option in logFilterOptions" :key="option.id" :value="option.id">
                      {{ option.label }}
                    </option>
                  </select>
                  <button
                    v-if="logSearchQuery || logFilter !== 'all'"
                    class="inline-flex items-center justify-center w-9 h-9 rounded-md border border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300"
                    @click="clearLogsFilter"
                    title="Clear filters"
                  >
                    <XIcon class="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Loading state -->
            <div v-if="isLoadingLogs && !vmLogs.length" class="py-16 text-center bg-gray-800">
              <div class="relative w-16 h-16 mx-auto mb-4">
                <div class="absolute inset-0 rounded-full border-4 border-t-indigo-400 border-r-indigo-500 border-b-indigo-600 border-l-indigo-400 animate-spin"></div>
              </div>
              <p class="text-gray-300 font-medium">Loading logs...</p>
            </div>

            <!-- Error state -->
            <div v-else-if="logsError && !vmLogs.length" class="p-6">
              <div class="bg-red-900/30 border border-red-800 rounded-lg p-4">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <AlertCircleIcon class="h-5 w-5 text-red-400" />
                  </div>
                  <div class="ml-3">
                    <h3 class="text-sm font-medium text-red-300">Error loading logs</h3>
                    <div class="mt-2 text-sm text-red-200">
                      <p>{{ logsError }}</p>
                    </div>
                    <div class="mt-4">
                      <button
                        type="button"
                        @click="loadVmLogs"
                        class="inline-flex items-center px-3 py-1.5 rounded-md bg-red-900/30 text-sm font-medium text-red-300 hover:bg-red-800/40 transition-colors duration-200"
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
            <div v-else-if="vmLogs.length > 0" class="bg-gray-900">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-800">
                  <thead class="bg-gray-800">
                    <tr>
                      <th scope="col" class="pl-6 pr-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Time
                      </th>
                      <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Severity
                      </th>
                      <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Message
                      </th>
                      <th scope="col" class="pl-3 pr-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody class="bg-gray-900 divide-y divide-gray-800">
                    <template v-for="log in vmLogs" :key="log.id">
                      <tr class="hover:bg-gray-800/70 transition-colors duration-150">
                        <td class="pl-6 pr-3 py-3 whitespace-nowrap text-xs text-gray-400">
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
                        <td class="px-3 py-3 text-xs text-gray-300">
                          <div class="truncate max-w-md">{{ log.message }}</div>
                        </td>
                        <td class="pl-3 pr-6 py-3 whitespace-nowrap text-right text-xs">
                          <button 
                            @click="showLogDetails = showLogDetails === log.id ? null : log.id"
                            class="inline-flex items-center px-2.5 py-1.5 rounded text-xs font-medium bg-indigo-900/60 text-indigo-300 hover:bg-indigo-800/70 transition-colors duration-200"
                          >
                            {{ showLogDetails === log.id ? 'Hide Details' : 'View Details' }}
                          </button>
                        </td>
                      </tr>
                      <tr v-if="showLogDetails === log.id" :key="`detail-${log.id}`" class="bg-gray-800">
                        <td colspan="4" class="px-6 py-4">
                          <div class="text-sm">
                            <h4 class="font-medium text-gray-200 mb-3">Log Details</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                              <div>
                                <p class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Timestamp</p>
                                <p class="text-sm text-gray-300">{{ formatLogTimestamp(log.timestamp) }}</p>
                              </div>
                              <div>
                                <p class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Source</p>
                                <p class="text-sm text-gray-300">{{ log.source }}</p>
                              </div>
                            </div>
                            <div class="mb-4">
                              <p class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Message</p>
                              <p class="text-sm break-words bg-gray-900 p-3 rounded-md border border-gray-700 text-gray-300">{{ log.message }}</p>
                            </div>
                            <div>
                              <p class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Payload</p>
                              <pre class="text-xs bg-gray-950 text-gray-300 p-4 rounded-md overflow-x-auto shadow-sm border border-gray-800">{{ JSON.stringify(log.json, null, 2) }}</pre>
                            </div>
                            <div class="mt-4 flex justify-end">
                              <button
                                @click="showLogDetails = null"
                                class="inline-flex items-center px-3 py-1.5 border border-gray-700 shadow-sm text-xs font-medium rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors duration-200"
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
            <div v-else class="py-16 text-center bg-gray-800">
              <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-700 mb-4">
                <TerminalIcon class="h-8 w-8 text-gray-500" />
              </div>
              <h3 class="text-lg font-medium text-gray-200 mb-2">No logs available</h3>
              <p class="text-gray-400 max-w-md mx-auto">
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
            <div v-if="hasMoreLogs && vmLogs.length > 0" class="bg-gray-900 border-t border-gray-800 p-4 text-center">
              <button
                @click="loadVmLogs(true)"
                :disabled="isLoadingLogs"
                class="inline-flex items-center px-4 py-2 border border-indigo-700 rounded-md shadow-sm text-sm font-medium text-indigo-300 bg-indigo-900/40 hover:bg-indigo-800/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-700 focus:ring-offset-gray-900 transition-colors duration-200"
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
