import React, { useState } from 'react';

interface PulpitoSectorsProps {
  setores: string[];
  onAdd: (s: string) => void;
}

export const PulpitoSectors = ({ setores, onAdd }: PulpitoSectorsProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newSetor, setNewSetor] = useState('');

  return (
    <div className="flex flex-wrap items-center gap-4 py-3 border-t border-neon-cyan/10 mt-6 opacity-60 hover:opacity-100 transition-opacity">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-neon-yellow animate-pulse shadow-[0_0_5px_rgba(255,238,0,0.8)]" />
        <span className="text-[10px] font-orbitron text-neon-cyan/40 tracking-[0.2em] uppercase">Registros de Setor:</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {setores.map((s, i) => (
          <div key={i} className="px-2 py-0.5 border border-neon-yellow/30 bg-neon-yellow/5 text-neon-yellow font-mono text-xs rounded-sm">
            {s}
          </div>
        ))}
        
        {isAdding ? (
          <div className="flex items-center gap-1">
            <input 
              autoFocus
              value={newSetor}
              onChange={(e) => setNewSetor(e.target.value.slice(0, 3))}
              onBlur={() => {
                if (!newSetor.trim()) setIsAdding(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSetor.trim()) {
                  onAdd(newSetor.trim());
                  setNewSetor('');
                  setIsAdding(false);
                }
                if (e.key === 'Escape') setIsAdding(false);
              }}
              className="w-14 bg-neon-yellow/10 border border-neon-yellow text-neon-yellow text-center text-xs outline-none py-0.5 font-mono"
              placeholder="00"
            />
          </div>
        ) : (
          <button 
            onClick={() => setIsAdding(true)}
            className="px-3 py-0.5 border border-dashed border-neon-cyan/20 text-neon-cyan/30 hover:border-neon-cyan hover:text-neon-cyan text-[10px] font-orbitron transition-all"
          >
            + REGISTRAR
          </button>
        )}
      </div>
    </div>
  );
};
