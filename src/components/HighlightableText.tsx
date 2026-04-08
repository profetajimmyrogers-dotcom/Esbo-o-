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

  const coresMarcador = ['', 'highlight-yellow', 'highlight-cyan', 'highlight-pink'];

  const handleClick = (wordIndex: number, currentColor: string) => {
    const nextIndex = (coresMarcador.indexOf(currentColor) + 1) % coresMarcador.length;
    onHighlight(`${sectionKey}_${wordIndex}`, coresMarcador[nextIndex]);
  };

  return (
    <>
      {text.split(/\s+/).map((word, i) => {
        const key = `${sectionKey}_${i}`;
        const colorClass = highlights?.[key] || '';
        return (
          <span 
            key={i} 
            className={cn("palavra-clicavel inline-block mr-1", colorClass)}
            onClick={(e) => {
              e.stopPropagation();
              handleClick(i, colorClass);
            }}
          >
            {word}
          </span>
        );
      })}
    </>
  );
};
