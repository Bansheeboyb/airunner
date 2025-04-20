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
      // Get user from context for permission checks
      const { user } = ctx;

      // Extract VM name and zone from the vmId
      const [vmName, zone] = input.vmId.split("___");
      if (!vmName || !zone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid VM ID format. Expected 'vmName___zone'",
        });
      }

      // 1. Fetch and decrypt the API key
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
      const apiKey = decryptApiKey(apiKeyRecord.encryptedKey);

      // Update last used timestamp
      await db.apiKey.update({
        where: { id: input.apiKeyId },
        data: { lastUsedAt: new Date() },
      });

      // 2. Get the API endpoint from VM info
      // For simplicity, just use the instance_id format or get from vm.labels.api_endpoint
      const apiEndpoint = `https://${vmName}.api.airunner.io/api/generate`;

      // 3. Prepare the request payload
      const payload = {
        prompt: input.message,
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 2048,
        system_prompt:
          input.systemPrompt || "You are Phi-4, a helpful AI assistant.",
      };

      // 4. Make the request to the LLM API
      console.log(`Sending request to: ${apiEndpoint}`);
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify(payload),
        timeout: 60000, // 60 second timeout
      });

      // 5. Handle response errors
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error: ${response.status} - ${errorText}`);

        throw new TRPCError({
          code:
            response.status === 401 || response.status === 403
              ? "UNAUTHORIZED"
              : response.status === 404
              ? "NOT_FOUND"
              : response.status === 429
              ? "TOO_MANY_REQUESTS"
              : "INTERNAL_SERVER_ERROR",
          message: `Error from LLM API: ${response.status} ${response.statusText}`,
        });
      }

      // 6. Parse the response and return it directly without transformation
      const responseText = await response.text();

      try {
        // If it's valid JSON, parse and return directly
        const result = JSON.parse(responseText);
        return result; // Return the exact response from the LLM
      } catch (e) {
        // If not valid JSON, return the plain text
        return { text: responseText };
      }
    } catch (error) {
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
