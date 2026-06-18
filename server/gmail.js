const nodemailer = require('nodemailer');

// Create a mail sender using your Gmail + App Password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  }
});

// Send an email — as simple as it gets!
async function sendEmail({ to, subject, body }) {
  const result = await transporter.sendMail({
    from: `"My AI Agent" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text: body,
  });
  console.log('✅ Email sent! ID:', result.messageId);
  return result;
}

// Always connected since we use App Password
function isConnected() {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

module.exports = { sendEmail, isConnected };