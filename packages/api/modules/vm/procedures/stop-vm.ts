import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { google } from "googleapis";
import { JWT } from "google-auth-library";

export const stopVm = protectedProcedure
  .input(
    z.object({
      vmName: z.string(),
      zone: z.string(),
    }),
  )
  .mutation(async ({ input }) => {
    try {
      console.log("Stopping VM process for:", input.vmName);

      // Fix private key newline formatting issues
      let privateKey = process.env.GCP_PRIVATE_KEY || "";
      if (privateKey) {
        privateKey = privateKey.replace(/\\n/g, "\n");
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

      // First, check the VM status to ensure it's running
      console.log("Checking VM status before stopping:", input.vmName);
      const statusResponse = await compute.instances.get({
        project: projectId,
        zone: input.zone,
        instance: input.vmName,
      });

      // Verify VM is running before proceeding
      if (statusResponse.data.status !== "RUNNING") {
        console.log(
          "Cannot stop VM that is not running. Current status:",
          statusResponse.data.status,
        );
        throw new Error(
          "VM must be running before stopping. Current status: " +
            statusResponse.data.status,
        );
      }

      console.log(
        "VM is running. Proceeding with stop request for:",
        input.vmName,
      );
      console.log("Zone:", input.zone);
      console.log("Project ID:", projectId);

      // Make the API call to stop the VM
      const response = await compute.instances.stop({
        project: projectId,
        zone: input.zone,
        instance: input.vmName,
      });

      console.log("VM stop initiated successfully");
      console.log("Operation ID:", response.data.id);

      // Return response
      return {
        status: "success",
        vmName: input.vmName,
        operationId: response.data.id || "unknown",
        message: "VM stop initiated",
      };
    } catch (error) {
      console.error("Error stopping VM:", error);

      // More detailed error logging
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", JSON.stringify(error.response.data));
      }

      if (error.request) {
        console.error("Request was made but no response received");
      }

      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);

      throw new Error(`Error stopping VM: ${error.message}`);
    }
  });
