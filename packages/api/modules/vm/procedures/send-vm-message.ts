import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import fetch from "node-fetch";

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
  .mutation(async ({ input }) => {
    try {
      // SIMPLIFIED FOR TESTING: Direct API call with hardcoded values
      console.log("=== SIMPLIFIED VM MESSAGE HANDLER ===");
      console.log(`Processing message for VM: ${input.vmId}, length: ${input.message.length} chars`);
      
      // Use hardcoded endpoint and key (the working one from curl command)
      const apiEndpoint = "https://18ae5aa5.api.airunner.io/api/generate";
      const apiKey = "pk_live_da30a17690e5033d7ab8a041db4b6ec5b1b83ec2e1f68306";
      
      console.log(`Using endpoint: ${apiEndpoint}`);
      
      // Prepare the payload
      const payload = {
        prompt: input.message,
        temperature: 0.7,
        max_tokens: 2048,
        system_prompt: "You are Phi-4, a helpful AI assistant.",
      };
      
      console.log("Sending request, waiting for response...");
      console.time("apiCall");
      
      // Make the actual API request
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "User-Agent": "AIRunner/1.0",
        },
        body: JSON.stringify(payload),
      });
      
      console.timeEnd("apiCall");
      console.log(`Response status: ${response.status}`);
      
      // Handle error responses
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Could not read error body");
        console.error(`API Error: ${response.status}. Details: ${errorText}`);
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR", 
          message: `API error: ${response.status} ${response.statusText}. Details: ${errorText}`,
        });
      }
      
      // Get the response text first
      const responseText = await response.text();
      console.log(`Response received, length: ${responseText.length} chars`);
      
      // Parse JSON response
      try {
        const result = JSON.parse(responseText);
        console.log("Successfully parsed response");
        return result;
      } catch (err) {
        console.error("JSON parse error:", err);
        console.log("Raw response:", responseText);
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to parse API response",
        });
      }
    } catch (error) {
      console.error("Error in sendVmMessage:", error);
      
      if (error instanceof TRPCError) {
        throw error;
      }
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Error: ${error.message || "Unknown error"}`,
      });
    }
  });
