import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/react';
import { MessageSquare, Plus, Send, Loader2, FileText } from 'lucide-react';
import { useApi } from '../utils/api';
import type { ChatSession, ChatMessage, ChatCitation } from '../types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function Citations({ citations }: { citations: ChatCitation[] }) {
  if (!citations.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {citations.map((c, i) => (
        <Badge key={i} variant="outline" className="text-[10px] font-normal gap-1">
          <FileText className="h-2.5 w-2.5" />
          {c.documentName}{c.sectionNumber ? ` · §${c.sectionNumber}` : ''}{c.pageNumber ? ` · p.${c.pageNumber}` : ''}
        </Badge>
      ))}
    </div>
  );
}

function Message({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-lg rounded-2xl rounded-br-sm bg-primary text-primary-foreground text-sm px-4 py-2.5">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="mb-4">
      <div className={cn(
        'max-w-2xl rounded-2xl rounded-bl-sm text-sm px-4 py-2.5',
        msg.answer_status === 'not_found'
          ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300'
          : 'bg-card border border-border text-card-foreground'
      )}>
        <pre className="whitespace-pre-wrap font-sans leading-relaxed">{msg.content}</pre>
      </div>
      <Citations citations={msg.citations} />
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

  useEffect(() => { void loadSessions(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamText]);

  async function loadSessions() {
    const res = await apiFetch('/api/chat/sessions');
    if (res.ok) setSessions(await res.json() as ChatSession[]);
  }

  async function selectSession(id: string) {
    setActiveSession(id);
    setStreamText(null);
    const res = await apiFetch(`/api/chat/sessions/${id}/messages`);
    if (res.ok) setMessages(await res.json() as ChatMessage[]);
  }

  async function send() {
    const q = input.trim();
    if (!q || sending) return;
    setInput('');
    setSending(true);
    setStreamText('');

    const isNew = !activeSession;
    const url = isNew ? '/api/chat/sessions' : `/api/chat/sessions/${activeSession}/messages`;

    setMessages(prev => [...prev, {
      id: 'tmp', role: 'user', content: q, citations: [],
      answer_status: 'answered', created_at: new Date().toISOString(),
    }]);

    try {
      const token = await getToken();
      const res = await fetch(`${BASE}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok || !res.body) { setSending(false); setStreamText(null); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6)) as { type: string; token?: string; citations?: ChatCitation[]; answerStatus?: 'answered' | 'not_found' | 'error' };
            if (ev.type === 'token') { accumulated += ev.token ?? ''; setStreamText(accumulated); }
            else if (ev.type === 'done') {
              setMessages(prev => [...prev, {
                id: Date.now().toString(), role: 'assistant', content: accumulated,
                citations: ev.citations ?? [], answer_status: ev.answerStatus ?? 'answered',
                created_at: new Date().toISOString(),
              }]);
              setStreamText(null);
            }
          } catch { /* partial line */ }
        }
      }

      if (isNew) {
        const sessRes = await apiFetch('/api/chat/sessions');
        if (sessRes.ok) {
          const newSessions = await sessRes.json() as ChatSession[];
          setSessions(newSessions);
          if (newSessions[0]) setActiveSession(newSessions[0].id);
        }
      }
    } catch { setStreamText(null); }
    finally { setSending(false); }
  }

  return (
    <div className="flex h-[calc(100vh)] bg-background">
      {/* Session sidebar */}
      <aside className="w-56 border-r border-border flex flex-col bg-sidebar">
        <div className="px-3 py-3 flex items-center justify-between border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-sidebar-foreground/50" />
            <span className="text-xs font-semibold text-sidebar-foreground">Conversations</span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => { setActiveSession(null); setMessages([]); setStreamText(null); }}
            title="New conversation"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {sessions.length === 0 ? (
            <p className="text-xs text-sidebar-foreground/40 px-3 py-4">No conversations yet.</p>
          ) : (
            <div className="py-1">
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => void selectSession(s.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 transition-colors',
                    activeSession === s.id
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50'
                  )}
                >
                  <div className="text-xs font-medium truncate">{s.title ?? 'Conversation'}</div>
                  <div className="text-[10px] text-sidebar-foreground/40 mt-0.5">{new Date(s.created_at).toLocaleDateString()}</div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Messages */}
        <ScrollArea className="flex-1 px-6 py-4">
          {messages.length === 0 && streamText === null && (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Compliance Assistant</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Ask questions about your compliance documents. All answers are grounded in uploaded PDFs.
              </p>
            </div>
          )}
          {messages.map(msg => <Message key={msg.id} msg={msg} />)}
          {streamText !== null && (
            <div className="mb-4">
              <div className="max-w-2xl rounded-2xl rounded-bl-sm bg-card border border-border text-card-foreground text-sm px-4 py-2.5">
                <pre className="whitespace-pre-wrap font-sans leading-relaxed">{streamText || '…'}</pre>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border bg-background px-4 py-3">
          <div className="flex gap-2 items-end max-w-4xl">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder="Ask a compliance question… (Enter to send)"
              rows={2}
              disabled={sending}
              className="flex-1 resize-none text-sm"
            />
            <Button onClick={() => void send()} disabled={!input.trim() || sending} size="icon" className="shrink-0">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

