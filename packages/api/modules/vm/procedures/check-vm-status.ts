import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { google } from "googleapis";

export const checkVmStatus = protectedProcedure
  .input(
    z.object({
      vmName: z.string(),
      zone: z.string(),
    }),
  )
  .query(async ({ input }) => {
    try {
      const { vmName, zone } = input;
      const zoneStr = zone.includes("-") ? zone : `${zone}-a`;

      // Authenticate with GCP
      const auth = new google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });

      const projectId = await auth.getProjectId();
      const authClient = await auth.getClient();

      // Create Compute Engine client
      const compute = google.compute({
        version: "v1",
        auth: authClient,
      });

      // Get VM details
      const response = await compute.instances.get({
        project: projectId,
        zone: zoneStr,
        instance: vmName,
      });

      const vm = response.data;
      const isRunning = vm.status === "RUNNING";
      let apiEndpoint = null;

      // Extract external IP if VM is running
      if (
        isRunning &&
        vm.networkInterfaces &&
        vm.networkInterfaces.length > 0
      ) {
        const networkInterface = vm.networkInterfaces[0];
        if (
          networkInterface.accessConfigs &&
          networkInterface.accessConfigs.length > 0
        ) {
          const accessConfig = networkInterface.accessConfigs[0];
          if (accessConfig.natIP) {
            apiEndpoint = `http://${accessConfig.natIP}:8000/api/generate`;
          }
        }
      }

      return {
        status: "success",
        vmStatus: vm.status,
        isReady: isRunning && apiEndpoint !== null,
        apiEndpoint,
        metadata: vm.metadata,
        labels: vm.labels,
      };
    } catch (error) {
      console.error("Error checking VM status:", error);
      throw new Error(error.message || "Unknown error checking VM status");
    }
  });
