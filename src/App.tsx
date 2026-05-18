/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown
} from 'lucide-react';
import { cn } from './lib/utils';
import { HighlightableText } from './components/HighlightableText';
import { PulpitoTopic } from './components/PulpitoTopic';
import { PulpitoSectors } from './components/PulpitoSectors';

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

export default function App() {
  const [authorized, setAuthorized] = useState(() => localStorage.getItem('system_auth') === 'true');
  const [passInput, setPassInput] = useState('');
  const [passError, setPassError] = useState(false);
  const [user, setUser] = useState<any>(authorized ? { uid: 'admin', displayName: 'Pastor' } : null);
  const [loading, setLoading] = useState(false);
  const [sermoes, setSermoes] = useState<Sermon[]>([]);
  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedSermonId, setSelectedSermonId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [mode, setMode] = useState<'grid' | 'pulpito'>('grid');
  
  // New State for Calendar & Sidebar
  const [moonMode, setMoonMode] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [systemFields, setSystemFields] = useState<Record<string, string>>({
    id1: 'LED',
    id2: 'TLL',
    id3: 'St. Petersburg',
    id4: 'JAN 13, 6:15 AM',
    id5: 'Tallinn',
    id6: 'JAN 13, 12:35 PM'
  });
  const [currentDate] = useState(new Date());

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  
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

  useEffect(() => {
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sermoes');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    // Load System Settings
    const unsubscribeSettings = onSnapshot(doc(db, 'systemSettings', 'sidebar'), (docSnap) => {
      if (docSnap.exists()) {
        setSystemFields(docSnap.data().fields);
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

  // Robust toggle implementation for Firestore
  const handleDateToggle = async (dateStr: string) => {
    if (!editMode) return;
    try {
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
    if (editPassInput === '3434') {
      setEditMode(true);
      alert("Modo Edição Ativado! Clique nos dias do calendário para alternar.");
      setShowMiniLogin(false);
    } else if (editPassInput === '4343') {
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
    const newFields = { ...systemFields, [id]: value };
    setSystemFields(newFields);
    try {
      await setDoc(doc(db, 'systemSettings', 'sidebar'), { fields: newFields }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const renderCalendarDays = () => {
    const date = currentDate;
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const totalDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const today = new Date();
    
    const days = [];
    for (let x = 0; x < firstDay; x++) { days.push(<div key={`empty-${x}`}></div>); }

    for (let i = 1; i <= totalDays; i++) {
        const dateStr = `${date.getFullYear()}-${date.getMonth()}-${i}`;
        const isBlocked = blockedDates.includes(dateStr);
        const isToday = i === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
        
        days.push(
          <div 
            key={i} 
            onClick={() => handleDateToggle(dateStr)}
            className={cn(
              "aspect-square flex items-center justify-center rounded-lg text-[13px] cursor-pointer transition-all border border-transparent",
              isBlocked ? "bg-red-500/15 text-white/50 blur-[0.5px] border-red-600" : "bg-white/5 text-[#00ffcc] border-transparent hover:border-neon-cyan vacant",
              isToday && "bg-[#ff5e00]! text-white! font-bold shadow-[0_0_15px_rgba(255,94,0,0.5)]",
              editMode && isBlocked && "cursor-pointer blur-none opacity-80"
            )}
          >
            {i}
          </div>
        );
    }
    return days;
  };

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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passInput === '3434') {
      setAuthorized(true);
      setUser({ uid: 'admin', displayName: 'Pastor' });
      localStorage.setItem('system_auth', 'true');
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
      <div className="min-h-screen relative overflow-hidden bg-cover bg-center" style={{ backgroundImage: 'url("https://i.postimg.cc/2jgRP7BJ/file-00000000aa9c71f58b7e1dea34210739.png")' }}>
        <div className={cn("fixed inset-0 transition-all duration-1000 pointer-events-none z-1", moonMode ? "bg-black/85" : "bg-transparent")} />
        
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

        {/* Sidebar Container */}
        <div className="fixed left-5 top-1/2 -translate-y-1/2 z-[100] flex flex-col items-start gap-4">
          <button 
            onClick={toggleSidebar}
            className="px-6 py-4 rounded-[15px] bg-white/10 backdrop-blur-[20px] border border-white/20 text-white font-bold uppercase tracking-[1px] text-[12px] hover:bg-white/20 transition-all"
          >
            Evento
          </button>
          
          <AnimatePresence>
            {showSidebar && (
              <motion.div 
                initial={{ maxHeight: 0, opacity: 0 }}
                animate={{ maxHeight: 600, opacity: 1 }}
                exit={{ maxHeight: 0, opacity: 0 }}
                className="w-[90vw] max-w-[320px] overflow-hidden rounded-[20px] bg-[#141414]/85 backdrop-blur-[20px] border border-white/20 p-5 md:p-6 relative"
              >
                <div 
                  onClick={() => setShowMiniLogin(!showMiniLogin)}
                  className="w-1.5 h-1.5 bg-[#ff5e00] rounded-full absolute top-[15px] right-[15px] cursor-pointer shadow-[0_0_8px_#ff5e00] animate-pulse z-10" 
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

                <div className="w-full h-3.5 bg-[#222] rounded-full relative mt-5">
                  <div className="w-[70%] h-full bg-gradient-to-r from-[#a2ff00] to-[#00ffcc] rounded-full relative">
                    <div className="absolute -right-2.5 -top-2.5 bg-[#00bfff] w-[30px] h-[30px] rounded-full flex items-center justify-center text-[14px]">
                      ✈
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Moon Toggle - Consultar Agenda */}
        <button 
          onClick={toggleMoonMode}
          className={cn(
            "fixed top-5 right-5 group flex items-center gap-3 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/20 z-[1001] transition-all duration-500 hover:scale-105 active:scale-95 cursor-pointer outline-none",
            "shadow-[0_0_15px_rgba(0,255,204,0.2)] hover:shadow-[0_0_25px_rgba(0,255,204,0.4)]",
            moonMode ? "border-neon-cyan/50 shadow-[0_0_30px_rgba(0,255,204,0.6)]" : ""
          )}
        >
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-700 text-xl",
            moonMode && "rotate-[360deg]"
          )}>
            {moonMode ? '🌕' : '🌙'}
          </div>
          <div className="flex flex-col items-start mr-1 select-none">
            <span className="text-[9px] text-neon-cyan font-black uppercase tracking-[0.2em] leading-none mb-0.5 animate-pulse">Minha</span>
            <span className="text-white text-[12px] font-orbitron font-bold uppercase tracking-wide leading-none">Agenda</span>
          </div>
        </button>

        {/* Calendar */}
        <AnimatePresence>
          {moonMode && (
            <motion.div 
              initial={{ opacity: 0, x: '-50%', y: '-60%' }}
              animate={{ opacity: 1, x: '-50%', y: '-50%' }}
              exit={{ opacity: 0, x: '-50%', y: '-60%' }}
              className="fixed top-1/2 left-1/2 z-[500] p-4 md:p-5 rounded-[24px] w-[90%] max-w-[340px] bg-[#0f0f0f]/95 border border-white/10 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex justify-between items-center mb-4 text-white text-lg px-1">
                <span className="font-orbitron tracking-widest uppercase text-sm md:text-base">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                <div className="text-[10px] text-neon-cyan select-none whitespace-nowrap">● VAGO</div>
              </div>
              <div className="grid grid-cols-7 gap-1 md:gap-2 text-center">
                {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                  <div key={`${d}-${i}`} className="text-neon-yellow text-[11px] md:text-[12px] font-bold uppercase pb-1 flex justify-center items-center">{d}</div>
                ))}
                {renderCalendarDays()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end justify-center min-h-screen pb-10 px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-[280px] p-6 rounded-[25px] bg-white/10 backdrop-blur-[20px] border border-white/20 shadow-2xl text-white text-center z-10"
          >
            <h2 className="text-xl font-bold mb-2">Bem-vindo(a)!</h2>
            <div className="mb-5">
              <input 
                type="password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                placeholder="Palavra-passe"
                className="w-full p-3 rounded-lg border-none bg-white/90 text-[#222] font-rajdahni outline-none text-center"
              />
            </div>
            <div className="flex flex-col items-center gap-2">
              <label className="relative inline-block w-[70px] h-[35px] cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  onChange={(e) => {
                    if (e.target.checked) {
                      if (passInput === '3434') {
                        setAuthorized(true);
                        setUser({ uid: 'admin', displayName: 'Pastor' });
                        localStorage.setItem('system_auth', 'true');
                        setMoonMode(false);
                        setShowSidebar(false);
                      } else {
                        alert("Senha Incorreta.");
                        setTimeout(() => { e.target.checked = false; }, 500);
                      }
                    }
                  }}
                />
                <div className="w-full h-full bg-[#1a1a1a] rounded-full transition-all peer-checked:bg-neon-pink">
                  <div className="absolute top-1 left-1 w-[27px] h-[27px] bg-gradient-to-b from-[#555] to-[#222] rounded-full transition-all peer-checked:translate-x-[34px] peer-checked:bg-neon-pink peer-checked:shadow-[0_0_15px_#ff0080]" />
                </div>
              </label>
              <span className="text-[10px] uppercase tracking-widest">Entrar</span>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  const filteredSermoes = sermoes.filter(s => s.tema.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="min-h-screen relative z-10 pb-20 transition-all duration-1000 bg-[#0b0b0b]" translate="no">
      {/* Header */}
      <header className="header flex flex-col md:flex-row justify-between items-center p-4 md:p-8 border-b border-neon-cyan/20 bg-gradient-to-b from-neon-cyan/5 to-transparent mb-8 relative">
        <div className="text-center md:text-left">
          <h1 className="text-2xl md:text-4xl font-orbitron font-black bg-gradient-to-br from-neon-cyan to-neon-pink bg-clip-text text-transparent animate-logo-flicker">
            SYSTEMA SERMÕES
          </h1>
          <p className="font-rajdhani tracking-[0.3em] text-text-dim text-xs">
            // GERENCIADOR DE PREGAÇÕES v3.0 //
          </p>
        </div>
        
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <div className="flex items-center gap-2 text-text-mid font-rajdhani">
            <UserIcon className="w-4 h-4" />
            <span className="text-sm">{user?.displayName}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 border border-neon-pink/30 text-neon-pink/60 hover:text-neon-pink hover:border-neon-pink transition-all"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neon-cyan to-transparent animate-border-flow" />
      </header>

      <main className="max-w-7xl mx-auto px-4">
        {mode === 'grid' ? (
          <>
            {/* Controls */}
            <div className="flex flex-wrap gap-4 mb-8">
              <div className="flex-1 min-w-[280px] relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-dim" />
                <input 
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full bg-neon-cyan/5 border border-neon-cyan/20 text-neon-cyan p-3 pl-12 outline-none focus:border-neon-cyan focus:shadow-[0_0_15px_rgba(0,245,255,0.2)] transition-all font-mono"
                  placeholder="[🔍] BUSCAR SERMÃO PELO TEMA..."
                />
              </div>
              <button 
                onClick={() => setShowForm(!showForm)}
                className="bg-gradient-to-br from-neon-cyan/15 to-neon-pink/10 border border-neon-cyan text-neon-cyan px-6 py-3 font-orbitron font-bold tracking-widest hover:shadow-[0_0_20px_rgba(0,245,255,0.3)] transition-all"
              >
                {showForm ? '[✕] FECHAR' : '[+] NOVO SERMÃO'}
              </button>
            </div>

            {/* Form */}
            <AnimatePresence>
              {showForm && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-12 bg-neon-cyan/[0.02] border border-neon-cyan/15 p-6 space-y-4"
                >
                  <span className="text-[0.7rem] tracking-[0.3em] text-neon-yellow uppercase">
                    // {editId ? `EDITANDO: ${tema}` : 'INSERIR DADOS DO SISTEMA'}
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input 
                      value={tema}
                      onChange={(e) => setTema(e.target.value)}
                      className="w-full bg-neon-cyan/5 border border-neon-cyan/20 text-neon-cyan p-3 outline-none focus:border-neon-cyan"
                      placeholder="TEMA PRINCIPAL"
                      translate="no"
                    />
                    <input 
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      className="w-full bg-neon-cyan/5 border border-neon-cyan/20 text-neon-cyan p-3 outline-none focus:border-neon-cyan"
                      placeholder="TEXTO BÍBLICO BASE"
                      translate="no"
                    />
                  </div>

                  <input 
                    value={agr}
                    onChange={(e) => setAgr(e.target.value)}
                    className="w-full bg-neon-cyan/5 border border-neon-cyan/20 text-neon-cyan p-3 outline-none focus:border-neon-cyan"
                    placeholder="AGRADECIMENTOS INICIAIS"
                    translate="no"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <input 
                        type="text" 
                        value={img}
                        onChange={(e) => setImg(e.target.value)}
                        className="w-full bg-neon-cyan/5 border border-neon-cyan/20 text-neon-cyan p-3 outline-none focus:border-neon-cyan"
                        placeholder="LINK DA IMAGEM (URL)"
                        translate="no"
                      />
                      <div className="h-40 bg-black/50 border border-dashed border-neon-cyan/30 flex items-center justify-center overflow-hidden text-text-dim">
                        {img ? (
                          <img 
                            src={img} 
                            className="w-full h-full object-cover opacity-80" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = ''; 
                              console.error('Erro ao carregar link da imagem');
                            }}
                          />
                        ) : '// COLE O LINK DA IMAGEM ACIMA //'}
                      </div>
                    </div>
                    <textarea 
                      value={intro}
                      onChange={(e) => setIntro(e.target.value)}
                      className="w-full bg-neon-cyan/5 border border-neon-cyan/20 text-neon-cyan p-3 outline-none focus:border-neon-cyan h-full min-h-[160px]"
                      placeholder="INTRODUÇÃO"
                      translate="no"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-orbitron text-neon-cyan text-sm tracking-widest uppercase font-bold">// TÓPICOS DO DESENVOLVIMENTO</h3>
                      <button 
                        onClick={() => setPontos([...pontos, { id: Math.random().toString(36).substring(7), text: '' }])}
                        className="p-1 px-3 border border-neon-cyan/40 text-neon-cyan/60 hover:border-neon-cyan hover:text-neon-cyan transition-all flex items-center gap-2 font-orbitron text-[10px]"
                      >
                        <Plus className="w-3 h-3" />
                        ADICIONAR
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
                        <div className="py-8 border border-dashed border-neon-cyan/20 flex flex-col items-center justify-center gap-2 text-neon-cyan/30 bg-neon-cyan/5">
                          <Plus className="w-6 h-6 opacity-20" />
                          <span className="font-orbitron text-[10px] tracking-widest uppercase">Nenhum tópico adicionado</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <textarea 
                    value={apl}
                    onChange={(e) => setApl(e.target.value)}
                    className="w-full bg-neon-cyan/5 border border-neon-cyan/20 text-neon-cyan p-3 outline-none focus:border-neon-cyan min-h-[100px]"
                    placeholder="APLICAÇÃO E CONCLUSÃO"
                    translate="no"
                  />

                  <div className="space-y-2">
                    <label className="text-xs font-orbitron text-neon-cyan/60 uppercase tracking-widest">Setores Pregados (Ex: 55, 66)</label>
                    <div className="flex flex-wrap gap-2">
                      {setores.map((setor, i) => (
                        <div key={i} className="flex items-center bg-neon-yellow/10 border border-neon-yellow/30 px-2 py-1 rounded">
                          <span className="text-neon-yellow font-bold text-sm">{setor}</span>
                          <button 
                            type="button"
                            onClick={() => setSetores(setores.filter((_, idx) => idx !== i))}
                            className="ml-2 text-neon-pink hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <input 
                        type="text"
                        className="bg-neon-cyan/5 border border-neon-cyan/20 text-neon-cyan px-2 py-1 text-sm outline-none w-20"
                        placeholder="+"
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

                  <div className="flex justify-end gap-4 pt-4">
                    <button onClick={resetForm} className="px-6 py-2 border border-neon-pink/30 text-neon-pink/60 hover:text-neon-pink">CANCELAR</button>
                    <button onClick={handleSave} className="px-8 py-2 bg-neon-cyan/10 border border-neon-cyan text-neon-cyan font-bold hover:shadow-[0_0_15px_rgba(0,245,255,0.3)]">
                      {editId ? 'ATUALIZAR REGISTRO' : 'SALVAR REGISTRO'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredSermoes.map((s) => (
                <motion.div 
                  layout
                  key={s.id}
                  onClick={() => setSelectedSermonId(s.id!)}
                  className="group relative bg-card-bg border border-neon-cyan/15 p-4 cursor-pointer hover:bg-neon-cyan/5 hover:border-neon-cyan transition-all"
                >
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(s.id!);
                    }}
                    className="absolute top-2 right-2 z-20 w-8 h-8 flex items-center justify-center bg-dark-bg border border-neon-pink/50 text-neon-pink/80 hover:bg-neon-pink/20 hover:text-neon-pink transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  
                  {s.img ? (
                    <img src={s.img} className="w-full h-32 object-cover border-b-2 border-neon-pink opacity-80 group-hover:opacity-100 transition-opacity mb-4" />
                  ) : (
                    <div className="w-full h-32 bg-mid-bg flex items-center justify-center text-text-dim mb-4">
                      <BookOpen className="w-8 h-8" />
                    </div>
                  )}

                  {/* Sectors Badge */}
                  {s.setores && s.setores.length > 0 && (
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[80%]">
                      {s.setores.map((setor, idx) => (
                        <span key={idx} className="bg-dark-bg/80 border border-neon-yellow text-neon-yellow text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm shadow-[0_0_5px_rgba(255,238,0,0.3)]">
                          {setor}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <h3 className="font-rajdhani font-bold text-xl text-[#c8e8f5] group-hover:text-neon-cyan transition-colors" translate="no">
                    {s.tema}
                  </h3>
                  <p className="text-xs text-text-dim mt-2 font-mono truncate" translate="no">
                    {s.texto || '// SEM TEXTO BASE'}
                  </p>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          /* Pulpito Mode */
          <div className="fixed inset-0 z-[2000] bg-dark-bg overflow-y-auto p-6 md:p-12 font-rajdhani" translate="no">
            {/* Floating Timer */}
            <div className="fixed top-4 right-4 bg-black/90 border border-neon-green text-neon-green px-4 py-2 font-orbitron text-xl md:text-2xl font-bold shadow-[0_0_15px_rgba(0,255,136,0.2)] z-[2001] rounded-md">
              {formatTime(tempo)}
            </div>

            <div className="max-w-5xl mx-auto space-y-16 pb-32">
              {/* Header Section */}
              <div className="space-y-6 border-b border-neon-cyan/20 pb-10">
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-orbitron font-black text-neon-cyan leading-tight tracking-tight drop-shadow-[0_0_15px_rgba(0,245,255,0.4)]">
                  {selectedSermon?.tema}
                </h1>
                
                <div className="flex flex-wrap items-center gap-6 text-2xl md:text-3xl">
                  <div className="flex items-center gap-3 text-neon-yellow bg-neon-yellow/10 px-4 py-2 border border-neon-yellow/20 rounded-md">
                    <BookOpen className="w-8 h-8" />
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
                    <div className="text-neon-green/90 italic flex items-center gap-2">
                      <span className="text-neon-green font-bold">[🙌]</span>
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
                <section className="space-y-6 bg-neon-cyan/[0.03] p-8 border-l-4 border-neon-cyan/40">
                  <h4 className="font-orbitron text-neon-cyan/60 text-sm tracking-[0.4em] uppercase font-bold">
                    // INTRODUÇÃO
                  </h4>
                  <div className="text-xl md:text-2xl lg:text-3xl leading-relaxed text-text-mid whitespace-pre-wrap font-medium">
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
                <h4 className="font-orbitron text-neon-yellow/60 text-sm tracking-[0.4em] uppercase font-bold">
                  // DESENVOLVIMENTO
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
                <section className="space-y-6 bg-neon-pink/[0.03] p-8 border-l-4 border-neon-pink/40">
                  <h4 className="font-orbitron text-neon-pink/60 text-sm tracking-[0.4em] uppercase font-bold">
                    // APLICAÇÃO & CONCLUSÃO
                  </h4>
                  <div className="text-xl md:text-2xl lg:text-3xl leading-relaxed text-text-mid whitespace-pre-wrap font-medium">
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
                  onClick={() => setMode('grid')}
                  className="group flex items-center gap-2 px-6 py-2 border border-neon-pink/40 text-neon-pink/60 font-orbitron text-[10px] tracking-[0.3em] uppercase hover:border-neon-pink hover:text-neon-pink hover:bg-neon-pink/5 transition-all duration-500 rounded-sm"
                >
                  <LogOut className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                  ENCERRAR SESSÃO
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Details */}
      <AnimatePresence>
        {selectedSermonId && selectedSermon && mode === 'grid' && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card-bg border border-neon-cyan w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 relative shadow-[0_0_50px_rgba(0,245,255,0.1)]"
            >
              <button 
                onClick={() => setSelectedSermonId(null)}
                className="absolute top-4 right-4 text-text-dim hover:text-neon-pink transition-colors"
              >
                <X className="w-8 h-8" />
              </button>

              <div className="space-y-6">
                <h2 className="text-3xl md:text-4xl font-orbitron font-black text-neon-cyan" translate="no">
                  {selectedSermon.tema}
                </h2>
                <div className="text-lg md:text-xl text-neon-yellow font-rajdhani flex items-center gap-2">
                  <BookOpen className="w-5 h-5 flex-shrink-0" />
                  <HighlightableText 
                    text={selectedSermon.texto || ''} 
                    sermonId={selectedSermon.id!} 
                    sectionKey="texto" 
                    highlights={selectedSermon.highlights}
                    onHighlight={(key, color) => handleHighlight(selectedSermon.id!, key, color)}
                  />
                </div>
                
                {selectedSermon.agr && (
                  <p className="text-text-mid">
                    <span className="font-bold text-neon-green">[🙌] AGRADECIMENTOS:</span> {selectedSermon.agr}
                  </p>
                )}

                <div className="space-y-4">
                  <h4 className="font-rajdhani text-neon-yellow text-lg border-b border-neon-cyan/20 pb-2 uppercase tracking-widest">// INTRODUÇÃO</h4>
                  <div className="whitespace-pre-wrap text-text-mid leading-relaxed text-lg">
                    <HighlightableText 
                      text={selectedSermon.intro} 
                      sermonId={selectedSermon.id!} 
                      sectionKey="intro" 
                      highlights={selectedSermon.highlights}
                      onHighlight={(key, color) => handleHighlight(selectedSermon.id!, key, color)}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-rajdhani text-neon-yellow text-lg border-b border-neon-cyan/20 pb-2 uppercase tracking-widest">// DESENVOLVIMENTO</h4>
                  <div className="space-y-3">
                    {selectedSermon.pontos.map((p, i) => (
                      <div key={i} className="flex gap-4 items-start bg-neon-cyan/5 p-4 border-l-2 border-neon-cyan">
                        <input type="checkbox" className="mt-1 accent-neon-pink w-5 h-5" />
                        <div className="whitespace-pre-wrap text-text-mid">
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

                <div className="space-y-4">
                  <h4 className="font-rajdhani text-neon-yellow text-lg border-b border-neon-cyan/20 pb-2 uppercase tracking-widest">// APLICAÇÃO</h4>
                  <div className="whitespace-pre-wrap text-text-mid leading-relaxed text-lg">
                    <HighlightableText 
                      text={selectedSermon.apl} 
                      sermonId={selectedSermon.id!} 
                      sectionKey="apl" 
                      highlights={selectedSermon.highlights}
                      onHighlight={(key, color) => handleHighlight(selectedSermon.id!, key, color)}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-8 border-t border-neon-cyan/20">
                  <button 
                    onClick={() => setShowDeleteConfirm(selectedSermon.id!)}
                    className="px-6 py-2 border border-neon-pink/30 text-neon-pink/60 hover:text-neon-pink hover:bg-neon-pink/10"
                  >
                    DELETAR
                  </button>
                  <button 
                    onClick={() => handleEdit(selectedSermon)}
                    className="px-6 py-2 border border-neon-yellow/30 text-neon-yellow/60 hover:text-neon-yellow hover:bg-neon-yellow/10"
                  >
                    EDITAR
                  </button>
                  <button 
                    onClick={() => setSelectedSermonId(null)}
                    className="px-6 py-2 border border-neon-cyan/30 text-neon-cyan/60 hover:text-neon-cyan"
                  >
                    VOLTAR
                  </button>
                  <button 
                    onClick={() => {
                      setMode('pulpito');
                    }}
                    className="px-8 py-2 bg-neon-green/10 border border-neon-green text-neon-green font-bold hover:shadow-[0_0_15px_rgba(0,255,136,0.3)] flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    INICIAR PÚLPITO
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
              className="bg-card-bg border border-neon-pink p-8 max-w-md w-full space-y-6 text-center shadow-[0_0_30px_rgba(255,0,170,0.2)]"
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
                  className="px-6 py-2 bg-neon-pink/10 border border-neon-pink text-neon-pink font-bold hover:shadow-[0_0_15px_rgba(255,0,170,0.3)]"
                >
                  DELETAR AGORA
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
