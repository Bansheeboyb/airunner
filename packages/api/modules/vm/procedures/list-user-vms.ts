import { protectedProcedure } from "../../trpc";
import { google } from "googleapis";

export const listUserVms = protectedProcedure.query(async ({ ctx }) => {
  try {
    const { user } = ctx;
    const organizationId = user.organizationId || "default-org";

    // Authenticate with GCP
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const projectId = await auth.getProjectId();
    const authClient = await auth.getClient();

    // Create Compute Engine client
    const compute = google.compute({
      version: "v1",
      auth: authClient,
    });

    // List VMs in all zones with organization filter
    const zones = [
      "us-central1-a",
      "us-east1-b",
      "us-west1-a",
      "us-west4-b",
      "europe-west4-a",
      "asia-northeast3-b",
    ];

    let allVms = [];

    // For each zone, get VMs
    for (const zone of zones) {
      try {
        const response = await compute.instances.list({
          project: projectId,
          zone,
          filter: `labels.organization_id=${organizationId
            .replace(/[^a-z0-9\-_]/gi, "-")
            .toLowerCase()}`,
        });

        if (response.data.items) {
          allVms = [
            ...allVms,
            ...response.data.items.map((vm) => ({
              ...vm,
              zone,
            })),
          ];
        }
      } catch (error) {
        console.warn(`Error listing VMs in zone ${zone}:`, error);
        // Continue with other zones
      }
    }

    return {
      status: "success",
      vms: allVms,
    };
  } catch (error) {
    console.error("Error listing VMs:", error);
    throw new Error(error.message || "Unknown error listing VMs");
  }
});
