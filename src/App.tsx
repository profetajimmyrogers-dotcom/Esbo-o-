/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  setDoc,
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, loginWithGoogle, logout } from './firebase';
import { Sermon, OperationType, FirestoreErrorInfo } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus,
  Search, 
  X, 
  Trash2, 
  Play, 
  LogOut, 
  LogIn,
  BookOpen,
  User as UserIcon,
  ChevronUp,
  ChevronDown,
  MessageCircle,
  Menu,
  ChevronLeft,
  ChevronRight,
  Database,
  Clock,
  Sparkles,
  Radio,
  Tag,
  Activity,
  Flame,
  Layers,
  FolderOpen,
  Heart,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  Paintbrush,
  Eraser,
  Check,
  Lock,
  Unlock
} from 'lucide-react';
import { cn } from './lib/utils';
import { HighlightableText } from './components/HighlightableText';
import { PulpitoTopic } from './components/PulpitoTopic';
import { PulpitoSectors } from './components/PulpitoSectors';
import { useBrush } from './lib/brushStore';
import { BrushToolbar } from './components/BrushToolbar';

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // Mostrar alerta visual para o usuário
  if (message.includes('permission-denied') || message.includes('insufficient permissions')) {
    alert('ERRO: Sem permissão para gravar no banco de dados. Verifique a senha ou regras.');
  } else if (message.includes('quota-exceeded')) {
    alert('ERRO: Limite de uso do banco de dados atingido (Quota exceeded).');
  } else {
    alert(`ERRO NO SISTEMA: ${message}`);
  }
}

