"use client";
import { useEffect, useState, useRef } from "react";
import { auth, db } from "../lib/firebase"; 
import { sendPasswordResetEmail } from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, collection, getDocs, arrayUnion, arrayRemove, orderBy, onSnapshot, addDoc, query, deleteDoc } from "firebase/firestore";

const TRANSLATIONS: any = {
  ro: { search: "Caută noutăți...", settings: "Setări", admin: "ADMIN", welcomeTitle: "Bine ai venit!", welcomeMsg: "Ne bucurăm să te avem pe GhibaPlus.", joinEventTitle: "Înscriere Confirmată ✅", joinEventMsg: "Te-ai înscris cu succes la:", notif: "Notificări", noNotif: "Nicio notificare momentan.", dateTime: "DATA / ORA", location: "LOCAȚIE", join: "Particip ✅", cancel: "Anulează", readMore: "📖 Citește mai mult", lang: "Limba Interfeței", class: "Clasa Ta (Blocat)", phone: "Număr de Telefon", save: "Salvează Setările", council: "Consiliul Elevilor", noSpots: "Locuri epuizate!", translating: "Se traduce...", resetPass: "🔑 Trimite link resetare parolă", resetSent: "Email-ul a fost trimis! Verifică Inbox-ul.", allSchool: "Toată Școala", myClass: "Clasa Mea" },
  en: { search: "Search news...", settings: "Settings", admin: "ADMIN", welcomeTitle: "Welcome!", welcomeMsg: "Glad to have you on GhibaPlus.", joinEventTitle: "Registration Confirmed ✅", joinEventMsg: "Successfully joined:", notif: "Notifications", noNotif: "No notifications.", dateTime: "DATE / TIME", location: "LOCATION", join: "Join ✅", cancel: "Cancel", readMore: "📖 Read More", lang: "Interface Language", class: "Your Class (Locked)", phone: "Phone Number", save: "Save Settings", council: "Student Council", noSpots: "No spots left!", translating: "Translating...", resetPass: "🔑 Send password reset link", resetSent: "Email sent! Check your Inbox.", allSchool: "Whole School", myClass: "My Class" },
  fr: { search: "Recherche...", settings: "Paramètres", admin: "ADMIN", welcomeTitle: "Bienvenue !", welcomeMsg: "Heureux de vous avoir sur GhibaPlus !", joinEventTitle: "Inscription confirmée ✅", joinEventMsg: "Inscrit à :", notif: "Notifications", noNotif: "Pas de notifications.", dateTime: "DATE / HEURE", location: "LIEU", join: "Participer ✅", cancel: "Annuler", readMore: "📖 Détails", lang: "Langue", class: "Classe (Bloqué)", phone: "Téléphone", save: "Enregistrer", council: "Conseil", noSpots: "Complet!", translating: "Traduction...", resetPass: "🔑 Réinitialiser le mot de passe", resetSent: "Email envoyé !", allSchool: "Toute l'école", myClass: "Ma Classe" },
  de: { search: "Suche...", settings: "Einstellungen", admin: "ADMIN", welcomeTitle: "Willkommen!", welcomeMsg: "Schön, dass du bei GhibaPlus bist!", joinEventTitle: "Anmeldung bestätigt ✅", joinEventMsg: "Beigetreten:", notif: "Benachrichtigungen", noNotif: "Keine Nachrichten.", dateTime: "DATUM / ZEIT", location: "ORT", join: "Teilnehmen ✅", cancel: "Stornieren", readMore: "📖 Details", lang: "Sprache", class: "Klasse (Gesperrt)", phone: "Telefon", save: "Speichern", council: "Schülerrat", noSpots: "Voll!", translating: "Übersetzen...", resetPass: "🔑 Passwort zurücksetzen", resetSent: "E-Mail gesendet!", allSchool: "Ganze Schule", myClass: "Meine Klasse" },
  es: { search: "Buscar...", settings: "Ajustes", admin: "ADMIN", welcomeTitle: "¡Bienvenido!", welcomeMsg: "Nos alegra tenerte en GhibaPlus.", joinEventTitle: "Registro Confirmado ✅", joinEventMsg: "Te uniste a:", notif: "Notificaciones", noNotif: "Sin notificaciones.", dateTime: "FECHA / HORA", location: "UBICACIÓN", join: "Participar ✅", cancel: "Cancelar", readMore: "📖 Detalles", lang: "Idioma", class: "Clase (Bloqueado)", phone: "Teléfono", save: "Guardar", council: "Consejo", noSpots: "¡Lleno!", translating: "Traduciendo...", resetPass: "🔑 Restablecer contraseña", resetSent: "¡Correo enviado!", allSchool: "Toda la Escuela", myClass: "Mi Clase" }
};

