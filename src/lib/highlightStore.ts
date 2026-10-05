import { useState, useEffect } from 'react';

export type HighlightClickMode = 'cycle' | 'menu';

export interface ColorDefinition {
  id: string; // Class name or empty string for unhighlighted
  name: string;
  shortLabel: string;
  dotBg: string;
  hex: string;
  icon: string;
}

export const COLOR_CYCLE: ColorDefinition[] = [
  { 
    id: '', 
    name: 'Sem Marcação (Zerado)', 
    shortLabel: 'Zerar', 
    dotBg: 'border border-dashed border-white/50 bg-black/40', 
    hex: 'transparent', 
    icon: '✖️' 
  },
  { 
    id: 'highlight-yellow', 
    name: 'Amarelo Ouro', 
    shortLabel: 'Amarelo', 
    dotBg: 'bg-[#ffee00]', 
    hex: '#ffee00', 
    icon: '🟡' 
  },
  { 
    id: 'highlight-cyan', 
    name: 'Ciano Neon', 
    shortLabel: 'Ciano', 
    dotBg: 'bg-[#00f5ff]', 
    hex: '#00f5ff', 
    icon: '🔷' 
  },
  { 
    id: 'highlight-pink', 
    name: 'Branco / Rosa', 
    shortLabel: 'Branco/Rosa', 
    dotBg: 'bg-white shadow-[0_0_6px_#fff]', 
    hex: '#ffffff', 
    icon: '⚪' 
  },
  { 
    id: 'highlight-green-fluo', 
    name: 'Verde Flúor', 
    shortLabel: 'Verde', 
    dotBg: 'bg-[#39ff14]', 
    hex: '#39ff14', 
    icon: '🟢' 
  },
  { 
    id: 'highlight-crimson', 
    name: 'Carmim Real', 
    shortLabel: 'Carmim', 
    dotBg: 'bg-[#dc143c]', 
    hex: '#dc143c', 
    icon: '🔴' 
  },
];

export const getNextColor = (currentColor: string): ColorDefinition => {
  const currentIndex = COLOR_CYCLE.findIndex(c => c.id === currentColor);
  if (currentIndex === -1) {
    // If not found in cycle, start with the first actual highlight color (Amarelo)
    return COLOR_CYCLE[1];
  }
  const nextIndex = (currentIndex + 1) % COLOR_CYCLE.length;
  return COLOR_CYCLE[nextIndex];
};

let currentClickMode: HighlightClickMode = (() => {
  try {
    const saved = localStorage.getItem('pulpito_click_mode');
    if (saved === 'menu' || saved === 'cycle') return saved;
  } catch (e) {}
  return 'cycle'; // Default is fast cycle
})();

const modeListeners = new Set<(mode: HighlightClickMode) => void>();

export const highlightModeStore = {
  get: () => currentClickMode,
  set: (mode: HighlightClickMode) => {
    currentClickMode = mode;
    try {
      localStorage.setItem('pulpito_click_mode', mode);
    } catch (e) {}
    modeListeners.forEach(fn => fn(currentClickMode));
  },
  toggle: () => {
    const next = currentClickMode === 'cycle' ? 'menu' : 'cycle';
    highlightModeStore.set(next);
  },
  subscribe: (listener: (mode: HighlightClickMode) => void) => {
    modeListeners.add(listener);
    return () => {
      modeListeners.delete(listener);
    };
  }
};

export const useHighlightMode = () => {
  const [mode, setMode] = useState<HighlightClickMode>(currentClickMode);

  useEffect(() => {
    return highlightModeStore.subscribe(setMode);
  }, []);

  return {
    mode,
    isCycle: mode === 'cycle',
    setMode: highlightModeStore.set,
    toggleMode: highlightModeStore.toggle
  };
};
