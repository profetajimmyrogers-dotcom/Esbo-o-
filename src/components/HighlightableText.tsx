import React from 'react';
import { cn } from '../lib/utils';

interface HighlightableTextProps {
  text: string;
  sermonId: string;
  sectionKey: string;
  highlights?: Record<string, string>;
  onHighlight: (key: string, color: string) => void;
}

export const HighlightableText = ({ 
  text, 
  sectionKey, 
  highlights, 
  onHighlight 
}: HighlightableTextProps) => {
  if (!text) return null;

  const coresMarcador = ['', 'highlight-yellow', 'highlight-cyan', 'highlight-pink', 'highlight-green-fluo', 'highlight-crimson'];

  // Dividimos o texto mantendo os espaços e quebras de linha como elementos (tokens)
  const tokens = text.split(/(\s+)/);
  
  let nonWhitespaceCounter = 0;

  return (
    <>
      {tokens.map((token, i) => {
        const isWhitespace = /^\s+$/.test(token);
        
        if (isWhitespace) {
          // Renderiza espaços e quebras de linha exatamente como são
          return <span key={i}>{token}</span>;
        }

        // É uma palavra real
        const currentWordIndex = nonWhitespaceCounter++;
        const key = `${sectionKey}_${currentWordIndex}`;
        const colorClass = highlights?.[key] || '';
        
        return (
          <span 
            key={i} 
            translate="no"
            className={cn("palavra-clicavel inline", colorClass)}
            onClick={(e) => {
              e.stopPropagation();
              const nextIndex = (coresMarcador.indexOf(colorClass) + 1) % coresMarcador.length;
              onHighlight(key, coresMarcador[nextIndex]);
            }}
          >
            {token}
          </span>
        );
      })}
    </>
  );
};
