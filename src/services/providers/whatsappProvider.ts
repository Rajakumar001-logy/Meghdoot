import { ProviderDeliveryResult } from "@/types/communication";

export interface WhatsAppSendParams {
  recipientPhone: string;
  message: string;
  language: "English" | "Hindi";
  alertId: string;
  simulate?: boolean;
}

/**
 * Server-side WhatsApp provider abstraction.
 * Never fabricates real external delivery:
 * - If `simulate === true` (Demo Mode), returns status="SIMULATED" with explicit "SIMULATED DELIVERY" label.
 * - If WHATSAPP_API_URL or WHATSAPP_ACCESS_TOKEN is not configured in environment variables,
 *   returns status="NOT_CONFIGURED" with explicit reason:
 *   "External WhatsApp provider is not configured. Message preview generated only."
 */
export async function sendWhatsAppMessage(
  params: WhatsAppSendParams
): Promise<ProviderDeliveryResult> {
  const requestTimestamp = new Date().toISOString();
  const providerName = (process.env.WHATSAPP_PROVIDER || "").trim();
  const apiUrl = (process.env.WHATSAPP_API_URL || "").trim();
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || "").trim();

  // 1. Explicit Demo Mode / Simulated Delivery path
  if (params.simulate) {
    const responseTimestamp = new Date().toISOString();
    return {
      status: "SIMULATED",
      delivery_label: "SIMULATED DELIVERY",
      provider: providerName || "WHATSAPP_DEMO_SIMULATOR",
      provider_message_id: `sim-wa-${params.alertId}-${Date.now()}`,
      request_timestamp: requestTimestamp,
      response_timestamp: responseTimestamp,
      reason:
        "SIMULATED DELIVERY — Demo Mode active. Message logged locally without contacting external WhatsApp gateway.",
      error_code: null,
    };
  }

  // 2. Honest NOT_CONFIGURED path when external credentials are absent
  if (!apiUrl || !accessToken) {
    const responseTimestamp = new Date().toISOString();
    return {
      status: "NOT_CONFIGURED",
      delivery_label: "NOT_CONFIGURED",
      provider: providerName || "WHATSAPP_UNCONFIGURED",
      provider_message_id: null,
      request_timestamp: requestTimestamp,
      response_timestamp: responseTimestamp,
      reason:
        "External WhatsApp provider is not configured. Message preview generated only.",
      error_code: "PROVIDER_CREDENTIALS_MISSING",
    };
  }

  // 3. Real external HTTP dispatch only when WHATSAPP_API_URL and WHATSAPP_ACCESS_TOKEN are present
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: params.recipientPhone,
        type: "text",
        text: { body: params.message },
      }),
    });

    const responseTimestamp = new Date().toISOString();
    if (!response.ok) {
      return {
        status: "FAILED",
        delivery_label: "DELIVERY FAILED",
        provider: providerName || "WHATSAPP_CLOUD_API",
        provider_message_id: null,
        request_timestamp: requestTimestamp,
        response_timestamp: responseTimestamp,
        reason: `WhatsApp provider returned HTTP ${response.status}`,
        error_code: `HTTP_${response.status}`,
      };
    }

    const payload = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
    };
    const msgId = payload?.messages?.[0]?.id || `wa-live-${Date.now()}`;
    return {
      status: "SENT",
      delivery_label: "PROVIDER DELIVERED",
      provider: providerName || "WHATSAPP_CLOUD_API",
      provider_message_id: msgId,
      request_timestamp: requestTimestamp,
      response_timestamp: responseTimestamp,
      reason: "Message accepted by configured WhatsApp gateway.",
      error_code: null,
    };
  } catch (err) {
    const responseTimestamp = new Date().toISOString();
    return {
      status: "FAILED",
      delivery_label: "DELIVERY FAILED",
      provider: providerName || "WHATSAPP_CLOUD_API",
      provider_message_id: null,
      request_timestamp: requestTimestamp,
      response_timestamp: responseTimestamp,
      reason:
        err instanceof Error
          ? `WhatsApp gateway network error: ${err.message}`
          : "WhatsApp gateway network error",
      error_code: "NETWORK_EXCEPTION",
    };
  }
}
