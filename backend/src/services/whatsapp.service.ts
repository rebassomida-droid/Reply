import twilio from 'twilio';
import axios from 'axios';

// Supporta sia Twilio WhatsApp che Meta WhatsApp Cloud API
export type WhatsAppProvider = 'twilio' | 'meta';

function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

export async function sendMessage(to: string, body: string): Promise<string> {
  const provider = (process.env.WHATSAPP_PROVIDER || 'twilio') as WhatsAppProvider;

  if (provider === 'twilio') {
    const client = getTwilioClient();
    const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || '';
    const message = await client.messages.create({
      from: `whatsapp:${fromNumber}`,
      to: `whatsapp:${to}`,
      body,
    });
    return message.sid;
  }

  if (provider === 'meta') {
    // Meta WhatsApp Cloud API
    const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    const token = process.env.META_ACCESS_TOKEN;
    const res = await axios.post(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to.replace('+', ''),
        type: 'text',
        text: { body },
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return res.data.messages?.[0]?.id || '';
  }

  throw new Error(`Provider WhatsApp non supportato: ${provider}`);
}

// Verifica la firma del webhook Twilio
export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  if (!accountSid || !authToken) return true; // Non valida in assenza di credenziali (dev)
  return twilio.validateRequest(authToken, signature, url, params);
}

// Verifica il token del webhook Meta
export function validateMetaWebhook(
  mode: string,
  token: string,
  challenge: string
): string | null {
  const verifyToken = process.env.META_VERIFY_TOKEN || '';
  if (mode === 'subscribe' && token === verifyToken) return challenge;
  return null;
}
