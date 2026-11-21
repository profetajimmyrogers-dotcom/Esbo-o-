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

interface WordFormatting {
  c: string;
  fs: number;
  b: boolean;
  u: boolean;
  uc: boolean;
  it: boolean;
  note?: string;
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
  note?: string;
}

interface ActiveNoteState {
  key: string;
  word: string;
  note: string;
  placement: 'top' | 'bottom';
  style: React.CSSProperties;
  arrowLeft: number;
}

interface NoteEditorState {
  key: string;
  word: string;
  initialNote: string;
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
  
  // Balão com informações (Speech Balloon)
  const [activeNote, setActiveNote] = useState<ActiveNoteState | null>(null);
  
  // Modal de edição da Nota do Pregador
  const [noteEditor, setNoteEditor] = useState<NoteEditorState | null>(null);
  const [noteInputText, setNoteInputText] = useState<string>('');

  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchMovedRef = useRef<boolean>(false);

  const brush = useBrush();
  const highlightMode = useHighlightMode();

  const tokens = text.split(/(\s+)/);
  let nonWhitespaceCounter = 0;

  // Cleanup touch timer on unmount
  useEffect(() => {
    return () => {
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    };
  }, []);

  // Helper para decodificar formato da palavra
  const parseHighlightValue = (rawValue?: string): WordFormatting => {
    const def: WordFormatting = { c: '', fs: 100, b: false, u: false, uc: false, it: false, note: '' };
    if (!rawValue) return def;
    if (rawValue.startsWith('{')) {
      try {
        return { ...def, ...JSON.parse(rawValue) };
      } catch (e) {
        return def;
      }
    }
    return { ...def, c: rawValue };
  };

  // Apply brush styles instantly, preservando nota existente
  const applyBrushToWord = (key: string) => {
    const rawValue = highlights?.[key] || '';
    const parsed = parseHighlightValue(rawValue);
    const existingNote = parsed.note ? parsed.note.trim() : '';

    if (brush.isEraser) {
      if (existingNote) {
        // Se tinha nota, mantém a nota e limpa apenas estilos/cor
        onHighlight(key, JSON.stringify({ note: existingNote }));
      } else {
        onHighlight(key, '');
      }
    } else {
      onHighlight(key, JSON.stringify({
        c: brush.color,
        fs: brush.fontSize,
        b: brush.bold,
        u: brush.underline,
        uc: brush.uppercase,
        it: brush.italic,
        ...(existingNote ? { note: existingNote } : {})
      }));
    }
  };

  // Open the advanced formatting modal
  const openAdvancedMenu = (target: HTMLElement, key: string, token: string) => {
    const rawValue = highlights?.[key] || '';
    const parsed = parseHighlightValue(rawValue);

    const rect = target.getBoundingClientRect();
    const leftPos = rect.left + rect.width / 2 - 145;
    const clampedLeft = Math.max(12, Math.min(window.innerWidth - 302, leftPos));

    setEditingWord({
      key,
      originalWord: token,
      color: parsed.c,
      fontSize: parsed.fs || 100,
      bold: !!parsed.b,
      underline: !!parsed.u,
      uppercase: !!parsed.uc,
      italic: !!parsed.it,
      note: parsed.note || ''
    });

    setPopoverStyle({
      position: 'fixed',
      top: `${Math.min(window.innerHeight - 440, Math.max(12, rect.bottom + 8))}px`,
      left: `${clampedLeft}px`,
      zIndex: 9999,
    });
  };

