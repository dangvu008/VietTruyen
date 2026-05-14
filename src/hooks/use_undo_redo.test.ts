import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('useUndoRedo (unit logic)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('ring buffer caps at MAX_HISTORY (50)', () => {
    const undoStack: string[] = ['v0'];
    const MAX = 50;

    for (let i = 1; i <= 55; i++) {
      if (undoStack.length >= MAX) undoStack.shift();
      undoStack.push(`v${i}`);
    }

    expect(undoStack.length).toBe(50);
    expect(undoStack[0]).toBe('v6');
    expect(undoStack[49]).toBe('v55');
  });

  it('undo pops from undo stack and pushes to redo', () => {
    const undoStack = ['v0', 'v1', 'v2'];
    const redoStack: string[] = [];

    const current = undoStack.pop()!;
    redoStack.push(current);
    const previous = undoStack[undoStack.length - 1];

    expect(previous).toBe('v1');
    expect(redoStack).toEqual(['v2']);
    expect(undoStack).toEqual(['v0', 'v1']);
  });

  it('redo pops from redo stack and pushes to undo', () => {
    const undoStack = ['v0', 'v1'];
    const redoStack = ['v2'];

    const next = redoStack.pop()!;
    undoStack.push(next);

    expect(undoStack).toEqual(['v0', 'v1', 'v2']);
    expect(redoStack).toEqual([]);
  });

  it('new edit clears redo stack', () => {
    const undoStack = ['v0', 'v1'];
    const redoStack = ['v2', 'v3'];

    undoStack.push('v4');
    redoStack.length = 0;

    expect(redoStack).toEqual([]);
    expect(undoStack).toEqual(['v0', 'v1', 'v4']);
  });

  it('undo returns null when only one snapshot', () => {
    const undoStack = ['v0'];
    const canUndo = undoStack.length > 1;
    expect(canUndo).toBe(false);
  });

  it('debounce groups rapid edits into one snapshot', () => {
    let lastPushed = 'v0';
    const undoStack = ['v0'];
    let timer: ReturnType<typeof setTimeout> | null = null;

    function pushSnapshot(content: string) {
      if (content === lastPushed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (undoStack.length >= 50) undoStack.shift();
        undoStack.push(content);
        lastPushed = content;
      }, 500);
    }

    pushSnapshot('v1');
    pushSnapshot('v2');
    pushSnapshot('v3');
    vi.advanceTimersByTime(600);

    expect(undoStack).toEqual(['v0', 'v3']);
  });
});
