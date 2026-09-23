import "server-only";

/**
 * Outbound channels. Each adapter is swappable: plug in your provider of choice
 * (Resend/SES for email, MSG91/Twilio for SMS, Gupshup/Meta Cloud API for WhatsApp)
 * by implementing `send`. Unconfigured channels are logged and recorded as SKIPPED.
 */
export type ExternalChannel = "EMAIL" | "SMS" | "WHATSAPP";

export type OutboundMessage = { to: string; subject: string; text: string };

export interface DeliveryAdapter {
  channel: ExternalChannel;
  provider: string;
  configured: boolean;
  send(message: OutboundMessage): Promise<{ providerMessageId?: string }>;
}

const resendEmail: DeliveryAdapter = {
  channel: "EMAIL",
  provider: "resend",
  get configured() {
    return !!process.env.RESEND_API_KEY;
  },
  async send({ to, subject, text }) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "SmashPoint <hello@smashpoint.in>", to, subject, text }),
    });
    if (!res.ok) throw new Error(`Email failed: ${res.status}`);
    const json = (await res.json()) as { id?: string };
    return { providerMessageId: json.id };
  },
};

function stub(channel: ExternalChannel, envKey: string, provider: string): DeliveryAdapter {
  return {
    channel,
    provider,
    get configured() {
      return !!process.env[envKey];
    },
    async send() {
      // Integrate your SMS / WhatsApp provider here.
      throw new Error(`${channel} provider not implemented`);
    },
  };
}

export const adapters: Record<ExternalChannel, DeliveryAdapter> = {
  EMAIL: resendEmail,
  SMS: stub("SMS", "SMS_PROVIDER_API_KEY", "sms-gateway"),
  WHATSAPP: stub("WHATSAPP", "WHATSAPP_PROVIDER_API_KEY", "whatsapp-business"),
};
