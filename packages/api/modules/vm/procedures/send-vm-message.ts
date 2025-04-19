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
        
        // Use HTTP endpoint to avoid SSL certificate validation issues
        apiEndpoint = `http://${accessConfig.natIP}:8000/api/generate`;
        
        // Get API endpoint directly from VM labels if available
        if (vm.labels && "api_endpoint" in vm.labels) {
          apiEndpoint = vm.labels.api_endpoint;
        }
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
      console.log(`Sending request to VM API endpoint: ${apiEndpoint}`);
      console.log(`Request payload: ${JSON.stringify(payload)}`);
      console.log(`Using X-API-Key authentication (key prefix: ${apiKey.substring(0, 5)}...)`);
      
      // Get agent package version (node-fetch might vary by environment)
      const agent = typeof process !== 'undefined' && process.versions 
        ? `Node.js ${process.version}` 
        : 'unknown';
      
      let response;
      try {
        response = await fetch(apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey, // Use X-API-Key header for authentication
            "User-Agent": `AIRunner/1.0 (${agent})`,
          },
          body: JSON.stringify(payload),
          timeout: 60000, // 60 second timeout for longer responses
        });
        console.log(`Response status: ${response.status} ${response.statusText}`);
      } catch (fetchError) {
        console.error("Network error during fetch:", fetchError);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Network error connecting to VM: ${fetchError.message}`,
        });
      }

      // Handle response - provide specific error messages for common issues
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error from VM API: ${response.status} - ${errorText}`);
        
        // Handle specific HTTP error codes
        if (response.status === 401 || response.status === 403) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Unauthorized: The API key was rejected. Check that the API key is correct and active.",
          });
        } else if (response.status === 404) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "The VM API endpoint could not be found. It may be unavailable or misconfigured.",
          });
        } else if (response.status === 429) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Rate limit exceeded. Please try again later.",
          });
        } else if (response.status >= 500) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "The VM server encountered an error. Please try again later.",
          });
        } else {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Error from VM: ${response.statusText || 'Unknown error'} (${response.status})`,
          });
        }
      }

      // Parse and return the VM's response
      let result;
      try {
        const responseText = await response.text();
        console.log("Received raw response:", responseText);
        
        // Try to parse as JSON, but handle text responses too
        try {
          result = JSON.parse(responseText);
        } catch (e) {
          // If it's not valid JSON, use the raw text as the response
          console.log("Response was not valid JSON, using as raw text");
          return {
            text: responseText,
            usage: null,
            model: vm.labels?.model_name || "unknown",
          };
        }
      } catch (error) {
        console.error("Error parsing response:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Error parsing response: ${error.message}`,
        });
      }
      
      console.log("Parsed response from VM API:", result);
      
      // First, let's log the entire response structure to help debug
      console.log("Full response structure:", JSON.stringify(result, null, 2));
      
      // Extract the actual text from whichever field it's in
      let responseText = null;
      let usage = null;
      let modelInfo = vm.labels?.model_name || "unknown";
      
      // Directly handle the Phi model format which uses generated_text
      if (result && typeof result === 'object') {
        // Standard fields
        if (result.generated_text !== undefined) {
          responseText = result.generated_text;
        } else if (result.text !== undefined) {
          responseText = result.text;
        } else if (result.output !== undefined) {
          responseText = result.output;
        } else if (result.response !== undefined) {
          responseText = result.response;
        } else if (result.content !== undefined) {
          responseText = result.content;
        } else if (result.message !== undefined) {
          responseText = result.message;
        } else if (result.generation !== undefined) {
          responseText = result.generation;
        } else if (result.choices && result.choices.length > 0) {
          // OpenAI format
          responseText = result.choices[0].message?.content || result.choices[0].text;
        } 
        
        // Get model info if available
        if (result.model) {
          modelInfo = result.model;
        } else if (result.model_id) {
          modelInfo = result.model_id;
        }
        
        // Get usage info if available
        if (result.usage) {
          usage = result.usage;
        }
      } else if (typeof result === 'string') {
        // If the result is just a string
        responseText = result;
      }
      
      // If we still don't have a response text, use the entire result
      if (!responseText) {
        console.warn("Unknown response format, using full response:", result);
        responseText = JSON.stringify(result);
      }
      
      // Return a standardized structure with the extracted data
      const response = {
        text: responseText,
        usage: usage,
        model: modelInfo,
      };
      
      console.log("Returning response object:", response);
      return response;
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
