import { useState, useEffect } from 'react';

export interface BrushConfig {
  isActive: boolean;
  color: string; // e.g. 'highlight-yellow', 'highlight-cyan', etc.
  fontSize: number; // e.g. 100, 130, 160, 200, 250
  bold: boolean;
  underline: boolean;
  italic: boolean;
  uppercase: boolean;
  isEraser: boolean;
}

const defaultBrush: BrushConfig = {
  isActive: false,
  color: 'highlight-yellow',
  fontSize: 130,
  bold: true,
  underline: false,
  italic: false,
  uppercase: false,
  isEraser: false
};

// Initial state loaded from localStorage if exists
let currentBrush: BrushConfig = (() => {
  try {
    const saved = localStorage.getItem('pulpito_brush_config');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return defaultBrush;
})();

const listeners = new Set<(brush: BrushConfig) => void>();

export const brushStore = {
  get: () => currentBrush,
  
  set: (newBrush: Partial<BrushConfig>) => {
    currentBrush = { ...currentBrush, ...newBrush };
    localStorage.setItem('pulpito_brush_config', JSON.stringify(currentBrush));
    listeners.forEach(l => l(currentBrush));
  },
  
  subscribe: (listener: (brush: BrushConfig) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};

export const useBrush = () => {
  const [brush, setBrush] = useState<BrushConfig>(currentBrush);

  useEffect(() => {
    return brushStore.subscribe(setBrush);
  }, []);

  const updateBrush = (updates: Partial<BrushConfig>) => {
    brushStore.set(updates);
  };

  const toggleActive = () => {
    brushStore.set({ isActive: !brush.isActive });
  };

  return {
    ...brush,
    brush,
    setBrush: updateBrush,
    toggleActive
  };
};
