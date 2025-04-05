import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { google } from "googleapis";
import { JWT } from "google-auth-library";

export const deleteVm = protectedProcedure
  .input(
    z.object({
      vmName: z.string(),
      zone: z.string(),
    }),
  )
  .mutation(async ({ input }) => {
    try {
      console.log("Starting VM deletion process for:", input.vmName);

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

      // First, check the VM status to ensure it's stopped
      console.log("Checking VM status before deletion:", input.vmName);
      const statusResponse = await compute.instances.get({
        project: projectId,
        zone: input.zone,
        instance: input.vmName,
      });

      // Verify VM is stopped before proceeding
      if (statusResponse.data.status !== "TERMINATED") {
        console.log(
          "Cannot delete VM that is not stopped. Current status:",
          statusResponse.data.status,
        );
        throw new Error(
          "VM must be stopped before deletion. Current status: " +
            statusResponse.data.status,
        );
      }

      console.log(
        "VM is stopped. Proceeding with deletion request for:",
        input.vmName,
      );
      console.log("Zone:", input.zone);
      console.log("Project ID:", projectId);

      // Make the API call to delete the VM
      const response = await compute.instances.delete({
        project: projectId,
        zone: input.zone,
        instance: input.vmName,
      });

      console.log("VM deletion initiated successfully");
      console.log("Operation ID:", response.data.id);

      // Return response
      return {
        status: "success",
        vmName: input.vmName,
        operationId: response.data.id || "unknown",
        message: "VM deletion initiated",
      };
    } catch (error) {
      console.error("Error deleting VM:", error);

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

      throw new Error(`Error deleting VM: ${error.message}`);
    }
  });
