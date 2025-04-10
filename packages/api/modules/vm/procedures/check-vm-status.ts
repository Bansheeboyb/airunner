import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { google } from "googleapis";
import { JWT } from "google-auth-library";

export const checkVmStatus = protectedProcedure
  .input(
    z.object({
      vmName: z.string(),
      zone: z.string(),
    }),
  )
  .query(async ({ input }) => {
    try {
      console.log("Starting VM status check for:", input.vmName);
      const { vmName, zone } = input;
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

      console.log("Sending status check request for VM:", vmName);
      console.log("Zone:", zoneStr);
      console.log("Project ID:", projectId);

      // Get VM details
      const response = await compute.instances.get({
        project: projectId,
        zone: zoneStr,
        instance: vmName,
      });

      console.log("VM status check response received");
      console.log("Response type:", typeof response.data);
      console.log("Response keys:", Object.keys(response.data));

      // Log specific important fields
      console.log("VM status:", response.data.status);

      const vm = response.data;
      const isRunning = vm.status === "RUNNING";
      let apiEndpoint = null;

      // Extract external IP if VM is running
      if (
        isRunning &&
        vm.networkInterfaces &&
        vm.networkInterfaces.length > 0
      ) {
        console.log("Network interfaces available");
        const networkInterface = vm.networkInterfaces[0];
        console.log("Network interface keys:", Object.keys(networkInterface));

        if (
          networkInterface.accessConfigs &&
          networkInterface.accessConfigs.length > 0
        ) {
          console.log("Access configs available");
          const accessConfig = networkInterface.accessConfigs[0];
          console.log("External IP:", accessConfig.natIP);

          if (accessConfig.natIP) {
            apiEndpoint = `http://${accessConfig.natIP}:8000/api/generate`;
          }
        } else {
          console.log("No access configs found");
        }
      } else {
        console.log("VM not running or no network interfaces found");
      }

      // Extract the instance ID from the vm.id or selfLink
      let instanceId = null;
      if (vm.id) {
        instanceId = vm.id.toString();
        console.log("Found instance ID from vm.id:", instanceId);
      } else if (vm.selfLink) {
        // Extract instance ID from selfLink URL
        const selfLinkMatch = vm.selfLink.match(/\/instances\/([^\/]+)$/);
        if (selfLinkMatch && selfLinkMatch[1]) {
          instanceId = selfLinkMatch[1];
          console.log("Extracted instance ID from selfLink:", instanceId);
        }
      }
      
      // Return a safer, more structured response with instanceId
      return {
        status: "success",
        vmStatus: vm.status || "UNKNOWN",
        isReady: isRunning && apiEndpoint !== null,
        apiEndpoint,
        metadata: vm.metadata || null,
        labels: vm.labels || {},
        zone: zoneStr,
        name: vm.name,
        creationTimestamp: vm.creationTimestamp,
        instanceId, // Add the instance ID to the response
      };
    } catch (error) {
      console.error("Error checking VM status:", error);

      // More detailed error logging
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", JSON.stringify(error.response.data));
      }

      throw new Error(`Error checking status: ${error.message}`);
    }
  });
