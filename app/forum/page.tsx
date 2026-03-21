"use client";
import { useEffect, useState, useRef } from "react";
import { auth, db, storage } from "../lib/firebase"; 
import { sendPasswordResetEmail, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, collection, arrayUnion, arrayRemove, orderBy, onSnapshot, addDoc, query, deleteDoc, getDocs } from "firebase/firestore";
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
  
  const [newPostText, setNewPostText] = useState("");
  const [newPostImage, setNewPostImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [replyTexts, setReplyTexts] = useState<{[key: string]: string}>({});
  
  const [darkMode, setDarkMode] = useState(true);
  const [hoveredUser, setHoveredUser] = useState<any>(null);
  const [adminUserModal, setAdminUserModal] = useState<any>(null);
  const [adminUserHistory, setAdminUserHistory] = useState<any[]>([]);
  const [adminUserForumPosts, setAdminUserForumPosts] = useState<any[]>([]);

  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("ghiba_theme") === "light") setDarkMode(false);
    const unsubscribeAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/");
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) setUser({ id: u.uid, ...snap.data() });
    });

    const unsubPosts = onSnapshot(query(collection(db, "forum_posts"), orderBy("createdAt", "desc")), (s) => setForumPosts(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubUsers = onSnapshot(collection(db, "users"), (s) => setUsersDb(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubCal = onSnapshot(collection(db, "calendar_events"), (s) => setCalendarEvents(s.docs.map(d => ({id: d.id, ...d.data()}))));

    return () => { unsubscribeAuth(); unsubPosts(); unsubUsers(); unsubCal(); };
  }, [router]);

  const handleImageChange = (e: any) => {
      if (e.target.files[0]) setNewPostImage(e.target.files[0]);
  };

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
          text: safeText,
          imageUrl,
          authorId: user.id,
          authorName: user.name,
          authorRole: user.role,
          createdAt: new Date().toISOString(),
          likes: [],
          replies: []
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

  // FUNCȚII ADMIN
  const openAdminUserModal = async (userId: string) => {
      if(user.role !== 'admin') return;
      const targetUser = usersDb.find(u => u.id === userId);
      if(!targetUser) return;
      
      // Istoric Evenimente
      const history: any[] = [];
      calendarEvents.forEach(ev => {
          if (ev.attendees?.some((a:any) => a.id === targetUser.id)) history.push({ title: ev.title, date: ev.date });
          ev.teams?.forEach((t:any) => { if (t.leaderId === targetUser.id || t.members?.some((m:any) => m.id === targetUser.id)) history.push({ title: ev.title, date: ev.date }); });
      });

      // Postari Forum
      const userPosts = forumPosts.filter(p => p.authorId === targetUser.id);

      setAdminUserHistory(history);
      setAdminUserForumPosts(userPosts);
      setAdminUserModal(targetUser);
  };

  const handleResetPassword = async () => {
      if(!confirm(`Trimite link de resetare parolă pe ${adminUserModal.email}?`)) return;
      await sendPasswordResetEmail(auth, adminUserModal.email);
      alert("Email-ul de resetare a fost trimis!");
  };

  const handleDeleteUser = async () => {
      if(!confirm("⚠️ EȘTI ABSOLUT SIGUR?\nAcest lucru va șterge profilul elevului din baza de date și îl va deconecta permanent.")) return;
      await deleteDoc(doc(db, "users", adminUserModal.id));
      alert("Utilizatorul a fost eliminat din platformă!");
      setAdminUserModal(null);
  };

  if (!user) return null;
  const bgMain = darkMode ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-800";
  const cardBg = darkMode ? "bg-slate-900/60 border-white/10 shadow-lg" : "bg-white border-slate-200/60 shadow-xl";
  const inputBg = darkMode ? "bg-black/50 border-white/10 text-white focus:bg-black/70" : "bg-slate-100 border-slate-300 text-slate-900 focus:bg-white";

  return (
    <div className={`min-h-screen relative transition-colors duration-500 ${bgMain}`}>
      <nav className={`fixed top-0 w-full z-40 px-4 py-3 sm:py-4 backdrop-blur-2xl border-b flex justify-between items-center transition-all ${darkMode ? 'bg-slate-950/80 border-white/10' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-6xl mx-auto w-full flex justify-between items-center gap-2">
            <h1 onClick={()=>router.push('/dashboard')} className="text-xl sm:text-2xl font-black shrink-0 cursor-pointer">Ghiba<span className="text-blue-500">+ Forum</span></h1>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm transition-all ${darkMode ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-300'}`}>
                <button onClick={() => { setDarkMode(!darkMode); localStorage.setItem("ghiba_theme", !darkMode ? "dark" : "light"); }} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10">{darkMode ? '☀️' : '🌙'}</button>
                <button onClick={()=>router.push('/dashboard')} className="text-xs font-bold px-3 py-1.5 bg-blue-500 text-white rounded-full">Înapoi</button>
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

          <div className={`p-6 sm:p-8 rounded-[2.5rem] border backdrop-blur-xl mb-6 ${cardBg}`}>
              <h2 className="text-xl font-black mb-4">Postează o întrebare sau un mesaj</h2>
              <textarea placeholder="Scrie ceva (fără înjurături!)..." value={newPostText} onChange={e=>setNewPostText(e.target.value)} className={`w-full p-4 rounded-2xl outline-none border h-24 resize-none mb-4 ${inputBg}`} />
              
              <div className="flex justify-between items-center">
                  {(user.role === 'admin' || user.role === 'profesor') ? (
                      <label className="text-xs font-bold text-blue-500 bg-blue-500/10 px-4 py-2 rounded-xl cursor-pointer hover:bg-blue-500 hover:text-white transition">
                          📸 Încarcă Poză (PC)
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                      </label>
                  ) : <div></div>}
                  
                  <button onClick={handleCreatePost} disabled={isUploading} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black shadow-lg shadow-blue-500/30 hover:bg-blue-500 disabled:opacity-50 transition-all">{isUploading ? 'Se încarcă...' : 'Trimite'}</button>
              </div>
              {newPostImage && <p className="text-xs mt-2 text-green-500">Poză atașată: {newPostImage.name}</p>}
          </div>

          <div className="space-y-6">
              {forumPosts.map(post => {
                  const authorInfo = usersDb.find(u => u.id === post.authorId) || { class: 'Necunoscut', role: 'user' };
                  const userPostsCount = forumPosts.filter(p => p.authorId === post.authorId).length;

                  return (
                  <div key={post.id} className={`rounded-[2rem] border backdrop-blur-xl p-6 sm:p-8 ${cardBg}`}>
                      <div className="flex justify-between items-start mb-4 border-b border-black/10 dark:border-white/10 pb-4 relative group">
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center font-black">{post.authorName?.charAt(0)}</div>
                              <div 
                                className={`relative cursor-pointer ${user.role === 'admin' ? 'hover:text-blue-500' : ''}`}
                                onMouseEnter={() => setHoveredUser(post.authorId)}
                                onMouseLeave={() => setHoveredUser(null)}
                                onClick={() => openAdminUserModal(post.authorId)}
                              >
                                  <p className="font-black text-sm">{post.authorName} {post.authorRole === 'admin' && <span className="text-red-500 text-[10px] ml-1">Admin</span>}</p>
                                  <p className="text-[10px] opacity-50 font-mono">{authorInfo.class} • {new Date(post.createdAt).toLocaleString('ro-RO')}</p>
                                  
                                  {/* INFO HOVER */}
                                  {hoveredUser === post.authorId && (
                                      <div className={`absolute top-full left-0 mt-2 p-3 rounded-xl border shadow-xl z-20 w-48 text-xs ${darkMode ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'}`}>
                                          <p className="font-bold text-blue-500 mb-1">{post.authorName}</p>
                                          <p>Clasa: <span className="font-mono opacity-80">{authorInfo.class}</span></p>
                                          <p>Postări pe forum: <span className="font-mono text-green-500">{userPostsCount}</span></p>
                                          {user.role === 'admin' && <p className="text-[10px] text-red-500 mt-2 font-bold animate-pulse">Click pt. Administrare</p>}
                                      </div>
                                  )}
                              </div>
                          </div>
                          {(user.role === 'admin' || user.id === post.authorId) && (
                              <button onClick={() => deletePost(post.id)} className="text-red-500 text-xs font-bold bg-red-500/10 px-3 py-1.5 rounded-lg hover:bg-red-500 hover:text-white transition">Șterge</button>
                          )}
                      </div>

                      <p className="text-sm leading-relaxed mb-4 whitespace-pre-wrap">{post.text}</p>
                      {post.imageUrl && <img src={post.imageUrl} alt="Forum" className="max-h-80 rounded-xl mb-4" />}

                      <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 space-y-3">
                          {post.replies?.map((reply:any) => (
                              <div key={reply.id} className={`p-3 rounded-xl flex justify-between items-start ${darkMode ? 'bg-black/30' : 'bg-slate-50'}`}>
                                  <div>
                                      <span className="text-[10px] font-black text-blue-500 mr-2">{reply.authorName}</span>
                                      <span className="text-xs opacity-90">{reply.text}</span>
                                  </div>
                                  {(user.role === 'admin' || user.id === reply.authorId) && (
                                      <button onClick={() => deleteReply(post.id, reply)} className="text-[10px] text-red-500 ml-2">✕</button>
                                  )}
                              </div>
                          ))}
                          <div className="flex gap-2 mt-3">
                              <input placeholder="Răspunde..." value={replyTexts[post.id] || ""} onChange={e=>setReplyTexts({...replyTexts, [post.id]: e.target.value})} className={`flex-1 p-2.5 rounded-xl text-xs outline-none border ${inputBg}`} />
                              <button onClick={() => handleReply(post.id)} className="bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-600 transition">Trimite</button>
                          </div>
                      </div>
                  </div>
              )})}
          </div>
        </div>

        <div className={`p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] lg:sticky lg:top-28 border backdrop-blur-xl h-fit ${cardBg}`}>
            <h3 className="font-black text-lg mb-5">📅 Calendar Evenimente</h3>
            <div className="space-y-3">
                {calendarEvents.slice(0, 5).map(ev => (
                    <div key={ev.id} className={`p-3 rounded-xl border ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="font-bold text-xs">{ev.title}</div>
                        <div className="text-[9px] opacity-60 mt-1">{new Date(ev.date).toLocaleDateString('ro-RO')}</div>
                    </div>
                ))}
            </div>
        </div>
      </main>

      {/* MODAL ADMINISTRARE UTILIZATOR */}
      {adminUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className={`w-full max-w-2xl p-8 rounded-[2.5rem] border shadow-2xl relative ${cardBg}`}>
              <button onClick={() => setAdminUserModal(null)} className="absolute top-6 right-6 w-10 h-10 bg-black/10 dark:bg-white/10 rounded-full font-bold">✕</button>
              
              <div className="flex items-center gap-4 mb-6 border-b border-black/10 dark:border-white/10 pb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center font-black text-2xl">{adminUserModal.name?.charAt(0)}</div>
                  <div>
                      <h2 className="text-2xl font-black text-red-500">{adminUserModal.name}</h2>
                      <p className="text-xs font-mono opacity-80 mt-1">ID: {adminUserModal.id}</p>
                      <div className="flex gap-4 mt-2 text-xs font-bold">
                          <span>📧 {adminUserModal.email}</span>
                          <span>📱 {adminUserModal.phone || 'Lipsă'}</span>
                          <span>🏫 {adminUserModal.class}</span>
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                      <h3 className="font-black text-sm mb-3">💬 Postări Forum ({adminUserForumPosts.length})</h3>
                      <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                          {adminUserForumPosts.map(p => (
                              <div key={p.id} className="text-xs p-2 bg-white/5 rounded-lg opacity-80 line-clamp-2">{p.text}</div>
                          ))}
                      </div>
                  </div>
                  <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                      <h3 className="font-black text-sm mb-3">🎟️ Istoric Participări ({adminUserHistory.length})</h3>
                      <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                          {adminUserHistory.map((h, i) => (
                              <div key={i} className="text-xs p-2 bg-white/5 rounded-lg opacity-80">{h.title} <br/><span className="text-[9px] opacity-50">{new Date(h.date).toLocaleDateString('ro-RO')}</span></div>
                          ))}
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-black/10 dark:border-white/10">
                  <button onClick={handleResetPassword} className="py-3 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-xl font-black text-sm hover:bg-orange-500 hover:text-white transition">🔑 Trimite Resetare Parolă</button>
                  <button onClick={handleDeleteUser} className="py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-black text-sm hover:bg-red-500 hover:text-white transition">🗑️ Șterge Contul</button>
              </div>
              <p className="text-[9px] opacity-50 text-center mt-3">*Ștergerea contului va elimina documentul elevului din baza de date, blocându-i instantaneu accesul la platformă.</p>
            </div>
          </div>
      )}
    </div>
  );
}