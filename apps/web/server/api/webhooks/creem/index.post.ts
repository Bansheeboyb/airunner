import { createAdminApiCaller } from "api/modules/trpc";
import type { SubscriptionStatusType } from "database";
import { createHmac } from "node:crypto";
import type { CreemWebhookData } from "./types";

export default defineEventHandler(async (event) => {
  try {
    const signature = getHeader(event, "creem-signature");
    if (!signature) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing signature.",
      });
    }

    const secret = process.env.CREEM_WEBHOOK_SECRET as string;
    if (!secret) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing webhook secret.",
      });
    }

    const bodyText = await readRawBody(event, "utf8");

    if (!bodyText) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing request body.",
      });
    }

    const computedSignature = createHmac("sha256", secret)
      .update(bodyText)
      .digest("hex");

    if (computedSignature !== signature) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid signature.",
      });
    }

    const payload = JSON.parse(bodyText!) as CreemWebhookData | null;
    const type = payload?.eventType ?? null;
    if (
      !type ||
      ![
        "subscription.active",
        "subscription.canceled",
        "subscription.update",
      ].includes(type)
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid event type.",
      });
    }

    const statusMap: Record<string, SubscriptionStatusType> = {
      active: "ACTIVE",
      unpaid: "UNPAID",
      canceled: "CANCELED",
      trialing: "TRIALING",
      paused: "PAUSED",
    };

    const apiCaller = await createAdminApiCaller();
    const subscription = payload?.object;
    if (!subscription?.metadata.teamId) {
      throw new Error("Invalid payload.");
    }
    const selectedPlanId = subscription.product.id;

    await apiCaller.billing.syncSubscription({
      id: subscription.id,
      teamId: subscription.metadata.teamId,
      customerId: subscription.customer.id,
      planId: String(selectedPlanId),
      variantId: String(selectedPlanId),
      status: statusMap[subscription.status],
      nextPaymentDate: new Date(subscription.current_period_end_date),
    });
  } catch (error: unknown) {
    return sendError(
      event,
      createError({
        statusCode: 400,
        statusMessage: `Webhook error: ${
          error instanceof Error ? error.message : ""
        }`,
      }),
    );
  }
  setResponseStatus(event, 204);
  return null;
});
