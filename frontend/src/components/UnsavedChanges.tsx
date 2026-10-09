import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useBlocker, useLocation } from "react-router-dom";

type Entry = { arm: () => void; dirty: () => boolean; reset: () => void; save?: () => Promise<boolean> | boolean };
type Registry = Map<symbol, Entry> & { requestLeave: (action: () => void) => void };
const Context = createContext<Registry | null>(null);

// Only persisted form state belongs here: do not include searches, open panels or loading flags.
export function useUnsavedChanges(value: unknown, saveDraft?: () => Promise<boolean> | boolean, enabled = true) {
  const entries = useContext(Context);
  if (!entries) throw new Error("UnsavedChangesProvider is required.");
  const location = useLocation();
  const serialized = JSON.stringify(value, (_key, item) => item instanceof File
    ? { name: item.name, size: item.size, modified: item.lastModified, type: item.type } : item);
  const serializeValue = (nextValue: unknown) => JSON.stringify(nextValue, (_key, item) => item instanceof File
    ? { name: item.name, size: item.size, modified: item.lastModified, type: item.type } : item);
  const state = useRef({ key: location.key, current: serialized, baseline: serialized, armed: false });
  if (state.current.key !== location.key) state.current = { key: location.key, current: serialized, baseline: serialized, armed: false };
  state.current.current = serialized;
  if (!enabled) state.current.armed = false;
  if (!state.current.armed) state.current.baseline = serialized;
  const save = useRef(saveDraft);
  save.current = saveDraft;
  const entry = useMemo<Entry>(() => ({
    arm: () => { state.current.armed = true; },
    dirty: () => state.current.armed && state.current.current !== state.current.baseline,
    reset: () => { state.current.baseline = state.current.current; state.current.armed = false; },
  }), []);
  entry.save = saveDraft ? () => save.current?.() ?? false : undefined;
  useLayoutEffect(() => {
    const id = Symbol(); entries.set(id, entry);
    return () => { entries.delete(id); };
  }, [entries, entry]);
  return useMemo(() => ({
    snapshot: () => state.current.current,
    baseline: () => state.current.baseline,
    requestLeave: (action: () => void) => entries.requestLeave(action),
    markSaved: (snapshot = state.current.current) => {
      state.current.baseline = snapshot;
      // Server-generated values can hydrate after saving, until the next user edit.
      if (state.current.current === snapshot) state.current.armed = false;
    },
    markSavedValue: (savedValue: unknown) => {
      const snapshot = serializeValue(savedValue);
      state.current.baseline = snapshot;
      if (state.current.current === snapshot) state.current.armed = false;
    },
  }), []);
}

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const entries = useMemo(() => new Map<symbol, Entry>() as Registry, []);
  const [localLeave, setLocalLeave] = useState<(() => void) | null>(null);
  const dirtyEntries = () => [...entries.values()].filter(entry => entry.dirty());
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search) && dirtyEntries().length > 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  entries.requestLeave = action => {
    if (dirtyEntries().length) { setError(""); setLocalLeave(() => action); }
    else action();
  };
  const blocked = blocker.state === 'blocked' || localLeave !== null;
  const reset = () => { setLocalLeave(null); if (blocker.state === 'blocked') blocker.reset(); };
  const proceed = () => {
    if (localLeave) { entries.forEach(entry => entry.reset()); setLocalLeave(null); localLeave(); }
    else if (blocker.state === 'blocked') blocker.proceed();
  };
  const dialog = useRef<HTMLDivElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const arm = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.app-content') && !target.closest('[data-unsaved-dialog]')) {
        entries.forEach(entry => entry.arm());
      }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyEntries().length) { event.preventDefault(); event.returnValue = ""; }
    };
    // Capture before React updates state, including button-driven row additions/removals.
    for (const name of ['pointerdown', 'keydown', 'beforeinput', 'input', 'change']) document.addEventListener(name, arm, true);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      for (const name of ['pointerdown', 'keydown', 'beforeinput', 'input', 'change']) document.removeEventListener(name, arm, true);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [entries]);
  useEffect(() => {
    if (!blocked) return;
    setError("");
    const previous = document.activeElement as HTMLElement | null;
    stay.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [blocked]);
  const saveAndLeave = async () => {
    if (saving || !blocked) return;
    setSaving(true); setError("");
    try {
      for (const entry of dirtyEntries()) {
        if (!entry.save || !await entry.save()) throw new Error('Draft could not be saved. Stay on this screen to review the entry.');
      }
      if (dirtyEntries().length) throw new Error('There are still unsaved changes. Review the entry before leaving.');
      proceed();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Draft could not be saved. Please try again.'); }
    finally { setSaving(false); }
  };
  return <Context.Provider value={entries}>{children}{blocked &&
    <div className="app-confirm-overlay" data-unsaved-dialog="true" style={{ zIndex: 20000 }}>
      <div ref={dialog} className="app-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title" aria-describedby="unsaved-description"
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!saving) reset(); }
          if (event.key === 'Tab') {
            const buttons = [...(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])];
            const first = buttons[0], last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}>
        <div className="app-confirm-copy"><h2 id="unsaved-title">You have unsaved changes</h2>
          <p id="unsaved-description">{dirtyEntries().every(entry => entry.save)
            ? 'Save this entry as a draft before leaving?'
            : 'Stay to save your entry, or discard your changes and leave.'}</p></div>
        {error && <p role="alert" className="marketing-form-alert error">{error}</p>}
        <div className="app-confirm-actions">
          <button ref={stay} type="button" disabled={saving} onClick={reset}>Stay</button>
          <button type="button" className="app-confirm-delete-button" disabled={saving} onClick={proceed}>Discard &amp; Leave</button>
          {dirtyEntries().length > 0 && dirtyEntries().every(entry => entry.save) && <button type="button" className="app-confirm-primary-button" disabled={saving} onClick={() => void saveAndLeave()}>{saving ? 'Saving…' : 'Save Draft & Leave'}</button>}
        </div>
      </div>
    </div>}</Context.Provider>;
}
