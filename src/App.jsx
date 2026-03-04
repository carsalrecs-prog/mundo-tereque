import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, getBaseRef } from './firebase';
import { marked } from 'marked';
import {
    Heart, Download, Trash2, Edit2, Search, User,
    Plus, X, Sparkles, Check, Dices as Dice, Calendar as CalendarIcon,
    Clock, Repeat, Image as ImageIcon, Bold as BoldIcon,
    Italic as ItalicIcon, GitCommit, Settings as SettingsIcon
} from 'lucide-react';

const GEMINI_MODELS_TO_TRY = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash", "gemini-3.0-flash", "gemini-flash-latest"];
const apiKey = "AIzaSyATKMJQ-dfMG0_adq51eIDBswnH1twdlqM";

// --- CUSTOM COMPONENTS WITH MOTION ---
const Toast = ({ message, type = 'success', onClose }) => {
    useEffect(() => { const timer = setTimeout(onClose, 4000); return () => clearTimeout(timer); }, [onClose]);
    const bgClass = type === 'success' ? 'bg-green-900/80 border-green-500 text-green-100' : type === 'error' ? 'bg-red-900/80 border-red-500 text-red-100' : 'bg-blue-900/80 border-blue-500 text-blue-100';
    return (
        <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-4 md:bottom-4 md:top-auto right-4 left-4 md:left-auto ${bgClass} border px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-[100] backdrop-blur`}
        >
            <Check size={18} /><span className="font-bold">{message}</span>
        </motion.div>
    );
};

const ConfirmationModal = ({ isOpen, onClose, onConfirm, message }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="glass-panel p-8 rounded-3xl shadow-2xl max-w-sm w-full border border-white/10"
                    >
                        <h3 className="text-xl font-bold text-white mb-4">¿Estás seguro?</h3>
                        <p className="text-gray-400 mb-8 text-sm">{message}</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-gray-300 hover:bg-white/5 font-bold transition-colors text-sm">Cancelar</button>
                            <button onClick={onConfirm} className="px-5 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 font-bold shadow-lg transition-all active:scale-95 text-sm">Sí, confirmar</button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const Confetti = () => {
    const emojis = ['❤️', '✨', '🎉', '💖'];
    const pieces = Array.from({ length: 40 }).map((_, i) => ({
        id: i, emoji: emojis[Math.floor(Math.random() * emojis.length)],
        left: `${Math.random() * 100}vw`, animationDuration: `${Math.random() * 3 + 2}s`, animationDelay: `${Math.random() * 2}s`, fontSize: `${Math.random() * 15 + 15}px`, xOffset: Math.random() * 200 - 100
    }));
    return (
        <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
            {pieces.map(p => (
                <motion.div
                    key={p.id}
                    className="absolute top-[-10%]"
                    initial={{ y: '-10vh', x: 0, rotate: 0, opacity: 1 }}
                    animate={{ y: '110vh', x: p.xOffset, rotate: 360, opacity: 0 }}
                    transition={{ duration: parseFloat(p.animationDuration), delay: parseFloat(p.animationDelay), repeat: Infinity, ease: 'linear' }}
                    style={{ left: p.left, fontSize: p.fontSize }}
                >{p.emoji}</motion.div>
            ))}
        </div>
    );
};

export default function App() {
    const [user, setUser] = useState(null);
    const [activeProfile, setActiveProfile] = useState('novia');
    const [viewMode, setViewMode] = useState('wiki');

    const [entries, setEntries] = useState([]);
    const [categories, setCategories] = useState(['Básica', 'Gustos', 'Difícil / Profunda', 'Familia', 'Historia', 'Curiosidad']);
    const [pendingGames, setPendingGames] = useState([]);
    const [datesList, setDatesList] = useState([]);
    const [relationshipStart, setRelationshipStart] = useState(null);
    const [postItText, setPostItText] = useState("¡Que tengas un día hermoso! ❤️");
    const [isEditingPostIt, setIsEditingPostIt] = useState(false);

    const [formData, setFormData] = useState({ category: '', question: '', answer: '', imageUrl: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategoryFilter, setActiveCategoryFilter] = useState('Todas');
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [toast, setToast] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, type: null });
    const [showSettings, setShowSettings] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [visibleEntriesCount, setVisibleEntriesCount] = useState(15);

    const [aiQuery, setAiQuery] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [isAiThinking, setIsAiThinking] = useState(false);

    const [gameQuestion, setGameQuestion] = useState('');
    const [isGeneratingGame, setIsGeneratingGame] = useState(false);
    const [answerFlor, setAnswerFlor] = useState('');
    const [answerTereque, setAnswerTereque] = useState('');
    const [pendingAnswers, setPendingAnswers] = useState({});

    const [newDateTitle, setNewDateTitle] = useState('');
    const [newDateValue, setNewDateValue] = useState('');
    const [newDateRepeats, setNewDateRepeats] = useState(true);
    const [showDateInput, setShowDateInput] = useState(false);
    const [editingDateId, setEditingDateId] = useState(null);

    const answerRef = useRef(null);

    useEffect(() => {
        const initAuth = async () => {
            try {
                if (!auth.currentUser) await auth.signInAnonymously();
            } catch (error) {
                console.error("Auth Error:", error);
                showToast("Iniciando offline.", 'info');
            }
        };
        initAuth();
        const unsubscribe = auth.onAuthStateChanged((u) => setUser(u));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;
        const wikiRef = getBaseRef().collection('wiki_entries');
        const unsubWiki = wikiRef.onSnapshot((snapshot) => {
            const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp);
            setEntries(loaded);
        }, (error) => console.error(error));

        const pendingRef = getBaseRef().collection('pending_games');
        const unsubPend = pendingRef.onSnapshot((snapshot) => {
            const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp);
            setPendingGames(loaded);
        }, (error) => console.error(error));

        const datesRef = getBaseRef().collection('important_dates');
        const unsubDates = datesRef.onSnapshot((snapshot) => {
            const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDatesList(loaded);
            checkUpcomingDates(loaded);
        }, (error) => console.error(error));

        const settingsRef = getBaseRef().collection('settings');
        const unsubRel = settingsRef.doc('relationship').onSnapshot(doc => { if (doc.exists) setRelationshipStart(doc.data().date); });
        const unsubCat = settingsRef.doc('categories').onSnapshot(doc => { if (doc.exists) setCategories(doc.data().list || ['Básica']); });
        const unsubPostit = settingsRef.doc('postit').onSnapshot(doc => { if (doc.exists) setPostItText(doc.data().text || "¡Que tengas un día hermoso! ❤️"); });

        return () => { unsubWiki(); unsubPend(); unsubDates(); unsubRel(); unsubCat(); unsubPostit(); };
    }, [user]);

    const showToast = (message, type = 'success') => { setToast({ message, type }); };

    useEffect(() => { if (!formData.category && categories.length > 0) setFormData(prev => ({ ...prev, category: categories[0] })); }, [categories]);

    useEffect(() => {
        if (activeProfile === 'novia') document.body.style.background = "radial-gradient(ellipse at top, #4a0404 0%, #0a0000 100%)";
        else document.body.style.background = "radial-gradient(ellipse at top, #0f172a 0%, #020617 100%)";
        setEditingId(null);
        setFormData(prev => ({ category: categories[0] || '', question: '', answer: '', imageUrl: '' }));
        setEditingDateId(null); setNewDateTitle(''); setNewDateValue(''); setNewDateRepeats(true);
        setVisibleEntriesCount(15);
        setAiQuery(''); setAiResponse('');
    }, [activeProfile, viewMode]);

    const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const insertFormatting = (prefix, suffix = '') => {
        const textarea = answerRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentText = formData.answer;
        const newText = currentText.substring(0, start) + prefix + currentText.substring(start, end) + suffix + currentText.substring(end);
        setFormData(prev => ({ ...prev, answer: newText }));
        setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + prefix.length, start + prefix.length + (end - start)); }, 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) return showToast("Conectando...", 'error');
        const data = { target: activeProfile, category: formData.category, question: formData.question, answer: formData.answer, imageUrl: formData.imageUrl || null, date: new Date().toLocaleDateString(), timestamp: Date.now() };
        try {
            if (editingId) { await getBaseRef().collection('wiki_entries').doc(editingId).update(data); showToast("Actualizado ✨"); setEditingId(null); }
            else { await getBaseRef().collection('wiki_entries').add(data); showToast("Guardado ❤️"); }
            setFormData(prev => ({ ...prev, question: '', answer: '', imageUrl: '' }));
        } catch (err) { showToast("Error al guardar", 'error'); }
    };

    const handleEdit = (e) => { setEditingId(e.id); setFormData({ category: e.category, question: e.question, answer: e.answer, imageUrl: e.imageUrl || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); showToast("Editando...", 'info'); };
    const handleCancelEdit = () => { setEditingId(null); setFormData(prev => ({ ...prev, question: '', answer: '', imageUrl: '' })); };

    const confirmDelete = async () => {
        const { id, type } = deleteModal;
        if (!id) return;
        try {
            if (type === 'wiki') { await getBaseRef().collection('wiki_entries').doc(id).delete(); if (editingId === id) handleCancelEdit(); showToast("Eliminado 🗑️"); }
            else if (type === 'game_skip') { await getBaseRef().collection('pending_games').doc(id).delete(); showToast("Descartado"); }
            else if (type === 'date') { await getBaseRef().collection('important_dates').doc(id).delete(); showToast("Fecha eliminada"); }
        } catch (e) { showToast("Error", "error"); }
        setDeleteModal({ isOpen: false, id: null, type: null });
    };

    const handleAddCategory = async () => {
        if (newCategoryName.trim() && !categories.includes(newCategoryName)) {
            const newCats = [...categories, newCategoryName];
            await getBaseRef().collection('settings').doc('categories').set({ list: newCats });
            setFormData(prev => ({ ...prev, category: newCategoryName })); setNewCategoryName(''); setIsAddingCategory(false);
        }
    };

    const fetchAI = async (prompt) => {
        for (const model of GEMINI_MODELS_TO_TRY) {
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });
                const d = await res.json();
                if (d.error) continue;
                return d.candidates?.[0]?.content?.parts?.[0]?.text || "La IA no respondió.";
            } catch (e) { continue; }
        }
        return `⚠️ Fallo de IA`;
    };

    const handleAskAI = async (e) => {
        e.preventDefault();
        if (!aiQuery.trim()) return;
        setIsAiThinking(true);
        const context = entries.filter(x => x.target === activeProfile).map(x => `- ${x.category}: P:${x.question} R:${x.answer}`).join("\n");
        const resp = await fetchAI(`Eres un experto en la relación de ${activeProfile === 'novia' ? 'Flor' : 'Terequito'}. Basado estrictamente en estos datos: ${context}. Responde: ${aiQuery}. Sé breve y muy romántico.`);
        setAiResponse(resp);
        setIsAiThinking(false);
    };

    const handleGenerateGameQuestion = async () => {
        setIsGeneratingGame(true); setGameQuestion(''); setAnswerFlor(''); setAnswerTereque('');
        const q = await fetchAI("Genera una sola pregunta profunda, romántica o divertida para parejas (Flor y Terequito) para conocerse mejor. Escribe únicamente la pregunta directamente, sin intros ni comillas.");
        setGameQuestion(q); setIsGeneratingGame(false);
    };

    const handleSaveActiveGame = async () => {
        if (!gameQuestion) return;
        const hF = !!answerFlor.trim(), hT = !!answerTereque.trim();
        if (!hF && !hT) return showToast("Escribe algo", 'error');
        if (hF && hT) {
            await getBaseRef().collection('wiki_entries').add({ target: 'novia', category: 'Juego AI 🎲', question: gameQuestion, answer: answerFlor, date: new Date().toLocaleDateString(), timestamp: Date.now() });
            await getBaseRef().collection('wiki_entries').add({ target: 'novio', category: 'Juego AI 🎲', question: gameQuestion, answer: answerTereque, date: new Date().toLocaleDateString(), timestamp: Date.now() + 1 });
            showToast("¡Completado! 🎉"); setGameQuestion(''); setAnswerFlor(''); setAnswerTereque('');
        } else {
            await getBaseRef().collection('pending_games').add({ question: gameQuestion, answerFlor, answerTereque, timestamp: Date.now() });
            showToast("Guardado en pendientes ⏳"); setGameQuestion(''); setAnswerFlor(''); setAnswerTereque('');
        }
    };

    const handleCompletePendingGame = async (game) => {
        const nF = pendingAnswers[`${game.id}_flor`] || game.answerFlor || '';
        const nT = pendingAnswers[`${game.id}_tereque`] || game.answerTereque || '';
        if (!nF.trim() || !nT.trim()) return;
        await getBaseRef().collection('wiki_entries').add({ target: 'novia', category: 'Juego AI 🎲', question: game.question, answer: nF, date: new Date().toLocaleDateString(), timestamp: Date.now() });
        await getBaseRef().collection('wiki_entries').add({ target: 'novio', category: 'Juego AI 🎲', question: game.question, answer: nT, date: new Date().toLocaleDateString(), timestamp: Date.now() + 1 });
        await getBaseRef().collection('pending_games').doc(game.id).delete();
        showToast("¡Turno completado! 🎉");
    };

    const handleSaveDate = async (e) => {
        e.preventDefault();
        if (!newDateTitle || !newDateValue) return;
        try {
            if (editingDateId) { await getBaseRef().collection('important_dates').doc(editingDateId).update({ title: newDateTitle, date: newDateValue, repeats: newDateRepeats }); showToast("Fecha actualizada ✨"); setEditingDateId(null); }
            else { await getBaseRef().collection('important_dates').add({ title: newDateTitle, date: newDateValue, repeats: newDateRepeats, timestamp: Date.now() }); showToast("Fecha guardada 📅"); }
            setNewDateTitle(''); setNewDateValue(''); setNewDateRepeats(true);
        } catch (error) { showToast("Error al guardar", 'error'); }
    };

    const getDaysUntil = (dateObjOrString) => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dateString = typeof dateObjOrString === 'string' ? dateObjOrString : dateObjOrString.date;
        const repeats = typeof dateObjOrString === 'string' ? true : (dateObjOrString.repeats !== false);
        const [y, m, d] = dateString.split('-').map(Number);
        if (repeats) {
            let target = new Date(today.getFullYear(), m - 1, d);
            if (target < today) target.setFullYear(today.getFullYear() + 1);
            return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
        } else {
            let target = new Date(y, m - 1, d);
            return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
        }
    };

    const calculateDuration = (dateString) => {
        if (!dateString) return { years: 0, months: 0, days: 0 };
        const [y, m, d] = dateString.split('-').map(Number);
        const start = new Date(y, m - 1, d);
        const now = new Date(); now.setHours(0, 0, 0, 0);
        let years = now.getFullYear() - start.getFullYear(); let months = now.getMonth() - start.getMonth(); let days = now.getDate() - start.getDate();
        if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
        if (months < 0) { years--; months += 12; }
        return { years, months, days };
    };

    const checkUpcomingDates = (dates) => {
        const upcoming = dates.filter(d => { const days = getDaysUntil(d); return days >= 0 && days <= 3; });
        setShowConfetti(upcoming.some(d => getDaysUntil(d) === 0));
    };

    const getTimelineData = () => {
        const timeline = [];
        if (relationshipStart) timeline.push({ id: 'start', type: 'start', title: 'Inicio de la Historia', date: relationshipStart, sortDate: new Date(relationshipStart).getTime() });
        datesList.forEach(d => { timeline.push({ ...d, type: 'date', sortDate: new Date(d.date).getTime() }); });
        entries.forEach(e => { if (e.timestamp) timeline.push({ ...e, type: 'wiki', title: e.question, sortDate: e.timestamp }); });
        return timeline.sort((a, b) => b.sortDate - a.sortDate);
    };

    const filteredEntries = entries.filter(e => {
        if (e.target !== activeProfile) return false;
        if (activeCategoryFilter !== 'Todas' && e.category !== activeCategoryFilter) return false;
        if (searchTerm && !e.question.toLowerCase().includes(searchTerm.toLowerCase()) && !e.answer.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    const renderMarkdown = (text) => {
        try { return marked.parse(text || ''); } catch (e) { return text; }
    };

    if (!user) return <div className="min-h-screen flex flex-col items-center justify-center text-gray-400"><div className="spinner border-rose-500 mb-4"></div>Conectando a tu Nube...</div>;

    const theme = activeProfile === 'novia'
        ? { accent: 'text-rose-500', bg: 'bg-rose-900', hover: 'hover:bg-rose-800', border: 'border-rose-900/50', glow: 'shadow-[0_0_25px_rgba(225,29,72,0.3)]' }
        : { accent: 'text-sky-500', bg: 'bg-sky-900', hover: 'hover:bg-sky-800', border: 'border-sky-900/50', glow: 'shadow-[0_0_25px_rgba(14,165,233,0.3)]' };

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
            <AnimatePresence>{showConfetti && <Confetti />}</AnimatePresence>
            <AnimatePresence>{toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}</AnimatePresence>
            <ConfirmationModal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({ isOpen: false })} onConfirm={confirmDelete} message="Esta acción no se puede deshacer." />

            {/* SETTINGS MODAL */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="glass-panel p-8 rounded-3xl max-w-md w-full" style={{ backgroundColor: '#0f172a' }}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-bold text-white flex items-center gap-3"><SettingsIcon /> Cuenta</h3>
                                <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white"><X size={24} /></button>
                            </div>
                            <div className="space-y-6">
                                <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-sm text-gray-300 leading-relaxed">
                                    Tus datos se guardan en la Nube. La versión completa no requiere login extra si no deseas perderla limpia la cache.
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* DESKTOP HEADER */}
            <header className="hidden md:flex mb-8 glass-panel p-3 rounded-3xl flex-wrap justify-between gap-4 sticky top-4 z-50 bg-[#0f172a]/80 backdrop-blur-xl">
                <div className="flex gap-2 items-center">
                    <button onClick={() => setViewMode('wiki')} className={`px-4 py-2 rounded-xl font-bold flex gap-2 transition-all ${viewMode === 'wiki' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}><Search size={20} /> Wiki</button>
                    <button onClick={() => setViewMode('game')} className={`px-4 py-2 rounded-xl font-bold flex gap-2 transition-all ${viewMode === 'game' ? 'bg-purple-900/50 text-purple-200 shadow-lg border border-purple-500/30' : 'text-gray-500 hover:text-gray-300'}`}><Dice size={20} /> Juego {pendingGames.length > 0 && <span className="bg-red-600 text-white text-xs px-1.5 rounded-full ml-1">{pendingGames.length}</span>}</button>
                    <button onClick={() => setViewMode('dates')} className={`px-4 py-2 rounded-xl font-bold flex gap-2 transition-all ${viewMode === 'dates' ? 'bg-orange-900/50 text-orange-200 shadow-lg border border-orange-500/30' : 'text-gray-500 hover:text-gray-300'}`}><CalendarIcon size={20} /> Fechas</button>
                    <button onClick={() => setViewMode('timeline')} className={`px-4 py-2 rounded-xl font-bold flex gap-2 transition-all ${viewMode === 'timeline' ? 'bg-green-900/50 text-green-200 shadow-lg border border-green-500/30' : 'text-gray-500 hover:text-gray-300'}`}><GitCommit size={20} /> Historia</button>
                </div>
                <div className="flex items-center gap-4">
                    {viewMode === 'wiki' && (
                        <div className="flex bg-black/30 p-1 rounded-xl border border-white/5">
                            <button onClick={() => setActiveProfile('novia')} className={`px-4 py-1.5 rounded-lg font-bold flex gap-2 text-sm transition-all ${activeProfile === 'novia' ? 'bg-rose-900/80 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}><Heart size={14} className={activeProfile === 'novia' ? 'fill-current' : ''} /> Flor</button>
                            <button onClick={() => setActiveProfile('novio')} className={`px-4 py-1.5 rounded-lg font-bold flex gap-2 text-sm transition-all ${activeProfile === 'novio' ? 'bg-sky-900/80 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}><User size={14} className={activeProfile === 'novio' ? 'fill-current' : ''} /> Terequito</button>
                        </div>
                    )}
                    <button onClick={() => setShowSettings(true)} className="p-2 text-gray-500 hover:text-white transition-colors"><SettingsIcon size={22} /></button>
                </div>
            </header>

            {/* MOBILE BOTTOM NAV */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f172a]/95 backdrop-blur-xl border-t border-white/10 p-3 px-6 flex justify-between z-50 items-center pb-safe">
                <button onClick={() => setViewMode('wiki')} className={`flex flex-col items-center p-2 rounded-xl transition-all active:scale-95 ${viewMode === 'wiki' ? theme.accent : 'text-gray-400 hover:text-gray-300'}`}><Search size={24} /><span className="text-xs font-bold mt-1">Wiki</span></button>
                <button onClick={() => setViewMode('game')} className={`flex flex-col items-center p-2 rounded-xl relative transition-all active:scale-95 ${viewMode === 'game' ? 'text-purple-400' : 'text-gray-400 hover:text-gray-300'}`}><Dice size={24} />{pendingGames.length > 0 && <span className="absolute top-1 right-2 w-3 h-3 bg-red-500 rounded-full"></span>}<span className="text-xs font-bold mt-1">Juego</span></button>
                <button onClick={() => setViewMode('dates')} className={`flex flex-col items-center p-2 rounded-xl transition-all active:scale-95 ${viewMode === 'dates' ? 'text-orange-400' : 'text-gray-400 hover:text-gray-300'}`}><CalendarIcon size={24} /><span className="text-xs font-bold mt-1">Fechas</span></button>
                <button onClick={() => setViewMode('timeline')} className={`flex flex-col items-center p-2 rounded-xl transition-all active:scale-95 ${viewMode === 'timeline' ? 'text-green-400' : 'text-gray-400 hover:text-gray-300'}`}><GitCommit size={24} /><span className="text-xs font-bold mt-1">Historia</span></button>
            </nav>

            {/* MOBILE TOP HEADER & PROFILE SELECTOR */}
            <div className="md:hidden mb-6 flex flex-col gap-4">
                <header className="flex justify-between items-center glass-panel p-4 rounded-2xl sticky top-4 z-40 bg-[#0f172a]/90 backdrop-blur-xl border-b border-white/10 mx-2 shadow-lg">
                    <div className="flex items-center gap-2">
                        <Heart size={20} className={activeProfile === 'novia' ? 'text-rose-500 fill-current' : 'text-sky-500 fill-current'} />
                        <h1 className="text-xl font-bold text-white tracking-tight">Mundo Tereque</h1>
                    </div>
                </header>

                {viewMode === 'wiki' && (
                    <div className="flex justify-center">
                        <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                            <button onClick={() => setActiveProfile('novia')} className={`px-6 py-2 rounded-xl font-bold flex gap-2 text-sm transition-all active:scale-95 ${activeProfile === 'novia' ? 'bg-rose-900/90 text-white shadow-md' : 'text-gray-400'}`}><Heart size={16} className={activeProfile === 'novia' ? 'fill-current' : ''} /> Flor</button>
                            <button onClick={() => setActiveProfile('novio')} className={`px-6 py-2 rounded-xl font-bold flex gap-2 text-sm transition-all active:scale-95 ${activeProfile === 'novio' ? 'bg-sky-900/90 text-white shadow-md' : 'text-gray-400'}`}><User size={16} className={activeProfile === 'novio' ? 'fill-current' : ''} /> Terequito</button>
                        </div>
                    </div>
                )}
            </div>

            {/* MAIN CONTENT WITH FRAMER MOTION TRANSITIONS */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={viewMode}
                    initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                    transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
                >
                    {viewMode === 'timeline' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <h2 className="text-3xl font-bold mb-8 text-center text-green-200">Nuestra Línea de Tiempo</h2>
                            <div className="relative border-l-2 border-white/20 pl-6 ml-4 space-y-8">
                                {getTimelineData().map((item, idx) => (
                                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }} key={idx} className="relative">
                                        <div className={`absolute -left-[35px] w-6 h-6 rounded-full border-4 border-[#0f172a] flex items-center justify-center ${item.type === 'start' ? 'bg-red-500' : item.type === 'date' ? 'bg-orange-500' : 'bg-blue-500'}`}>
                                            {item.type === 'start' && <Heart size={10} className="text-white fill-white" />}
                                        </div>
                                        <div className="glass-panel p-5 rounded-2xl border border-white/5 hover:bg-white/5 transition-all">
                                            <span className="text-xs text-gray-400 font-bold tracking-wider mb-2 block">{item.date || new Date(item.timestamp).toLocaleDateString()}</span>
                                            <h3 className={`font-bold text-lg mb-1 ${item.type === 'start' ? 'text-red-400' : item.type === 'date' ? 'text-orange-300' : 'text-white'}`}>{item.title}</h3>
                                            {item.type === 'wiki' && <p className="text-sm text-gray-300 opacity-80 mt-2 line-clamp-2">{item.answer}</p>}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}

                    {viewMode === 'dates' && (
                        <div className="max-w-3xl mx-auto space-y-8">
                            {/* Fechas content */}
                            <div className="glass-panel p-8 rounded-3xl shadow-xl border-t-2 border-orange-500 relative overflow-hidden">
                                <h2 className="text-3xl font-bold text-orange-200 mb-6 flex items-center gap-3"><Heart className="text-red-500" /> Nuestra Historia</h2>
                                {relationshipStart && !showDateInput ? (
                                    <div className="space-y-6 relative z-10">
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10"><p className="text-3xl md:text-4xl font-bold text-white">{calculateDuration(relationshipStart).years}</p></div>
                                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10"><p className="text-3xl md:text-4xl font-bold text-white">{calculateDuration(relationshipStart).months}</p></div>
                                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10"><p className="text-3xl md:text-4xl font-bold text-white">{calculateDuration(relationshipStart).days}</p></div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 relative z-10">
                                        <div className="flex gap-2 justify-center">
                                            <input type="date" value={newDateValue} onChange={e => setNewDateValue(e.target.value)} className="p-3 border rounded-xl" />
                                            <button onClick={async () => { if (newDateValue) { await getBaseRef().collection('settings').doc('relationship').set({ date: newDateValue }); setShowDateInput(false); } }} className="bg-orange-700 text-white px-6 py-3 rounded-xl font-bold shadow hover:bg-orange-600">Guardar</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {viewMode === 'game' && (
                        <div className="max-w-3xl mx-auto space-y-8">
                            <div className="glass-panel p-8 rounded-3xl text-center relative overflow-hidden border-t-4 border-purple-600">
                                <h2 className="text-3xl font-bold mb-6 relative z-10 text-white drop-shadow-md">✨ Preguntas Mágicas ✨</h2>
                                {!gameQuestion ? (
                                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleGenerateGameQuestion} disabled={isGeneratingGame} className="bg-purple-900/50 text-purple-200 px-8 py-4 rounded-2xl font-bold shadow-lg flex items-center gap-3 mx-auto relative z-10 border border-purple-500/30">
                                        {isGeneratingGame ? <div className="spinner border-purple-400" /> : <><Sparkles /> Generar Pregunta</>}
                                    </motion.button>
                                ) : (
                                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-black/40 p-6 md:p-8 rounded-2xl border border-white/10 relative z-10 text-left space-y-6">
                                        <h3 className="text-xl md:text-2xl font-bold text-center mb-6 text-white leading-relaxed">"{gameQuestion}"</h3>
                                        <div className="flex gap-3 mt-2">
                                            <button onClick={() => setGameQuestion('')} className="px-6 bg-white/5 text-gray-300 hover:text-white rounded-xl font-bold border border-white/10 transition-all active:scale-95">Cancelar</button>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    )}

                    {viewMode === 'wiki' && (
                        <div className="grid md:grid-cols-12 gap-6">
                            <div className="md:col-span-4 order-2 md:order-1">
                                <div className={`glass-panel p-6 rounded-3xl sticky top-28 border-t-4 ${theme.border}`}>
                                    <h2 className={`text-xl font-bold flex gap-2 ${theme.accent} items-center mb-6`}>{editingId ? <Edit2 size={20} /> : <Plus size={20} />} Nuevo</h2>
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div><label className="text-[10px] font-bold tracking-wider mb-1 block text-gray-400">TÍTULO</label><input name="question" value={formData.question} onChange={handleInputChange} className="w-full p-3 rounded-xl" required /></div>
                                        <div>
                                            <label className="text-[10px] font-bold tracking-wider mb-1 block text-gray-400">DETALLE</label>
                                            <div className="bg-black/20 border border-white/10 rounded-xl overflow-hidden focus-within:border-white/30 transition-colors">
                                                <textarea ref={answerRef} name="answer" value={formData.answer} onChange={handleInputChange} className="w-full p-3 h-28 resize-none bg-transparent border-none focus:ring-0 text-sm leading-relaxed" required />
                                            </div>
                                        </div>
                                        <div className="flex gap-3 pt-4"><button type="submit" className={`flex-1 py-3 text-white font-bold rounded-xl shadow-lg ${theme.bg} ${theme.hover} transition-all active:scale-95`}>Guardar</button></div>
                                    </form>
                                </div>
                            </div>
                            <div className="md:col-span-8 space-y-6 order-1 md:order-2">
                                <div className="grid gap-4">
                                    <AnimatePresence>
                                        {filteredEntries.slice(0, visibleEntriesCount).map((e, idx) => (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: idx * 0.05 }}
                                                key={e.id} className={`glass-panel p-5 rounded-2xl relative group transition-colors hover:bg-white/5`}
                                            >
                                                <h3 className="font-bold text-lg mt-3 text-white">{e.question}</h3>
                                                <div className="text-gray-300 mt-2 text-sm leading-relaxed font-light markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(e.answer) }}></div>
                                                <div className="mt-4 flex justify-between items-center pt-3 border-t border-white/5">
                                                    <span className="text-[10px] text-gray-500 font-mono">{e.date}</span>
                                                    <div className="flex gap-2"><button onClick={() => setDeleteModal({ isOpen: true, id: e.id, type: 'wiki' })} className="p-2 text-gray-400 hover:text-red-400 bg-white/5 rounded-lg"><Trash2 size={16} /></button></div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
