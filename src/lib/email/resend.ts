import { Resend } from 'resend';

let resendInstance: Resend | null = null;

export function getResend(): Resend {
  if (!resendInstance) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(template: EmailTemplate) {
  const resend = getResend();

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'AxlesAI <noreply@axles.ai>',
    to: template.to,
    subject: template.subject,
    html: template.html,
  });

  if (error) {
    console.error('Email send error:', error);
    throw error;
  }

  return data;
}