function PontoItem({ index, total, value, onChange, onRemove, onMove }: { 
  index: number, 
  total: number, 
  value: string, 
  onChange: (val: string) => void, 
  onRemove: () => void,
  onMove: (dir: 'up' | 'down') => void 
}) {
  return (
    <div className="flex gap-2 group">
      <div className="flex flex-col gap-1">
        <button 
          onClick={(e) => { e.preventDefault(); onMove('up'); }}
          disabled={index === 0}
          className="p-1 border border-neon-cyan/20 bg-neon-cyan/5 text-neon-cyan/40 hover:text-neon-cyan disabled:opacity-0 transition-all shrink-0"
          title="Mover para cima"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button 
          onClick={(e) => { e.preventDefault(); onMove('down'); }}
          disabled={index === total - 1}
          className="p-1 border border-neon-cyan/20 bg-neon-cyan/5 text-neon-cyan/40 hover:text-neon-cyan disabled:opacity-0 transition-all shrink-0"
          title="Mover para baixo"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
      <textarea 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-neon-cyan/5 border border-neon-cyan/20 text-neon-cyan p-3 outline-none focus:border-neon-cyan h-auto min-h-[46px]"
        placeholder={`TÓPICO ${index + 1}`}
        translate="no"
        rows={1}
      />
      <button 
        onClick={(e) => { e.preventDefault(); onRemove(); }}
        className="p-3 border border-neon-pink/30 text-neon-pink hover:bg-neon-pink/10 shrink-0 self-center"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

interface FloatingLetter {
  char: string;
  top: string;
  left?: string;
  right?: string;
  color: string;
  shadow: string;
  name: string;
  meaning: string;
  lang: string;
  animClass: string;
}

const DEUS_NAMES_LETTERS: FloatingLetter[] = [
  // ELOHIM (Hebrew)
  { char: 'E', top: '7%', left: '4%', color: '#00f5ff', shadow: '#00f5ff88', name: 'ELOHIM', meaning: 'Deus Criador Supremo', lang: 'Hebraico', animClass: 'animate-short-circuit-1' },
  { char: 'L', top: '15%', left: '8%', color: '#00f5ff', shadow: '#00f5ff88', name: 'ELOHIM', meaning: 'Deus Criador Supremo', lang: 'Hebraico', animClass: 'animate-short-circuit-2' },
  { char: 'O', top: '23%', left: '3%', color: '#00f5ff', shadow: '#00f5ff88', name: 'ELOHIM', meaning: 'Deus Criador Supremo', lang: 'Hebraico', animClass: 'animate-short-circuit-3' },
  { char: 'H', top: '31%', left: '9%', color: '#00f5ff', shadow: '#00f5ff88', name: 'ELOHIM', meaning: 'Deus Criador Supremo', lang: 'Hebraico', animClass: 'animate-short-circuit-1' },
  { char: 'I', top: '39%', left: '5%', color: '#00f5ff', shadow: '#00f5ff88', name: 'ELOHIM', meaning: 'Deus Criador Supremo', lang: 'Hebraico', animClass: 'animate-short-circuit-2' },
  { char: 'M', top: '47%', left: '11%', color: '#00f5ff', shadow: '#00f5ff88', name: 'ELOHIM', meaning: 'Deus Criador Supremo', lang: 'Hebraico', animClass: 'animate-short-circuit-3' },

  // YAHWEH (Hebrew)
  { char: 'Y', top: '10%', left: '26%', color: '#ffffff', shadow: '#ffffff88', name: 'YAHWEH', meaning: 'O Senhor Autoexistente (Eu Sou)', lang: 'Hebraico', animClass: 'animate-short-circuit-2' },
  { char: 'A', top: '20%', left: '30%', color: '#ffffff', shadow: '#ffffff88', name: 'YAHWEH', meaning: 'O Senhor Autoexistente (Eu Sou)', lang: 'Hebraico', animClass: 'animate-short-circuit-3' },
  { char: 'H', top: '30%', left: '25%', color: '#ffffff', shadow: '#ffffff88', name: 'YAHWEH', meaning: 'O Senhor Autoexistente (Eu Sou)', lang: 'Hebraico', animClass: 'animate-short-circuit-1' },
  { char: 'W', top: '40%', left: '32%', color: '#ffffff', shadow: '#ffffff88', name: 'YAHWEH', meaning: 'O Senhor Autoexistente (Eu Sou)', lang: 'Hebraico', animClass: 'animate-short-circuit-2' },
  { char: 'E', top: '50%', left: '27%', color: '#ffffff', shadow: '#ffffff88', name: 'YAHWEH', meaning: 'O Senhor Autoexistente (Eu Sou)', lang: 'Hebraico', animClass: 'animate-short-circuit-3' },
  { char: 'H', top: '60%', left: '33%', color: '#ffffff', shadow: '#ffffff88', name: 'YAHWEH', meaning: 'O Senhor Autoexistente (Eu Sou)', lang: 'Hebraico', animClass: 'animate-short-circuit-1' },

  // ADONAI (Hebrew)
  { char: 'A', top: '55%', left: '6%', color: '#ffee00', shadow: '#ffee0088', name: 'ADONAI', meaning: 'Meu Senhor Soberano', lang: 'Hebraico', animClass: 'animate-short-circuit-3' },
  { char: 'D', top: '63%', left: '12%', color: '#ffee00', shadow: '#ffee0088', name: 'ADONAI', meaning: 'Meu Senhor Soberano', lang: 'Hebraico', animClass: 'animate-short-circuit-1' },
  { char: 'O', top: '71%', left: '3%', color: '#ffee00', shadow: '#ffee0088', name: 'ADONAI', meaning: 'Meu Senhor Soberano', lang: 'Hebraico', animClass: 'animate-short-circuit-2' },
  { char: 'N', top: '79%', left: '10%', color: '#ffee00', shadow: '#ffee0088', name: 'ADONAI', meaning: 'Meu Senhor Soberano', lang: 'Hebraico', animClass: 'animate-short-circuit-3' },
  { char: 'A', top: '87%', left: '5%', color: '#ffee00', shadow: '#ffee0088', name: 'ADONAI', meaning: 'Meu Senhor Soberano', lang: 'Hebraico', animClass: 'animate-short-circuit-1' },
  { char: 'I', top: '95%', left: '11%', color: '#ffee00', shadow: '#ffee0088', name: 'ADONAI', meaning: 'Meu Senhor Soberano', lang: 'Hebraico', animClass: 'animate-short-circuit-2' },

  // THEOS (Greek)
  { char: 'T', top: '8%', right: '5%', color: '#00ff88', shadow: '#00ff8888', name: 'THEOS', meaning: 'O Deus Único e Verdadeiro', lang: 'Grego', animClass: 'animate-short-circuit-1' },
  { char: 'H', top: '16%', right: '11%', color: '#00ff88', shadow: '#00ff8888', name: 'THEOS', meaning: 'O Deus Único e Verdadeiro', lang: 'Grego', animClass: 'animate-short-circuit-2' },
  { char: 'E', top: '24%', right: '4%', color: '#00ff88', shadow: '#00ff8888', name: 'THEOS', meaning: 'O Deus Único e Verdadeiro', lang: 'Grego', animClass: 'animate-short-circuit-3' },
  { char: 'O', top: '32%', right: '10%', color: '#00ff88', shadow: '#00ff8888', name: 'THEOS', meaning: 'O Deus Único e Verdadeiro', lang: 'Grego', animClass: 'animate-short-circuit-1' },
  { char: 'S', top: '40%', right: '6%', color: '#00ff88', shadow: '#00ff8888', name: 'THEOS', meaning: 'O Deus Único e Verdadeiro', lang: 'Grego', animClass: 'animate-short-circuit-2' },

  // KURIOS (Greek)
  { char: 'K', top: '12%', right: '28%', color: '#00f5ff', shadow: '#00f5ff88', name: 'KURIOS', meaning: 'O Senhor Supremo da Vida', lang: 'Grego', animClass: 'animate-short-circuit-3' },
  { char: 'U', top: '22%', right: '23%', color: '#00f5ff', shadow: '#00f5ff88', name: 'KURIOS', meaning: 'O Senhor Supremo da Vida', lang: 'Grego', animClass: 'animate-short-circuit-1' },
  { char: 'R', top: '32%', right: '29%', color: '#00f5ff', shadow: '#00f5ff88', name: 'KURIOS', meaning: 'O Senhor Supremo da Vida', lang: 'Grego', animClass: 'animate-short-circuit-2' },
  { char: 'I', top: '42%', right: '24%', color: '#00f5ff', shadow: '#00f5ff88', name: 'KURIOS', meaning: 'O Senhor Supremo da Vida', lang: 'Grego', animClass: 'animate-short-circuit-3' },
  { char: 'O', top: '52%', right: '30%', color: '#00f5ff', shadow: '#00f5ff88', name: 'KURIOS', meaning: 'O Senhor Supremo da Vida', lang: 'Grego', animClass: 'animate-short-circuit-1' },
  { char: 'S', top: '62%', right: '25%', color: '#00f5ff', shadow: '#00f5ff88', name: 'KURIOS', meaning: 'O Senhor Supremo da Vida', lang: 'Grego', animClass: 'animate-short-circuit-2' },

  // LOGOS (Greek)
  { char: 'L', top: '50%', right: '7%', color: '#ffffff', shadow: '#ffffff88', name: 'LOGOS', meaning: 'A Palavra Viva e Eterna', lang: 'Grego', animClass: 'animate-short-circuit-1' },
  { char: 'O', top: '59%', right: '3%', color: '#ffffff', shadow: '#ffffff88', name: 'LOGOS', meaning: 'A Palavra Viva e Eterna', lang: 'Grego', animClass: 'animate-short-circuit-2' },
  { char: 'G', top: '68%', right: '9%', color: '#ffffff', shadow: '#ffffff88', name: 'LOGOS', meaning: 'A Palavra Viva e Eterna', lang: 'Grego', animClass: 'animate-short-circuit-3' },
  { char: 'O', top: '77%', right: '4%', color: '#ffffff', shadow: '#ffffff88', name: 'LOGOS', meaning: 'A Palavra Viva e Eterna', lang: 'Grego', animClass: 'animate-short-circuit-1' },
  { char: 'S', top: '86%', right: '10%', color: '#ffffff', shadow: '#ffffff88', name: 'LOGOS', meaning: 'A Palavra Viva e Eterna', lang: 'Grego', animClass: 'animate-short-circuit-2' },

  // ALPHA & OMEGA (Greek)
  { char: 'A', top: '4%', left: '44%', color: '#ffee00', shadow: '#ffee0088', name: 'ALPHA_OMEGA', meaning: 'O Alfa e o Ômega (Princípio e Fim)', lang: 'Grego', animClass: 'animate-short-circuit-1' },
  { char: 'Ω', top: '4%', right: '44%', color: '#ffee00', shadow: '#ffee0088', name: 'ALPHA_OMEGA', meaning: 'O Alfa e o Ômega (Princípio e Fim)', lang: 'Grego', animClass: 'animate-short-circuit-3' },
];

// Oculta senhas plaintext no código através de um hash seguro leve unidirecional
const systemHashConfirm = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString();
};

function HeaderClock() {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hidden lg:flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-xs font-mono text-[#CF9D7B]">
      <Clock size={12} className="text-[#CF9D7B] animate-spin-slow" />
      <span className="opacity-80 font-bold">HORÁRIO:</span>
      <span className="text-white font-bold font-orbitron">{currentTime.toLocaleTimeString('pt-BR')}</span>
      <span className="text-white/40">|</span>
      <span className="opacity-80 font-bold">{currentTime.toLocaleDateString('pt-BR')}</span>
    </div>
  );
}

export default function App() {
  const [authorized, setAuthorized] = useState(() => localStorage.getItem('system_auth') === 'true');
  const [passInput, setPassInput] = useState('');
  const [passError, setPassError] = useState(false);
  const [user, setUser] = useState<any>(authorized ? { uid: 'admin', displayName: 'Conferencista' } : null);
  const [loading, setLoading] = useState(false);
  
  // Offline-First: Initialize directly from Local Storage Cache (Hive) for instant load
  const [sermoes, setSermoes] = useState<Sermon[]>(() => {
    try {
      const cached = localStorage.getItem('hive_offline_sermoes');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });

  // Spotify-style Offline Individual Download Engines (HIVE Persistent Local)
  const [downloadedSermonIds, setDownloadedSermonIds] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('downloaded_sermon_ids');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [showOnlyDownloaded, setShowOnlyDownloaded] = useState<boolean>(() => {
    return localStorage.getItem('show_only_downloaded_pref') === 'true';
  });

  const handleToggleDownloadSermon = (sermonId: string) => {
    setDownloadedSermonIds(prev => {
      const next = prev.includes(sermonId)
        ? prev.filter(id => id !== sermonId)
        : [...prev, sermonId];
      localStorage.setItem('downloaded_sermon_ids', JSON.stringify(next));
      return next;
    });
  };

  const handleToggleShowOnlyDownloaded = () => {
    setShowOnlyDownloaded(prev => {
      const next = !prev;
      localStorage.setItem('show_only_downloaded_pref', String(next));
      return next;
    });
  };

  // Connectivity and Synchronization Engine (Hive Local + Firebase cache + Sync model)
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');
  const [isSyncingManual, setIsSyncingManual] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  // Pulpit Readability Configuration for Tablets (Gold standard)
  const [fontSizeIndex, setFontSizeIndex] = useState(1); // 1 = md, 2 = lg, 3 = xl, 4 = 2xl, 5 = 3xl
  const fontSizes = ['text-base md:text-lg', 'text-lg md:text-xl', 'text-xl md:text-2xl', 'text-2xl md:text-3xl', 'text-3xl md:text-4xl'];
  const [autoScrollActive, setAutoScrollActive] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(15); // Speed in ms/pixel scroll loop

  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedSermonId, setSelectedSermonId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [mode, setMode] = useState<'grid' | 'pulpito'>('grid');
  const brush = useBrush();
  
  // New State for Calendar & Sidebar
  const [moonMode, setMoonMode] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const defaultFields = {
    id1: 'LED',
    id2: 'TLL',
    id3: 'St. Petersburg',
    id4: 'JAN 13, 6:15 AM',
    id5: 'Tallinn',
    id6: 'JAN 13, 12:35 PM'
  };
  const [systemFields, setSystemFields] = useState<Record<string, string>>(defaultFields);
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // WhatsApp Lead State
  const [showWhatsAppForm, setShowWhatsAppForm] = useState(false);
  const [waName, setWaName] = useState('');
  const [waChurch, setWaChurch] = useState('');

  // Central Login Modal State
  const [showCentralLoginModal, setShowCentralLoginModal] = useState(false);

  const handleCentralModalLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (systemHashConfirm(passInput) === '1570946') {
      setAuthorized(true);
      setUser({ uid: 'admin', displayName: 'Conferencista' });
      localStorage.setItem('system_auth', 'true');
      setMoonMode(false);
      setShowSidebar(false);
      setShowRightSidebar(false);
      setShowCentralLoginModal(false);
      setPassInput('');
      setPassError(false);
    } else {
      setPassError(true);
      setTimeout(() => setPassError(false), 2000);
    }
  };

  const closeCentralLoginModal = () => {
    setShowCentralLoginModal(false);
    setPassInput('');
    setPassError(false);
  };

  useEffect(() => {
    if (!showCentralLoginModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCentralLoginModal();
      } else if (e.key >= '0' && e.key <= '9') {
        setPassInput(prev => prev + e.key);
      } else if (e.key === 'Backspace') {
        setPassInput(prev => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleCentralModalLogin();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCentralLoginModal, passInput]);

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [flightProgress, setFlightProgress] = useState(() => Number(localStorage.getItem('flight_progress') || '70'));

  const [luxuryParticles, setLuxuryParticles] = useState<any[]>([]);
  const mainTitleRef = useRef<HTMLHeadingElement | null>(null);
  const bgPhotoRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!authorized) {
      const list: any[] = [];
      for (let i = 0; i < 20; i++) {
        const left = `${Math.random() * 70}%`;
        const bottom = '-2%';
        const size = 1.5 + Math.random() * 2.5;
        const duration = `${8 + Math.random() * 14}s`;
        const delay = `${Math.random() * 10}s`;
        const background = Math.random() > 0.6 ? 'rgba(212,175,55,0.6)' : 'rgba(196,30,42,0.5)';
        list.push({ left, bottom, size, duration, delay, background });
      }
      setLuxuryParticles(list);
    }
  }, [authorized]);

  useEffect(() => {
    if (!authorized) {
      let tx = 0, ty = 0, cx = 0, cy = 0;
      let frameRequest: number;

      const handleMouseMove = (e: MouseEvent) => {
        tx = (e.clientX / window.innerWidth - 0.5) * 2;
        ty = (e.clientY / window.innerHeight - 0.5) * 2;
      };

      document.addEventListener('mousemove', handleMouseMove);

      const updatePosition = () => {
        cx += (tx - cx) * 0.04;
        cy += (ty - cy) * 0.04;
        const bg = bgPhotoRef.current;
        if (bg) {
          bg.style.transform = `scale(1.08) translate(${cx * 12}px, ${cy * 8}px)`;
        }
        frameRequest = requestAnimationFrame(updatePosition);
      };

      updatePosition();

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        cancelAnimationFrame(frameRequest);
      };
    }
  }, [authorized]);

  useEffect(() => {
    if (!authorized) {
      const el = mainTitleRef.current;
      if (!el) return;

      const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
      let frameRequest: number;
      let frame = 0;
      let queue: any[] = [];
      let resolvePromise: (() => void) | null = null;

      const updateScramble = () => {
        let out = '';
        let completedCount = 0;
        for (let i = 0; i < queue.length; i++) {
          const item = queue[i];
          if (frame >= item.end) {
            completedCount++;
            out += item.to;
          } else if (frame >= item.start) {
            if (!item.char || Math.random() < 0.28) {
              item.char = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
            }
            out += `<span style="color:rgba(255,255,255,0.35)">${item.char}</span>`;
          } else {
            out += item.from;
          }
        }
        
        if (el) {
          el.innerHTML = out;
        }

        if (completedCount === queue.length) {
          if (resolvePromise) resolvePromise();
        } else {
          frameRequest = requestAnimationFrame(updateScramble);
          frame++;
        }
      };

      const scrambleToText = (targetText: string) => {
        const currentText = el.innerText || '';
        const maxLength = Math.max(currentText.length, targetText.length);
        const promise = new Promise<void>((res) => {
          resolvePromise = res;
        });
        cancelAnimationFrame(frameRequest);
        queue = [];
        frame = 0;
        for (let i = 0; i < maxLength; i++) {
          const start = Math.floor(Math.random() * 30);
          const end = start + Math.floor(Math.random() * 35) + 15;
          queue.push({
            from: currentText[i] || '',
            to: targetText[i] || '',
            start,
            end,
            char: null
          });
        }
        updateScramble();
        return promise;
      };

      let isRunning = false;
      const targetName = 'JIMMY';

      const runInitial = () => {
        if (isRunning) return;
        isRunning = true;
        el.classList.add('resolving');
        scrambleToText(targetName).then(() => {
          setTimeout(() => {
            el.classList.remove('resolving');
            isRunning = false;
          }, 800);
        });
      };

      const runCycle = () => {
        if (isRunning) return;
        isRunning = true;
        const wordPool = ['JEOVA', 'ELOHIM', 'STRONG', 'JESUS', 'KADOSH', 'KING', 'שלום'];
        const shuffled = [...wordPool].sort(() => Math.random() - 0.5);
        const wordsToCycle = [shuffled[0], shuffled[1], targetName];
        let index = 0;

        const nextWord = () => {
          if (index >= wordsToCycle.length) {
            el.classList.remove('resolving');
            isRunning = false;
            return;
          }
          const word = wordsToCycle[index];
          index++;
          if (index === wordsToCycle.length) {
            el.classList.add('resolving');
          }
          scrambleToText(word).then(() => {
            setTimeout(nextWord, 500);
          });
        };

        nextWord();
      };

      // Start the cycle
      const initialTimeout = setTimeout(() => {
        runInitial();
        const cycleInterval = setInterval(runCycle, 15000);
        return () => clearInterval(cycleInterval);
      }, 2200);

      return () => {
        clearTimeout(initialTimeout);
        cancelAnimationFrame(frameRequest);
      };
    }
  }, [authorized]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newProgress = Math.max(2, Math.min(98, Math.round((clickX / width) * 100)));
    setFlightProgress(newProgress);
    localStorage.setItem('flight_progress', String(newProgress));
  };

  
  const selectedSermon = sermoes.find(s => s.id === selectedSermonId) || null;
  
  // Form State
  const [tema, setTema] = useState('');
  const [texto, setTexto] = useState('');
  const [agr, setAgr] = useState('');
  const [img, setImg] = useState('');
  const [intro, setIntro] = useState('');
  const [pontos, setPontos] = useState<{ id: string, text: string }[]>([]);
  const [setores, setSetores] = useState<string[]>([]);
  const [apl, setApl] = useState('');

  // Timer State
  const [tempo, setTempo] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronous web-worker replica network event state loop
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('syncing');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial setup check
    if (!navigator.onLine) {
      setIsOnline(false);
      setSyncStatus('offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
    
    // Agora buscamos todos os sermões (público)
    const q = query(
      collection(db, 'sermoes'), 
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data({ serverTimestamps: 'estimate' }) 
      } as Sermon));
      setSermoes(data);
      
      // Automatic Local persistence (Hive emulation) on every remote pull/sync
      localStorage.setItem('hive_offline_sermoes', JSON.stringify(data));
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    }, (error) => {
      console.warn("Firestore snapshot loaded in offline-cache status.", error);
      setSyncStatus('offline');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    // Load System Settings
    const unsubscribeSettings = onSnapshot(doc(db, 'systemSettings', 'sidebar'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.fields) {
          setSystemFields(prev => {
            const merged = { ...defaultFields, ...prev, ...data.fields };
            // Ensure no empty strings or undefined elements overwrite default keys
            Object.keys(defaultFields).forEach((key) => {
              const k = key as keyof typeof defaultFields;
              if (!merged[k] || String(merged[k]).trim() === '') {
                merged[k] = defaultFields[k];
              }
            });
            return merged;
          });
        }
      }
    });

    // Load Blocked Dates
    const unsubscribeDates = onSnapshot(collection(db, 'blockedDates'), (snapshot) => {
      const dates = snapshot.docs.map(doc => doc.data().dateStr);
      setBlockedDates(dates);
    });

    return () => {
      unsubscribeSettings();
      unsubscribeDates();
    };
  }, []);

  const toggleMoonMode = () => setMoonMode(!moonMode);
  const toggleSidebar = () => setShowSidebar(!showSidebar);

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Robust toggle implementation for Firestore
  const handleDateToggle = async (dateStr: string) => {
    if (!editMode) return;
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        const dayOfWeek = new Date(year, month, day).getDay();
        if (dayOfWeek === 1 || dayOfWeek === 2 || dayOfWeek === 4) {
          alert("Segundas, Terças e Quintas-feiras são dias fixos ocupados/reservados e não podem ser alterados.");
          return;
        }
      }

      const q = query(collection(db, 'blockedDates'), where('dateStr', '==', dateStr));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        // Delete all matching (should be just one)
        const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
      } else {
        await addDoc(collection(db, 'blockedDates'), { dateStr });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [editPassInput, setEditPassInput] = useState('');
  const [showMiniLogin, setShowMiniLogin] = useState(false);
  const [showLockMessage, setShowLockMessage] = useState(false);

  const checkEditAuth = () => {
    if (systemHashConfirm(editPassInput) === '1570946') {
      setEditMode(true);
      alert("Modo Edição Ativado! Clique nos dias do calendário para alternar.");
      setShowMiniLogin(false);
    } else if (systemHashConfirm(editPassInput) === '1599806') {
      setEditMode(false);
      setShowLockMessage(true);
      setTimeout(() => setShowLockMessage(false), 2500);
      setShowMiniLogin(false);
    } else {
      alert("Senha inválida!");
    }
    setEditPassInput('');
  };
  
  const updateSystemField = async (id: string, value: string) => {
    const finalValue = value.trim() === '' ? (defaultFields[id as keyof typeof defaultFields] || '') : value;
    setSystemFields(prev => {
      const newFields = { ...prev, [id]: finalValue };
      setDoc(doc(db, 'systemSettings', 'sidebar'), { fields: newFields }, { merge: true })
        .catch(e => console.error("Error saving setting:", e));
      return newFields;
    });
  };

  const calendarDays = useMemo(() => {
    const date = currentDate;
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const totalDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const today = new Date();
    
    const days = [];
    for (let x = 0; x < firstDay; x++) { days.push(<div key={`empty-${x}`}></div>); }

    for (let i = 1; i <= totalDays; i++) {
        const dateStr = `${date.getFullYear()}-${date.getMonth()}-${i}`;
        const dayOfWeek = new Date(date.getFullYear(), date.getMonth(), i).getDay();
        const isAlwaysBlocked = dayOfWeek === 1 || dayOfWeek === 2 || dayOfWeek === 4;
        const isBlocked = blockedDates.includes(dateStr) || isAlwaysBlocked;
        const isToday = i === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
        
        days.push(
          <div 
            key={i} 
            onClick={() => handleDateToggle(dateStr)}
            title={isBlocked ? (isAlwaysBlocked ? "Ocupado Semanal (Segunda/Terça/Quinta)" : "Reservado / Ocupado") : "Disponível"}
            className={cn(
              "aspect-square flex items-center justify-center rounded-xl text-[11px] font-orbitron font-bold transition-all relative border select-none duration-300",
              isBlocked 
                ? "bg-red-950/25 text-red-500/50 border-red-900/60 hover:bg-red-950/40 hover:border-red-500/40 line-through decoration-red-500/30" 
                : "bg-white/5 text-[#00f5ff] border-transparent hover:border-[#00f5ff]/40 hover:bg-[#00f5ff]/5 hover:shadow-[0_0_8px_rgba(0,245,255,0.2)] vacant cursor-pointer",
              isToday && "bg-[#ff5e00]! text-white! font-black border-transparent shadow-[0_0_15px_rgba(255,94,0,0.6)] ring-1 ring-white/10 scale-[1.03] z-10",
              editMode && "cursor-pointer"
            )}
          >
            {i}
          </div>
        );
    }
    return days;
  }, [currentDate, blockedDates, editMode]);

  useEffect(() => {
    if (mode === 'pulpito') {
      setTempo(0);
      timerRef.current = setInterval(() => {
        setTempo(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImg(reader.result as string);
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setTema('');
    setTexto('');
    setAgr('');
    setImg('');
    setIntro('');
    setPontos([]);
    setSetores([]);
    setApl('');
    setEditId(null);
    setShowForm(false);
  };

  const movePonto = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= pontos.length) return;
    
    setPontos(prev => {
      const items = [...prev];
      const temp = items[index];
      items[index] = items[newIndex];
      items[newIndex] = temp;
      return items;
    });
  };

  const handleSave = async () => {
    if (!user || !tema) return;

    const cleanedPontos = pontos
      .map(p => p.text.trim())
      .filter(p => p !== '');

    const data: any = {
      userId: user.uid,
      tema: tema.trim(),
      texto: texto.trim(),
      agr: agr.trim(),
      img,
      intro: intro.trim(),
      pontos: cleanedPontos,
      setores,
      apl: apl.trim(),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editId) {
        await updateDoc(doc(db, 'sermoes', editId), data);
        alert('REGISTRO ATUALIZADO COM SUCESSO!');
      } else {
        data.createdAt = serverTimestamp();
        data.highlights = {};
        await addDoc(collection(db, 'sermoes'), data);
        alert('NOVO SERMÃO SALVO COM SUCESSO!');
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sermoes');
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await deleteDoc(doc(db, 'sermoes', id));
      if (selectedSermonId === id) setSelectedSermonId(null);
      setShowDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'sermoes');
    }
  };

  const handleEdit = (s: Sermon) => {
    setEditId(s.id!);
    setTema(s.tema);
    setTexto(s.texto);
    setAgr(s.agr);
    setImg(s.img);
    setIntro(s.intro);
    setPontos(s.pontos.map(text => ({ id: Math.random().toString(36).substring(7), text })));
    setSetores(s.setores || []);
    setApl(s.apl);
    setShowForm(true);
    setSelectedSermonId(null);
  };

  const handleHighlight = async (sermonId: string, key: string, color: string) => {
    const sermon = sermoes.find(s => s.id === sermonId);
    if (!sermon) return;

    const newHighlights = { ...(sermon.highlights || {}) };
    if (color) {
      newHighlights[key] = color;
    } else {
      delete newHighlights[key];
    }

    try {
      await updateDoc(doc(db, 'sermoes', sermonId), { highlights: newHighlights });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sermoes/${sermonId}`);
    }
  };

  const handleToggleFavorite = async (sermonId: string) => {
    try {
      const clickedSermon = sermoes.find(s => s.id === sermonId);
      if (!clickedSermon) return;
      
      const newStatus = !clickedSermon.isFavorite;
      
      // Update this sermon's favorite status
      await updateDoc(doc(db, 'sermoes', sermonId), { isFavorite: newStatus });
      
      // If we made this one favorite, unset all other sermons' favorite status to ensure only one "Sermão Do Dia"
      if (newStatus) {
        const otherFavorites = sermoes.filter(s => s.isFavorite && s.id !== sermonId);
        const resetPromises = otherFavorites.map(s => 
          updateDoc(doc(db, 'sermoes', s.id!), { isFavorite: false })
        );
        await Promise.all(resetPromises);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sermoes/${sermonId}`);
    }
  };

  const handleOfflineSync = async () => {
    if (isSyncingManual) return;
    setIsSyncingManual(true);
    setSyncProgress(5);
    setSyncStatus('syncing');

    let progress = 5;
    const interval = setInterval(() => {
      progress += 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        // Save to offline storage as a standard local SQLite/Hive database simulation
        localStorage.setItem('hive_offline_sermoes', JSON.stringify(sermoes));
        localStorage.setItem('hive_sync_time', new Date().toISOString());
        
        // Spotify style: automatically mark all pre-existing sermons as downloaded offline
        const allIds = sermoes.map(s => s.id!).filter(Boolean);
        setDownloadedSermonIds(allIds);
        localStorage.setItem('downloaded_sermon_ids', JSON.stringify(allIds));
        
        setTimeout(() => {
          setIsSyncingManual(false);
          setSyncProgress(0);
          setSyncStatus(navigator.onLine ? 'synced' : 'offline');
        }, 500);
      }
      setSyncProgress(progress);
    }, 110);
  };

  // Pulpit Auto-scroll loop for hands-free reading on physical tablet devices
  useEffect(() => {
    let scrollInterval: any = null;
    if (autoScrollActive && mode === 'pulpito') {
      scrollInterval = setInterval(() => {
        window.scrollBy({ top: 1, behavior: 'auto' });
      }, autoScrollSpeed);
    }
    return () => {
      if (scrollInterval) clearInterval(scrollInterval);
    };
  }, [autoScrollActive, autoScrollSpeed, mode]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (systemHashConfirm(passInput) === '1570946') {
      setAuthorized(true);
      setUser({ uid: 'admin', displayName: 'Conferencista' });
      localStorage.setItem('system_auth', 'true');
      setMoonMode(false);
      setShowSidebar(false);
      setShowRightSidebar(false);
      setPassError(false);
    } else {
      setPassError(true);
      setTimeout(() => setPassError(false), 2000);
    }
  };

  const handleLogout = () => {
    setAuthorized(false);
    setUser(null);
    localStorage.removeItem('system_auth');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-neon-cyan font-orbitron animate-pulse">LOADING SYSTEM...</div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-[#050505] text-white">
        {/* Cinematic Animated Background Image with React Parallax Response */}
        <div className="bg-layer-luxury" aria-hidden="true">
          <img 
            ref={bgPhotoRef}
            src="https://z-cdn-media.chatglm.cn/files/2bc12d5c-ebd1-40e6-8163-b932dcac376d.jpg?auth_key=1880721171-2bb0faa40a0d498f9d87989d84254199-0-afad9fe410a0c084637ce7729aca626f" 
            alt="Jimmy Landscape" 
            className="bg-photo-luxury select-none pointer-events-none" 
          />
        </div>

        {/* Cinematic Underlays, scanning lines, grid */}
        <div className="geo-grid-luxury" aria-hidden="true" />
        <div className="modern-overlay-luxury" aria-hidden="true" />
        <div className="geo-ring-luxury geo-ring-luxury-1" aria-hidden="true" />
        <div className="geo-ring-luxury geo-ring-luxury-2" aria-hidden="true" />
        <div className="geo-ring-luxury geo-ring-luxury-3" aria-hidden="true" />

        {/* Dynamic Spark particles from React state */}
        <div className="particles-luxury" aria-hidden="true">
          {luxuryParticles.map((p, idx) => (
            <div 
              key={`p-lux-${idx}`}
              className="dot-particle-luxury"
              style={{
                left: p.left,
                bottom: p.bottom,
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: p.background,
                animationDuration: p.duration,
                animationDelay: p.delay,
              }}
            />
          ))}
        </div>

        <div className="noise-luxury" aria-hidden="true" />
        <div className="scanlines-luxury" aria-hidden="true" />
        
        {/* Luminous Glow Corners */}
        <div className="corner-light-luxury tl" aria-hidden="true" />
        <div className="corner-light-luxury tr" aria-hidden="true" />
        <div className="corner-light-luxury bl" aria-hidden="true" />
        <div className="corner-light-luxury br" aria-hidden="true" />
        <div className="left-edge-luxury" aria-hidden="true" />

        {/* Systems Indicators & Verses */}
        <span className="deco-verse-luxury bv2 font-space-grotesk font-medium">Sl 91:11 — Aos seus anjos dará ordem a teu respeito, para te guardarem</span>

        {/* Centered Luxury Presentation Title with text scrambling algorithm */}
        <div className="center-content-luxury">
          <div className="title-block-luxury">
            <div className="deco-text-luxury bottom-deco font-space-grotesk font-black text-rose-600/80">JESUS// KING</div>
            <h1 ref={mainTitleRef} className="main-title-luxury text-white transition-all font-outfit select-none" id="mainTitle">
              -----
            </h1>
            <span className="title-underline-luxury" />
            <p className="sub-jp-luxury tracking-[12px] font-medium text-amber-500/80"> אֱלֹהִים </p>
          </div>
        </div>

        {/* Coordinates Lines */}
        <div className="line-h-luxury" aria-hidden="true" />
        <div className="line-v-luxury" aria-hidden="true" />

        {/* Top Active Tag */}
        <div className="top-tag-luxury select-none pointer-events-none">
          <div className="live-dot" />
          <span className="font-outfit text-white">Active</span>
        </div>

        {/* Location Corner Tag */}
        <div className="corner-tag-luxury select-none pointer-events-none">
          <span className="footer-year text-neutral-200">2026</span>
          <span className="footer-main text-neutral-200">CONFERENCISTA &middot; JOINVILLE</span>
        </div>

        <div className={cn("fixed inset-0 transition-all duration-1000 pointer-events-none z-[3]", moonMode ? "bg-black/85" : "bg-transparent")} />
        
        {/* Lock Message */}
        <AnimatePresence>
          {showLockMessage && (
            <motion.div 
              initial={{ opacity: 0, x: '-50%', y: '-50%' }}
              animate={{ opacity: 1, x: '-50%', y: '-50%' }}
              exit={{ opacity: 0, x: '-50%', y: '-50%' }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-8 py-4 rounded-[15px] bg-white/10 backdrop-blur-[20px] border border-white/20 text-white font-bold tracking-[1px] z-[2000]"
            >
              🔒 CONFIGURAÇÕES SALVAS
            </motion.div>
          )}
        </AnimatePresence>

        {/* Event Modal (Centered) */}
        <AnimatePresence>
          {showSidebar && (
            <>
              {/* Backdrop for outside click detection */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSidebar(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1100]"
              />

              {/* Robust Centering Container for Viewport Safety */}
              <div className="fixed inset-0 pointer-events-none flex items-center justify-center p-4 z-[1200]">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="pointer-events-auto p-5 md:p-6 rounded-[24px] w-full max-w-[320px] bg-[#0c0c0e]/95 border border-white/10 shadow-[0_0_50px_rgba(255,170,0,0.12)] backdrop-blur-2xl relative overflow-visible"
                >
                  {/* Close button inside modal container */}
                  <button 
                    onClick={() => setShowSidebar(false)}
                    className="absolute top-4 right-4 p-1.5 text-white/50 hover:text-white transition-colors cursor-pointer rounded-full hover:bg-white/5 border border-transparent outline-none"
                    title="Fechar Evento"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div 
                    onClick={() => setShowMiniLogin(!showMiniLogin)}
                    className="w-1.5 h-1.5 bg-[#ff5e00] rounded-full absolute top-[18px] right-[48px] cursor-pointer shadow-[0_0_8px_#ff5e00] animate-pulse z-10" 
                    title="Acesso Administrador"
                  />
                  
                  <AnimatePresence>
                    {showMiniLogin && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-black/60 rounded-xl p-3 border border-white/10 mb-4 flex gap-2"
                      >
                        <input 
                          type="password" 
                          value={editPassInput}
                          onChange={(e) => setEditPassInput(e.target.value)}
                          placeholder="Senha"
                          className="flex-1 bg-white/80 border-none rounded-md p-1.5 text-[12px] outline-none text-[#222]" 
                        />
                        <button 
                          onClick={checkEditAuth}
                          className="bg-[#ff5e00] border-none text-white rounded-md px-3 py-1 text-[10px] cursor-pointer"
                        >
                          OK
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center gap-3 font-mono text-[32px] text-[#eee] mb-4">
                    <span 
                      contentEditable={editMode}
                      onBlur={(e) => updateSystemField('id1', e.currentTarget.innerText)}
                      suppressContentEditableWarning
                      className={cn("outline-none transition-all", editMode && "border-b border-dashed border-[#ff5e00]")}
                    >
                      {systemFields.id1}
                    </span>
                    <span className="text-[#555] text-[20px]">→</span>
                    <span 
                      contentEditable={editMode}
                      onBlur={(e) => updateSystemField('id2', e.currentTarget.innerText)}
                      suppressContentEditableWarning
                      className={cn("outline-none transition-all", editMode && "border-b border-dashed border-[#ff5e00]")}
                    >
                      {systemFields.id2}
                    </span>
                  </div>

                  <div className="flex justify-between text-[12px] text-[#aaa] mb-4">
                    <div>
                      <b 
                        contentEditable={editMode}
                        onBlur={(e) => updateSystemField('id3', e.currentTarget.innerText)}
                        suppressContentEditableWarning
                        className={cn("outline-none transition-all block", editMode && "border-b border-dashed border-[#ff5e00]")}
                      >
                        {systemFields.id3}
                      </b>
                      <small 
                        contentEditable={editMode}
                        onBlur={(e) => updateSystemField('id4', e.currentTarget.innerText)}
                        suppressContentEditableWarning
                        className={cn("outline-none transition-all block", editMode && "border-b border-dashed border-[#ff5e00]")}
                      >
                        {systemFields.id4}
                      </small>
                    </div>
                    <div className="text-right">
                      <b 
                        contentEditable={editMode}
                        onBlur={(e) => updateSystemField('id5', e.currentTarget.innerText)}
                        suppressContentEditableWarning
                        className={cn("outline-none transition-all block", editMode && "border-b border-dashed border-[#ff5e00]")}
                      >
                        {systemFields.id5}
                      </b>
                      <small 
                        contentEditable={editMode}
                        onBlur={(e) => updateSystemField('id6', e.currentTarget.innerText)}
                        suppressContentEditableWarning
                        className={cn("outline-none transition-all block", editMode && "border-b border-dashed border-[#ff5e00]")}
                      >
                        {systemFields.id6}
                      </small>
                    </div>
                  </div>

                  {/* Luxury Interactive Flight Progress Track */}
                  <div className="mt-6 space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-orbitron tracking-[2px]">
                      <span className="text-[#a2ff00] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                        VOO EM CURSO
                      </span>
                      <span className="text-white/80 font-mono font-bold">{flightProgress}%</span>
                    </div>

                    <div 
                      onClick={handleProgressClick}
                      className="w-full h-2.5 bg-[#141414] rounded-full relative cursor-pointer border border-white/10 shadow-inner group/track"
                      title="Clique para ajustar o progresso do voo"
                    >
                      {/* Glowing active path track with luxury multi-color letters flow */}
                      <div 
                        style={{ width: `${flightProgress}%` }} 
                        className="h-full luxury-progress-track rounded-full relative transition-all duration-700 ease-out shadow-[0_0_12px_rgba(0,245,255,0.4)]"
                      >
                        {/* Sub-trail particle mist */}
                        <span className="absolute right-2 top-0 bottom-0 w-8 bg-gradient-to-l from-white/40 to-transparent blur-[2px]" />
                      </div>

                      {/* Luxurious Interactive Airplane Node */}
                      <div 
                        style={{ left: `${flightProgress}%` }}
                        className="absolute -top-3.5 -translate-x-1/2 transition-all duration-700 ease-out z-20 pointer-events-none"
                      >
                        {/* Multi-layered luxury reactive halos */}
                        <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#00f5ff] to-[#ffffff] opacity-40 blur-[8px] animate-pulse" />
                        <span className="absolute -inset-2.5 rounded-full bg-[#00f5ff]/20 opacity-30 blur-[12px] animate-engine-glow" />

                        {/* Floating Airplane Sphere */}
                        <div 
                          className="w-[34px] h-[34px] rounded-full bg-black/90 border-[2px] border-white/90 flex items-center justify-center text-[15px] text-white shadow-[0_0_15px_var(--glow-color,#00f5ff)] relative transform animate-airplane-fly select-none"
                          style={{ '--glow-color': flightProgress < 25 ? '#00f5ff' : flightProgress < 50 ? '#ffffff' : flightProgress < 75 ? '#ffee00' : '#00ff88' } as React.CSSProperties}
                        >
                          {/* Glow indicator corresponding to background color of letters */}
                          <span 
                            className="absolute inset-[2px] rounded-full opacity-10 transition-colors duration-500" 
                            style={{ backgroundColor: flightProgress < 25 ? '#00f5ff' : flightProgress < 50 ? '#ffffff' : flightProgress < 75 ? '#ffee00' : '#00ff88' }}
                          />
                          <span className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">✈</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between text-[8px] text-white/45 tracking-widest font-mono uppercase">
                      <span>PARTIDA ({systemFields.id1})</span>
                      <span>CHEGADA ({systemFields.id2})</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>
         {/* Elegant Menu Drawer Toggle in place of 'Minha Agenda' */}
        <button 
          onClick={() => setShowRightSidebar(!showRightSidebar)}
          className={cn(
            "fixed top-5 right-5 group flex items-center gap-2.5 pl-2 pr-4.5 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 z-[1001] transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer outline-none select-none text-left shadow-[0_0_15px_rgba(0,245,255,0.15)] hover:shadow-[0_0_20px_rgba(0,245,255,0.25)]",
            showRightSidebar ? "border-[#00f5ff]/50 shadow-[0_0_25px_rgba(0,245,255,0.3)] bg-black/85" : "hover:border-[#00f5ff]/40"
          )}
        >
          <div className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 text-xs bg-[#0c0c0e]/80 border border-white/15 shadow-inner group-hover:border-[#00f5ff]/60">
            {showRightSidebar ? (
              <X className="w-3 h-3 text-[#00f5ff]" />
            ) : (
              <Menu className="w-3 h-3 text-[#00f5ff]" />
            )}
          </div>
          <div className="flex flex-col select-none pr-1">
            <span className="text-[7.5px] text-[#00f5ff] font-extrabold uppercase tracking-[0.14em] leading-none mb-0.5 animate-pulse">MENU & LOGIN</span>
            <span className="text-white text-[9px] font-orbitron font-extrabold uppercase tracking-[1.3px] leading-none">CONFERENCISTA</span>
          </div>
          {/* Glowing cursor ring helper on hover */}
          <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-[#00f5ff]/20 to-[#ffffff]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 -z-10" />
        </button>

        {/* Right Discrete Thin Drawer (Gaveta Sanfonada Compacta) */}
        <AnimatePresence>
          {showRightSidebar && (
            <>
              {/* Invisible Click-Outside Overlay */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowRightSidebar(false)}
                className="fixed inset-0 bg-black/20 backdrop-blur-[3px] z-[1000]"
              />

              {/* Gaveta Sanfonada Modificada: Wider and including integrated Login Section */}
              <motion.div 
                initial={{ opacity: 0, y: -10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
                className={cn(
                  "fixed right-5 top-[64px] w-[215px] bg-[#0c0c0e]/95 backdrop-blur-2xl border p-3 rounded-[20px] z-[1000] flex flex-col gap-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_20px_rgba(0,245,255,0.08)] overflow-hidden transition-all duration-200",
                  passError 
                    ? "animate-card-shake border-red-500/80 shadow-[0_0_35px_rgba(239,68,68,0.4)] bg-red-950/20" 
                    : "border-white/10"
                )}
              >
                {/* Decorative Accordion Bellow Lines */}
                <div className="flex items-center justify-between px-1 border-b border-white/5 pb-1.5">
                  <span className="text-[7px] text-white/40 font-mono tracking-[0.2em] uppercase font-bold">// MENU PORTAL</span>
                  <div className="flex gap-[1.5px]">
                    <span className="w-[1.5px] h-1 bg-[#00f5ff]/30 rounded-full animate-pulse" />
                    <span className="w-[1.5px] h-1.5 bg-[#00f5ff]/50 rounded-full animate-pulse [animation-delay:0.1s]" />
                    <span className="w-[1.5px] h-1 bg-[#00f5ff]/30 rounded-full animate-pulse [animation-delay:0.2s]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* WhatsApp Button inside Dropdown */}
                  <button 
                    onClick={() => {
                      setShowWhatsAppForm(true);
                      setShowRightSidebar(false);
                    }}
                    className="group flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-[#121214]/65 hover:bg-[#151d18]/80 border border-white/[0.04] hover:border-green-500/40 transition-all duration-200 active:scale-95 cursor-pointer outline-none select-none text-center shadow-inner"
                  >
                    <div className="relative w-5 h-5 rounded-full flex items-center justify-center bg-green-500/10 text-green-400 shrink-0">
                      <span className="absolute inset-0 rounded-full bg-green-400 opacity-15 blur-[1px] animate-pulse" />
                      <MessageCircle className="w-3 h-3 fill-current relative z-10" />
                    </div>
                    <div className="flex flex-col items-center select-none">
                      <span className="text-[5.5px] text-green-300 font-extrabold uppercase tracking-[0.1em] leading-none mb-0.5">Falar</span>
                      <span className="text-white text-[7.5px] font-orbitron font-extrabold uppercase tracking-[0.5px] leading-none">WhatsApp</span>
                    </div>
                  </button>

                  {/* Minha Agenda (Moon/Calendar Mode) Button inside Dropdown */}
                  <button 
                    onClick={() => {
                      toggleMoonMode();
                      setShowRightSidebar(false);
                    }}
                    className={cn(
                      "group flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer outline-none select-none text-center bg-[#121214]/65 shadow-inner",
                      moonMode 
                        ? "border-[#00f5ff]/50 bg-cyan-950/30" 
                        : "border-white/[0.04] hover:border-[#00f5ff]/40 hover:bg-[#11181c]/80"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center transition-all duration-700 text-[10px] bg-white/5 border border-white/5 shrink-0",
                      moonMode && "rotate-[360deg] bg-cyan-500/10 border-[#00f5ff]/20"
                    )}>
                      <span className="relative z-10">{moonMode ? '🌕' : '🌙'}</span>
                    </div>
                    <div className="flex flex-col items-center select-none">
                      <span className="text-[5.5px] text-[#00f5ff] font-extrabold uppercase tracking-[0.1em] leading-none mb-0.5">Consultar</span>
                      <span className="text-white text-[7.5px] font-orbitron font-extrabold uppercase tracking-[0.5px] leading-none">Agenda</span>
                    </div>
                  </button>

                  {/* Event (Voo/Local) Button inside Dropdown */}
                  <button 
                    onClick={() => {
                      setShowSidebar(true);
                      setShowRightSidebar(false);
                    }}
                    className={cn(
                      "group flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer outline-none select-none text-center bg-[#121214]/65 shadow-inner",
                      showSidebar 
                        ? "border-[#ffaa00]/50 bg-amber-950/30" 
                        : "border-white/[0.04] hover:border-[#ffaa00]/45 hover:bg-[#1c160a]/80"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center transition-all duration-700 text-[10px] bg-white/5 border border-white/5 shrink-0 text-amber-400",
                      showSidebar && "rotate-[360deg] bg-amber-500/10 border-[#ffaa00]/20"
                    )}>
                      <Sparkles className="w-3 h-3" />
                    </div>
                    <div className="flex flex-col items-center select-none">
                      <span className="text-[5.5px] text-amber-400 font-extrabold uppercase tracking-[0.1em] leading-none mb-0.5 font-bold">Próximo</span>
                      <span className="text-white text-[7.5px] font-orbitron font-extrabold uppercase tracking-[0.5px] leading-none">Evento</span>
                    </div>
                  </button>

                  {/* Login (Padlock Slider) Button inside Dropdown */}
                  <button 
                    onClick={() => {
                      if (authorized) {
                        handleLogout();
                      } else {
                        setShowCentralLoginModal(true);
                      }
                      setShowRightSidebar(false);
                    }}
                    className={cn(
                      "group flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer outline-none select-none text-center bg-[#121214]/65 shadow-inner",
                      authorized 
                        ? "border-green-500/40 bg-green-950/20" 
                        : "border-white/[0.04] hover:border-amber-500/45 hover:bg-[#1a130c]/80"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center transition-all duration-700 text-[10px] bg-white/5 border border-white/5 shrink-0",
                      authorized ? "text-green-400 bg-green-500/10 border-green-500/30" : "text-amber-500 bg-amber-500/10 border-white/5"
                    )}>
                      {authorized ? <Unlock className="w-3 h-3 text-green-400" /> : <Lock className="w-3 h-3 text-amber-500" />}
                    </div>
                    <div className="flex flex-col items-center select-none">
                      <span className="text-[5.5px] text-white/50 font-extrabold uppercase tracking-[0.1em] mb-0.5 font-bold">
                        {authorized ? "Online" : "Acesso"}
                      </span>
                      <span className="text-white text-[7.5px] font-orbitron font-extrabold uppercase tracking-[0.5px]">
                        {authorized ? "Sair" : "Login"}
                      </span>
                    </div>
                  </button>
                </div>

                {/* Single clean line at the bottom to stay lightweight */}
                <div className="border-t border-white/5 pt-2 mt-1 text-center">
                  {authorized ? (
                    <div className="space-y-1.5 px-0.5 text-left pb-0.5">
                      <div className="flex items-center gap-1.5 px-1 pb-0.5">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#00f5ff]/10 border border-[#00f5ff]/30 flex items-center justify-center text-[7.5px] text-[#00f5ff] font-bold pb-0.5">
                          ✓
                        </div>
                        <div className="flex flex-col flex-1">
                          <span className="text-[6.5px] text-white/40 uppercase font-mono tracking-[0.14em] leading-none">
                            Autenticado
                          </span>
                          <span className="text-[#00f5ff] text-[8.5px] font-orbitron font-extrabold uppercase tracking-[1.2px] leading-none mt-0.5">
                            MINISTRO ATIVO
                          </span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => {
                          handleLogout();
                          setShowRightSidebar(false);
                        }}
                        className="w-full py-1.5 px-2.5 rounded-xl block font-orbitron font-extrabold text-[8px] uppercase tracking-[1.2px] transition-all duration-200 active:scale-[0.96] select-none text-white bg-red-950/40 border border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 cursor-pointer shadow-md text-center"
                      >
                        <span className="flex items-center justify-center gap-1">
                          <span>DESCONECTAR</span>
                          <span className="text-[8px] opacity-85">✖</span>
                        </span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-[5.5px] font-mono tracking-widest text-white/15 uppercase block py-0.5">SISTEMA SEGURO</span>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* WhatsApp Backdrop */}
        <AnimatePresence>
          {showWhatsAppForm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWhatsAppForm(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1500]"
            />
          )}
        </AnimatePresence>

        {/* WhatsApp Lead Form Modal */}
        <AnimatePresence>
          {showWhatsAppForm && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
              exit={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }}
              className="fixed top-1/2 left-1/2 z-[2000] p-6 rounded-[24px] w-[90%] max-w-[320px] bg-[#0f0f0f]/95 border border-white/10 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-white font-orbitron font-bold text-lg leading-tight">CONTATO</h3>
                  <p className="text-[10px] text-green-400 font-black tracking-widest uppercase mt-0.5">// WHATSAPP DIRETO</p>
                </div>
                <button 
                  onClick={() => setShowWhatsAppForm(false)}
                  className="p-2 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/50 uppercase font-black tracking-widest ml-1">Seu Nome</label>
                  <input 
                    type="text"
                    value={waName}
                    onChange={(e) => setWaName(e.target.value)}
                    placeholder="Ex: João Silva"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-green-500/50 transition-all font-rajdhani"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/50 uppercase font-black tracking-widest ml-1">Sua Igreja</label>
                  <input 
                    type="text"
                    value={waChurch}
                    onChange={(e) => setWaChurch(e.target.value)}
                    placeholder="Ex: Igreja Central"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-green-500/50 transition-all font-rajdhani"
                  />
                </div>

                <button 
                  onClick={() => {
                    if (!waName || !waChurch) {
                      alert("Por favor, preencha todos os campos.");
                      return;
                    }
                    const text = encodeURIComponent(`A Paz do senhor Jesus! me chamo ${waName} sou da igreja ${waChurch}, gostaria de agendar uma data para o irmão está pregando aqui.`);
                    window.open(`https://wa.me/5547988997312?text=${text}`, '_blank');
                    setShowWhatsAppForm(false);
                  }}
                  className="w-full mt-2 bg-green-600 hover:bg-green-500 text-white font-orbitron font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(37,211,102,0.3)] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                >
                  <MessageCircle className="w-4 h-4" />
                  Iniciar Conversa
                </button>
                
                <p className="text-[9px] text-white/30 text-center italic mt-2">
                  * Campos obrigatórios para iniciar o atendimento.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Central Luxury Slider Login Modal */}
        <AnimatePresence>
          {showCentralLoginModal && (
            <>
              {/* Overlay background dim with Blur */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeCentralLoginModal}
                className="fixed inset-0 bg-black/75 backdrop-blur-md z-[1600]"
                id="centralLoginOverlay"
              />

              {/* Centered Login Modal in same position as Calendar */}
              <div className="fixed inset-0 pointer-events-none flex items-center justify-center p-4 z-[1700]">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className={cn(
                    "pointer-events-auto p-4 rounded-[20px] w-full max-w-[215px] bg-[#0c0c0e]/95 border transition-all duration-350 shadow-[0_20px_50px_rgba(0,0,0,0.95)] backdrop-blur-2xl flex flex-col items-center gap-3 relative overflow-visible",
                    passError 
                      ? "border-red-500/40 shadow-[0_0_50px_rgba(239,68,68,0.35)] animate-card-shake" 
                      : "border-white/10"
                  )}
                  id="centralLoginModal"
                >
                  {/* Close modal action */}
                  <button 
                    onClick={closeCentralLoginModal}
                    className="absolute top-3 right-3 text-white/40 hover:text-white pb-0.5 rounded-full hover:bg-white/5 transition-all outline-none cursor-pointer w-6 h-6 flex items-center justify-center border border-white/5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-10 h-10 rounded-full bg-amber-500/5 border border-amber-500/20 flex items-center justify-center mt-1 shadow-[0_0_15px_rgba(245,158,11,0.03)]">
                    <Lock className={cn("w-4 h-4 transition-all duration-500", passError ? "text-red-400 animate-bounce" : "text-amber-500")} />
                  </div>

                  {/* Header context */}
                  <div className="text-center w-full">
                    <h3 className="font-orbitron font-bold text-[10px] tracking-[2px] text-white/90 uppercase">
                      Acesso do Ministro
                    </h3>
                    <p className={cn(
                      "text-[6.5px] font-mono tracking-[2px] uppercase mt-0.5 transition-colors duration-300",
                      passError ? "text-red-400 animate-pulse" : "text-amber-500/85"
                    )}>
                      {passError ? "// COMBINAÇÃO INCORRETA" : "// DIGITE SUA SENHA"}
                    </p>
                  </div>

                  {/* Input form with readOnly input to suppress virtual keyboard */}
                  <form onSubmit={handleCentralModalLogin} className="w-full space-y-3">
                    <div className="relative group/input">
                      <input 
                        type="password"
                        value={passInput}
                        onChange={(e) => setPassInput(e.target.value)}
                        placeholder="SENHA..."
                        readOnly={true}
                        className={cn(
                          "w-full p-2.5 rounded-xl border bg-black/80 text-white font-rajdhani outline-none text-center text-xs tracking-[4px] uppercase transition-all duration-300 focus:bg-black cursor-default",
                          passError 
                            ? "border-red-500/40 focus:border-red-500 text-red-300 placeholder-red-500/50" 
                            : "border-white/10 focus:border-[#00f5ff]/70 focus:shadow-[0_0_12px_rgba(0,245,255,0.25)]"
                        )}
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={!passInput}
                      className={cn(
                        "w-full py-2.5 px-3 rounded-xl relative overflow-hidden font-orbitron font-extrabold text-[9px] uppercase tracking-[1.5px] transition-all duration-300 active:scale-[0.96] select-none group/btn shadow-md",
                        passInput
                          ? "text-black bg-white hover:text-white cursor-pointer"
                          : "text-white/30 bg-white/5 border border-white/10 pointer-events-none"
                      )}
                    >
                      {passInput && (
                        <span 
                          className="absolute inset-x-0 top-0 bottom-0 bg-[#00f5ff]/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" 
                        />
                      )}
                      
                      <span className="relative z-10 flex items-center justify-center gap-1">
                        <span>CONFIRMAR</span>
                        <span className="text-[9px] opacity-80 group-hover/btn:translate-x-1 transition-transform duration-300">➜</span>
                      </span>
                    </button>
                  </form>

                  {/* Tactile Keypad grid below the capsule lock */}
                  <div className="grid grid-cols-3 gap-1.5 w-full max-w-[170px] mt-0.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <button 
                        key={`keypad-${num}`}
                        type="button"
                        onClick={() => setPassInput(prev => prev + num.toString())}
                        className="h-7 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 active:border-white/15 text-white font-orbitron font-bold text-[10px] transition-all duration-100 flex items-center justify-center cursor-pointer select-none outline-none"
                      >
                        {num}
                      </button>
                    ))}
                    <button 
                      type="button"
                      onClick={() => {
                        setPassInput('');
                      }}
                      className="h-7 rounded-lg bg-red-950/20 hover:bg-red-950/35 active:scale-95 border border-red-500/10 hover:border-red-500/25 text-red-400 font-orbitron font-bold text-[7.5px] uppercase transition-all duration-100 flex items-center justify-center cursor-pointer select-none outline-none"
                    >
                      LIMPAR
                    </button>
                    <button 
                      type="button"
                      onClick={() => setPassInput(prev => prev + '0')}
                      className="h-7 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 active:border-white/15 text-white font-orbitron font-bold text-[10px] transition-all duration-100 flex items-center justify-center cursor-pointer select-none outline-none"
                    >
                      0
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setPassInput(prev => prev.slice(0, -1));
                      }}
                      className="h-7 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 active:border-white/12 text-white font-orbitron font-bold text-[10px] transition-all duration-100 flex items-center justify-center cursor-pointer select-none outline-none"
                    >
                      ⌫
                    </button>
                  </div>

                  <p className="text-[5.5px] font-space-grotesk tracking-[1px] text-white/30 text-center uppercase leading-none mt-0.5">
                    SUPORTA TECLADO FÍSICO E TOUCH SCREEN
                  </p>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>

        {/* Calendar */}
        <AnimatePresence>
          {moonMode && (
            <>
              {/* Backdrop for outside click detection */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMoonMode(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-md z-[499]"
              />

              {/* Robust Centering Container for Viewport Safety */}
              <div className="fixed inset-0 pointer-events-none flex items-center justify-center p-4 z-[500]">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="pointer-events-auto p-4 rounded-[24px] w-full max-w-[285px] bg-[#0c0c0e]/95 border border-white/10 shadow-[0_0_50px_rgba(0,245,255,0.12)] backdrop-blur-2xl relative overflow-visible"
                >
                  {/* Admin Mode Floating Badge */}
                  {editMode && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white font-mono text-[7px] tracking-[2.5px] px-3 py-1 rounded-full uppercase border border-red-500 shadow-md animate-pulse whitespace-nowrap z-50 font-bold">
                      // MODO EDITOR ATIVO
                    </div>
                  )}

                  {/* Header with Navigation */}
                  <div className="flex justify-between items-center mb-3.5 px-1">
                    <button 
                      onClick={handlePrevMonth}
                      className="w-7 h-7 rounded-full border border-white/5 bg-white/5 flex items-center justify-center cursor-pointer transition-all duration-300 hover:border-[#00f5ff]/30 hover:bg-[#00f5ff]/5 hover:text-[#00f5ff] text-white/50 active:scale-90"
                      title="Mês Anterior"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex flex-col items-center">
                      <span className="font-orbitron tracking-[3px] uppercase text-[10px] sm:text-xs font-extrabold text-white text-center select-none">
                        {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                      </span>
                    </div>

                    <button 
                      onClick={handleNextMonth}
                      className="w-7 h-7 rounded-full border border-white/5 bg-white/5 flex items-center justify-center cursor-pointer transition-all duration-300 hover:border-[#00f5ff]/30 hover:bg-[#00f5ff]/5 hover:text-[#00f5ff] text-white/50 active:scale-90"
                      title="Próximo Mês"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Calendar Days Table */}
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                      <div 
                        key={`${d}-${i}`} 
                        className="text-white/40 text-[8px] font-black font-orbitron tracking-[1px] pb-1.5 uppercase flex justify-center items-center"
                      >
                        {d}
                      </div>
                    ))}
                    {calendarDays}
                  </div>

                  {/* Minimalist Visual Legend / Footer info */}
                  <div className="mt-4 pt-2.5 border-t border-white/5 flex justify-center items-center gap-4 text-[7px] font-mono tracking-widest text-[#00f5ff]/60 select-none uppercase">
                    <div className="flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-[#00f5ff]" />
                      <span>Vago</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-red-600" />
                      <span>Reservado</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-[#ff5e00]" />
                      <span>Hoje</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>

        {/* Purely Artistic Luxurious Minimalist Footer Signature empty container */}
        <div className="flex flex-col items-center justify-end min-h-screen pb-16 px-4 z-10 pointer-events-none" />
      </div>
    );
  }

  const filteredSermoes = sermoes.filter(s => {
    const matchesSearch = s.tema.toLowerCase().includes(busca.toLowerCase());
    if (showOnlyDownloaded) {
      return matchesSearch && s.id && downloadedSermonIds.includes(s.id);
    }
    return matchesSearch;
  });

  return (
    <div className="min-h-screen relative z-10 pb-20 transition-all duration-1000 bg-[#0C1519]" translate="no">
      {/* Immersive Dark Jungle Luxury Background Overlay */}
      <div className="absolute inset-0 bg-radial from-[#121c22]/40 via-transparent to-transparent pointer-events-none -z-10" />

      {/* Modern Luxury Navigation Header */}
      <header className="header flex flex-col md:flex-row justify-between items-center p-4 md:p-6 border-b border-white/5 bg-gradient-to-b from-black/80 to-[#0C1519]/20 backdrop-blur-md mb-8 relative z-50">
        <div className="text-center md:text-left flex flex-col md:flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#CF9D7B] via-[#724B39] to-transparent p-[1px] flex items-center justify-center shadow-[0_0_20px_rgba(207,157,123,0.15)]">
            <div className="w-full h-full bg-[#0C1519] rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#CF9D7B] animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-orbitron font-black text-white hover:text-[#CF9D7B] transition-colors tracking-widest uppercase">
              PLENITUDE PÚLPITO
            </h1>
            <p className="font-rajdhani tracking-[0.4em] text-[#CF9D7B] text-[9px] font-bold">
              ✥ MASTER CONFERÊNCIA DATABASE v4.0
            </p>
          </div>
        </div>

        {/* Dynamic Center Real-time Clock */}
        <HeaderClock />
        
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <div className={cn(
            "flex items-center gap-2 border bg-white/5 px-4 py-1.5 rounded-lg text-[10px] font-mono font-bold leading-none select-none",
            isOnline 
              ? "border-emerald-500/20 text-emerald-400" 
              : "border-amber-500/30 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
          )}>
            <span className="relative flex h-2 w-2">
              <span className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                isOnline ? "bg-emerald-400" : "bg-amber-400"
              )}></span>
              <span className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                isOnline ? "bg-emerald-500" : "bg-amber-500"
              )}></span>
            </span>
            <span className="uppercase font-orbitron tracking-widest">
              {isOnline ? 'CONEXÃO ATIVA' : 'HIVE OFFLINE'}
            </span>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2.5 bg-red-950/20 border border-red-500/30 text-red-400 hover:text-white hover:bg-red-500/30 hover:border-red-500/80 rounded-lg transition-all cursor-pointer shadow-lg"
            title="Sair do Sistema"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 space-y-10">
        {mode === 'grid' ? (
          <>


            {/* Cinematic Featured Highlight Showcase Banner (Bloodhound/Zeus-X inspire) */}
            {sermoes.length > 0 && (
              (() => {
                const featured = sermoes.find(s => s.isFavorite) || sermoes[0];
                return (
                  <div className="relative bg-[#162127]/40 border border-[#CF9D7B]/20 rounded-2xl p-6 md:p-8 overflow-hidden shadow-2xl group/hero hover:border-[#CF9D7B]/40 duration-500">
                    {/* Atmospheric Ambient Cover Tint */}
                    {featured.img && (
                      <div 
                        className="absolute inset-0 opacity-[0.06] bg-cover bg-center blur-sm scale-105 pointer-events-none select-none duration-1000 group-hover/hero:scale-100"
                        style={{ backgroundImage: `url(${featured.img})` }}
                      />
                    )}
                    
                    <div className="flex flex-col lg:flex-row gap-8 items-center relative z-10">
                      {/* Left Block - Title Content */}
                      <div className="flex-1 space-y-4 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 bg-[#CF9D7B]/10 border border-[#CF9D7B]/35 px-4 py-1.5 rounded-full text-[10px] font-orbitron font-bold text-[#CF9D7B] tracking-widest uppercase">
                          <Heart size={12} className={cn("text-[#ff2a5f] animate-pulse fill-[#ff2a5f]", !featured.isFavorite && "opacity-60")} />
                          <span>{featured.isFavorite ? 'SERMÃO DO DIA (SELECIONADO)' : 'SERMÃO DO DIA (PADRÃO)'}</span>
                        </div>

                        <h2 className="text-3xl md:text-5xl lg:text-6xl font-orbitron font-black text-white leading-tight uppercase tracking-tight group-hover/hero:text-[#CF9D7B] duration-500" translate="no">
                          {featured.tema}
                        </h2>

                        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                          <div className="bg-white/5 border border-white/10 text-[#ffee00] text-xs font-mono font-bold px-3 py-1 rounded flex items-center gap-2 shadow-sm">
                            <BookOpen size={13} />
                            <span>{featured.texto || '// REGISTRO SEM BASE'}</span>
                          </div>
                          
                          {featured.setores && featured.setores.map((setor, idx) => (
                            <span key={idx} className="bg-[#0C1519]/60 border border-white/10 text-[#CF9D7B] text-[9.5px] font-mono px-2.5 py-0.5 rounded-md uppercase font-bold tracking-wider">
                              {setor}
                            </span>
                          ))}
                        </div>

                        {featured.intro && (
                          <p className="text-text-mid text-sm font-rajdhani line-clamp-2 max-w-2xl leading-relaxed mx-auto lg:mx-0">
                            {featured.intro}
                          </p>
                        )}

                        {/* Grand Luxury Preach Button */}
                        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-3">
                          <button
                            onClick={() => {
                              setSelectedSermonId(featured.id!);
                              setMode('pulpito');
                            }}
                            className="bg-gradient-to-r from-[#CF9D7B] to-[#724B39] text-white px-7 py-3 rounded-lg font-orbitron font-black text-[11px] tracking-[0.2em] hover:shadow-[0_0_30px_rgba(207,157,123,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 pointer-events-auto cursor-pointer"
                          >
                            ✦ INICIAR NO PÚLPITO IMPERIAL
                          </button>
                          
                          <button
                            onClick={() => setSelectedSermonId(featured.id!)}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/90 px-6 py-3 rounded-lg font-orbitron font-bold text-[10px] tracking-widest hover:border-white/30 transition-all cursor-pointer"
                          >
                            DETALHES COMPLETOS
                          </button>
                        </div>
                      </div>

                      {/* Right Block - Art Mockup with Perspective Glass */}
                      <div className="w-full lg:w-auto shrink-0 relative flex justify-center">
                        <div className="relative w-64 h-40 bg-[#0C1519] border border-[#CF9D7B]/20 rounded-2xl shadow-2xl overflow-hidden group-hover/hero:scale-[1.03] transition-all duration-500">
                          {featured.img ? (
                            <img 
                              src={featured.img} 
                              className="w-full h-full object-cover transition-transform duration-700 group-hover/hero:scale-110" 
                              alt="Poster"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#162127] to-[#0C1519] flex items-center justify-center p-4">
                              <Sparkles className="w-12 h-12 text-white/20 animate-pulse" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent flex flex-col justify-end p-4">
                            <span className="text-[9px] font-mono text-[#CF9D7B] tracking-widest font-bold uppercase">SESSÃO DE DESTAQUE</span>
                            <span className="text-xs font-orbitron font-bold text-white truncate max-w-full">{featured.tema}</span>
                          </div>
                        </div>

                        {/* Tech design frame lines */}
                        <div className="absolute -inset-2.5 border border-[#CF9D7B]/10 rounded-3xl pointer-events-none -z-10 animate-pulse" />
                      </div>
                    </div>
                  </div>
                );
              })()
            )}

            {/* Contemporary Central Search & Action Center */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-[#162127]/30 border border-white/5 p-4 rounded-xl overflow-hidden">
              <div className="flex-1 w-full relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#CF9D7B]" />
                <input 
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full bg-[#0C1519]/70 border border-white/5 text-white placeholder-white/30 p-3.5 pl-12 rounded-lg outline-none focus:border-[#CF9D7B] focus:shadow-[0_0_15px_rgba(207,157,123,0.15)] transition-all font-mono text-xs uppercase"
                  placeholder="DIGITAR PALAVRA-CHAVE PARA FILTRAR PREGAÇÕES..."
                />
              </div>
              
              <button 
                onClick={() => setShowForm(!showForm)}
                className="w-full md:w-auto bg-[#0C1519]/90 border border-[#CF9D7B]/30 hover:border-[#CF9D7B] hover:text-white text-[#CF9D7B] px-6 py-3.5 rounded-lg font-orbitron font-extrabold tracking-[0.2em] text-[10px] hover:shadow-[0_0_20px_rgba(207,157,123,0.2)] hover:bg-[#CF9D7B]/5 transition-all cursor-pointer whitespace-nowrap uppercase text-center"
              >
                {showForm ? '[✕] FECHAR INSERÇÃO' : '[+] GRAVAR NOVO SERMÃO'}
              </button>
            </div>

            {/* Hive & Firestore Offline First Synchronization Bar */}
            <div className="bg-[#162127]/25 border border-white/5 p-3 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2.5 font-mono text-white/80 w-full md:w-auto">
                <Database className="w-4 h-4 text-[#CF9D7B]" />
                <span className="text-[#CF9D7B] font-bold tracking-wider font-orbitron text-[10px]">BANCO DE DADOS HIVE LOCAL:</span>
                <span className="bg-[#CF9D7B]/10 border border-[#CF9D7B]/20 px-2 py-0.5 rounded text-white text-[10px] font-bold">
                  {sermoes.length} Sermões Disponibilizados Offline
                </span>
                
                {localStorage.getItem('hive_sync_time') && (
                  <span className="text-text-dim text-[10px]">
                    (Último sync: {new Date(localStorage.getItem('hive_sync_time')!).toLocaleTimeString('pt-BR')})
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
                {/* Spotify Offline Mode filter */}
                <button
                  onClick={handleToggleShowOnlyDownloaded}
                  className={cn(
                    "w-full sm:w-auto px-4 py-1.5 rounded-lg border text-[9px] font-orbitron font-bold tracking-widest flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 cursor-pointer",
                    showOnlyDownloaded
                      ? "bg-emerald-950/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                      : "bg-white/5 border-white/10 text-white/55 hover:bg-white/10 hover:text-white"
                  )}
                  title="Filtrar para exibir apenas sermões marcados como baixados"
                >
                  <Check className={cn("w-3.5 h-3.5", showOnlyDownloaded ? "text-emerald-400" : "text-white/40")} />
                  <span>{showOnlyDownloaded ? `SÓ BAIXADOS:¹ ATIVO (${downloadedSermonIds.length})` : 'EXIBIR TODOS OS CACHED'}</span>
                </button>

                {isSyncingManual ? (
                  <div className="w-full md:w-56 bg-black/40 h-7 rounded-lg overflow-hidden border border-[#CF9D7B]/25 relative flex items-center justify-center">
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#CF9D7B] to-[#724B39] transition-all duration-150"
                      style={{ width: `${syncProgress}%` }}
                    />
                    <span className="relative z-10 text-[9px] font-orbitron font-bold text-white tracking-widest animate-pulse uppercase">
                      GRAVANDO HIVE {syncProgress}%
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleOfflineSync}
                    className={cn(
                      "w-full md:w-auto px-4 py-1.5 rounded-lg font-orbitron font-bold text-[9px] tracking-widest flex items-center justify-center gap-2 transition-all duration-300 border cursor-pointer",
                      syncStatus === 'synced'
                        ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                        : "bg-[#CF9D7B]/10 border-[#CF9D7B]/30 text-[#CF9D7B] hover:bg-[#CF9D7B]/20"
                    )}
                    title="Baixar lista completa de sermões e tópicos para acesso offline"
                  >
                    <Download className={cn("w-3.5 h-3.5", syncStatus === 'synced' ? "text-emerald-400" : "text-[#CF9D7B] animate-pulse")} />
                    <span>{syncStatus === 'synced' ? 'DISPONÍVEL TOTAL OFFLINE ✓' : 'FORÇAR DOWNLOAD BIBLIOTECA'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Form */}
            <AnimatePresence>
              {showForm && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-8 bg-[#162127]/35 border border-[#CF9D7B]/20 rounded-2xl p-6 md:p-8 space-y-6"
                >
                  <div className="flex items-center gap-2 border-b border-[#CF9D7B]/15 pb-4">
                    <Sparkles className="w-5 h-5 text-[#CF9D7B]" />
                    <span className="text-[10px] tracking-[0.25em] text-[#CF9D7B] uppercase font-orbitron font-bold">
                      // {editId ? `EDITANDO FICHA: ${tema}` : 'CONECTAR NOVO REGISTRO DO CULTO'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-orbitron text-text-dim uppercase tracking-wider">TEMA PRINCIPAL DA PREGAÇÃO</label>
                      <input 
                        value={tema}
                        onChange={(e) => setTema(e.target.value)}
                        className="w-full bg-[#0C1519]/70 border border-white/5 rounded-lg text-white p-3 text-sm outline-none focus:border-[#CF9D7B]"
                        placeholder="Ex: A Parábola do Semeador"
                        translate="no"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-orbitron text-text-dim uppercase tracking-wider">TEXTO BÍBLICO BASE</label>
                      <input 
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        className="w-full bg-[#0C1519]/70 border border-white/5 rounded-lg text-white p-3 text-sm outline-none focus:border-[#CF9D7B]"
                        placeholder="Ex: Mateus 13:1-23"
                        translate="no"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-orbitron text-text-dim uppercase tracking-wider">AGRADECIMENTOS OU DECLARAÇÕES INICIAIS</label>
                    <input 
                      value={agr}
                      onChange={(e) => setAgr(e.target.value)}
                      className="w-full bg-[#0C1519]/70 border border-white/5 rounded-lg text-white p-3 text-sm outline-none focus:border-[#CF9D7B]"
                      placeholder="Declarações rápidas de acolhimento aos irmãos..."
                      translate="no"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-orbitron text-text-dim uppercase tracking-wider">LINK/URL DO CARTAZ DO SERMÃO</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={img}
                            onChange={(e) => setImg(e.target.value)}
                            className="flex-1 bg-[#0C1519]/70 border border-white/5 rounded-lg text-white p-3 text-sm outline-none focus:border-[#CF9D7B]"
                            placeholder="https://..."
                            translate="no"
                          />
                          <button
                            type="button"
                            onClick={() => setImg('https://i.postimg.cc/vHqHW2J5/Firefly.jpg')}
                            className="bg-[#CF9D7B]/10 hover:bg-[#CF9D7B]/20 border border-[#CF9D7B]/30 px-4 rounded-lg text-[10px] text-[#CF9D7B] font-orbitron tracking-widest font-bold select-none shrink-0"
                            title="Preencher com poster padrão decorado"
                          >
                            PADRÃO
                          </button>
                        </div>
                      </div>
                      <div className="h-40 bg-black/40 border border-dashed border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
                        {img ? (
                          <img 
                            src={img} 
                            className="w-full h-full object-cover opacity-60" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = ''; 
                              console.error('Imagem link quebrada');
                            }}
                          />
                        ) : (
                          <span className="text-[10px] text-text-dim">// PRÉ-VISUALIZAÇÃO DA FICHA ILUSTRATIVA //</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-orbitron text-text-dim uppercase tracking-wider">TEXTO DA INTRODUÇÃO</label>
                      <textarea 
                        value={intro}
                        onChange={(e) => setIntro(e.target.value)}
                        className="w-full bg-[#0C1519]/70 border border-white/5 rounded-lg text-white p-3 text-sm outline-none focus:border-[#CF9D7B] h-[216px] resize-none"
                        placeholder="Escreva a introdução inicial de impacto..."
                        translate="no"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <h3 className="font-orbitron text-white text-xs tracking-widest uppercase font-black">// TÓPICOS DECLARADOS</h3>
                      <button 
                        onClick={() => setPontos([...pontos, { id: Math.random().toString(36).substring(7), text: '' }])}
                        className="p-1 px-3 border border-[#CF9D7B]/30 text-[#CF9D7B] hover:border-[#CF9D7B] rounded font-orbitron text-[10px] transition-all"
                      >
                        [+] INSERIR NOVO TÓPICO
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {pontos.map((p, i) => (
                        <PontoItem 
                          key={p.id} 
                          index={i}
                          total={pontos.length}
                          value={p.text}
                          onChange={(val) => {
                            const newPontos = [...pontos];
                            newPontos[i].text = val;
                            setPontos(newPontos);
                          }}
                          onRemove={() => setPontos(pontos.filter((_, idx) => idx !== i))}
                          onMove={(dir) => movePonto(i, dir)}
                        />
                      ))}
                      
                      {pontos.length === 0 && (
                        <div className="py-8 border border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center gap-2 text-text-dim bg-[#0C1519]/30">
                          <Plus className="w-5 h-5 opacity-40 text-[#CF9D7B]" />
                          <span className="font-orbitron text-[9px] tracking-wider uppercase opacity-60">Nenhum ponto chave cadastrado</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-orbitron text-text-dim uppercase tracking-wider">APLICAÇÃO PRÁTICA DA PALAVRA & CONCLUSÃO</label>
                    <textarea 
                      value={apl}
                      onChange={(e) => setApl(e.target.value)}
                      className="w-full bg-[#0C1519]/70 border border-white/5 rounded-lg text-white p-3 text-sm outline-none focus:border-[#CF9D7B] min-h-[100px]"
                      placeholder="Mensagem final de apelo e ensinamento..."
                      translate="no"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-orbitron text-text-dim uppercase tracking-wider">Setores Pregados (Canais, Setores, Cidades etc)</label>
                    <div className="flex flex-wrap gap-2">
                      {setores.map((setor, i) => (
                        <div key={i} className="flex items-center bg-[#CF9D7B]/10 border border-[#CF9D7B]/30 px-2.5 py-1 rounded-lg">
                          <span className="text-[#CF9D7B] font-bold text-xs font-mono">{setor}</span>
                          <button 
                            type="button"
                            onClick={() => setSetores(setores.filter((_, idx) => idx !== i))}
                            className="ml-2 text-red-500 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <input 
                        type="text"
                        className="bg-[#0C1519]/70 border border-white/5 text-white px-3 py-1.5 rounded-lg text-xs outline-none w-24 focus:border-[#CF9D7B]"
                        placeholder="+ Setor"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = e.currentTarget.value.trim();
                            if (val && !setores.includes(val)) {
                              setSetores([...setores, val]);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                    <button onClick={resetForm} className="px-6 py-2.5 border border-white/10 text-white/60 hover:text-white rounded-lg transition-all text-xs cursor-pointer">CANCELAR</button>
                    <button onClick={handleSave} className="px-8 py-2.5 bg-gradient-to-r from-[#CF9D7B] to-[#724B39] text-white font-orbitron font-bold rounded-lg hover:shadow-[0_0_20px_rgba(207,157,123,0.3)] text-xs transition-all cursor-pointer">
                      {editId ? 'ATUALIZAR REGISTRO' : 'GRAVAR DISCURSO'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Contemporary Elegant Sermon Catalog Grid Gallery */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-orbitron font-bold tracking-[0.25em] text-[#CF9D7B] uppercase">// EXPEDIENTE DE PREGAÇÕES ({filteredSermoes.length})</span>
                <span className="text-[9px] font-sans text-text-dim text-right">Toque em qualquer ficha de sermão para abrir a mesa de controle</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredSermoes.map((s, index) => {
                  const hasImage = !!s.img;
                  const pointsCount = s.pontos?.length || 0;
                  const randomID = (s.id || '').substring(0, 5).toUpperCase();
                  return (
                    <motion.div 
                      layout
                      key={s.id}
                      onClick={() => setSelectedSermonId(s.id!)}
                      className="group relative bg-[#162127]/30 border border-white/5 hover:border-[#CF9D7B]/40 rounded-xl overflow-hidden cursor-pointer hover:shadow-[0_0_30px_rgba(207,157,123,0.15)] flex flex-col h-96 justify-between transition-all duration-300"
                    >
                      {/* Favorite trigger (Sermão do Dia heart icon) */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(s.id!);
                        }}
                        className={cn(
                          "absolute top-3 left-3 z-20 w-8 h-8 flex items-center justify-center rounded-lg bg-black/75 border transition-all shadow-md transform active:scale-95 duration-200 cursor-pointer",
                          s.isFavorite 
                            ? "border-[#ff2a5f] text-[#ff144f] bg-[#ff2a5f]/15 opacity-100 shadow-[0_0_15px_rgba(255,42,95,0.4)]" 
                            : "border-white/10 text-white/30 hover:text-[#ff2a5f] hover:border-[#ff2a5f]/30 hover:bg-black/90 opacity-0 group-hover:opacity-100"
                        )}
                        title={s.isFavorite ? "Remover de Sermão do Dia" : "Definir como Sermão do Dia"}
                      >
                        <Heart className={cn("w-4 h-4 transition-transform duration-300", s.isFavorite ? "fill-[#ff2a5f] scale-110 text-[#ff2a5f]" : "")} />
                      </button>

                      {/* Download offline trigger (Spotify style) */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleDownloadSermon(s.id!);
                        }}
                        className={cn(
                          "absolute top-3 left-12 z-20 w-8 h-8 flex items-center justify-center rounded-lg bg-black/75 border transition-all shadow-md transform active:scale-95 duration-200 cursor-pointer",
                          downloadedSermonIds.includes(s.id!) 
                            ? "border-emerald-500 text-emerald-400 bg-emerald-500/15 opacity-100 shadow-[0_0_15px_rgba(16,185,129,0.4)]" 
                            : "border-white/10 text-white/30 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-black/90 opacity-0 group-hover:opacity-100"
                        )}
                        title={downloadedSermonIds.includes(s.id!) ? "Remover dos Baixados (Offline)" : "Baixar Sermão para Offline"}
                      >
                        <Download className={cn("w-4 h-4 transition-transform duration-300", downloadedSermonIds.includes(s.id!) ? "scale-110 text-emerald-400" : "")} />
                      </button>

                      {/* Delete trigger */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(s.id!);
                        }}
                        className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-lg bg-black/60 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-md transform"
                        title="Deletar Sermão"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Cover Area */}
                      <div className="relative w-full h-44 bg-[#0C1519] overflow-hidden shrink-0 border-b border-white/5">
                        {hasImage ? (
                          <img 
                            src={s.img} 
                            className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500" 
                            alt={s.tema}
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-tr from-[#0C1519]/90 to-[#162127]/90 flex items-center justify-center p-4">
                            <BookOpen className="w-10 h-10 text-[#CF9D7B]/30 group-hover:scale-110 duration-300" />
                          </div>
                        )}

                        {/* Interactive "Start Preaching" Floating Play Tag */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 duration-300 flex items-center justify-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-[#CF9D7B] flex items-center justify-center text-white scale-75 group-hover:scale-100 border border-white/20 shadow-lg transform duration-300">
                            <Play className="w-5 h-5 ml-0.5 fill-current" />
                          </div>
                        </div>

                        {/* Badged Sectors */}
                        {s.setores && s.setores.length > 0 && (
                          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1 max-w-[85%] z-10">
                            {s.setores.slice(0, 2).map((setor, idx) => (
                              <span key={idx} className="bg-black/80 border border-[#CF9D7B]/40 text-[#CF9D7B] text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm shadow-[0_0_5px_rgba(207,157,123,0.3)] uppercase">
                                {setor}
                              </span>
                            ))}
                            {s.setores.length > 2 && (
                              <span className="bg-black/80 text-[#CF9D7B] text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm">
                                +{s.setores.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card Content & Meta */}
                      <div className="flex-1 p-4 flex flex-col justify-between">
                        <div>
                          {/* Code Serial / Visual Grid Detail */}
                          <div className="flex justify-between items-center text-[9px] font-mono tracking-widest text-text-dim mb-1">
                            <span>REG_KEY: #{randomID}</span>
                            <span>ORD: {(index+1).toString().padStart(2, '0')}</span>
                          </div>

                          <h3 className="font-orbitron font-bold text-base text-white/95 group-hover:text-[#CF9D7B] transition-colors leading-snug line-clamp-2" translate="no">
                            {s.tema}
                          </h3>
                        </div>

                        {/* Card Footer Bible and point statistics */}
                        <div className="border-t border-white/5 pt-3">
                          <p className="text-[10px] text-[#CF9D7B] font-mono uppercase truncate mb-1" translate="no">
                            📖 {s.texto || '// SEM BASE CADASTRADA'}
                          </p>

                          <div className="flex justify-between items-center text-[10px] text-text-dim font-mono">
                            <span className="flex items-center gap-1">
                              <Layers size={10} />
                              {pointsCount} {pointsCount === 1 ? 'tópico' : 'tópicos'}
                            </span>
                            <span className="text-[9px] opacity-75">
                              {s.createdAt ? new Date(s.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : 'Recente'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          /* Pulpito Mode */
          <div className="fixed inset-0 z-[2000] bg-[#0C1519] overflow-y-auto p-6 md:p-12 font-rajdhani" translate="no">
            {/* Immersive Dark Background Overlay */}
            <div className="absolute inset-0 bg-radial from-[#121c22]/50 via-transparent to-transparent pointer-events-none -z-10" />

            {/* Floating Timer */}
            <div className="fixed top-4 right-4 bg-black/95 border border-[#CF9D7B] text-[#CF9D7B] px-5 py-3 font-orbitron text-xl md:text-3xl font-black shadow-[0_0_20px_rgba(207,157,123,0.3)] z-[2001] rounded-xl flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full bg-red-600 animate-pulse" />
              {formatTime(tempo)}
            </div>

            <div className={cn("max-w-5xl mx-auto space-y-16 pb-32 transition-all duration-300", fontSizes[fontSizeIndex])}>
              {/* Header Section */}
              <div className="space-y-6 border-b border-white/5 pb-10">
                <h1 className="text-3xl md:text-5xl lg:text-6xl font-orbitron font-black text-white leading-tight tracking-tight uppercase">
                  {selectedSermon?.tema}
                </h1>
                
                <div className="flex flex-wrap items-center gap-6 text-xl md:text-2xl">
                  <div className="flex items-center gap-3 text-[#ffee00] bg-[#CF9D7B]/10 px-4 py-2 border border-[#CF9D7B]/20 rounded-xl">
                    <BookOpen className="w-6 h-6 text-[#CF9D7B]" />
                    <span className="font-bold">
                      <HighlightableText 
                        text={selectedSermon?.texto || ''} 
                        sermonId={selectedSermon?.id!} 
                        sectionKey="texto" 
                        highlights={selectedSermon?.highlights}
                        onHighlight={(key, color) => handleHighlight(selectedSermon?.id!, key, color)}
                      />
                    </span>
                  </div>
                  
                  {selectedSermon?.agr && (
                    <div className="text-white/80 italic flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
                      <span className="text-[#CF9D7B] font-bold font-orbitron select-none">🙌 AGRADECIMENTOS:</span>
                      <span>{selectedSermon.agr}</span>
                    </div>
                  )}
                </div>

                {/* Inline Sectors - Discreet solution */}
                <PulpitoSectors 
                  setores={selectedSermon?.setores || []} 
                  onAdd={async (s) => {
                    if (selectedSermon?.id) {
                      try {
                        const newSetores = [...(selectedSermon.setores || []), s];
                        await updateDoc(doc(db, 'sermoes', selectedSermon.id), { 
                          setores: newSetores,
                          updatedAt: serverTimestamp()
                        });
                      } catch (error) {
                        handleFirestoreError(error, OperationType.UPDATE, `sermoes/${selectedSermon.id}`);
                      }
                    }
                  }}
                />
              </div>

              {/* Intro Section */}
              {selectedSermon?.intro && (
                <section className="space-y-6 bg-[#162127]/20 p-8 border-l-4 border-[#CF9D7B]/60 rounded-r-xl">
                  <h4 className="font-orbitron text-[#CF9D7B] text-sm tracking-[0.4em] uppercase font-black">
                    // INTRODUÇÃO REVELADA
                  </h4>
                  <div className="leading-relaxed text-white/90 whitespace-pre-wrap font-medium">
                    <HighlightableText 
                      text={selectedSermon.intro} 
                      sermonId={selectedSermon.id!} 
                      sectionKey="intro" 
                      highlights={selectedSermon.highlights}
                      onHighlight={(key, color) => handleHighlight(selectedSermon.id!, key, color)}
                    />
                  </div>
                </section>
              )}

              {/* Development Section */}
              <section className="space-y-10">
                <h4 className="font-orbitron text-[#ffee00]/80 text-sm tracking-[0.4em] uppercase font-black">
                  // DESENVOLVIMENTO DO TEMA
                </h4>
                <div className="space-y-8">
                  {selectedSermon?.pontos.map((p, i) => (
                    <PulpitoTopic 
                      key={i}
                      p={p}
                      i={i}
                      sermonId={selectedSermon.id!}
                      highlights={selectedSermon.highlights}
                      onHighlight={(key, color) => handleHighlight(selectedSermon.id!, key, color)}
                    />
                  ))}
                </div>
              </section>

              {/* Application Section */}
              {selectedSermon?.apl && (
                <section className="space-y-6 bg-[#162127]/20 p-8 border-l-4 border-[#00f5ff]/60 rounded-r-xl">
                  <h4 className="font-orbitron text-[#00f5ff]/80 text-sm tracking-[0.4em] uppercase font-black">
                    // APLICAÇÃO GERAL & FECHAMENTO
                  </h4>
                  <div className="leading-relaxed text-white/90 whitespace-pre-wrap font-medium font-rajdhani">
                    <HighlightableText 
                      text={selectedSermon.apl} 
                      sermonId={selectedSermon.id!} 
                      sectionKey="apl" 
                      highlights={selectedSermon.highlights}
                      onHighlight={(key, color) => handleHighlight(selectedSermon.id!, key, color)}
                    />
                  </div>
                </section>
              )}

              {/* Footer Actions */}
              <div className="pt-20 pb-12 flex justify-center">
                <button 
                  onClick={() => {
                    setAutoScrollActive(false);
                    setMode('grid');
                  }}
                  className="group flex items-center gap-2.5 px-8 py-3 border border-[#CF9D7B]/40 text-[#CF9D7B]/80 font-orbitron text-[11px] tracking-[0.3em] uppercase hover:border-[#CF9D7B] hover:text-white hover:bg-[#CF9D7B]/15 transition-all duration-500 rounded-lg cursor-pointer font-bold"
                >
                  <LogOut className="w-4 h-4 opacity-75 group-hover:opacity-100 transition-opacity" />
                  ENCERRAR PREGAÇÃO IMPERIAL
                </button>
              </div>
            </div>

            {/* Tablet Pulpit Imperial Reading Remote Controller HUD (Floating controller) */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[2010] bg-[#0c1519]/95 border border-[#CF9D7B]/30 backdrop-blur-xl px-4 py-2 rounded-2xl flex items-center gap-4 shadow-[0_4px_30px_rgba(207,157,123,0.3)] select-none max-w-[95vw] w-fit text-white">
              {/* Size Tools */}
              <div className="flex items-center gap-2 border-r border-[#CF9D7B]/20 pr-3 shrink-0">
                <button 
                  onClick={() => setFontSizeIndex(prev => Math.max(0, prev - 1))}
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-[#CF9D7B] border border-white/10 flex items-center justify-center font-orbitron font-extrabold text-[10px] active:scale-95 duration-150 cursor-pointer"
                  title="Diminuir letras"
                >
                  A-
                </button>
                <span className="text-[9px] font-mono font-bold text-white uppercase px-1 min-w-[3rem] text-center shrink-0">
                  FONTE: {fontSizeIndex + 1}X
                </span>
                <button 
                  onClick={() => setFontSizeIndex(prev => Math.min(fontSizes.length - 1, prev + 1))}
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-[#CF9D7B] border border-white/10 flex items-center justify-center font-orbitron font-extrabold text-[10px] active:scale-95 duration-150 cursor-pointer"
                  title="Aumentar letras"
                >
                  A+
                </button>
              </div>

              {/* Integrated Brush/Pincel Tools */}
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  onClick={() => brush.setBrush({ isActive: !brush.isActive })}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-[9px] font-orbitron font-bold tracking-widest flex items-center gap-1.5 transition-all duration-300 active:scale-95 cursor-pointer shrink-0",
                    brush.isActive
                      ? "bg-[#00f5ff]/15 border-[#00f5ff]/50 text-[#00f5ff] shadow-[0_0_12px_rgba(0,245,255,0.25)]"
                      : "bg-white/5 border-white/10 text-white/55 hover:bg-white/10 hover:text-white"
                  )}
                  title="Ativar/Desativar Marcador Rápido"
                >
                  <Paintbrush className={cn("w-3.5 h-3.5", brush.isActive && "animate-pulse")} />
                  <span>PINCEL</span>
                </button>
              </div>

              {/* Back action */}
              <button
                onClick={() => {
                  setAutoScrollActive(false);
                  setMode('grid');
                }}
                className="p-1.5 bg-red-950/25 border border-red-500/20 hover:border-red-500 hover:bg-red-500/30 text-red-400 hover:text-white rounded-lg transition-all cursor-pointer shadow-md shrink-0 ml-auto"
                title="Sair do Púlpito"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal Details */}
      <AnimatePresence>
        {selectedSermonId && selectedSermon && mode === 'grid' && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="bg-[#162127] border border-[#CF9D7B]/30 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto p-6 md:p-8 relative shadow-[0_0_50px_rgba(207,157,123,0.15)]"
            >
              <button 
                onClick={() => setSelectedSermonId(null)}
                className="absolute top-4 right-4 text-text-dim hover:text-[#CF9D7B] transition-colors p-2 cursor-pointer"
                title="Fechar Detalhes"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="space-y-8">
                <div>
                  <div className="inline-flex items-center gap-2 bg-[#CF9D7B]/10 border border-[#CF9D7B]/35 px-3 py-1 rounded-full text-[10px] font-orbitron font-bold text-[#CF9D7B] tracking-widest uppercase mb-4">
                    <span>✦ CONTROLE DO SERMÃO</span>
                  </div>

                  <h2 className="text-2xl md:text-3xl font-orbitron font-black text-white leading-tight uppercase" translate="no">
                    {selectedSermon.tema}
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-white/5 pb-6">
                  <div className="text-base text-[#ffee00] font-mono flex items-center gap-3">
                    <BookOpen className="w-5 h-5 flex-shrink-0 text-[#CF9D7B]" />
                    <HighlightableText 
                      text={selectedSermon.texto || ''} 
                      sermonId={selectedSermon.id!} 
                      sectionKey="texto" 
                      highlights={selectedSermon.highlights}
                      onHighlight={(key, color) => handleHighlight(selectedSermon.id!, key, color)}
                    />
                  </div>
                  
                  {selectedSermon.agr && (
                    <div className="text-xs text-text-mid font-rajdhani flex items-center gap-2">
                      <span className="font-extrabold text-[#CF9D7B] font-orbitron tracking-widest">🙌 AGRADECIMENTOS:</span> 
                      <p className="text-white/80 shrink">{selectedSermon.agr}</p>
                    </div>
                  )}
                </div>
                
                {selectedSermon.intro && (
                  <div className="space-y-3">
                    <h4 className="font-orbitron font-bold text-xs text-[#CF9D7B] uppercase tracking-[0.25em]">// INTRODUÇÃO REVELADA</h4>
                    <div className="whitespace-pre-wrap text-text-mid leading-relaxed text-base bg-[#0C1519]/70 border border-white/5 p-5 rounded-xl">
                      <HighlightableText 
                        text={selectedSermon.intro} 
                        sermonId={selectedSermon.id!} 
                        sectionKey="intro" 
                        highlights={selectedSermon.highlights}
                        onHighlight={(key, color) => handleHighlight(selectedSermon.id!, key, color)}
                      />
                    </div>
                  </div>
                )}

                {selectedSermon.pontos && selectedSermon.pontos.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-orbitron font-bold text-xs text-[#ffee00] uppercase tracking-[0.25em]">// DESENVOLVIMENTO DO TEMA</h4>
                    <div className="space-y-3">
                      {selectedSermon.pontos.map((p, i) => (
                        <div key={i} className="flex gap-4 items-start bg-[#0C1519]/50 p-4 border border-white/5 border-l-2 border-l-[#CF9D7B] rounded-xl">
                          <input type="checkbox" className="mt-1 accent-[#CF9D7B] w-4 h-4 cursor-pointer" />
                          <div className="whitespace-pre-wrap text-text-mid text-base leading-relaxed font-rajdhani">
                            <HighlightableText 
                              text={p} 
                              sermonId={selectedSermon.id!} 
                              sectionKey={`ponto_${i}`} 
                              highlights={selectedSermon.highlights}
                              onHighlight={(key, color) => handleHighlight(selectedSermon.id!, key, color)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedSermon.apl && (
                  <div className="space-y-3">
                    <h4 className="font-orbitron font-bold text-xs text-[#00f5ff] uppercase tracking-[0.25em]">// APLICAÇÃO GERAL & FECHAMENTO</h4>
                    <div className="whitespace-pre-wrap text-text-mid leading-relaxed text-base bg-[#0C1519]/70 border border-white/5 p-5 rounded-xl">
                      <HighlightableText 
                        text={selectedSermon.apl} 
                        sermonId={selectedSermon.id!} 
                        sectionKey="apl" 
                        highlights={selectedSermon.highlights}
                        onHighlight={(key, color) => handleHighlight(selectedSermon.id!, key, color)}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 pt-6 border-t border-white/5">
                  <button 
                    onClick={() => {
                      setMode('pulpito');
                      setSelectedSermonId(selectedSermon.id!);
                    }}
                    className="px-8 py-3 bg-gradient-to-r from-[#CF9D7B] to-[#724B39] text-white font-orbitron font-black text-[11px] tracking-widest rounded-lg hover:shadow-[0_0_20px_rgba(207,157,123,0.35)] flex items-center gap-2 transform active:scale-95 duration-200 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current text-white/90" />
                    <span>INICIAR NO PÚLPITO IMPERIAL</span>
                  </button>

                  <button 
                    onClick={() => handleToggleDownloadSermon(selectedSermon.id!)}
                    className={cn(
                      "px-6 py-3 border rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2",
                      downloadedSermonIds.includes(selectedSermon.id!)
                        ? "bg-emerald-950/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/15"
                        : "bg-white/5 hover:bg-white/10 border-white/10 hover:border-emerald-500/50 hover:text-emerald-400"
                    )}
                    title={downloadedSermonIds.includes(selectedSermon.id!) ? "Remover dos Baixados Offline" : "Baixar para Acesso Offline"}
                  >
                    <Download className={cn("w-3.5 h-3.5", downloadedSermonIds.includes(selectedSermon.id!) ? "text-emerald-400 fill-emerald-400/20" : "")} />
                    <span>{downloadedSermonIds.includes(selectedSermon.id!) ? "BAIXADO OFFLINE ✓" : "BAIXAR OFFLINE"}</span>
                  </button>

                  <button 
                    onClick={() => handleEdit(selectedSermon)}
                    className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#CF9D7B]/50 hover:text-[#CF9D7B] rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    EDITAR FICHA
                  </button>

                  <button 
                    onClick={() => setShowDeleteConfirm(selectedSermon.id!)}
                    className="px-6 py-3 bg-red-950/20 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    EXCLUIR REGISTRO
                  </button>

                  <button 
                    onClick={() => setSelectedSermonId(null)}
                    className="px-6 py-3 border border-white/10 text-white/60 hover:text-white rounded-lg text-xs cursor-pointer ml-auto"
                  >
                    FECHAR
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card-bg border border-neon-pink p-8 max-w-md w-full space-y-6 text-center shadow-[0_0_30px_rgba(255,255,255,0.25)]"
            >
              <h3 className="text-2xl font-orbitron font-bold text-neon-pink">CONFIRMAR EXCLUSÃO?</h3>
              <p className="text-text-mid font-mono">Esta ação não pode ser desfeita. O registro será removido permanentemente do sistema.</p>
              <div className="flex gap-4 justify-center">
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-6 py-2 border border-neon-cyan/30 text-neon-cyan/60 hover:text-neon-cyan"
                >
                  CANCELAR
                </button>
                <button 
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="px-6 py-2 bg-neon-pink/10 border border-neon-pink text-neon-pink font-bold hover:shadow-[0_0_15px_rgba(255,255,255,0.4)]"
                >
                  DELETAR AGORA
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {selectedSermonId && selectedSermon && (
        <BrushToolbar />
      )}
    </div>
  );
}
