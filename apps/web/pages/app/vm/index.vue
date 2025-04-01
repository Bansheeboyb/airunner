<!-- pages/deploy-model.vue -->
<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Deploy LLM Model</h1>

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
      <p v-if="apiEndpoint"><strong>API Endpoint:</strong> {{ apiEndpoint }}</p>
      <button
        v-if="!isDeploymentReady && vmName"
        @click="checkStatus"
        class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-2"
      >
        Check Status
      </button>
    </div>

    <!-- Model Configuration Form -->
    <form
      @submit.prevent="deployModel"
      class="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4"
    >
      <div class="mb-4">
        <label
          class="block text-gray-700 text-sm font-bold mb-2"
          for="modelName"
        >
          LLM Model
        </label>
        <select
          v-model="config.modelName"
          id="modelName"
          required
          class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight"
        >
          <option value="">Select a model</option>
          <option value="phi-4-mini-instruct">MS PHI Mini Instruct</option>
          <option value="llama-7b">Llama 2 (7B)</option>
          <option value="llama-13b">Llama 2 (13B)</option>
          <option value="llama-70b">Llama 2 (70B)</option>
          <option value="mistral-7b">Mistral (7B)</option>
          <option value="mixtral-8x7b">Mixtral (8x7B)</option>
        </select>
      </div>

      <div class="mb-4">
        <label
          class="block text-gray-700 text-sm font-bold mb-2"
          for="cpuCount"
        >
          CPU Cores
        </label>
        <select
          v-model="config.cpuCount"
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

      <div class="mb-4">
        <label
          class="block text-gray-700 text-sm font-bold mb-2"
          for="memoryGB"
        >
          Memory (GB)
        </label>
        <select
          v-model="config.memoryGB"
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

      <div class="mb-4">
        <label class="block text-gray-700 text-sm font-bold mb-2" for="gpuType">
          GPU Type
        </label>
        <select
          v-model="config.gpuType"
          id="gpuType"
          class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight"
        >
          <option value="">No GPU</option>
          <option value="nvidia-tesla-t4">NVIDIA Tesla T4</option>
          <option value="nvidia-tesla-v100">NVIDIA Tesla V100</option>
          <option value="nvidia-a100">NVIDIA A100</option>
        </select>
      </div>

      <div v-if="config.gpuType" class="mb-4">
        <label
          class="block text-gray-700 text-sm font-bold mb-2"
          for="gpuCount"
        >
          GPU Count
        </label>
        <select
          v-model="config.gpuCount"
          id="gpuCount"
          class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight"
        >
          <option :value="1">1 GPU</option>
          <option :value="2">2 GPUs</option>
          <option :value="4">4 GPUs</option>
        </select>
      </div>

      <div class="mb-4">
        <label class="block text-gray-700 text-sm font-bold mb-2" for="region">
          Region
        </label>
        <select
          v-model="config.region"
          id="region"
          required
          class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight"
        >
          <option value="us-central1">US Central (Iowa)</option>
          <option value="us-east1">US East (South Carolina)</option>
          <option value="us-west1-a">US West (Oregon)</option>
          <option value="us-west4">US West (Las Vegas)</option>
          <option value="europe-west4">Europe West (Netherlands)</option>
          <option value="asia-northeast3">Asia East (Taiwan)</option>
        </select>
      </div>

      <div class="flex items-center justify-between">
        <button
          type="submit"
          :disabled="isDeploying"
          class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          {{ isDeploying ? "Deploying..." : "Deploy Model" }}
        </button>
      </div>
    </form>

    <!-- List of user's VMs -->
    <div v-if="userVms.length > 0" class="mt-8">
      <h2 class="text-xl font-bold mb-4">Your Deployed Models</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full bg-white border border-gray-300">
          <thead>
            <tr>
              <th class="px-4 py-2 border-b">Name</th>
              <th class="px-4 py-2 border-b">Model</th>
              <th class="px-4 py-2 border-b">Status</th>
              <th class="px-4 py-2 border-b">Region</th>
              <th class="px-4 py-2 border-b">Created</th>
              <th class="px-4 py-2 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="vm in userVms" :key="vm.id" class="hover:bg-gray-100">
              <td class="px-4 py-2 border-b">{{ vm.name }}</td>
              <td class="px-4 py-2 border-b">
                {{ vm.labels?.model_name || "Unknown" }}
              </td>
              <td class="px-4 py-2 border-b">
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
              <td class="px-4 py-2 border-b">{{ vm.zone }}</td>
              <td class="px-4 py-2 border-b">
                {{ formatDate(vm.creationTimestamp) }}
              </td>
              <td class="px-4 py-2 border-b">
                <button
                  v-if="vm.status === 'RUNNING'"
                  @click="getVmEndpoint(vm.name, vm.zone)"
                  class="text-blue-500 hover:text-blue-700 mr-2"
                >
                  Get Endpoint
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { ref, onMounted } from "vue";

  const { apiCaller } = useApiCaller();

  const config = ref({
    modelName: "",
    cpuCount: 4,
    memoryGB: 16,
    gpuType: "",
    gpuCount: 1,
    region: "us-central1",
  });

  const isDeploying = ref(false);
  const error = ref(null);
  const deploymentStatus = ref(null);
  const vmName = ref(null);
  const apiEndpoint = ref(null);
  const isDeploymentReady = ref(false);
  const userVms = ref([]);

  // Load user's VMs on component mount
  onMounted(async () => {
    await loadUserVms();
  });

  // Function to load user's VMs
  const loadUserVms = async () => {
    try {
      const { vms } = await apiCaller.vm.listUserVms.query();
      userVms.value = vms || [];
    } catch (err) {
      console.error("Error loading VMs:", err);
      error.value = `Error loading VMs: ${err.message}`;
    }
  };

  // Function to deploy the model
  const deployModel = async () => {
    try {
      error.value = null;
      isDeploying.value = true;
      deploymentStatus.value = "Initiating deployment...";

      // Call the API endpoint using apiCaller
      const result = await apiCaller.vm.createVm.mutate({
        modelName: config.value.modelName,
        cpuCount: Number(config.value.cpuCount),
        memoryGB: Number(config.value.memoryGB),
        gpuType: config.value.gpuType || undefined,
        gpuCount: config.value.gpuType
          ? Number(config.value.gpuCount)
          : undefined,
        region: config.value.region,
      });

      vmName.value = result.vmName;
      deploymentStatus.value = `VM "${result.vmName}" creation initiated. This may take a few minutes.`;

      // Start checking the status periodically
      setTimeout(checkStatus, 30000); // Check after 30 seconds

      // Refresh VM list
      setTimeout(loadUserVms, 5000);
    } catch (err) {
      error.value = `Error: ${err.message}`;
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
        zone: config.value.region,
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
      error.value = `Error checking status: ${err.message}`;
    }
  };

  // Function to get VM endpoint for an existing VM
  const getVmEndpoint = async (name, zone) => {
    try {
      const result = await apiCaller.vm.checkVmStatus.query({
        vmName: name,
        zone: zone,
      });

      if (result.isReady && result.apiEndpoint) {
        apiEndpoint.value = result.apiEndpoint;
        deploymentStatus.value = `VM "${name}" is running.`;
        isDeploymentReady.value = true;
      } else {
        deploymentStatus.value = `VM status: ${result.vmStatus}. API endpoint not available.`;
      }
    } catch (err) {
      error.value = `Error getting VM endpoint: ${err.message}`;
    }
  };

  // Helper function to format dates
  const formatDate = (timestamp) => {
    if (!timestamp) return "Unknown";
    return new Date(timestamp).toLocaleString();
  };
</script>
