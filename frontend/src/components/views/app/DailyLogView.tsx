"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookHeart, Save, Send, Pencil, Trash2, Inbox, AlertTriangle,
  RefreshCw, LockKeyhole, FileText, Mic, Square, Volume2, VolumeX,
} from "lucide-react";
import { api, ApiRequestError } from "@/lib/api";
import { MOODS } from "@/lib/constants";
import type { JournalDTO, Mood } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, Spinner } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SpeechRecognitionLike } from "@/lib/speech";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function DailyLogView() {
  const [journals, setJournals] = useState<JournalDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Composer state
  const [draftMood, setDraftMood] = useState<Mood | null>(null);
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState<"idle" | "draft" | "submit">("idle");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Edit dialog
  const [editing, setEditing] = useState<JournalDTO | null>(null);
  const [editMood, setEditMood] = useState<Mood | null>(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState<"idle" | "draft" | "submit">("idle");

  // Delete dialog
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.get<{ journals: JournalDTO[] }>("/api/journals");
      setJournals(r.journals);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't load journals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(loadId);
  }, [load]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  function toggleSpeechToText() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech-to-text is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ");
      setDraftText((current) => `${current}${current ? " " : ""}${transcript}`.slice(0, 10000));
    };
    recognition.onerror = () => {
      setIsListening(false);
      toast.error("Speech recognition stopped. You can continue typing.");
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function toggleTextToSpeech() {
    if (!draftText.trim()) {
      toast.error("Write or dictate a reflection first.");
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    if (!window.speechSynthesis) {
      toast.error("Text-to-speech is not supported in this browser.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(draftText);
    utterance.lang = "en-IN";
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }

  async function create(status: "DRAFT" | "SUBMITTED") {
    if (!draftText.trim()) { toast.error("Write a short reflection first."); return; }
    setSaving(status === "DRAFT" ? "draft" : "submit");
    try {
      const r = await api.post<{ journal: JournalDTO }>("/api/journals", {
        mood: draftMood, content: draftText.trim(), status,
      });
      setJournals((prev) => [r.journal, ...prev]);
      setDraftText(""); setDraftMood(null);
      toast.success(status === "DRAFT" ? "Draft saved." : "Entry recorded — thank you for reflecting.");
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Failed to save entry.");
    } finally {
      setSaving("idle");
    }
  }

  function openEdit(j: JournalDTO) {
    setEditing(j); setEditMood(j.mood); setEditText(j.content);
  }

  async function saveEdit(status: "DRAFT" | "SUBMITTED") {
    if (!editing) return;
    if (!editText.trim()) { toast.error("Content can't be empty."); return; }
    setEditSaving(status === "DRAFT" ? "draft" : "submit");
    try {
      const r = await api.put<{ journal: JournalDTO }>(`/api/journals/${editing.id}`, {
        mood: editMood, content: editText.trim(), status,
      });
      setJournals((prev) => prev.map((j) => (j.id === r.journal.id ? r.journal : j)));
      toast.success(status === "DRAFT" ? "Draft updated." : "Entry updated.");
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Failed to update entry.");
    } finally {
      setEditSaving("idle");
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;
    setDeleteBusy(true);
    try {
      await api.del(`/api/journals/${deletingId}`);
      setJournals((prev) => prev.filter((j) => j.id !== deletingId));
      toast.success("Entry deleted.");
      setDeletingId(null);
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Failed to delete entry.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Daily Journal</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Reflect on your day. Entries are private and stored securely.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Composer */}
        <div className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                <BookHeart className="h-4 w-4 text-primary" /> New entry
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MoodPicker value={draftMood} onChange={setDraftMood} />
              <Textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="What would you like to reflect on today?"
                rows={8}
                maxLength={10000}
                className="resize-none"
                aria-label="Reflection text"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleSpeechToText}
                  aria-label={isListening ? "Stop speech to text" : "Start speech to text"}
                  className={cn(isListening && "border-destructive text-destructive hover:text-destructive")}
                >
                  {isListening ? <Square className="mr-1.5 h-3.5 w-3.5" /> : <Mic className="mr-1.5 h-3.5 w-3.5" />}
                  {isListening ? "Stop dictation" : "Speak to type"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleTextToSpeech}
                  aria-label={isSpeaking ? "Stop reading reflection aloud" : "Read reflection aloud"}
                >
                  {isSpeaking ? <VolumeX className="mr-1.5 h-3.5 w-3.5" /> : <Volume2 className="mr-1.5 h-3.5 w-3.5" />}
                  {isSpeaking ? "Stop reading" : "Read aloud"}
                </Button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{draftText.length} / 10,000</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => create("DRAFT")} disabled={saving !== "idle" || !draftText.trim()}>
                    {saving === "draft" && <Spinner className="mr-2 h-4 w-4" />} Save Draft
                  </Button>
                  <Button size="sm" onClick={() => create("SUBMITTED")} disabled={saving !== "idle" || !draftText.trim()}>
                    {saving === "submit" && <Spinner className="mr-2 h-4 w-4" />}
                    <Send className="mr-1.5 h-3.5 w-3.5" /> Submit Entry
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3.5">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Entries are analyzed for wellbeing signals to help connect you with support when needed.
              Your text is never shared without consent.
            </p>
          </div>
        </div>

        {/* History */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4 text-primary" /> Your entries
              <span className="text-xs font-normal text-muted-foreground">({journals.length})</span>
            </h2>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : error ? (
            <EmptyState icon={AlertTriangle} title="Couldn't load journals" description={error}
              action={<Button onClick={load} variant="outline"><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>} />
          ) : journals.length === 0 ? (
            <EmptyState icon={Inbox} title="No journal entries yet"
              description="Your reflections will appear here once you write your first entry." />
          ) : (
            <ul className="space-y-3 max-h-[720px] overflow-y-auto calm-scroll pr-1">
              {journals.map((j) => {
                const mood = MOODS.find((m) => m.value === j.mood);
                return (
                  <li key={j.id}>
                    <Card className="border-border/60 transition-colors hover:border-primary/30">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              {mood && <span aria-hidden className="text-base">{mood.emoji}</span>}
                              <span className="text-xs font-medium text-foreground">{fmtDate(j.createdAt)}</span>
                              <span className="text-xs text-muted-foreground">· {fmtTime(j.createdAt)}</span>
                              <Badge variant={j.status === "DRAFT" ? "secondary" : "default"} className="ml-auto text-[10px]">
                                {j.status === "DRAFT" ? "Draft" : "Submitted"}
                              </Badge>
                            </div>
                            <p className="line-clamp-3 text-sm leading-relaxed text-foreground/85">{j.content}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end gap-1.5">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(j)}>
                            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeletingId(j.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit entry</DialogTitle>
            <DialogDescription>
              {editing && `Created ${fmtDate(editing.createdAt)} at ${fmtTime(editing.createdAt)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <MoodPicker value={editMood} onChange={setEditMood} />
            <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={8} maxLength={10000} className="resize-none" />
            <p className="text-right text-xs text-muted-foreground">{editText.length} / 10,000</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => saveEdit("DRAFT")} disabled={editSaving !== "idle" || !editText.trim()}>
              {editSaving === "draft" && <Spinner className="mr-2 h-4 w-4" />} Save as Draft
            </Button>
            <Button size="sm" onClick={() => saveEdit("SUBMITTED")} disabled={editSaving !== "idle" || !editText.trim()}>
              {editSaving === "submit" && <Spinner className="mr-2 h-4 w-4" />}
              <Send className="mr-1.5 h-3.5 w-3.5" /> Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The entry will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBusy && <Spinner className="mr-2 h-4 w-4" />}
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MoodPicker({ value, onChange }: { value: Mood | null; onChange: (m: Mood | null) => void }) {
  return (
    <div className="mb-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Mood (optional)</p>
      <div className="flex flex-wrap gap-1.5">
        {MOODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(value === m.value ? null : m.value)}
            aria-pressed={value === m.value}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              value === m.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
            )}
          >
            <span aria-hidden>{m.emoji}</span>{m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
