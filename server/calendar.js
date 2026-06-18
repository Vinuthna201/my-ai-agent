const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'calendar-token.json');

const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
const { client_id, client_secret, redirect_uris } = credentials.web;

const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  'http://localhost:3001/auth/calendar/callback'
);

// Load saved token if it exists
if (fs.existsSync(TOKEN_PATH)) {
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
  oauth2Client.setCredentials(token);
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
}

async function createEvent({ title, date, time, duration = 60, attendees = [], description = '' }) {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const startDateTime = new Date(`${date}T${time}:00`);
  const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

  const event = {
    summary: title,
    description,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: 'Asia/Kolkata',
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: 'Asia/Kolkata',
    },
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

  console.log('✅ Event created:', result.data.htmlLink);
  return result.data;
}

function isConnected() {
  return fs.existsSync(TOKEN_PATH);
}

module.exports = { getAuthUrl, saveToken, createEvent, isConnected };