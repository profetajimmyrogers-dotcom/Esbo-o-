import React, { useState } from 'react';

interface PulpitoSectorsProps {
  setores: string[];
  onAdd: (s: string) => void;
}

export const PulpitoSectors = ({ setores, onAdd }: PulpitoSectorsProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newSetor, setNewSetor] = useState('');

  return (
    <div className="flex flex-wrap items-center gap-3 py-2 border-t border-[rgba(207,157,123,0.15)] mt-3 opacity-80 hover:opacity-100 transition-opacity">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#CF9D7B] shadow-[0_0_6px_#CF9D7B]" />
        <span className="text-[10px] font-mono text-[#CF9D7B] tracking-[0.2em] uppercase font-bold">
          REGISTRO DO SETOR:
        </span>
      </div>
      
      <div className="flex flex-wrap gap-1.5 items-center">
        {setores.map((s, i) => (
          <div 
            key={i} 
            className="px-2.5 py-0.5 border border-[rgba(207,157,123,0.35)] bg-[rgba(207,157,123,0.12)] text-[#F3D8B8] font-mono text-xs rounded-full font-semibold shadow-xs"
          >
            {s}
          </div>
        ))}
        
        {isAdding ? (
          <div className="flex items-center gap-1">
            <input 
              autoFocus
              value={newSetor}
              onChange={(e) => setNewSetor(e.target.value.slice(0, 15))}
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
              className="w-24 bg-[#0C1519] border border-[#CF9D7B] text-[#F3D8B8] text-center text-xs outline-none py-0.5 px-2 rounded-full font-mono shadow-[0_0_8px_rgba(207,157,123,0.3)]"
              placeholder="Ex.: 07"
            />
          </div>
        ) : (
          <button 
            type="button"
            onClick={() => setIsAdding(true)}
            className="px-3 py-0.5 border border-dashed border-[rgba(207,157,123,0.3)] text-[#CF9D7B] hover:border-[#CF9D7B] hover:bg-[rgba(207,157,123,0.1)] rounded-full text-[10px] font-mono tracking-wider transition-all cursor-pointer"
          >
            + REGISTRAR SETOR
          </button>
        )}
      </div>
    </div>
  );
};
