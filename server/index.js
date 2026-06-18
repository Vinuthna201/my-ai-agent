require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
const { sendEmail, isConnected: gmailConnected } = require('./gmail');
const { sendWhatsApp, isConnected: whatsappConnected } = require('./whatsapp');
const { getAuthUrl: calAuthUrl, saveToken: calSaveToken, createEvent, isConnected: calendarConnected } = require('./calendar');
const { getAuthUrl: driveAuthUrl, saveToken: driveSaveToken, searchFiles, isConnected: driveConnected } = require('./drive');
const { connectDB, saveMessage, loadMessages, touchSession, getAllSessions } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

connectDB().then(() => {
  console.log('🗄️ Database ready!');
}).catch(err => {
  console.error('❌ DB Error:', err.message);
});

// ─── Calendar Auth ────────────────────────────────────────────
app.get('/auth/calendar', (req, res) => res.redirect(calAuthUrl()));
app.get('/auth/calendar/callback', async (req, res) => {
  try {
    await calSaveToken(req.query.code);
    res.send(`<h2>✅ Google Calendar connected!</h2><p>Close this tab.</p>`);
  } catch (err) {
    res.send(`<h2>❌ Error: ${err.message}</h2>`);
  }
});

// ─── Drive Auth ───────────────────────────────────────────────
app.get('/auth/drive', (req, res) => res.redirect(driveAuthUrl()));
app.get('/auth/drive/callback', async (req, res) => {
  try {
    await driveSaveToken(req.query.code);
    res.send(`<h2>✅ Google Drive connected!</h2><p>Close this tab.</p>`);
  } catch (err) {
    res.send(`<h2>❌ Error: ${err.message}</h2>`);
  }
});

// ─── Sessions & Messages ──────────────────────────────────────
app.get('/sessions', async (req, res) => {
  const sessions = await getAllSessions();
  res.json(sessions);
});

app.get('/messages/:sessionId', async (req, res) => {
  const messages = await loadMessages(req.params.sessionId);
  res.json(messages);
});

