export type CreemWebhookData = {
  id: string;
  eventType: string;
  created_at: number;
  object: {
    id: string;
    object: string;
    product: {
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
    customer: {
      id: string;
      object: string;
      email: string;
      name: string;
      country: string;
      created_at: string;
      updated_at: string;
      mode: string;
    };
    items: Array<{
      object: string;
      id: string;
      product_id: string;
      price_id: string;
      units: number;
      created_at: string;
      updated_at: string;
      mode: string;
    }>;
    metadata: {
      teamId?: string;
    };
    collection_method: string;
    status: string;
    current_period_start_date: string;
    current_period_end_date: string;
    canceled_at: string;
    created_at: string;
    updated_at: string;
    mode: string;
  };
};
