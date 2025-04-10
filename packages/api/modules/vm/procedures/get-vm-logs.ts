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
      instanceId: z.string().optional(), // Add this to accept numeric instance ID
      filter: z.string().optional(),
      limit: z.number().default(100),
      pageToken: z.string().optional(),
      orderBy: z.string().optional(),
    }),
  )
  .query(async ({ input }) => {
    try {
      console.log("Starting VM logs fetch for:", input.vmName);
      const { vmName, zone, pageToken, limit, instanceId } = input;
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

        // In development, return mock data instead of failing
        if (process.env.NODE_ENV === "development") {
          console.log(
            "Using mock log data for development environment (GCP credentials not available)",
          );
          return createMockLogResponse(vmName, limit, pageToken);
        }

        throw new Error("Invalid or missing GCP credentials");
      }

      const projectId = process.env.GCP_PROJECT_ID;

      // Create JWT client with service account credentials
      const client = new JWT({
        email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });

      // Improved filter that tries multiple possible instance identifiers
      let filter =
        input.filter ||
        `resource.type="gce_instance" AND (resource.labels.instance_id="${vmName}"`;

      // Add instanceId to filter if provided
      if (instanceId) {
        filter += ` OR resource.labels.instance_id="${instanceId}"`;
      }

      // Add additional possible filter conditions
      filter += ` OR labels.instance_name="${vmName}")`;

      // Define the order by clause (default to timestamp desc)
      const orderBy = input.orderBy || "timestamp desc";

      console.log("Fetching logs with filter:", filter);
      console.log("Page size:", pageSize);
      console.log("Page token:", pageToken);
      console.log("Instance ID (if provided):", instanceId);

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
      console.log(
        "Response data sample:",
        JSON.stringify(response.data).substring(0, 500),
      );

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

      // In development, return mock data instead of failing
      if (process.env.NODE_ENV === "development") {
        console.log(
          "Error occurred, using mock log data for development environment",
        );
        return createMockLogResponse(vmName, limit, pageToken);
      }

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
  if (
    entry.protoPayload &&
    entry.protoPayload.status &&
    entry.protoPayload.status.message
  ) {
    return entry.protoPayload.status.message;
  }

  // Last resort: Use insertId as a placeholder
  if (entry.insertId) {
    return `Log entry ${entry.insertId}`;
  }

  return "No message available";
}

// Helper function to create mock log response data
function createMockLogResponse(
  vmName: string,
  limit: number = 100,
  pageToken?: string,
): VMLogsResponse {
  // Create some realistic log entries
  const mockSeverities = ["INFO", "WARNING", "ERROR", "DEBUG", "NOTICE"];
  const mockMessages = [
    "Starting VM instance",
    "Downloading model files",
    "Initializing runtime environment",
    "Configuring network interfaces",
    "Loading model weights into memory",
    "Model loaded successfully",
    "Starting inference API server",
    "API server listening on port 8080",
    "Health check passed",
    "Processing inference request",
    "Request processed in 245ms",
    "High memory usage detected (85%)",
    "Rate limiting applied to incoming requests",
    "Connection from unauthorized IP blocked",
    "New client connection established",
  ];

  // Create random timestamps within the last hour
  const now = Date.now();

  // Create mock log entries
  const mockLogs: VMLogEntry[] = [];
  const pageSize = Math.min(limit, 100);

  // If there's a page token, use it to determine offset (simple implementation)
  const startIndex = pageToken ? parseInt(pageToken, 10) : 0;

  for (let i = 0; i < pageSize; i++) {
    const entryIndex = startIndex + i;
    const randomTimestamp = new Date(
      now - entryIndex * 60000 - Math.random() * 3600000,
    );
    const severity =
      mockSeverities[Math.floor(Math.random() * mockSeverities.length)];
    const message =
      mockMessages[Math.floor(Math.random() * mockMessages.length)];

    mockLogs.push({
      timestamp: randomTimestamp.toISOString(),
      severity: severity,
      message: message,
      textPayload: message,
      jsonPayload: {
        message: message,
        vmName: vmName,
        serviceName: "vm-agent",
        requestId: `req-${Math.random().toString(36).substring(2, 10)}`,
      },
      resource: {
        type: "gce_instance",
        labels: {
          instance_id: vmName,
          zone: "us-central1-a",
          project_id: "mock-project",
        },
      },
      source: vmName,
      insertId: `mock-log-${entryIndex}`,
      labels: {
        environment: "development",
      },
      trace: `projects/mock-project/traces/${Math.random()
        .toString(36)
        .substring(2, 15)}`,
    });
  }

  // Create next page token if we have more logs
  const hasMoreLogs = startIndex + pageSize < 500; // Pretend we have 500 logs total
  const nextPageToken = hasMoreLogs ? (startIndex + pageSize).toString() : null;

  return {
    logs: mockLogs,
    nextPageToken,
  };
}
