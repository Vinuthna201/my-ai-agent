import { useState, useEffect, useRef } from 'react';
import './App.css';

const SESSION_ID = 'session_' + Date.now();

const SERVICES = [
  { key: 'gmail', icon: '📧', label: 'Gmail' },
  { key: 'whatsapp', icon: '💬', label: 'WhatsApp' },
  { key: 'calendar', icon: '📅', label: 'Calendar' },
  { key: 'drive', icon: '🔍', label: 'Drive' },
];

function PlanView({ plan }) {
  return (
    <div style={planStyles.container}>
      <div style={planStyles.title}>📋 {plan.title}</div>
      {plan.steps.map((step, i) => (
        <div key={i} style={{
          ...planStyles.step,
          background: step.status === 'done' ? '#0d2e1a' :
                      step.status === 'running' ? '#1a1a0d' : '#1a1a2e',
          borderLeft: `3px solid ${step.status === 'done' ? '#4ade80' :
                                    step.status === 'running' ? '#fbbf24' : '#3a3a5c'}`
        }}>
          <span style={planStyles.stepNum}>
            {step.status === 'done' ? '✅' :
             step.status === 'running' ? '⏳' : `${i + 1}`}
          </span>
          <span style={planStyles.stepText}>{step.action}</span>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: 'agent',
      text: 'Hi! I\'m your AI Agent 👋\n\nI can help you:\n📧 Send emails\n💬 WhatsApp messages\n📅 Schedule meetings\n🔍 Find files in Drive\n📋 Plan complex goals\n\nWhat would you like to do?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pastSessions, setPastSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(SESSION_ID);
  const [showPlanner, setShowPlanner] = useState(false);
  const [planGoal, setPlanGoal] = useState('');
  const [currentPlan, setCurrentPlan] = useState(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = () => {
    fetch('ttps://my-ai-agent-g7ho.onrender.com/sessions')
      .then(r => r.json())
      .then(setPastSessions)
      .catch(() => {});
  };

  const loadSession = async (sessionId) => {
    const res = await fetch(`https://my-ai-agent-g7ho.onrender.com/messages/${sessionId}`);
    const data = await res.json();
    const loaded = data
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'user' ? 'user' : 'agent', text: m.content }));
    setMessages(loaded.length > 0 ? loaded : [{ role: 'agent', text: 'No messages in this session.' }]);
    setActiveSession(sessionId);
    setShowHistory(false);
  };

  const newChat = () => {
    const newId = 'session_' + Date.now();
    setMessages([{
      role: 'agent',
      text: 'Hi! I\'m your AI Agent 👋\n\nI can help you:\n📧 Send emails\n💬 WhatsApp messages\n📅 Schedule meetings\n🔍 Find files in Drive\n📋 Plan complex goals\n\nWhat would you like to do?'
    }]);
    setActiveSession(newId);
    setShowHistory(false);
    setCurrentPlan(null);
  };

  const sendMessage = async (overrideMsg) => {
    const msg = overrideMsg || input;
    if (!msg.trim() || isThinking) return;
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setIsThinking(true);

    try {
      const res = await fetch('https://my-ai-agent-g7ho.onrender.com/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, sessionId: activeSession })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'agent', text: data.reply }]);
      fetchSessions();
    } catch {
      setMessages(prev => [...prev, { role: 'agent', text: 'Oops! Server not reachable.' }]);
    }
    setIsThinking(false);
  };

  // Agent Planner
  const createPlan = async () => {
    if (!planGoal.trim()) return;
    setIsPlanning(true);
    setCurrentPlan(null);

    try {
      const res = await fetch('https://my-ai-agent-g7ho.onrender.com/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: planGoal })
      });
      const data = await res.json();
      setCurrentPlan(data.plan);
    } catch {
      alert('Could not create plan. Is server running?');
    }
    setIsPlanning(false);
  };

  const executePlanStep = async (step) => {
    setShowPlanner(false);
    await sendMessage(`${step.action}`);
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
      ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={s.page}>

      {/* ── History Sidebar ── */}
      <div style={{ ...s.sidebar, transform: showHistory ? 'translateX(0)' : 'translateX(-100%)' }}>
        <div style={s.sidebarTop}>
          <span style={s.sidebarTitle}>🕐 History</span>
          <button style={s.iconBtn} onClick={() => setShowHistory(false)}>✕</button>
        </div>
        <button style={s.newChatBtn} onClick={newChat}>＋ New Chat</button>
        <div style={s.sessionList}>
          {pastSessions.length === 0 && <p style={s.empty}>No past chats yet!</p>}
          {pastSessions.map((sess, i) => (
            <div key={i}
              style={{ ...s.sessionCard, background: activeSession === sess.sessionId ? '#1e1e3a' : 'transparent' }}
              onClick={() => loadSession(sess.sessionId)}>
              <div style={s.sessionNum}>#{pastSessions.length - i}</div>
              <div>
                <div style={s.sessionLabel}>Conversation {pastSessions.length - i}</div>
                <div style={s.sessionTime}>{formatTime(sess.lastActive)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Planner Modal ── */}
      {showPlanner && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>🧠 Agent Planner</span>
              <button style={s.iconBtn} onClick={() => setShowPlanner(false)}>✕</button>
            </div>
            <p style={s.modalSubtitle}>Give me a big goal — I'll break it into steps!</p>
            <textarea
              style={s.planInput}
              placeholder="e.g. Organize my internship application process..."
              value={planGoal}
              onChange={e => setPlanGoal(e.target.value)}
              rows={3}
            />
            <button style={s.planBtn} onClick={createPlan} disabled={isPlanning}>
              {isPlanning ? '⏳ Planning...' : '🧠 Create Plan'}
            </button>

            {currentPlan && (
              <div style={s.planResult}>
                <div style={s.planTitle}>📋 {currentPlan.title}</div>
                <div style={s.planDesc}>{currentPlan.description}</div>
                {currentPlan.steps.map((step, i) => (
                  <div key={i} style={s.planStep}>
                    <div style={s.planStepLeft}>
                      <div style={s.planStepNum}>{i + 1}</div>
                      <div>
                        <div style={s.planStepAction}>{step.action}</div>
                        <div style={s.planStepDesc}>{step.description}</div>
                      </div>
                    </div>
                    <button style={s.executeBtn} onClick={() => executePlanStep(step)}>
                      ▶ Do it
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showHistory && <div style={s.overlay} onClick={() => setShowHistory(false)} />}

      {/* ── Main Area ── */}
      <div style={s.main}>

        {/* Header */}
        <div style={s.header}>
          <button style={s.iconBtn} onClick={() => setShowHistory(true)}>☰</button>
          <div style={s.headerCenter}>
            <div style={s.greenDot} />
            <span style={s.agentName}>My AI Agent</span>
          </div>
          <div style={s.headerRight}>
            {SERVICES.map(sv => (
              <span key={sv.key} style={s.serviceChip} title={sv.label}>{sv.icon}</span>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div style={s.chat}>
          {messages.map((msg, i) => (
            <div key={i} className="message-enter" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 4
            }}>
              {msg.role === 'agent' && <span style={s.agentLabel}>🤖 Agent</span>}
              {msg.role === 'user' && <span style={s.userLabel}>You</span>}
              <div style={{
                ...s.bubble,
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                  : 'linear-gradient(135deg, #1a1a2e, #16213e)',
                borderBottomRightRadius: msg.role === 'user' ? 4 : 18,
                borderBottomLeftRadius: msg.role === 'agent' ? 4 : 18,
              }}>
                {msg.text}
              </div>
            </div>
          ))}

          {isThinking && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 4 }}>
              <span style={s.agentLabel}>🤖 Agent</span>
              <div style={{ ...s.bubble, background: 'linear-gradient(135deg, #1a1a2e, #16213e)' }}>
                <span className="thinking-dot" />
                <span className="thinking-dot" />
                <span className="thinking-dot" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={s.inputArea}>
          <button style={s.plannerBtn} onClick={() => setShowPlanner(true)} title="Agent Planner">
            🧠
          </button>
          <input
            style={s.input}
            placeholder="Ask me to email, WhatsApp, schedule, or find files..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
          />
          <button style={{ ...s.sendBtn, opacity: isThinking ? 0.5 : 1 }}
            onClick={() => sendMessage()} disabled={isThinking}>
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { display: 'flex', height: '100vh', background: '#080810', color: 'white', fontFamily: "'Inter', sans-serif", position: 'relative', overflow: 'hidden' },
  sidebar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 280, background: '#0d0d1a', borderRight: '1px solid #1a1a2e', zIndex: 20, transition: 'transform 0.3s ease', display: 'flex', flexDirection: 'column' },
  sidebarTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 16px', borderBottom: '1px solid #1a1a2e' },
  sidebarTitle: { color: 'white', fontWeight: '700', fontSize: 15 },
  iconBtn: { background: 'none', border: 'none', color: '#666', fontSize: 16, cursor: 'pointer', padding: 4 },
  newChatBtn: { margin: '12px 16px', padding: '10px', borderRadius: 10, border: '1px dashed #4f46e5', background: 'transparent', color: '#6366f1', cursor: 'pointer', fontSize: 13, fontWeight: '600' },
  sessionList: { flex: 1, overflowY: 'auto', padding: '8px' },
  empty: { color: '#333', fontSize: 13, textAlign: 'center', marginTop: 24 },
  sessionCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, marginBottom: 4, cursor: 'pointer', transition: 'background 0.2s' },
  sessionNum: { width: 28, height: 28, borderRadius: 8, background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#6366f1', fontWeight: '700', flexShrink: 0 },
  sessionLabel: { color: '#ccc', fontSize: 13, fontWeight: '500' },
  sessionTime: { color: '#444', fontSize: 11, marginTop: 2 },
  overlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 15 },
  modalOverlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { color: 'white', fontWeight: '700', fontSize: 17 },
  modalSubtitle: { color: '#666', fontSize: 13, marginBottom: 16 },
  planInput: { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #1a1a2e', background: '#13131f', color: 'white', fontSize: 14, resize: 'none', outline: 'none', marginBottom: 12 },
  planBtn: { width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', fontWeight: '700', fontSize: 14, cursor: 'pointer' },
  planResult: { marginTop: 20 },
  planTitle: { color: 'white', fontWeight: '700', fontSize: 15, marginBottom: 4 },
  planDesc: { color: '#666', fontSize: 13, marginBottom: 16 },
  planStep: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: 10, background: '#13131f', marginBottom: 8, gap: 10 },
  planStepLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  planStepNum: { width: 26, height: 26, borderRadius: 8, background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#6366f1', fontWeight: '700', flexShrink: 0 },
  planStepAction: { color: 'white', fontSize: 13, fontWeight: '600' },
  planStepDesc: { color: '#555', fontSize: 12, marginTop: 2 },
  executeBtn: { padding: '6px 12px', borderRadius: 8, border: 'none', background: '#1a2a1a', color: '#4ade80', fontSize: 12, cursor: 'pointer', fontWeight: '600', flexShrink: 0 },
  main: { flex: 1, display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #0d0d1a', background: 'rgba(8,8,16,0.95)', backdropFilter: 'blur(10px)' },
  headerCenter: { display: 'flex', alignItems: 'center', gap: 8 },
  greenDot: { width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' },
  agentName: { color: 'white', fontWeight: '700', fontSize: 15 },
  headerRight: { display: 'flex', gap: 6 },
  serviceChip: { fontSize: 16, padding: '4px 6px', borderRadius: 8, background: '#0d0d1a', border: '1px solid #1a1a2e' },
  chat: { flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 8 },
  agentLabel: { color: '#444', fontSize: 11, marginBottom: 4, marginLeft: 4 },
  userLabel: { color: '#444', fontSize: 11, marginBottom: 4, marginRight: 4 },
  bubble: { maxWidth: '75%', padding: '12px 16px', borderRadius: 18, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  inputArea: { display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid #0d0d1a', background: 'rgba(8,8,16,0.95)', backdropFilter: 'blur(10px)', alignItems: 'center' },
  plannerBtn: { width: 44, height: 44, borderRadius: 12, border: '1px solid #1a1a2e', background: '#0d0d1a', fontSize: 18, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, padding: '12px 16px', borderRadius: 24, border: '1px solid #1a1a2e', background: '#0d0d1a', color: 'white', fontSize: 14, outline: 'none' },
  sendBtn: { width: 44, height: 44, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', fontSize: 18, cursor: 'pointer', flexShrink: 0 },
};

const planStyles = {
  container: { background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 12, padding: 14, marginTop: 8 },
  title: { color: 'white', fontWeight: '700', fontSize: 14, marginBottom: 10 },
  step: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, marginBottom: 6 },
  stepNum: { width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#6366f1', fontWeight: '700' },
  stepText: { color: '#ccc', fontSize: 13 },
};