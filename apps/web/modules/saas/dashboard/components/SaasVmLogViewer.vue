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

  // Import the types
  import { LogLevel, LogEntry, GetVmLogsParams } from "../types/vm";

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

      const response = await apiCaller.vm.getVmLogs.query(params);

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
                <!-- Highlight search matches -->
                <template
                  v-for="(part, i) in log.message.split(
                    new RegExp(`(${searchQuery})`, 'gi'),
                  )"
                >
                  <span
                    v-if="part.toLowerCase() === searchQuery.toLowerCase()"
                    :key="i"
                    class="bg-yellow-300 text-gray-900"
                    >{{ part }}</span
                  >
                  <span v-else :key="i">{{ part }}</span>
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
