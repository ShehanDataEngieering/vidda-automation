import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/react';
import { useApi } from '../utils/api';
import type { ChatSession, ChatMessage, ChatCitation } from '../types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const NOT_FOUND = 'This question is not covered in the uploaded compliance documents. Contact your Compliance Officer.';

function CitationTag({ c }: { c: ChatCitation }) {
  const parts = [
    c.sectionNumber ? `§${c.sectionNumber}` : null,
    c.sectionHeading,
    c.pageNumber ? `p.${c.pageNumber}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-700/60 border border-white/5 text-slate-400">
      <span className="text-slate-300 font-medium truncate max-w-[120px]">{c.documentName}</span>
      {parts && <><span className="text-slate-600">·</span><span>{parts}</span></>}
    </span>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  const isNotFound = msg.answer_status === 'not_found';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-indigo-500 text-white text-sm leading-relaxed">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-slate-700 border border-white/10 flex items-center justify-center shrink-0 mt-1">
        <span className="text-xs text-slate-300">V</span>
      </div>
      <div className="flex-1 min-w-0">
        {isNotFound ? (
          <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
            {NOT_FOUND}
          </div>
        ) : (
          <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[#1E293B] border border-white/5 text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
            {msg.content}
          </div>
        )}
        {!isNotFound && msg.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 pl-1">
            {msg.citations.map((c, i) => <CitationTag key={i} c={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function StreamingBubble({ text }: { text: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-slate-700 border border-white/10 flex items-center justify-center shrink-0 mt-1">
        <span className="text-xs text-slate-300">V</span>
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[#1E293B] border border-white/5 text-slate-200 text-sm leading-relaxed whitespace-pre-wrap max-w-[75%]">
        {text || <span className="inline-block w-1.5 h-4 bg-indigo-400 animate-pulse rounded-sm" />}
      </div>
    </div>
  );
}

export default function ComplianceChat() {
  const { getToken } = useAuth();
  const apiFetch = useApi();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamText]);

  async function loadSessions() {
    try {
      const res = await apiFetch('/api/chat/sessions');
      if (res.ok) setSessions(await res.json());
    } catch { /* ignore */ }
  }

  async function selectSession(id: string) {
    setActiveSession(id);
    setStreamText(null);
    try {
      const res = await apiFetch(`/api/chat/sessions/${id}/messages`);
      if (res.ok) setMessages(await res.json());
    } catch { /* ignore */ }
  }

  async function send() {
    const q = input.trim();
    if (!q || sending) return;
    setInput('');
    setSending(true);
    setStreamText('');

    const isNew = !activeSession;
    const url = isNew ? '/api/chat/sessions' : `/api/chat/sessions/${activeSession}/messages`;

    // Optimistic user bubble
    const tempUserMsg: ChatMessage = {
      id: 'tmp',
      role: 'user',
      content: q,
      citations: [],
      answer_status: 'answered',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const token = await getToken();
      const res = await fetch(`${BASE}${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: q }),
      });

      if (!res.ok || !res.body) {
        setStreamText(null);
        setSending(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let sessionId = activeSession;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === 'token') {
              accumulated += ev.token;
              setStreamText(accumulated);
            } else if (ev.type === 'done') {
              const assistantMsg: ChatMessage = {
                id: Date.now().toString(),
                role: 'assistant',
                content: accumulated,
                citations: ev.citations ?? [],
                answer_status: ev.answerStatus,
                created_at: new Date().toISOString(),
              };
              setMessages(prev => [...prev, assistantMsg]);
              setStreamText(null);
            }
          } catch { /* partial line */ }
        }
      }

      // If new session, reload sessions and set active
      if (isNew) {
        const sessRes = await apiFetch('/api/chat/sessions');
        if (sessRes.ok) {
          const newSessions: ChatSession[] = await sessRes.json();
          setSessions(newSessions);
          if (newSessions[0]) {
            sessionId = newSessions[0].id;
            setActiveSession(sessionId);
          }
        }
      }
    } catch {
      setStreamText(null);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar — session list */}
      <aside className="w-64 border-r border-white/5 flex flex-col bg-[#111827]/50">
        <div className="px-4 py-5 border-b border-white/5">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <button
            onClick={() => { setActiveSession(null); setMessages([]); setStreamText(null); }}
            className="w-full text-left px-4 py-2.5 text-sm text-indigo-400 hover:bg-white/5 flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span> New conversation
          </button>
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => selectSession(s.id)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                activeSession === s.id ? 'bg-white/5 text-white' : 'text-slate-400 hover:text-white hover:bg-white/3'
              }`}
            >
              <p className="truncate">{s.title ?? 'Conversation'}</p>
              <p className="text-xs text-slate-600 mt-0.5">{new Date(s.created_at).toLocaleDateString()}</p>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
          {messages.length === 0 && !streamText && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                <span className="text-indigo-400 text-xl">◎</span>
              </div>
              <h2 className="text-white font-medium">Compliance Assistant</h2>
              <p className="text-slate-500 text-sm mt-2 max-w-xs">
                Ask questions about your company's compliance documents. Answers are grounded in the uploaded PDFs.
              </p>
            </div>
          )}
          {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}
          {streamText !== null && <StreamingBubble text={streamText} />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-8 py-5 border-t border-white/5">
          <div className="flex gap-3 items-end bg-[#1E293B] border border-white/10 rounded-2xl px-4 py-3 focus-within:border-indigo-500/50 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask a compliance question… (Enter to send)"
              rows={1}
              className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 resize-none focus:outline-none leading-relaxed max-h-40 overflow-y-auto"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
              disabled={sending}
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="shrink-0 w-8 h-8 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4 text-white rotate-90" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-slate-600 text-center mt-2">Answers are sourced strictly from uploaded compliance documents.</p>
        </div>
      </div>
    </div>
  );
}
