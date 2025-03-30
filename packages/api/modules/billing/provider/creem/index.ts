import { logger } from "logs";
import { joinURL } from "ufo";
import type {
  CancelSubscription,
  CreateCheckoutLink,
  CreateCustomerPortalLink,
  GetAllPlans,
  PauseSubscription,
  ResumeSubscription,
  SubscriptionPlan,
} from "../../types";

type CreemProduct = {
  id: string;
  name: string;
  description: string;
  image_url: string;
  price: number;
  currency: string;
  billing_type: string;
  billing_period: string;
  status: string;
  tax_mode: string;
  tax_category: string;
  default_success_url: string;
  created_at: string;
  updated_at: string;
  mode: string;
};

export function creemFetch(path: string, init: Parameters<typeof fetch>[1]) {
  const creemApiKey = process.env.CREEM_API_KEY as string;

  if (!creemApiKey) {
    throw new Error("Missing env variable CREEM_API_KEY");
  }

  const baseUrl =
    process.env.NODE_ENV === "production"
      ? "https://api.creem.io/v1"
      : "https://test-api.creem.io/v1";

  const requestUrl = joinURL(baseUrl, path);

  return fetch(requestUrl, {
    ...init,
    headers: {
      "x-api-key": creemApiKey,
      "Content-Type": "application/json",
    },
  });
}

export const getAllPlans: GetAllPlans = async function () {
  const response = await creemFetch("/products/search", {
    method: "GET",
  });
  const plans: SubscriptionPlan[] = [];
  const responseJson = await response.json();
  const { items } = responseJson as { items: CreemProduct[] };
  for (const item of items) {
    plans.push({
      id: item.id,
      description: item.description,
      name: item.name,
      storeId: "",
      variants: [
        {
          id: item.id,
          interval: item.billing_period === "every-month" ? "month" : "year",
          currency: item.currency,
          interval_count: 1,
          price: item.price,
        },
      ],
    });
  }
  return plans;
};

export const createCheckoutLink: CreateCheckoutLink = async function ({
  variantId,
  teamId,
  redirectUrl,
  email,
  name,
}) {
  const response = await creemFetch("/checkouts", {
    method: "POST",
    body: JSON.stringify({
      product_id: variantId,
      success_url: redirectUrl ?? undefined,
      metadata: {
        teamId: teamId || null,
      },
      customer: {
        email,
      },
    }),
  });

  if (!response.ok) {
    logger.error("Failed to create checkout link", await response.json());
    throw new Error("Failed to create checkout link");
  }

  const { checkout_url } = await response.json();

  return checkout_url;
};

export const createCustomerPortalLink: CreateCustomerPortalLink = async ({
  customerId,
  redirectUrl,
}) => {
  const response = await creemFetch("/customers/billing", {
    method: "POST",
    body: JSON.stringify({
      customer_id: customerId,
    }),
  });

  const { customer_portal_link } = await response.json();

  return customer_portal_link;
};

export const pauseSubscription: PauseSubscription = async ({ id }) => {
  // TODO: Creem doesn't seem to support pause subscription
};

export const cancelSubscription: CancelSubscription = async ({ id }) => {
  await creemFetch(`/subscriptions/${id}/cancel`, {
    method: "POST",
  });
};

export const resumeSubscription: ResumeSubscription = async ({ id }) => {
  // TODO: Creem doesn't seem to support resume subscription
  return {
    status: "ACTIVE",
  };
};
