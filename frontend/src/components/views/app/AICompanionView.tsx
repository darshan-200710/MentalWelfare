"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Mic, Square, Volume2, Plus, MessageCircleHeart, AlertTriangle,
  LifeBuoy, ShieldCheck, Sparkles, Loader2,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { api, ApiRequestError } from "@/lib/api";
import type { AIMessageDTO } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  riskFlag: boolean;
  createdAt: string;
  pending?: boolean;
}

interface ChatResponse {
  conversationId: string;
  message: AIMessageDTO;
  userMessageId: string;
  riskFlag: boolean;
  safetyMessage: string | null;
}

function fmtAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AICompanionView() {
  const { navigate } = useApp();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConv, setLoadingConv] = useState(true);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // voice input state
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeRef = useRef<string>("audio/webm");

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = useCallback(async (autoSelect = false) => {
    setLoadingConv(true);
    try {
      const r = await api.get<{ conversations: Conversation[] }>("/api/ai/conversations");
      setConversations(r.conversations);
      if (autoSelect && r.conversations.length > 0) {
        setActiveConvId((prev) => prev ? prev : r.conversations[0].id);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingConv(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => { void loadConversations(true); }, 0);
    return () => window.clearTimeout(id);
  }, [loadConversations]);

  // Load message history whenever activeConvId changes
  useEffect(() => {
    if (!activeConvId) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ messages: ChatMessage[] }>(`/api/ai/conversations/${activeConvId}`);
        if (!cancelled && res?.messages) {
          setMessages(res.messages);
        }
      } catch (e) {
        if (!cancelled) toast.error("Could not load previous conversation messages.");
      }
    })();
    return () => { cancelled = true; };
  }, [activeConvId]);


  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  function startNewChat() {
    setActiveConvId(null);
    setMessages([]);
    setInput("");
  }

  const [wasVoiceInput, setWasVoiceInput] = useState(false);

  async function send(text: string, forceVoiceOutput = false) {
    const t = text.trim();
    if (!t || sending) return;
    const shouldSpeakResponse = forceVoiceOutput || wasVoiceInput;
    setWasVoiceInput(false);
    setInput("");
    setSending(true);

    const userMsg: ChatMessage = {
      id: `tmp-u-${Date.now()}`,
      role: "user", content: t, riskFlag: false,
      createdAt: new Date().toISOString(),
    };
    const pendingAssistant: ChatMessage = {
      id: `tmp-a-${Date.now()}`,
      role: "assistant", content: "", riskFlag: false,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, userMsg, pendingAssistant]);

    try {
      const r = await api.post<ChatResponse>("/api/ai/chat", {
        message: t, conversationId: activeConvId ?? undefined,
      });
      if (!activeConvId) setActiveConvId(r.conversationId);
      const assistantMsg: ChatMessage = {
        id: r.message.id,
        role: "assistant",
        content: r.message.content,
        riskFlag: r.riskFlag,
        createdAt: r.message.createdAt,
        pending: false,
      };
      setMessages((prev) => prev.map((m) =>
        m.id === pendingAssistant.id ? assistantMsg : m
      ));
      // If the input was provided as voice, auto-play response speech by default
      if (shouldSpeakResponse) {
        speak(assistantMsg);
      }
      // refresh conversation list sidebar
      loadConversations();
      if (r.riskFlag) {
        toast.warning("Support options are available below.");
      }
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : "Couldn't send message. Please try again.";
      setMessages((prev) => prev.filter((m) => m.id !== pendingAssistant.id).filter((m) => m.id !== userMsg.id));
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }


  // -------- Voice input --------
  async function startVoiceInput() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
      let mime = "";
      for (const c of candidates) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) { mime = c; break; }
      }
      mimeRef.current = mime || "audio/webm";
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = handleVoiceStop;
      rec.start();
      setVoiceSeconds(0);
      timerRef.current = setInterval(() => setVoiceSeconds((s) => s + 1), 1000);
      setVoiceMode(true);
    } catch (e: any) {
      const name = e?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        toast.error("Microphone access denied.");
      } else {
        toast.error("Couldn't start microphone.");
      }
    }
  }

  function stopVoiceInput() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    setVoiceMode(false);
  }

  async function handleVoiceStop() {
    const duration = voiceSeconds;
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    try {
      const blob = new Blob(chunksRef.current, { type: mimeRef.current });
      if (blob.size === 0) { toast.error("Recording was empty."); return; }
      const dataUrl = await blobToDataUrl(blob);
      toast.info("Transcribing your voice message…");
      const r = await api.post<{ transcript: string }>("/api/voice/transcribe", {
        audio: dataUrl, mime: mimeRef.current, durationSec: duration,
      });
      if (r.transcript) {
        setInput(r.transcript);
        setWasVoiceInput(true);
        console.log("Voice message transcribed — send to receive spoken response.");
      } else {
        toast.error("Transcription returned empty. Please type instead.");
      }

    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Transcription failed.");
    }
  }

  // -------- TTS --------
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function speak(m: ChatMessage) {
    // stop existing
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (speakingId === m.id) { setSpeakingId(null); return; }
    setSpeakingId(m.id);
    try {
      const res = await api.blob("/api/tts", {
        method: "POST",
        json: { text: m.content.slice(0, 1024) },
      });
      const blob = await (res as unknown as Response).blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeakingId(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setSpeakingId(null); toast.error("Couldn't play audio."); URL.revokeObjectURL(url); };
      await audio.play();
    } catch (e) {
      setSpeakingId(null);
      toast.error(e instanceof ApiRequestError ? e.message : "Voice output unavailable right now.");
    }
  }

  const hasMessages = messages.length > 0;
  const showRiskPanel = messages.some((m) => m.riskFlag && m.role === "assistant" && !m.pending);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mx-auto flex w-full max-w-7xl flex-1 overflow-hidden px-2 sm:px-4">
        {/* Sidebar (conversations) — hidden on mobile */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar/40 md:flex">
          <div className="flex items-center justify-between border-b border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Chats</p>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={startNewChat} aria-label="New chat">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-1 p-2">
              <button
                onClick={startNewChat}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  !activeConvId ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground/80"
                )}
              >
                <Plus className="h-4 w-4 shrink-0" /> New chat
              </button>
              {loadingConv ? (
                <div className="space-y-2 p-1">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
                </div>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveConvId(c.id)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors",
                      activeConvId === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground/80"
                    )}
                  >
                    <span className="truncate font-medium">{c.title || "New conversation"}</span>
                    <span className={cn("text-[10px]", activeConvId === c.id ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {fmtAgo(c.updatedAt)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Main chat area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3 sm:px-5">
            <div className="flex items-center gap-2">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageCircleHeart className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">AI Companion</p>
                <p className="text-[10px] text-muted-foreground">Always here to listen</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="md:hidden" onClick={startNewChat}>
              <Plus className="mr-1 h-4 w-4" /> New
            </Button>
          </header>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto calm-scroll bg-background/40 px-3 py-4 sm:px-6">
            {!hasMessages ? (
              <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h2 className="serif text-xl font-semibold text-foreground">How can I support you today?</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Talk through your day, share what's on your mind, or try a grounding exercise together.
                </p>
                <div className="mt-6 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    "I'm feeling overwhelmed today",
                    "Help me unwind before bed",
                    "I had a tough conversation",
                    "Let's try a breathing exercise",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left text-sm text-foreground/80 transition-colors hover:border-primary/40 hover:bg-muted/40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="mt-8 text-xs text-muted-foreground">
                  AI-assisted companion — not a clinician, not a diagnosis.
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-2xl space-y-4">
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    onSpeak={() => speak(m)}
                    speaking={speakingId === m.id}
                  />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Risk panel */}
          {showRiskPanel && (
            <div className="border-t border-amber-200 bg-amber-50 px-3 py-3 sm:px-6 dark:border-amber-900/40 dark:bg-amber-950/30">
              <div className="mx-auto flex max-w-2xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                      You don't have to go through this alone
                    </p>
                    <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                      Confidential support is available right now. Reach out — it's a sign of strength.
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={() => navigate("support")} className="shrink-0">
                  <LifeBuoy className="mr-1.5 h-4 w-4" /> Get support now
                </Button>
              </div>
            </div>
          )}

          {/* Composer */}
          <div className="shrink-0 border-t border-border bg-background px-3 py-3 sm:px-6">
            <div className="mx-auto max-w-2xl">
              <div className="flex items-end gap-2">
                {voiceMode ? (
                  <div className="flex flex-1 items-center justify-between rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="rec-pulse inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
                      <span className="text-sm font-medium text-destructive">Recording… {Math.floor(voiceSeconds / 60)}:{(voiceSeconds % 60).toString().padStart(2, "0")}</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={stopVoiceInput}>
                      <Square className="mr-1.5 h-3.5 w-3.5" /> Stop
                    </Button>
                  </div>
                ) : (
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send(input);
                      }
                    }}
                    placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                    rows={1}
                    className="max-h-40 min-h-[44px] resize-none"
                    aria-label="Message"
                  />
                )}
                {!voiceMode && (
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={startVoiceInput}
                    disabled={sending}
                    aria-label="Voice input"
                    className="h-11 w-11 shrink-0"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  onClick={() => send(input)}
                  disabled={sending || !input.trim()}
                  aria-label="Send message"
                  className="h-11 w-11 shrink-0"
                >
                  {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                AI-assisted companion — not a clinician, not a diagnosis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, onSpeak, speaking }: { message: ChatMessage; onSpeak: () => void; speaking: boolean }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          isUser ? "bg-primary/15 text-primary" : "bg-primary text-primary-foreground"
        )}
        aria-hidden
      >
        {isUser ? "You" : <MessageCircleHeart className="h-4 w-4" />}
      </div>
      <div className={cn("flex max-w-[85%] flex-col gap-1", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
            isUser
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm bg-card text-card-foreground border border-border/60"
          )}
        >
          {message.pending ? (
            <div className="flex items-center gap-1 py-0.5" aria-label="Assistant is typing">
              <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
        {!message.pending && !isUser && (
          <div className="flex items-center gap-2">
            <button
              onClick={onSpeak}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={speaking ? "Stop speaking" : "Speak response"}
            >
              {speaking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
              {speaking ? "Speaking…" : "Speak"}
            </button>
            {message.riskFlag && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" /> Support available
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
