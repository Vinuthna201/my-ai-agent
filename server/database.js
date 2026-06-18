const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'ai-agent' // force the database name here
    });
    console.log('✅ MongoDB Connected!');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
  }
}

const MessageSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', MessageSchema);
const Session = mongoose.model('Session', SessionSchema);

async function saveMessage(sessionId, role, content) {
  try {
    await Message.create({ sessionId, role, content });
    console.log('💾 Message saved to DB:', role);
  } catch (err) {
    console.error('Error saving message:', err.message);
  }
}

async function loadMessages(sessionId) {
  try {
    const messages = await Message.find({ sessionId })
      .sort({ createdAt: 1 })
      .select('role content -_id');
    return messages;
  } catch (err) {
    console.error('Error loading messages:', err.message);
    return [];
  }
}

async function touchSession(sessionId) {
  try {
    await Session.findOneAndUpdate(
      { sessionId },
      { lastActive: new Date() },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('Error touching session:', err.message);
  }
}

async function getAllSessions() {
  try {
    return await Session.find().sort({ lastActive: -1 });
  } catch (err) {
    console.error('Error getting sessions:', err.message);
    return [];
  }
}

module.exports = { connectDB, saveMessage, loadMessages, touchSession, getAllSessions };