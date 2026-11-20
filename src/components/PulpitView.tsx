import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Maximize, 
  Minimize, 
  Sun, 
  Moon, 
  LayoutGrid, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Sparkles, 
  Paintbrush, 
  BookOpen, 
  Check, 
  CheckCircle2, 
  Sliders, 
  Type, 
  LogOut, 
  Layers, 
  FileText,
  AlertTriangle,
  ZoomIn,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Sermon } from '../types';
import { HighlightableText } from './HighlightableText';
import { PulpitoSectors } from './PulpitoSectors';
import { useBrush } from '../lib/brushStore';
import { useHighlightMode } from '../lib/highlightStore';

interface PulpitViewProps {
  sermon: Sermon;
  onClose: () => void;
  onHighlight: (key: string, color: string) => void;
  onAddSector: (sector: string) => Promise<void>;
}

interface PulpitSection {
  id: string;
  type: 'cover' | 'verse' | 'intro' | 'topic' | 'application';
  kicker: string;
  title: string;
  subtitle?: string;
  contentKey?: string;
  text?: string;
  topicIndex?: number;
  metaChips?: string[];
  thanksList?: string[];
}

const PCOLORS = ['#00e5ff', '#38bdf8', '#34d399', '#a78bfa', '#fbbf24', '#f472b6', '#60a5fa'];

