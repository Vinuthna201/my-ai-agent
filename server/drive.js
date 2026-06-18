const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'drive-token.json');

const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
const { client_id, client_secret, redirect_uris } = credentials.web;

const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  'http://localhost:3001/auth/drive/callback'
);

if (fs.existsSync(TOKEN_PATH)) {
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
  oauth2Client.setCredentials(token);
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
  return fs.existsSync(TOKEN_PATH);
}

module.exports = { getAuthUrl, saveToken, searchFiles, isConnected };