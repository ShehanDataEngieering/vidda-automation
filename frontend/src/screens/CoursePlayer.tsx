import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, BookOpen, MessageSquare, ClipboardCheck,
  CheckCircle2, XCircle, Send, Loader2, Trophy, RotateCcw
} from 'lucide-react';
import { useApi } from '../utils/api';
import type { TrainingModuleWithProgress } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuizQuestion {
  question: string;
  options: { a: string; b: string; c: string; d: string };
  correct: 'a' | 'b' | 'c' | 'd';
  explanation: string;
}

interface QuizResult {
  question: string;
  yourAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  options: { a: string; b: string; c: string; d: string };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

// ---------------------------------------------------------------------------
// Module Content Parser
// ---------------------------------------------------------------------------

function parseModuleSection(content: string, label: string): string {
  const re = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z ]+:|$)`, 'i');
  const match = re.exec(content);
  return match?.[1]?.trim() ?? '';
}

function ModuleContent({ content }: { content: string }) {
  const sections = [
    { key: 'TITLE', label: 'Title' },
    { key: 'REGULATORY BASIS', label: 'Regulatory Basis' },
    { key: 'OBJECTIVES', label: 'Learning Objectives' },
    { key: 'CONTENT', label: 'Content' },
    { key: 'EU AI ACT NOTE', label: 'AI Act Note' },
    { key: 'ASSESSMENT', label: 'Knowledge Check' },
  ];

  const parsed = sections.map(s => ({
    ...s,
    text: parseModuleSection(content, s.key),
  })).filter(s => s.text.length > 0);

  if (parsed.length < 2) {
    // Fallback: render as-is
    return (
      <pre className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-sans">
        {content}
      </pre>
    );
  }

  return (
    <div className="space-y-5">
      {parsed.map(s => (
        <div key={s.key}>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {s.label}
          </h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{s.text}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quiz Panel
// ---------------------------------------------------------------------------

interface QuizPanelProps {
  moduleId: string;
  onPass: () => void;
}

function QuizPanel({ moduleId, onPass }: QuizPanelProps) {
  const apiFetch = useApi();
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<QuizResult[] | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [passed, setPassed] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch(`/api/training/my-modules/${moduleId}/quiz`)
      .then(async r => {
        if (r.ok) {
          const data = await r.json() as { questions: QuizQuestion[] };
          setQuestions(data.questions);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [moduleId]);

  async function submit() {
    if (!questions) return;
    setSubmitting(true);
    const res = await apiFetch(`/api/training/my-modules/${moduleId}/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    if (res.ok) {
      const data = await res.json() as { score: number; passed: boolean; results: QuizResult[] };
      setScore(data.score);
      setPassed(data.passed);
      setResults(data.results);
      if (data.passed) onPass();
    }
    setSubmitting(false);
  }

  function reset() {
    setAnswers({});
    setResults(null);
    setScore(null);
    setPassed(null);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Generating quiz questions…
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Could not load quiz.</p>;
  }

  // Results view
  if (results !== null && score !== null && passed !== null) {
    return (
      <div className="space-y-4">
        <div className={`flex items-center gap-3 p-4 rounded-lg ${passed ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'}`}>
          {passed ? (
            <Trophy className="h-6 w-6 text-green-600 shrink-0" />
          ) : (
            <XCircle className="h-6 w-6 text-red-600 shrink-0" />
          )}
          <div>
            <p className={`font-semibold ${passed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {passed ? '✅ Passed! Module Complete' : '❌ Not quite — review the material and try again'}
            </p>
            <p className="text-sm text-muted-foreground">Score: {score}% ({passed ? 'Pass ≥ 70%' : 'Required: 70%'})</p>
          </div>
        </div>

        <div className="space-y-3">
          {results.map((r, i) => (
            <Card key={i} className={r.isCorrect ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}>
              <CardContent className="pt-3 pb-3">
                <p className="text-sm font-medium mb-2">Q{i + 1}: {r.question}</p>
                <div className="grid grid-cols-2 gap-1 mb-2">
                  {(['a', 'b', 'c', 'd'] as const).map(opt => (
                    <div
                      key={opt}
                      className={`text-xs px-2 py-1 rounded ${
                        opt === r.correctAnswer
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-medium'
                          : opt === r.yourAnswer && !r.isCorrect
                          ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {opt.toUpperCase()}) {r.options[opt]}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground italic">{r.explanation}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {!passed && (
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Try Again
          </Button>
        )}
      </div>
    );
  }

  const allAnswered = questions.every((_, i) => answers[`q${i}`]);

  return (
    <div className="space-y-4">
      {questions.map((q, i) => (
        <Card key={i}>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-medium mb-3">
              <span className="text-muted-foreground mr-2">Q{i + 1}.</span>
              {q.question}
            </p>
            <div className="space-y-2">
              {(['a', 'b', 'c', 'd'] as const).map(opt => (
                <label
                  key={opt}
                  className={`flex items-start gap-2.5 cursor-pointer p-2 rounded-md transition-colors ${
                    answers[`q${i}`] === opt
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-muted/60 border border-transparent'
                  }`}
                >
                  <input
                    type="radio"
                    name={`q${i}`}
                    value={opt}
                    checked={answers[`q${i}`] === opt}
                    onChange={() => setAnswers(prev => ({ ...prev, [`q${i}`]: opt }))}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="text-sm">
                    <span className="font-medium text-muted-foreground mr-1">{opt.toUpperCase()})</span>
                    {q.options[opt]}
                  </span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center gap-3">
        <Progress value={(Object.keys(answers).length / questions.length) * 100} className="flex-1 h-1.5" />
        <span className="text-xs text-muted-foreground shrink-0">{Object.keys(answers).length}/{questions.length} answered</span>
      </div>

      <Button onClick={() => void submit()} disabled={!allAnswered || submitting} className="w-full">
        {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Scoring…</> : 'Submit Answers'}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Course Player
// ---------------------------------------------------------------------------

interface Props {
  module: TrainingModuleWithProgress;
  onBack: () => void;
  onComplete: () => void;
}

type Tab = 'content' | 'chat' | 'quiz';

export default function CoursePlayer({ module: mod, onBack, onComplete }: Props) {
  const apiFetch = useApi();
  const [tab, setTab] = useState<Tab>('content');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatStreaming, setChatStreaming] = useState(false);
  const [completed, setCompleted] = useState(!!mod.completed_at);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  async function askQuestion() {
    const q = chatInput.trim();
    if (!q || chatStreaming) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: q }]);
    setChatStreaming(true);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '', streaming: true };
    setChatMessages(prev => [...prev, assistantMsg]);

    try {
      const res = await apiFetch(`/api/training/my-modules/${mod.id}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const ev = JSON.parse(line.slice(6)) as { type: string; token?: string };
          if (ev.type === 'token' && ev.token) {
            setChatMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = { ...last, content: last.content + ev.token! };
              }
              return updated;
            });
          }
          if (ev.type === 'done') {
            setChatMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = { ...last, streaming: false };
              }
              return updated;
            });
          }
        }
      }
    } finally {
      setChatStreaming(false);
    }
  }

  function handlePass() {
    setCompleted(true);
    onComplete();
  }

  const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: 'content', label: 'Module', icon: BookOpen },
    { id: 'chat', label: 'Ask AI', icon: MessageSquare },
    { id: 'quiz', label: 'Quiz', icon: ClipboardCheck },
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b bg-background/80 backdrop-blur shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <Badge variant="secondary" className="text-xs">{mod.regulation}</Badge>
        <span className="text-sm font-medium">{mod.role}</span>
        {mod.quality_score != null && (
          <Badge variant={mod.quality_score >= 70 ? 'success' : 'warning'} className="text-xs ml-auto mr-2">
            Quality {mod.quality_score}%
          </Badge>
        )}
        {completed && (
          <Badge variant="success" className="text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
          </Badge>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex border-b bg-background shrink-0">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-sm transition-colors border-b-2 ${
                tab === t.id
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Module content tab */}
        {tab === 'content' && (
          <ScrollArea className="h-full">
            <div className="p-6 max-w-3xl">
              {mod.rationale && (
                <div className="mb-6 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Why this training?</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">{mod.rationale}</p>
                </div>
              )}
              {mod.content ? (
                <ModuleContent content={mod.content} />
              ) : (
                <p className="text-sm text-muted-foreground">Module content not available.</p>
              )}
              <div className="mt-8 flex justify-end">
                <Button onClick={() => setTab('quiz')}>
                  <ClipboardCheck className="h-4 w-4 mr-1.5" /> Take Knowledge Check
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}

        {/* Ask AI tab */}
        {tab === 'chat' && (
          <div className="flex flex-col h-full">
            <ScrollArea className="flex-1 p-4">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Ask any question about this module.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Answers are grounded in the training content only.</p>
                </div>
              )}
              <div className="space-y-4 max-w-2xl mx-auto">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {msg.content}
                      {msg.streaming && <span className="animate-pulse text-muted-foreground ml-0.5">▌</span>}
                    </div>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
            </ScrollArea>
            <div className="border-t p-3 bg-background shrink-0">
              <div className="flex gap-2 max-w-2xl mx-auto">
                <Textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Ask a question about this training module…"
                  className="min-h-[44px] max-h-[120px] resize-none text-sm"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void askQuestion();
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="self-end h-[44px] px-4"
                  onClick={() => void askQuestion()}
                  disabled={!chatInput.trim() || chatStreaming}
                >
                  {chatStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Quiz tab */}
        {tab === 'quiz' && (
          <ScrollArea className="h-full">
            <div className="p-6 max-w-2xl">
              <div className="flex items-center gap-2 mb-5">
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Knowledge Check</h2>
                <span className="text-xs text-muted-foreground ml-1">— Pass 3 of 4 questions to complete this module</span>
              </div>
              <QuizPanel moduleId={mod.id} onPass={handlePass} />
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
