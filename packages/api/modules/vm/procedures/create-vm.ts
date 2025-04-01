import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { google } from "googleapis";
import { createHash } from "crypto";
import { JWT } from "google-auth-library";

export const createVm = protectedProcedure
  .input(
    z.object({
      modelName: z.string(),
      cpuCount: z.number().int().positive(),
      memoryGB: z.number().int().positive(),
      gpuType: z.string().optional(),
      gpuCount: z.number().int().optional(),
      region: z.string().default("us-central1"),
      teamId: z.string(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    try {
      // Get user and organization from the context
      const { user } = ctx;
      const organizationId = user.organizationId || "default-org";
      const userId = user.id;

      // Generate a unique ID for the VM
      const timestamp = new Date().getTime();
      const uniqueId = createHash("md5")
        .update(`${input.modelName}-${timestamp}`)
        .digest("hex")
        .substring(0, 8);

      const vmName = `llm-${input.modelName
        .toLowerCase()
        .replace(/\s/g, "-")}-${uniqueId}`;

      // Add debug logging to check environment variables
      console.log("GCP Auth Status:", !!process.env.GCP_PRIVATE_KEY);
      console.log("Project ID:", process.env.GCP_PROJECT_ID);
      console.log(
        "Service Account Email:",
        process.env.GCP_SERVICE_ACCOUNT_EMAIL,
      );

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

      // Log successful auth setup
      console.log(
        "GCP Auth setup complete for project:",
        process.env.GCP_PROJECT_ID,
      );

      // Use project ID from environment
      const projectId = process.env.GCP_PROJECT_ID;

      // Configure machine type based on parameters
      const zoneStr = input.region.includes("-")
        ? input.region
        : `${input.region}-a`;
      const machineType = `zones/${zoneStr}/machineTypes/custom-${
        input.cpuCount
      }-${input.memoryGB * 1024}`;

      // Define VM creation parameters
      const vmConfig: {
        name: string;
        machineType: string;
        tags: { items: string[] };
        labels: { [key: string]: string };
        disks: {
          boot: boolean;
          autoDelete: boolean;
          initializeParams: { sourceImage: string; diskSizeGb: string };
        }[];
        networkInterfaces: {
          network: string;
          accessConfigs: { type: string; name: string }[];
        }[];
        metadata: {
          items: { key: string; value: string }[];
        };
        scheduling: {
          preemptible: boolean;
          onHostMaintenance?: string;
        };
        serviceAccounts: {
          email: string;
          scopes: string[];
        }[];
        guestAccelerators?: {
          acceleratorType: string;
          acceleratorCount: number;
        }[];
      } = {
        name: vmName,
        machineType: machineType,
        tags: {
          items: [
            "http-server",
            "https-server",
            `team-${input.teamId.replace(/[^a-z0-9\-_]/gi, "-").toLowerCase()}`,
          ],
        },
        // Add labels for organization and user tracking
        labels: {
          organization_id: organizationId
            .replace(/[^a-z0-9\-_]/gi, "-")
            .toLowerCase(),
          user_id: userId.replace(/[^a-z0-9\-_]/gi, "-").toLowerCase(),
          created_by: "supastarter",
          model_name: input.modelName.toLowerCase().replace(/\s/g, "-"),
          team_id: input.teamId.replace(/[^a-z0-9\-_]/gi, "-").toLowerCase(),
        },
        disks: [
          {
            boot: true,
            autoDelete: true,
            initializeParams: {
              sourceImage: "projects/cos-cloud/global/images/family/cos-stable",
              diskSizeGb: "20",
            },
          },
        ],
        networkInterfaces: [
          {
            network: "global/networks/default",
            accessConfigs: [
              {
                type: "ONE_TO_ONE_NAT",
                name: "External NAT",
              },
            ],
          },
        ],
        metadata: {
          items: [
            {
              key: "gce-container-declaration",
              value: `
spec:
  containers:
    - image: gcr.io/${projectId}/${input.modelName
                .toLowerCase()
                .replace(/\s/g, "-")}:latest
      name: llm-container
      env:
        - name: MODEL_NAME
          value: "${input.modelName}"
        - name: ORGANIZATION_ID
          value: "${organizationId}"
        - name: USER_ID
          value: "${userId}"
        - name: HF_TOKEN
          value: "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" 
      stdin: false
      tty: false
  restartPolicy: Always
              `,
            },
            {
              key: "startup-script",
              value: `
#!/bin/bash
# Expose the API port
iptables -w -A INPUT -p tcp --dport 8000 -j ACCEPT
              `,
            },
          ],
        },
        scheduling: {
          preemptible: false,
        },
        serviceAccounts: [
          {
            email: "default",
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
          },
        ],
      };

      // Add GPU configuration if requested
      if (input.gpuType && input.gpuCount && input.gpuCount > 0) {
        vmConfig.guestAccelerators = [
          {
            acceleratorType: `zones/${zoneStr}/acceleratorTypes/${input.gpuType}`,
            acceleratorCount: input.gpuCount,
          },
        ];

        // GPU requires a specific scheduling policy
        vmConfig.scheduling.onHostMaintenance = "TERMINATE";
      }

      // Log VM creation attempt
      console.log("Attempting to create VM:", vmName, "in zone:", zoneStr);

      // Make the API call to create the VM
      const response = await compute.instances.insert({
        project: projectId,
        zone: zoneStr,
        requestBody: vmConfig,
      });

      console.log("VM creation successful, operation ID:", response.data.id);

      // Return the operation data
      return {
        status: "success",
        vmName: vmName,
        operationId: response.data.id || "unknown",
        apiEndpoint: null, // Will be populated once VM is ready
        message: "VM creation initiated",
        organizationId,
        userId,
      };
    } catch (error) {
      console.error("Error creating VM:", error);
      // More detailed error logging
      if (error.response) {
        console.error("Response error data:", error.response.data);
        console.error("Response error status:", error.response.status);
      }
      throw new Error(error.message || "Unknown error creating VM");
    }
  });
