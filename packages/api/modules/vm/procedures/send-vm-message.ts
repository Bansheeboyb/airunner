import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "database";
import { createDecipheriv } from "crypto";
import fetch from "node-fetch";

// Function to decrypt an API key
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
      console.log("Starting sendVmMessage procedure");
      // Get user from context for permission checks
      const { user } = ctx;

      // Extract VM name and zone from the vmId
      const [vmName, zone] = input.vmId.split("___");
      console.log(`Extracted VM name: ${vmName}, zone: ${zone}`);

      if (!vmName || !zone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid VM ID format. Expected 'vmName___zone'",
        });
      }

      // 1. Fetch and decrypt the API key
      console.log(`Fetching API key with ID: ${input.apiKeyId}`);
      const apiKeyRecord = await db.apiKey.findUnique({
        where: { id: input.apiKeyId },
        include: { team: true },
      });

      if (!apiKeyRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      console.log(`Found API key of type: ${apiKeyRecord.type}`);

      // Simple permission check
      if (apiKeyRecord.type === "PERSONAL" && apiKeyRecord.userId !== user.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authorized to use this personal API key",
        });
      } else if (
        apiKeyRecord.type === "TEAM" &&
        !ctx.abilities.canAccessTeam(apiKeyRecord.teamId)
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authorized to use this team's API key",
        });
      }

      // Decrypt the API key
      console.log(`Decrypting API key`);
      let apiKey;
      try {
        apiKey = decryptApiKey(apiKeyRecord.encryptedKey);
        console.log(`API key decrypted successfully`);
      } catch (decryptError) {
        console.error(`Error decrypting API key:`, decryptError);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to decrypt API key: ${decryptError.message}`,
        });
      }

      // Update last used timestamp
      try {
        await db.apiKey.update({
          where: { id: input.apiKeyId },
          data: { lastUsedAt: new Date() },
        });
        console.log(`Updated lastUsedAt timestamp for API key`);
      } catch (dbError) {
        // Non-fatal error, just log it
        console.error(`Failed to update lastUsedAt timestamp:`, dbError);
      }

      // 2. Import libraries needed to get the VM details
      console.log(`Importing Google libraries`);
      const { google } = await import("googleapis");
      const { JWT } = await import("google-auth-library");

      // Check if we have valid GCP credentials
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

      // Format private key (fix newline issues)
      const privateKey = process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n");

      // Create JWT client with service account credentials
      console.log(`Creating GCP authentication client`);
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

      // Get VM details to find the instance_id
      console.log(`Fetching VM details for ${vmName} in zone ${zoneStr}`);
      const vmResponse = await compute.instances.get({
        project: projectId,
        zone: zoneStr,
        instance: vmName,
      });

      const vm = vmResponse.data;

      // Get the instance_id from labels
      console.log(`VM data received, checking for instance_id label`);
      let instanceId;
      if (vm.labels && "instance_id" in vm.labels) {
        instanceId = vm.labels.instance_id;
        console.log(`Found instance_id in labels: ${instanceId}`);
      } else {
        console.log(`No instance_id found in labels, using vmName as fallback`);
        // Fallback to vmName if no instance_id label
        instanceId = vmName;
      }

      // 3. Construct the API endpoint using the instance_id
      const apiEndpoint = `https://${instanceId}.api.airunner.io/api/generate`;
      console.log(`Using API endpoint: ${apiEndpoint}`);

      // 4. Prepare the request payload
      const payload = {
        prompt: input.message,
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 2048,
        system_prompt:
          input.systemPrompt || "You are Phi-4, a helpful AI assistant.",
      };
      console.log(`Request payload prepared`);

      // 5. Make the request to the LLM API
      console.log(`Sending request to LLM API`);
      let response;
      try {
        response = await fetch(apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
            "User-Agent": "AIRunner/1.0",
          },
          body: JSON.stringify(payload),
          timeout: 60000, // 60 second timeout
        });
        console.log(`Received response with status: ${response.status}`);
      } catch (fetchError) {
        console.error(`Fetch error details:`, fetchError);
        // More detailed error message
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Network error connecting to LLM API (${apiEndpoint}): ${fetchError.message}`,
        });
      }

      // 6. Handle response errors
      if (!response.ok) {
        let errorText = "";
        try {
          errorText = await response.text();
          console.error(`API Error response body:`, errorText);
        } catch (e) {
          console.error(`Could not read error response body`);
        }

        throw new TRPCError({
          code:
            response.status === 401 || response.status === 403
              ? "UNAUTHORIZED"
              : response.status === 404
              ? "NOT_FOUND"
              : response.status === 429
              ? "TOO_MANY_REQUESTS"
              : "INTERNAL_SERVER_ERROR",
          message: `Error from LLM API: ${response.status} ${response.statusText}. Details: ${errorText}`,
        });
      }

      // 7. Parse the response
      console.log(`Parsing successful response`);
      let responseText;
      try {
        responseText = await response.text();
        console.log(
          `Response content received (length: ${responseText.length})`,
        );
      } catch (readError) {
        console.error(`Error reading response:`, readError);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Error reading response: ${readError.message}`,
        });
      }

      try {
        // If it's valid JSON, parse and return directly
        const result = JSON.parse(responseText);
        console.log(
          `Successfully parsed JSON response with keys: ${Object.keys(
            result,
          ).join(", ")}`,
        );
        return result; // Return the exact response from the LLM
      } catch (parseError) {
        // If not valid JSON, log the error and return the plain text
        console.error(`Failed to parse response as JSON:`, parseError);
        return { text: responseText };
      }
    } catch (error) {
      // Final error handler
      console.error("Error in sendVmMessage:", error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Error processing message: ${error.message}`,
      });
    }
  });
