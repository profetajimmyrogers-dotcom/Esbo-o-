import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bold, Underline, Check, Plus, Minus, RotateCcw, Sparkles } from 'lucide-react';
import { useBrush } from '../lib/brushStore';
import { useHighlightMode, COLOR_CYCLE, getNextColor } from '../lib/highlightStore';

interface HighlightableTextProps {
  text: string;
  sermonId: string;
  sectionKey: string;
  highlights?: Record<string, string>;
  onHighlight: (key: string, color: string) => void;
}

interface EditingWordState {
  key: string;
  originalWord: string;
  color: string;
  fontSize: number;
  bold: boolean;
  underline: boolean;
  uppercase: boolean;
  italic: boolean;
}

interface FeedbackBadgeState {
  key: string;
  name: string;
  icon: string;
  hex: string;
  x: number;
  y: number;
}

export const HighlightableText = ({ 
  text, 
  sectionKey, 
  highlights, 
  onHighlight 
}: HighlightableTextProps) => {
  if (!text) return null;

  const [editingWord, setEditingWord] = useState<EditingWordState | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const [feedbackBadge, setFeedbackBadge] = useState<FeedbackBadgeState | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchMovedRef = useRef<boolean>(false);

  const brush = useBrush();
  const highlightMode = useHighlightMode();

  const tokens = text.split(/(\s+)/);
  let nonWhitespaceCounter = 0;

  // Clear feedback badge timer on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    };
  }, []);

  // Apply brush styles instantly
  const applyBrushToWord = (key: string) => {
    if (brush.isEraser) {
      onHighlight(key, '');
    } else {
      onHighlight(key, JSON.stringify({
        c: brush.color,
        fs: brush.fontSize,
        b: brush.bold,
        u: brush.underline,
        uc: brush.uppercase,
        it: brush.italic
      }));
    }
  };

  // Open the advanced formatting modal
  const openAdvancedMenu = (target: HTMLElement, key: string, token: string) => {
    const rawValue = highlights?.[key] || '';
    let parsed = { c: '', fs: 100, b: false, u: false, uc: false, it: false };
    
    if (rawValue.startsWith('{')) {
      try {
        parsed = { ...parsed, ...JSON.parse(rawValue) };
      } catch (e) {}
    } else if (rawValue) {
      parsed.c = rawValue;
    }

    const rect = target.getBoundingClientRect();
    const leftPos = rect.left + rect.width / 2 - 140; // 140 is half of 280px
    const clampedLeft = Math.max(12, Math.min(window.innerWidth - 292, leftPos));

    setEditingWord({
      key,
      originalWord: token,
      color: parsed.c,
      fontSize: parsed.fs || 100,
      bold: !!parsed.b,
      underline: !!parsed.u,
      uppercase: !!parsed.uc,
      italic: !!parsed.it
    });

    setPopoverStyle({
      position: 'fixed',
      top: `${Math.min(window.innerHeight - 380, rect.bottom + 8)}px`,
      left: `${clampedLeft}px`,
      zIndex: 9999,
    });
  };

  // Cycle color immediately on word click
  const cycleColorOnWord = (target: HTMLElement, key: string) => {
    const rawValue = highlights?.[key] || '';
    let parsed = { c: '', fs: 100, b: false, u: false, uc: false, it: false };
    let hasOtherStyles = false;

    if (rawValue.startsWith('{')) {
      try {
        parsed = { ...parsed, ...JSON.parse(rawValue) };
        hasOtherStyles = (parsed.fs && parsed.fs !== 100) || parsed.b || parsed.u || parsed.uc || parsed.it;
      } catch (e) {}
    } else if (rawValue) {
      parsed.c = rawValue;
    }

    const currentColor = parsed.c || '';
    const nextDef = getNextColor(currentColor);

    // Save highlight value
    if (nextDef.id === '') {
      // Zerar
      if (hasOtherStyles) {
        onHighlight(key, JSON.stringify({ ...parsed, c: '' }));
      } else {
        onHighlight(key, '');
      }
    } else {
      // Set new color
      if (hasOtherStyles) {
        onHighlight(key, JSON.stringify({ ...parsed, c: nextDef.id }));
      } else {
        onHighlight(key, nextDef.id);
      }
    }

    // Show floating micro feedback badge
    const rect = target.getBoundingClientRect();
    setFeedbackBadge({
      key,
      name: nextDef.name,
      icon: nextDef.icon,
      hex: nextDef.hex,
      x: rect.left + rect.width / 2,
      y: rect.top - 6
    });

    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedbackBadge(null);
    }, 700);

    // Subtle haptic feedback on supported mobile devices
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(10); } catch (_) {}
    }
  };

  const handleWordClick = (e: React.MouseEvent<HTMLSpanElement>, key: string, token: string) => {
    e.stopPropagation();
    
    // If the Quick Brush is active, paint with brush
    if (brush.isActive) {
      applyBrushToWord(key);
      return;
    }

    // Fast Color Cycling mode (Default, highly practical)
    if (highlightMode.isCycle) {
      cycleColorOnWord(e.currentTarget, key);
    } else {
      // Menu mode: open full styling dialog
      openAdvancedMenu(e.currentTarget, key, token);
    }
  };

  const handleWordDoubleClick = (e: React.MouseEvent<HTMLSpanElement>, key: string, token: string) => {
    e.stopPropagation();
    // Double click ALWAYS opens the advanced styling editor
    openAdvancedMenu(e.currentTarget, key, token);
  };

  const handleWordContextMenu = (e: React.MouseEvent<HTMLSpanElement>, key: string, token: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Right click opens the advanced editor
    openAdvancedMenu(e.currentTarget, key, token);
  };

  // Mobile / tablet touch handling for long press
  const handleTouchStart = (e: React.TouchEvent<HTMLSpanElement>, key: string, token: string) => {
    touchMovedRef.current = false;
    const target = e.currentTarget;
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    
    // Long press 450ms opens advanced editor on touch screens
    touchTimerRef.current = setTimeout(() => {
      if (!touchMovedRef.current) {
        openAdvancedMenu(target, key, token);
      }
    }, 450);
  };

  const handleTouchMove = () => {
    touchMovedRef.current = true;
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  // Drag over words: if brush is active and mouse is down, paint instantly!
  const handleWordMouseEnter = (e: React.MouseEvent<HTMLSpanElement>, key: string) => {
    if (brush.isActive && e.buttons === 1) {
      applyBrushToWord(key);
    }
  };

  const handleSave = (currentObj: EditingWordState | null = editingWord) => {
    if (!currentObj) return;
    
    const { key, color, fontSize, bold, underline, uppercase, italic } = currentObj;
    const isDefault = !color && fontSize === 100 && !bold && !underline && !uppercase && !italic;
    
    if (isDefault) {
      onHighlight(key, '');
    } else {
      onHighlight(key, JSON.stringify({
        c: color,
        fs: fontSize,
        b: bold,
        u: underline,
        uc: uppercase,
        it: italic
      }));
    }
    setEditingWord(null);
  };

  const updateColor = (c: string) => {
    setEditingWord(prev => {
      if (!prev) return null;
      return { ...prev, color: c };
    });
  };

  const changeFontSize = (delta: number) => {
    setEditingWord(prev => {
      if (!prev) return null;
      return { ...prev, fontSize: Math.max(100, Math.min(300, prev.fontSize + delta)) };
    });
  };

  const setFontSizePreset = (size: number) => {
    setEditingWord(prev => prev ? { ...prev, fontSize: size } : null);
  };

  const toggleStyle = (styleKey: 'bold' | 'underline' | 'uppercase' | 'italic') => {
    setEditingWord(prev => prev ? { ...prev, [styleKey]: !prev[styleKey] } : null);
  };

  const resetToDefault = () => {
    if (editingWord) {
      onHighlight(editingWord.key, '');
      setEditingWord(null);
    }
  };

  return (
    <>
      {tokens.map((token, i) => {
        const isWhitespace = /^\s+$/.test(token);
        
        if (isWhitespace) {
          return <span key={i}>{token}</span>;
        }

        const currentWordIndex = nonWhitespaceCounter++;
        const key = `${sectionKey}_${currentWordIndex}`;
        
        const rawValue = highlights?.[key] || '';
        let parsed = { c: '', fs: 100, b: false, u: false, uc: false, it: false };
        if (rawValue.startsWith('{')) {
          try {
            parsed = { ...parsed, ...JSON.parse(rawValue) };
          } catch (e) {}
        } else if (rawValue) {
          parsed.c = rawValue;
        }

        const customStyle: React.CSSProperties = {};
        if (parsed.fs && parsed.fs > 100) {
          customStyle.fontSize = `${parsed.fs}%`;
        }

        return (
          <span 
            key={i} 
            translate="no"
            style={customStyle}
            className={cn(
              "palavra-clicavel inline transition-all duration-150 select-none", 
              parsed.c,
              parsed.b && "font-black drop-shadow-[0_0_8px_rgba(0,245,255,0.4)]",
              parsed.u && "underline decoration-neon-cyan/50 decoration-2 underline-offset-4",
              parsed.uc && "uppercase",
              parsed.it && "italic",
              parsed.fs && parsed.fs > 100 && "inline-block align-middle animate-pulse-slow",
              brush.isActive 
                ? (brush.isEraser 
                    ? "hover:bg-red-500/20 hover:scale-105 cursor-pointer border border-dashed border-red-500/20" 
                    : "hover:bg-neon-cyan/20 hover:scale-[1.08] cursor-crosshair border border-dashed border-neon-cyan/20") 
                : "cursor-pointer hover:opacity-90 active:scale-95"
            )}
            onClick={(e) => handleWordClick(e, key, token)}
            onDoubleClick={(e) => handleWordDoubleClick(e, key, token)}
            onContextMenu={(e) => handleWordContextMenu(e, key, token)}
            onTouchStart={(e) => handleTouchStart(e, key, token)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseEnter={(e) => handleWordMouseEnter(e, key)}
            title={
              brush.isActive
                ? (brush.isEraser ? "Apagar estilo" : "Pincelar com caneta")
                : highlightMode.isCycle
                  ? "Toque para mudar de cor (Amarelo ➔ Ciano ➔ Rosa ➔ Verde ➔ Carmim ➔ Zerar). 2 cliques: opções avançadas"
                  : "Clique para abrir opções de formatação"
            }
          >
            {token}
          </span>
        );
      })}

      {/* Floating Micro Feedback Badge when cycling color */}
      <AnimatePresence>
        {feedbackBadge && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.8 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'fixed',
              top: `${feedbackBadge.y}px`,
              left: `${feedbackBadge.x}px`,
              transform: 'translate(-50%, -100%)',
              zIndex: 10000,
              pointerEvents: 'none'
            }}
            className="px-2.5 py-1 rounded-full text-[10px] font-orbitron font-black tracking-wider bg-black/90 border border-neon-cyan/40 shadow-[0_0_20px_rgba(0,245,255,0.4)] text-white flex items-center gap-1.5 backdrop-blur-md select-none whitespace-nowrap"
          >
            <span className="text-xs">{feedbackBadge.icon}</span>
            <span className="text-neon-cyan">{feedbackBadge.name}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop invisível para detecção de clique fora */}
      {editingWord && (
        <div 
          className="fixed inset-0 z-[9998] cursor-default bg-transparent" 
          onClick={() => handleSave()} 
        />
      )}

      {/* Menu flutuante inteligente de customização - Arrastável */}
      <AnimatePresence>
        {editingWord && (
          <motion.div
            drag
            dragMomentum={false}
            dragElastic={0.05}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            style={popoverStyle}
            className="w-[290px] bg-card-bg/95 backdrop-blur-xl border border-neon-cyan/40 rounded-xl p-4 shadow-[0_0_40px_rgba(0,245,255,0.35)] flex flex-col gap-3 text-neon-cyan font-mono cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header com estilo arrastável */}
            <div className="flex justify-between items-center border-b border-neon-cyan/20 pb-2 cursor-grab active:cursor-grabbing select-none" title="Segure e arraste para mover esta janela">
              <span className="text-[10px] font-bold tracking-widest text-[#00f5ff] font-orbitron truncate max-w-[210px]" title={editingWord.originalWord}>
                ✥ FORMATAR: "{editingWord.originalWord}"
              </span>
              <button 
                type="button"
                onClick={() => handleSave()}
                className="p-1 hover:bg-neon-cyan/15 rounded text-neon-cyan transition-colors cursor-pointer"
                title="Fechar e salvar"
              >
                <X size={15} />
              </button>
            </div>

            {/* Quick Helper Banner */}
            <div className="bg-neon-cyan/5 border border-neon-cyan/20 rounded p-1.5 flex items-center justify-between text-[9px] text-text-dim">
              <span className="flex items-center gap-1 text-neon-cyan font-bold">
                <Sparkles size={11} className="text-[#ffee00]" />
                Modo 1-Clique:
              </span>
              <button
                type="button"
                onClick={() => highlightMode.toggleMode()}
                className={cn(
                  "px-1.5 py-0.5 rounded font-orbitron font-bold transition-all cursor-pointer text-[8px]",
                  highlightMode.isCycle
                    ? "bg-[#ffee00]/20 text-[#ffee00] border border-[#ffee00]/50"
                    : "bg-white/10 text-white/70 border border-white/20"
                )}
                title="Alternar entre modo ciclar cores ou abrir este menu a cada clique"
              >
                {highlightMode.isCycle ? '⚡ CICLAR CORES' : '🛠️ ABRIR MENU'}
              </button>
            </div>

            {/* Tamanho da Fonte */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] text-text-dim">
                <span>TAMANHO DA FONTE:</span>
                <span className="text-neon-cyan font-bold font-orbitron">{editingWord.fontSize}%</span>
              </div>
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={() => changeFontSize(-10)}
                  className="flex-1 py-1.5 bg-neon-cyan/5 border border-neon-cyan/30 rounded text-center hover:bg-neon-cyan/15 transition-colors flex justify-center items-center cursor-pointer"
                  title="Diminuir"
                >
                  <Minus size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => changeFontSize(10)}
                  className="flex-1 py-1.5 bg-neon-cyan/5 border border-neon-cyan/30 rounded text-center hover:bg-neon-cyan/15 transition-colors flex justify-center items-center cursor-pointer"
                  title="Aumentar"
                >
                  <Plus size={12} />
                </button>
              </div>
              <div className="flex gap-1 justify-between text-[9px]">
                {[100, 130, 160, 200, 250].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setFontSizePreset(size)}
                    className={cn(
                      "px-1 py-0.5 rounded transition-all cursor-pointer",
                      editingWord.fontSize === size 
                        ? "bg-neon-cyan text-dark-bg font-bold font-orbitron" 
                        : "bg-transparent text-text-dim hover:text-neon-cyan"
                    )}
                  >
                    {size === 100 ? 'Normal' : `+${size - 100}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Cor do Marcador */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-text-dim block border-b border-neon-cyan/10 pb-0.5">COR DO MARCADOR:</span>
              <div className="flex gap-1.5 justify-between">
                {[
                  { cls: '', name: 'Sem marca (Zerar)', bg: 'bg-dark-bg border border-neon-cyan/30 relative overflow-hidden' },
                  { cls: 'highlight-yellow', name: 'Amarelo Ouro', bg: 'bg-[#ffee00]' },
                  { cls: 'highlight-cyan', name: 'Ciano Neon', bg: 'bg-[#00f5ff]' },
                  { cls: 'highlight-pink', name: 'Branco / Rosa', bg: 'bg-white shadow-[0_0_10px_#fff]' },
                  { cls: 'highlight-green-fluo', name: 'Verde Flúor', bg: 'bg-[#39ff14]' },
                  { cls: 'highlight-crimson', name: 'Carmim Real', bg: 'bg-[#dc143c]' },
                ].map((colorObj) => (
                  <button
                    key={colorObj.cls}
                    type="button"
                    onClick={() => updateColor(colorObj.cls)}
                    className={cn(
                      "w-7 h-7 rounded-md cursor-pointer flex items-center justify-center transition-all duration-200 active:scale-90",
                      colorObj.bg,
                      editingWord.color === colorObj.cls ? "ring-2 ring-neon-cyan scale-110 shadow-[0_0_10px_rgba(0,245,255,0.6)]" : "hover:scale-105"
                    )}
                    title={colorObj.name}
                  >
                    {editingWord.color === colorObj.cls && (
                      <Check size={14} className={colorObj.cls === 'highlight-pink' || colorObj.cls === '' ? "text-dark-bg/80 font-bold" : "text-dark-bg font-bold"} />
                    )}
                    {colorObj.cls === '' && editingWord.color !== '' && (
                      <div className="w-full h-0.5 bg-red-500 absolute rotate-45" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Estilos Extra */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-text-dim block border-b border-neon-cyan/10 pb-0.5">ESTILOS EXTRAS:</span>
              <div className="flex gap-1.5">
                {[
                  { key: 'bold', label: 'NEGRITO', icon: <Bold size={11} />, desc: 'Negrito' },
                  { key: 'underline', label: 'SUBLIN', icon: <Underline size={11} />, desc: 'Sublinhado' },
                  { key: 'italic', label: 'ITALIC', icon: <span className="italic font-serif font-bold text-xs leading-none">I</span>, desc: 'Itálico' },
                  { key: 'uppercase', label: 'ALTAS', icon: <span className="text-[9px] font-bold leading-none">AA</span>, desc: 'Caixa Alta' },
                ].map((styleObj) => {
                  const isActive = editingWord[styleObj.key as 'bold' | 'underline' | 'uppercase' | 'italic'];
                  return (
                    <button
                      key={styleObj.key}
                      type="button"
                      onClick={() => toggleStyle(styleObj.key as any)}
                      className={cn(
                        "flex-1 py-1 px-0.5 text-[8px] rounded border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer",
                        isActive 
                          ? "bg-neon-cyan/25 border-neon-cyan text-neon-cyan font-bold shadow-[0_0_8px_rgba(0,245,255,0.2)]" 
                          : "bg-transparent border-neon-cyan/15 text-text-dim hover:border-neon-cyan/35 hover:text-neon-cyan"
                      )}
                      title={styleObj.desc}
                    >
                      {styleObj.icon}
                      <span>{styleObj.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-2 pt-2 border-t border-neon-cyan/25">
              <button
                type="button"
                onClick={() => resetToDefault()}
                className="flex-1 py-1.5 px-2 text-[9px] bg-red-950/40 border border-red-500/35 text-red-400 rounded hover:bg-red-950/60 hover:border-red-500/50 transition-all font-bold flex justify-center items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>ZERAR COR</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave()}
                className="flex-1 py-1.5 px-2 text-[9px] bg-neon-cyan/20 border border-neon-cyan text-neon-cyan rounded hover:bg-neon-cyan/35 transition-all font-bold flex justify-center items-center gap-1 cursor-pointer"
              >
                <Check size={11} />
                <span>CONCLUIR</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
