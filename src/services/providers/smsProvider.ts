import { ProviderDeliveryResult } from "@/types/communication";

export interface SMSSendParams {
  recipientPhone: string;
  message: string;
  language: "English" | "Hindi";
  alertId: string;
  simulate?: boolean;
}

/**
 * Server-side SMS gateway provider abstraction.
 * Never fabricates real external delivery:
 * - If `simulate === true` (Demo Mode), returns status="SIMULATED" with explicit "SIMULATED DELIVERY" label.
 * - If SMS_API_URL or SMS_API_KEY is not configured in environment variables,
 *   returns status="NOT_CONFIGURED" with explicit reason:
 *   "External SMS gateway is not configured. Message preview generated only."
 */
export async function sendSMSMessage(
  params: SMSSendParams
): Promise<ProviderDeliveryResult> {
  const requestTimestamp = new Date().toISOString();
  const providerName = (process.env.SMS_PROVIDER || "").trim();
  const apiUrl = (process.env.SMS_API_URL || "").trim();
  const apiKey = (process.env.SMS_API_KEY || "").trim();

  // 1. Explicit Demo Mode / Simulated Delivery path
  if (params.simulate) {
    const responseTimestamp = new Date().toISOString();
    return {
      status: "SIMULATED",
      delivery_label: "SIMULATED DELIVERY",
      provider: providerName || "SMS_DEMO_SIMULATOR",
      provider_message_id: `sim-sms-${params.alertId}-${Date.now()}`,
      request_timestamp: requestTimestamp,
      response_timestamp: responseTimestamp,
      reason:
        "SIMULATED DELIVERY — Demo Mode active. SMS logged locally without contacting external SMS gateway.",
      error_code: null,
    };
  }

  // 2. Honest NOT_CONFIGURED path when external credentials are absent
  if (!apiUrl || !apiKey) {
    const responseTimestamp = new Date().toISOString();
    return {
      status: "NOT_CONFIGURED",
      delivery_label: "NOT_CONFIGURED",
      provider: providerName || "SMS_UNCONFIGURED",
      provider_message_id: null,
      request_timestamp: requestTimestamp,
      response_timestamp: responseTimestamp,
      reason:
        "External SMS gateway is not configured. Message preview generated only.",
      error_code: "PROVIDER_CREDENTIALS_MISSING",
    };
  }

  // 3. Real external HTTP dispatch only when SMS_API_URL and SMS_API_KEY are present
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to: params.recipientPhone,
        message: params.message,
        unicode: params.language === "Hindi",
      }),
    });

    const responseTimestamp = new Date().toISOString();
    if (!response.ok) {
      return {
        status: "FAILED",
        delivery_label: "DELIVERY FAILED",
        provider: providerName || "SMS_GATEWAY_API",
        provider_message_id: null,
        request_timestamp: requestTimestamp,
        response_timestamp: responseTimestamp,
        reason: `SMS gateway returned HTTP ${response.status}`,
        error_code: `HTTP_${response.status}`,
      };
    }

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
    };
    const msgId = payload?.id || `sms-live-${Date.now()}`;
    return {
      status: "SENT",
      delivery_label: "PROVIDER DELIVERED",
      provider: providerName || "SMS_GATEWAY_API",
      provider_message_id: msgId,
      request_timestamp: requestTimestamp,
      response_timestamp: responseTimestamp,
      reason: "SMS accepted by configured SMS gateway.",
      error_code: null,
    };
  } catch (err) {
    const responseTimestamp = new Date().toISOString();
    return {
      status: "FAILED",
      delivery_label: "DELIVERY FAILED",
      provider: providerName || "SMS_GATEWAY_API",
      provider_message_id: null,
      request_timestamp: requestTimestamp,
      response_timestamp: responseTimestamp,
      reason:
        err instanceof Error
          ? `SMS gateway network error: ${err.message}`
          : "SMS gateway network error",
      error_code: "NETWORK_EXCEPTION",
    };
  }
}
