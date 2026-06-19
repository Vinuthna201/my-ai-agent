const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const TOKEN_PATH = path.join(__dirname, 'calendar-token.json');

// Use environment variables instead of credentials.json file
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI_CALENDAR
);

if (fs.existsSync(TOKEN_PATH)) {
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
  oauth2Client.setCredentials(token);
} else if (process.env.GOOGLE_CALENDAR_TOKEN) {
  oauth2Client.setCredentials(JSON.parse(process.env.GOOGLE_CALENDAR_TOKEN));
}

function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar']
  });
}

async function saveToken(code) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  console.log('✅ Google Calendar connected!');
  console.log('📋 Save this token as GOOGLE_CALENDAR_TOKEN env var:', JSON.stringify(tokens));
}

async function createEvent({ title, date, time, duration = 60, attendees = [], description = '' }) {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const startDateTime = new Date(`${date}T${time}:00`);
  const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

  const event = {
    summary: title,
    description,
    start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Kolkata' },
    end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Kolkata' },
    attendees: attendees.map(email => ({ email })),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 30 },
        { method: 'email', minutes: 60 },
      ],
    },
  };

  const result = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
    sendUpdates: attendees.length > 0 ? 'all' : 'none',
  });

  console.log('✅ Event created!');
  return result.data;
}

function isConnected() {
  return fs.existsSync(TOKEN_PATH) || !!process.env.GOOGLE_CALENDAR_TOKEN;
}

module.exports = { getAuthUrl, saveToken, createEvent, isConnected };