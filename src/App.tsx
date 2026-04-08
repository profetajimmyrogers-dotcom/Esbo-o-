/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  where, 
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
import { Sermon } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Plus, 
  X, 
  Image as ImageIcon, 
  Trash2, 
  Edit3, 
  ChevronLeft, 
  Play, 
  LogOut, 
  LogIn,
  BookOpen,
  User as UserIcon
} from 'lucide-react';
import { cn } from './lib/utils';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In a real app, you'd show a toast or alert
}

// --- Components ---

const PulpitoTopic = ({ 
  p, 
  i, 
  sermonId, 
  highlights, 
  onHighlight 
}: { 
  p: string; 
  i: number; 
  sermonId: string; 
  highlights?: Record<string, string>;
  onHighlight: (key: string, color: string) => void;
}) => {
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

const HighlightableText = ({ 
  text, 
  sermonId, 
  sectionKey, 
  highlights, 
  onHighlight 
}: { 
  text: string; 
  sermonId: string; 
  sectionKey: string; 
  highlights?: Record<string, string>;
  onHighlight: (key: string, color: string) => void;
}) => {
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

const PulpitoSectors = ({ setores, onAdd }: { setores: string[], onAdd: (s: string) => void }) => {
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sermoes, setSermoes] = useState<Sermon[]>([]);
  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedSermonId, setSelectedSermonId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [mode, setMode] = useState<'grid' | 'pulpito'>('grid');
  
  const selectedSermon = sermoes.find(s => s.id === selectedSermonId) || null;
  
  // Form State
  const [tema, setTema] = useState('');
  const [texto, setTexto] = useState('');
  const [agr, setAgr] = useState('');
  const [img, setImg] = useState('');
  const [intro, setIntro] = useState('');
  const [pontos, setPontos] = useState<string[]>([]);
  const [setores, setSetores] = useState<string[]>([]);
  const [apl, setApl] = useState('');

  // Timer State
  const [tempo, setTempo] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setSermoes([]);
      return;
    }

    const q = query(
      collection(db, 'sermoes'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sermon));
      setSermoes(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sermoes');
    });

    return () => unsubscribe();
  }, [user]);

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

  const handleSave = async () => {
    if (!user || !tema) return;

    const data: any = {
      userId: user.uid,
      tema,
      texto,
      agr,
      img,
      intro,
      pontos,
      setores,
      apl,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editId) {
        await updateDoc(doc(db, 'sermoes', editId), data);
      } else {
        data.createdAt = serverTimestamp();
        data.highlights = {};
        await addDoc(collection(db, 'sermoes'), data);
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
    setPontos(s.pontos);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-neon-cyan font-orbitron animate-pulse">LOADING SYSTEM...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-4xl md:text-6xl font-orbitron font-black bg-gradient-to-br from-neon-cyan to-neon-pink bg-clip-text text-transparent animate-logo-flicker">
              SYSTEMA SERMÕES
            </h1>
            <p className="font-rajdhani tracking-[0.3em] text-text-dim text-sm">
              // GERENCIADOR DE PREGAÇÕES v3.0 //
            </p>
          </div>
          
          <button 
            onClick={loginWithGoogle}
            className="flex items-center gap-3 bg-transparent border border-neon-cyan px-8 py-4 font-orbitron font-bold text-neon-cyan hover:bg-neon-cyan/10 transition-all hover:shadow-[0_0_20px_rgba(0,245,255,0.3)] group"
          >
            <LogIn className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            ACESSAR SISTEMA
          </button>
        </motion.div>
      </div>
    );
  }

  const filteredSermoes = sermoes.filter(s => s.tema.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="relative z-10 pb-20">
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
            <span className="text-sm">{user.displayName}</span>
          </div>
          <button 
            onClick={logout}
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
                    />
                    <input 
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      className="w-full bg-neon-cyan/5 border border-neon-cyan/20 text-neon-cyan p-3 outline-none focus:border-neon-cyan"
                      placeholder="TEXTO BÍBLICO BASE"
                    />
                  </div>

                  <input 
                    value={agr}
                    onChange={(e) => setAgr(e.target.value)}
                    className="w-full bg-neon-cyan/5 border border-neon-cyan/20 text-neon-cyan p-3 outline-none focus:border-neon-cyan"
                    placeholder="AGRADECIMENTOS INICIAIS"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleUpload}
                        className="w-full bg-neon-cyan/5 border border-neon-cyan/20 text-neon-cyan p-2 outline-none"
                      />
                      <div className="h-40 bg-black/50 border border-dashed border-neon-cyan/30 flex items-center justify-center overflow-hidden text-text-dim">
                        {img ? <img src={img} className="w-full h-full object-cover opacity-80" /> : '// IMAGEM NÃO CARREGADA //'}
                      </div>
                    </div>
                    <textarea 
                      value={intro}
                      onChange={(e) => setIntro(e.target.value)}
                      className="w-full bg-neon-cyan/5 border border-neon-cyan/20 text-neon-cyan p-3 outline-none focus:border-neon-cyan h-full min-h-[160px]"
                      placeholder="INTRODUÇÃO"
                    />
                  </div>

                  <div className="space-y-2">
                    {pontos.map((p, i) => (
                      <div key={i} className="flex gap-2">
                        <textarea 
                          value={p}
                          onChange={(e) => {
                            const newPontos = [...pontos];
                            newPontos[i] = e.target.value;
                            setPontos(newPontos);
                          }}
                          className="flex-1 bg-neon-cyan/5 border border-neon-cyan/20 text-neon-cyan p-3 outline-none focus:border-neon-cyan"
                          placeholder={`TÓPICO ${i + 1}`}
                        />
                        <button 
                          onClick={() => setPontos(pontos.filter((_, idx) => idx !== i))}
                          className="p-3 border border-neon-pink/30 text-neon-pink hover:bg-neon-pink/10"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => setPontos([...pontos, ''])}
                      className="w-full border border-neon-cyan/30 text-neon-cyan/60 py-2 hover:text-neon-cyan hover:border-neon-cyan transition-all"
                    >
                      [+] ADICIONAR TÓPICO
                    </button>
                  </div>

                  <textarea 
                    value={apl}
                    onChange={(e) => setApl(e.target.value)}
                    className="w-full bg-neon-cyan/5 border border-neon-cyan/20 text-neon-cyan p-3 outline-none focus:border-neon-cyan min-h-[100px]"
                    placeholder="APLICAÇÃO E CONCLUSÃO"
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
                  
                  <h3 className="font-rajdhani font-bold text-xl text-[#c8e8f5] group-hover:text-neon-cyan transition-colors">
                    {s.tema}
                  </h3>
                  <p className="text-xs text-text-dim mt-2 font-mono truncate">
                    {s.texto || '// SEM TEXTO BASE'}
                  </p>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          /* Pulpito Mode */
          <div className="fixed inset-0 z-[2000] bg-dark-bg overflow-y-auto p-6 md:p-12 font-rajdhani">
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
                  <div className="text-2xl md:text-3xl lg:text-4xl leading-relaxed text-text-mid whitespace-pre-wrap font-medium">
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
                  <div className="text-2xl md:text-3xl lg:text-4xl leading-relaxed text-text-mid whitespace-pre-wrap font-medium">
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
                <h2 className="text-4xl font-orbitron font-black text-neon-cyan">{selectedSermon.tema}</h2>
                <p className="text-xl text-neon-yellow font-rajdhani flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  {selectedSermon.texto}
                </p>
                
                {selectedSermon.agr && (
                  <p className="text-text-mid">
                    <span className="font-bold text-neon-green">[🙌] AGRADECIMENTOS:</span> {selectedSermon.agr}
                  </p>
                )}

                <div className="space-y-4">
                  <h4 className="font-rajdhani text-neon-yellow text-xl border-b border-neon-cyan/20 pb-2">// INTRODUÇÃO</h4>
                  <p className="whitespace-pre-wrap text-text-mid leading-relaxed">{selectedSermon.intro}</p>
                </div>

                <div className="space-y-4">
                  <h4 className="font-rajdhani text-neon-yellow text-xl border-b border-neon-cyan/20 pb-2">// DESENVOLVIMENTO</h4>
                  <div className="space-y-3">
                    {selectedSermon.pontos.map((p, i) => (
                      <div key={i} className="flex gap-4 items-start bg-neon-cyan/5 p-4 border-l-2 border-neon-cyan">
                        <input type="checkbox" className="mt-1 accent-neon-pink" />
                        <p className="whitespace-pre-wrap text-text-mid">{p}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-rajdhani text-neon-yellow text-xl border-b border-neon-cyan/20 pb-2">// APLICAÇÃO</h4>
                  <p className="whitespace-pre-wrap text-text-mid leading-relaxed">{selectedSermon.apl}</p>
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
