<script setup lang="ts">
  import {
    SearchIcon,
    FilterIcon,
    DownloadIcon,
    RefreshCwIcon,
    XIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    CheckIcon,
    RotateCwIcon,
  } from "lucide-vue-next";
  import { ref, computed, onMounted, onUnmounted, watch } from "vue";

  // Log level types
  export enum LogLevel {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR",
    CRITICAL = "CRITICAL",
  }

  // Log entry interface
  export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    service?: string;
    instance?: string;
    requestId?: string;
    metadata?: Record<string, any>;
  }

  // API request parameters
  export interface GetVmLogsParams {
    vmName: string;
    zone: string;
    limit?: number;
    startTime?: string;
    endTime?: string;
    level?: LogLevel;
    filter?: string;
  }

  const props = defineProps<{
    vmId: string;
    vmName: string;
    zone: string;
    isVmRunning: boolean;
  }>();

  // API caller
  const { apiCaller } = useApiCaller();

  // Log state
  const logs = ref<LogEntry[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const hasMore = ref(true);

  // Filter and search state
  const searchQuery = ref("");
  const selectedLevels = ref<LogLevel[]>(Object.values(LogLevel));
  const showFilters = ref(false);
  const showLevelFilter = ref(false);
  const autoScroll = ref(true);
  const logsContainerRef = ref<HTMLElement | null>(null);

  // Polling configuration
  const isPolling = ref(true);
  const pollingInterval = ref<number | null>(null);
  const refreshRate = ref(5); // seconds
  const availableRefreshRates = [1, 3, 5, 10, 30, 60]; // seconds

  // Timestamp format
  const timeFormat = ref<"relative" | "absolute">("relative");

  // Pagination
  const limit = ref(100);
  const page = ref(1);
  const totalPages = ref(1);

  // Mock data to simulate logs
  const mockLogsData: LogEntry[] = [
    {
      timestamp: new Date(Date.now() - 30000).toISOString(),
      level: LogLevel.INFO,
      message: "VM started successfully",
      service: "system",
      instance: "vm-instance-1",
    },
    {
      timestamp: new Date(Date.now() - 25000).toISOString(),
      level: LogLevel.INFO,
      message: "Initializing model loading process",
      service: "model-service",
      instance: "vm-instance-1",
    },
    {
      timestamp: new Date(Date.now() - 24000).toISOString(),
      level: LogLevel.DEBUG,
      message: "Loading model weights from disk",
      service: "model-service",
      instance: "vm-instance-1",
      metadata: {
        modelSize: "7B",
        diskPath: "/models/llama-7b",
      },
    },
    {
      timestamp: new Date(Date.now() - 20000).toISOString(),
      level: LogLevel.INFO,
      message: "Model weights loaded into memory",
      service: "model-service",
      instance: "vm-instance-1",
    },
    {
      timestamp: new Date(Date.now() - 18000).toISOString(),
      level: LogLevel.WARN,
      message: "High memory usage detected: 85% of available RAM",
      service: "system-monitor",
      instance: "vm-instance-1",
      metadata: {
        totalMemory: "16GB",
        usedMemory: "13.6GB",
        freeMemory: "2.4GB",
      },
    },
    {
      timestamp: new Date(Date.now() - 15000).toISOString(),
      level: LogLevel.INFO,
      message: "Starting API server on port 8080",
      service: "api-service",
      instance: "vm-instance-1",
    },
    {
      timestamp: new Date(Date.now() - 12000).toISOString(),
      level: LogLevel.INFO,
      message: "API server started successfully",
      service: "api-service",
      instance: "vm-instance-1",
    },
    {
      timestamp: new Date(Date.now() - 10000).toISOString(),
      level: LogLevel.INFO,
      message: "Received API request: /v1/completions",
      service: "api-service",
      instance: "vm-instance-1",
      requestId: "req-123456",
      metadata: {
        clientIp: "192.168.1.5",
        method: "POST",
        contentLength: 1024,
      },
    },
    {
      timestamp: new Date(Date.now() - 9000).toISOString(),
      level: LogLevel.DEBUG,
      message: "Processing completion request with prompt length: 256 tokens",
      service: "inference-engine",
      instance: "vm-instance-1",
      requestId: "req-123456",
    },
    {
      timestamp: new Date(Date.now() - 7000).toISOString(),
      level: LogLevel.INFO,
      message: "Completion generated successfully in 1.5s",
      service: "inference-engine",
      instance: "vm-instance-1",
      requestId: "req-123456",
      metadata: {
        inputTokens: 256,
        outputTokens: 128,
        totalTokens: 384,
        processingTimeMs: 1500,
      },
    },
    {
      timestamp: new Date(Date.now() - 5000).toISOString(),
      level: LogLevel.ERROR,
      message: "Failed to process request: Token limit exceeded",
      service: "api-service",
      instance: "vm-instance-1",
      requestId: "req-789012",
      metadata: {
        clientIp: "192.168.1.7",
        method: "POST",
        error: "Token limit of 4096 exceeded: requested 5120 tokens",
      },
    },
    {
      timestamp: new Date(Date.now() - 3000).toISOString(),
      level: LogLevel.CRITICAL,
      message: "Out of memory error during inference",
      service: "inference-engine",
      instance: "vm-instance-1",
      requestId: "req-345678",
      metadata: {
        requiredMemory: "18GB",
        availableMemory: "16GB",
        modelSize: "13B",
      },
    },
    {
      timestamp: new Date(Date.now() - 2000).toISOString(),
      level: LogLevel.INFO,
      message: "API request completed: /v1/embeddings",
      service: "api-service",
      instance: "vm-instance-1",
      requestId: "req-901234",
      metadata: {
        statusCode: 200,
        processingTimeMs: 350,
      },
    },
    {
      timestamp: new Date(Date.now() - 1000).toISOString(),
      level: LogLevel.INFO,
      message: "Health check passed",
      service: "system-monitor",
      instance: "vm-instance-1",
    },
    {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message: "Current system stats - CPU: 42%, Memory: 85%, GPU: 78%",
      service: "system-monitor",
      instance: "vm-instance-1",
      metadata: {
        cpuUsage: 42,
        memoryUsage: 85,
        gpuUsage: 78,
        diskUsage: 34,
        networkIn: "1.2MB/s",
        networkOut: "3.4MB/s",
      },
    },
  ];

  // Function to generate random logs for realistic continuous polling
  const generateRandomLog = (): LogEntry => {
    const services = [
      "api-service",
      "inference-engine",
      "model-service",
      "system-monitor",
    ];
    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
      LogLevel.CRITICAL,
    ];
    const levelWeights = [0.3, 0.5, 0.1, 0.07, 0.03]; // Higher probability for INFO and DEBUG

    // Weighted random level selection
    const randomLevel = () => {
      const rand = Math.random();
      let sum = 0;
      for (let i = 0; i < levelWeights.length; i++) {
        sum += levelWeights[i];
        if (rand < sum) return levels[i];
      }
      return LogLevel.INFO;
    };

    const level = randomLevel();
    const service = services[Math.floor(Math.random() * services.length)];
    const requestId = `req-${Math.floor(Math.random() * 1000000)}`;

    let message = "";
    let metadata = undefined;

    // Generate relevant messages based on level and service
    if (service === "api-service") {
      const endpoints = [
        "/v1/completions",
        "/v1/chat/completions",
        "/v1/embeddings",
        "/health",
      ];
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

      if (level === LogLevel.INFO) {
        message = `Received API request: ${endpoint}`;
        metadata = {
          clientIp: `192.168.1.${Math.floor(Math.random() * 255)}`,
          method: Math.random() > 0.2 ? "POST" : "GET",
          contentLength: Math.floor(Math.random() * 5000),
        };
      } else if (level === LogLevel.ERROR) {
        const errors = [
          "Invalid API key",
          "Token limit exceeded",
          "Rate limit exceeded",
          "Invalid request format",
        ];
        message = `Failed to process request: ${
          errors[Math.floor(Math.random() * errors.length)]
        }`;
        metadata = {
          statusCode: 400,
          errorType: "BadRequestError",
        };
      } else if (level === LogLevel.DEBUG) {
        message = `Request ${requestId} params validated successfully`;
      }
    } else if (service === "inference-engine") {
      if (level === LogLevel.INFO) {
        message = `Completion generated successfully in ${(
          Math.random() * 2
        ).toFixed(1)}s`;
        metadata = {
          inputTokens: Math.floor(Math.random() * 500),
          outputTokens: Math.floor(Math.random() * 300),
          processingTimeMs: Math.floor(Math.random() * 2000),
        };
      } else if (level === LogLevel.WARN) {
        message = `High inference latency detected: ${Math.floor(
          Math.random() * 5000,
        )}ms`;
      } else if (level === LogLevel.CRITICAL) {
        message = "Model inference failed with CUDA error";
        metadata = {
          errorCode: "CUDA_OUT_OF_MEMORY",
          gpuId: 0,
        };
      }
    } else if (service === "system-monitor") {
      const cpuUsage = Math.floor(Math.random() * 100);
      const memoryUsage = Math.floor(Math.random() * 100);
      const gpuUsage = Math.floor(Math.random() * 100);

      if (level === LogLevel.INFO) {
        message = `Current system stats - CPU: ${cpuUsage}%, Memory: ${memoryUsage}%, GPU: ${gpuUsage}%`;
        metadata = {
          cpuUsage,
          memoryUsage,
          gpuUsage,
          diskUsage: Math.floor(Math.random() * 100),
          networkIn: `${(Math.random() * 5).toFixed(1)}MB/s`,
          networkOut: `${(Math.random() * 8).toFixed(1)}MB/s`,
        };
      } else if (level === LogLevel.WARN && memoryUsage > 80) {
        message = `High memory usage detected: ${memoryUsage}% of available RAM`;
      } else if (level === LogLevel.ERROR && cpuUsage > 90) {
        message = `Critical CPU saturation: ${cpuUsage}%`;
      }
    }

    // Default message if none was set
    if (!message) {
      message = `Log entry from ${service}`;
    }

    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service,
      instance: "vm-instance-1",
      requestId:
        service === "api-service" || service === "inference-engine"
          ? requestId
          : undefined,
      metadata,
    };
  };

  // Implementation for the VM logs API
  const getVmLogs = async (params: GetVmLogsParams): Promise<LogEntry[]> => {
    // In a real implementation, this would make an HTTP request to your backend

    // If we have existing mock data, use it
    const existingLogs = [...mockLogsData];

    // Generate some new random logs for continuous polling effect
    if (params.vmName && params.zone) {
      // Only generate new logs if the VM is running (would be determined by the backend)
      const isVmRunning = props.isVmRunning;

      if (isVmRunning) {
        // Add 1-3 new logs each time
        const newLogsCount = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < newLogsCount; i++) {
          existingLogs.push(generateRandomLog());
        }
      }
    }

    // Sort by timestamp, newest first
    existingLogs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    // Apply filters if provided
    let filteredLogs = existingLogs;

    if (params.level) {
      filteredLogs = filteredLogs.filter((log) => log.level === params.level);
    }

    if (params.filter) {
      const searchTerm = params.filter.toLowerCase();
      filteredLogs = filteredLogs.filter(
        (log) =>
          log.message.toLowerCase().includes(searchTerm) ||
          log.service?.toLowerCase().includes(searchTerm) ||
          log.instance?.toLowerCase().includes(searchTerm),
      );
    }

    if (params.startTime) {
      const startTimestamp = new Date(params.startTime).getTime();
      filteredLogs = filteredLogs.filter(
        (log) => new Date(log.timestamp).getTime() >= startTimestamp,
      );
    }

    if (params.endTime) {
      const endTimestamp = new Date(params.endTime).getTime();
      filteredLogs = filteredLogs.filter(
        (log) => new Date(log.timestamp).getTime() <= endTimestamp,
      );
    }

    // Apply pagination
    return filteredLogs.slice(0, params.limit || 100);
  };

  // Load logs function
  const loadLogs = async (append = false) => {
    if (isLoading.value) return;

    try {
      isLoading.value = true;
      error.value = null;

      const params: GetVmLogsParams = {
        vmName: props.vmName,
        zone: props.zone,
        limit: limit.value,
        level:
          selectedLevels.value.length < Object.values(LogLevel).length
            ? selectedLevels.value[0]
            : undefined,
        filter: searchQuery.value || undefined,
      };

      const response = await getVmLogs(params);

      if (append) {
        logs.value = [...logs.value, ...response];
      } else {
        logs.value = response;
      }

      hasMore.value = response.length === limit.value;

      // If auto-scroll is enabled, scroll to bottom
      if (autoScroll.value && logsContainerRef.value) {
        setTimeout(() => {
          if (logsContainerRef.value) {
            logsContainerRef.value.scrollTop =
              logsContainerRef.value.scrollHeight;
          }
        }, 0);
      }
    } catch (err) {
      console.error("Error loading logs:", err);
      error.value = `Error loading logs: ${
        err instanceof Error ? err.message : String(err)
      }`;
    } finally {
      isLoading.value = false;
    }
  };

  // Start polling
  const startPolling = () => {
    if (pollingInterval.value) {
      clearInterval(pollingInterval.value);
    }

    if (isPolling.value && props.isVmRunning) {
      pollingInterval.value = window.setInterval(() => {
        loadLogs();
      }, refreshRate.value * 1000);
    }
  };

  // Toggle polling
  const togglePolling = () => {
    isPolling.value = !isPolling.value;

    if (isPolling.value) {
      startPolling();
    } else if (pollingInterval.value) {
      clearInterval(pollingInterval.value);
      pollingInterval.value = null;
    }
  };

  // Update refresh rate
  const updateRefreshRate = (rate: number) => {
    refreshRate.value = rate;
    if (isPolling.value) {
      startPolling();
    }
  };

  // Toggle log level
  const toggleLogLevel = (level: LogLevel) => {
    if (selectedLevels.value.includes(level)) {
      selectedLevels.value = selectedLevels.value.filter((l) => l !== level);
    } else {
      selectedLevels.value = [...selectedLevels.value, level];
    }
  };

  // Select all log levels
  const selectAllLevels = () => {
    selectedLevels.value = Object.values(LogLevel);
  };

  // Clear all log levels
  const clearAllLevels = () => {
    selectedLevels.value = [];
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    if (timeFormat.value === "relative") {
      // Simple relative time format for demo
      const diff = new Date().getTime() - new Date(timestamp).getTime();
      if (diff < 60000) return "Just now";
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return `${Math.floor(diff / 86400000)}d ago`;
    } else {
      return new Date(timestamp).toLocaleTimeString();
    }
  };

  // Export logs as JSON
  const exportLogs = () => {
    const dataStr = JSON.stringify(logs.value, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(
      dataStr,
    )}`;

    const exportLink = document.createElement("a");
    exportLink.setAttribute("href", dataUri);
    exportLink.setAttribute(
      "download",
      `${props.vmName}-logs-${new Date().toISOString()}.json`,
    );
    document.body.appendChild(exportLink);
    exportLink.click();
    document.body.removeChild(exportLink);
  };

  // Filtered logs
  const filteredLogs = computed(() => {
    if (
      !searchQuery.value &&
      selectedLevels.value.length === Object.values(LogLevel).length
    ) {
      return logs.value;
    }

    return logs.value.filter((log) => {
      const matchesSearch =
        !searchQuery.value ||
        log.message.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        (log.service &&
          log.service
            .toLowerCase()
            .includes(searchQuery.value.toLowerCase())) ||
        (log.instance &&
          log.instance.toLowerCase().includes(searchQuery.value.toLowerCase()));

      const matchesLevel = selectedLevels.value.includes(log.level);

      return matchesSearch && matchesLevel;
    });
  });

  // Watch for changes in search or filter
  watch([searchQuery, selectedLevels], () => {
    // Reset pagination on filter change
    page.value = 1;
  });

  // Log level color and style
  const getLogLevelStyle = (level: LogLevel) => {
    switch (level) {
      case LogLevel.DEBUG:
        return "bg-gray-100 text-gray-800";
      case LogLevel.INFO:
        return "bg-blue-100 text-blue-800";
      case LogLevel.WARN:
        return "bg-yellow-100 text-yellow-800";
      case LogLevel.ERROR:
        return "bg-red-100 text-red-800";
      case LogLevel.CRITICAL:
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Initialize
  onMounted(() => {
    loadLogs();
    if (props.isVmRunning) {
      startPolling();
    }
  });

  // Clean up on unmount
  onUnmounted(() => {
    if (pollingInterval.value) {
      clearInterval(pollingInterval.value);
    }
  });

  // Watch for VM status changes
  watch(
    () => props.isVmRunning,
    (newValue) => {
      if (newValue && isPolling.value) {
        startPolling();
      } else if (!newValue && pollingInterval.value) {
        clearInterval(pollingInterval.value);
        pollingInterval.value = null;
      }
    },
  );
</script>

<template>
  <div class="bg-white shadow rounded-lg overflow-hidden">
    <!-- Log Toolbar -->
    <div
      class="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3"
    >
      <!-- Search and filters -->
      <div class="flex items-center space-x-2 flex-grow">
        <div class="relative flex-grow max-w-md">
          <div
            class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
          >
            <SearchIcon class="h-4 w-4 text-gray-400" />
          </div>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search logs..."
            class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <XIcon class="h-4 w-4 text-gray-400 hover:text-gray-500" />
          </button>
        </div>

        <div class="relative">
          <button
            @click="showFilters = !showFilters"
            class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <FilterIcon class="h-4 w-4 mr-1" />
            Filter
          </button>

          <!-- Filter dropdown -->
          <div
            v-if="showFilters"
            class="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 focus:outline-none z-10"
          >
            <div class="py-1" role="none">
              <div class="px-4 py-2 text-sm text-gray-700 font-medium">
                Log Levels
              </div>
              <div class="px-4 py-2">
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="level in Object.values(LogLevel)"
                    :key="level"
                    @click="toggleLogLevel(level)"
                    :class="[
                      'px-2 py-1 rounded-full text-xs font-medium',
                      selectedLevels.includes(level)
                        ? getLogLevelStyle(level)
                        : 'bg-gray-100 text-gray-400',
                    ]"
                  >
                    {{ level }}
                  </button>
                </div>
              </div>
              <div class="px-4 py-2 flex justify-between">
                <button
                  @click="selectAllLevels"
                  class="text-xs text-indigo-600 hover:text-indigo-900"
                >
                  Select All
                </button>
                <button
                  @click="clearAllLevels"
                  class="text-xs text-indigo-600 hover:text-indigo-900"
                >
                  Clear All
                </button>
              </div>
            </div>
            <div class="py-1" role="none">
              <div class="px-4 py-2 text-sm text-gray-700 font-medium">
                Time Format
              </div>
              <div class="px-4 py-2 space-y-2">
                <label class="inline-flex items-center">
                  <input
                    type="radio"
                    v-model="timeFormat"
                    value="relative"
                    class="form-radio h-4 w-4 text-indigo-600"
                  />
                  <span class="ml-2 text-sm text-gray-700"
                    >Relative (5m ago)</span
                  >
                </label>
                <label class="inline-flex items-center">
                  <input
                    type="radio"
                    v-model="timeFormat"
                    value="absolute"
                    class="form-radio h-4 w-4 text-indigo-600"
                  />
                  <span class="ml-2 text-sm text-gray-700"
                    >Absolute (14:30:45)</span
                  >
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center space-x-2 ml-auto">
        <!-- Auto-scroll toggle -->
        <button
          @click="autoScroll = !autoScroll"
          :class="[
            'inline-flex items-center px-2 py-1 border text-xs font-medium rounded',
            autoScroll
              ? 'border-indigo-500 text-indigo-500'
              : 'border-gray-300 text-gray-500',
          ]"
        >
          <CheckIcon v-if="autoScroll" class="h-3 w-3 mr-1" />
          Auto-scroll
        </button>

        <!-- Refresh rate dropdown -->
        <div class="relative">
          <button
            @click="isPolling = !isPolling"
            :class="[
              'inline-flex items-center px-3 py-2 border text-sm leading-4 font-medium rounded-md',
              isPolling
                ? 'border-indigo-500 text-indigo-500'
                : 'border-gray-300 text-gray-500',
            ]"
          >
            <RefreshCwIcon
              class="h-4 w-4 mr-1"
              :class="{ 'animate-spin': isPolling && isLoading }"
            />
            {{ isPolling ? `${refreshRate}s` : "Paused" }}
            <ChevronDownIcon class="ml-1 h-4 w-4" />
          </button>

          <div
            v-if="isPolling"
            class="origin-top-right absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
          >
            <div class="py-1" role="menu">
              <div class="px-3 py-2 text-xs font-medium text-gray-700">
                Refresh Rate
              </div>
              <button
                v-for="rate in availableRefreshRates"
                :key="rate"
                @click="updateRefreshRate(rate)"
                class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                :class="{ 'bg-gray-100': rate === refreshRate }"
              >
                {{ rate }}s
                <CheckIcon
                  v-if="rate === refreshRate"
                  class="inline-block h-4 w-4 ml-1 text-indigo-500"
                />
              </button>
            </div>
          </div>
        </div>

        <!-- Manual refresh -->
        <button
          @click="loadLogs()"
          class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          :disabled="isLoading"
        >
          <RotateCwIcon
            class="h-4 w-4"
            :class="{ 'animate-spin': isLoading }"
          />
        </button>

        <!-- Export -->
        <button
          @click="exportLogs"
          class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <DownloadIcon class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Log content -->
    <div
      ref="logsContainerRef"
      class="h-96 overflow-y-auto font-mono text-sm"
      :class="{ 'bg-gray-900 text-gray-300': true }"
    >
      <table class="min-w-full">
        <thead class="sticky top-0 bg-gray-800 text-gray-300">
          <tr>
            <th
              scope="col"
              class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider w-24"
            >
              Time
            </th>
            <th
              scope="col"
              class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider w-20"
            >
              Level
            </th>
            <th
              scope="col"
              class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
            >
              Message
            </th>
            <th
              scope="col"
              class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider w-24"
            >
              Service
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-700">
          <!-- Loading placeholder -->
          <tr v-if="isLoading && !filteredLogs.length">
            <td colspan="4" class="px-3 py-4 text-center text-gray-400">
              <RefreshCwIcon class="inline-block h-5 w-5 animate-spin mr-2" />
              Loading logs...
            </td>
          </tr>

          <!-- No results -->
          <tr v-else-if="!filteredLogs.length">
            <td colspan="4" class="px-3 py-4 text-center text-gray-400">
              <div class="flex flex-col items-center justify-center py-6">
                <div class="mb-2">No logs found</div>
                <div
                  v-if="
                    searchQuery ||
                    selectedLevels.length !== Object.values(LogLevel).length
                  "
                  class="text-xs"
                >
                  Try adjusting your filters
                </div>
                <div v-else-if="!props.isVmRunning" class="text-xs">
                  VM is not running
                </div>
              </div>
            </td>
          </tr>

          <!-- Log entries -->
          <tr
            v-for="(log, index) in filteredLogs"
            :key="index"
            class="hover:bg-gray-800"
          >
            <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-400">
              {{ formatTimestamp(log.timestamp) }}
            </td>
            <td class="px-3 py-2 whitespace-nowrap">
              <span
                :class="[
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  getLogLevelStyle(log.level),
                ]"
              >
                {{ log.level }}
              </span>
            </td>
            <td class="px-3 py-2 break-all">
              <span
                v-if="
                  searchQuery &&
                  log.message.toLowerCase().includes(searchQuery.toLowerCase())
                "
              >
                <!-- Highlight search matches with proper keying -->
                <template
                  v-for="(part, i) in log.message.split(
                    new RegExp(`(${searchQuery})`, 'gi'),
                  )"
                >
                  <span
                    v-if="part.toLowerCase() === searchQuery.toLowerCase()"
                    :key="`match-${i}`"
                    class="bg-yellow-300 text-gray-900"
                    >{{ part }}</span
                  >
                  <span v-else :key="`non-match-${i}`">{{ part }}</span>
                </template>
              </span>
              <span v-else>{{ log.message }}</span>

              <!-- Optional metadata -->
              <div v-if="log.metadata" class="mt-1 text-xs text-gray-500">
                <details>
                  <summary class="cursor-pointer">Metadata</summary>
                  <pre class="mt-1 pl-2 text-gray-400">{{
                    JSON.stringify(log.metadata, null, 2)
                  }}</pre>
                </details>
              </div>
            </td>
            <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-400">
              {{ log.service || "-" }}
              <div v-if="log.instance" class="text-xs text-gray-500">
                {{ log.instance }}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Status bar -->
    <div
      class="px-4 py-2 border-t border-gray-700 bg-gray-800 text-gray-400 flex justify-between items-center text-xs"
    >
      <div>
        {{ filteredLogs.length }}
        {{ filteredLogs.length === 1 ? "entry" : "entries" }}
        <span v-if="filteredLogs.length !== logs.length">
          (filtered from {{ logs.length }})
        </span>
      </div>
      <div>
        {{ props.isVmRunning ? "VM running" : "VM stopped" }} •
        {{ isPolling ? `Refreshing every ${refreshRate}s` : "Polling paused" }}
      </div>
    </div>
  </div>
</template>

<style scoped>
  /* Additional table styles */
  table {
    border-collapse: separate;
    border-spacing: 0;
  }

  tbody tr:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  /* Custom scrollbar */
  .overflow-y-auto::-webkit-scrollbar {
    width: 8px;
  }

  .overflow-y-auto::-webkit-scrollbar-track {
    background: #2d3748;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb {
    background-color: #4a5568;
    border-radius: 4px;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background-color: #718096;
  }
</style>
