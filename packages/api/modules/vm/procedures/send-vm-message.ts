import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "database";
import { createDecipheriv } from "crypto";
import fetch from "node-fetch";

// Function to decrypt an API key (based on get-decrypted-api-key.ts)
function decryptApiKey(encryptedApiKey: string): string {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  const ENCRYPTION_IV = process.env.ENCRYPTION_IV;

  if (!ENCRYPTION_KEY || !ENCRYPTION_IV) {
    throw new Error("Missing encryption environment variables");
  }

  const decipher = createDecipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    Buffer.from(ENCRYPTION_IV, "hex"),
  );

  let decrypted = decipher.update(encryptedApiKey, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export const sendVmMessage = protectedProcedure
  .input(
    z.object({
      vmId: z.string(), // Format "vmName___zone"
      message: z.string(),
      apiKeyId: z.string(), // User's selected API key ID
      // Optional parameters
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional(),
      systemPrompt: z.string().optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    try {
      // Get user from context for permission checks
      const { user } = ctx;
      console.log(
        `Processing message request for VM ${input.vmId} from user ${user.id}`,
      );

      // Extract VM name and zone from the vmId
      const [vmName, zone] = input.vmId.split("___");
      if (!vmName || !zone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid VM ID format. Expected 'vmName___zone'",
        });
      }

      // Fetch and decrypt the API key server-side
      const apiKeyRecord = await db.apiKey.findUnique({
        where: { id: input.apiKeyId },
        include: {
          team: true, // Include team info for permission checks
        },
      });

      // Check if API key exists
      if (!apiKeyRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      // Permission checks
      if (apiKeyRecord.type === "PERSONAL") {
        if (apiKeyRecord.userId !== user.id) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Not authorized to use this personal API key",
          });
        }
      } else if (apiKeyRecord.type === "TEAM") {
        if (!ctx.abilities.canAccessTeam(apiKeyRecord.teamId)) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Not authorized to use this team's API key",
          });
        }
      }

      // Decrypt the API key server-side
      const apiKey = decryptApiKey(apiKeyRecord.encryptedKey);

      // Update last used timestamp for the API key
      await db.apiKey.update({
        where: { id: input.apiKeyId },
        data: { lastUsedAt: new Date() },
      });

      // Get VM details to find the correct API endpoint
      // First, check if we have valid credentials
      if (
        !process.env.GCP_PRIVATE_KEY ||
        !process.env.GCP_SERVICE_ACCOUNT_EMAIL ||
        !process.env.GCP_PROJECT_ID
      ) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Missing GCP credentials",
        });
      }

      // Import libraries here to keep the code clean
      const { google } = await import("googleapis");
      const { JWT } = await import("google-auth-library");

      // Format private key (fix newline issues)
      const privateKey = process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n");

      // Create JWT client with service account credentials
      const client = new JWT({
        email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });

      // Create Compute Engine client
      const compute = google.compute({
        version: "v1",
        auth: client,
      });

      const projectId = process.env.GCP_PROJECT_ID;
      const zoneStr = zone.includes("-") ? zone : `${zone}-a`;

      // Get VM details
      console.log(`Fetching VM details for ${vmName} in zone ${zoneStr}`);
      const vmResponse = await compute.instances.get({
        project: projectId,
        zone: zoneStr,
        instance: vmName,
      });

      const vm = vmResponse.data;

      // Check if VM is running
      if (vm.status !== "RUNNING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `VM is not running (current status: ${vm.status})`,
        });
      }

      // Determine API endpoint
      let apiEndpoint = null;

      // Use instance_id label if available, otherwise fall back to IP
      if (vm.labels && "instance_id" in vm.labels) {
        apiEndpoint = `https://${vm.labels.instance_id}.api.airunner.io/api/generate`;
      } else if (
        vm.networkInterfaces &&
        vm.networkInterfaces.length > 0 &&
        vm.networkInterfaces[0].accessConfigs &&
        vm.networkInterfaces[0].accessConfigs.length > 0 &&
        vm.networkInterfaces[0].accessConfigs[0].natIP
      ) {
        // Fall back to IP if no instance_id label
        const accessConfig = vm.networkInterfaces[0].accessConfigs[0];
        apiEndpoint = `http://${accessConfig.natIP}:8000/api/generate`;
      }

      if (!apiEndpoint) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not determine VM API endpoint",
        });
      }

      console.log(`Using API endpoint: ${apiEndpoint}`);

      // Prepare the request payload
      // This structure may need adjustment based on your VM's API expectations
      const payload = {
        prompt: input.message,
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 2048,
        system_prompt: input.systemPrompt || undefined,
      };

      // Send request to the VM with the API key for authentication
      console.log("Sending request to VM API endpoint");
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey, // Use X-API-Key header for authentication
        },
        body: JSON.stringify(payload),
        timeout: 60000, // 60 second timeout for longer responses
      });

      // Handle response
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error from VM API: ${response.status} - ${errorText}`);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Error from VM: ${response.statusText} (${response.status})`,
        });
      }

      // Parse and return the VM's response
      const result = await response.json();
      console.log("Received response from VM API");

      return {
        text:
          result.text ||
          result.generated_text ||
          result.output ||
          result.response,
        usage: result.usage || null,
        model: result.model || vm.labels?.model_name || "unknown",
      };
    } catch (error) {
      console.error("Error in sendVmMessage:", error);

      // Handle different error types
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Error processing message: ${error.message}`,
      });
    }
  });
