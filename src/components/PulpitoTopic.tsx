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
        "flex gap-4 items-start p-5 border border-white/5 transition-all duration-300 rounded-xl",
        isChecked ? "bg-black/40 opacity-40 grayscale" : "bg-[#162127]/60 border-l-4 border-l-[#CF9D7B] shadow-[0_0_20px_rgba(207,157,123,0.08)]"
      )}
    >
      <div className="relative flex items-center justify-center mt-1 shrink-0">
        <input 
          type="checkbox" 
          checked={isChecked}
          onChange={() => setIsChecked(!isChecked)}
          className="w-8 h-8 accent-[#CF9D7B] cursor-pointer opacity-0 absolute inset-0 z-10" 
        />
        <div className={cn(
          "w-8 h-8 border-2 flex items-center justify-center transition-all rounded-md",
          isChecked ? "bg-[#CF9D7B] border-[#CF9D7B]" : "border-[#CF9D7B]/40 bg-[#0C1519]"
        )}>
          {isChecked && <Play className="w-4 h-4 text-white fill-current" />}
        </div>
      </div>
      <div className="text-lg md:text-xl lg:text-2xl leading-relaxed text-text-mid whitespace-pre-wrap flex-1 font-medium">
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
