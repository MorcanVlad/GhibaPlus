"use client";
import { useEffect, useState, useRef } from "react";
import { auth, db } from "../lib/firebase"; 
import { sendPasswordResetEmail, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, collection, arrayUnion, arrayRemove, orderBy, onSnapshot, addDoc, query, deleteDoc } from "firebase/firestore";

const TRANSLATIONS: any = {
  ro: { search: "Caută noutăți...", settings: "Setări", admin: "ADMIN", welcomeTitle: "Bine ai venit!", welcomeMsg: "Ne bucurăm să te avem pe GhibaPlus.", notif: "Notificări", noNotif: "Nicio notificare momentan.", dateTime: "DATA / ORA", location: "LOCAȚIE", join: "Particip ✅", cancel: "Retrage-te", teamJoin: "Înscrie Echipă 👥", teamManage: "Gestionează Echipa", lang: "Limba Interfeței", class: "Clasa Ta", phone: "Număr de Telefon", save: "Salvează Setările", council: "Consiliul Elevilor", noSpots: "Locuri epuizate!", translating: "Se traduce...", resetPass: "🔑 Trimite link resetare parolă", resetSent: "Email-ul a fost trimis!", allSchool: "Toată Școala", myClass: "Clasa Mea", logout: "Ieșire", spots: "Locuri", unlimited: "Nelimitat", calendarTitle: "📅 Calendar", contactAdmin: "Contactează Administratorul", ruleAny: "Liber (Fără restricții)", ruleSameClass: "Strict: Doar din clasa ta", rulePlusOne: "Maxim 1 elev din altă clasă" },
  en: { search: "Search news...", settings: "Settings", admin: "ADMIN", welcomeTitle: "Welcome!", welcomeMsg: "Glad to have you on GhibaPlus.", notif: "Notifications", noNotif: "No notifications.", dateTime: "DATE / TIME", location: "LOCATION", join: "Join ✅", cancel: "Leave", teamJoin: "Register Team 👥", teamManage: "Manage Team", lang: "Interface Language", class: "Your Class", phone: "Phone Number", save: "Save Settings", council: "Student Council", noSpots: "No spots left!", translating: "Translating...", resetPass: "🔑 Send password reset link", resetSent: "Email sent!", allSchool: "Whole School", myClass: "My Class", logout: "Logout", spots: "Spots", unlimited: "Unlimited", calendarTitle: "📅 Calendar", contactAdmin: "Contact Administrator", ruleAny: "No restrictions", ruleSameClass: "Strict: Same class only", rulePlusOne: "Max 1 from another class" },
  fr: { search: "Recherche...", settings: "Paramètres", admin: "ADMIN", welcomeTitle: "Bienvenue !", welcomeMsg: "Heureux de vous avoir sur GhibaPlus !", notif: "Notifications", noNotif: "Pas de notifications.", dateTime: "DATE / HEURE", location: "LIEU", join: "Participer ✅", cancel: "Annuler", teamJoin: "Inscrire l'équipe 👥", teamManage: "Gérer l'équipe", lang: "Langue", class: "Classe", phone: "Téléphone", save: "Enregistrer", council: "Conseil", noSpots: "Complet!", translating: "Traduction...", resetPass: "🔑 Réinitialiser le mot de passe", resetSent: "Email envoyé !", allSchool: "Toute l'école", myClass: "Ma Classe", logout: "Déconnexion", spots: "Places", unlimited: "Illimité", calendarTitle: "📅 Calendrier", contactAdmin: "Contacter l'administrateur", ruleAny: "Aucune restriction", ruleSameClass: "Strict: Même classe", rulePlusOne: "Max 1 d'une autre classe" },
  de: { search: "Suche...", settings: "Einstellungen", admin: "ADMIN", welcomeTitle: "Willkommen!", welcomeMsg: "Schön, dass du bei GhibaPlus bist!", notif: "Benachrichtigungen", noNotif: "Keine Nachrichten.", dateTime: "DATUM / ZEIT", location: "ORT", join: "Teilnehmen ✅", cancel: "Verlassen", teamJoin: "Team anmelden 👥", teamManage: "Team verwalten", lang: "Sprache", class: "Klasse", phone: "Telefon", save: "Speichern", council: "Schülerrat", noSpots: "Voll!", translating: "Übersetzen...", resetPass: "🔑 Passwort zurücksetzen", resetSent: "E-Mail gesendet!", allSchool: "Ganze Schule", myClass: "Meine Klasse", logout: "Abmelden", spots: "Plätze", unlimited: "Unbegrenzt", calendarTitle: "📅 Kalender", contactAdmin: "Administrator kontaktieren", ruleAny: "Keine Einschränkungen", ruleSameClass: "Streng: Gleiche Klasse", rulePlusOne: "Max 1 aus anderer Klasse" },
  es: { search: "Buscar...", settings: "Ajustes", admin: "ADMIN", welcomeTitle: "¡Bienvenido!", welcomeMsg: "Nos alegra tenerte en GhibaPlus.", notif: "Notificaciones", noNotif: "Sin notificaciones.", dateTime: "FECHA / HORA", location: "UBICACIÓN", join: "Participar ✅", cancel: "Salir", teamJoin: "Registrar Equipo 👥", teamManage: "Gestionar Equipo", lang: "Idioma", class: "Clase", phone: "Teléfono", save: "Guardar", council: "Consejo", noSpots: "¡Lleno!", translating: "Traduciendo...", resetPass: "🔑 Restablecer contraseña", resetSent: "¡Correo enviado!", allSchool: "Toda la Escuela", myClass: "Mi Clase", logout: "Cerrar sesión", spots: "Lugares", unlimited: "Ilimitado", calendarTitle: "📅 Calendario", contactAdmin: "Contactar Administrador", ruleAny: "Sin restricciones", ruleSameClass: "Estricto: Misma clase", rulePlusOne: "Máx 1 de otra clase" }
};

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [usersDb, setUsersDb] = useState<any[]>([]); 
  
  const [news, setNews] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  
  const [translatedFeed, setTranslatedFeed] = useState<any[]>([]);
  const [translatedCalendar, setTranslatedCalendar] = useState<any[]>([]);
  const [translatedNotifications, setTranslatedNotifications] = useState<any[]>([]); 
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  
  const [teamModalEvent, setTeamModalEvent] = useState<any>(null);
  const [manageTeamModal, setManageTeamModal] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamSearch, setTeamSearch] = useState("");

  const [editPhone, setEditPhone] = useState("");
  const [editLang, setEditLang] = useState("ro"); 
  const [currentLang, setCurrentLang] = useState("ro"); 
  const [darkMode, setDarkMode] = useState(true);
  const [feedFilter, setFeedFilter] = useState("all"); 
  const [isTranslating, setIsTranslating] = useState(false);

  const [showContactAdmin, setShowContactAdmin] = useState(false);
  const [contactReason, setContactReason] = useState("Schimbare Clasă");
  const [contactMessage, setContactMessage] = useState("");
  
  const unsubRefs = useRef<{ notif?: any, news?: any, events?: any, users?: any }>({});
  
  const translationCache = useRef(new Map());
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("ghiba_theme") === "light") setDarkMode(false);
    
    const unsubscribeAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) { router.replace("/"); return; }
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) {
        const userData = { id: u.uid, ...snap.data() };
        setUser(userData); setEditPhone(userData.phone || ""); setCurrentLang(userData.language || "ro"); setEditLang(userData.language || "ro");
        
        unsubRefs.current.notif = onSnapshot(query(collection(db, "users", u.uid, "notifications"), orderBy("sentAt", "desc")), (s) => setNotifications(s.docs.map(d => ({id: d.id, ...d.data()}))));
        unsubRefs.current.news = onSnapshot(collection(db, "news"), (s) => setNews(s.docs.map(d => ({id: d.id, col:'news', ...d.data()}))));
        unsubRefs.current.events = onSnapshot(collection(db, "calendar_events"), (s) => setEvents(s.docs.map(d => ({id: d.id, col:'calendar_events', ...d.data()}))));
        unsubRefs.current.users = onSnapshot(collection(db, "users"), (s) => setUsersDb(s.docs.map(d => ({id: d.id, ...d.data()}))));
      }
    });

    return () => {
        unsubscribeAuth();
        if(unsubRefs.current.notif) unsubRefs.current.notif();
        if(unsubRefs.current.news) unsubRefs.current.news();
        if(unsubRefs.current.events) unsubRefs.current.events();
        if(unsubRefs.current.users) unsubRefs.current.users();
    };
  }, [router]);

  const handleSecureLogout = async () => {
      if(unsubRefs.current.notif) unsubRefs.current.notif();
      if(unsubRefs.current.news) unsubRefs.current.news();
      if(unsubRefs.current.events) unsubRefs.current.events();
      if(unsubRefs.current.users) unsubRefs.current.users();
      await signOut(auth);
  };

  useEffect(() => {
      if (!user) return; // Asigură-te că user-ul e încărcat pentru a folosi user.class
      let allItems = [...news, ...events];
      let feedItems = [...allItems].sort((a:any, b:any) => new Date(b.postedAt||b.date||0).getTime() - new Date(a.postedAt||a.date||0).getTime());
      setFeed(feedItems.filter(item => item.type !== 'holiday' && item.type !== 'exam'));
      
      let calItems = allItems.filter(item => item.col === 'calendar_events');
      const today = new Date(); today.setHours(0, 0, 0, 0);
      
      // AICI ESTE REPARAȚIA PENTRU CALENDAR (Filtrează clasa și data)
      calItems = calItems.filter((item:any) => {
          const validDate = new Date(item.endDate || item.date) >= today;
          const validClass = !item.targetClasses || item.targetClasses.includes("Toată Școala") || item.targetClasses.includes(user.class);
          return validDate && validClass;
      });
      
      calItems.sort((a:any, b:any) => new Date(a.date||0).getTime() - new Date(b.date||0).getTime());
      setCalendarEvents(calItems);

      if(selectedPost) {
          const updatedPost = allItems.find(i => i.id === selectedPost.id);
          if(updatedPost) setSelectedPost((prev:any) => ({...prev, ...updatedPost}));
      }
      if(manageTeamModal) {
          const updatedEvent = allItems.find(i => i.id === manageTeamModal.id);
          if(updatedEvent) setManageTeamModal((prev:any) => ({...prev, ...updatedEvent}));
      }
  }, [news, events, user]); // Am adaugat `user` in dependente ca sa poata citi `user.class`

  const t = TRANSLATIONS[currentLang] || TRANSLATIONS["ro"];

  const translateText = async (text: string, targetLang: string) => {
    if (!text || typeof text !== 'string' || text.trim() === '' || targetLang === 'ro') return text || "";
    const cacheKey = `${targetLang}_${text}`;
    if (translationCache.current.has(cacheKey)) return translationCache.current.get(cacheKey);

    try {
      const res = await fetch(`/api/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, target: targetLang })
      });
      if (!res.ok) throw new Error("API Route a refuzat cererea");
      const data = await res.json();
      const translated = data.translatedText || text; 
      translationCache.current.set(cacheKey, translated);
      return translated;
    } catch (error) { return text; }
  };

  useEffect(() => {
    const translateWholePage = async () => {
      if (currentLang === 'ro' || (feed.length === 0 && calendarEvents.length === 0 && notifications.length === 0)) {
        setTranslatedFeed([...feed]); setTranslatedCalendar([...calendarEvents]); setTranslatedNotifications([...notifications]); return;
      }
      setIsTranslating(true);
      
      const newFeed = await Promise.all(feed.map(async (item) => {
        const tTitle = await translateText(item.title, currentLang);
        const tContent = item.content ? await translateText(item.content, currentLang) : "";
        return { ...item, translatedTitle: tTitle, translatedContent: tContent };
      }));

      const newCal = await Promise.all(calendarEvents.map(async (item) => {
        const tTitle = await translateText(item.title, currentLang);
        return { ...item, translatedTitle: tTitle }; 
      }));

      const newNotifs = await Promise.all(notifications.map(async (n) => {
        const tTitle = await translateText(n.title, currentLang);
        const tMessage = await translateText(n.message, currentLang);
        return { ...n, translatedTitle: tTitle, translatedMessage: tMessage };
      }));
      
      setTranslatedFeed([...newFeed]); setTranslatedCalendar([...newCal]); setTranslatedNotifications([...newNotifs]); 
      setIsTranslating(false);
    };
    translateWholePage();
  }, [feed, calendarEvents, notifications, currentLang]);

  const handleResetPasswordInApp = async () => {
    if (!confirm("Vrei să îți resetezi parola? Vei primi un email.")) return;
    try { await sendPasswordResetEmail(auth, user.email); alert(t.resetSent); } catch (error: any) { alert("Eroare: " + error.message); }
  };

  const handleSaveSettings = async () => {
      if (editPhone.length !== 10) return alert("Numărul de telefon trebuie să aibă 10 cifre!");
      await updateDoc(doc(db, "users", user.id), { phone: editPhone, language: editLang });
      setUser({ ...user, phone: editPhone, language: editLang }); setCurrentLang(editLang); setShowSettings(false);
  };

  const toggleTheme = () => {
    const next = !darkMode; setDarkMode(next); localStorage.setItem("ghiba_theme", next ? "dark" : "light");
  };

  const openNotifications = async () => {
    setShowNotif(true);
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) await updateDoc(doc(db, "users", user.id, "notifications", n.id), { read: true });
  };

  const handleDeleteNotif = async (notifId: string) => { await deleteDoc(doc(db, "users", user.id, "notifications", notifId)); };

  const sendNotification = async (title: string, message: string) => {
      await addDoc(collection(db, "users", user.id, "notifications"), { title, message, sentAt: new Date().toISOString(), read: false });
  };

  const submitContactAdmin = async () => {
      if(contactMessage.trim().length < 5) return alert("Te rugăm să scrii un mesaj detaliat.");
      await addDoc(collection(db, "admin_messages"), {
          userId: user.id, userName: user.name, userClass: user.class,
          reason: contactReason, message: contactMessage, createdAt: new Date().toISOString()
      });
      alert("✅ Mesajul tău a fost trimis administratorilor!");
      setShowContactAdmin(false); setContactMessage("");
  };

  const handleRegisterClick = async (e: any, item: any) => {
      e.stopPropagation();
      if (item.isTeamEvent) {
          const userTeam = item.teams?.find((t:any) => t.leaderId === user.id || t.members?.some((m:any) => m.id === user.id));
          if (userTeam) setManageTeamModal(item);
          else {
              if(item.maxSpots !== 0 && (item.teams?.length || 0) >= item.maxSpots) return alert(t.noSpots);
              setTeamModalEvent(item); setTeamMembers([]); setTeamSearch("");
          }
      } else {
          const isReg = item.attendees?.some((a:any) => a.id === user.id);
          const newAttendees = isReg ? item.attendees.filter((a:any)=>a.id!==user.id) : [...(item.attendees||[]), {id:user.id, name:user.name, class:user.class, phone:user.phone, joinedAt: new Date().toISOString()}];
          if(!isReg && item.maxSpots !== 0 && newAttendees.length > item.maxSpots) return alert(t.noSpots);
          await updateDoc(doc(db, "calendar_events", item.id), { attendees: newAttendees });
          if (!isReg) await sendNotification("Înscriere Confirmată ✅", `Te-ai înscris cu succes la: ${item.title}`);
          else await sendNotification("Participare Anulată ❌", `Te-ai retras de la: ${item.title}`);
      }
  };

  const handleTeamDisband = async (eventId: string, team: any) => {
      if(!confirm("Ești sigur că vrei să dizolvi complet echipa? Toți membrii vor fi eliminați.")) return;
      await updateDoc(doc(db, "calendar_events", eventId), { teams: arrayRemove(team) });
      await sendNotification("Echipă Dizolvată ❌", `Ai retras echipa de la eveniment. Toți membrii și-au pierdut locul.`);
      setManageTeamModal(null); setSelectedPost(null);
  };

  const handleLeaveTeamAsMember = async (eventId: string, team: any) => {
      if(!confirm("Ești sigur că vrei să părăsești echipa?")) return;
      const updatedMembers = team.members.filter((m:any) => m.id !== user.id);
      const updatedTeam = { ...team, members: updatedMembers };
      const eventRef = doc(db, "calendar_events", eventId);
      await updateDoc(eventRef, { teams: arrayRemove(team) });
      await updateDoc(eventRef, { teams: arrayUnion(updatedTeam) });
      await sendNotification("Echipă Părăsită 🚶", `Te-ai retras din echipă.`);
      setManageTeamModal(null); setSelectedPost(null);
  };

  const handleRemoveMember = async (eventId: string, team: any, memberId: string) => {
      if(!confirm("Ești sigur că vrei să elimini acest membru?")) return;
      const updatedMembers = team.members.filter((m:any) => m.id !== memberId);
      const updatedTeam = { ...team, members: updatedMembers };
      const eventRef = doc(db, "calendar_events", eventId);
      await updateDoc(eventRef, { teams: arrayRemove(team) });
      await updateDoc(eventRef, { teams: arrayUnion(updatedTeam) });
  };

  const handleTransferLeadership = async (eventId: string, team: any, newLeader: any) => {
      if(!confirm(`Ești sigur că vrei să îl faci pe ${newLeader.name} liderul echipei? Tu vei deveni membru normal.`)) return;
      const oldLeaderAsMember = { id: user.id, name: user.name, class: user.class, phone: user.phone, role: "member" };
      const updatedMembers = [...team.members.filter((m:any) => m.id !== newLeader.id), oldLeaderAsMember];
      const updatedTeam = { ...team, leaderId: newLeader.id, leaderName: newLeader.name, leaderClass: newLeader.class, leaderPhone: newLeader.phone, members: updatedMembers };
      const eventRef = doc(db, "calendar_events", eventId);
      await updateDoc(eventRef, { teams: arrayRemove(team) });
      await updateDoc(eventRef, { teams: arrayUnion(updatedTeam) });
      setManageTeamModal(null); 
  };

  const addTeamMemberExisting = async (selectedUser: any, team: any) => {
      if(team.members.length >= (manageTeamModal.teamSize - 1)) return alert(`Echipa este deja plină!`);
      if(team.members.find((m:any) => m.id === selectedUser.id)) return alert("Elevul este deja in echipă!");
      if(manageTeamModal.teamRule === "same_class" && selectedUser.class !== user.class) return alert("Regulă strictă: Membrii trebuie să fie din aceeași clasă!");
      if(manageTeamModal.teamRule === "same_class_plus_one") {
          const outsiders = team.members.filter((m:any) => m.class !== user.class).length;
          if(selectedUser.class !== user.class && outsiders >= 1) return alert("Regulă: Maxim UN SINGUR membru din altă clasă!");
      }
      const updatedMembers = [...team.members, { id: selectedUser.id, name: selectedUser.name, class: selectedUser.class, phone: selectedUser.phone, role: "member" }];
      const updatedTeam = { ...team, members: updatedMembers };
      const eventRef = doc(db, "calendar_events", manageTeamModal.id);
      await updateDoc(eventRef, { teams: arrayRemove(team) });
      await updateDoc(eventRef, { teams: arrayUnion(updatedTeam) });
      setTeamSearch("");
  };

  const addTeamMember = (selectedUser: any) => {
      if(teamMembers.length >= (teamModalEvent.teamSize - 1)) return alert(`Echipa poate avea maxim ${teamModalEvent.teamSize} membri!`);
      if(teamMembers.find(m => m.id === selectedUser.id)) return alert("Elevul este deja in echipă!");
      if(teamModalEvent.teamRule === "same_class" && selectedUser.class !== user.class) return alert("Regulă strictă: Toți membrii trebuie să fie din aceeași clasă cu tine!");
      if(teamModalEvent.teamRule === "same_class_plus_one") {
          const outsiders = teamMembers.filter(m => m.class !== user.class).length;
          if(selectedUser.class !== user.class && outsiders >= 1) return alert("Regulă: Puteți avea maxim UN SINGUR membru din altă clasă!");
      }
      setTeamMembers([...teamMembers, { id: selectedUser.id, name: selectedUser.name, class: selectedUser.class, phone: selectedUser.phone, role: "member" }]);
      setTeamSearch("");
  };

  const submitTeam = async () => {
      const newTeam = { leaderId: user.id, leaderName: user.name, leaderClass: user.class, leaderPhone: user.phone, members: teamMembers, registeredAt: new Date().toISOString() };
      await updateDoc(doc(db, "calendar_events", teamModalEvent.id), { teams: arrayUnion(newTeam) });
      await sendNotification("Echipă Înscrisă ✅", `Ai înscris echipa la evenimentul: ${teamModalEvent.title}`);
      setTeamModalEvent(null);
  };

  const handleLike = async (e: any, item: any) => {
    e.stopPropagation();
    const isLiked = item.likes?.includes(user.id);
    await updateDoc(doc(db, item.col, item.id), { likes: isLiked ? arrayRemove(user.id) : arrayUnion(user.id) });
  };

  const formatEventDateTime = (item: any) => {
    if (!item.date) return "";
    const startD = new Date(item.date).toLocaleDateString('ro-RO');
    let res = startD;
    if (item.endDate && item.endDate !== item.date && !item.endDate.includes(item.date.split('T')[0])) {
        const endD = new Date(item.endDate).toLocaleDateString('ro-RO');
        if (startD !== endD) res += ` - ${endD}`;
    }
    if (item.hasTime) res += ` | ⏰ ${item.startTime || ""}${item.endTime ? ` - ${item.endTime}` : ""}`;
    return res;
  };

  const getTeamRuleText = (rule: string) => {
      if(rule === "same_class") return t.ruleSameClass;
      if(rule === "same_class_plus_one") return t.rulePlusOne;
      return t.ruleAny;
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
      <style dangerouslySetInnerHTML={{__html: ` @keyframes popupEnter { 0% { transform: scale(0.95) translateY(15px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } } .animate-popup { animation: popupEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; } `}} />

      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full blur-[120px] ${darkMode ? 'bg-red-900/20' : 'bg-red-200/40'}`}></div>
        <div className={`absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full blur-[120px] ${darkMode ? 'bg-blue-900/20' : 'bg-blue-200/40'}`}></div>
      </div>

      <nav className={`fixed top-0 w-full z-40 px-4 py-3 sm:py-4 backdrop-blur-2xl border-b flex justify-between items-center transition-all ${darkMode ? 'bg-slate-950/80 border-white/10' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-6xl mx-auto w-full flex justify-between items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black shrink-0">Ghiba<span className="text-red-500">+</span></h1>
            
            <div className="hidden md:flex flex-1 max-w-md mx-4 items-center justify-center">
                 <div className="relative group w-full max-w-[200px] focus-within:max-w-full transition-all duration-500 ease-in-out flex justify-center">
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 transition-opacity group-focus-within:opacity-100 group-focus-within:text-red-500 pointer-events-none z-10">🔍</span>
                     <input placeholder={t.search} className={`w-full rounded-full pl-11 pr-5 py-2 text-sm font-medium outline-none border transition-all duration-300 shadow-sm focus:border-red-500 focus:ring-4 focus:ring-red-500/20 ${inputBg}`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                 </div>
            </div>
            
            <input placeholder="🔍" className={`md:hidden flex-1 max-w-[120px] rounded-full px-4 py-1.5 text-xs outline-none border transition-all focus:max-w-[160px] focus:border-red-500 ${inputBg}`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            
            <div className={`flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full border shadow-sm transition-all ${darkMode ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-300'}`}>
                {isTranslating && <span className="text-[10px] font-bold text-blue-500 animate-pulse bg-blue-500/10 px-2 py-1 rounded-full hidden lg:inline mr-1">{t.translating}</span>}
                <button onClick={toggleTheme} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-transform hover:rotate-[15deg] hover:scale-110 text-sm sm:text-base">{darkMode ? '☀️' : '🌙'}</button>
                <button onClick={openNotifications} className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-transform hover:scale-110 text-sm sm:text-base">🔔 {notifications.some(n=>!n.read) && <span className="absolute top-1 right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-600 rounded-full border-2 border-white dark:border-slate-800 animate-pulse"></span>}</button>
                <button onClick={() => setShowSettings(true)} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-transform duration-300 hover:rotate-90 origin-center text-sm sm:text-base">⚙️</button>

                <div className="flex items-center gap-1 sm:gap-2 pl-1 sm:pl-2 border-l border-black/10 dark:border-white/10 ml-0.5 sm:ml-1">
                    {user.role === 'admin' && <button onClick={() => router.push('/admin')} className="bg-gradient-to-r from-red-600 to-rose-500 text-white px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-[9px] sm:text-[11px] font-black shadow-lg shadow-red-500/20 hover:shadow-red-500/40 hover:-translate-y-0.5 transition-all">ADMIN</button>}
                    <button onClick={handleSecureLogout} className="text-[10px] sm:text-xs font-bold opacity-60 hover:opacity-100 hover:text-red-500 transition-colors pr-1 sm:pr-2 hidden sm:block">{t.logout}</button>
                    <button onClick={handleSecureLogout} className="sm:hidden text-lg opacity-60 hover:opacity-100 hover:text-red-500 pr-1" title={t.logout}>🚪</button>
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
                        <span className="text-[9px] sm:text-[10px] font-black uppercase">{new Date(item.date).toLocaleString(currentLang, {month:'short'})}</span>
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
                    <div className={`mb-5 sm:mb-6 p-4 sm:p-5 rounded-xl sm:rounded-2xl border grid gap-3 sm:gap-4 grid-cols-2 ${darkMode ? 'bg-black/30 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                        <div><span className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-50 block mb-0.5 sm:mb-1">{t.dateTime}</span><span className="font-bold text-blue-500 text-xs sm:text-sm">{formatEventDateTime(item)}</span></div>
                        {item.maxSpots !== undefined && (
                            <div>
                                <span className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-50 block mb-0.5 sm:mb-1">{t.spots}</span>
                                <span className="font-bold text-xs sm:text-sm">
                                    {item.isTeamEvent ? item.teams?.length || 0 : item.attendees?.length || 0} / {item.maxSpots === 0 ? <span className="text-green-500">{t.unlimited}</span> : item.maxSpots}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-between items-center pt-5 sm:pt-6 border-t border-black/5 dark:border-white/5">
                  <div className="flex gap-4">
                      <button onClick={(e) => handleLike(e, item)} className={`font-bold text-xs sm:text-sm flex items-center gap-2 transition-all p-2 -ml-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 ${item.likes?.includes(user.id) ? 'text-red-500 scale-105' : 'opacity-70 hover:opacity-100'}`}>
                          <span>{item.likes?.includes(user.id) ? "❤️" : "🤍"}</span> {item.likes?.length || 0}
                      </button>
                  </div>
                  {item.type === 'activity' && (
                    <button onClick={(e) => handleRegisterClick(e, item)} className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all shadow-md ${
                        (item.isTeamEvent ? item.teams?.some((t:any)=>t.leaderId===user.id || t.members?.some((m:any)=>m.id===user.id)) : item.attendees?.some((a:any)=>a.id===user.id)) 
                        ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white' 
                        : 'bg-gradient-to-r from-green-600 to-emerald-500 text-white hover:shadow-green-500/30 hover:-translate-y-0.5 border border-transparent'}`}>
                      {item.isTeamEvent ? (item.teams?.some((t:any)=>t.leaderId===user.id || t.members?.some((m:any)=>m.id===user.id)) ? t.teamManage : t.teamJoin) : (item.attendees?.some((a:any)=>a.id===user.id) ? t.cancel : t.join)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={`p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] lg:sticky lg:top-28 border backdrop-blur-xl h-fit ${cardBg}`}>
            <h3 className="font-black text-lg sm:text-xl mb-5 sm:mb-6">{t.calendarTitle}</h3>
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

      {/* MODAL SETARI */}
      {showSettings && !showContactAdmin && (
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
                
                <button onClick={handleSaveSettings} className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-red-600 to-rose-500 text-white rounded-xl sm:rounded-2xl font-black text-base sm:text-lg hover:shadow-lg hover:shadow-red-500/30 hover:-translate-y-0.5 transition-all">{t.save}</button>

                <button onClick={() => setShowContactAdmin(true)} className={`w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm hover:-translate-y-0.5 transition-all shadow-md border mt-4 ${darkMode ? 'bg-slate-800 text-white hover:bg-slate-700 border-white/10' : 'bg-slate-200 text-slate-800 hover:bg-slate-300 border-slate-300'}`}>
                    📧 {t.contactAdmin}
                </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONTACT ADMIN */}
      {showContactAdmin && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className={`w-full max-w-lg p-8 sm:p-10 rounded-[2.5rem] border shadow-2xl relative animate-popup ${cardBg}`}>
              <button onClick={() => setShowContactAdmin(false)} className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 bg-black/10 dark:bg-white/10 rounded-full font-bold hover:rotate-90 transition-transform">✕</button>
              <h2 className="text-xl sm:text-2xl font-black mb-6 sm:mb-8 text-blue-500">📧 {t.contactAdmin}</h2>
              <div className="space-y-4">
                  <div>
                      <label className="text-[10px] font-black tracking-widest uppercase opacity-50 mb-2 block">Motivul Mesajului</label>
                      <select value={contactReason} onChange={e=>setContactReason(e.target.value)} className={`w-full p-4 rounded-xl text-sm font-bold outline-none border focus:border-blue-500 transition-colors ${darkMode ? 'bg-black/50 border-white/10' : 'bg-slate-100 border-slate-300'}`}>
                          <option value="Schimbare Clasă" className="text-black bg-white">Schimbare Clasă</option>
                          <option value="Raportare Bug/Eroare" className="text-black bg-white">Raportare Bug / Eroare</option>
                          <option value="Feedback Platformă" className="text-black bg-white">Feedback Platformă</option>
                          <option value="Altele" className="text-black bg-white">Altele</option>
                      </select>
                  </div>
                  <div>
                      <label className="text-[10px] font-black tracking-widest uppercase opacity-50 mb-2 block">Mesajul tău</label>
                      <textarea value={contactMessage} onChange={e=>setContactMessage(e.target.value)} placeholder="Descrie problema ta în detaliu..." className={`w-full p-4 rounded-xl text-sm outline-none border h-32 resize-none focus:border-blue-500 transition-colors ${darkMode ? 'bg-black/50 border-white/10' : 'bg-slate-100 border-slate-300'}`}></textarea>
                  </div>
                  <button onClick={submitContactAdmin} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-base hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20">Trimite Mesajul</button>
              </div>
            </div>
          </div>
      )}

      {/* MODAL NOTIFICARI */}
      {showNotif && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-md p-6 sm:p-8 rounded-[2.5rem] border shadow-2xl relative animate-popup ${cardBg}`}>
            <button onClick={() => setShowNotif(false)} className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 bg-black/10 dark:bg-white/10 rounded-full font-bold hover:rotate-90 transition-transform">✕</button>
            <h2 className="text-xl sm:text-2xl font-black mb-5 sm:mb-6 flex items-center gap-2">🔔 {t.notif}</h2>
            <div className="space-y-3 sm:space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {translatedNotifications.length === 0 && <p className="opacity-50 text-sm italic text-center py-10">{t.noNotif}</p>}
              {translatedNotifications.map(n => (
                  <div key={n.id} className={`p-4 rounded-xl sm:rounded-2xl border flex justify-between items-start gap-3 sm:gap-4 transition-colors hover:border-red-500/30 ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                    <div>
                        <p className="font-black text-xs sm:text-sm mb-1 leading-snug">{n.translatedTitle || n.title}</p>
                        <p className="text-xs sm:text-sm opacity-80 leading-relaxed">{n.translatedMessage || n.message}</p>
                        <p className="text-[9px] sm:text-[10px] mt-2 font-mono opacity-40">{new Date(n.sentAt).toLocaleString('ro-RO')}</p>
                    </div>
                    <button onClick={() => handleDeleteNotif(n.id)} className="text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white p-2 rounded-lg transition-colors text-xs" title="Șterge">✕</button>
                  </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL INSCRIERE ECHIPA NOUA */}
      {teamModalEvent && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-lg p-8 sm:p-10 rounded-[2.5rem] border shadow-2xl relative animate-popup ${cardBg}`}>
            <button onClick={() => setTeamModalEvent(null)} className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 bg-black/10 dark:bg-white/10 rounded-full font-bold hover:rotate-90 transition-transform">✕</button>
            <h2 className="text-xl font-black mb-1 flex items-center gap-2 text-green-500">Formează Echipa</h2>
            
            <div className="mb-6">
                <p className="text-xs opacity-70 mb-2">{teamModalEvent.title} • {teamMembers.length + 1} / {teamModalEvent.teamSize} Membri</p>
                <div className="flex flex-wrap justify-between items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-1 bg-green-500/20 text-green-500 rounded-md border border-green-500/30">⚖️ Regula: {getTeamRuleText(teamModalEvent.teamRule)}</span>
                    <button onClick={() => alert(`📞 Contact Organizator:\nNume: ${teamModalEvent.authorName || teamModalEvent.organizers || "Consiliul Elevilor"}\nTelefon: ${teamModalEvent.organizerPhone || "Nu a fost specificat"}`)} className="text-[10px] font-bold px-3 py-1 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition rounded-md border border-blue-500/20">📞 Contact Organizator</button>
                </div>
            </div>
            
            <div className={`p-4 rounded-xl border mb-6 flex justify-between items-center ${darkMode ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-300'}`}>
                <div><span className="text-[10px] font-black uppercase text-red-500 tracking-wider">Lider (Tu)</span><p className="font-bold text-sm">{user.name}</p></div>
                <span className="text-xs font-mono opacity-50">{user.class}</span>
            </div>

            {teamMembers.map(m => (
                <div key={m.id} className={`p-4 rounded-xl border mb-2 flex justify-between items-center ${darkMode ? 'bg-black/40 border-white/5' : 'bg-white border-slate-200'}`}>
                    <div><p className="font-bold text-sm">{m.name}</p></div>
                    <div className="flex gap-3 items-center">
                        <span className="text-xs font-mono opacity-50">{m.class}</span>
                        <button onClick={()=>setTeamMembers(teamMembers.filter(x=>x.id!==m.id))} className="text-red-500 text-xs font-bold hover:underline">Sterge</button>
                    </div>
                </div>
            ))}

            {teamMembers.length < (teamModalEvent.teamSize - 1) && (
                <div className="mt-6 relative">
                    <label className="text-[10px] font-black tracking-widest uppercase opacity-50 mb-2 block">Caută Colegi (Nume / Email)</label>
                    <input value={teamSearch} onChange={e=>setTeamSearch(e.target.value)} placeholder="Ex: Popescu Ion" className={`w-full p-3.5 rounded-xl text-sm font-bold outline-none border focus:border-green-500 transition-colors ${darkMode ? 'bg-black/50 border-white/10' : 'bg-slate-100 border-slate-300'}`} />
                    
                    {teamSearch.length > 2 && (
                        <div className={`absolute top-full left-0 right-0 mt-2 max-h-40 overflow-y-auto border rounded-xl shadow-xl z-10 ${darkMode ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'}`}>
                            {usersDb.filter(u => u.id !== user.id && (u.name.toLowerCase().includes(teamSearch.toLowerCase()) || u.email.toLowerCase().includes(teamSearch.toLowerCase()))).slice(0, 5).map(u => (
                                <div key={u.id} onClick={()=>addTeamMember(u)} className="p-3 border-b border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 flex justify-between">
                                    <span className="text-sm font-bold">{u.name}</span> <span className="text-xs opacity-50">{u.class}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            <button onClick={submitTeam} disabled={teamMembers.length < (teamModalEvent.teamSize - 1)} className="w-full mt-6 py-4 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-xl font-black text-base hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">Trimite Înscrierea</button>
          </div>
        </div>
      )}

      {/* MODAL MANAGEMENT ECHIPA EXISTENTA */}
      {manageTeamModal && (() => {
          const myTeam = manageTeamModal.teams?.find((t:any) => t.leaderId === user.id || t.members?.some((m:any) => m.id === user.id));
          if(!myTeam) return null;
          const isLeader = myTeam.leaderId === user.id;

          return (
          <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className={`w-full max-w-lg p-8 sm:p-10 rounded-[2.5rem] border shadow-2xl relative animate-popup ${cardBg}`}>
                  <button onClick={() => setManageTeamModal(null)} className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 bg-black/10 dark:bg-white/10 rounded-full font-bold hover:rotate-90 transition-transform">✕</button>
                  <h2 className="text-xl font-black mb-1 flex items-center gap-2 text-blue-500">Gestionează Echipa</h2>
                  
                  <div className="mb-6">
                      <p className="text-xs opacity-70 mb-2">{manageTeamModal.title} • Lider: {myTeam.leaderName}</p>
                      <div className="flex flex-wrap justify-between items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-1 bg-blue-500/20 text-blue-500 rounded-md border border-blue-500/30">⚖️ Regula: {getTeamRuleText(manageTeamModal.teamRule)}</span>
                          <button onClick={() => alert(`📞 Contact Organizator:\nNume: ${manageTeamModal.authorName || manageTeamModal.organizers || "Consiliul Elevilor"}\nTelefon: ${manageTeamModal.organizerPhone || "Nu a fost specificat"}`)} className="text-[10px] font-bold px-3 py-1 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition rounded-md border border-blue-500/20">📞 Contact Organizator</button>
                      </div>
                  </div>
                  
                  <div className={`p-4 rounded-xl border mb-2 flex justify-between items-center ${darkMode ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-300'}`}>
                      <div><span className="text-[10px] font-black uppercase text-red-500 tracking-wider">Lider</span><p className="font-bold text-sm">{myTeam.leaderName} {isLeader && "(Tu)"}</p></div>
                      <span className="text-xs font-mono opacity-50">{myTeam.leaderClass}</span>
                  </div>

                  {myTeam.members.map((m:any) => (
                      <div key={m.id} className={`p-4 rounded-xl border mb-2 flex justify-between items-center ${darkMode ? 'bg-black/40 border-white/5' : 'bg-white border-slate-200'}`}>
                          <div><p className="font-bold text-sm">{m.name}</p></div>
                          <div className="flex gap-3 items-center">
                              <span className="text-xs font-mono opacity-50">{m.class}</span>
                              {isLeader && (
                                  <div className="flex flex-col gap-1 items-end">
                                      <button onClick={()=>handleTransferLeadership(manageTeamModal.id, myTeam, m)} className="text-blue-500 text-[10px] font-bold hover:underline">Fă Lider</button>
                                      <button onClick={()=>handleRemoveMember(manageTeamModal.id, myTeam, m.id)} className="text-red-500 text-[10px] font-bold hover:underline">Elimină</button>
                                  </div>
                              )}
                          </div>
                      </div>
                  ))}

                  {isLeader && myTeam.members.length < (manageTeamModal.teamSize - 1) && (
                      <div className="mt-6 relative">
                          <label className="text-[10px] font-black tracking-widest uppercase opacity-50 mb-2 block">Adaugă Coleg Nou</label>
                          <input value={teamSearch} onChange={e=>setTeamSearch(e.target.value)} placeholder="Caută nume..." className={`w-full p-3.5 rounded-xl text-sm font-bold outline-none border focus:border-blue-500 transition-colors ${darkMode ? 'bg-black/50 border-white/10' : 'bg-slate-100 border-slate-300'}`} />
                          
                          {teamSearch.length > 2 && (
                              <div className={`absolute top-full left-0 right-0 mt-2 max-h-40 overflow-y-auto border rounded-xl shadow-xl z-10 ${darkMode ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'}`}>
                                  {usersDb.filter(u => u.id !== user.id && !myTeam.members.find((xm:any)=>xm.id===u.id) && (u.name.toLowerCase().includes(teamSearch.toLowerCase()))).slice(0, 5).map(u => (
                                      <div key={u.id} onClick={()=>addTeamMemberExisting(u, myTeam)} className="p-3 border-b border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 flex justify-between">
                                          <span className="text-sm font-bold">{u.name}</span> <span className="text-xs opacity-50">{u.class}</span>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  )}

                  <div className="mt-8 pt-4 border-t border-white/10">
                      {isLeader ? (
                          <button onClick={() => handleTeamDisband(manageTeamModal.id, myTeam)} className="w-full py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-black text-sm hover:bg-red-500 hover:text-white transition-all">Dizolvă Echipa (Retrage)</button>
                      ) : (
                          <button onClick={() => handleLeaveTeamAsMember(manageTeamModal.id, myTeam)} className="w-full py-4 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-xl font-black text-sm hover:bg-orange-500 hover:text-white transition-all">Părăsește Echipa</button>
                      )}
                  </div>
              </div>
          </div>
          )
      })()}

      {/* FULL POST MODAL */}
      {selectedPost && !teamModalEvent && !manageTeamModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto custom-scrollbar animate-popup" onClick={() => setSelectedPost(null)}>
            <div className={`w-full max-w-2xl rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border my-auto relative ${cardBg}`} onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedPost(null)} className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 w-10 h-10 sm:w-12 sm:h-12 bg-black/50 text-white rounded-full font-black backdrop-blur-md border border-white/20 hover:bg-black/70 hover:rotate-90 transition-all">✕</button>
              {selectedPost.imageUrl && <div className="h-40 sm:h-72 w-full bg-cover bg-center" style={{backgroundImage:`url(${selectedPost.imageUrl})`}}></div>}
              <div className="p-5 sm:p-10 relative">
                <h2 className="text-xl sm:text-3xl font-black mb-4 sm:mb-6 leading-tight">{selectedPost.translatedTitle || selectedPost.title}</h2>
                <p className="text-sm sm:text-lg leading-relaxed opacity-90 whitespace-pre-wrap mb-6 sm:mb-8">{selectedPost.translatedContent || selectedPost.content}</p>
                
                {selectedPost.type === 'activity' && (
                  <button onClick={(e) => handleRegisterClick(e, selectedPost)} className={`w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black text-base sm:text-lg shadow-xl transition-all ${
                        (selectedPost.isTeamEvent ? selectedPost.teams?.some((t:any)=>t.leaderId===user.id || t.members?.some((m:any)=>m.id===user.id)) : selectedPost.attendees?.some((a:any)=>a.id===user.id)) 
                        ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white' 
                        : 'bg-gradient-to-r from-green-600 to-emerald-500 text-white hover:shadow-green-500/30 hover:-translate-y-0.5'}`}>
                      {selectedPost.isTeamEvent ? (selectedPost.teams?.some((t:any)=>t.leaderId===user.id || t.members?.some((m:any)=>m.id===user.id)) ? t.teamManage : t.teamJoin) : (selectedPost.attendees?.some((a:any)=>a.id===user.id) ? t.cancel : t.join)}
                  </button>
                )}
              </div>
            </div>
          </div>
      )}
    </div>
  );
}