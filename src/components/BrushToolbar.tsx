import React from 'react';
import { useBrush } from '../lib/brushStore';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  Paintbrush, 
  Eraser, 
  Bold, 
  Underline, 
  Italic, 
  Check, 
  Plus, 
  Minus, 
  MousePointer, 
  Move,
  Info
} from 'lucide-react';

export const BrushToolbar = () => {
  const brush = useBrush();

  if (!brush.isActive) {
    return null;
  }

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.05}
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="fixed bottom-6 right-6 z-[3000] w-[340px] bg-black/95 border-2 border-neon-cyan rounded-xl p-4 shadow-[0_0_40px_rgba(0,245,255,0.5)] flex flex-col gap-3.5 text-neon-cyan font-mono"
    >
      {/* Draggable Header */}
      <div className="flex justify-between items-center border-b border-neon-cyan/30 pb-2 cursor-grab active:cursor-grabbing select-none" title="Arraste para mover o painel">
        <div className="flex items-center gap-2 text-xs font-bold font-orbitron tracking-widest text-[#00f5ff] drop-shadow-[0_0_5px_rgba(0,245,255,0.5)]">
          <Move size={14} className="text-neon-cyan/60 animate-bounce-slow" />
          <span>CANETA MARCA-TEXTO</span>
        </div>
        <button
          type="button"
          onClick={() => brush.setBrush({ isActive: false })}
          className="px-2 py-0.5 text-[10px] bg-red-950/20 border border-red-500/40 text-red-400 hover:bg-neutral-900 rounded font-orbitron tracking-wider transition-all select-none cursor-pointer"
        >
          DESATIVAR
        </button>
      </div>

      {/* Mode selectors */}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => brush.setBrush({ isEraser: false })}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg border transition-all select-none cursor-pointer",
            !brush.isEraser
              ? "bg-neon-cyan text-dark-bg border-neon-cyan shadow-[0_0_12px_rgba(0,245,255,0.3)] font-orbitron"
              : "bg-black/40 text-neon-cyan/60 border-neon-cyan/20 hover:border-neon-cyan/50"
          )}
        >
          <Paintbrush size={13} />
          <span>PINCELAR ESTILO</span>
        </button>
        <button
          type="button"
          onClick={() => brush.setBrush({ isEraser: true })}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg border transition-all select-none cursor-pointer",
            brush.isEraser
              ? "bg-neon-pink text-dark-bg border-neon-pink shadow-[0_0_12px_rgba(255,0,127,0.3)] font-orbitron"
              : "bg-black/40 text-neon-pink/60 border-neon-pink/20 hover:border-neon-pink/50"
          )}
        >
          <Eraser size={13} />
          <span>APAGAR/BORRACHA</span>
        </button>
      </div>

      {!brush.isEraser && (
        <>
          {/* Cor do Marcador */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-text-dim block tracking-wider">COR DO MARCADOR:</span>
            <div className="flex gap-1.5 justify-between">
              {[
                { cls: '', name: 'Sem marca', bg: 'bg-dark-bg border border-neon-cyan/30 relative overflow-hidden' },
                { cls: 'highlight-yellow', name: 'Amarelo', bg: 'bg-[#ffee00]' },
                { cls: 'highlight-cyan', name: 'Ciano', bg: 'bg-[#00f5ff]' },
                { cls: 'highlight-pink', name: 'Rosa/Branco', bg: 'bg-white shadow-[0_0_8px_#fff]' },
                { cls: 'highlight-green-fluo', name: 'Verde', bg: 'bg-[#39ff14]' },
                { cls: 'highlight-crimson', name: 'Carmim', bg: 'bg-[#dc143c]' },
              ].map((colorObj) => (
                <button
                  key={colorObj.cls}
                  type="button"
                  onClick={() => brush.setBrush({ color: colorObj.cls })}
                  className={cn(
                    "w-8 h-8 rounded-md cursor-pointer flex items-center justify-center transition-all duration-200 active:scale-95",
                    colorObj.bg,
                    brush.color === colorObj.cls ? "ring-2 ring-neon-cyan scale-110" : "hover:scale-105"
                  )}
                  title={colorObj.name}
                >
                  {brush.color === colorObj.cls && (
                    <Check size={16} className={colorObj.cls === 'highlight-pink' || colorObj.cls === '' ? "text-dark-bg/85 font-black" : "text-dark-bg font-black"} />
                  )}
                  {colorObj.cls === '' && brush.color !== '' && (
                    <div className="w-full h-0.5 bg-red-500 absolute rotate-45" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tamanho da Fonte */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] text-text-dim">
              <span className="tracking-wider">AUMENTAR FONTE EM:</span>
              <span className="text-neon-cyan font-bold font-orbitron">{brush.fontSize}%</span>
            </div>
            <div className="flex gap-1 justify-between text-[10px]">
              {[100, 130, 160, 200, 250, 300].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => brush.setBrush({ fontSize: size })}
                  className={cn(
                    "flex-1 py-1 rounded transition-all cursor-pointer font-bold border",
                    brush.fontSize === size 
                      ? "bg-neon-cyan text-dark-bg border-neon-cyan font-orbitron" 
                      : "bg-black/30 text-text-dim border-neon-cyan/15 hover:border-neon-cyan/40 hover:text-neon-cyan"
                  )}
                >
                  {size === 100 ? 'Normal' : `+${size - 100}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Estilos Extras */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-text-dim block tracking-wider">ESTILOS EXTRAS:</span>
            <div className="flex gap-2">
              {[
                { key: 'bold', label: 'NEGRITO', icon: <Bold size={11} />, desc: 'Negrito' },
                { key: 'underline', label: 'SUBLIN', icon: <Underline size={11} />, desc: 'Sublinhado' },
                { key: 'italic', label: 'ITALIC', icon: <span className="italic font-serif font-black text-xs leading-none">I</span>, desc: 'Itálico' },
                { key: 'uppercase', label: 'ALTAS', icon: <span className="text-[10px] font-bold leading-none">AA</span>, desc: 'Caixa Alta' },
              ].map((styleObj) => {
                const isActive = brush[styleObj.key as 'bold' | 'underline' | 'italic' | 'uppercase'];
                return (
                  <button
                    key={styleObj.key}
                    type="button"
                    onClick={() => brush.setBrush({ [styleObj.key]: !isActive })}
                    className={cn(
                      "flex-1 py-1.5 rounded border flex flex-col items-center justify-center gap-0.5 transition-all text-[8px] cursor-pointer",
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
        </>
      )}

      {/* Interactive Helper/Manual */}
      <div className="bg-neon-cyan/5 border border-neon-cyan/20 rounded-lg p-2 flex items-start gap-2 text-[10px] text-neon-cyan/70 leading-relaxed">
        <Info size={14} className="shrink-0 text-neon-cyan mt-0.5 animate-pulse" />
        <div>
          <strong className="text-neon-cyan">MODO ULTRA VELOZ:</strong>
          {brush.isEraser ? (
            <p>Clique ou <span className="text-neon-pink font-bold">mantenha pressionado e arraste</span> sobre as palavras para remover instantaneamente todas as decorações e fontes gigantes!</p>
          ) : (
            <p>Selecione as opções acima, então <span className="text-neon-yellow font-bold">toque nas palavras ou arraste por cima</span> para pintá-las e aumentá-las num instante!</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};
