import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, getBaseRef, googleProvider } from './firebase';
import firebase from './firebase';
import { marked } from 'marked';
import {
    Heart, Download, Trash2, Edit2, Search, User,
    Plus, X, Sparkles, Check, Dices as Dice, Calendar as CalendarIcon,
    Clock, Repeat, Image as ImageIcon, Bold as BoldIcon,
    Italic as ItalicIcon, GitCommit, Settings as SettingsIcon,
    Upload, LogOut, Camera, Link as LinkIcon
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

const GEMINI_MODELS_TO_TRY = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash"];
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// --- IMAGE COMPRESSION UTILITY ---
const compressImage = (file, maxWidth = 1200, quality = 0.7) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
            canvas.width = img.width * ratio;
            canvas.height = img.height * ratio;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(resolve, 'image/jpeg', quality);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

// --- DRIVE UPLOAD ---
const uploadToDrive = async (file, accessToken) => {
    const compressed = await compressImage(file);
    const metadata = { name: `MundoTereque_${Date.now()}.jpg`, mimeType: 'image/jpeg' };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', compressed);
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form
    });
    const data = await res.json();
    if (!data.id) throw new Error('Upload failed');
    // Make it publicly viewable
    await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });
    return `https://lh3.googleusercontent.com/d/${data.id}=s1200`;
};

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
    const [googleAccessToken, setGoogleAccessToken] = useState(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
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

    // Image upload state
    const [imageMode, setImageMode] = useState('url'); // 'url' or 'device'
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
    const answerRef = useRef(null);

    // --- GOOGLE AUTH HANDLERS ---
    const handleGoogleLogin = async () => {
        setIsLoggingIn(true);
        try {
            const result = await auth.signInWithPopup(googleProvider);
            const credential = result.credential;
            if (credential) setGoogleAccessToken(credential.accessToken);
            showToast(`¡Bienvenid@ ${result.user.displayName}! ❤️`);
        } catch (error) {
            console.error('Login error:', error);
            if (error.code !== 'auth/popup-closed-by-user') showToast('Error al iniciar sesión', 'error');
        }
        setIsLoggingIn(false);
    };

    const handleGuestLogin = async () => {
        setIsLoggingIn(true);
        try { await auth.signInAnonymously(); showToast('Modo invitado activado'); }
        catch (e) { showToast('Error de conexión', 'error'); }
        setIsLoggingIn(false);
    };

    const handleLogout = async () => {
        await auth.signOut();
        setGoogleAccessToken(null);
        setShowSettings(false);
    };

    // --- IMAGE HANDLERS ---
    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setImagePreview(ev.target.result);
        reader.readAsDataURL(file);
    };

    const clearImageSelection = () => {
        setImageFile(null); setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    useEffect(() => {
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
        let finalImageUrl = formData.imageUrl || null;
        // Handle device image upload to Google Drive
        if (imageMode === 'device' && imageFile) {
            if (!googleAccessToken) return showToast('Inicia sesión con Google para subir fotos', 'error');
            setIsUploading(true);
            try {
                finalImageUrl = await uploadToDrive(imageFile, googleAccessToken);
                showToast('Foto subida a Drive ✨');
            } catch (err) {
                console.error('Drive upload error:', err);
                setIsUploading(false);
                return showToast('Error al subir foto. Intenta de nuevo.', 'error');
            }
            setIsUploading(false);
        }
        const data = { target: activeProfile, category: formData.category, question: formData.question, answer: formData.answer, imageUrl: finalImageUrl, date: new Date().toLocaleDateString(), timestamp: Date.now() };
        try {
            if (editingId) { await getBaseRef().collection('wiki_entries').doc(editingId).update(data); showToast("Actualizado ✨"); setEditingId(null); }
            else { await getBaseRef().collection('wiki_entries').add(data); showToast("Guardado ❤️"); }
            setFormData(prev => ({ ...prev, question: '', answer: '', imageUrl: '' }));
            clearImageSelection();
        } catch (err) { showToast("Error al guardar", 'error'); }
    };

    const handleEdit = (e) => { setEditingId(e.id); setFormData({ category: e.category, question: e.question, answer: e.answer, imageUrl: e.imageUrl || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); showToast("Editando...", 'info'); };
    const handleCancelEdit = () => { setEditingId(null); setFormData(prev => ({ ...prev, question: '', answer: '', imageUrl: '' })); };

    const savePostIt = async (e) => {
        const text = e.target.innerText;
        setPostItText(text);
        await getBaseRef().collection('settings').doc('postit').set({ text });
        setIsEditingPostIt(false);
        showToast("Nota guardada ✨");
    };

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
        if (!ai) return `⚠️ Configura VITE_GEMINI_API_KEY en Vercel`;
        for (const model of GEMINI_MODELS_TO_TRY) {
            try {
                const response = await ai.models.generateContent({
                    model: model,
                    contents: prompt,
                });
                if (response && response.text) return response.text;
            } catch (e) {
                console.error(`Error con modelo ${model}:`, e);
                continue;
            }
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

    // --- LOGIN SCREEN ---
    if (!user) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'radial-gradient(ellipse at top, #4a0404 0%, #0a0000 100%)' }}>
            <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, type: 'spring' }} className="glass-panel p-10 rounded-3xl max-w-sm w-full text-center border border-white/10 shadow-2xl">
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 3 }} className="text-6xl mb-6">❤️</motion.div>
                <h1 className="text-3xl font-bold text-white mb-2">Mundo Tereque</h1>
                <p className="text-gray-400 text-sm mb-8">El universo privado de Flor y Terequito</p>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleGoogleLogin} disabled={isLoggingIn} className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 py-3.5 px-6 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all mb-4 cursor-pointer">
                    {isLoggingIn ? <div className="spinner border-gray-800" /> : <><svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg> Iniciar con Google</>}
                </motion.button>
                <button onClick={handleGuestLogin} disabled={isLoggingIn} className="w-full text-gray-500 text-sm hover:text-gray-300 transition-colors py-2 cursor-pointer">Continuar como invitado →</button>
            </motion.div>
        </div>
    );

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
                                <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white cursor-pointer" aria-label="Cerrar"><X size={24} /></button>
                            </div>
                            <div className="space-y-4">
                                {user && !user.isAnonymous ? (
                                    <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                                        {user.photoURL && <img src={user.photoURL} alt="Avatar" className="w-12 h-12 rounded-full border-2 border-rose-500" />}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white truncate">{user.displayName}</p>
                                            <p className="text-xs text-gray-400 truncate">{user.email}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                        <p className="text-sm text-gray-400">Modo invitado. Inicia sesión con Google para subir fotos y sincronizar datos.</p>
                                        <button onClick={handleGoogleLogin} className="mt-3 bg-white text-gray-800 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-100 transition-all cursor-pointer">Vincular con Google</button>
                                    </div>
                                )}
                                {googleAccessToken && <div className="bg-green-900/20 p-3 rounded-xl border border-green-500/30 text-green-300 text-xs flex items-center gap-2"><Check size={14} /> Google Drive conectado para fotos</div>}
                                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                    <p className="text-xs text-gray-500 mb-2">DATOS</p>
                                    <p className="text-sm text-gray-300">{entries.length} recuerdos · {pendingGames.length} juegos pendientes · {datesList.length} fechas</p>
                                </div>
                                <button onClick={async () => {
                                    const data = { entries, pendingGames, datesList, relationshipStart, categories };
                                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a'); a.href = url; a.download = `MundoTereque_backup_${new Date().toISOString().slice(0, 10)}.json`;
                                    a.click(); URL.revokeObjectURL(url); showToast('Backup descargado');
                                }} className="w-full flex items-center justify-center gap-2 bg-white/5 text-gray-300 hover:text-white py-3 rounded-xl font-bold border border-white/10 transition-all cursor-pointer"><Download size={16} /> Descargar Backup</button>
                                {user && !user.isAnonymous && (
                                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 py-3 rounded-xl font-bold border border-red-900/30 hover:bg-red-900/20 transition-all cursor-pointer"><LogOut size={16} /> Cerrar Sesión</button>
                                )}
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

            {/* POST-IT NOTE (Visible on Wiki & Dates) */}
            {(viewMode === 'wiki' || viewMode === 'dates') && (
                <div className="post-it-bg p-4 rounded-br-3xl rounded-tl-2xl shadow-xl transform rotate-1 hover:rotate-0 transition-all relative max-w-sm mx-auto mb-8 border border-yellow-400/50">
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-12 h-6 bg-red-500/20 backdrop-blur-sm shadow-sm rounded-sm"></div>
                    {isEditingPostIt ? (
                        <div
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={savePostIt}
                            className="font-handwriting text-xl text-yellow-900 outline-none min-h-[60px] leading-relaxed text-center p-2"
                            autoFocus
                        >{postItText}</div>
                    ) : (
                        <div onClick={() => setIsEditingPostIt(true)} className="font-handwriting text-xl text-yellow-900 min-h-[60px] cursor-pointer flex items-center justify-center text-center leading-relaxed">
                            {postItText}
                        </div>
                    )}
                    <span className="absolute bottom-2 right-3 text-[10px] text-yellow-700/50 font-sans uppercase font-bold">Nota del día</span>
                </div>
            )}

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
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-2 block flex items-center gap-1"><Heart size={12} /> Respuesta de Flor</label>
                                                <textarea value={answerFlor} onChange={e => setAnswerFlor(e.target.value)} placeholder="Lo que yo creo es..." className="w-full h-24 p-3 rounded-xl bg-black/50 border border-rose-900/50 focus:border-rose-500/50 text-white text-sm outline-none resize-none" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-2 block flex items-center gap-1"><User size={12} /> Respuesta de Terequito</label>
                                                <textarea value={answerTereque} onChange={e => setAnswerTereque(e.target.value)} placeholder="Para mí es..." className="w-full h-24 p-3 rounded-xl bg-black/50 border border-sky-900/50 focus:border-sky-500/50 text-white text-sm outline-none resize-none" />
                                            </div>
                                        </div>
                                        <div className="flex gap-3 mt-4">
                                            <button onClick={() => setGameQuestion('')} className="px-6 bg-white/5 text-gray-300 hover:text-white rounded-xl font-bold border border-white/10 transition-all active:scale-95">Cancelar</button>
                                            <button onClick={handleSaveActiveGame} className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl font-bold border border-white/10 shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02] transition-all active:scale-95 text-sm">
                                                {answerFlor && answerTereque ? 'Responder y guardar en Wiki ❤️' : 'Falta respuesta (Guardar pendiente) ⏳'}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* PENDIENTES */}
                            {pendingGames.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-gray-400 tracking-wider uppercase mb-4 flex items-center gap-2"><Clock size={16} /> Esperando Respuesta ({pendingGames.length})</h3>
                                    {pendingGames.map((game, idx) => (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} key={game.id} className="glass-panel p-5 rounded-2xl border-l-4 border-indigo-500">
                                            <p className="font-bold text-lg text-white mb-4">"{game.question}"</p>
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                                                    <span className="text-[10px] text-rose-400 font-bold mb-1 block">FLOR {game.answerFlor ? '✅ Respondió' : '⏳ Faltas Tú'}</span>
                                                    {game.answerFlor ? <p className="text-gray-300 text-sm italic">Respuesta oculta hasta que ambos contesten...</p> :
                                                        <textarea placeholder="Tu respuesta..." value={pendingAnswers[`${game.id}_flor`] || ''} onChange={e => setPendingAnswers(prev => ({ ...prev, [`${game.id}_flor`]: e.target.value }))} className="w-full p-2 mt-1 rounded bg-black/30 border border-white/10 text-white text-sm outline-none h-16" />}
                                                </div>
                                                <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                                                    <span className="text-[10px] text-sky-400 font-bold mb-1 block">TEREQUITO {game.answerTereque ? '✅ Respondió' : '⏳ Faltas Tú'}</span>
                                                    {game.answerTereque ? <p className="text-gray-300 text-sm italic">Respuesta oculta hasta que ambos contesten...</p> :
                                                        <textarea placeholder="Tu respuesta..." value={pendingAnswers[`${game.id}_tereque`] || ''} onChange={e => setPendingAnswers(prev => ({ ...prev, [`${game.id}_tereque`]: e.target.value }))} className="w-full p-2 mt-1 rounded bg-black/30 border border-white/10 text-white text-sm outline-none h-16" />}
                                                </div>
                                            </div>
                                            <div className="flex justify-between mt-4">
                                                <button onClick={() => setDeleteModal({ isOpen: true, id: game.id, type: 'game_skip' })} className="px-4 py-2 text-xs text-gray-400 hover:text-red-400 transition-colors">Descartar</button>
                                                {((game.answerFlor || pendingAnswers[`${game.id}_flor`]) && (game.answerTereque || pendingAnswers[`${game.id}_tereque`])) && (
                                                    <button onClick={() => handleCompletePendingGame(game)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-500 shadow-lg animate-pulse">¡Completar y Guardar!</button>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {viewMode === 'wiki' && (
                        <div className="grid md:grid-cols-12 gap-6">
                            <div className="md:col-span-4 order-2 md:order-1">
                                <div className={`glass-panel p-6 rounded-3xl sticky top-28 border-t-4 ${theme.border}`}>
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className={`text-xl font-bold flex gap-2 ${theme.accent} items-center`}>{editingId ? <Edit2 size={20} /> : <Plus size={20} />}{editingId ? 'Editar' : 'Nuevo Recuerdo'}</h2>
                                        {isAddingCategory && <button onClick={() => setIsAddingCategory(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>}
                                    </div>
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div>
                                            <div className="flex justify-between mb-1"><label className="text-[10px] font-bold tracking-wider text-gray-400">CATEGORÍA</label> {!isAddingCategory && <button type="button" onClick={() => setIsAddingCategory(true)} className={`text-[10px] underline hover:text-white ${theme.accent}`}>Nueva</button>}</div>
                                            {isAddingCategory ? <div className="flex gap-2"><input autoFocus placeholder="Nueva Categoría..." className="flex-1 p-3 rounded-xl bg-black/30 border border-white/10 focus:border-white/30 text-sm text-white outline-none" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} /><button type="button" onClick={handleAddCategory} className={`p-3 rounded-xl text-white ${theme.bg} shadow hover:scale-105 transition-all`}><Plus size={18} /></button></div> : <select name="category" value={formData.category} onChange={handleInputChange} className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white outline-none"><option value="" disabled>Selecciona...</option>{categories.map(c => <option key={c} value={c} className="bg-black text-white">{c}</option>)}</select>}
                                        </div>
                                        <div><label className="text-[10px] font-bold tracking-wider mb-1 block text-gray-400">TÍTULO / PREGUNTA</label><input name="question" value={formData.question} onChange={handleInputChange} placeholder="Ej: Canción favorita" className="w-full p-3 rounded-xl bg-black/30 border border-white/10 focus:border-white/30 text-white outline-none" required /></div>
                                        <div>
                                            <label className="text-[10px] font-bold tracking-wider mb-1 block text-gray-400">DETALLE</label>
                                            <div className="bg-black/20 border border-white/10 rounded-xl overflow-hidden focus-within:border-white/30 transition-colors">
                                                <div className="flex items-center gap-1 p-2 bg-white/5 border-b border-white/5">
                                                    <button type="button" onClick={() => insertFormatting('**', '**')} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10 transition-colors" title="Negrita"><BoldIcon size={14} /></button>
                                                    <button type="button" onClick={() => insertFormatting('*', '*')} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10 transition-colors" title="Cursiva"><ItalicIcon size={14} /></button>
                                                    <div className="w-px h-4 bg-white/10 mx-1"></div>
                                                    <button type="button" onClick={() => insertFormatting('❤️')} className="p-1.5 text-rose-400 hover:text-rose-300 rounded hover:bg-white/10 text-xs transition-colors" title="Corazón">❤️</button>
                                                    <button type="button" onClick={() => insertFormatting('✨')} className="p-1.5 text-yellow-400 hover:text-yellow-300 rounded hover:bg-white/10 text-xs transition-colors" title="Brillos">✨</button>
                                                </div>
                                                <textarea ref={answerRef} name="answer" value={formData.answer} onChange={handleInputChange} placeholder="Escribe aquí..." className="w-full p-3 h-28 resize-none bg-transparent border-none focus:ring-0 text-sm leading-relaxed text-white outline-none" required />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold tracking-wider mb-2 flex items-center gap-1 text-gray-400"><ImageIcon size={12} /> IMAGEN</label>
                                            <div className="flex gap-1 mb-2">
                                                <button type="button" onClick={() => { setImageMode('url'); clearImageSelection(); }} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${imageMode === 'url' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}><LinkIcon size={12} /> URL</button>
                                                <button type="button" onClick={() => setImageMode('device')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${imageMode === 'device' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}><Camera size={12} /> Dispositivo</button>
                                            </div>
                                            {imageMode === 'url' ? (
                                                <input type="url" name="imageUrl" value={formData.imageUrl} onChange={handleInputChange} placeholder="https://ejemplo.com/foto.jpg" className="w-full p-3 rounded-xl bg-black/30 border border-white/10 focus:border-white/30 text-white text-sm outline-none" />
                                            ) : (
                                                <div className="space-y-2">
                                                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                                                    {!imagePreview ? (
                                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full p-4 rounded-xl border-2 border-dashed border-white/10 hover:border-white/30 text-gray-400 hover:text-white text-sm transition-all flex flex-col items-center gap-2 cursor-pointer">
                                                            <Upload size={20} />
                                                            <span>{googleAccessToken ? 'Subir foto (se guarda en tu Drive)' : 'Inicia sesión con Google para subir fotos'}</span>
                                                        </button>
                                                    ) : (
                                                        <div className="relative rounded-xl overflow-hidden border border-white/10">
                                                            <img src={imagePreview} alt="Preview" className="w-full max-h-40 object-cover" />
                                                            <button type="button" onClick={clearImageSelection} className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-colors cursor-pointer" aria-label="Quitar imagen"><X size={14} /></button>
                                                            {isUploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><div className="spinner border-white" /> <span className="ml-2 text-white text-sm">Subiendo a Drive...</span></div>}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-3 pt-4">{editingId && <button type="button" onClick={handleCancelEdit} className="px-6 py-3 bg-white/5 text-gray-300 hover:text-white rounded-xl font-bold text-sm border border-white/10 active:scale-95 transition-all">Cancelar</button>}<button type="submit" className={`flex-1 py-3 text-white font-bold rounded-xl shadow-lg ${theme.bg} ${theme.hover} transition-all active:scale-95`}>{editingId ? 'Guardar' : 'Crear Recuerdo'}</button></div>
                                    </form>
                                </div>
                            </div>
                            <div className="md:col-span-8 space-y-6 order-1 md:order-2">
                                {/* ORACULO CARD */}
                                <div className={`glass-panel p-6 md:p-8 rounded-3xl shadow-xl relative overflow-hidden border border-white/10 flex flex-col md:flex-row items-center gap-6`}>
                                    <div className="flex-1 w-full">
                                        <h2 className={`text-2xl font-bold mb-3 flex gap-3 ${theme.accent} items-center`}><Sparkles size={24} /> Oráculo de {activeProfile === 'novia' ? 'Flor' : 'Terequito'}</h2>
                                        <p className="text-gray-400 text-sm mb-6 leading-relaxed opacity-90">Pregunta lo que quieras. La IA analizará todos los recuerdos guardados para darte la mejor respuesta.</p>
                                        <form onSubmit={handleAskAI} className="flex gap-2 w-full">
                                            <input value={aiQuery} onChange={e => setAiQuery(e.target.value)} placeholder={`Ej: ¿Qué le puedo regalar?`} className="flex-1 p-3 md:p-4 rounded-2xl text-white bg-black/30 border border-white/10 placeholder-gray-500 focus:bg-black/40 transition-all shadow-inner text-sm outline-none w-full" />
                                            <button type="submit" disabled={isAiThinking} className="bg-white text-gray-900 px-4 md:px-6 rounded-2xl font-bold shadow-lg hover:bg-gray-100 hover:scale-105 transition-all flex items-center justify-center min-w-[60px]">{isAiThinking ? <div className="spinner border-gray-900" /> : 'Ir'}</button>
                                        </form>
                                        {aiResponse && <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="mt-6 bg-black/20 p-5 rounded-2xl backdrop-blur-md border border-white/10 text-white text-sm leading-relaxed shadow-inner markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(aiResponse) }} />}
                                    </div>
                                    <div className={`hidden md:flex items-center justify-center p-6 rounded-full bg-white/5 border border-white/5 ${theme.glow} animate-pulse`}>
                                        <Sparkles size={60} className={theme.accent} strokeWidth={1} />
                                    </div>
                                </div>

                                {/* CATEGORY CHIPS */}
                                <div className="flex overflow-x-auto hide-scroll gap-2 pb-2">
                                    <button onClick={() => setActiveCategoryFilter('Todas')} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all border border-transparent ${activeCategoryFilter === 'Todas' ? `${theme.bg} text-white shadow-lg` : 'bg-black/30 text-gray-400 hover:text-white border-white/5'}`}>Todas</button>
                                    {categories.map(c => {
                                        const count = entries.filter(e => e.target === activeProfile && e.category === c).length;
                                        if (count === 0) return null;
                                        return <button key={c} onClick={() => setActiveCategoryFilter(c)} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${activeCategoryFilter === c ? `${theme.bg} text-white shadow-lg border-transparent` : 'bg-black/20 text-gray-400 hover:text-white border-white/5'}`}>{c} <span className="opacity-60 ml-1 text-[10px]">{count}</span></button>
                                    })}
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className={`p-3.5 rounded-2xl glass-panel ${theme.accent}`}><Search size={20} /></div>
                                    <input type="text" placeholder={`Buscar en recuerdos de ${activeProfile === 'novia' ? 'Flor' : 'Terequito'}...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 p-3.5 px-5 rounded-2xl glass-panel text-white focus:ring-1 focus:ring-white/20 outline-none" />
                                </div>

                                <div className="grid gap-4">
                                    <AnimatePresence>
                                        {filteredEntries.slice(0, visibleEntriesCount).map((e, idx) => (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: idx * 0.05 }}
                                                key={e.id} className={`glass-panel p-5 rounded-2xl relative group transition-colors hover:bg-white/5 ${editingId === e.id ? `ring-1 ${theme.accent}` : ''}`}
                                            >
                                                <span className={`text-[10px] font-bold px-3 py-1 rounded-full bg-white/5 border border-white/10 uppercase ${theme.accent}`}>{e.category}</span>
                                                <h3 className="font-bold text-lg mt-3 text-white">{e.question}</h3>
                                                <div className="text-gray-300 mt-2 text-sm leading-relaxed font-light markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(e.answer) }}></div>

                                                {e.imageUrl && (
                                                    <div className="mt-3 rounded-xl overflow-hidden border border-white/10 max-h-64 flex justify-center bg-black/50">
                                                        <img src={e.imageUrl} alt="Recuerdo" className="object-contain max-h-64" onError={(imgE) => { imgE.target.style.display = 'none' }} />
                                                    </div>
                                                )}

                                                <div className="mt-4 flex justify-between items-center pt-3 border-t border-white/5">
                                                    <span className="text-[10px] text-gray-500 font-mono">{e.date}</span>
                                                    <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleEdit(e)} className="p-2 text-gray-400 hover:text-blue-400 bg-white/5 rounded-lg"><Edit2 size={16} /></button>
                                                        <button onClick={() => setDeleteModal({ isOpen: true, id: e.id, type: 'wiki' })} className="p-2 text-gray-400 hover:text-red-400 bg-white/5 rounded-lg"><Trash2 size={16} /></button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    {filteredEntries.length === 0 && <div className="text-center py-12 text-gray-500 bg-black/20 rounded-2xl border border-white/5">No hay recuerdos aquí aún.</div>}
                                    {filteredEntries.length > visibleEntriesCount && (
                                        <button onClick={() => setVisibleEntriesCount(prev => prev + 15)} className="w-full py-4 text-sm font-bold text-gray-400 hover:text-white glass-panel rounded-2xl transition-colors">Cargar más 👇</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
