"use client";
import { useEffect, useState } from "react";
import { auth, db, storage } from "../lib/firebase"; 
import { sendPasswordResetEmail, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, collection, arrayUnion, arrayRemove, orderBy, onSnapshot, addDoc, query, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const BAD_WORDS = ['pula', 'pizda', 'muie', 'coaie', 'cacat', 'fut', 'sugi', 'dracu', 'mata', 'mortii', 'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy'];

const censorText = (text: string) => {
    let censored = text;
    BAD_WORDS.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        censored = censored.replace(regex, '***');
    });
    return censored;
};

export default function Forum() {
  const [user, setUser] = useState<any>(null);
  const [usersDb, setUsersDb] = useState<any[]>([]); 
  const [forumPosts, setForumPosts] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  const [newPostText, setNewPostText] = useState("");
  const [newPostImage, setNewPostImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [replyTexts, setReplyTexts] = useState<{[key: string]: string}>({});
  
  const [darkMode, setDarkMode] = useState(true);
  const [hoveredUser, setHoveredUser] = useState<any>(null);
  const [selectedPost, setSelectedPost] = useState<any>(null); // NOU: Pentru Modal Calendar
  
  // Modale Admin & UI
  const [adminUserModal, setAdminUserModal] = useState<any>(null);
  const [adminUserHistory, setAdminUserHistory] = useState<any[]>([]);
  const [adminUserForumPosts, setAdminUserForumPosts] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showContactAdmin, setShowContactAdmin] = useState(false);
  const [contactReason, setContactReason] = useState("Raportare Bug/Eroare");
  const [contactMessage, setContactMessage] = useState("");
  
  const [editPhone, setEditPhone] = useState("");
  const [now, setNow] = useState(new Date());

  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (localStorage.getItem("ghiba_theme") === "light") setDarkMode(false);
    const unsubscribeAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/");
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) {
          const userData = { id: u.uid, ...snap.data() };
          setUser(userData);
          setEditPhone(userData.phone || "");
          
          onSnapshot(query(collection(db, "users", u.uid, "notifications"), orderBy("sentAt", "desc")), (s) => setNotifications(s.docs.map(d => ({id: d.id, ...d.data()}))));
      }
    });

    const unsubPosts = onSnapshot(query(collection(db, "forum_posts"), orderBy("createdAt", "desc")), (s) => setForumPosts(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubUsers = onSnapshot(collection(db, "users"), (s) => setUsersDb(s.docs.map(d => ({id: d.id, ...d.data()}))));
    
    // NOU: Filtrare Calendar fix ca in Dashboard
    const unsubCal = onSnapshot(collection(db, "calendar_events"), (s) => {
        let calItems = s.docs.map(d => ({id: d.id, ...d.data()}));
        const today = new Date(); today.setHours(0, 0, 0, 0);
        
        calItems = calItems.filter((item:any) => {
            const validDate = new Date(item.endDate || item.date) >= today;
            if(!user) return false;
            const validClass = !item.targetClasses || item.targetClasses.includes("Toată Școala") || item.targetClasses.includes(user.class);
            
            let isEnrolled = true;
            if (item.type === 'activity') {
                if (item.isTeamEvent) {
                    isEnrolled = item.teams?.some((t:any) => t.leaderId === user.id || t.members?.some((m:any) => m.id === user.id)) || false;
                } else {
                    isEnrolled = item.attendees?.some((a:any) => a.id === user.id) || false;
                }
            }
            return validDate && validClass && isEnrolled;
        });
        
        calItems.sort((a:any, b:any) => new Date(a.date||0).getTime() - new Date(b.date||0).getTime());
        setCalendarEvents(calItems);

        // Update modal info in timp real
        if(selectedPost) {
            const updatedPost = calItems.find(i => i.id === selectedPost.id);
            if(updatedPost) setSelectedPost((prev:any) => ({...prev, ...updatedPost}));
        }
    });

    return () => { unsubscribeAuth(); unsubPosts(); unsubUsers(); unsubCal(); };
  }, [router, user?.class, user?.id, selectedPost]);

  const handleImageChange = (e: any) => { if (e.target.files[0]) setNewPostImage(e.target.files[0]); };

  const handleCreatePost = async () => {
      if (!newPostText.trim() && !newPostImage) return alert("Scrie un mesaj sau adaugă o poză!");
      setIsUploading(true);
      let imageUrl = "";
      if (newPostImage && (user.role === 'admin' || user.role === 'profesor')) {
          const storageRef = ref(storage, `forum/${Date.now()}_${newPostImage.name}`);
          await uploadBytes(storageRef, newPostImage);
          imageUrl = await getDownloadURL(storageRef);
      }
      const safeText = censorText(newPostText);
      await addDoc(collection(db, "forum_posts"), {
          text: safeText, imageUrl, authorId: user.id, authorName: user.name, authorRole: user.role,
          createdAt: new Date().toISOString(), likes: [], replies: []
      });
      setNewPostText(""); setNewPostImage(null); setIsUploading(false);
  };

  const handleReply = async (postId: string) => {
      const text = replyTexts[postId];
      if(!text || !text.trim()) return;
      const safeText = censorText(text);
      const newReply = { id: Date.now().toString(), text: safeText, authorId: user.id, authorName: user.name, authorRole: user.role, createdAt: new Date().toISOString() };
      await updateDoc(doc(db, "forum_posts", postId), { replies: arrayUnion(newReply) });
      setReplyTexts(prev => ({...prev, [postId]: ""}));
  };

  const deletePost = async (postId: string) => {
      if(!confirm("Ștergi această postare?")) return;
      await deleteDoc(doc(db, "forum_posts", postId));
  };

  const deleteReply = async (postId: string, reply: any) => {
      if(!confirm("Ștergi acest răspuns?")) return;
      await updateDoc(doc(db, "forum_posts", postId), { replies: arrayRemove(reply) });
  };

  const openAdminUserModal = async (userId: string) => {
      if(user.role !== 'admin') return;
      const targetUser = usersDb.find(u => u.id === userId);
      if(!targetUser) return;
      const history: any[] = [];
      calendarEvents.forEach(ev => {
          if (ev.attendees?.some((a:any) => a.id === targetUser.id)) history.push({ title: ev.title, date: ev.date });
          ev.teams?.forEach((t:any) => { if (t.leaderId === targetUser.id || t.members?.some((m:any) => m.id === targetUser.id)) history.push({ title: ev.title, date: ev.date }); });
      });
      const userPosts = forumPosts.filter(p => p.authorId === targetUser.id);
      setAdminUserHistory(history); setAdminUserForumPosts(userPosts); setAdminUserModal(targetUser);
  };

  const handleResetPassword = async () => {
      if(!confirm(`Trimite link de resetare parolă pe ${adminUserModal.email}?`)) return;
      await sendPasswordResetEmail(auth, adminUserModal.email);
      alert("Email-ul de resetare a fost trimis!");
  };

  const handleDeleteUser = async () => {
      if(!confirm("⚠️ EȘTI ABSOLUT SIGUR?\nAcest lucru va șterge profilul elevului din baza de date și îl va deconecta permanent.")) return;
      await deleteDoc(doc(db, "users", adminUserModal.id));
      alert("Utilizatorul a fost eliminat din platformă!"); setAdminUserModal(null);
  };

  const handleSecureLogout = async () => { await signOut(auth); router.replace("/"); };
  const toggleTheme = () => { const next = !darkMode; setDarkMode(next); localStorage.setItem("ghiba_theme", next ? "dark" : "light"); };
  
  const openNotifications = async () => {
      setShowNotif(true);
      const unread = notifications.filter(n => !n.read);
      for (const n of unread) await updateDoc(doc(db, "users", user.id, "notifications", n.id), { read: true });
  };
  
  const handleDeleteNotif = async (notifId: string) => { await deleteDoc(doc(db, "users", user.id, "notifications", notifId)); };
  
  const handleSaveSettings = async () => {
      if (editPhone.length !== 10) return alert("Numărul de telefon trebuie să aibă 10 cifre!");
      await updateDoc(doc(db, "users", user.id), { phone: editPhone });
      setUser({ ...user, phone: editPhone }); setShowSettings(false);
  };

  const submitContactAdmin = async () => {
      if(contactMessage.trim().length < 5) return alert("Te rugăm să scrii un mesaj detaliat.");
      await addDoc(collection(db, "admin_messages"), { userId: user.id, userName: user.name, userClass: user.class, reason: contactReason, message: contactMessage, createdAt: new Date().toISOString() });
      alert("✅ Mesajul tău a fost trimis administratorilor!"); setShowContactAdmin(false); setContactMessage("");
  };

  const formatEventDateTime = (item: any) => {
      if (!item.date) return "";
      const startD = new Date(item.date).toLocaleDateString('ro-RO');
      let res = startD;
      if (item.endDate && item.endDate !== item.date && !item.endDate.includes(item.date.split('T')[0])) {
          const endD = new Date(item.endDate).toLocaleDateString('ro-RO');
          if (startD !== endD) res += ` - ${endD}`;
      }
      if (item.hasTime) res += ` | ⏰ ${item.startTime || ""}`;
      return res;
  };

  const renderTimer = (deadline: string) => {
      if (!deadline) return null;
      const diff = new Date(deadline).getTime() - now.getTime();
      if (diff <= 0) return null; 
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);
      return `${d}Z : ${h}H : ${m}M : ${s}S`;
  };

  if (!user) return null;

  const bgMain = darkMode ? "bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-black to-slate-950 text-white" : "bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-100 via-white to-blue-100 text-slate-800";
  const cardBg = darkMode ? "bg-slate-900/60 border-white/10 shadow-lg" : "bg-white border-slate-200/60 shadow-xl shadow-slate-200/50";
  const inputBg = darkMode ? "bg-black/50 border-white/10 text-white focus:bg-black/70" : "bg-slate-100 border-slate-300 text-slate-900 focus:bg-white";

  return (
    <div className={`min-h-screen relative transition-colors duration-500 overflow-x-hidden ${bgMain}`}>
      <style dangerouslySetInnerHTML={{__html: ` 
        @keyframes popupEnter { 0% { transform: scale(0.95) translateY(15px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } } 
        .animate-popup { animation: popupEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes gradMove { 0% { background-position: 0% 0%; } 50% { background-position: 100% 100%; } 100% { background-position: 0% 0%; } }
        body { background-size: 200% 200%; animation: gradMove 15s ease infinite; }
      `}} />

      <nav className={`fixed top-0 w-full z-40 px-4 py-3 sm:py-4 backdrop-blur-2xl border-b flex justify-between items-center transition-all ${darkMode ? 'bg-slate-950/80 border-white/10' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-6xl mx-auto w-full flex justify-between items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black shrink-0 cursor-pointer" onClick={() => router.push('/dashboard')}>Ghiba<span className="text-blue-500">+</span></h1>
            
            <div className={`flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full border shadow-sm transition-all ${darkMode ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-300'}`}>
                <button onClick={toggleTheme} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-transform hover:rotate-[15deg] hover:scale-110 text-sm sm:text-base">{darkMode ? '☀️' : '🌙'}</button>
                <button onClick={openNotifications} className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-transform hover:scale-110 text-sm sm:text-base">🔔 {notifications.some(n=>!n.read) && <span className="absolute top-1 right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-600 rounded-full border-2 border-white dark:border-slate-800 animate-pulse"></span>}</button>
                <button onClick={() => setShowSettings(true)} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-transform duration-300 hover:rotate-90 origin-center text-sm sm:text-base">⚙️</button>

                <div className="flex items-center gap-1 sm:gap-2 pl-1 sm:pl-2 border-l border-black/10 dark:border-white/10 ml-0.5 sm:ml-1">
                    {(user.role === 'admin' || user.role === 'profesor') && (
                        <button onClick={() => router.push('/admin')} className={`bg-gradient-to-r ${user.role === 'profesor' ? 'from-blue-600 to-indigo-500 shadow-blue-500/20' : 'from-red-600 to-rose-500 shadow-red-500/20'} text-white px-2 py-1 sm:px-4 sm:py-1.5 rounded-full text-[9px] sm:text-[11px] font-black shadow-lg hover:-translate-y-0.5 transition-all`}>
                            <span className="hidden sm:inline">{user.role === 'admin' ? 'ADMIN' : 'PROFESOR'}</span>
                            <span className="sm:hidden">{user.role === 'admin' ? 'ADM' : 'PROF'}</span>
                        </button>
                    )}
                    <button onClick={handleSecureLogout} className="text-[10px] sm:text-xs font-bold opacity-60 hover:opacity-100 hover:text-red-500 transition-colors pr-1 sm:pr-2 hidden sm:block">Deconectare</button>
                    <button onClick={handleSecureLogout} className="sm:hidden text-lg opacity-60 hover:opacity-100 hover:text-red-500 pl-1 pr-1" title="Deconectare">🚪</button>
                </div>
            </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 pt-24 sm:pt-28 grid lg:grid-cols-3 gap-6 sm:gap-8 relative z-10">
        <div className="lg:col-span-2">
            
          <div className={`flex justify-between items-center p-2 rounded-2xl border backdrop-blur-xl mb-6 shadow-sm overflow-x-auto ${cardBg}`}>
              <div className="flex gap-2">
                  <button onClick={() => router.push('/dashboard')} className={`px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-black rounded-xl transition-all duration-300 opacity-60 hover:opacity-100 hover:bg-red-500/10 hover:text-red-500`}>📢 ANUNȚURI</button>
                  <button onClick={() => router.push('/dashboard')} className={`px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-black rounded-xl transition-all duration-300 opacity-60 hover:opacity-100 hover:bg-green-500/10 hover:text-green-500`}>🎟️ EVENIMENTE</button>
                  <button className={`px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-black rounded-xl transition-all duration-300 bg-blue-500 text-white shadow-md`}>💬 FORUM</button>
              </div>
          </div>

          <div className={`p-6 sm:p-8 rounded-[2.5rem] border backdrop-blur-xl mb-6 shadow-sm ${cardBg}`}>
              <h2 className="text-xl font-black mb-4">Postează o întrebare sau un mesaj</h2>
              <textarea placeholder="Scrie ceva (fără înjurături!)..." value={newPostText} onChange={e=>setNewPostText(e.target.value)} className={`w-full p-4 rounded-2xl outline-none border h-24 resize-none mb-4 ${inputBg}`} />
              
              <div className="flex justify-between items-center">
                  {(user.role === 'admin' || user.role === 'profesor') ? (
                      <label className="text-xs font-bold text-blue-500 bg-blue-500/10 px-4 py-2.5 rounded-xl cursor-pointer hover:bg-blue-500 hover:text-white transition">
                          📸 Încarcă Poză (PC)
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                      </label>
                  ) : <div></div>}
                  
                  <button onClick={handleCreatePost} disabled={isUploading} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black shadow-lg shadow-blue-500/30 hover:bg-blue-500 disabled:opacity-50 transition-all">{isUploading ? 'Se încarcă...' : 'Trimite'}</button>
              </div>
              {newPostImage && <p className="text-xs mt-3 font-bold text-green-500">Poză atașată: {newPostImage.name}</p>}
          </div>

          <div className="space-y-6">
              {forumPosts.map(post => {
                  const authorInfo = usersDb.find(u => u.id === post.authorId) || { class: 'Necunoscut', role: 'user' };
                  const userPostsCount = forumPosts.filter(p => p.authorId === post.authorId).length;

                  return (
                  <div key={post.id} className={`rounded-[2rem] border backdrop-blur-xl p-6 sm:p-8 shadow-sm ${cardBg}`}>
                      <div className="flex justify-between items-start mb-4 border-b border-black/10 dark:border-white/10 pb-4 relative group">
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center font-black text-lg">{post.authorName?.charAt(0)}</div>
                              <div 
                                className={`relative cursor-pointer ${user.role === 'admin' ? 'hover:text-blue-500 transition-colors' : ''}`}
                                onMouseEnter={() => setHoveredUser(post.authorId)}
                                onMouseLeave={() => setHoveredUser(null)}
                                onClick={() => openAdminUserModal(post.authorId)}
                              >
                                  <p className="font-black text-sm sm:text-base leading-tight">{post.authorName} {post.authorRole === 'admin' && <span className="text-red-500 text-[10px] ml-1 bg-red-500/10 px-1.5 py-0.5 rounded uppercase">Admin</span>}</p>
                                  <p className="text-[10px] sm:text-xs opacity-50 font-mono mt-0.5">{authorInfo.class} • {new Date(post.createdAt).toLocaleString('ro-RO')}</p>
                                  
                                  {hoveredUser === post.authorId && (
                                      <div className={`absolute top-full left-0 mt-2 p-4 rounded-2xl border shadow-xl z-20 w-56 text-xs animate-popup ${darkMode ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'}`}>
                                          <p className="font-black text-blue-500 mb-2 text-sm">{post.authorName}</p>
                                          <div className="space-y-1 opacity-80">
                                            <p>Clasa: <span className="font-mono font-bold">{authorInfo.class}</span></p>
                                            <p>Postări pe forum: <span className="font-mono font-bold text-blue-500">{userPostsCount}</span></p>
                                          </div>
                                          {user.role === 'admin' && <p className="text-[10px] text-red-500 mt-3 font-bold bg-red-500/10 p-1.5 rounded text-center">Click pt. Administrare ⚙️</p>}
                                      </div>
                                  )}
                              </div>
                          </div>
                          {(user.role === 'admin' || user.id === post.authorId) && (
                              <button onClick={() => deletePost(post.id)} className="text-red-500 text-xs font-bold bg-red-500/10 px-3 py-1.5 rounded-lg hover:bg-red-500 hover:text-white transition-colors">Șterge</button>
                          )}
                      </div>

                      <p className="text-sm sm:text-base leading-relaxed mb-4 whitespace-pre-wrap opacity-90">{post.text}</p>
                      {post.imageUrl && <img src={post.imageUrl} alt="Forum" className="max-h-80 rounded-2xl mb-4 border border-black/10 dark:border-white/10 shadow-inner" />}

                      <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 space-y-3">
                          {post.replies?.map((reply:any) => (
                              <div key={reply.id} className={`p-3 sm:p-4 rounded-xl flex justify-between items-start ${darkMode ? 'bg-black/30' : 'bg-slate-50'}`}>
                                  <div>
                                      <span className="text-[10px] sm:text-xs font-black text-blue-500 mr-2">{reply.authorName}</span>
                                      <span className="text-xs sm:text-sm opacity-90">{reply.text}</span>
                                  </div>
                                  {(user.role === 'admin' || user.id === reply.authorId) && (
                                      <button onClick={() => deleteReply(post.id, reply)} className="text-[10px] text-red-500 ml-2 font-black p-1">✕</button>
                                  )}
                              </div>
                          ))}
                          <div className="flex gap-2 mt-4">
                              <input placeholder="Răspunde..." value={replyTexts[post.id] || ""} onChange={e=>setReplyTexts({...replyTexts, [post.id]: e.target.value})} className={`flex-1 p-3 rounded-xl text-xs sm:text-sm outline-none border transition-colors ${inputBg}`} />
                              <button onClick={() => handleReply(post.id)} className="bg-blue-500 text-white px-5 py-3 rounded-xl text-xs sm:text-sm font-black hover:bg-blue-600 transition shadow-md shadow-blue-500/20">Trimite</button>
                          </div>
                      </div>
                  </div>
              )})}
          </div>
        </div>

        <div className={`p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] lg:sticky lg:top-28 border backdrop-blur-xl h-fit shadow-sm ${cardBg}`}>
            <h3 className="font-black text-lg sm:text-xl mb-5 sm:mb-6">📅 Calendarul Meu</h3>
            <div className="space-y-3">
                {calendarEvents.length === 0 && <p className="opacity-50 text-xs sm:text-sm italic py-4">Nu ești înscris la niciun eveniment viitor.</p>}
                {calendarEvents.map(ev => (
                    <div key={ev.id} onClick={() => setSelectedPost(ev)} className={`cursor-pointer p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all relative overflow-hidden transform hover:-translate-y-1 hover:shadow-md ${darkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-white'}`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 sm:w-1.5 ${ev.type === 'holiday' ? 'bg-yellow-500' : (ev.type === 'exam' ? 'bg-purple-500' : 'bg-green-500')}`}></div>
                        <div className="font-bold text-xs sm:text-sm ml-2 sm:ml-3 line-clamp-1">{ev.title}</div>
                        <div className="text-[9px] sm:text-[10px] opacity-60 ml-2 sm:ml-3 mt-1 font-mono">{formatEventDateTime(ev)}</div>
                    </div>
                ))}
            </div>
        </div>
      </main>

      {/* FULL POST MODAL (Când dai click pe eveniment în Calendar) */}
      {selectedPost && (() => {
          const isRegExpired = selectedPost.registrationDeadline && new Date(selectedPost.registrationDeadline).getTime() <= now.getTime();
          const pTimer = renderTimer(selectedPost.registrationDeadline);

          return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto custom-scrollbar animate-popup" onClick={() => setSelectedPost(null)}>
            <div className={`w-full max-w-2xl rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border my-auto relative ${cardBg}`} onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedPost(null)} className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 w-10 h-10 sm:w-12 sm:h-12 bg-black/50 text-white rounded-full font-black backdrop-blur-md border border-white/20 hover:bg-black/70 hover:rotate-90 transition-all">✕</button>
              {selectedPost.imageUrl && <div className="h-40 sm:h-72 w-full bg-cover bg-center" style={{backgroundImage:`url(${selectedPost.imageUrl})`}}></div>}
              <div className="p-5 sm:p-10 relative">
                <h2 className="text-xl sm:text-3xl font-black mb-4 sm:mb-6 leading-tight">{selectedPost.title}</h2>
                <p className="text-sm sm:text-lg leading-relaxed opacity-90 whitespace-pre-wrap mb-6 sm:mb-8">{selectedPost.content}</p>
                
                {selectedPost.type === 'activity' && pTimer && !isRegExpired && (
                    <div className="mb-6 w-full text-center py-3 rounded-xl bg-orange-500/10 text-orange-500 font-bold border border-orange-500/20 text-sm">
                        ⏳ Înscrierile se închid în: <span className="font-black ml-1">{pTimer}</span>
                    </div>
                )}

                {selectedPost.type === 'activity' && user?.class !== 'Absolvent' && !isRegExpired && (
                  <button onClick={() => router.push('/dashboard')} className={`w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black text-base sm:text-lg shadow-xl transition-all bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:shadow-blue-500/30 hover:-translate-y-0.5`}>
                      Gestionează în Evenimente (Dashboard) ➡️
                  </button>
                )}
                
                {selectedPost.type === 'activity' && user?.class !== 'Absolvent' && isRegExpired && (
                  <div className="w-full text-center py-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col items-center gap-2">
                      <span className="font-black text-red-500 uppercase tracking-widest text-sm">Timpul a expirat</span>
                      <button onClick={(e) => {e.stopPropagation(); alert(`📞 Pentru modificări, contactează organizatorul:\n${selectedPost.organizerPhone || "Nu a fost specificat"}`)}} className="text-xs font-bold text-red-400 hover:text-red-500 underline">Contactează organizatorul</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          )
      })()}

      {/* MODAL ADMINISTRARE UTILIZATOR */}
      {adminUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className={`w-full max-w-2xl p-8 rounded-[2.5rem] border shadow-2xl relative animate-popup ${cardBg}`}>
              <button onClick={() => setAdminUserModal(null)} className="absolute top-6 right-6 w-10 h-10 bg-black/10 dark:bg-white/10 rounded-full font-bold hover:rotate-90 transition-transform">✕</button>
              
              <div className="flex items-center gap-4 mb-6 border-b border-black/10 dark:border-white/10 pb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center font-black text-2xl shadow-lg">{adminUserModal.name?.charAt(0)}</div>
                  <div>
                      <h2 className="text-2xl font-black text-red-500">{adminUserModal.name}</h2>
                      <p className="text-xs font-mono opacity-80 mt-1">ID: {adminUserModal.id}</p>
                      <div className="flex flex-wrap gap-4 mt-2 text-xs font-bold bg-black/5 dark:bg-white/5 p-2 rounded-lg inline-flex">
                          <span>📧 {adminUserModal.email}</span>
                          <span>📱 {adminUserModal.phone || 'Lipsă'}</span>
                          <span>🏫 {adminUserModal.class}</span>
                      </div>
                  </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                      <h3 className="font-black text-sm mb-3 text-blue-500">💬 Postări Forum ({adminUserForumPosts.length})</h3>
                      <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                          {adminUserForumPosts.map(p => (
                              <div key={p.id} className="text-xs p-2.5 bg-black/5 dark:bg-white/5 rounded-xl opacity-80 line-clamp-2">{p.text}</div>
                          ))}
                      </div>
                  </div>
                  <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                      <h3 className="font-black text-sm mb-3 text-green-500">🎟️ Istoric Calendar ({adminUserHistory.length})</h3>
                      <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                          {adminUserHistory.map((h, i) => (
                              <div key={i} className="text-xs p-2.5 bg-black/5 dark:bg-white/5 rounded-xl opacity-80">{h.title} <br/><span className="text-[9px] opacity-50 font-mono">{new Date(h.date).toLocaleDateString('ro-RO')}</span></div>
                          ))}
                      </div>
                  </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-black/10 dark:border-white/10">
                  <button onClick={handleResetPassword} className="py-3.5 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-xl font-black text-sm hover:bg-orange-500 hover:text-white transition">🔑 Trimite Resetare Parolă</button>
                  <button onClick={handleDeleteUser} className="py-3.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-black text-sm hover:bg-red-500 hover:text-white transition shadow-lg shadow-red-500/10">🗑️ Șterge Contul</button>
              </div>
            </div>
          </div>
      )}

      {/* MODAL SETARI */}
      {showSettings && !showContactAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-lg p-8 sm:p-10 rounded-[2.5rem] border shadow-2xl relative animate-popup ${cardBg}`}>
            <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 bg-black/10 dark:bg-white/10 rounded-full font-bold hover:rotate-90 transition-transform">✕</button>
            <h2 className="text-xl sm:text-2xl font-black mb-6 sm:mb-8 flex items-center gap-2">⚙️ Setări</h2>
            <div className="space-y-4 sm:space-y-6">
                <div>
                    <label className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-50 mb-1.5 sm:mb-2 block">Clasa Ta</label>
                    <input value={user.class} disabled className={`w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold border opacity-50 cursor-not-allowed ${darkMode ? 'bg-black/50 border-white/10' : 'bg-slate-100 border-slate-300'}`} />
                </div>
                <div>
                    <label className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-50 mb-1.5 sm:mb-2 block">Număr de telefon</label>
                    <input value={editPhone} onChange={e=>setEditPhone(e.target.value.replace(/\D/g,'').slice(0,10))} className={`w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold outline-none border focus:border-red-500 transition-colors ${darkMode ? 'bg-black/50 border-white/10' : 'bg-slate-100 border-slate-300'}`} />
                </div>
                
                <button onClick={handleSaveSettings} className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-red-600 to-rose-500 text-white rounded-xl sm:rounded-2xl font-black text-base sm:text-lg hover:shadow-lg hover:shadow-red-500/30 hover:-translate-y-0.5 transition-all">Salvează</button>

                <div className="grid grid-cols-2 gap-3 mt-4">
                    <button onClick={() => setShowContactAdmin(true)} className={`w-full py-3 sm:py-3.5 rounded-xl font-bold text-xs hover:-translate-y-0.5 transition-all shadow-md border ${darkMode ? 'bg-slate-800 text-white hover:bg-slate-700 border-white/10' : 'bg-slate-200 text-slate-800 hover:bg-slate-300 border-slate-300'}`}>📧 Contact Admin</button>
                    <button onClick={handleSecureLogout} className={`w-full py-3 sm:py-3.5 rounded-xl font-bold text-xs transition-all shadow-md border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white`}>🚪 Deconectare</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOTIFICARI */}
      {showNotif && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-md p-6 sm:p-8 rounded-[2.5rem] border shadow-2xl relative animate-popup ${cardBg}`}>
            <button onClick={() => setShowNotif(false)} className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 bg-black/10 dark:bg-white/10 rounded-full font-bold hover:rotate-90 transition-transform">✕</button>
            <h2 className="text-xl sm:text-2xl font-black mb-5 sm:mb-6 flex items-center gap-2">🔔 Notificări</h2>
            <div className="space-y-3 sm:space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {notifications.length === 0 && <p className="opacity-50 text-sm italic text-center py-10">Nicio notificare momentan.</p>}
              {notifications.map(n => (
                  <div key={n.id} className={`p-4 rounded-xl sm:rounded-2xl border flex justify-between items-start gap-3 sm:gap-4 transition-colors hover:border-red-500/30 ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                    <div>
                        <p className="font-black text-xs sm:text-sm mb-1 leading-snug">{n.title}</p>
                        <p className="text-xs sm:text-sm opacity-80 leading-relaxed">{n.message}</p>
                        <p className="text-[9px] sm:text-[10px] mt-2 font-mono opacity-40">{new Date(n.sentAt).toLocaleString('ro-RO')}</p>
                    </div>
                    <button onClick={() => handleDeleteNotif(n.id)} className="text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white p-2 rounded-lg transition-colors text-xs" title="Șterge">✕</button>
                  </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONTACT ADMIN */}
      {showContactAdmin && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className={`w-full max-w-lg p-8 sm:p-10 rounded-[2.5rem] border shadow-2xl relative animate-popup ${cardBg}`}>
              <button onClick={() => setShowContactAdmin(false)} className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 bg-black/10 dark:bg-white/10 rounded-full font-bold hover:rotate-90 transition-transform">✕</button>
              <h2 className="text-xl sm:text-2xl font-black mb-6 sm:mb-8 text-blue-500">📧 Contact Administrator</h2>
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
    </div>
  );
}