const GOOGLE_TRANSLATE_API_KEY = "AIzaSyD1qygcjmZh6ToLB5VcbwHQXArzzvPYHj8";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [feed, setFeed] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  
  const [translatedFeed, setTranslatedFeed] = useState<any[]>([]);
  const [translatedCalendar, setTranslatedCalendar] = useState<any[]>([]);
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editLang, setEditLang] = useState("ro");
  const [darkMode, setDarkMode] = useState(true);
  const [feedFilter, setFeedFilter] = useState("all"); 
  const [isTranslating, setIsTranslating] = useState(false);
  
  const translationCache = useRef(new Map());
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("ghiba_theme") === "light") setDarkMode(false);
    return auth.onAuthStateChanged(async (u) => {
      if (!u) return router.push("/");
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) {
        const userData = { id: u.uid, ...snap.data() };
        setUser(userData); setEditPhone(userData.phone || ""); setEditLang(userData.language || "ro");
        const qNotif = query(collection(db, "users", u.uid, "notifications"), orderBy("sentAt", "desc"));
        onSnapshot(qNotif, (s) => setNotifications(s.docs.map(d => ({id: d.id, ...d.data()}))));
        loadFeed();
      }
    });
  }, []);

  const loadFeed = async () => {
    const nSnap = await getDocs(collection(db, "news"));
    const aSnap = await getDocs(collection(db, "calendar_events"));
    
    let allItems = [
        ...nSnap.docs.map(d=>({id:d.id, col:'news', ...d.data()})), 
        ...aSnap.docs.map(d=>({id:d.id, col:'calendar_events', ...d.data()}))
    ];
    
    let feedItems = [...allItems].sort((a:any, b:any) => new Date(b.postedAt||b.date||0).getTime() - new Date(a.postedAt||a.date||0).getTime());
    setFeed(feedItems.filter(item => item.type !== 'holiday' && item.type !== 'exam'));
    
    let calItems = allItems.filter(item => item.col === 'calendar_events');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    calItems = calItems.filter((item:any) => {
        const eventEndDate = new Date(item.endDate || item.date);
        return eventEndDate >= today;
    });
    calItems.sort((a:any, b:any) => new Date(a.date||0).getTime() - new Date(b.date||0).getTime());
    setCalendarEvents(calItems);
  };

  const t = TRANSLATIONS[editLang] || TRANSLATIONS["ro"];

  const translateText = async (text: string, targetLang: string) => {
    if (!text || targetLang === 'ro') return text;
    const cacheKey = `${targetLang}_${text}`;
    if (translationCache.current.has(cacheKey)) return translationCache.current.get(cacheKey);

    try {
      const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, target: targetLang, source: 'ro', format: 'text' })
      });
      const data = await res.json();
      if (data.error) return text; 
      const translated = data.data.translations[0].translatedText;
      translationCache.current.set(cacheKey, translated);
      return translated;
    } catch (error) {
      return text;
    }
  };

  useEffect(() => {
    const translateWholePage = async () => {
      if (editLang === 'ro' || (feed.length === 0 && calendarEvents.length === 0)) {
        setTranslatedFeed(feed); setTranslatedCalendar(calendarEvents); return;
      }
      
      let needsApi = false;
      for (const item of [...feed, ...calendarEvents]) {
          if (!translationCache.current.has(`${editLang}_${item.title}`) || (item.content && !translationCache.current.has(`${editLang}_${item.content}`))) {
              needsApi = true; break;
          }
      }

      if (needsApi) setIsTranslating(true);
      
      const newFeed = await Promise.all(feed.map(async (item) => {
        const tTitle = await translateText(item.title, editLang);
        const tContent = item.content ? await translateText(item.content, editLang) : "";
        return { ...item, translatedTitle: tTitle, translatedContent: tContent };
      }));

      const newCal = await Promise.all(calendarEvents.map(async (item) => {
        const tTitle = await translateText(item.title, editLang);
        return { ...item, translatedTitle: tTitle };
      }));
      
      setTranslatedFeed(newFeed); setTranslatedCalendar(newCal);
      if (needsApi) setIsTranslating(false);
    };
    translateWholePage();
  }, [feed, calendarEvents, editLang]);

  const handleResetPasswordInApp = async () => {
    if (!confirm("Vrei să îți resetezi parola? Vei primi un email de la noi (verifică și Spam).")) return;
    try { await sendPasswordResetEmail(auth, user.email); alert(t.resetSent); } catch (error: any) { alert("Eroare la resetare: " + error.message); }
  };

  const handleSaveSettings = async () => {
      if (editPhone.length !== 10) return alert("Numărul de telefon trebuie să aibă 10 cifre!");
      await updateDoc(doc(db, "users", user.id), { phone: editPhone, language: editLang });
      setUser({ ...user, phone: editPhone, language: editLang }); setShowSettings(false);
  };

  const toggleTheme = () => {
    const next = !darkMode; setDarkMode(next);
    localStorage.setItem("ghiba_theme", next ? "dark" : "light");
  };

  const openNotifications = async () => {
    setShowNotif(true);
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) await updateDoc(doc(db, "users", user.id, "notifications", n.id), { read: true });
  };

  const handleDeleteNotif = async (notifId: string) => {
      await deleteDoc(doc(db, "users", user.id, "notifications", notifId));
  };

  const handleRegister = async (e: any, item: any) => {
    e.stopPropagation();
    if (item.type === 'holiday' || item.type === 'exam') return; 
    
    const isReg = item.attendees?.some((a:any) => a.id === user.id);
    const ref = doc(db, "calendar_events", item.id);
    const newAttendees = isReg ? item.attendees.filter((a:any)=>a.id!==user.id) : [...(item.attendees||[]), {id:user.id, name:user.name, class:user.class, phone:user.phone}];
    if(!isReg && item.maxSpots && newAttendees.length > item.maxSpots) return alert(t.noSpots);
    
    await updateDoc(ref, { attendees: newAttendees });
    
    if(!isReg) await addDoc(collection(db, "users", user.id, "notifications"), { type: "join_event", eventTitle: item.title, sentAt: new Date().toISOString(), read: false });
    else await addDoc(collection(db, "users", user.id, "notifications"), { title: "Participare Anulată", message: `Te-ai retras de la: ${item.title}`, sentAt: new Date().toISOString(), read: false });
    
    if(selectedPost && selectedPost.id === item.id) setSelectedPost((prev: any) => ({ ...prev, attendees: newAttendees }));
    loadFeed();
  };

  const handleLike = async (e: any, item: any) => {
    e.stopPropagation();
    const isLiked = item.likes?.includes(user.id);
    await updateDoc(doc(db, item.col, item.id), { likes: isLiked ? arrayRemove(user.id) : arrayUnion(user.id) });
    if (selectedPost && selectedPost.id === item.id) {
        setSelectedPost((prev:any) => ({ ...prev, likes: isLiked ? prev.likes.filter((id:string)=>id!==user.id) : [...(prev.likes||[]), user.id] }));
    }
    loadFeed();
  };

  const formatEventDateTime = (item: any) => {
    if (!item.date) return "";
    const startD = new Date(item.date).toLocaleDateString('ro-RO');
    let res = startD;
    if (item.endDate && item.endDate !== item.date && !item.endDate.includes(item.date.split('T')[0])) {
        const endD = new Date(item.endDate).toLocaleDateString('ro-RO');
        if (startD !== endD) res += ` - ${endD}`;
    }
    if (item.hasTime) {
        const t1 = item.startTime || "";
        const t2 = item.endTime ? ` - ${item.endTime}` : "";
        if (t1) res += ` | ⏰ ${t1}${t2}`;
    } else if (item.hasTime === undefined && item.date.includes("T") && !item.date.endsWith("T00:00:00") && !item.date.endsWith("T00:00")) {
        res += ` | ⏰ ${new Date(item.date).toLocaleTimeString('ro-RO', {hour: '2-digit', minute:'2-digit'})}`;
    }
    return res;
  };

  if (!user) return null;

  const bgMain = darkMode ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-800";
  const cardBg = darkMode ? "bg-slate-900/60 border-white/10 shadow-lg" : "bg-white border-slate-200/60 shadow-xl shadow-slate-200/50";
  const inputBg = darkMode ? "bg-black/50 border-white/10 text-white focus:bg-black/70" : "bg-slate-100 border-slate-300 text-slate-900 focus:bg-white";

  const filteredFeed = translatedFeed.filter(item => {
    const sq = searchQuery.toLowerCase();
    const targetTitle = item.translatedTitle || item.title || "";
    const targetContent = item.translatedContent || item.content || "";
    const matchesSearch = targetContent.toLowerCase().includes(sq) || targetTitle.toLowerCase().includes(sq);
    const isForUserClass = !item.targetClasses || item.targetClasses.includes("Toată Școala") || item.targetClasses.includes(user.class);
    if (feedFilter === "class") return matchesSearch && item.targetClasses?.includes(user.class);
    return matchesSearch && isForUserClass;
  });

  return (
    <div className={`min-h-screen relative transition-colors duration-500 ${bgMain}`}>
      {/* CSS Inline pentru animația pop-up-urilor */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes popupEnter {
          0% { transform: scale(0.95) translateY(15px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-popup { animation: popupEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}} />

      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full blur-[120px] ${darkMode ? 'bg-red-900/20' : 'bg-red-200/40'}`}></div>
        <div className={`absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full blur-[120px] ${darkMode ? 'bg-blue-900/20' : 'bg-blue-200/40'}`}></div>
      </div>

      <nav className={`fixed top-0 w-full z-40 px-4 py-3 sm:py-4 backdrop-blur-2xl border-b flex justify-between items-center transition-all ${darkMode ? 'bg-slate-950/80 border-white/10' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-6xl mx-auto w-full flex justify-between items-center gap-2">
            
            {/* Logo */}
            <h1 className="text-xl sm:text-2xl font-black shrink-0">Ghiba<span className="text-red-500">+</span></h1>
            
            {/* Căutare Animată Centrată (Desktop) */}
            <div className="hidden md:flex flex-1 max-w-md mx-4 items-center justify-center">
                 <div className="relative group w-full max-w-[200px] focus-within:max-w-full transition-all duration-500 ease-in-out flex justify-center">
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 transition-opacity group-focus-within:opacity-100 group-focus-within:text-red-500 pointer-events-none z-10">🔍</span>
                     <input 
                        placeholder={t.search} 
                        className={`w-full rounded-full pl-11 pr-5 py-2 text-sm font-medium outline-none border transition-all duration-300 shadow-sm focus:border-red-500 focus:ring-4 focus:ring-red-500/20 ${inputBg}`} 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                     />
                 </div>
            </div>
            
            {/* Căutare Mobilă (simplă) */}
            <input 
                placeholder="🔍" 
                className={`md:hidden flex-1 max-w-[120px] rounded-full px-4 py-1.5 text-xs outline-none border transition-all focus:max-w-[160px] focus:border-red-500 ${inputBg}`} 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
            />
            
            {/* Grupul modern de Setări (Glassmorphism Pill) adaptat pentru Mobile */}
            <div className={`flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full border shadow-sm transition-all ${darkMode ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-300'}`}>
                {isTranslating && <span className="text-[10px] font-bold text-blue-500 animate-pulse bg-blue-500/10 px-2 py-1 rounded-full hidden lg:inline mr-1">{t.translating}</span>}
                
                <button onClick={toggleTheme} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-transform hover:rotate-[15deg] hover:scale-110 text-sm sm:text-base">
                    {darkMode ? '☀️' : '🌙'}
                </button>
                
                <button onClick={openNotifications} className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-transform hover:scale-110 text-sm sm:text-base">
                    🔔 {notifications.some(n=>!n.read) && <span className="absolute top-1 right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-600 rounded-full border-2 border-white dark:border-slate-800 animate-pulse"></span>}
                </button>
                
                <button onClick={() => setShowSettings(true)} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-transform duration-300 hover:rotate-90 origin-center text-sm sm:text-base">
                    ⚙️
                </button>

                {/* Butoane Actiuni */}
                <div className="flex items-center gap-1 sm:gap-2 pl-1 sm:pl-2 border-l border-black/10 dark:border-white/10 ml-0.5 sm:ml-1">
                    {user.role === 'admin' && (
                        <button onClick={() => router.push('/admin')} className="bg-gradient-to-r from-red-600 to-rose-500 text-white px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-[9px] sm:text-[11px] font-black shadow-lg shadow-red-500/20 hover:shadow-red-500/40 hover:-translate-y-0.5 transition-all">
                            ADMIN
                        </button>
                    )}
                    <button onClick={() => auth.signOut()} className="text-[10px] sm:text-xs font-bold opacity-60 hover:opacity-100 hover:text-red-500 transition-colors pr-1 sm:pr-2 hidden sm:block">
                        Ieșire
                    </button>
                    {/* Iconiță de ieșire pe mobil ca să salvăm spațiu */}
                    <button onClick={() => auth.signOut()} className="sm:hidden text-lg opacity-60 hover:opacity-100 hover:text-red-500 pr-1" title="Ieșire">
                        🚪
                    </button>
                </div>
            </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 pt-24 sm:pt-28 grid lg:grid-cols-3 gap-6 sm:gap-8 relative z-10">
        <div className="lg:col-span-2 space-y-6">
          <div className={`flex justify-between items-center p-1.5 rounded-2xl border backdrop-blur-xl w-fit ${cardBg}`}>
              <button onClick={() => setFeedFilter("all")} className={`px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all duration-300 ${feedFilter === 'all' ? 'bg-red-500 text-white shadow-md' : 'opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}>{t.allSchool}</button>
              <button onClick={() => setFeedFilter("class")} className={`px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all duration-300 ${feedFilter === 'class' ? 'bg-red-500 text-white shadow-md' : 'opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}>{t.myClass}</button>
          </div>

          {filteredFeed.map(item => (
            <div key={item.id} onClick={() => setSelectedPost(item)} className={`rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 sm:hover:-translate-y-1.5 hover:shadow-2xl cursor-pointer ${cardBg}`}>
              <div className="p-6 sm:p-8">
                <div className="flex gap-4 sm:gap-5 items-start mb-5 sm:mb-6">
                  {item.type === 'activity' && item.date ? (
                     <div className={`text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl flex flex-col items-center shadow-lg border bg-gradient-to-br from-red-500 to-rose-600 border-red-400/30 shrink-0 transform transition-transform group-hover:scale-105`}>
                        <span className="text-xl sm:text-2xl font-black leading-none mb-1">{new Date(item.date).getDate()}</span>
                        <span className="text-[9px] sm:text-[10px] font-black uppercase">{new Date(item.date).toLocaleString(editLang, {month:'short'})}</span>
                     </div>
                  ) : (
                     <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl shadow-lg flex items-center justify-center border border-blue-400/30 font-black text-xl sm:text-2xl transform transition-transform group-hover:scale-105">📢</div>
                  )}
                  <div>
                    <h2 className="text-lg sm:text-2xl font-black mb-1 leading-tight">{item.translatedTitle || item.title}</h2>
                    {(item.authorName || item.organizers) && <p className="opacity-60 text-[10px] sm:text-xs font-bold uppercase tracking-widest">{item.authorName || item.organizers || t.council}</p>}
                  </div>
                </div>
                {item.imageUrl && <div className="h-48 sm:h-64 w-full rounded-xl sm:rounded-2xl mb-5 sm:mb-6 bg-cover bg-center border border-black/10 dark:border-white/10 shadow-inner" style={{backgroundImage:`url(${item.imageUrl})`}}></div>}
                
                <p className="line-clamp-3 opacity-80 mb-5 sm:mb-6 text-sm sm:text-base leading-relaxed">{item.translatedContent || item.content}</p>
                
                {item.type === 'activity' && (
                    <div className={`mb-5 sm:mb-6 p-4 sm:p-5 rounded-xl sm:rounded-2xl border grid gap-3 sm:gap-4 ${item.location ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} ${darkMode ? 'bg-black/30 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                        <div><span className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-50 block mb-0.5 sm:mb-1">{t.dateTime}</span><span className="font-bold text-blue-500 text-xs sm:text-sm">{formatEventDateTime(item)}</span></div>
                        {item.location && <div><span className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-50 block mb-0.5 sm:mb-1">{t.location}</span><span className="font-bold text-xs sm:text-sm">{item.location}</span></div>}
                    </div>
                )}

                <div className="flex justify-between items-center pt-5 sm:pt-6 border-t border-black/5 dark:border-white/5">
                  <div className="flex gap-4">
                      <button onClick={(e) => handleLike(e, item)} className={`font-bold text-xs sm:text-sm flex items-center gap-2 transition-all p-2 -ml-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 ${item.likes?.includes(user.id) ? 'text-red-500 scale-105' : 'opacity-70 hover:opacity-100'}`}>
                          <span>{item.likes?.includes(user.id) ? "❤️" : "🤍"}</span> {item.likes?.length || 0}
                      </button>
                  </div>
                  {item.type === 'activity' && (
                    <button onClick={(e) => handleRegister(e, item)} className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all shadow-md ${item.attendees?.some((a:any)=>a.id===user.id) ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white' : 'bg-gradient-to-r from-green-600 to-emerald-500 text-white hover:shadow-green-500/30 hover:-translate-y-0.5 border border-transparent'}`}>
                      {item.attendees?.some((a:any)=>a.id===user.id) ? t.cancel : t.join}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={`p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] lg:sticky lg:top-28 border backdrop-blur-xl h-fit ${cardBg}`}>
            <h3 className="font-black text-lg sm:text-xl mb-5 sm:mb-6">📅 Calendar</h3>
            <div className="space-y-3">
                {translatedCalendar.length === 0 && <p className="opacity-50 text-xs sm:text-sm italic py-4">Nu există evenimente viitoare.</p>}
                {translatedCalendar.map(ev => (
                    <div key={ev.id} onClick={() => setSelectedPost(ev)} className={`cursor-pointer p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all relative overflow-hidden transform hover:-translate-y-1 hover:shadow-md ${darkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-white'}`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 sm:w-1.5 ${ev.type === 'holiday' ? 'bg-yellow-500' : (ev.type === 'exam' ? 'bg-purple-500' : 'bg-blue-500')}`}></div>
                        <div className="font-bold text-xs sm:text-sm ml-2 sm:ml-3 line-clamp-1">{ev.translatedTitle || ev.title}</div>
                        <div className="text-[9px] sm:text-[10px] opacity-60 ml-2 sm:ml-3 mt-1 font-mono">{formatEventDateTime(ev)}</div>
                    </div>
                ))}
            </div>
        </div>
      </main>

      {/* MODAL SETARI (Animație fluidă) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-lg p-8 sm:p-10 rounded-[2.5rem] border shadow-2xl relative animate-popup ${cardBg}`}>
            <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 bg-black/10 dark:bg-white/10 rounded-full font-bold hover:rotate-90 transition-transform">✕</button>
            <h2 className="text-xl sm:text-2xl font-black mb-6 sm:mb-8 flex items-center gap-2">⚙️ {t.settings}</h2>
            <div className="space-y-4 sm:space-y-6">
                <div>
                    <label className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-50 mb-1.5 sm:mb-2 block">{t.lang}</label>
                    <select value={editLang} onChange={e => setEditLang(e.target.value)} className={`w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold outline-none border focus:border-red-500 transition-colors ${darkMode ? 'bg-black/50 border-white/10' : 'bg-slate-100 border-slate-300'}`}>
                        <option value="ro" className="text-black bg-white">🇷🇴 Română</option>
                        <option value="en" className="text-black bg-white">🇬🇧 English</option>
                        <option value="fr" className="text-black bg-white">🇫🇷 Français</option>
                        <option value="de" className="text-black bg-white">🇩🇪 Deutsch</option>
                        <option value="es" className="text-black bg-white">🇪🇸 Español</option>
                    </select>
                </div>
                <div>
                    <label className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-50 mb-1.5 sm:mb-2 block">{t.class}</label>
                    <input value={user.class} disabled className={`w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold border opacity-50 cursor-not-allowed ${darkMode ? 'bg-black/50 border-white/10' : 'bg-slate-100 border-slate-300'}`} />
                </div>
                <div>
                    <label className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-50 mb-1.5 sm:mb-2 block">{t.phone}</label>
                    <input value={editPhone} onChange={e=>setEditPhone(e.target.value.replace(/\D/g,'').slice(0,10))} className={`w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold outline-none border focus:border-red-500 transition-colors ${darkMode ? 'bg-black/50 border-white/10' : 'bg-slate-100 border-slate-300'}`} />
                </div>
                
                <button onClick={handleResetPasswordInApp} className={`w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm hover:-translate-y-0.5 transition-all shadow-lg border mt-2 ${darkMode ? 'bg-slate-800 text-white hover:bg-slate-700 border-white/10' : 'bg-slate-200 text-slate-800 hover:bg-slate-300 border-slate-300'}`}>
                    {t.resetPass}
                </button>

                <button onClick={handleSaveSettings} className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-red-600 to-rose-500 text-white rounded-xl sm:rounded-2xl font-black text-base sm:text-lg hover:shadow-lg hover:shadow-red-500/30 hover:-translate-y-0.5 transition-all">{t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOTIFICARI (Animație fluidă) */}
      {showNotif && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-md p-6 sm:p-8 rounded-[2.5rem] border shadow-2xl relative animate-popup ${cardBg}`}>
            <button onClick={() => setShowNotif(false)} className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 bg-black/10 dark:bg-white/10 rounded-full font-bold hover:rotate-90 transition-transform">✕</button>
            <h2 className="text-xl sm:text-2xl font-black mb-5 sm:mb-6 flex items-center gap-2">🔔 {t.notif}</h2>
            <div className="space-y-3 sm:space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {notifications.length === 0 && <p className="opacity-50 text-sm italic text-center py-10">{t.noNotif}</p>}
              {notifications.map(n => {
                const notifTitle = n.type === 'welcome' ? t.welcomeTitle : (n.type === 'join_event' ? t.joinEventTitle : n.title);
                const notifMsg = n.type === 'welcome' ? t.welcomeMsg : (n.type === 'join_event' ? `${t.joinEventMsg} ${n.eventTitle}` : n.message);

                return (
                  <div key={n.id} className={`p-4 rounded-xl sm:rounded-2xl border flex justify-between items-start gap-3 sm:gap-4 transition-colors hover:border-red-500/30 ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                    <div>
                        <p className="font-black text-xs sm:text-sm mb-1 leading-snug">{notifTitle}</p>
                        <p className="text-xs sm:text-sm opacity-80 leading-relaxed">{notifMsg}</p>
                        <p className="text-[9px] sm:text-[10px] mt-2 font-mono opacity-40">{new Date(n.sentAt).toLocaleString('ro-RO')}</p>
                    </div>
                    <button onClick={() => handleDeleteNotif(n.id)} className="text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white p-2 rounded-lg transition-colors text-xs" title="Șterge">✕</button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* FULL POST MODAL (Animație fluidă) */}
      {selectedPost && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto custom-scrollbar" onClick={() => setSelectedPost(null)}>
            <div className={`w-full max-w-2xl rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border my-auto relative animate-popup ${cardBg}`} onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedPost(null)} className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 w-10 h-10 sm:w-12 sm:h-12 bg-black/50 text-white rounded-full font-black backdrop-blur-md border border-white/20 hover:bg-black/70 hover:rotate-90 transition-all">✕</button>
              {selectedPost.imageUrl && <div className="h-40 sm:h-72 w-full bg-cover bg-center" style={{backgroundImage:`url(${selectedPost.imageUrl})`}}></div>}
              <div className="p-5 sm:p-10 relative">

                <div className="mb-4">
                     <span className={`text-[9px] sm:text-[10px] uppercase font-black px-3 py-1 rounded-full ${
                         selectedPost.type === 'holiday' ? 'bg-yellow-500/20 text-yellow-600' : 
                         selectedPost.type === 'exam' ? 'bg-purple-500/20 text-purple-500' : 
                         (selectedPost.type === 'activity' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500')
                     }`}> 
                         {selectedPost.type === 'holiday' ? 'Vacanță / Zi Liberă' : selectedPost.type === 'exam' ? 'Examen / Testare' : (selectedPost.type === 'activity' ? 'Eveniment' : 'Anunț')} 
                     </span>
                </div>

                <h2 className="text-xl sm:text-3xl font-black mb-4 sm:mb-6 leading-tight">{selectedPost.translatedTitle || selectedPost.title}</h2>
                <p className="text-sm sm:text-lg leading-relaxed opacity-90 whitespace-pre-wrap mb-6 sm:mb-8">{selectedPost.translatedContent || selectedPost.content}</p>
                
                {(selectedPost.type === 'activity' || selectedPost.type === 'holiday' || selectedPost.type === 'exam') && (
                    <div className={`mb-5 sm:mb-6 p-4 sm:p-5 rounded-xl sm:rounded-2xl border grid gap-3 sm:gap-4 ${selectedPost.location ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} ${darkMode ? 'bg-black/30 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                        <div><span className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-50 block mb-0.5 sm:mb-1">{t.dateTime}</span><span className="font-bold text-blue-500 text-xs sm:text-sm">{formatEventDateTime(selectedPost)}</span></div>
                        {selectedPost.location && <div><span className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-50 block mb-0.5 sm:mb-1">{t.location}</span><span className="font-bold text-xs sm:text-sm">{selectedPost.location}</span></div>}
                    </div>
                )}

                {selectedPost.type === 'activity' && (
                  <button onClick={(e) => handleRegister(e, selectedPost)} className={`w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black text-base sm:text-lg shadow-xl transition-all ${selectedPost.attendees?.some((a:any)=>a.id===user.id) ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white' : 'bg-gradient-to-r from-green-600 to-emerald-500 text-white hover:shadow-green-500/30 hover:-translate-y-0.5'}`}>
                    {selectedPost.attendees?.some((a:any)=>a.id===user.id) ? t.cancel : t.join}
                  </button>
                )}
              </div>
            </div>
          </div>
      )}
    </div>
  );
}