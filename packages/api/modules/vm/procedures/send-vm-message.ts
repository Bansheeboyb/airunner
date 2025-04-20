import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "database";
import { createDecipheriv } from "crypto";
import fetch from "node-fetch";

// Simple function to decrypt an API key
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
      vmId: z.string(),
      message: z.string(),
      apiKeyId: z.string(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional(),
      systemPrompt: z.string().optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    try {
      // Get the API key
      const apiKeyRecord = await db.apiKey.findUnique({
        where: { id: input.apiKeyId },
      });

      if (!apiKeyRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      // Basic authorization check
      if (
        apiKeyRecord.type === "PERSONAL" &&
        apiKeyRecord.userId !== ctx.user.id
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authorized to use this API key",
        });
      }

      // Decrypt the API key
      const apiKey = decryptApiKey(apiKeyRecord.encryptedKey);

      // Extract the instance ID from the vmId (format: "vmName___zone")
      const [vmName] = input.vmId.split("___");

      // Get the API endpoint - HARDCODED FOR NOW
      // REPLACE THIS WITH YOUR ACTUAL ENDPOINT
      const apiEndpoint = "https://18ae5aa5.api.airunner.io/api/generate";

      // Prepare the request payload
      const payload = {
        prompt: input.message,
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 2048,
        system_prompt:
          input.systemPrompt || "You are Phi-4, a helpful AI assistant.",
      };

      // Make the request to the LLM API
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `API error: ${response.status}`,
        });
      }

      // Parse and return the response directly
      const result = await response.json();
      return result;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      });
    }
  });
