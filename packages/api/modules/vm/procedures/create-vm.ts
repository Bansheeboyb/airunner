import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { google } from "googleapis";
import { createHash } from "crypto";
import { JWT } from "google-auth-library";

// Add a status check procedure
export const checkVmStatus = protectedProcedure
  .input(
    z.object({
      vmName: z.string(),
      zone: z.string(),
    }),
  )
  .query(async ({ input }) => {
    try {
      console.log("Starting VM status check for:", input.vmName);

      // Fix private key newline formatting issues
      let privateKey = process.env.GCP_PRIVATE_KEY || "";
      if (privateKey) {
        privateKey = privateKey.replace(/\\n/g, "\n");
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

      const projectId = process.env.GCP_PROJECT_ID;

      console.log("Sending status check request for VM:", input.vmName);
      console.log("Zone:", input.zone);
      console.log("Project ID:", projectId);

      // Make the API call to get VM status
      const response = await compute.instances.get({
        project: projectId,
        zone: input.zone,
        instance: input.vmName,
      });

      // Detailed logging of response
      console.log("VM status check response received");
      console.log("Response type:", typeof response.data);
      console.log("Response keys:", Object.keys(response.data));

      // Log specific important fields
      console.log("VM status:", response.data.status);
      console.log("VM zone:", response.data.zone);
      console.log("VM id:", response.data.id);

      // Log network interface info if it exists
      if (
        response.data.networkInterfaces &&
        response.data.networkInterfaces.length > 0
      ) {
        console.log("Network interfaces available");
        try {
          const networkInterface = response.data.networkInterfaces[0];
          console.log("Network interface keys:", Object.keys(networkInterface));

          // Log access configs (for external IP)
          if (
            networkInterface.accessConfigs &&
            networkInterface.accessConfigs.length > 0
          ) {
            console.log("Access configs available");
            console.log(
              "External IP:",
              networkInterface.accessConfigs[0].natIP,
            );
          } else {
            console.log("No access configs found");
          }
        } catch (niError) {
          console.error("Error parsing network interfaces:", niError);
        }
      } else {
        console.log("No network interfaces found");
      }

      // Return a safer version of the response
      return {
        status: response.data.status || "UNKNOWN",
        id: response.data.id,
        zone: response.data.zone,
        name: response.data.name,
        externalIp:
          response.data.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP ||
          null,
        // Add any other fields you need
      };
    } catch (error) {
      console.error("Error checking VM status:", error);

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

      throw new Error(`Error checking status: ${error.message}`);
    }
  });

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
      // Optional server label for custom naming
      serverLabel: z.string().optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    try {
      // Get user and organization from the context
      const { user } = ctx;
      const organizationId = user.organizationId || "default-org";
      const userId = user.id;

      // Generate a unique instance ID for the VM
      const timestamp = new Date().getTime();
      const randomId = createHash("md5")
        .update(`${input.modelName}-${timestamp}-${Math.random()}`)
        .digest("hex")
        .substring(0, 8);

      // Use server label if provided, otherwise use model name
      const serverPrefix = input.serverLabel
        ? input.serverLabel.toLowerCase().replace(/[^a-z0-9\-]/g, "-")
        : input.modelName.toLowerCase().replace(/\s/g, "-");

      const vmName = `llm-${serverPrefix}-${randomId}`;

      // Create a server name with organization ID included for better organization
      const normalizedOrgId = organizationId
        .toLowerCase()
        .replace(/[^a-z0-9\-]/g, "-");

      // Domain for the API server (used in SSL certs)
      const serverName = `${randomId}.api.yourdomain.com`;
      const dnsZone = "yourdomain-com"; // Your DNS zone in Cloud DNS

      // Add debug logging to check environment variables
      console.log("GCP Auth Status:", !!process.env.GCP_PRIVATE_KEY);
      console.log("Project ID:", process.env.GCP_PROJECT_ID);
      console.log(
        "Service Account Email:",
        process.env.GCP_SERVICE_ACCOUNT_EMAIL,
      );
      console.log("VM Name:", vmName);
      console.log("Server Name:", serverName);

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
      const vmConfig = {
        name: vmName,
        machineType: machineType,
        tags: {
          items: [
            "http-server",
            "https-server",
            `team-${input.teamId.replace(/[^a-z0-9\-_]/gi, "-").toLowerCase()}`,
            `instance-${randomId}`, // For DNS and certificate automation
          ],
        },
        // Add labels for organization and user tracking
        labels: {
          organization_id: normalizedOrgId,
          user_id: userId.replace(/[^a-z0-9\-_]/gi, "-").toLowerCase(),
          created_by: "supastarter",
          model_name: input.modelName.toLowerCase().replace(/\s/g, "-"),
          team_id: input.teamId.replace(/[^a-z0-9\-_]/gi, "-").toLowerCase(),
          server_name: serverName.replace(/\./g, "-"), // Store the server name in labels
          instance_id: randomId, // Store instance ID for reference
        },
        disks: [
          {
            boot: true,
            autoDelete: true,
            initializeParams: {
              sourceImage: "projects/cos-cloud/global/images/family/cos-stable",
              diskSizeGb: "30", // Increased to accommodate SSL certs
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
    - image: gcr.io/${projectId}/phi-ssl-api:latest
      name: llm-container
      securityContext:
        privileged: true
      env:
        - name: MODEL_ID
          value: "microsoft/Phi-4-mini-instruct"
        - name: ORGANIZATION_ID
          value: "${organizationId}"
        - name: USER_ID
          value: "${userId}"
        - name: HF_TOKEN
          value: "${process.env.HF_TOKEN || ""}"
        - name: DOMAIN_NAME
          value: "${serverName}"
        - name: DNS_ZONE
          value: "${dnsZone}"
        - name: GCP_PROJECT_ID
          value: "${projectId}"
        - name: MAX_INPUT_LENGTH
          value: "4096"
        - name: MAX_TOTAL_TOKENS
          value: "8192"
        - name: NUM_THREADS
          value: "${input.cpuCount}"
        - name: TEMPERATURE
          value: "0.7"
        - name: ENABLE_HTTPS
          value: "true"
      ports:
        - containerPort: 80
        - containerPort: 443
        - containerPort: 8000
      volumeMounts:
        - name: gcp-credentials
          mountPath: /app/gcp-credentials.json
          readOnly: true
      stdin: false
      tty: false
  volumes:
    - name: gcp-credentials
      hostPath:
        path: /tmp/gcp-credentials-${randomId}.json
  restartPolicy: Always
              `,
            },
            {
              key: "startup-script",
              value: `
#!/bin/bash
set -e
set -x

# Function to log with timestamps
log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log "Starting VM initialization"

# Create service account credentials for DNS validation
log "Setting up service account for DNS validation..."
gcloud iam service-accounts keys create /tmp/gcp-credentials-${randomId}.json \\
  --iam-account=${process.env.GCP_SERVICE_ACCOUNT_EMAIL} || log "Error creating service account key"

# Fix permissions
chmod 600 /tmp/gcp-credentials-${randomId}.json

# Create firewall rules if they don't exist
log "Setting up firewall rules..."
# Allow HTTP, HTTPS and API port
gcloud compute firewall-rules describe allow-http || \\
gcloud compute firewall-rules create allow-http \\
  --direction=INGRESS \\
  --priority=1000 \\
  --network=default \\
  --action=ALLOW \\
  --rules=tcp:80 \\
  --source-ranges=0.0.0.0/0

gcloud compute firewall-rules describe allow-https || \\
gcloud compute firewall-rules create allow-https \\
  --direction=INGRESS \\
  --priority=1000 \\
  --network=default \\
  --action=ALLOW \\
  --rules=tcp:443 \\
  --source-ranges=0.0.0.0/0

gcloud compute firewall-rules describe allow-phi-api || \\
gcloud compute firewall-rules create allow-phi-api \\
  --direction=INGRESS \\
  --priority=1000 \\
  --network=default \\
  --action=ALLOW \\
  --rules=tcp:8000 \\
  --source-ranges=0.0.0.0/0

# Ensure Docker is functioning properly
log "Verifying Docker is operational..."
if ! docker info > /dev/null 2>&1; then
  log "ERROR: Docker is not running properly!"
  systemctl restart docker
  sleep 5
fi

# Verify credential file exists with proper permissions
log "Verifying credential file..."
if [ -f "/tmp/gcp-credentials-${randomId}.json" ]; then
  log "Credential file exists, checking permissions"
  ls -la /tmp/gcp-credentials-${randomId}.json
else
  log "ERROR: Credential file not found, attempting to create again"
  SERVICE_ACCOUNT=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email" -H "Metadata-Flavor: Google")
  gcloud iam service-accounts keys create /tmp/gcp-credentials-${randomId}.json \\
    --iam-account="$SERVICE_ACCOUNT" || log "Error creating service account key with default account"
  chmod 600 /tmp/gcp-credentials-${randomId}.json
fi

# Stop any existing container to ensure clean start
log "Stopping any existing containers"
docker ps | grep llm-container && docker stop $(docker ps -q --filter "name=llm-container") || log "No containers to stop"
docker ps -a | grep llm-container && docker rm $(docker ps -a -q --filter "name=llm-container") || log "No containers to remove"

# Update IPtables to allow all needed traffic
log "Updating IPtables firewall rules - allowing traffic on needed ports"
iptables -w -A INPUT -p tcp --dport 8000 -j ACCEPT
iptables -w -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -w -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -w -A INPUT -p udp --dport 53 -j ACCEPT

log "VM ${vmName} started with server name ${serverName}"
log "Setup complete! The application should be accessible soon."
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

      // Return the operation data with HTTPS endpoint
      return {
        status: "success",
        vmName: vmName,
        operationId: response.data.id || "unknown",
        apiEndpoint: `https://${serverName}`, // Now using HTTPS
        message: "VM creation initiated",
        organizationId,
        userId,
        zone: zoneStr,
        serverName: serverName,
        instanceId: randomId,
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
