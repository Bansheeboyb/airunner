import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { JWT } from "google-auth-library";
import { google } from "googleapis";
import { VMLogEntry, VMLogsResponse } from "../types";

export const getVmLogs = protectedProcedure
  .input(
    z.object({
      vmName: z.string(),
      zone: z.string(),
      filter: z.string().optional(),
      limit: z.number().default(100),
      pageToken: z.string().optional(),
      orderBy: z.string().optional(),
    }),
  )
  .query(async ({ input }) => {
    try {
      console.log("Starting VM logs fetch for:", input.vmName);
      const { vmName, zone, pageToken, limit } = input;
      const pageSize = Math.min(limit, 1000); // Max 1000 entries per request
      const zoneStr = zone.includes("-") ? zone : `${zone}-a`;

      // Fix private key newline formatting issues
      let privateKey = process.env.GCP_PRIVATE_KEY || "";
      if (privateKey) {
        privateKey = privateKey.replace(/\\n/g, "\n");
      }

      // Check if we have valid credentials
      if (
        !privateKey ||
        !process.env.GCP_SERVICE_ACCOUNT_EMAIL ||
        !process.env.GCP_PROJECT_ID
      ) {
        console.error("Missing GCP credentials in environment variables");
        throw new Error("Invalid or missing GCP credentials");
      }

      const projectId = process.env.GCP_PROJECT_ID;

      // Create JWT client with service account credentials
      const client = new JWT({
        email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });

      // Define the filter for Logging API
      let filter = input.filter || `resource.type="gce_instance" resource.labels.instance_id="${vmName}"`;
      
      // Define the order by clause (default to timestamp desc)
      const orderBy = input.orderBy || "timestamp desc";

      console.log("Fetching logs with filter:", filter);
      console.log("Page size:", pageSize);
      console.log("Page token:", pageToken);

      // Use Logging API to fetch logs
      const logging = google.logging({
        version: "v2",
        auth: client,
      });

      // Make the entries.list request
      const response = await logging.entries.list({
        resourceNames: [`projects/${projectId}`],
        filter,
        pageSize,
        pageToken,
        orderBy,
      });

      // Process response
      const entries = response.data.entries || [];
      const nextPageToken = response.data.nextPageToken || null;

      console.log(`Fetched ${entries.length} log entries`);
      if (nextPageToken) {
        console.log("More logs available with next page token");
      }

      // Transform log entries for frontend consumption
      const processedEntries: VMLogEntry[] = entries.map((entry) => {
        // Use type casting to handle GCP logging entry
        const logEntry = entry as Record<string, any>;
        return {
          timestamp: logEntry.timestamp || new Date().toISOString(),
          severity: logEntry.severity || "DEFAULT",
          message: extractMessage(logEntry),
          textPayload: logEntry.textPayload,
          jsonPayload: logEntry.jsonPayload || {},
          resource: logEntry.resource || {},
          source: logEntry.resource?.labels?.instance_id || vmName,
          insertId: logEntry.insertId,
          labels: logEntry.labels || {},
          trace: logEntry.trace,
        };
      });

      const result: VMLogsResponse = {
        logs: processedEntries,
        nextPageToken,
      };
      
      return result;
    } catch (error) {
      console.error("Error fetching VM logs:", error);

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

      throw new Error(`Error fetching logs: ${error.message}`);
    }
  });

// Helper function to extract the primary message from a log entry
function extractMessage(entry: Record<string, any>): string {
  // Try to get message from jsonPayload (most common)
  if (entry.jsonPayload && entry.jsonPayload.message) {
    return entry.jsonPayload.message;
  }
  
  // Fall back to textPayload
  if (entry.textPayload) {
    return entry.textPayload;
  }
  
  // Fall back to protoPayload
  if (entry.protoPayload && entry.protoPayload.status && entry.protoPayload.status.message) {
    return entry.protoPayload.status.message;
  }

  // Last resort: Use insertId as a placeholder
  if (entry.insertId) {
    return `Log entry ${entry.insertId}`;
  }
  
  return "No message available";
}