export const PulpitView = ({
  sermon,
  onClose,
  onHighlight,
  onAddSector,
}: PulpitViewProps) => {
  // Navigation State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | 'fade'>('fade');
  const [viewMode, setViewMode] = useState<'slides' | 'scroll'>('slides');
  const [showIndexGrid, setShowIndexGrid] = useState(false);
  const [completedTopics, setCompletedTopics] = useState<Record<number, boolean>>({});

  // Display & Readability Settings
  const [scale, setScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pulpit_scale');
      return saved ? Number(saved) : 1;
    } catch {
      return 1;
    }
  });

  const [lineSpacing, setLineSpacing] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pulpit_spacing');
      return saved ? Number(saved) : 1.65;
    } catch {
      return 1.65;
    }
  });

  const [highContrast, setHighContrast] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pulpit_high_contrast') === 'true';
    } catch {
      return false;
    }
  });

  const [isLightMode, setIsLightMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pulpit_light_mode') === 'true';
    } catch {
      return false;
    }
  });

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    return typeof document !== 'undefined' && !!document.fullscreenElement;
  });

  // Lightbox for cover image
  const [showLightbox, setShowLightbox] = useState(false);

  // Time & Stopwatch Engine
  const [targetMinutes, setTargetMinutes] = useState<number>(35);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('--:--:--');
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const alertsTriggered = useRef<Set<string>>(new Set());
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Swipe Gestures
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);

  // Tools stores
  const brush = useBrush();
  const highlightMode = useHighlightMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // 1. Build Sections from Sermon
  const sections = useMemo<PulpitSection[]>(() => {
    const list: PulpitSection[] = [];

    // Metadata chips
    const metaChips: string[] = [];
    if (sermon.texto) metaChips.push(sermon.texto);
    if (sermon.setores && sermon.setores.length > 0) {
      metaChips.push(`${sermon.setores.length} Setor(es)`);
    }

    // 1. PRIMEIRA PÁGINA: Mensagem & Tema (A)
    list.push({
      id: 'cover',
      type: 'cover',
      kicker: 'MENSAGEM',
      title: sermon.tema || 'Sermão sem título',
      subtitle: sermon.texto || '',
      metaChips: [sermon.texto, sermon.setores && sermon.setores.length > 0 ? `${sermon.setores.length} Setores` : ''].filter(Boolean)
    });

    // 2. SEGUNDA PÁGINA: Texto Bíblico + Agradecimento + Registro do Setor (B)
    const thanksList = (sermon.agr || '')
      .split(/[,;\n]+/)
      .map(s => s.trim())
      .filter(Boolean);

    list.push({
      id: 'verse',
      type: 'verse',
      kicker: 'TEXTO BÍBLICO & AGRADECIMENTOS',
      title: 'Palavra do Senhor',
      subtitle: sermon.texto || 'Passagem bíblica',
      contentKey: 'texto',
      text: sermon.texto,
      thanksList
    });

    // 3. TERCEIRA PÁGINA: Abertura / Introdução Sozinha (C)
    if (sermon.intro && sermon.intro.trim()) {
      list.push({
        id: 'intro',
        type: 'intro',
        kicker: 'ABERTURA',
        title: 'Introdução',
        subtitle: 'Abertura da Pregação',
        contentKey: 'intro',
        text: sermon.intro
      });
    }

    // Topics Sections
    if (Array.isArray(sermon.pontos) && sermon.pontos.length > 0) {
      sermon.pontos.forEach((pontoText, idx) => {
        if (!pontoText || !pontoText.trim()) return;

        // Smart title deduction: if topic starts with "1. Title:" or "Title -"
        const firstLine = pontoText.split('\n')[0].trim();
        let topicTitle = `Tópico ${idx + 1}`;
        if (firstLine.length < 60 && (firstLine.includes(':') || firstLine.includes('-') || firstLine.includes('—'))) {
          topicTitle = firstLine.replace(/^\d+[\.\)\-]\s*/, '').trim();
        }

        list.push({
          id: `topic_${idx}`,
          type: 'topic',
          kicker: `TÓPICO ${String(idx + 1).padStart(2, '0')}`,
          title: topicTitle,
          contentKey: `ponto_${idx}`,
          text: pontoText,
          topicIndex: idx
        });
      });
    }

    // General Application Section
    if (sermon.apl && sermon.apl.trim()) {
      list.push({
        id: 'application',
        type: 'application',
        kicker: 'CONCLUSÃO & APELO',
        title: 'Aplicação Geral & Fechamento',
        contentKey: 'apl',
        text: sermon.apl
      });
    }

    // (D) FOTO SEMPRE NA ÚLTIMA PÁGINA (se existir imagem)
    if (sermon.img && sermon.img.trim()) {
      list.push({
        id: 'photo_page',
        type: 'cover',
        kicker: 'RECURSO VISUAL',
        title: 'Foto da Mensagem',
        subtitle: sermon.tema || 'Ilustração final',
        text: sermon.img
      });
    }

    return list;
  }, [sermon]);

  // Current active section color
  const activeColor = PCOLORS[currentIndex % PCOLORS.length];

  // Trigger alert banner
  const showAlert = useCallback((msg: string) => {
    setAlertMessage(msg);
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    alertTimeoutRef.current = setTimeout(() => {
      setAlertMessage(null);
    }, 4500);
  }, []);

  // 2. Real-time Clock Loop
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // 3. Preaching Stopwatch Loop
  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => {
          const next = prev + 1;
          const targetSeconds = targetMinutes * 60;

          // Warning at 85% of time
          if (next >= targetSeconds * 0.85 && !alertsTriggered.current.has('warn')) {
            alertsTriggered.current.add('warn');
            showAlert('Atenção: restam cerca de 15% do tempo previsto');
          }

          // Target reached
          if (next >= targetSeconds && !alertsTriggered.current.has('end')) {
            alertsTriggered.current.add('end');
            showAlert('Tempo previsto encerrado! Conclua com a bênção apostólica');
          }

          return next;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isTimerRunning, targetMinutes, showAlert]);

  // Disable body scanlines while in pulpit mode
  useEffect(() => {
    document.body.classList.add('pulpit-active');
    return () => {
      document.body.classList.remove('pulpit-active');
    };
  }, []);

  // Keep rail chip centered
  useEffect(() => {
    if (railRef.current) {
      const activeEl = railRef.current.querySelector('[data-active="true"]') as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if an input is active
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'Escape') {
        if (showLightbox) {
          setShowLightbox(false);
          return;
        }
        if (showIndexGrid) {
          setShowIndexGrid(false);
          return;
        }
        onClose();
        return;
      }

      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goToStep(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToStep(-1);
      } else if (e.key === 'g' || e.key === 'G') {
        setShowIndexGrid(prev => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === '+' || e.key === '=') {
        adjustScale(0.05);
      } else if (e.key === '-') {
        adjustScale(-0.05);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, sections.length, showIndexGrid, showLightbox, onClose]);

  // Helpers for Scale & Spacing
  const adjustScale = (delta: number) => {
    setScale(prev => {
      const next = Math.max(0.75, Math.min(1.6, Math.round((prev + delta) * 20) / 20));
      localStorage.setItem('pulpit_scale', String(next));
      return next;
    });
  };

  const updateSpacing = (val: number) => {
    setLineSpacing(val);
    localStorage.setItem('pulpit_spacing', String(val));
  };

  const toggleHighContrast = () => {
    setHighContrast(prev => {
      const next = !prev;
      localStorage.setItem('pulpit_high_contrast', String(next));
      return next;
    });
  };

  const toggleTheme = () => {
    setIsLightMode(prev => {
      const next = !prev;
      localStorage.setItem('pulpit_light_mode', String(next));
      return next;
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Step navigation
  const goToStep = (delta: number) => {
    const next = Math.max(0, Math.min(sections.length - 1, currentIndex + delta));
    if (next !== currentIndex) {
      setSlideDirection(delta > 0 ? 'next' : 'prev');
      setCurrentIndex(next);
    }
  };

  const jumpToSection = (index: number) => {
    if (index >= 0 && index < sections.length) {
      setSlideDirection('fade');
      setCurrentIndex(index);
      setShowIndexGrid(false);
    }
  };

  // Timer Formatting
  const formatTimerDigits = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const targetTotalSeconds = targetMinutes * 60;
  const isOvertime = elapsedSeconds >= targetTotalSeconds;
  const isWarningTime = elapsedSeconds >= targetTotalSeconds * 0.85 && !isOvertime;
  const secondsLeft = Math.max(0, targetTotalSeconds - elapsedSeconds);

  // Swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      if (deltaX < 0) {
        goToStep(1); // Swipe left = next
      } else {
        goToStep(-1); // Swipe right = prev
      }
    }
  };

  const currentSection = sections[currentIndex] || sections[0];

  return (
    <div
      ref={containerRef}
      style={{
        '--sc': highContrast ? '#ffdf00' : activeColor,
        '--ps': scale,
        '--plh': lineSpacing,
      } as React.CSSProperties}
      className={cn(
        "fixed inset-0 z-[2000] flex flex-col overflow-hidden select-none font-rajdhani transition-colors duration-300",
        highContrast 
          ? "bg-black text-white" 
          : isLightMode 
            ? "bg-[#f4f7fb] text-[#101828]" 
            : "bg-[#04060a] text-[#e8ecf4]"
      )}
      translate="no"
    >
      {/* Background Ambience Mesh */}
      <div 
        className={cn(
          "absolute inset-0 pointer-events-none -z-10 transition-opacity duration-500",
          highContrast ? "opacity-0" : isLightMode ? "opacity-30" : "opacity-100"
        )}
        style={{
          background: `
            radial-gradient(900px 520px at 12% -10%, color-mix(in srgb, var(--sc) 18%, transparent), transparent 60%),
            radial-gradient(720px 520px at 100% 112%, color-mix(in srgb, var(--sc) 12%, transparent), transparent 62%),
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: 'auto, auto, 42px 42px, 42px 42px'
        }}
      />

      {/* 1. Progress Bar at the Very Top */}
      <div className="h-1 w-full bg-white/10 shrink-0 relative overflow-hidden">
        <div 
          className="h-full transition-all duration-300 shadow-[0_0_12px_var(--sc)]"
          style={{ 
            width: `${((currentIndex + 1) / Math.max(1, sections.length)) * 100}%`,
            backgroundColor: 'var(--sc)'
          }}
        />
      </div>

      {/* 2. Top Header Bar (Pulpit-Bar) */}
      <header className={cn(
        "flex items-center justify-between px-4 md:px-6 py-2.5 border-b gap-3 flex-wrap shrink-0 backdrop-blur-md z-20",
        highContrast 
          ? "border-white/30 bg-black" 
          : isLightMode 
            ? "border-[#0c1a26]/15 bg-white/90 text-[#101828]" 
            : "border-white/10 bg-[#070c10]/90 text-white"
      )}>
        {/* Title & Kicker */}
        <div className="flex items-center gap-3 min-w-0 max-w-[280px] sm:max-w-md">
          <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_8px_var(--sc)]" style={{ backgroundColor: 'var(--sc)' }} />
          <div className="truncate">
            <h1 className="font-orbitron font-extrabold text-xs md:text-sm tracking-wider uppercase truncate text-white">
              {sermon.tema}
            </h1>
            <div className="text-[10px] font-mono tracking-widest uppercase flex items-center gap-1.5" style={{ color: 'var(--sc)' }}>
              <span>{currentSection.kicker}</span>
              <span className="opacity-40">•</span>
              <span className="opacity-70">{sections.length} SEÇÕES</span>
            </div>
          </div>
        </div>

        {/* Tools & Timer Center/Right */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {/* Real-time Clock */}
          <div 
            className={cn(
              "font-mono font-bold text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 whitespace-nowrap",
              highContrast ? "border-white/40 bg-black text-white" : "border-white/10 bg-white/5 text-white/90"
            )}
            title="Horário local de Brasília"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{currentTimeStr}</span>
          </div>

          {/* Stopwatch Elapsed Timer */}
          <div className="flex items-center gap-1.5 bg-black/60 border border-white/15 px-2.5 py-1 rounded-md">
            <span 
              className={cn(
                "font-mono font-black text-sm md:text-base tabular-nums transition-colors tracking-wider",
                isOvertime ? "text-red-400 animate-pulse" : isWarningTime ? "text-amber-300" : "text-white"
              )}
            >
              {formatTimerDigits(elapsedSeconds)}
            </span>

            {/* Remaining Time Badge */}
            <span className={cn(
              "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border whitespace-nowrap",
              isOvertime 
                ? "bg-red-950/60 border-red-500/50 text-red-300" 
                : isWarningTime 
                  ? "bg-amber-950/60 border-amber-500/50 text-amber-300" 
                  : "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
            )}>
              {isOvertime ? `Excedido +${formatTimerDigits(elapsedSeconds - targetTotalSeconds)}` : `Restam ${formatTimerDigits(secondsLeft)}`}
            </span>

            {/* Timer Actions */}
            <div className="flex items-center gap-1 ml-1">
              <button 
                onClick={() => setIsTimerRunning(prev => !prev)}
                className="p-1 hover:bg-white/10 rounded text-white/80 hover:text-white cursor-pointer transition-colors"
                title={isTimerRunning ? "Pausar cronômetro" : "Iniciar cronômetro"}
              >
                {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              </button>
              <button 
                onClick={() => {
                  setElapsedSeconds(0);
                  alertsTriggered.current.clear();
                  setAlertMessage(null);
                }}
                className="p-1 hover:bg-white/10 rounded text-white/80 hover:text-white cursor-pointer transition-colors"
                title="Zerar cronômetro"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="w-[1px] h-5 bg-white/15 hidden sm:block mx-1" />

          {/* Target Minutes Selector */}
          <select 
            value={targetMinutes}
            onChange={(e) => {
              setTargetMinutes(Number(e.target.value));
              alertsTriggered.current.clear();
            }}
            className="bg-black/40 border border-white/15 rounded-md text-[10px] font-mono px-2 py-1 text-white/80 outline-none cursor-pointer"
            title="Tempo previsto para pregação"
          >
            <option value={20} className="bg-[#0c1519] text-white">20 min</option>
            <option value={25} className="bg-[#0c1519] text-white">25 min</option>
            <option value={30} className="bg-[#0c1519] text-white">30 min</option>
            <option value={35} className="bg-[#0c1519] text-white">35 min</option>
            <option value={40} className="bg-[#0c1519] text-white">40 min</option>
            <option value={45} className="bg-[#0c1519] text-white">45 min</option>
            <option value={50} className="bg-[#0c1519] text-white">50 min</option>
            <option value={60} className="bg-[#0c1519] text-white">60 min</option>
          </select>

          {/* Scale Buttons (A- / A+) */}
          <div className="flex items-center gap-1 bg-black/40 border border-white/15 rounded-md px-1.5 py-0.5">
            <button 
              onClick={() => adjustScale(-0.05)}
              className="px-1.5 py-0.5 font-orbitron font-black text-xs text-white/80 hover:text-white hover:bg-white/10 rounded cursor-pointer"
              title="Diminuir tamanho das letras"
            >
              A−
            </button>
            <span className="text-[9px] font-mono text-white/50 min-w-[2.2rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button 
              onClick={() => adjustScale(0.05)}
              className="px-1.5 py-0.5 font-orbitron font-black text-xs text-white/80 hover:text-white hover:bg-white/10 rounded cursor-pointer"
              title="Aumentar tamanho das letras"
            >
              A+
            </button>
          </div>

          {/* Line Spacing Range Slider */}
          <div className="hidden lg:flex items-center gap-1.5 bg-black/40 border border-white/15 rounded-md px-2 py-1" title="Espaçamento entre linhas">
            <span className="text-[10px] font-mono text-white/60">Linhas</span>
            <input 
              type="range"
              min="1.2"
              max="2.2"
              step="0.05"
              value={lineSpacing}
              onChange={(e) => updateSpacing(Number(e.target.value))}
              className="w-14 accent-[var(--sc)] cursor-pointer h-1.5 bg-white/20 rounded"
            />
          </div>

          {/* High Contrast Toggle */}
          <button 
            onClick={toggleHighContrast}
            className={cn(
              "px-2.5 py-1 text-xs font-mono font-bold rounded-md border transition-all cursor-pointer flex items-center gap-1.5",
              highContrast 
                ? "bg-[#ffdf00] text-black border-[#ffdf00] shadow-[0_0_12px_rgba(255,223,0,0.4)]" 
                : "border-white/15 bg-white/5 text-white/80 hover:text-white hover:border-white/30"
            )}
            title="Ativar contraste alto para ambientes claros"
          >
            <span>◐</span>
            <span className="hidden md:inline">{highContrast ? 'Contraste Alto' : 'Contraste'}</span>
          </button>

          {/* Overview Grid Modal (G) */}
          <button 
            onClick={() => setShowIndexGrid(true)}
            className="px-2.5 py-1 text-xs font-mono font-bold rounded-md border border-white/15 bg-white/5 text-white/80 hover:text-white hover:border-[var(--sc)] hover:shadow-[0_0_12px_var(--sc)] transition-all cursor-pointer flex items-center gap-1.5"
            title="Visão Geral do Sermão (Tecla G)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Índice</span>
          </button>

          {/* View Mode Toggle: Slides vs Scroll */}
          <button 
            onClick={() => setViewMode(prev => prev === 'slides' ? 'scroll' : 'slides')}
            className={cn(
              "px-2.5 py-1 text-xs font-mono font-bold rounded-md border transition-all cursor-pointer flex items-center gap-1.5",
              viewMode === 'slides' 
                ? "border-[var(--sc)] bg-[var(--sc)]/15 text-white" 
                : "border-white/15 bg-white/5 text-white/70 hover:text-white"
            )}
            title="Alternar entre modo Slides e Rolo Contínuo"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{viewMode === 'slides' ? 'Slides' : 'Rolo'}</span>
          </button>

          {/* Fullscreen (F) */}
          <button 
            onClick={toggleFullscreen}
            className="p-1.5 text-xs rounded-md border border-white/15 bg-white/5 text-white/80 hover:text-white hover:border-white/30 cursor-pointer"
            title="Tela cheia (Tecla F)"
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>

          {/* Exit Button */}
          <button 
            onClick={onClose}
            className="px-3 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 hover:text-white rounded-md text-xs font-orbitron font-bold transition-all cursor-pointer ml-1 flex items-center gap-1"
            title="Encerrar Modo Púlpito (Esc)"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* 3. Section Navigation Rail (Pulpit-Rail) */}
      <nav 
        ref={railRef}
        aria-label="Seções do sermão"
        className={cn(
          "flex items-center gap-2 overflow-x-auto px-4 md:px-6 py-2 border-b shrink-0 scrollbar-none transition-colors",
          highContrast ? "border-white/20 bg-black" : "border-white/10 bg-[#070c10]/60"
        )}
      >
        {sections.map((sec, idx) => {
          const isActive = idx === currentIndex;
          const isDone = idx < currentIndex;
          const color = PCOLORS[idx % PCOLORS.length];

          return (
            <button
              key={sec.id}
              data-active={isActive ? "true" : "false"}
              onClick={() => jumpToSection(idx)}
              style={{
                borderColor: isActive ? color : isDone ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                backgroundColor: isActive ? `color-mix(in srgb, ${color} 18%, transparent)` : isDone ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                boxShadow: isActive ? `0 0 16px color-mix(in srgb, ${color} 35%, transparent)` : 'none'
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono transition-all duration-200 shrink-0 cursor-pointer",
                isActive 
                  ? "text-white font-bold scale-[1.03]" 
                  : isDone 
                    ? "text-white/60 hover:text-white hover:opacity-100" 
                    : "text-white/40 hover:text-white/70 hover:opacity-100"
              )}
            >
              <span 
                className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px]"
                style={{
                  backgroundColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                  color: color
                }}
              >
                {isDone ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
              </span>
              <span className="whitespace-nowrap tracking-wider uppercase text-[11px]">{sec.title}</span>
            </button>
          );
        })}
      </nav>

      {/* Floating Alert Banner if near end or exceeded */}
      <AnimatePresence>
        {alertMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={cn(
              "fixed top-24 left-1/2 -translate-x-1/2 z-[2050] px-5 py-2.5 rounded-xl border font-mono text-xs font-bold shadow-2xl flex items-center gap-2.5 backdrop-blur-xl",
              isOvertime 
                ? "bg-red-950/90 border-red-500 text-red-200 shadow-red-900/40" 
                : "bg-amber-950/90 border-amber-500 text-amber-200 shadow-amber-900/40"
            )}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
            <span>{alertMessage}</span>
            <button 
              onClick={() => setAlertMessage(null)}
              className="ml-2 hover:opacity-100 opacity-60 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Main Pulpit Stage Canvas */}
      <div 
        className="flex-1 overflow-y-auto relative p-6 md:p-12 flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background Watermark Section Number */}
        <div 
          className="fixed right-6 bottom-16 md:right-12 md:bottom-20 pointer-events-none select-none font-mono font-black leading-none opacity-5 text-right z-0"
          style={{ 
            fontSize: 'clamp(140px, 24vw, 320px)',
            color: 'var(--sc)'
          }}
          aria-hidden="true"
        >
          {String(currentIndex + 1).padStart(2, '0')}
        </div>

        {/* Content Box */}
        <div className="relative z-10 max-w-4xl w-full mx-auto my-auto flex-1 flex flex-col justify-center">
          {viewMode === 'slides' ? (
            /* SLIDE-BY-SLIDE VIEW (The Gold Standard from pulpit-mode.html) */
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSection.id}
                initial={{ 
                  opacity: 0, 
                  x: slideDirection === 'next' ? 40 : slideDirection === 'prev' ? -40 : 0,
                  y: slideDirection === 'fade' ? 12 : 0
                }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ 
                  opacity: 0, 
                  x: slideDirection === 'next' ? -40 : slideDirection === 'prev' ? 40 : 0,
                  y: slideDirection === 'fade' ? -12 : 0
                }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="space-y-8 py-6"
              >
                {/* Kicker */}
                <div 
                  className="font-mono text-xs md:text-sm font-bold tracking-[0.35em] uppercase flex items-center gap-2"
                  style={{ color: 'var(--sc)' }}
                >
                  <span>✦</span>
                  <span>{currentSection.kicker}</span>
                </div>

                {/* Heading with glowing accent underline */}
                <div className="space-y-3">
                  <h2 
                    className="font-orbitron font-black text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.1] uppercase"
                    style={{ fontSize: 'calc(clamp(28px, 4.2vw, 56px) * var(--ps))' }}
                  >
                    {currentSection.title}
                  </h2>
                  <div 
                    className="w-24 h-1 rounded-full shadow-[0_0_16px_var(--sc)]"
                    style={{ backgroundColor: 'var(--sc)' }}
                  />
                </div>

                {/* Subtitle / Scripture ref if any */}
                {currentSection.subtitle && (
                  <div className="font-mono text-sm md:text-base text-white/70 tracking-wider">
                    {currentSection.subtitle}
                  </div>
                )}

                {/* 1. PRIMEIRA PÁGINA: Texto bíblico primeiro + agradecimento, foto e registro do setor abaixo organizados */}
                {currentSection.type === 'verse' && (
                  <div className="space-y-8 pt-2">
                    {/* Big Bible Verse Quote Primeiro */}
                    <div 
                      className="p-6 md:p-8 rounded-2xl border bg-black/40 border-white/15 shadow-xl space-y-4"
                      style={{ borderLeft: '4px solid var(--sc)' }}
                    >
                      <div className="flex items-center gap-2 font-orbitron text-xs font-bold text-[#ffee00] tracking-widest uppercase">
                        <BookOpen className="w-4 h-4 text-[#ffee00]" />
                        <span>TEXTO SAGRADO</span>
                      </div>
                      <div 
                        className="text-white leading-relaxed font-semibold whitespace-pre-wrap select-text"
                        style={{ 
                          fontSize: 'calc(clamp(22px, 3.2vw, 42px) * var(--ps))',
                          lineHeight: 'var(--plh)'
                        }}
                      >
                        <HighlightableText 
                          text={sermon.texto || ''} 
                          sermonId={sermon.id!} 
                          sectionKey="texto" 
                          highlights={sermon.highlights}
                          onHighlight={(key, color) => onHighlight(key, color)}
                        />
                      </div>
                    </div>

                    {/* Agradecimentos e Registro do Setor organizados abaixo do texto bíblico */}
                    <div className="space-y-5">
                      {/* Agradecimentos */}
                      {currentSection.thanksList && currentSection.thanksList.length > 0 && (
                        <div 
                          className="relative p-5 md:p-6 rounded-2xl border border-white/15 bg-white/5 backdrop-blur-md shadow-lg space-y-3"
                          style={{ borderLeft: '3px solid var(--sc)' }}
                        >
                          <div 
                            className="flex items-center gap-2 font-mono font-bold text-xs tracking-[0.25em] uppercase text-white/90"
                            style={{ color: 'var(--sc)' }}
                          >
                            <span>✦</span>
                            <span>AGRADECIMENTOS & HOMENAGENS</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {currentSection.thanksList.map((name, i) => (
                              <span 
                                key={i}
                                className="px-3.5 py-1.5 rounded-full border border-white/20 bg-white/10 font-bold text-xs md:text-sm text-white tracking-wide shadow-sm"
                                style={{ 
                                  fontSize: 'calc(clamp(13px, 1.5vw, 17px) * var(--ps))',
                                  borderColor: 'color-mix(in srgb, var(--sc) 35%, rgba(255,255,255,0.2))'
                                }}
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Registro do Setor */}
                      <div className="bg-black/35 p-4 rounded-xl border border-white/10 shadow-md">
                        <PulpitoSectors 
                          setores={sermon.setores || []} 
                          onAdd={onAddSector} 
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. SEGUNDA PÁGINA: Abertura da pregação (Tema da Mensagem e a Introdução) */}
                {/* 3. TERCEIRA PÁGINA: Abertura / Introdução Sozinha */}
                {currentSection.type === 'intro' && (
                  <div className="space-y-8 pt-2">
                    {/* Introdução Revelada */}
                    <div 
                      className="p-6 md:p-8 rounded-2xl border bg-black/35 border-white/15 shadow-xl space-y-3"
                      style={{ borderLeft: '4px solid var(--sc)' }}
                    >
                      <div className="flex items-center gap-2 font-orbitron text-xs font-bold text-[var(--sc)] tracking-widest uppercase">
                        <span>✦ INTRODUÇÃO REVELADA</span>
                      </div>
                      <div 
                        className="text-white/95 leading-relaxed font-medium whitespace-pre-wrap select-text"
                        style={{ 
                          fontSize: 'calc(clamp(20px, 2.6vw, 36px) * var(--ps))',
                          lineHeight: 'var(--plh)'
                        }}
                      >
                        <HighlightableText 
                          text={sermon.intro || ''} 
                          sermonId={sermon.id!} 
                          sectionKey="intro" 
                          highlights={sermon.highlights}
                          onHighlight={(key, color) => onHighlight(key, color)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* (D) FOTO NA ÚLTIMA PÁGINA */}
                {currentSection.id === 'photo_page' && sermon.img && (
                  <div className="space-y-6 pt-2 flex flex-col items-center">
                    <div 
                      className="relative group max-w-2xl w-full rounded-2xl overflow-hidden border border-white/25 bg-black/60 shadow-2xl cursor-pointer aspect-video sm:aspect-16/10"
                      onClick={() => setShowLightbox(true)}
                      title="Clique para ampliar a foto em tela cheia"
                    >
                      <img 
                        src={sermon.img} 
                        alt="Foto final da mensagem" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 text-white font-orbitron font-bold text-sm tracking-wider transition-opacity">
                        <ZoomIn className="w-5 h-5 text-[var(--sc)]" />
                        <span>AMPLIAR FOTO EM TELA CHEIA</span>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-white/60 tracking-widest uppercase">
                      ✦ FOTO OFICIAL DA MINISTRAÇÃO ✦
                    </span>
                  </div>
                )}

                {currentSection.type === 'topic' && currentSection.topicIndex !== undefined && (
                  <div className="space-y-6">
                    {/* Completion Checkmark Banner */}
                    <div className="flex items-center justify-between gap-4">
                      <button
                        onClick={() => {
                          const idx = currentSection.topicIndex!;
                          setCompletedTopics(prev => ({ ...prev, [idx]: !prev[idx] }));
                        }}
                        className={cn(
                          "flex items-center gap-2.5 px-4 py-2 rounded-xl border font-mono text-xs font-bold transition-all cursor-pointer",
                          completedTopics[currentSection.topicIndex]
                            ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                            : "bg-white/5 border-white/15 text-white/60 hover:text-white hover:border-white/30"
                        )}
                      >
                        <CheckCircle2 className={cn("w-4 h-4", completedTopics[currentSection.topicIndex] ? "text-emerald-400" : "text-white/40")} />
                        <span>{completedTopics[currentSection.topicIndex] ? 'Tópico Pregado ✓' : 'Marcar como Pregado'}</span>
                      </button>

                      <span className="font-mono text-xs text-white/50">
                        Ponto {currentSection.topicIndex + 1} de {sermon.pontos.length}
                      </span>
                    </div>

                    {/* Topic Main Text with HighlightableText */}
                    <div 
                      className={cn(
                        "p-6 md:p-8 rounded-2xl border transition-all duration-300 shadow-xl",
                        completedTopics[currentSection.topicIndex]
                          ? "bg-black/40 border-white/10 opacity-70"
                          : "bg-black/30 border-white/15"
                      )}
                      style={{ borderLeft: '4px solid var(--sc)' }}
                    >
                      <div 
                        className="text-white/95 leading-relaxed font-medium whitespace-pre-wrap select-text"
                        style={{ 
                          fontSize: 'calc(clamp(20px, 2.6vw, 36px) * var(--ps))',
                          lineHeight: 'var(--plh)'
                        }}
                      >
                        <HighlightableText 
                          text={currentSection.text || ''} 
                          sermonId={sermon.id!} 
                          sectionKey={`ponto_${currentSection.topicIndex}`} 
                          highlights={sermon.highlights}
                          onHighlight={(key, color) => onHighlight(key, color)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {currentSection.type === 'application' && (
                  <div 
                    className="p-6 md:p-8 rounded-2xl border bg-black/30 border-white/10 shadow-xl"
                    style={{ borderLeft: '4px solid var(--sc)' }}
                  >
                    <div 
                      className="text-white/95 leading-relaxed font-medium whitespace-pre-wrap select-text"
                      style={{ 
                        fontSize: 'calc(clamp(20px, 2.6vw, 36px) * var(--ps))',
                        lineHeight: 'var(--plh)'
                      }}
                    >
                      <HighlightableText 
                        text={sermon.apl} 
                        sermonId={sermon.id!} 
                        sectionKey="apl" 
                        highlights={sermon.highlights}
                        onHighlight={(key, color) => onHighlight(key, color)}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            /* CONTINUOUS SCROLL VIEW */
            <div className="space-y-16 py-8">
              {sections.map((sec, idx) => (
                <div 
                  key={sec.id}
                  id={`sec_${sec.id}`}
                  className="space-y-6 pt-6 border-b border-white/10 pb-12"
                  style={{ '--sc': PCOLORS[idx % PCOLORS.length] } as React.CSSProperties}
                >
                  <div 
                    className="font-mono text-xs font-bold tracking-[0.3em] uppercase flex items-center gap-2"
                    style={{ color: 'var(--sc)' }}
                  >
                    <span>✦ {sec.kicker}</span>
                  </div>

                  <h3 
                    className="font-orbitron font-black text-white text-2xl md:text-4xl uppercase"
                    style={{ fontSize: 'calc(clamp(22px, 3.2vw, 42px) * var(--ps))' }}
                  >
                    {sec.title}
                  </h3>

                  {sec.type === 'verse' ? (
                    <div className="space-y-6">
                      <div 
                        className="p-6 rounded-2xl bg-black/40 border border-white/10 leading-relaxed font-semibold whitespace-pre-wrap"
                        style={{ 
                          borderLeft: '4px solid var(--sc)',
                          fontSize: 'calc(clamp(18px, 2.3vw, 32px) * var(--ps))',
                          lineHeight: 'var(--plh)'
                        }}
                      >
                        <HighlightableText 
                          text={sermon.texto || ''} 
                          sermonId={sermon.id!} 
                          sectionKey="texto" 
                          highlights={sermon.highlights}
                          onHighlight={(key, color) => onHighlight(key, color)}
                        />
                      </div>

                      {/* Agradecimentos, Foto e Setor */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        <div className={cn("space-y-4", sermon.img ? "lg:col-span-8" : "lg:col-span-12")}>
                          {sec.thanksList && sec.thanksList.length > 0 && (
                            <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-2">
                              <span className="font-mono text-xs uppercase text-white/70" style={{ color: 'var(--sc)' }}>✦ AGRADECIMENTOS</span>
                              <div className="flex flex-wrap gap-2">
                                {sec.thanksList.map((name, i) => (
                                  <span key={i} className="px-3 py-1 rounded-full border border-white/20 bg-white/10 text-xs font-bold text-white">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="bg-black/35 p-3 rounded-xl border border-white/10">
                            <PulpitoSectors setores={sermon.setores || []} onAdd={onAddSector} />
                          </div>
                        </div>

                        {sermon.img && (
                          <div className="lg:col-span-4">
                            <div className="p-3 rounded-xl border border-white/15 bg-black/40 space-y-2">
                              <span className="font-orbitron font-bold text-xs text-white uppercase flex items-center gap-1.5">
                                <ImageIcon className="w-3.5 h-3.5 text-[var(--sc)]" />
                                <span>FOTO DA MENSAGEM</span>
                              </span>
                              <div 
                                className="relative group rounded-lg overflow-hidden border border-white/20 aspect-video cursor-pointer"
                                onClick={() => setShowLightbox(true)}
                              >
                                <img src={sermon.img} alt="Foto" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : sec.type === 'intro' ? (
                    <div className="space-y-6">
                      <div className="space-y-1">
                        <span className="font-mono text-xs text-white/50 uppercase tracking-widest">// TEMA DA MENSAGEM</span>
                        <h4 className="font-orbitron font-black text-2xl md:text-3xl text-white uppercase">{sermon.tema}</h4>
                      </div>
                      <div 
                        className="p-6 rounded-2xl bg-black/35 border border-white/10 leading-relaxed font-medium whitespace-pre-wrap"
                        style={{ 
                          borderLeft: '4px solid var(--sc)',
                          fontSize: 'calc(clamp(18px, 2.3vw, 32px) * var(--ps))',
                          lineHeight: 'var(--plh)'
                        }}
                      >
                        <HighlightableText 
                          text={sermon.intro || ''} 
                          sermonId={sermon.id!} 
                          sectionKey="intro" 
                          highlights={sermon.highlights}
                          onHighlight={(key, color) => onHighlight(key, color)}
                        />
                      </div>
                    </div>
                  ) : sec.text ? (
                    <div 
                      className="p-6 rounded-2xl bg-black/30 border border-white/10 leading-relaxed font-medium whitespace-pre-wrap"
                      style={{ 
                        borderLeft: '4px solid var(--sc)',
                        fontSize: 'calc(clamp(18px, 2.3vw, 32px) * var(--ps))',
                        lineHeight: 'var(--plh)'
                      }}
                    >
                      {sec.contentKey ? (
                        <HighlightableText 
                          text={sec.text} 
                          sermonId={sermon.id!} 
                          sectionKey={sec.contentKey} 
                          highlights={sermon.highlights}
                          onHighlight={(key, color) => onHighlight(key, color)}
                        />
                      ) : (
                        sec.text
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Bottom Navigation & Tools Bar (Pulpit-Controls) */}
      <footer className={cn(
        "flex items-center justify-between px-4 md:px-8 py-3 border-t shrink-0 backdrop-blur-md z-20 gap-3 flex-wrap",
        highContrast ? "border-white/30 bg-black" : "border-white/10 bg-[#070c10]/95 text-white"
      )}>
        {/* Previous Button */}
        <button
          onClick={() => goToStep(-1)}
          disabled={currentIndex <= 0}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl border font-orbitron font-bold text-xs uppercase tracking-wider transition-all cursor-pointer",
            currentIndex <= 0 
              ? "opacity-30 border-white/10 text-white/40 cursor-not-allowed" 
              : "border-white/20 bg-white/5 hover:bg-white/15 hover:border-[var(--sc)] text-white active:scale-95 shadow-md"
          )}
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Anterior</span>
        </button>

        {/* Center: Slide Counter & Highlighting Quick Tools */}
        <div className="flex items-center gap-3">
          {/* Slide Indicator */}
          <span className="font-mono text-xs md:text-sm text-white/70 tracking-widest px-3 py-1 bg-white/5 rounded-lg border border-white/10">
            {currentIndex + 1} / {sections.length}
          </span>

          {/* 1-Click Fast Color Cycle Toggle */}
          <button
            type="button"
            onClick={() => highlightMode.toggleMode()}
            className={cn(
              "px-3 py-1.5 rounded-lg border text-[10px] font-orbitron font-bold tracking-wider flex items-center gap-1.5 transition-all duration-300 active:scale-95 cursor-pointer shrink-0",
              highlightMode.isCycle
                ? "bg-[#ffee00]/15 border-[#ffee00]/50 text-[#ffee00] shadow-[0_0_12px_rgba(255,238,0,0.25)]"
                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
            )}
            title={
              highlightMode.isCycle
                ? "Modo Rápido Ativo: 1 clique na palavra cicla as cores até zerar! Clique para modo menu."
                : "Modo Menu: 1 clique abre o menu de formatação. Clique para modo 1-clique."
            }
          >
            <Sparkles className={cn("w-3.5 h-3.5", highlightMode.isCycle ? "text-[#ffee00] animate-pulse" : "text-white/40")} />
            <span className="hidden sm:inline">{highlightMode.isCycle ? '1-CLIQUE: CICLAR' : '1-CLIQUE: MENU'}</span>
          </button>

          {/* Color preview dots */}
          {highlightMode.isCycle && (
            <div 
              className="hidden lg:flex items-center gap-1 bg-black/60 px-2 py-1 rounded-md border border-white/10 text-[10px]"
              title="Ordem do Ciclo: Amarelo ➔ Ciano ➔ Rosa ➔ Verde ➔ Carmim ➔ Zerar"
            >
              <span className="w-2 h-2 rounded-full bg-[#ffee00] shadow-[0_0_4px_#ffee00]" />
              <span className="text-[8px] text-white/30">➔</span>
              <span className="w-2 h-2 rounded-full bg-[#00f5ff] shadow-[0_0_4px_#00f5ff]" />
              <span className="text-[8px] text-white/30">➔</span>
              <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_4px_#fff]" />
              <span className="text-[8px] text-white/30">➔</span>
              <span className="w-2 h-2 rounded-full bg-[#39ff14] shadow-[0_0_4px_#39ff14]" />
              <span className="text-[8px] text-white/30">➔</span>
              <span className="w-2 h-2 rounded-full bg-[#dc143c] shadow-[0_0_4px_#dc143c]" />
              <span className="text-[8px] text-white/30">➔</span>
              <span className="text-[8px] font-mono text-white/40">✖</span>
            </div>
          )}

          {/* Pincel / Quick Marker Brush */}
          <button
            onClick={() => brush.setBrush({ isActive: !brush.isActive })}
            className={cn(
              "px-3 py-1.5 rounded-lg border text-[10px] font-orbitron font-bold tracking-widest flex items-center gap-1.5 transition-all duration-300 active:scale-95 cursor-pointer shrink-0",
              brush.isActive
                ? "bg-[#00f5ff]/15 border-[#00f5ff]/50 text-[#00f5ff] shadow-[0_0_12px_rgba(0,245,255,0.25)]"
                : "bg-white/5 border-white/10 text-white/55 hover:bg-white/10 hover:text-white"
            )}
            title="Ativar/Desativar Marcador de Pincel"
          >
            <Paintbrush className={cn("w-3.5 h-3.5", brush.isActive && "animate-pulse")} />
            <span className="hidden sm:inline">PINCEL</span>
          </button>
        </div>

        {/* Next Button */}
        <button
          onClick={() => goToStep(1)}
          disabled={currentIndex >= sections.length - 1}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl border font-orbitron font-bold text-xs uppercase tracking-wider transition-all cursor-pointer",
            currentIndex >= sections.length - 1 
              ? "opacity-30 border-white/10 text-white/40 cursor-not-allowed" 
              : "border-[var(--sc)] bg-[var(--sc)]/20 hover:bg-[var(--sc)]/35 text-white active:scale-95 shadow-[0_0_20px_var(--sc)]"
          )}
        >
          <span>Próximo</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>

      {/* 6. Overview Grid Modal (Visão Geral - G) */}
      <AnimatePresence>
        {showIndexGrid && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2100] bg-black/90 backdrop-blur-xl p-6 md:p-12 overflow-y-auto flex flex-col"
          >
            <div className="max-w-5xl w-full mx-auto space-y-6 flex-1 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
                <div>
                  <h3 className="font-orbitron font-black text-xl md:text-3xl text-white uppercase tracking-wider">
                    Visão Geral do Sermão
                  </h3>
                  <p className="font-mono text-xs text-white/50 tracking-wider">
                    Clique em qualquer cartão para saltar instantaneamente
                  </p>
                </div>
                <button
                  onClick={() => setShowIndexGrid(false)}
                  className="px-4 py-2 border border-white/20 bg-white/5 hover:bg-white/15 rounded-xl text-white font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  <span>Fechar</span>
                </button>
              </div>

              {/* Grid Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
                {sections.map((sec, idx) => {
                  const isActive = idx === currentIndex;
                  const color = PCOLORS[idx % PCOLORS.length];

                  return (
                    <button
                      key={sec.id}
                      onClick={() => jumpToSection(idx)}
                      style={{
                        borderColor: isActive ? color : 'rgba(255, 255, 255, 0.1)',
                        borderLeftColor: color,
                        borderLeftWidth: '4px',
                        backgroundColor: isActive ? `color-mix(in srgb, ${color} 15%, rgba(255,255,255,0.03))` : 'rgba(255, 255, 255, 0.03)',
                        boxShadow: isActive ? `0 0 25px color-mix(in srgb, ${color} 30%, transparent)` : 'none'
                      }}
                      className={cn(
                        "p-5 rounded-xl text-left border transition-all duration-200 cursor-pointer flex flex-col justify-between group",
                        isActive ? "scale-[1.02]" : "hover:scale-[1.01] hover:border-white/30"
                      )}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span 
                            className="font-mono font-black text-2xl md:text-3xl"
                            style={{ color }}
                          >
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="font-mono text-[10px] tracking-widest uppercase text-white/40 group-hover:text-white/70">
                            {sec.kicker}
                          </span>
                        </div>

                        <h4 className="font-orbitron font-bold text-sm md:text-base text-white uppercase leading-snug">
                          {sec.title}
                        </h4>

                        {sec.text && (
                          <p className="font-rajdhani text-xs text-white/60 line-clamp-3 leading-relaxed">
                            {sec.text}
                          </p>
                        )}
                      </div>

                      {isActive && (
                        <div className="mt-4 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono font-bold" style={{ color }}>
                          <span>SLIDE ATUAL</span>
                          <span>✦</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7. Lightbox for Zooming Cover Image */}
      <AnimatePresence>
        {showLightbox && sermon.img && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLightbox(false)}
            className="fixed inset-0 z-[2200] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 cursor-zoom-out"
          >
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute top-6 right-6 p-3 bg-white/10 border border-white/20 text-white hover:bg-white/20 rounded-full transition-all cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={sermon.img} 
              alt="Capa ampliada" 
              className="max-w-[92vw] max-h-[82vh] object-contain rounded-2xl shadow-2xl border border-white/20" 
            />
            <div className="mt-4 font-orbitron font-bold text-xs tracking-widest uppercase text-white/70">
              {sermon.tema}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
