const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const TOKEN_PATH = path.join(__dirname, 'drive-token.json');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI_DRIVE
);

if (fs.existsSync(TOKEN_PATH)) {
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
  oauth2Client.setCredentials(token);
} else if (process.env.GOOGLE_DRIVE_TOKEN) {
  oauth2Client.setCredentials(JSON.parse(process.env.GOOGLE_DRIVE_TOKEN));
}

function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.readonly']
  });
}

async function saveToken(code) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  console.log('✅ Google Drive connected!');
  console.log('📋 Save this token as GOOGLE_DRIVE_TOKEN env var:', JSON.stringify(tokens));
}

async function searchFiles(query) {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const res = await drive.files.list({
    q: `name contains '${query}' and trashed=false`,
    fields: 'files(id, name, mimeType, webViewLink, modifiedTime)',
    pageSize: 5,
    orderBy: 'modifiedTime desc'
  });
  return res.data.files;
}

function isConnected() {
  return fs.existsSync(TOKEN_PATH) || !!process.env.GOOGLE_DRIVE_TOKEN;
}

module.exports = { getAuthUrl, saveToken, searchFiles, isConnected };