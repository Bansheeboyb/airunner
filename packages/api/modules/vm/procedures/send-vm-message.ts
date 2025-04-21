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

      // TESTING: Using hardcoded values for debugging
      const apiEndpoint = "https://18ae5aa5.api.airunner.io/api/generate";
      console.log(`Using hardcoded test API endpoint: ${apiEndpoint}`);

      // Use hardcoded test API key instead of the decrypted one
      const testApiKey = "pk_live_da30a17690e5033d7ab8a041db4b6ec5b1b83ec2e1f68306";
      console.log(`Using hardcoded test API key instead of the decrypted one`);

      // Prepare the request payload with hardcoded values
      const payload = {
        prompt: input.message,
        temperature: 0.7,
        max_tokens: 2048,
        system_prompt: "You are Phi-4, a helpful AI assistant.",
      };
      console.log(`Test payload prepared:`, payload);

      // Make the request to the LLM API with hardcoded values
      console.log(`Sending test request to LLM API`);
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": testApiKey,
          "User-Agent": "AIRunner/1.0",
        },
        body: JSON.stringify(payload),
        // @ts-ignore - node-fetch may not support timeout option directly
        timeout: 120000, // Extended 120 second timeout for testing
      });
      console.log(`Received response with status: ${response.status}`);

      if (!response.ok) {
        // Get detailed error message from response
        let errorText = "";
        try {
          errorText = await response.text();
          console.error(`API Error response body:`, errorText);
        } catch (e) {
          console.error(`Could not read error response body`);
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `API error: ${response.status} ${response.statusText}. Details: ${errorText}`,
        });
      }

      // Parse and return the response directly
      let result;
      try {
        const responseText = await response.text();
        console.log(`Raw response text (first 200 chars): ${responseText.substring(0, 200)}...`);
        
        // Try to parse as JSON
        result = JSON.parse(responseText);
        console.log(`Successfully parsed JSON response`);
      } catch (parseError) {
        console.error(`Error parsing response:`, parseError);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to parse API response: ${parseError.message}`,
        });
      }
      
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