  // Abre o balão flutuante apontando para a palavra
  const openNoteBalloon = (target: HTMLElement, key: string, word: string, noteContent: string) => {
    const rect = target.getBoundingClientRect();
    const balloonWidth = Math.min(330, window.innerWidth - 24);
    const leftPos = rect.left + rect.width / 2 - balloonWidth / 2;
    const clampedLeft = Math.max(12, Math.min(window.innerWidth - balloonWidth - 12, leftPos));
    const arrowOffset = Math.max(20, Math.min(balloonWidth - 20, rect.left + rect.width / 2 - clampedLeft));

    // Determina se o balão abre em cima ou embaixo da palavra
    const placeOnBottom = rect.top < 190;
    const topPos = placeOnBottom ? rect.bottom + 12 : Math.max(12, rect.top - 12);

    setActiveNote({
      key,
      word,
      note: noteContent,
      placement: placeOnBottom ? 'bottom' : 'top',
      style: {
        position: 'fixed',
        left: `${clampedLeft}px`,
        ...(placeOnBottom ? { top: `${topPos}px` } : { bottom: `${window.innerHeight - rect.top + 10}px` }),
        width: `${balloonWidth}px`,
        zIndex: 10000,
      },
      arrowLeft: arrowOffset
    });

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(15); } catch (_) {}
    }
  };

  // Salva a nota da palavra mantendo estilos existentes
  const handleSaveNote = (key: string, newNoteText: string) => {
    const rawValue = highlights?.[key] || '';
    const parsed = parseHighlightValue(rawValue);
    const cleanNote = newNoteText.trim();
    const hasOtherStyles = (parsed.fs && parsed.fs !== 100) || parsed.b || parsed.u || parsed.uc || parsed.it;

    if (!cleanNote && !parsed.c && !hasOtherStyles) {
      onHighlight(key, '');
    } else if (!cleanNote && !hasOtherStyles && parsed.c) {
      onHighlight(key, parsed.c);
    } else {
      onHighlight(key, JSON.stringify({
        c: parsed.c || '',
        fs: parsed.fs || 100,
        b: !!parsed.b,
        u: !!parsed.u,
        uc: !!parsed.uc,
        it: !!parsed.it,
        ...(cleanNote ? { note: cleanNote } : {})
      }));
    }

    setNoteEditor(null);
    setActiveNote(null);
  };

  const handleDeleteNote = (key: string) => {
    handleSaveNote(key, '');
  };

  // Cycle color immediately on word click, preservando nota existente
  const cycleColorOnWord = (key: string) => {
    const rawValue = highlights?.[key] || '';
    const parsed = parseHighlightValue(rawValue);
    const existingNote = parsed.note ? parsed.note.trim() : '';
    const hasOtherStyles = (parsed.fs && parsed.fs !== 100) || parsed.b || parsed.u || parsed.uc || parsed.it || existingNote.length > 0;

    const currentColor = parsed.c || '';
    const nextDef = getNextColor(currentColor);

    // Save highlight value
    if (nextDef.id === '') {
      // Zerar cor
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

    const rawValue = highlights?.[key] || '';
    const parsed = parseHighlightValue(rawValue);
    const wordNote = parsed.note ? parsed.note.trim() : '';

    // Se a palavra tem nota oculta anexada, clique abre/fecha o balão com informações!
    if (wordNote.length > 0) {
      if (activeNote && activeNote.key === key) {
        setActiveNote(null);
      } else {
        openNoteBalloon(e.currentTarget, key, token, wordNote);
      }
      return;
    }

    // Fast Color Cycling mode (Default)
    if (highlightMode.isCycle) {
      cycleColorOnWord(key);
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
    
    const { key, color, fontSize, bold, underline, uppercase, italic, note } = currentObj;
    const cleanNote = (note || '').trim();
    const hasStyles = (fontSize && fontSize !== 100) || bold || underline || uppercase || italic || cleanNote.length > 0;
    
    if (!color && !hasStyles) {
      onHighlight(key, '');
    } else if (!hasStyles && color) {
      onHighlight(key, color);
    } else {
      onHighlight(key, JSON.stringify({
        c: color || '',
        fs: fontSize || 100,
        b: bold,
        u: underline,
        uc: uppercase,
        it: italic,
        ...(cleanNote ? { note: cleanNote } : {})
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
      // Se houver nota anexada, preserva a nota ao zerar as cores e estilos
      if (editingWord.note && editingWord.note.trim().length > 0) {
        onHighlight(editingWord.key, JSON.stringify({
          c: '',
          fs: 100,
          b: false,
          u: false,
          uc: false,
          it: false,
          note: editingWord.note.trim()
        }));
      } else {
        onHighlight(editingWord.key, '');
      }
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
        const parsed = parseHighlightValue(rawValue);
        const hasNote = !!(parsed.note && parsed.note.trim().length > 0);
        const isBalloonActive = activeNote?.key === key;

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
              hasNote && "border border-[#CF9D7B]/70 bg-[#CF9D7B]/20 text-[#F3D8B8] shadow-[0_0_12px_rgba(207,157,123,0.3)] rounded px-1.5 py-0.5 inline-flex items-center gap-1 my-0.5 font-medium backdrop-blur-xs",
              isBalloonActive && "ring-2 ring-[#CF9D7B] shadow-[0_0_20px_rgba(207,157,123,0.65)] bg-[#CF9D7B]/35 text-white",
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
              hasNote
                ? `Nota do Pregador: "${parsed.note?.slice(0, 30)}..." (Toque para abrir balão)`
                : brush.isActive
                  ? (brush.isEraser ? "Apagar estilo" : "Pincelar com caneta")
                  : highlightMode.isCycle
                    ? "Toque para mudar de cor (Amarelo ➔ Ciano ➔ Rosa ➔ Verde ➔ Carmim ➔ Zerar). 2 cliques ou segurar: opções avançadas"
                    : "Clique para abrir opções de formatação"
            }
          >
            <span>{token}</span>
            {hasNote && (
              <span 
                className="text-[11px] text-[#CF9D7B] font-bold select-none opacity-95 inline-block align-baseline ml-0.5 drop-shadow-[0_0_5px_rgba(207,157,123,0.9)]"
                title="Nota do Pregador anexada (toque para abrir o balão)"
              >
                💬
              </span>
            )}
          </span>
        );
      })}

      {/* Backdrop invisível para detecção de clique fora do menu avançado */}
      {editingWord && (
        <div 
          className="fixed inset-0 z-[9998] cursor-default bg-transparent" 
          onClick={() => handleSave()} 
        />
      )}

      {/* BALÃO COM INFORMAÇÕES: NOTA DO PREGADOR (Revelando ao tocar na palavra) */}
      <AnimatePresence>
        {activeNote && (
          <>
            {/* Backdrop invisível para fechar o balão ao clicar fora */}
            <div 
              className="fixed inset-0 z-[9999] cursor-default bg-transparent"
              onClick={() => setActiveNote(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: activeNote.placement === 'top' ? 6 : -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: activeNote.placement === 'top' ? 4 : -4 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={activeNote.style}
              className="bg-[#162127]/98 backdrop-blur-2xl border border-[rgba(207,157,123,0.4)] rounded-2xl p-4 shadow-[0_18px_48px_rgba(3,8,10,0.85),0_0_24px_rgba(207,157,123,0.18)] flex flex-col gap-2.5 text-[#E8E8E8] font-sans cursor-default select-text relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Caret / Pointer Arrow apontando para a palavra com fundo #162127 e borda caramelo */}
              <div 
                className={cn(
                  "absolute w-3.5 h-3.5 pointer-events-none z-10",
                  activeNote.placement === 'top' 
                    ? "-bottom-[7px] border-r border-b border-[rgba(207,157,123,0.4)] bg-[#162127]" 
                    : "-top-[7px] border-l border-t border-[rgba(207,157,123,0.4)] bg-[#162127]"
                )}
                style={{ 
                  left: `${activeNote.arrowLeft}px`, 
                  transform: 'translateX(-50%) rotate(45deg)' 
                }}
              />

              {/* Header do Balão com tema Teal-Noite + Caramelo Nobre */}
              <div className="flex justify-between items-center pb-2 border-b border-[rgba(207,157,123,0.2)] select-none">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#CF9D7B]">💬</span>
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-widest text-[#CF9D7B] uppercase">
                    NOTA DO PREGADOR
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const curKey = activeNote.key;
                      const curWord = activeNote.word;
                      const curNote = activeNote.note;
                      setActiveNote(null);
                      setNoteInputText(curNote);
                      setNoteEditor({
                        key: curKey,
                        word: curWord,
                        initialNote: curNote
                      });
                    }}
                    className="px-2.5 py-0.5 text-[10px] text-[#F3D8B8] hover:text-white bg-[#0C1519] hover:bg-[#1C2A31] border border-[rgba(207,157,123,0.35)] hover:border-[#CF9D7B] rounded-lg transition-colors flex items-center gap-1 cursor-pointer font-mono shadow-sm"
                    title="Editar ou excluir esta anotação"
                  >
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveNote(null)}
                    className="p-1 text-[#CF9D7B]/70 hover:text-[#F3D8B8] rounded-md hover:bg-[#0C1519] transition-colors cursor-pointer"
                    title="Fechar nota"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Corpo da Nota em Marfim / Creme Alta-Legibilidade */}
              <div className="text-sm sm:text-[15px] text-[#E8E8E8] font-sans leading-relaxed whitespace-pre-wrap break-words max-h-[280px] overflow-y-auto pr-1 select-text selection:bg-[#CF9D7B]/30 selection:text-white">
                {activeNote.note}
              </div>

              {/* Rodapé sutil com a palavra de referência */}
              <div className="pt-1 flex items-center justify-between text-[10px] text-[#8A8A8A] font-mono border-t border-[rgba(207,157,123,0.15)] select-none">
                <span className="truncate max-w-[190px]">Palavra: "{activeNote.word}"</span>
                <span className="text-[#CF9D7B]/90">✦ Toque fora para fechar</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL DEDICADO: NOTA DO PREGADOR (Criar / Editar / Excluir) */}
      <AnimatePresence>
        {noteEditor && (
          <div 
            className="fixed inset-0 z-[10002] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-default"
            onClick={() => setNoteEditor(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-lg bg-[#162127]/98 backdrop-blur-2xl border border-[rgba(207,157,123,0.35)] rounded-2xl p-5 shadow-[0_25px_60px_rgba(3,8,10,0.85),0_0_35px_rgba(207,157,123,0.2)] flex flex-col gap-3.5 font-sans relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-2.5 border-b border-[rgba(207,157,123,0.2)] select-none">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#CF9D7B]">💬</span>
                  <span className="text-xs font-mono font-bold tracking-widest text-[#CF9D7B] uppercase">
                    NOTA DO PREGADOR
                  </span>
                  <span className="text-[11px] text-[#8A8A8A] font-mono truncate max-w-[170px]">
                    · "{noteEditor.word}"
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setNoteEditor(null)}
                  className="p-1 text-[#8A8A8A] hover:text-[#F3D8B8] rounded-lg hover:bg-[#0C1519] transition-colors cursor-pointer"
                  title="Fechar sem salvar"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Textarea */}
              <div className="space-y-1">
                <textarea
                  value={noteInputText}
                  onChange={(e) => setNoteInputText(e.target.value)}
                  placeholder="Ex.: João 3:16 · Curiosidade sobre o contexto, referência cruzada..."
                  rows={4}
                  autoFocus
                  className="w-full bg-[#0C1519] border border-[rgba(207,157,123,0.3)] focus:border-[#CF9D7B] focus:ring-1 focus:ring-[#CF9D7B]/50 rounded-xl p-3.5 text-sm sm:text-base text-[#E8E8E8] placeholder:text-[#8A8A8A] outline-none leading-relaxed resize-none shadow-inner transition-all font-sans"
                />

                {/* Quick Tags / Sugestões rápidas */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-[#8A8A8A] font-mono">Atalhos:</span>
                  {[
                    { label: '📖 Versículo', insert: '📖 Versículo: ' },
                    { label: '💡 Ilustração', insert: '💡 Ilustração: ' },
                    { label: '💬 Exemplo', insert: '💬 Exemplo: ' },
                    { label: '⏱ Pausa', insert: '⏱ [Pausa reflexiva] ' },
                  ].map((tag) => (
                    <button
                      key={tag.label}
                      type="button"
                      onClick={() => {
                        setNoteInputText(prev => prev ? `${prev}\n${tag.insert}` : tag.insert);
                      }}
                      className="px-2.5 py-1 text-[11px] bg-[#0C1519] hover:bg-[#1C2A31] border border-[rgba(207,157,123,0.25)] hover:border-[#CF9D7B]/60 text-[#F3D8B8] rounded-lg transition-colors cursor-pointer select-none font-mono"
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 select-none">
                <span className="text-[11px] text-[#8A8A8A] font-mono">
                  Toque na palavra no púlpito para abrir o balão 💬
                </span>

                <div className="flex items-center justify-end gap-2">
                  {noteEditor.initialNote && (
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(noteEditor.key)}
                      className="px-3.5 py-1.5 text-xs text-[#e08060] hover:text-white hover:bg-[#e08060]/20 border border-[#e08060]/40 rounded-lg transition-colors cursor-pointer font-medium"
                    >
                      Excluir
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSaveNote(noteEditor.key, noteInputText)}
                    className="px-6 py-2 text-xs font-bold text-[#0C1519] bg-gradient-to-r from-[#F3D8B8] via-[#CF9D7B] to-[#B07D55] hover:brightness-110 active:scale-95 rounded-full shadow-[0_4px_16px_rgba(207,157,123,0.35)] transition-all cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
            className="w-[295px] bg-card-bg/95 backdrop-blur-xl border border-neon-cyan/40 rounded-xl p-4 shadow-[0_0_40px_rgba(0,245,255,0.35)] flex flex-col gap-3 text-neon-cyan font-mono cursor-default"
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

            {/* NOVA FUNÇÃO: NOTA DO PREGADOR (Oculta) */}
            <div className="p-1">
              <button
                type="button"
                onClick={() => {
                  const targetKey = editingWord.key;
                  const targetWord = editingWord.originalWord;
                  const currentNote = editingWord.note || '';
                  setEditingWord(null);
                  setNoteInputText(currentNote);
                  setNoteEditor({
                    key: targetKey,
                    word: targetWord,
                    initialNote: currentNote,
                  });
                }}
                className={cn(
                  "w-full py-2.5 px-3 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer shadow-md",
                  editingWord.note 
                    ? "bg-[#1C2A31] border-[#CF9D7B] text-[#F3D8B8] shadow-[0_0_15px_rgba(207,157,123,0.25)]" 
                    : "bg-[#0C1519]/80 border-[rgba(207,157,123,0.35)] text-[#CF9D7B] hover:bg-[#1C2A31] hover:border-[#CF9D7B]"
                )}
                title="Esconder versículo ou anotação para abrir no modo púlpito"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base text-[#CF9D7B]">💬</span>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-[#CF9D7B] uppercase">
                      {editingWord.note ? 'EDITAR NOTA DO PREGADOR' : 'NOTA DO PREGADOR'}
                    </span>
                    <span className="text-[9px] text-[#E8E8E8] font-sans line-clamp-1 max-w-[160px]">
                      {editingWord.note ? `"${editingWord.note}"` : 'Esconder versículo ou anotação'}
                    </span>
                  </div>
                </div>
                {editingWord.note ? (
                  <span className="text-[9px] bg-[#CF9D7B]/20 text-[#F3D8B8] px-2 py-0.5 rounded-full border border-[#CF9D7B]/50 font-mono font-bold">
                    ATIVA
                  </span>
                ) : (
                  <span className="text-[9px] text-[#CF9D7B] font-mono font-bold">
                    + CRIAR
                  </span>
                )}
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
                  { cls: 'highlight-caramel', name: 'Caramelo Nobre', bg: 'bg-[#CF9D7B] shadow-[0_0_8px_rgba(207,157,123,0.5)]' },
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
