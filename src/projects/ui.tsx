/**
 * Shared project-dashboard UI primitives, ported (not copied) from the
 * Green-Casting dashboard panels: a progress bar, a track-status badge, a 0-5
 * star rating, a dev-status pill, and a voice/text ProjectNote composer.
 *
 * These are reused by the admin ProjectDetail page and the customer MyProject
 * page so the two surfaces share one look without duplicating logic. The admin
 * composer and the customer composer differ only in whether a save fires the
 * SES notification — that is passed in via the `onCreated` callback.
 */

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Send } from 'lucide-react';
import { createTextNote, createVoiceNote, voiceUrl } from './notes';

const DEV_STATUSES = [
  { v: 'NOT_STARTED', label: 'Not started' },
  { v: 'IN_PROGRESS', label: 'In progress' },
  { v: 'READY_FOR_REVIEW', label: 'Ready for review' },
  { v: 'AWAITING_FEEDBACK', label: 'Awaiting feedback' },
  { v: 'COMPLETE', label: 'Complete' },
] as const;

export const DEV_STATUS_OPTIONS = DEV_STATUSES;

const DEV_STATUS_TONE: Record<string, string> = {
  NOT_STARTED: 'bg-white/5 text-ace-muted',
  IN_PROGRESS: 'bg-yellow-500/15 text-yellow-400',
  READY_FOR_REVIEW: 'bg-ace-cyan/15 text-ace-cyan',
  AWAITING_FEEDBACK: 'bg-ace-purple/15 text-ace-purple',
  COMPLETE: 'bg-green-500/15 text-green-400',
};

export function devStatusLabel(v?: string | null): string {
  return DEV_STATUSES.find((s) => s.v === v)?.label || 'Not started';
}

export function DevStatusBadge({ value }: { value?: string | null }) {
  const v = value || 'NOT_STARTED';
  return (
    <span className={`badge ${DEV_STATUS_TONE[v] || DEV_STATUS_TONE.NOT_STARTED}`}>
      {devStatusLabel(v)}
    </span>
  );
}

const TRACK_TONE: Record<string, string> = {
  ontrack: 'bg-green-500/15 text-green-400',
  atrisk: 'bg-yellow-500/15 text-yellow-400',
  behind: 'bg-red-500/15 text-red-400',
};

export function TrackBadge({ tone, label }: { tone: string; label: string }) {
  return <span className={`badge ${TRACK_TONE[tone] || TRACK_TONE.ontrack}`}>{label}</span>;
}

/** A labeled progress bar (0-100). */
export function ProgressBar({
  label,
  value,
  accent = 'bg-ace-purple',
}: {
  label?: string;
  value: number;
  accent?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      {label && (
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-ace-muted">{label}</span>
          <span className="font-semibold">{pct}%</span>
        </div>
      )}
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full ${accent} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * 0-5 star rating. When `editable` and `onChange` are provided the stars are
 * clickable (clicking the current value clears it back to 0). Used by the
 * customer dashboard to set ProjectPage.clientApproval.
 */
export function StarRating({
  value,
  editable = false,
  onChange,
}: {
  value: number;
  editable?: boolean;
  onChange?: (next: number) => void;
}) {
  const v = value || 0;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!editable}
          onClick={() => editable && onChange?.(v === n ? 0 : n)}
          className={`text-lg leading-none ${n <= v ? 'text-yellow-400' : 'text-white/20'} ${
            editable ? 'cursor-pointer hover:text-yellow-300' : 'cursor-default'
          }`}
          aria-label={v === n ? 'Clear rating' : `${n} of 5`}
          title={editable ? `${n} of 5` : undefined}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/** Playback element for a stored voice note (resolves a signed URL). */
export function VoiceNotePlayer({ audioKey }: { audioKey: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    voiceUrl(audioKey).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [audioKey]);
  if (!url) return <div className="text-xs text-ace-muted">Loading audio…</div>;
  return <audio className="w-full mt-1" controls src={url} />;
}

type Flash = { msg: string; tone: 'ok' | 'err' } | null;

/**
 * Text + voice ProjectNote composer. On a successful save it calls `onCreated`
 * with the note kind and a short reference string. The caller decides what to
 * do next: the customer dashboard fires the SES notification; the admin view
 * just refreshes. Voice recording uses the browser MediaRecorder API and the
 * notes.ts helpers (which upload to project/{projectId}/notes/* then persist).
 */
export function NoteComposer({
  projectId,
  pageKey,
  onCreated,
}: {
  projectId: string;
  pageKey?: string;
  onCreated: (info: { kind: 'TEXT' | 'VOICE'; noteRef: string }) => void | Promise<void>;
}) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function showFlash(msg: string, tone: 'ok' | 'err') {
    setFlash({ msg, tone });
    window.setTimeout(() => setFlash(null), 3500);
  }

  async function postText() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { note } = await createTextNote(projectId, pageKey, text.trim());
      setText('');
      showFlash('Note sent ✓', 'ok');
      await onCreated({ kind: 'TEXT', noteRef: note?.id || 'note' });
    } catch (err) {
      console.error(err);
      showFlash('Could not send the note. Please try again.', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        if (blob.size === 0) {
          showFlash('Nothing recorded — try again.', 'err');
          return;
        }
        setBusy(true);
        setFlash({ msg: 'Uploading voice note…', tone: 'ok' });
        try {
          const { note, audioKey } = await createVoiceNote(projectId, pageKey, blob);
          showFlash('Voice note sent ✓', 'ok');
          await onCreated({ kind: 'VOICE', noteRef: audioKey || note?.id || 'voice-note' });
        } catch (err) {
          console.error(err);
          showFlash('Voice note failed to send. Please try again.', 'err');
        } finally {
          setBusy(false);
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      showFlash('Microphone access is needed to record.', 'err');
    }
  }

  function stopRec() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="space-y-2">
      {flash && (
        <div
          className={`text-xs px-3 py-2 rounded-lg ${
            flash.tone === 'ok'
              ? 'bg-green-500/10 text-green-400'
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          {flash.msg}
        </div>
      )}
      {recording && (
        <div className="text-xs text-red-400">● Recording… tap Stop &amp; send when done.</div>
      )}
      <textarea
        className="input min-h-[70px] resize-y"
        placeholder="Type a note…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={postText}
          disabled={busy || !text.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ace-purple/15 text-ace-purple border border-ace-purple/20 text-sm disabled:opacity-50"
        >
          <Send size={14} /> Send note
        </button>
        {!recording ? (
          <button
            onClick={startRec}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-white border border-[rgba(255,255,255,0.06)] text-sm disabled:opacity-50"
          >
            <Mic size={14} /> Record voice
          </button>
        ) : (
          <button
            onClick={stopRec}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 text-sm"
          >
            <Square size={14} /> Stop &amp; send
          </button>
        )}
      </div>
    </div>
  );
}
