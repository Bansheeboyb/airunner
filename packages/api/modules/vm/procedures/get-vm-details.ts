import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { google } from "googleapis";
import { JWT } from "google-auth-library";

export const getVmDetails = protectedProcedure
  .input(
    z.object({
      vmId: z.string(),
    }),
  )
  .query(async ({ input }) => {
    try {
      console.log("Starting VM details fetch for:", input.vmId);

      // Extract VM name and zone from the vmId
      // Assuming vmId format is "vmName___zone"
      const [vmName, zone] = input.vmId.split("___");

      if (!vmName || !zone) {
        throw new Error("Invalid VM ID format. Expected 'vmName___zone'");
      }

      const zoneStr = zone.includes("-") ? zone : `${zone}-a`;

      // Fix private key newline formatting issues
      let privateKey = process.env.GCP_PRIVATE_KEY || "";
      if (privateKey) {
        privateKey = privateKey.replace(/\\n/g, "\n");
      }

      // Check if we have valid credentials
      if (
        !privateKey ||
        !process.env.GCP_SERVICE_ACCOUNT_EMAIL ||
        !process.env.GCP_PROJECT_ID
      ) {
        console.error("Missing GCP credentials in environment variables");
        throw new Error("Invalid or missing GCP credentials");
      }

      // Create JWT client with service account credentials
      const client = new JWT({
        email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });

      // Create Compute Engine client with our JWT client
      const compute = google.compute({
        version: "v1",
        auth: client,
      });

      const projectId = process.env.GCP_PROJECT_ID;

      console.log("Sending get details request for VM:", vmName);
      console.log("Zone:", zoneStr);
      console.log("Project ID:", projectId);

      // Get VM details
      const response = await compute.instances.get({
        project: projectId,
        zone: zoneStr,
        instance: vmName,
      });

      console.log("VM details response received");

      const vm = response.data;
      const isRunning = vm.status === "RUNNING";
      let apiEndpoint = null;

      // Use instance_id label if available, otherwise fall back to IP
      if (isRunning) {
        console.log("VM labels:", vm.labels);
        
        if (vm.labels && 'instance_id' in vm.labels) {
          console.log("Found instance_id label:", vm.labels.instance_id);
          apiEndpoint = `http://${vm.labels.instance_id}:8000/api/generate`;
          console.log("Using instance_id for apiEndpoint:", apiEndpoint);
        } else if (
          vm.networkInterfaces &&
          vm.networkInterfaces.length > 0 &&
          vm.networkInterfaces[0].accessConfigs &&
          vm.networkInterfaces[0].accessConfigs.length > 0 &&
          vm.networkInterfaces[0].accessConfigs[0].natIP
        ) {
          // Fallback to IP if no instance_id label
          const accessConfig = vm.networkInterfaces[0].accessConfigs[0];
          apiEndpoint = `http://${accessConfig.natIP}:8000/api/generate`;
          console.log("Falling back to IP for apiEndpoint:", apiEndpoint);
        }
      }

      // Get VM disk size
      let diskSizeGb = null;
      if (vm.disks && vm.disks.length > 0) {
        const bootDisk = vm.disks.find((disk) => disk.boot) || vm.disks[0];
        diskSizeGb = bootDisk.diskSizeGb;
      }

      // Get VM memory
      let memoryMb = null;
      if (vm.machineType) {
        // Try to extract memory from machine type response
        try {
          const machineTypeResponse = await compute.machineTypes.get({
            project: projectId,
            zone: zoneStr,
            machineType: vm.machineType.split("/").pop(),
          });

          memoryMb = machineTypeResponse.data.memoryMb;
        } catch (error) {
          console.warn("Could not fetch machine type details:", error.message);
        }
      }

      // Get accelerator type if any
      let acceleratorType = "None";
      let acceleratorCount = 0;
      if (vm.guestAccelerators && vm.guestAccelerators.length > 0) {
        const accelerator = vm.guestAccelerators[0];
        acceleratorType = accelerator.acceleratorType.split("/").pop();
        acceleratorCount = accelerator.acceleratorCount;
      }

      // Return a comprehensive response
      return {
        id: input.vmId,
        name: vm.name,
        status: vm.status || "UNKNOWN",
        zone: zoneStr,
        creationTimestamp: vm.creationTimestamp,
        apiEndpoint,
        labels: vm.labels || {},
        machineType: vm.machineType ? vm.machineType.split("/").pop() : null,
        diskSizeGb,
        memoryMb,
        acceleratorType,
        acceleratorCount,
        networkInterfaces: vm.networkInterfaces || [],
        tags: vm.tags || {},
        metadata: vm.metadata || {},
        lastStatusUpdate: vm.lastStartTimestamp || vm.creationTimestamp,
      };
    } catch (error) {
      console.error("Error fetching VM details:", error);

      // More detailed error logging
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", JSON.stringify(error.response.data));
      }

      throw new Error(`Error fetching VM details: ${error.message}`);
    }
  });
