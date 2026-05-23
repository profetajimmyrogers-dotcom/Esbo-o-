import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bold, Underline, Check, Plus, Minus, RotateCcw } from 'lucide-react';
import { useBrush } from '../lib/brushStore';

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

export const HighlightableText = ({ 
  text, 
  sectionKey, 
  highlights, 
  onHighlight 
}: HighlightableTextProps) => {
  if (!text) return null;

  const [editingWord, setEditingWord] = useState<EditingWordState | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const brush = useBrush();

  const tokens = text.split(/(\s+)/);
  let nonWhitespaceCounter = 0;

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

  const handleWordClick = (e: React.MouseEvent<HTMLSpanElement>, key: string, token: string) => {
    e.stopPropagation();
    
    // If the Quick Brush is active, we paint instantly instead of showing the popover menu!
    if (brush.isActive) {
      applyBrushToWord(key);
      return;
    }
    
    const rawValue = highlights?.[key] || '';
    let parsed = { c: '', fs: 100, b: false, u: false, uc: false, it: false };
    
    if (rawValue.startsWith('{')) {
      try {
        parsed = { ...parsed, ...JSON.parse(rawValue) };
      } catch (e) {
        // Ignore error
      }
    } else if (rawValue) {
      parsed.c = rawValue;
    }

    const rect = e.currentTarget.getBoundingClientRect();
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
      top: `${rect.bottom + 8}px`,
      left: `${clampedLeft}px`,
      zIndex: 9999,
    });
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
              "palavra-clicavel inline transition-all duration-200 select-none", 
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
                : "cursor-pointer"
            )}
            onClick={(e) => handleWordClick(e, key, token)}
            onMouseEnter={(e) => handleWordMouseEnter(e, key)}
          >
            {token}
          </span>
        );
      })}

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
            className="w-[280px] bg-card-bg border border-neon-cyan/40 rounded-xl p-4 shadow-[0_0_40px_rgba(0,245,255,0.35)] flex flex-col gap-3 text-neon-cyan font-mono cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header com estilo arrastável */}
            <div className="flex justify-between items-center border-b border-neon-cyan/20 pb-2 cursor-grab active:cursor-grabbing select-none" title="Segure e arraste para mover esta janela">
              <span className="text-[10px] font-bold tracking-widest text-[#00f5ff] font-orbitron truncate max-w-[200px]" title={editingWord.originalWord}>
                ✥ REPOSICIONAR: "{editingWord.originalWord}"
              </span>
              <button 
                type="button"
                onClick={() => handleSave()}
                className="p-1 hover:bg-neon-cyan/10 rounded text-neon-cyan transition-colors cursor-pointer"
              >
                <X size={14} />
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
                  { cls: '', name: 'Sem marca', bg: 'bg-dark-bg border border-neon-cyan/30 relative overflow-hidden' },
                  { cls: 'highlight-yellow', name: 'Amarelo', bg: 'bg-[#ffee00]' },
                  { cls: 'highlight-cyan', name: 'Ciano', bg: 'bg-[#00f5ff]' },
                  { cls: 'highlight-pink', name: 'Branco/Rosa', bg: 'bg-white shadow-[0_0_10px_#fff]' },
                  { cls: 'highlight-green-fluo', name: 'Verde', bg: 'bg-[#39ff14]' },
                  { cls: 'highlight-crimson', name: 'Carmim', bg: 'bg-[#dc143c]' },
                ].map((colorObj) => (
                  <button
                    key={colorObj.cls}
                    type="button"
                    onClick={() => updateColor(colorObj.cls)}
                    className={cn(
                      "w-7 h-7 rounded-md cursor-pointer flex items-center justify-center transition-all duration-200 active:scale-90",
                      colorObj.bg,
                      editingWord.color === colorObj.cls ? "ring-2 ring-neon-cyan scale-110" : "hover:scale-105"
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
                className="flex-1 py-1 px-1.5 text-[9px] bg-red-950/40 border border-red-500/35 text-red-400 rounded hover:bg-red-950/60 hover:border-red-500/50 transition-all font-bold flex justify-center items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={10} />
                <span>REMOVER TUDO</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave()}
                className="flex-1 py-1 px-1.5 text-[9px] bg-neon-cyan/20 border border-neon-cyan text-neon-cyan rounded hover:bg-neon-cyan/35 transition-all font-bold flex justify-center items-center gap-1 cursor-pointer"
              >
                <Check size={10} />
                <span>SALVAR</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
