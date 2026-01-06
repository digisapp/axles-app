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
