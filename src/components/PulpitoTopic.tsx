import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { cn } from '../lib/utils';
import { HighlightableText } from './HighlightableText';

interface PulpitoTopicProps {
  p: string;
  i: number;
  sermonId: string;
  highlights?: Record<string, string>;
  onHighlight: (key: string, color: string) => void;
}

export const PulpitoTopic = ({ 
  p, 
  i, 
  sermonId, 
  highlights, 
  onHighlight 
}: PulpitoTopicProps) => {
  const [isChecked, setIsChecked] = useState(false);
  
  return (
    <div 
      className={cn(
        "flex gap-4 items-start p-5 border border-neon-cyan/10 transition-all duration-300 rounded-xl",
        isChecked ? "bg-black/40 opacity-40 grayscale" : "bg-neon-cyan/[0.05] border-l-4 border-l-neon-cyan shadow-[0_0_15px_rgba(0,245,255,0.05)]"
      )}
    >
      <div className="relative flex items-center justify-center mt-1 shrink-0">
        <input 
          type="checkbox" 
          checked={isChecked}
          onChange={() => setIsChecked(!isChecked)}
          className="w-8 h-8 accent-neon-pink cursor-pointer opacity-0 absolute inset-0 z-10" 
        />
        <div className={cn(
          "w-8 h-8 border-2 flex items-center justify-center transition-all rounded-md",
          isChecked ? "bg-neon-pink border-neon-pink" : "border-neon-cyan/40 bg-dark-bg"
        )}>
          {isChecked && <Play className="w-4 h-4 text-white fill-current" />}
        </div>
      </div>
      <div className="text-xl md:text-2xl lg:text-3xl leading-relaxed text-text-mid whitespace-pre-wrap flex-1 font-medium">
        <HighlightableText 
          text={p} 
          sermonId={sermonId} 
          sectionKey={`ponto_${i}`} 
          highlights={highlights}
          onHighlight={onHighlight}
        />
      </div>
    </div>
  );
};
