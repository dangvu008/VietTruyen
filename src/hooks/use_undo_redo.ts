import { useCallback, useRef, useState } from 'react';

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 500;

interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
  pushSnapshot: (content: string) => void;
  undo: () => string | null;
  redo: () => string | null;
  clear: () => void;
}

export function useUndoRedo(initialContent?: string): UndoRedoState {
  const undoStack = useRef<string[]>(initialContent != null ? [initialContent] : []);
  const redoStack = useRef<string[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushed = useRef<string | null>(initialContent ?? null);
  const [version, setVersion] = useState(0);

  const pushSnapshot = useCallback((content: string) => {
    if (content === lastPushed.current) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      if (content === lastPushed.current) return;

      if (undoStack.current.length >= MAX_HISTORY) {
        undoStack.current.shift();
      }
      undoStack.current.push(content);
      redoStack.current = [];
      lastPushed.current = content;
      setVersion((v) => v + 1);
    }, DEBOUNCE_MS);
  }, []);

  const undo = useCallback((): string | null => {
    if (undoStack.current.length <= 1) return null;
    const current = undoStack.current.pop()!;
    redoStack.current.push(current);
    const previous = undoStack.current[undoStack.current.length - 1];
    lastPushed.current = previous;
    setVersion((v) => v + 1);
    return previous;
  }, []);

  const redo = useCallback((): string | null => {
    if (redoStack.current.length === 0) return null;
    const next = redoStack.current.pop()!;
    undoStack.current.push(next);
    lastPushed.current = next;
    setVersion((v) => v + 1);
    return next;
  }, []);

  const clear = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    lastPushed.current = null;
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    setVersion((v) => v + 1);
  }, []);

  void version;

  return {
    canUndo: undoStack.current.length > 1,
    canRedo: redoStack.current.length > 0,
    pushSnapshot,
    undo,
    redo,
    clear,
  };
}
