import { protectedProcedure } from "../../trpc";
import { google } from "googleapis";
import { JWT } from "google-auth-library";

export const listUserVms = protectedProcedure.query(async ({ ctx }) => {
  try {
    const { user } = ctx;
    const organizationId = user.organizationId || "default-org";

    console.log("Starting listUserVms for organization:", organizationId);

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

    const projectId = process.env.GCP_PROJECT_ID;
    console.log("Using GCP project ID:", projectId);

    // List VMs in all zones with organization filter
    const zones = [
      "us-central1-a",
      "us-east1-b",
      "us-west1-a",
      "us-west4-a", // Ensure exact match with zones used in creation
      "us-west4-b",
      "europe-west4-a",
      "asia-northeast3-b",
    ];

    let allVms = [];
    console.log("Searching for VMs in zones:", zones.join(", "));

    // For each zone, get VMs
    for (const zone of zones) {
      try {
        console.log(`Checking zone: ${zone}`);
        const response = await compute.instances.list({
          project: projectId,
          zone,
          filter: `labels.organization_id=${organizationId
            .replace(/[^a-z0-9\-_]/gi, "-")
            .toLowerCase()}`,
        });

        console.log(
          `Found ${response.data.items?.length || 0} VMs in zone ${zone}`,
        );

        if (response.data.items) {
          // Transform the response to a more serializable format
          const vmsInZone = response.data.items.map((vm) => ({
            id: vm.id,
            name: vm.name,
            zone: zone,
            status: vm.status,
            creationTimestamp: vm.creationTimestamp,
            machineType: vm.machineType,
            networkInterfaces: vm.networkInterfaces
              ? vm.networkInterfaces.map((ni) => ({
                  networkIP: ni.networkIP,
                  externalIP: ni.accessConfigs?.[0]?.natIP || null,
                }))
              : [],
            labels: vm.labels || {},
            metadata: vm.metadata
              ? {
                  fingerprint: vm.metadata.fingerprint,
                  items: vm.metadata.items || [],
                }
              : null,
          }));

          allVms = [...allVms, ...vmsInZone];
        }
      } catch (error) {
        console.warn(`Error listing VMs in zone ${zone}:`, error.message);
        // Continue with other zones
      }
    }

    console.log(`Total VMs found: ${allVms.length}`);
    return {
      status: "success",
      vms: allVms,
    };
  } catch (error) {
    console.error("Error listing VMs:", error);
    throw new Error(`Error listing VMs: ${error.message || "Unknown error"}`);
  }
});
