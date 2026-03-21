"use client";
import { useEffect, useState } from "react";
import { auth, db, storage } from "../lib/firebase"; 
import { sendPasswordResetEmail, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, collection, arrayUnion, arrayRemove, orderBy, onSnapshot, addDoc, query, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const BAD_WORDS = ['pula', 'pizda', 'muie', 'coaie', 'cacat', 'fut', 'sugi', 'dracu', 'mata', 'mortii', 'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy'];

const censorText = (text: string) => {
    if(!text) return "";
    let censored = text;
    BAD_WORDS.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        censored = censored.replace(regex, '***');
    });
    return censored;
};

const extractTags = (text: string) => {
    const tags = text.match(/#[a-zA-Z0-9_șțâăîȘȚÂĂÎ]+/g) || [];
    return Array.from(new Set(tags));
};

const timeAgo = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return "Chiar acum";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Acum ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Acum ${hours} ore`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Ieri";
    if (days < 30) return `Acum ${days} zile`;
    const months = Math.floor(days / 30);
    if (months < 12) return `Acum ${months} luni`;
    return `Acum ${Math.floor(months / 12)} ani`;
};

const getUserAvatarStyle = (uid: string) => {
    if (!uid) return { bg: "bg-slate-500", txt: "text-slate-200" };
    const gradients = ["from-blue-600 to-cyan-500", "from-purple-600 to-indigo-500", "from-emerald-600 to-teal-500", "from-red-600 to-rose-500", "from-orange-600 to-yellow-500", "from-pink-600 to-rose-500"];
    const hash = uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return { bg: `bg-gradient-to-br ${gradients[hash % gradients.length]} shadow-inner`, txt: "text-white/90" };
};

const UserAvatar = ({ uid, name, size = "md" }: { uid: string, name: string, size?: "sm" | "md" | "lg" }) => {
    const style = getUserAvatarStyle(uid);
    const initial = name?.charAt(0) || "?";
    const sizeClasses = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 sm:w-12 sm:h-12 text-lg sm:text-xl", lg: "w-16 h-16 text-3xl" };
    return (
        <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-black shrink-0 relative overflow-hidden group border border-white/10 ${style.bg} ${style.txt}`}>
            <span className="absolute text-white/[0.12] font-black text-[2.5em] -bottom-3 -right-2 transform rotate-12 group-hover:scale-110 transition-transform">G+</span>
            <span className="relative z-10 transition-transform group-hover:scale-105">{initial}</span>
        </div>
    );
};

