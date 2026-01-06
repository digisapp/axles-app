const baseStyles = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1a1a1a;
  line-height: 1.6;
`;

const buttonStyles = `
  display: inline-block;
  background-color: #0066cc;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
`;

const containerStyles = `
  max-width: 600px;
  margin: 0 auto;
  padding: 40px 20px;
`;

const headerStyles = `
  text-align: center;
  margin-bottom: 32px;
`;

const footerStyles = `
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #e5e5e5;
  text-align: center;
  color: #666;
  font-size: 14px;
`;

export function newMessageEmail({
  recipientName,
  senderName,
  listingTitle,
  messagePreview,
  conversationUrl,
}: {
  recipientName: string;
  senderName: string;
  listingTitle: string;
  messagePreview: string;
  conversationUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="${containerStyles} background-color: white; border-radius: 12px;">
          <div style="${headerStyles}">
            <img src="${process.env.NEXT_PUBLIC_APP_URL}/images/axlesai-logo.png" alt="AxlesAI" height="40" style="height: 40px;">
          </div>

          <h1 style="font-size: 24px; margin-bottom: 16px;">New Message</h1>

          <p>Hi ${recipientName},</p>

          <p><strong>${senderName}</strong> sent you a message about:</p>

          <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="font-weight: 600; margin: 0 0 8px 0;">${listingTitle}</p>
            <p style="margin: 0; color: #666;">"${messagePreview}"</p>
          </div>

          <p style="text-align: center;">
            <a href="${conversationUrl}" style="${buttonStyles}">
              View Message
            </a>
          </p>

          <div style="${footerStyles}">
            <p>You received this email because you have an account on AxlesAI.</p>
            <p>&copy; ${new Date().getFullYear()} AxlesAI. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function listingPublishedEmail({
  sellerName,
  listingTitle,
  listingUrl,
}: {
  sellerName: string;
  listingTitle: string;
  listingUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="${containerStyles} background-color: white; border-radius: 12px;">
          <div style="${headerStyles}">
            <img src="${process.env.NEXT_PUBLIC_APP_URL}/images/axlesai-logo.png" alt="AxlesAI" height="40" style="height: 40px;">
          </div>

          <h1 style="font-size: 24px; margin-bottom: 16px;">Your Listing is Live!</h1>

          <p>Hi ${sellerName},</p>

          <p>Great news! Your listing is now live and visible to buyers:</p>

          <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="font-weight: 600; margin: 0;">${listingTitle}</p>
          </div>

          <p style="text-align: center;">
            <a href="${listingUrl}" style="${buttonStyles}">
              View Listing
            </a>
          </p>

          <h3 style="margin-top: 32px;">Tips to get more views:</h3>
          <ul style="color: #666;">
            <li>Add more photos</li>
            <li>Write a detailed description</li>
            <li>Set a competitive price</li>
            <li>Share on social media</li>
          </ul>

          <div style="${footerStyles}">
            <p>&copy; ${new Date().getFullYear()} AxlesAI. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function welcomeEmail({
  userName,
  dashboardUrl,
}: {
  userName: string;
  dashboardUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="${containerStyles} background-color: white; border-radius: 12px;">
          <div style="${headerStyles}">
            <img src="${process.env.NEXT_PUBLIC_APP_URL}/images/axlesai-logo.png" alt="AxlesAI" height="40" style="height: 40px;">
          </div>

          <h1 style="font-size: 24px; margin-bottom: 16px;">Welcome to AxlesAI!</h1>

          <p>Hi ${userName},</p>

          <p>Thank you for joining AxlesAI, the AI-powered marketplace for trucks, trailers, and heavy equipment.</p>

          <p style="text-align: center; margin: 32px 0;">
            <a href="${dashboardUrl}" style="${buttonStyles}">
              Get Started
            </a>
          </p>

          <h3>What you can do:</h3>
          <ul style="color: #666;">
            <li>Search with AI - Find equipment using natural language</li>
            <li>List your equipment - Sell trucks, trailers, and more</li>
            <li>Get price estimates - AI-powered market valuations</li>
            <li>Connect with buyers - Message sellers directly</li>
          </ul>

          <div style="${footerStyles}">
            <p>&copy; ${new Date().getFullYear()} AxlesAI. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function inquiryReceivedEmail({
  sellerName,
  buyerName,
  listingTitle,
  messagePreview,
  replyUrl,
}: {
  sellerName: string;
  buyerName: string;
  listingTitle: string;
  messagePreview: string;
  replyUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="${containerStyles} background-color: white; border-radius: 12px;">
          <div style="${headerStyles}">
            <img src="${process.env.NEXT_PUBLIC_APP_URL}/images/axlesai-logo.png" alt="AxlesAI" height="40" style="height: 40px;">
          </div>

          <h1 style="font-size: 24px; margin-bottom: 16px;">New Inquiry Received!</h1>

          <p>Hi ${sellerName},</p>

          <p>Good news! <strong>${buyerName}</strong> is interested in your listing:</p>

          <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="font-weight: 600; margin: 0 0 8px 0;">${listingTitle}</p>
            <p style="margin: 0; color: #666;">Message: "${messagePreview}"</p>
          </div>

          <p style="text-align: center;">
            <a href="${replyUrl}" style="${buttonStyles}">
              Reply Now
            </a>
          </p>

          <p style="color: #666; font-size: 14px;">
            Pro tip: Responding quickly can increase your chances of making a sale!
          </p>

          <div style="${footerStyles}">
            <p>&copy; ${new Date().getFullYear()} AxlesAI. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

// Chat notification emails

export function newChatConversationEmail({
  dealerName,
  visitorMessage,
  conversationUrl,
}: {
  dealerName: string;
  visitorMessage: string;
  conversationUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="${containerStyles} background-color: white; border-radius: 12px;">
          <div style="${headerStyles}">
            <img src="${process.env.NEXT_PUBLIC_APP_URL}/images/axlesai-logo.png" alt="AxlesAI" height="40" style="height: 40px;">
          </div>

          <h1 style="font-size: 24px; margin-bottom: 16px;">New Chat on Your Storefront</h1>

          <p>Hi ${dealerName},</p>

          <p>A visitor just started a conversation with your AI assistant on your storefront:</p>

          <div style="background-color: #f0f9ff; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0066cc;">
            <p style="margin: 0; color: #333;">"${visitorMessage}"</p>
          </div>

          <p>Your AI assistant is handling the conversation, but you can take over anytime.</p>

          <p style="text-align: center; margin: 32px 0;">
            <a href="${conversationUrl}" style="${buttonStyles}">
              View Conversation
            </a>
          </p>

          <div style="${footerStyles}">
            <p style="font-size: 12px; color: #999;">You can manage notification preferences in your dashboard settings.</p>
            <p>&copy; ${new Date().getFullYear()} AxlesAI. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function chatLeadCapturedEmail({
  dealerName,
  visitorName,
  visitorEmail,
  visitorPhone,
  conversationUrl,
  leadsUrl,
}: {
  dealerName: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string;
  conversationUrl: string;
  leadsUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="${containerStyles} background-color: white; border-radius: 12px;">
          <div style="${headerStyles}">
            <img src="${process.env.NEXT_PUBLIC_APP_URL}/images/axlesai-logo.png" alt="AxlesAI" height="40" style="height: 40px;">
          </div>

          <div style="background-color: #10b981; color: white; padding: 12px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
            <strong>New Lead Captured!</strong>
          </div>

          <p>Hi ${dealerName},</p>

          <p>Great news! A visitor shared their contact information during a chat on your storefront:</p>

          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 100px;">Name:</td>
                <td style="padding: 8px 0; font-weight: 600;">${visitorName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Email:</td>
                <td style="padding: 8px 0;">
                  <a href="mailto:${visitorEmail}" style="color: #0066cc;">${visitorEmail}</a>
                </td>
              </tr>
              ${visitorPhone ? `
              <tr>
                <td style="padding: 8px 0; color: #666;">Phone:</td>
                <td style="padding: 8px 0;">
                  <a href="tel:${visitorPhone}" style="color: #0066cc;">${visitorPhone}</a>
                </td>
              </tr>
              ` : ''}
            </table>
          </div>

          <p style="text-align: center; margin: 32px 0;">
            <a href="${conversationUrl}" style="${buttonStyles}">
              View Chat History
            </a>
            <a href="${leadsUrl}" style="${buttonStyles} background-color: #10b981; margin-left: 12px;">
              Go to Leads
            </a>
          </p>

          <p style="color: #666; font-size: 14px; text-align: center;">
            This lead came from your AI-powered chat assistant. Follow up quickly for best results!
          </p>

          <div style="${footerStyles}">
            <p style="font-size: 12px; color: #999;">You can manage notification preferences in your dashboard settings.</p>
            <p>&copy; ${new Date().getFullYear()} AxlesAI. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function newLeadEmail({
  dealerName,
  buyerName,
  buyerEmail,
  buyerPhone,
  listingTitle,
  message,
  leadsUrl,
}: {
  dealerName: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  listingTitle?: string;
  message?: string;
  leadsUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="${containerStyles} background-color: white; border-radius: 12px;">
          <div style="${headerStyles}">
            <img src="${process.env.NEXT_PUBLIC_APP_URL}/images/axlesai-logo.png" alt="AxlesAI" height="40" style="height: 40px;">
          </div>

          <div style="background-color: #0066cc; color: white; padding: 12px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
            <strong>New Lead Received!</strong>
          </div>

          <p>Hi ${dealerName},</p>

          <p>You have a new lead${listingTitle ? ` interested in <strong>${listingTitle}</strong>` : ''}:</p>

          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 100px;">Name:</td>
                <td style="padding: 8px 0; font-weight: 600;">${buyerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Email:</td>
                <td style="padding: 8px 0;">
                  <a href="mailto:${buyerEmail}" style="color: #0066cc;">${buyerEmail}</a>
                </td>
              </tr>
              ${buyerPhone ? `
              <tr>
                <td style="padding: 8px 0; color: #666;">Phone:</td>
                <td style="padding: 8px 0;">
                  <a href="tel:${buyerPhone}" style="color: #0066cc;">${buyerPhone}</a>
                </td>
              </tr>
              ` : ''}
            </table>
            ${message ? `
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #ddd;">
              <p style="margin: 0; color: #666; font-size: 14px;">Message:</p>
              <p style="margin: 8px 0 0 0;">"${message}"</p>
            </div>
            ` : ''}
          </div>

          <p style="text-align: center; margin: 32px 0;">
            <a href="${leadsUrl}" style="${buttonStyles}">
              View Lead Details
            </a>
          </p>

          <p style="color: #666; font-size: 14px; text-align: center;">
            Responding within 5 minutes increases conversion by 400%!
          </p>

          <div style="${footerStyles}">
            <p style="font-size: 12px; color: #999;">You can manage notification preferences in your dashboard settings.</p>
            <p>&copy; ${new Date().getFullYear()} AxlesAI. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