// ─── Main Chat Route ──────────────────────────────────────────
app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  console.log('User said:', message);

  await touchSession(sessionId);
  await saveMessage(sessionId, 'user', message);

  const savedMessages = await loadMessages(sessionId);
  const history = savedMessages.filter(m => m.role !== 'system');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const systemPrompt = {
    role: 'system',
    content: `You are a helpful personal AI agent.
    Today's date is ${todayStr}. Tomorrow is ${tomorrowStr}.
    Gmail status: ${gmailConnected() ? 'CONNECTED' : 'NOT connected'}.
    WhatsApp status: ${whatsappConnected() ? 'CONNECTED' : 'NOT connected'}.
    Google Calendar status: ${calendarConnected() ? 'CONNECTED' : 'NOT connected'}.
    Google Drive status: ${driveConnected() ? 'CONNECTED' : 'NOT connected'}.

    When user wants to send an EMAIL:
    - Ask for recipient email, subject, body if not provided
    - Once you have all 3, reply with ONLY this on one line:
    SEND_EMAIL:{"to":"email@example.com","subject":"Subject","body":"Body here"}

    When user wants to send a WHATSAPP message:
    - Ask for recipient phone number and message if not provided
    - Once you have both, reply with ONLY this on one line:
    SEND_WHATSAPP:{"to":"9876543210","message":"Your message here"}

    When user wants to SCHEDULE a meeting or event:
    - Ask for title, date, time, duration if not provided
    - Convert relative dates like "tomorrow" to actual dates
    - Convert times like "4pm" to "16:00"
    - Once you have all details reply with ONLY this on one line:
    CREATE_EVENT:{"title":"Meeting title","date":"2026-06-18","time":"16:00","duration":60,"attendees":[],"description":""}

    When user wants to SEARCH or FIND a file in Google Drive:
    - Ask for the filename or keyword if not provided
    - Once you have it reply with ONLY this on one line:
    SEARCH_DRIVE:{"query":"filename or keyword"}

    Do not include anything else on those lines. Just the command followed by JSON.
    For everything else be friendly and helpful.`
  };

  const messages_for_ai = [systemPrompt, ...history];

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: messages_for_ai,
      temperature: 0.7,
      max_tokens: 1024,
    });

    let reply = response.choices[0].message.content;
    console.log('Raw AI reply:', reply);

    // Handle Email
    if (reply.includes('SEND_EMAIL:')) {
      try {
        const jsonStr = reply.split('SEND_EMAIL:')[1].trim().split('\n')[0];
        const emailData = JSON.parse(jsonStr);
        await sendEmail(emailData);
        reply = `✅ Email sent to ${emailData.to}!\n\nSubject: "${emailData.subject}"\n\nAnything else?`;
      } catch (err) {
        reply = `❌ Couldn't send email: ${err.message}`;
      }
    }

    // Handle WhatsApp
    if (reply.includes('SEND_WHATSAPP:')) {
      try {
        const jsonStr = reply.split('SEND_WHATSAPP:')[1].trim().split('\n')[0];
        const waData = JSON.parse(jsonStr);
        await sendWhatsApp(waData);
        reply = `✅ WhatsApp sent to ${waData.to}!\n\nMessage: "${waData.message}"\n\nAnything else?`;
      } catch (err) {
        reply = `❌ Couldn't send WhatsApp: ${err.message}`;
      }
    }

    // Handle Calendar
    if (reply.includes('CREATE_EVENT:')) {
      try {
        const jsonStr = reply.split('CREATE_EVENT:')[1].trim().split('\n')[0];
        const eventData = JSON.parse(jsonStr);
        await createEvent(eventData);
        reply = `✅ Meeting scheduled!\n\n📅 "${eventData.title}"\n🗓 ${eventData.date} at ${eventData.time}\n⏱ ${eventData.duration} minutes\n\nCheck your Google Calendar! Anything else?`;
      } catch (err) {
        reply = `❌ Couldn't create event: ${err.message}`;
      }
    }

    // Handle Drive Search
    if (reply.includes('SEARCH_DRIVE:')) {
      try {
        const jsonStr = reply.split('SEARCH_DRIVE:')[1].trim().split('\n')[0];
        const { query } = JSON.parse(jsonStr);
        const files = await searchFiles(query);
        if (files.length === 0) {
          reply = `🔍 No files found for "${query}". Try a different keyword!`;
        } else {
          const fileList = files.map((f, i) =>
            `${i + 1}. 📄 ${f.name}\n   🔗 ${f.webViewLink}`
          ).join('\n\n');
          reply = `🔍 Found ${files.length} file(s) for "${query}":\n\n${fileList}\n\nAnything else?`;
        }
      } catch (err) {
        reply = `❌ Couldn't search Drive: ${err.message}`;
      }
    }

    await saveMessage(sessionId, 'assistant', reply);
    console.log('💾 Saved to MongoDB!');
    res.json({ reply });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ reply: 'Sorry something went wrong: ' + error.message });
  }
});
// ─── Agent Planner Route ──────────────────────────────────────
app.post('/plan', async (req, res) => {
  const { goal } = req.body;
  console.log('Planning goal:', goal);

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are an AI agent planner. Break down the user's goal into 4-6 clear actionable steps.
          Reply ONLY with valid JSON in this exact format, nothing else:
          {
            "title": "Plan title here",
            "description": "Brief description",
            "steps": [
              { "action": "Short action title", "description": "What to do in detail" },
              { "action": "Short action title", "description": "What to do in detail" }
            ]
          }`
        },
        { role: 'user', content: goal }
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    let text = response.choices[0].message.content;
    // Remove markdown code blocks if present
    text = text.replace(/```json|```/g, '').trim();
    const plan = JSON.parse(text);
    res.json({ plan });

  } catch (error) {
    console.error('Plan error:', error.message);
    res.status(500).json({ error: error.message });
  }
});
app.listen(process.env.PORT, () => {
  console.log(`✅ Server running on http://localhost:${process.env.PORT}`);
  console.log(`📧 Gmail: ${gmailConnected() ? 'Connected ✅' : 'Not connected ❌'}`);
  console.log(`💬 WhatsApp: ${whatsappConnected() ? 'Connected ✅' : 'Not connected ❌'}`);
  console.log(`📅 Calendar: ${calendarConnected() ? 'Connected ✅' : 'Not connected ❌'}`);
  console.log(`🔍 Drive: ${driveConnected() ? 'Connected ✅' : 'Not connected ❌'}`);
});