// NOU: Calculare Rank bazat direct pe Scorul Total (Postări + Comentarii + Voturi)
const getUserRank = (role: string, score: number) => {
    if (role === 'admin') return { label: "🛡️ Admin", style: "bg-red-500/20 text-red-500 border-red-500/30" };
    if (role === 'profesor') return { label: "👨‍🏫 Profesor", style: "bg-indigo-500/20 text-indigo-500 border-indigo-500/30" };
    
    if (score >= 100) return { label: "💎 Legendă", style: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" };
    if (score >= 50) return { label: "🔥 Veteran", style: "bg-orange-500/20 text-orange-500 border-orange-500/30" };
    if (score >= 15) return { label: "⭐ Activ", style: "bg-green-500/20 text-green-500 border-green-500/30" };
    return { label: "🌱 Novice", style: "bg-slate-500/20 text-slate-500 border-slate-500/30" };
};

export default function Forum() {
  const [user, setUser] = useState<any>(null);
  const [usersDb, setUsersDb] = useState<any[]>([]); 
  const [forumPosts, setForumPosts] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostText, setNewPostText] = useState("");
  const [newPostCategory, setNewPostCategory] = useState("🗣️ Discuție Liberă");
  const [newPostImage, setNewPostImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [replyTexts, setReplyTexts] = useState<{[key: string]: string}>({});
  const [replyImages, setReplyImages] = useState<{[key: string]: File | null}>({});

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("new"); 
  const [darkMode, setDarkMode] = useState(true);
  const [hoveredUser, setHoveredUser] = useState<any>(null);
  
  const [savedThreads, setSavedThreads] = useState<string[]>([]);
  
  const [adminUserModal, setAdminUserModal] = useState<any>(null);
  const [adminUserForumPosts, setAdminUserForumPosts] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showContactAdmin, setShowContactAdmin] = useState(false);
  const [contactReason, setContactReason] = useState("Raportare Bug/Eroare");
  const [contactMessage, setContactMessage] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("ghiba_theme") === "light") setDarkMode(false);
    const unsubscribeAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/");
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) {
          const userData = { id: u.uid, ...snap.data() };
          setUser(userData);
          setSavedThreads(userData.savedForumPosts || []);
          setEditPhone(userData.phone || "");
          
          onSnapshot(query(collection(db, "users", u.uid, "notifications"), orderBy("sentAt", "desc")), (s) => setNotifications(s.docs.map(d => ({id: d.id, ...d.data()}))));
          onSnapshot(doc(db, "users", u.uid), s => { if(s.exists()) setSavedThreads(s.data().savedForumPosts || []); });
      }
    });

    const unsubPosts = onSnapshot(collection(db, "forum_posts"), (s) => setForumPosts(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubUsers = onSnapshot(collection(db, "users"), (s) => setUsersDb(s.docs.map(d => ({id: d.id, ...d.data()}))));

    return () => { unsubscribeAuth(); unsubPosts(); unsubUsers(); };
  }, [router, user?.id]);

  const handleImageChange = (e: any, setFileState: Function) => { if (e.target.files[0]) setFileState(e.target.files[0]); };

  const uploadImageToStorage = async (file: File, pathPrefix: string) => {
      const storageRef = ref(storage, `${pathPrefix}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
  };

  const handleCreatePost = async () => {
      if (!newPostTitle.trim() || !newPostText.trim()) return alert("Adaugă un titlu și o descriere pentru discuție!");
      setIsUploading(true);
      
      let imageUrl = "";
      if (newPostImage) {
          imageUrl = await uploadImageToStorage(newPostImage, "forum_posts");
      }

      const safeText = censorText(newPostText);
      const postTags = extractTags(safeText);

      await addDoc(collection(db, "forum_posts"), {
          title: censorText(newPostTitle), text: safeText, category: newPostCategory, tags: postTags, imageUrl, 
          authorId: user.id, authorName: user.name, authorRole: user.role,
          createdAt: new Date().toISOString(), likes: [], replies: [], locked: false, pinned: false // NOU: Pinned implicit fals
      });

      setNewPostTitle(""); setNewPostText(""); setNewPostImage(null); setNewPostCategory("🗣️ Discuție Liberă"); 
      setIsUploading(false); setShowCreateModal(false); 
  };

  const handleReply = async (postId: string) => {
      const text = replyTexts[postId];
      const imageFile = replyImages[postId];
      if((!text || !text.trim()) && !imageFile) return;
      
      setIsUploading(true);
      let replyImageUrl = "";
      if (imageFile) {
          replyImageUrl = await uploadImageToStorage(imageFile, "forum_replies");
      }

      const newReply = { 
          id: Date.now().toString(), 
          text: censorText(text || ""), 
          imageUrl: replyImageUrl,
          authorId: user.id, authorName: user.name, authorRole: user.role, 
          createdAt: new Date().toISOString() 
      };
      await updateDoc(doc(db, "forum_posts", postId), { replies: arrayUnion(newReply) });
      setReplyTexts(prev => ({...prev, [postId]: ""}));
      setReplyImages(prev => ({...prev, [postId]: null}));
      setIsUploading(false);
  };

  const deletePost = async (postId: string) => {
      if(!confirm("Ștergi această discuție definitiv?")) return;
      await deleteDoc(doc(db, "forum_posts", postId));
  };

  const deleteReply = async (postId: string, reply: any) => {
      if(!confirm("Ștergi acest răspuns?")) return;
      await updateDoc(doc(db, "forum_posts", postId), { replies: arrayRemove(reply) });
  };

  const handleUpvote = async (post: any) => {
      const isLiked = post.likes?.includes(user.id);
      await updateDoc(doc(db, "forum_posts", post.id), { likes: isLiked ? arrayRemove(user.id) : arrayUnion(user.id) });
  };

  const toggleLockPost = async (post: any) => {
      const willLock = !post.locked;
      if (!willLock && user.role !== 'admin') return alert("Doar un administrator poate redeschide o discuție blocată!");
      if (!confirm(willLock ? "Blochezi discuția? Nimeni nu va mai putea răspunde." : "Redeschizi discuția?")) return;
      await updateDoc(doc(db, "forum_posts", post.id), { locked: willLock });
  };

  // NOU: Funcție de Pin/Fixare doar pentru Admini
  const togglePinPost = async (post: any) => {
      if (user.role !== 'admin') return;
      const willPin = !post.pinned;
      await updateDoc(doc(db, "forum_posts", post.id), { pinned: willPin });
  };

  const toggleBookmarkThread = async (postId: string) => {
      const isSaved = savedThreads.includes(postId);
      await updateDoc(doc(db, "users", user.id), { savedForumPosts: isSaved ? arrayRemove(postId) : arrayUnion(postId) });
  };

  const openAdminUserModal = async (userId: string) => {
      if(user.role !== 'admin') return;
      const targetUser = usersDb.find(u => u.id === userId);
      if(!targetUser) return;
      
      const userPosts = forumPosts.filter(p => p.authorId === targetUser.id);
      setAdminUserForumPosts(userPosts); setAdminUserModal(targetUser);
  };

  const handleResetPassword = async () => {
      if(!confirm(`Trimite link de resetare parolă pe ${adminUserModal.email}?`)) return;
      await sendPasswordResetEmail(auth, adminUserModal.email);
      alert("Email-ul de resetare a fost trimis!");
  };

  const handleDeleteUser = async () => {
      if(!confirm("⚠️ EȘTI ABSOLUT SIGUR? Ștergi documentul elevului din baza de date.")) return;
      await deleteDoc(doc(db, "users", adminUserModal.id));
      alert("Utilizatorul eliminat!"); setAdminUserModal(null);
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
      if(contactMessage.trim().length < 5) return alert("Mesajul e prea scurt.");
      await addDoc(collection(db, "admin_messages"), { userId: user.id, userName: user.name, userClass: user.class, reason: contactReason, message: contactMessage, createdAt: new Date().toISOString() });
      alert("Mesajul trimis!"); setShowContactAdmin(false); setContactMessage("");
  };

  if (!user) return null;

  const bgMain = darkMode ? "bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-black to-slate-950 text-white" : "bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-100 via-white to-blue-100 text-slate-800";
  const cardBg = darkMode ? "bg-slate-900/60 border-white/10 shadow-lg" : "bg-white border-slate-200/60 shadow-xl shadow-slate-200/50";
  const inputBg = darkMode ? "bg-black/50 border-white/10 text-white focus:bg-black/70" : "bg-slate-100 border-slate-300 text-slate-900 focus:bg-white";

  let filteredForumPosts = forumPosts.filter(p => {
      const sq = searchQuery.toLowerCase();
      const matchesSearch = (p.title?.toLowerCase().includes(sq) || p.text?.toLowerCase().includes(sq) || p.authorName?.toLowerCase().includes(sq) || p.tags?.some((t:any) => t.toLowerCase().includes(sq)));
      if (sortBy === "saved") return matchesSearch && savedThreads.includes(p.id);
      return matchesSearch;
  });

  // NOU: Logica de Sortare Actualizată (Pinned primează)
  filteredForumPosts.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      if (sortBy === "top") return (b.likes?.length || 0) - (a.likes?.length || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); 
  });

  const allTags = forumPosts.flatMap(p => p.tags || []);
  const tagCounts = allTags.reduce((acc, tag) => { acc[tag] = (acc[tag] || 0) + 1; return acc; }, {});
  const topTags = Object.entries(tagCounts).sort((a:any, b:any) => b[1] - a[1]).slice(0, 5);

  // NOU: Calculare Leaderboard Inclusiv cu Comentarii!
  const topUsers = [...usersDb]
      .filter(u => u.role !== 'admin') // Excludem adminii din top
      .map(u => {
          const userPosts = forumPosts.filter(p => p.authorId === u.id);
          const totalUpvotes = userPosts.reduce((acc, p) => acc + (p.likes?.length || 0), 0);
          
          let repliesCount = 0;
          forumPosts.forEach(post => {
              if (post.replies) {
                  repliesCount += post.replies.filter((r:any) => r.authorId === u.id).length;
              }
          });

          // Formula Nouă: Postare=2pct, Comentariu=1pct, Upvote=1pct
          const score = (userPosts.length * 2) + repliesCount + totalUpvotes;
          return { ...u, score, postsCount: userPosts.length, repliesCount, totalUpvotes };
      })
      .filter(u => u.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

  return (
    <div className={`min-h-screen relative transition-colors duration-500 overflow-x-hidden ${bgMain}`}>
      <style dangerouslySetInnerHTML={{__html: ` 
        @keyframes popupEnter { 0% { transform: scale(0.95) translateY(15px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } } 
        .animate-popup { animation: popupEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes gradMove { 0% { background-position: 0% 0%; } 50% { background-position: 100% 100%; } 100% { background-position: 0% 0%; } }
        body { background-size: 200% 200%; animation: gradMove 15s ease infinite; }
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      {/* NAVBAR */}
      <nav className={`fixed top-0 w-full z-40 px-4 py-3 sm:py-4 backdrop-blur-2xl border-b flex justify-between items-center transition-all ${darkMode ? 'bg-slate-950/80 border-white/10' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-6xl mx-auto w-full flex justify-between items-center gap-2 sm:gap-4">
            <h1 className="text-xl sm:text-2xl font-black shrink-0 cursor-pointer" onClick={() => router.push('/dashboard')}>Ghiba<span className="text-blue-500">+</span></h1>
            
            <div className="hidden sm:flex flex-1 max-w-md mx-4 items-center justify-center">
                 <div className="relative group w-full max-w-[200px] focus-within:max-w-full transition-all duration-500 ease-in-out flex justify-center">
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none z-10 group-focus-within:text-blue-500">🔍</span>
                     <input placeholder="Caută în forum..." className={`w-full rounded-full pl-11 pr-5 py-2 text-sm font-medium outline-none border transition-all duration-300 shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 ${inputBg}`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                 </div>
            </div>
            
            <input placeholder="🔍 Caută..." className={`sm:hidden flex-1 w-24 rounded-full px-3 py-1.5 text-xs outline-none border transition-all focus:flex-auto focus:border-blue-500 ${inputBg}`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            
            <div className={`flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full border shadow-sm transition-all shrink-0 ${darkMode ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-300'}`}>
                <button onClick={toggleTheme} className="w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-transform hover:rotate-[15deg] hover:scale-110 text-xs sm:text-base">{darkMode ? '☀️' : '🌙'}</button>
                <button onClick={openNotifications} className="relative w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-transform hover:scale-110 text-xs sm:text-base">🔔 {notifications.some(n=>!n.read) && <span className="absolute top-1 right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-600 rounded-full border-2 border-white dark:border-slate-800 animate-pulse"></span>}</button>
                <button onClick={() => setShowSettings(true)} className="w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-transform duration-300 hover:rotate-90 origin-center text-xs sm:text-base">⚙️</button>

                <div className="flex items-center gap-1 sm:gap-2 pl-1 sm:pl-2 border-l border-black/10 dark:border-white/10 ml-0.5 sm:ml-1">
                    {(user.role === 'admin' || user.role === 'profesor') && (
                        <button onClick={() => router.push('/admin')} className={`bg-gradient-to-r ${user.role === 'profesor' ? 'from-blue-600 to-indigo-500 shadow-blue-500/20' : 'from-red-600 to-rose-500 shadow-red-500/20'} text-white px-2 py-1 sm:px-4 sm:py-1.5 rounded-full text-[9px] sm:text-[11px] font-black shadow-lg hover:-translate-y-0.5 transition-all`}>
                            <span className="hidden sm:inline">{user.role === 'admin' ? 'ADMIN' : 'PROFESOR'}</span>
                            <span className="sm:hidden">{user.role === 'admin' ? 'ADM' : 'PROF'}</span>
                        </button>
                    )}
                    <button onClick={handleSecureLogout} className="text-[10px] sm:text-xs font-bold opacity-60 hover:opacity-100 hover:text-red-500 transition-colors pr-1 sm:pr-2 hidden sm:block">Deconectare</button>
                    <button onClick={handleSecureLogout} className="sm:hidden text-sm opacity-60 hover:opacity-100 hover:text-red-500 pl-1 pr-1" title="Deconectare">🚪</button>
                </div>
            </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-3 sm:p-4 pt-20 sm:pt-28 grid lg:grid-cols-3 gap-4 sm:gap-8 relative z-10">
        <div className="lg:col-span-2">
            
          {/* TOP TABS DASHBOARD */}
          <div className={`flex justify-between items-center p-2 rounded-2xl border backdrop-blur-xl mb-4 sm:mb-6 shadow-sm overflow-x-auto hide-scroll ${cardBg}`}>
              <div className="flex gap-2">
                  <button onClick={() => router.push('/dashboard')} className={`px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-black rounded-xl transition-all duration-300 opacity-60 hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 whitespace-nowrap`}>📢 ANUNȚURI</button>
                  <button onClick={() => router.push('/dashboard')} className={`px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-black rounded-xl transition-all duration-300 opacity-60 hover:opacity-100 hover:bg-green-500/10 hover:text-green-500 whitespace-nowrap`}>🎟️ EVENIMENTE</button>
                  <button className={`px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-black rounded-xl transition-all duration-300 bg-blue-500 text-white shadow-md whitespace-nowrap`}>💬 FORUM</button>
              </div>
          </div>

          {/* MENIU FORUM */}
          <div className={`flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-4 sm:mb-6 p-2 rounded-2xl border shadow-sm ${cardBg}`}>
              <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto hide-scroll pb-1 sm:pb-0">
                  <button onClick={() => setSortBy("new")} className={`shrink-0 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${sortBy === 'new' ? 'bg-blue-500 text-white shadow-md' : 'opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}>🕒 Noutăți</button>
                  <button onClick={() => setSortBy("top")} className={`shrink-0 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${sortBy === 'top' ? 'bg-orange-500 text-white shadow-md' : 'opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}>🔥 Top</button>
                  <button onClick={() => setSortBy("saved")} className={`shrink-0 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 ${sortBy === 'saved' ? 'bg-teal-500 text-white shadow-md' : 'opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}>💾 <span className="hidden sm:inline">Salvate</span> {savedThreads.length > 0 && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10">{savedThreads.length}</span>}</button>
              </div>
              <button onClick={() => setShowCreateModal(true)} className="flex-none justify-center bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 sm:py-2 rounded-xl text-sm font-black shadow-lg shadow-blue-500/20 transition-transform hover:-translate-y-0.5 flex items-center gap-2">
                  ➕ <span>Discuție Nouă</span>
              </button>
          </div>

          {/* LISTA POSTĂRI */}
          <div className="space-y-4 sm:space-y-6">
              {filteredForumPosts.length === 0 && <p className="opacity-50 text-center py-10 sm:py-12 italic bg-black/5 dark:bg-white/5 rounded-2xl font-bold text-sm">Nicio discuție găsită în această secțiune.</p>}
              
              {filteredForumPosts.map(post => {
                  const authorInfo = usersDb.find(u => u.id === post.authorId) || { class: 'Necunoscut', role: 'user', id:'?' };
                  
                  // Calcul Scorul Autorului pt afisarea Rank-ului Live
                  const userPostsCount = forumPosts.filter(p => p.authorId === post.authorId).length;
                  const userTotalUpvotes = forumPosts.filter(p => p.authorId === post.authorId).reduce((acc, p) => acc + (p.likes?.length || 0), 0);
                  let userRepliesCount = 0;
                  forumPosts.forEach(p => { userRepliesCount += p.replies?.filter((r:any) => r.authorId === post.authorId).length || 0; });
                  
                  const userScore = (userPostsCount * 2) + userRepliesCount + userTotalUpvotes;
                  const userRank = getUserRank(authorInfo.role, userScore);

                  const hasUpvoted = post.likes?.includes(user.id);
                  const canLock = user.role === 'admin' || user.id === post.authorId;
                  const isSaved = savedThreads.includes(post.id);

                  return (
                  <div key={post.id} className={`rounded-[1.5rem] sm:rounded-[2rem] border backdrop-blur-xl overflow-hidden shadow-sm flex ${cardBg} ${post.locked ? 'opacity-80' : ''} ${post.pinned ? 'ring-2 ring-green-500/30' : ''}`}>
                      
                      {/* Coloana Upvote */}
                      <div className={`w-10 sm:w-16 flex flex-col items-center pt-4 sm:pt-6 px-1 sm:px-0 border-r shrink-0 ${darkMode ? 'bg-white/[0.02] border-white/5' : 'bg-black/[0.02] border-black/5'}`}>
                          <button onClick={() => handleUpvote(post)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-transform hover:bg-blue-500/10 ${hasUpvoted ? 'text-blue-500 scale-110' : 'opacity-40 hover:opacity-100 hover:text-blue-500'}`}>
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg>
                          </button>
                          <span className={`font-black text-xs sm:text-base my-1 ${hasUpvoted ? 'text-blue-500' : 'opacity-80'}`}>{post.likes?.length || 0}</span>
                          <span className="text-[9px] sm:text-[10px] opacity-40 font-bold mt-2 sm:mt-4" title={`${post.replies?.length || 0} răspunsuri`}>💬 {post.replies?.length || 0}</span>
                      </div>

                      {/* Conținut Postare */}
                      <div className="flex-1 p-3 sm:p-6 min-w-0 flex flex-col">
                          
                          {/* HEADER POSTARE */}
                          <div className="flex flex-wrap justify-between items-start gap-2 sm:gap-4 mb-3 sm:mb-4">
                              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                  <UserAvatar uid={authorInfo.id} name={post.authorName} size="sm" />
                                  <div 
                                    className={`relative cursor-pointer min-w-0 ${user.role === 'admin' ? 'hover:text-blue-500 transition-colors' : ''}`}
                                    onMouseEnter={() => setHoveredUser(post.authorId)}
                                    onMouseLeave={() => setHoveredUser(null)}
                                    onClick={() => openAdminUserModal(post.authorId)}
                                  >
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                          <p className="font-black text-xs sm:text-base leading-tight truncate max-w-[120px] sm:max-w-[200px]">{post.authorName}</p>
                                          <span className={`text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase border whitespace-nowrap ${userRank.style}`}>{userRank.label}</span>
                                      </div>
                                      <p className="text-[9px] sm:text-[10px] opacity-50 font-mono mt-0.5 truncate">{authorInfo.class} • <span className="font-sans font-medium">{timeAgo(post.createdAt)}</span></p>
                                      
                                      {/* MODAL HOVER PROFIL */}
                                      {hoveredUser === post.authorId && (
                                          <div className={`absolute top-full left-0 mt-2 p-4 rounded-3xl border shadow-2xl z-20 w-56 sm:w-64 text-xs animate-popup ${darkMode ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'}`}>
                                              <p className="font-black text-blue-500 mb-1 text-sm">{post.authorName}</p>
                                              <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase mb-3 inline-block border ${userRank.style}`}>{userRank.label}</span>
                                              
                                              <div className="grid grid-cols-3 gap-1 mt-2 pt-2 border-t border-black/10 dark:border-white/10">
                                                  <div className={`bg-black/5 dark:bg-white/5 p-2 rounded-lg text-center border ${darkMode?'border-white/5':'border-slate-100'}`}>
                                                      <p className="text-[8px] sm:text-[9px] opacity-60 font-bold uppercase">Postări</p>
                                                      <p className="font-black text-blue-500 text-xs sm:text-sm">{userPostsCount}</p>
                                                  </div>
                                                  <div className={`bg-black/5 dark:bg-white/5 p-2 rounded-lg text-center border ${darkMode?'border-white/5':'border-slate-100'}`}>
                                                      <p className="text-[8px] sm:text-[9px] opacity-60 font-bold uppercase">Răspunsuri</p>
                                                      <p className="font-black text-teal-500 text-xs sm:text-sm">{userRepliesCount}</p>
                                                  </div>
                                                  <div className={`bg-black/5 dark:bg-white/5 p-2 rounded-lg text-center border ${darkMode?'border-white/5':'border-slate-100'}`}>
                                                      <p className="text-[8px] sm:text-[9px] opacity-60 font-bold uppercase">Voturi</p>
                                                      <p className="font-black text-orange-500 text-xs sm:text-sm">{userTotalUpvotes}</p>
                                                  </div>
                                              </div>
                                              <p className="mt-3 opacity-60 text-[10px] text-center">Clasa: <span className="font-mono font-black">{authorInfo.class}</span></p>
                                          </div>
                                      )}
                                  </div>
                              </div>
                              
                              {/* ACTIONS (Salvare, Pin, Inhide, Sterge) */}
                              <div className="flex items-center gap-1 shrink-0 bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/5">
                                  {post.locked && <span className="hidden sm:inline-block text-[8px] sm:text-[9px] font-black text-orange-500 bg-orange-500/10 px-1.5 py-1 rounded border border-orange-500/20 mr-1">🔒 ÎNCHIS</span>}
                                  
                                  {user.role === 'admin' && (
                                      <button onClick={() => togglePinPost(post)} className={`p-1.5 sm:p-2 rounded-lg transition-colors flex items-center justify-center opacity-40 hover:opacity-100 hover:text-green-500 hover:bg-green-500/10 ${post.pinned ? 'text-green-500 opacity-100 bg-green-500/10' : ''}`} title={post.pinned ? "Scoate Pin" : "Fixează discuția (Pin)"}>
                                          📌
                                      </button>
                                  )}

                                  <button onClick={() => toggleBookmarkThread(post.id)} className={`p-1.5 sm:p-2 rounded-lg transition-colors flex items-center justify-center ${isSaved ? 'text-teal-500 bg-teal-500/10' : 'opacity-40 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`} title={isSaved ? "Șterge din Salvate" : "Salvează pentru mai târziu"}>
                                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                                  </button>
                                  
                                  {canLock && (
                                      <button onClick={() => toggleLockPost(post)} className={`p-1.5 sm:p-2 rounded-lg transition-colors flex items-center justify-center opacity-40 hover:opacity-100 hover:text-orange-500 hover:bg-orange-500/10`} title={post.locked ? "Redeschide discuția" : "Închide discuția"}>
                                          {post.locked ? '🔓' : '🔒'}
                                      </button>
                                  )}
                                  
                                  {(user.role === 'admin' || user.id === post.authorId) && (
                                      <button onClick={() => deletePost(post.id)} className={`p-1.5 sm:p-2 rounded-lg transition-colors flex items-center justify-center opacity-40 hover:opacity-100 hover:text-red-500 hover:bg-red-500/10`} title="Șterge discuția">
                                          <svg className="w-4 h-4 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                      </button>
                                  )}
                              </div>
                          </div>

                          <div className="mb-2 flex items-center gap-1.5 flex-wrap">
                              {post.pinned && <span className="text-[9px] sm:text-[10px] font-black tracking-wide bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">📌 FIXAT</span>}
                              {post.category && <span className="text-[9px] sm:text-[10px] font-black tracking-wide bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">{post.category}</span>}
                              <h3 className="text-base sm:text-xl font-black leading-snug break-words sm:break-normal inline">{post.title}</h3>
                          </div>
                          
                          <p className="text-xs sm:text-sm leading-relaxed mb-3 sm:mb-4 whitespace-pre-wrap opacity-90" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{post.text}</p>
                          
                          {/* Afișare Hashtags */}
                          {post.tags && post.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-3 sm:mb-4">
                                  {post.tags.map((t:string) => <span key={t} onClick={() => setSearchQuery(t)} className="text-[9px] sm:text-[10px] font-black text-blue-400 bg-blue-500/10 hover:bg-blue-500 hover:text-white cursor-pointer px-2 py-0.5 rounded transition-colors">{t}</span>)}
                              </div>
                          )}

                          {post.imageUrl && <img src={post.imageUrl} alt="Forum G+" className="w-full max-h-60 sm:max-h-80 rounded-xl sm:rounded-2xl mb-4 border border-black/10 dark:border-white/10 shadow-inner object-cover" />}

                          {/* REPLIES SECTION G+ */}
                          {post.replies?.length > 0 && (
                            <div className={`mt-2 pt-3 sm:pt-4 space-y-3 sm:space-y-4 border-t ${darkMode?'border-white/5':'border-slate-100'} ${post.locked ? 'opacity-80' : ''}`}>
                                {post.replies?.map((reply:any) => (
                                    <div key={reply.id} className="flex gap-2 sm:gap-3 items-start group relative">
                                        <div className="mt-1"><UserAvatar uid={reply.authorId} name={reply.authorName} size="sm" /></div>
                                        <div className={`flex-1 p-2.5 sm:p-3.5 rounded-2xl rounded-tl-sm border min-w-0 ${darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                            <div className="flex justify-between items-start mb-1.5 gap-2">
                                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                                    <span className={`text-[11px] sm:text-xs font-black truncate max-w-[100px] sm:max-w-[150px] ${reply.authorRole === 'admin' ? 'text-red-500' : 'text-blue-500'}`}>{reply.authorName}</span>
                                                    {reply.authorId === post.authorId && <span className="text-[7px] sm:text-[8px] bg-indigo-500/20 text-indigo-500 px-1 py-0.5 rounded font-black border border-indigo-500/30">AUTOR</span>}
                                                    {reply.authorRole === 'admin' && <span className="text-[7px] sm:text-[8px] bg-red-500/20 text-red-500 px-1 py-0.5 rounded font-black border border-red-500/30">ADM</span>}
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <span className="text-[9px] sm:text-[10px] opacity-40 font-sans font-medium whitespace-nowrap">{timeAgo(reply.createdAt)}</span>
                                                    {(user.role === 'admin' || user.id === reply.authorId) && (
                                                        <button onClick={() => deleteReply(post.id, reply)} className="text-[10px] text-red-500 font-black px-1.5 py-0.5 opacity-100 sm:opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded transition" title="Șterge răspuns">✕</button>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-xs sm:text-sm opacity-90" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{reply.text}</p>
                                            {reply.imageUrl && <img src={reply.imageUrl} alt="Reply G+" className="w-full max-h-48 sm:max-h-60 rounded-xl mt-2 sm:mt-3 border border-black/5 dark:border-white/5 object-cover" />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                          )}

                          {/* INPUT RĂSPUNS NOU - Design Chat */}
                          {!post.locked ? (
                              <div className="flex flex-col gap-2 mt-4 sm:mt-6">
                                  <div className={`flex items-center p-1 sm:p-1.5 rounded-full border focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all ${inputBg}`}>
                                      
                                      <label className="w-8 h-8 sm:w-10 sm:h-10 rounded-full opacity-50 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer flex items-center justify-center transition shrink-0" title="Atașează o imagine">
                                          🖼️
                                          <input type="file" accept="image/*" className="hidden" onChange={(e)=>handleImageChange(e, (file:any) => setReplyImages({...replyImages, [post.id]: file}))} />
                                      </label>
                                      
                                      <input placeholder="Scrie un răspuns..." value={replyTexts[post.id] || ""} onChange={e=>setReplyTexts({...replyTexts, [post.id]: e.target.value})} className="flex-1 px-2 sm:px-3 text-xs sm:text-sm bg-transparent outline-none border-none placeholder-gray-500 dark:placeholder-gray-400 min-w-0" />
                                      
                                      <button onClick={() => handleReply(post.id)} disabled={isUploading || (!replyTexts[post.id]?.trim() && !replyImages[post.id])} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 shadow-sm text-xs sm:text-base" title="Trimite răspuns">
                                          ➤
                                      </button>
                                  </div>
                                  {replyImages[post.id] && <p className="text-[10px] sm:text-xs text-green-500 font-bold ml-3 sm:ml-4 truncate">Imagine: {replyImages[post.id]?.name}</p>}
                              </div>
                          ) : (
                              <div className="mt-4 sm:mt-6 text-[10px] sm:text-xs text-center py-2 sm:py-3 border border-orange-500/20 text-orange-500 bg-orange-500/10 rounded-xl sm:rounded-2xl font-bold opacity-80">
                                  🔒 Această discuție este închisă. Nu se mai pot adăuga răspunsuri.
                              </div>
                          )}
                      </div>
                  </div>
              )})}
          </div>
        </div>

        {/* SIDEBAR DREAPTA NOU (FĂRĂ CALENDAR) */}
        <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-28 h-fit">
            
            {/* Secțiunea TRENDURI */}
            <div className={`p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border backdrop-blur-xl shadow-sm ${cardBg}`}>
                <h3 className="font-black text-base sm:text-lg mb-3 sm:mb-4 text-blue-500 flex items-center gap-2">🔥 Trenduri G+</h3>
                {topTags.length === 0 ? (
                    <p className="text-[10px] sm:text-xs opacity-50 italic">Folosește #hashtag-uri în postări pentru a crea trenduri!</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {topTags.map(([tag, count]: any) => (
                            <button key={tag} onClick={() => setSearchQuery(tag)} className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-black transition-all border hover:border-blue-500 hover:text-blue-500 flex items-center gap-1.5 ${darkMode?'bg-white/5 border-white/10':'bg-black/5 border-black/10'}`}>
                                {tag} <span className="opacity-40 font-mono text-[9px] sm:text-[10px] bg-black/10 dark:bg-white/10 px-1.5 rounded-full">{count}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Secțiunea TOP CONTRIBUITORI */}
            <div className={`p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border backdrop-blur-xl shadow-sm ${cardBg}`}>
                <h3 className="font-black text-base sm:text-lg mb-4 sm:mb-5 text-yellow-500 flex items-center gap-2">🏆 Top Contribuitori</h3>
                <div className="space-y-3 sm:space-y-4">
                    {topUsers.length === 0 && <p className="opacity-50 text-[10px] sm:text-xs italic py-2">Fii primul care postează pe forum!</p>}
                    {topUsers.map((u, index) => {
                        const rankInfo = getUserRank(u.role, u.score);
                        return (
                            <div key={u.id} className="flex items-center gap-3">
                                <div className="font-black text-lg sm:text-xl w-4 text-center opacity-40">{index + 1}</div>
                                <UserAvatar uid={u.id} name={u.name} size="sm" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-xs sm:text-sm truncate">{u.name}</p>
                                    <p className="text-[9px] sm:text-[10px] opacity-60 truncate">
                                        <span className={rankInfo.style.split(' ')[1]}>{rankInfo.label.split(' ')[1]}</span> • {u.score} pct.
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Secțiunea REGULAMENT */}
            <div className={`p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border backdrop-blur-xl shadow-sm ${cardBg}`}>
                <h3 className="font-black text-base sm:text-lg mb-3 sm:mb-4 text-red-500 flex items-center gap-2">📜 Reguli Comunitate</h3>
                <ul className="space-y-3 text-[10px] sm:text-xs opacity-80 font-medium">
                    <li className="flex items-start gap-2"><span>1.</span><span>Fii respectuos cu toți elevii și profesorii. Fără insulte.</span></li>
                    <li className="flex items-start gap-2"><span>2.</span><span>Fără spam sau reclame comerciale.</span></li>
                    <li className="flex items-start gap-2"><span>3.</span><span>Păstrează discuțiile în categoria corespunzătoare.</span></li>
                    <li className="flex items-start gap-2"><span>4.</span><span>Ajută-i pe ceilalți! O comunitate puternică crește împreună.</span></li>
                </ul>
            </div>
        </div>
      </main>

      {/* MODAL CREARE POSTARE (POP-UP) */}
      {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
              <div className={`w-full max-w-2xl p-5 pt-10 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border shadow-2xl relative animate-popup my-auto ${cardBg}`}>
                  <button onClick={() => setShowCreateModal(false)} className="absolute top-3 right-3 sm:top-5 sm:right-5 w-10 h-10 sm:w-12 sm:h-12 bg-black/10 dark:bg-white/10 rounded-full font-black text-lg sm:text-xl hover:bg-red-500 hover:text-white hover:rotate-90 transition-all flex items-center justify-center z-50 shadow-sm">✕</button>
                  
                  <div className="flex items-center gap-3 mb-4 sm:mb-6 relative z-10 pr-10">
                      <UserAvatar uid={user.id} name={user.name} size="md" />
                      <h2 className="text-lg sm:text-2xl font-black leading-tight">Deschide o discuție nouă</h2>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-3 sm:mb-4 relative z-10">
                      <select value={newPostCategory} onChange={e=>setNewPostCategory(e.target.value)} className={`w-full sm:w-1/3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold outline-none border focus:border-blue-500 transition-colors cursor-pointer ${inputBg}`}>
                          <option value="🗣️ Discuție Liberă" className="bg-white text-black">🗣️ Discuție Liberă</option>
                          <option value="❓ Întrebare" className="bg-white text-black">❓ Întrebare</option>
                          <option value="💡 Idee / Propunere" className="bg-white text-black">💡 Idee / Propunere</option>
                          <option value="📚 Materiale / Temă" className="bg-white text-black">📚 Materiale / Temă</option>
                          <option value="🚨 Problemă" className="bg-white text-black">🚨 Problemă</option>
                      </select>
                      <input placeholder="Titlul discuției (ex: Ajutor proiect biologie)" value={newPostTitle} onChange={e=>setNewPostTitle(e.target.value)} className={`w-full sm:w-2/3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold outline-none border focus:border-blue-500 transition-colors ${inputBg}`} />
                  </div>

                  <textarea placeholder="Descrie pe larg subiectul... Poți folosi #hashtag-uri! (ex: Am nevoie de ajutor la #mate)" value={newPostText} onChange={e=>setNewPostText(e.target.value)} className={`w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm outline-none border h-32 sm:h-40 resize-none mb-4 sm:mb-6 focus:border-blue-500 transition-colors relative z-10 ${inputBg}`} />
                  
                  <div className="flex flex-wrap justify-between items-center relative z-10 border-t pt-4 sm:pt-6 border-black/10 dark:border-white/10 gap-3">
                      <label className="text-xs sm:text-sm font-bold opacity-60 hover:opacity-100 hover:text-blue-500 cursor-pointer transition flex items-center gap-2 bg-black/5 dark:bg-white/5 px-3 py-2 sm:px-4 sm:py-3 rounded-xl border border-transparent hover:border-blue-500/30">
                          📸 <span>Adaugă Imagine</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e)=>handleImageChange(e, setNewPostImage)} />
                      </label>
                      
                      <button onClick={handleCreatePost} disabled={isUploading || !newPostTitle.trim() || !newPostText.trim()} className="flex-1 sm:flex-none px-6 sm:px-8 py-3 bg-blue-600 text-white rounded-xl font-black text-sm shadow-lg shadow-blue-500/30 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5 text-center">
                          {isUploading ? 'Se publică...' : 'Publică'}
                      </button>
                  </div>
                  {newPostImage && <p className="text-[10px] sm:text-xs mt-3 font-bold text-green-500 truncate">✅ Imagine: {newPostImage.name}</p>}
              </div>
          </div>
      )}

      {/* MODAL ADMINISTRARE UTILIZATOR */}
      {adminUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <div className={`w-full max-w-2xl p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border shadow-2xl relative animate-popup my-auto ${cardBg}`}>
              <button onClick={() => setAdminUserModal(null)} className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 bg-black/10 dark:bg-white/10 rounded-full font-bold hover:rotate-90 transition-transform flex items-center justify-center">✕</button>
              
              <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 border-b border-black/10 dark:border-white/10 pb-4 sm:pb-6 pr-8">
                  <UserAvatar uid={adminUserModal.id} name={adminUserModal.name} size="lg" />
                  <div className="min-w-0">
                      <h2 className="text-xl sm:text-2xl font-black text-red-500 truncate">{adminUserModal.name}</h2>
                      <p className="text-[9px] sm:text-[10px] font-mono opacity-60 mt-0.5 truncate">ID: {adminUserModal.id}</p>
                      <div className="flex flex-wrap gap-2 sm:gap-4 mt-2 sm:mt-2.5 text-[10px] sm:text-xs font-bold bg-black/5 dark:bg-white/5 p-2 rounded-lg inline-flex max-w-full">
                          <span className="truncate">📧 {adminUserModal.email}</span>
                          <span className="truncate">📱 {adminUserModal.phone || 'Lipsă'}</span>
                          <span className="truncate">🏫 <span className="font-mono">{adminUserModal.class}</span></span>
                      </div>
                  </div>
              </div>

              <div className="mb-4 sm:mb-6">
                  <div className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border ${darkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                      <h3 className="font-black text-sm sm:text-base mb-3 text-blue-500 flex items-center gap-2">💬 Postări pe Forum ({adminUserForumPosts.length})</h3>
                      <div className="space-y-3 max-h-48 sm:max-h-60 overflow-y-auto custom-scrollbar pr-2">
                          {adminUserForumPosts.length === 0 && <p className="opacity-50 text-xs italic">Nicio postare pe forum.</p>}
                          {adminUserForumPosts.map(p => (
                              <div key={p.id} className={`p-3 bg-black/5 dark:bg-white/5 rounded-xl border ${darkMode?'border-white/5':'border-slate-100'}`}>
                                  <div className="flex justify-between items-start mb-1 gap-2">
                                      <span className="font-bold text-[11px] sm:text-xs truncate">{p.title}</span>
                                      <span className="text-[9px] sm:text-[10px] font-black text-blue-500 shrink-0">⬆ {p.likes?.length || 0} voturi</span>
                                  </div>
                                  <div className="text-[9px] sm:text-[10px] opacity-60 line-clamp-2">{p.text}</div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-black/10 dark:border-white/10">
                  <button onClick={handleResetPassword} className="py-3 sm:py-3.5 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-xl font-black text-xs sm:text-sm hover:bg-orange-500 hover:text-white transition">🔑 Trimite Resetare Parolă</button>
                  <button onClick={handleDeleteUser} className="py-3 sm:py-3.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-black text-xs sm:text-sm hover:bg-red-500 hover:text-white transition shadow-lg shadow-red-500/10">🗑️ Șterge Contul</button>
              </div>
            </div>
          </div>
      )}

      {/* MODAL SETARI */}
      {showSettings && !showContactAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className={`w-full max-w-lg p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[2.5rem] border shadow-2xl relative animate-popup my-auto ${cardBg}`}>
            <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 bg-black/10 dark:bg-white/10 rounded-full font-bold hover:rotate-90 transition-transform flex items-center justify-center">✕</button>
            <h2 className="text-lg sm:text-2xl font-black mb-6 sm:mb-8 flex items-center gap-2">⚙️ Setări Ghiba+</h2>
            <div className="space-y-4 sm:space-y-6">
                <div>
                    <label className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-50 mb-1.5 sm:mb-2 block">Clasa Ta</label>
                    <input value={user.class} disabled className={`w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold border font-mono opacity-50 cursor-not-allowed ${darkMode ? 'bg-black/50 border-white/10' : 'bg-slate-100 border-slate-300'}`} />
                </div>
                <div>
                    <label className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-50 mb-1.5 sm:mb-2 block">Număr de telefon (10 cifre)</label>
                    <input value={editPhone} onChange={e=>setEditPhone(e.target.value.replace(/\D/g,'').slice(0,10))} className={`w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold outline-none border focus:border-blue-500 transition-colors ${darkMode ? 'bg-black/50 border-white/10' : 'bg-slate-100 border-slate-300'}`} />
                </div>
                
                <button onClick={handleSaveSettings} className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all">Salvează Setările</button>

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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto custom-scrollbar">
          <div className={`w-full max-w-md p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border shadow-2xl relative animate-popup my-auto ${cardBg}`}>
            <button onClick={() => setShowNotif(false)} className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 bg-black/10 dark:bg-white/10 rounded-full font-bold hover:rotate-90 transition-transform flex items-center justify-center">✕</button>
            <h2 className="text-lg sm:text-2xl font-black mb-5 sm:mb-6 flex items-center gap-2">🔔 Notificări G+</h2>
            <div className="space-y-3 sm:space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {notifications.length === 0 && <p className="opacity-50 text-xs sm:text-sm italic text-center py-10">Nicio notificare momentan.</p>}
              {notifications.map(n => (
                  <div key={n.id} className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border flex justify-between items-start gap-3 sm:gap-4 transition-colors hover:border-red-500/30 ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                    <div className="min-w-0">
                        <p className="font-black text-xs sm:text-sm mb-1 leading-snug truncate">{n.title}</p>
                        <p className="text-[10px] sm:text-xs opacity-80 leading-relaxed break-words">{n.message}</p>
                        <p className="text-[8px] sm:text-[9px] mt-2 font-mono opacity-40">{timeAgo(n.sentAt)}</p>
                    </div>
                    <button onClick={() => handleDeleteNotif(n.id)} className="text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white p-1.5 sm:p-2 rounded-lg transition-colors text-xs shrink-0" title="Șterge">✕</button>
                  </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONTACT ADMIN */}
      {showContactAdmin && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <div className={`w-full max-w-lg p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[2.5rem] border shadow-2xl relative animate-popup my-auto ${cardBg}`}>
              <button onClick={() => setShowContactAdmin(false)} className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 bg-black/10 dark:bg-white/10 rounded-full font-bold hover:rotate-90 transition-transform flex items-center justify-center">✕</button>
              <h2 className="text-lg sm:text-2xl font-black mb-6 sm:mb-8 text-blue-500 pr-8">📧 Contact Administrator</h2>
              <div className="space-y-4">
                  <div>
                      <label className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-50 mb-2 block">Motivul Mesajului</label>
                      <select value={contactReason} onChange={e=>setContactReason(e.target.value)} className={`w-full p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm font-bold outline-none border focus:border-blue-500 transition-colors cursor-pointer ${darkMode ? 'bg-black/50 border-white/10' : 'bg-slate-100 border-slate-300'}`}>
                          <option value="Schimbare Clasă" className="text-black bg-white">Schimbare Clasă</option>
                          <option value="Raportare Bug/Eroare" className="text-black bg-white">Raportare Bug / Eroare</option>
                          <option value="Feedback Platformă" className="text-black bg-white">Feedback Platformă</option>
                          <option value="Altele" className="text-black bg-white">Altele</option>
                      </select>
                  </div>
                  <div>
                      <label className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-50 mb-2 block">Mesajul tău</label>
                      <textarea value={contactMessage} onChange={e=>setContactMessage(e.target.value)} placeholder="Descrie problema ta în detaliu..." className={`w-full p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm outline-none border h-28 sm:h-32 resize-none focus:border-blue-500 transition-colors ${darkMode ? 'bg-black/50 border-white/10' : 'bg-slate-100 border-slate-300'}`}></textarea>
                  </div>
                  <button onClick={submitContactAdmin} className="w-full py-3.5 sm:py-4 bg-blue-600 text-white rounded-xl font-black text-sm sm:text-base hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20">Trimite Mesajul</button>
              </div>
            </div>
          </div>
      )}
    </div>
  );
}