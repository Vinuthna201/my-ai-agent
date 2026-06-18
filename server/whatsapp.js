const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendWhatsApp({ to, message }) {
  // Format number with country code
  let formattedNumber = to.replace(/\D/g, ''); // remove non-digits
  if (!formattedNumber.startsWith('91')) {
    formattedNumber = '91' + formattedNumber; // add India code
  }

  console.log('Sending WhatsApp to:', formattedNumber);

  const result = await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:+${formattedNumber}`,
    body: message
  });

  console.log('✅ WhatsApp sent! SID:', result.sid);
  return result;
}

function isConnected() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM
  );
}

module.exports = { sendWhatsApp, isConnected };