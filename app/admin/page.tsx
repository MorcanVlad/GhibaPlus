"use client";
import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { useRouter } from "next/navigation";
import { doc, getDoc, collection, addDoc, setDoc, getDocs, deleteDoc, updateDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { SCHOOL_CLASSES } from "../lib/constants";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("gestiune");
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [whitelistDb, setWhitelistDb] = useState<any[]>([]);
  
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  
  const [currentUserRole, setCurrentUserRole] = useState<string>("user");
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  
  const [linkedPostId, setLinkedPostId] = useState("");
  const [regDeadline, setRegDeadline] = useState("");

  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [selectedClassNotif, setSelectedClassNotif] = useState("Toată Școala");

  const [eventType, setEventType] = useState("activity"); 
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hasTime, setHasTime] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [evLoc, setEvLoc] = useState("");
  const [spots, setSpots] = useState(0); 
  
  const [organizerPhone, setOrganizerPhone] = useState("");
  
  const [isTeamEvent, setIsTeamEvent] = useState(false);
  const [teamSize, setTeamSize] = useState(2);
  const [teamRule, setTeamRule] = useState("any");

  const [emailList, setEmailList] = useState("");
  const [whitelistSearch, setWhitelistSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  
  const [viewAttendeesModal, setViewAttendeesModal] = useState<any>(null);
  const [viewUserHistory, setViewUserHistory] = useState<any>(null);
  const [editingPost, setEditingPost] = useState<any>(null);

  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("ghiba_theme") === "light") setDarkMode(false);
    auth.onAuthStateChanged(async (u) => {
      if (!u) return router.push("/");
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists() && (snap.data().role === 'admin' || snap.data().role === 'profesor')) {
          setCurrentUserRole(snap.data().role);
          setCurrentUserId(u.uid);
          fetchData();
          if(snap.data().role === 'admin') {
              onSnapshot(query(collection(db, "admin_messages"), orderBy("createdAt", "desc")), (s) => {
                  setAdminMessages(s.docs.map(d => ({id: d.id, ...d.data()})));
              });
          }
      }
      else router.push("/dashboard");
    });
  }, []);

  const fetchData = async () => {
    const uSnap = await getDocs(collection(db, "users"));
    setUsers(uSnap.docs.map(d => ({id:d.id, ...d.data()})));
    
    const wSnap = await getDocs(collection(db, "whitelist"));
    setWhitelistDb(wSnap.docs.map(d => ({id:d.id, ...d.data()})));

    const nSnap = await getDocs(collection(db, "news"));
    const aSnap = await getDocs(collection(db, "calendar_events"));
    
    const allItems = [...nSnap.docs.map(d=>({id:d.id, col:'news', ...d.data()})), ...aSnap.docs.map(d=>({id:d.id, col:'calendar_events', ...d.data()}))];
    allItems.sort((a:any, b:any) => new Date(b.postedAt || b.date || 0).getTime() - new Date(a.postedAt || a.date || 0).getTime());
    setPosts(allItems);
  };

  const handleDelete = async (id: string, col: string) => {
    if(!confirm("Ești sigur că vrei să ștergi definitiv?")) return;
    await deleteDoc(doc(db, col, id));
    fetchData();
  };

  const resetForm = () => {
      setTitle(""); setContent(""); setImageUrl(""); setAuthorName(""); setOrganizerPhone("");
      setSelectedClasses([]); setStartDate(""); setEndDate(""); setStartTime("");
      setEndTime(""); setHasTime(false); setEvLoc(""); setSpots(0);
      setIsTeamEvent(false); setTeamSize(2); setTeamRule("any");
      setEditingPost(null); setLinkedPostId(""); setRegDeadline("");
  };

  const handleTabSwitch = (tabId: string) => {
      setActiveTab(tabId);
      resetForm();
  };

  // --- FUNCȚIILE CARE LIPSEAU AU FOST ADAUGATE AICI ---

  const toggleClass = (c: string) => {
      setSelectedClasses(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const handlePromoteAll = async () => {
      if(!confirm("Ești sigur? Această acțiune va muta toți elevii în anul următor (ex: a 9-a devine a 10-a, a 12-a devine Absolvent).")) return;
      
      let count = 0;
      for (const u of users) {
          if(u.role === 'profesor' || u.class === 'Absolvent' || !u.class) continue;
          let match = u.class.match(/(\d+)(.*)/);
          if(match) {
              let grade = parseInt(match[1]);
              let letter = match[2];
              let newClass = grade >= 12 ? "Absolvent" : `${grade + 1}${letter}`;
              await updateDoc(doc(db, "users", u.id), { class: newClass });
              count++;
          }
      }
      alert(`✅ Au fost promovați cu succes ${count} elevi!`);
      fetchData();
  };

  const handleUserClassChange = async (userId: string, newClass: string) => {
      await updateDoc(doc(db, "users", userId), { class: newClass });
      setUsers(users.map(u => u.id === userId ? { ...u, class: newClass } : u));
  };

  const handleUserRoleChange = async (userId: string, newRole: string) => {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const showUserHistory = async (user: any) => {
      const history: any[] = [];
      const evSnap = await getDocs(collection(db, "calendar_events"));
      evSnap.forEach(d => {
          const ev = d.data();
          if (ev.attendees?.some((a:any) => a.id === user.id)) {
              history.push({ eventTitle: ev.title, role: 'Participant', date: new Date(ev.date).toLocaleDateString('ro-RO') });
          }
          ev.teams?.forEach((t:any) => {
              if (t.leaderId === user.id) history.push({ eventTitle: ev.title, role: 'Lider Echipă', date: new Date(ev.date).toLocaleDateString('ro-RO') });
              else if (t.members?.some((m:any) => m.id === user.id)) history.push({ eventTitle: ev.title, role: 'Membru Echipă', date: new Date(ev.date).toLocaleDateString('ro-RO') });
          });
      });
      setViewUserHistory({ ...user, history });
  };

  const handleSendNotif = async () => {
      if (!notifTitle || !notifBody) return alert("Completează ambele câmpuri!");
      const targets = selectedClassNotif === "Toată Școala" ? users : users.filter(u => u.class === selectedClassNotif);
      
      let count = 0;
      for (const u of targets) {
          await addDoc(collection(db, "users", u.id, "notifications"), {
              title: notifTitle, message: notifBody, sentAt: new Date().toISOString(), read: false
          });
          count++;
      }
      alert(`✅ Notificare trimisă cu succes către ${count} utilizatori!`);
      setNotifTitle(""); setNotifBody("");
  };

  const handleDeleteMessage = async (msgId: string) => {
      await deleteDoc(doc(db, "admin_messages", msgId));
  };

  const handleFileUpload = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          if (evt.target?.result) setEmailList(prev => prev + (prev ? "\n" : "") + evt.target.result);
      };
      reader.readAsText(file);
  };

  const handleAddWhitelist = async () => {
      const emails = emailList.split(/[\n,]+/).map(e => e.trim().toLowerCase()).filter(e => e.includes("@"));
      let added = 0;
      for (const e of emails) {
          if (!whitelistDb.find(w => w.id === e)) {
              await setDoc(doc(db, "whitelist", e), { addedAt: new Date().toISOString() });
              added++;
          }
      }
      alert(`✅ S-au adăugat ${added} adrese de email noi in Whitelist.`);
      setEmailList(""); fetchData();
  };

  // --------------------------------------------------------

  const handleEditClick = (post: any) => {
      setEditingPost(post);
      setTitle(post.title || ""); setContent(post.content || ""); setImageUrl(post.imageUrl || "");
      setAuthorName(post.authorName || post.organizers || ""); setSelectedClasses(post.targetClasses || ["Toată Școala"]);
      setLinkedPostId(post.linkedPostId || "");
      
      if(post.col === 'calendar_events') {
          setEventType(post.type); setStartDate(post.date?.split('T')[0] || ""); setEndDate(post.endDate?.split('T')[0] || "");
          setHasTime(post.hasTime || false); setStartTime(post.startTime || ""); setEndTime(post.endTime || "");
          setEvLoc(post.location || ""); setSpots(post.maxSpots || 0); setOrganizerPhone(post.organizerPhone || "");
          setIsTeamEvent(post.isTeamEvent || false); setTeamSize(post.teamSize || 2); setTeamRule(post.teamRule || "any");
          setRegDeadline(post.registrationDeadline || "");
      }
  };

  const handleUpdatePost = async (e: React.FormEvent) => {
      e.preventDefault();
      const updatedData: any = { title, content, imageUrl, targetClasses: selectedClasses.length === 0 ? ["Toată Școala"] : selectedClasses };
      
      if (editingPost.col === 'news') {
          updatedData.authorName = authorName;
          updatedData.linkedPostId = linkedPostId;
      } else {
          const finalDateISO = startDate ? (hasTime && startTime ? `${startDate}T${startTime}` : `${startDate}T00:00:00`) : new Date().toISOString();
          const finalEndDateISO = endDate ? (hasTime && endTime ? `${endDate}T${endTime}` : `${endDate}T00:00:00`) : finalDateISO;
          
          updatedData.type = eventType; updatedData.date = finalDateISO; updatedData.endDate = finalEndDateISO;
          updatedData.hasTime = hasTime; updatedData.startTime = startTime; updatedData.endTime = endTime;
          
          if(eventType === 'activity') {
              updatedData.location = evLoc; updatedData.organizers = authorName; updatedData.maxSpots = spots;
              updatedData.organizerPhone = organizerPhone;
              updatedData.isTeamEvent = isTeamEvent;
              updatedData.registrationDeadline = regDeadline;
              if(isTeamEvent) { updatedData.teamSize = teamSize; updatedData.teamRule = teamRule; }
          }
      }

      await updateDoc(doc(db, editingPost.col, editingPost.id), updatedData);
      alert("✅ Modificările au fost salvate!");
      resetForm(); fetchData();
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, "news"), { 
        type: "official_news", title, content, imageUrl, 
        authorName: authorName || (currentUserRole === 'profesor' ? "Profesor" : "Consiliul Elevilor"), 
        authorId: currentUserId, linkedPostId,
        targetClasses: selectedClasses.length === 0 ? ["Toată Școala"] : selectedClasses, postedAt: new Date().toISOString(), likes: []
    });
    alert("✅ Știre Publicată!"); resetForm(); fetchData();
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalDateISO = startDate ? (hasTime && startTime ? `${startDate}T${startTime}` : `${startDate}T00:00:00`) : new Date().toISOString();
    const finalEndDateISO = endDate ? (hasTime && endTime ? `${endDate}T${endTime}` : `${endDate}T00:00:00`) : finalDateISO;

    const eventData: any = { 
        type: eventType, title, content, imageUrl, date: finalDateISO, endDate: finalEndDateISO, hasTime, startTime, endTime,
        authorId: currentUserId, 
        targetClasses: selectedClasses.length === 0 ? ["Toată Școala"] : selectedClasses, postedAt: new Date().toISOString(), likes: []
    };

    if (eventType === 'activity') {
        eventData.location = evLoc; eventData.organizers = authorName || (currentUserRole === 'profesor' ? "Profesor" : "Consiliul Elevilor"); eventData.maxSpots = spots;
        eventData.organizerPhone = organizerPhone; eventData.registrationDeadline = regDeadline;
        if(isTeamEvent) { eventData.isTeamEvent = true; eventData.teamSize = teamSize; eventData.teamRule = teamRule; eventData.teams = []; } 
        else { eventData.attendees = []; }
    }
    await addDoc(collection(db, "calendar_events"), eventData);
    alert("✅ Salvat cu succes în Calendar!"); resetForm(); fetchData();
  };

  const removeAttendeeAdmin = async (event: any, attendeeId: string) => {
      if(!confirm("Ești sigur că vrei să elimini acest participant?")) return;
      const newAttendees = event.attendees.filter((a:any) => a.id !== attendeeId);
      await updateDoc(doc(db, "calendar_events", event.id), { attendees: newAttendees });
      setViewAttendeesModal({...event, attendees: newAttendees});
      fetchData();
  };

  const removeTeamAdmin = async (event: any, teamLeaderId: string) => {
      if(!confirm("Dizolvi complet această echipă?")) return;
      const newTeams = event.teams.filter((t:any) => t.leaderId !== teamLeaderId);
      await updateDoc(doc(db, "calendar_events", event.id), { teams: newTeams });
      setViewAttendeesModal({...event, teams: newTeams});
      fetchData();
  };

  const removeTeamMemberAdmin = async (event: any, teamLeaderId: string, memberId: string) => {
      if(!confirm("Elimini acest membru din echipă?")) return;
      const teamToEdit = event.teams.find((t:any) => t.leaderId === teamLeaderId);
      const updatedMembers = teamToEdit.members.filter((m:any) => m.id !== memberId);
      const updatedTeam = { ...teamToEdit, members: updatedMembers };
      const newTeams = event.teams.map((t:any) => t.leaderId === teamLeaderId ? updatedTeam : t);
      await updateDoc(doc(db, "calendar_events", event.id), { teams: newTeams });
      setViewAttendeesModal({...event, teams: newTeams});
      fetchData();
  };

  const bgMain = darkMode ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-800";
  const cardBg = darkMode ? "bg-slate-900/80 border-white/10 shadow-2xl" : "bg-white border-slate-200 shadow-xl";
  const inputBg = darkMode ? "bg-black/50 border-white/10 text-white placeholder-gray-500" : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-500";

  const allowedTabs = [
      {id:'gestiune', icon:'🗑️', lbl:'Gestiune'},
      ...(currentUserRole === 'admin' ? [{id:'users', icon:'👥', lbl:'Elevi'}] : []),
      {id:'news', icon:'📢', lbl:'Știri'},
      {id:'events', icon:'📅', lbl:'Evenimente'},
      ...(currentUserRole === 'admin' ? [{id:'notif', icon:'🔔', lbl:'Notificări / Inbox'}, {id:'whitelist', icon:'📧', lbl:'Aprobă'}] : [])
  ];

  return (
    <div className={`min-h-screen relative font-sans transition-colors duration-500 p-4 sm:p-8 ${bgMain}`}>
      <style dangerouslySetInnerHTML={{__html: ` @keyframes popupEnter { 0% { transform: scale(0.95) translateY(15px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } } .animate-popup { animation: popupEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; } `}} />
      <div className="max-w-6xl mx-auto relative z-10">
        
        <div className={`flex justify-between items-center mb-6 sm:mb-10 p-4 sm:p-6 rounded-[2rem] border backdrop-blur-xl ${cardBg}`}>
          <h1 className="text-xl sm:text-3xl font-black">Admin <span className={currentUserRole === 'profesor' ? 'text-blue-500' : 'text-red-500'}>Ghiba+ {currentUserRole === 'profesor' ? '(Profesor)' : ''}</span></h1>
          <button onClick={() => router.push('/dashboard')} className={`px-4 py-2.5 rounded-xl font-bold transition shadow-md text-xs sm:text-base ${darkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>Înapoi pe Site</button>
        </div>

        <div className={`flex gap-2 sm:gap-4 mb-10 p-2 sm:p-3 rounded-3xl border backdrop-blur-md overflow-x-auto custom-scrollbar ${cardBg}`}>
          {allowedTabs.map(t => (
            <button key={t.id} onClick={()=>handleTabSwitch(t.id)} className={`flex-shrink-0 px-4 sm:flex-1 py-3 sm:py-4 rounded-2xl font-black text-xs sm:text-sm transition-all ${activeTab === t.id ? (currentUserRole === 'profesor' ? 'bg-blue-600' : 'bg-red-600') + ' text-white shadow-lg' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-60'}`}>
              {t.icon} <span className="hidden sm:inline">{t.lbl}</span>
            </button>
          ))}
        </div>

        {activeTab === "gestiune" && (
            <div className={`p-6 sm:p-8 rounded-[2.5rem] border backdrop-blur-xl ${cardBg}`}>
                <h2 className="text-2xl font-black mb-6">⚙️ Moderează Postările</h2>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {posts.map(p => {
                        const canModify = currentUserRole === 'admin' || (currentUserRole === 'profesor' && p.authorId === currentUserId);

                        return (
                        <div key={p.id} className={`flex justify-between items-center p-5 rounded-2xl border transition-colors ${darkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                            <div>
                                <div className="font-bold mb-1 flex items-center gap-2">
                                    <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded ${p.type === 'holiday' ? 'bg-yellow-500/20 text-yellow-600' : p.type === 'exam' ? 'bg-purple-500/20 text-purple-500' : (p.type === 'activity' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500')}`}> 
                                        {p.type === 'holiday' ? 'Vacanță' : p.type === 'exam' ? 'Examen' : (p.type === 'activity' ? 'Eveniment' : 'Știre')} 
                                    </span>
                                    <span className="line-clamp-1">{p.title}</span>
                                </div>
                                <div className="text-[10px] opacity-50 font-mono">Autor: {p.authorName || p.organizers || "Necunoscut"}</div>
                            </div>
                            <div className="flex gap-2 flex-wrap justify-end">
                                {p.type === 'activity' && (
                                    <button onClick={() => setViewAttendeesModal(p)} className="bg-blue-500/10 text-blue-500 px-4 py-2.5 rounded-xl font-bold hover:bg-blue-600 hover:text-white transition">
                                        👥 ({p.isTeamEvent ? p.teams?.length || 0 : p.attendees?.length || 0})
                                    </button>
                                )}
                                
                                {canModify && (
                                    <>
                                        <button onClick={() => handleEditClick(p)} className="bg-orange-500/10 text-orange-500 px-4 py-2.5 rounded-xl font-bold hover:bg-orange-600 hover:text-white transition">Editează</button>
                                        <button onClick={() => handleDelete(p.id, p.col)} className="bg-red-500/10 text-red-500 px-4 py-2.5 rounded-xl font-bold hover:bg-red-600 hover:text-white transition">Șterge</button>
                                    </>
                                )}
                            </div>
                        </div>
                    )})}
                </div>
            </div>
        )}

        {editingPost && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto custom-scrollbar animate-popup">
                <form onSubmit={handleUpdatePost} className={`border p-8 rounded-[2.5rem] w-full max-w-3xl shadow-2xl relative my-auto ${cardBg}`}>
                    <button type="button" onClick={() => setEditingPost(null)} className="absolute top-6 right-6 w-8 h-8 bg-black/10 dark:bg-white/10 rounded-full font-bold">✕</button>
                    <h2 className="text-2xl font-black mb-6 text-orange-500">✏️ Editează Postarea</h2>
                    
                    <div className="grid sm:grid-cols-2 gap-4 mb-4">
                        <input placeholder="Titlu Postare" className={`w-full p-4 rounded-2xl outline-none border ${inputBg}`} value={title} onChange={e=>setTitle(e.target.value)} required />
                        <input placeholder="Autor / Organizator" className={`w-full p-4 rounded-2xl outline-none border ${inputBg}`} value={authorName} onChange={e=>setAuthorName(e.target.value)} />
                    </div>

                    {editingPost.col === 'calendar_events' && editingPost.type === 'activity' && (
                        <div className="grid sm:grid-cols-2 gap-4 mb-4">
                             <input placeholder="Telefon Organizator (Obligatoriu)" type="tel" className={`w-full p-4 rounded-2xl outline-none border ${inputBg}`} value={organizerPhone} onChange={e=>setOrganizerPhone(e.target.value.replace(/\D/g,'').slice(0,10))} required />
                             <div>
                                 <label className="text-[10px] font-black uppercase opacity-50 block mb-1">Dată Limită Înscriere (Opțional)</label>
                                 <input type="datetime-local" className={`w-full p-3 rounded-xl border ${inputBg}`} value={regDeadline} onChange={e=>setRegDeadline(e.target.value)} />
                             </div>
                        </div>
                    )}

                    {editingPost.col === 'news' && (
                        <div className="mb-4">
                            <label className="text-[10px] font-black uppercase text-blue-500 block mb-1">🔗 Etichetează o altă postare (Opțional)</label>
                            <select value={linkedPostId} onChange={e=>setLinkedPostId(e.target.value)} className={`w-full p-4 rounded-2xl border outline-none ${inputBg}`}>
                                <option value="">Fără etichetare</option>
                                {posts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                        </div>
                    )}

                    <textarea placeholder="Conținutul..." className={`w-full p-4 rounded-2xl outline-none border h-32 resize-none mb-4 ${inputBg}`} value={content} onChange={e=>setContent(e.target.value)} required />
                    
                    <div className="mb-6">
                        <label className="text-[10px] font-black uppercase opacity-50 block mb-2">Imagine Copertă (URL Extern)</label>
                        <input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} className={`w-full p-4 rounded-xl border ${inputBg}`} />
                    </div>

                    {editingPost.col === 'calendar_events' && (
                        <div className="animate-fade-in border-t border-white/10 pt-6 mt-6">
                            <div className="grid sm:grid-cols-2 gap-4 mb-4">
                                <div><label className="text-[10px] font-black uppercase opacity-50 block mb-2">Din data</label><input type="date" className={`w-full p-4 rounded-2xl outline-none border ${inputBg}`} value={startDate} onChange={e=>setStartDate(e.target.value)} required /></div>
                                <div><label className="text-[10px] font-black uppercase opacity-50 block mb-2">Până în data</label><input type="date" className={`w-full p-4 rounded-2xl outline-none border ${inputBg}`} value={endDate} onChange={e=>setEndDate(e.target.value)} /></div>
                            </div>
                            
                            <label className="flex items-center gap-3 cursor-pointer mb-4">
                                <input type="checkbox" checked={hasTime} onChange={e=>setHasTime(e.target.checked)} className="w-5 h-5 accent-orange-500 cursor-pointer rounded" />
                                <span className="font-bold text-sm">⏰ Are oră specifică</span>
                            </label>
                            {hasTime && (
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <input type="time" className={`w-full p-3 rounded-xl border ${inputBg}`} value={startTime} onChange={e=>setStartTime(e.target.value)} required />
                                    <input type="time" className={`w-full p-3 rounded-xl border ${inputBg}`} value={endTime} onChange={e=>setEndTime(e.target.value)} />
                                </div>
                            )}

                            {eventType === 'activity' && (
                                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                                    <div><label className="text-[10px] font-black uppercase opacity-50 block mb-2">LOCAȚIE</label><input className={`w-full p-4 rounded-2xl border ${inputBg}`} value={evLoc} onChange={e=>setEvLoc(e.target.value)} required /></div>
                                    <div><label className="text-[10px] font-black uppercase opacity-50 block mb-2">LOCURI (0 = Nelimitat)</label><input type="number" min="0" className={`w-full p-4 rounded-2xl border ${inputBg}`} value={spots} onChange={e=>setSpots(Number(e.target.value))} required /></div>
                                </div>
                            )}
                        </div>
                    )}

                    <p className="text-[10px] font-black tracking-widest text-orange-500 uppercase mb-3 mt-4">Afișează Doar Pentru</p>
                    <div className="flex flex-wrap gap-2 mb-6">{SCHOOL_CLASSES.map(c => <button key={c} type="button" onClick={() => toggleClass(c)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${selectedClasses.includes(c) ? 'bg-orange-600 border-orange-500 text-white' : `${darkMode?'bg-white/5 border-white/10 text-gray-400':'bg-slate-100 border-slate-200 text-slate-600'}`}`}>{c}</button>)}</div>

                    <button type="submit" className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-lg hover:bg-orange-500 transition shadow-lg">Salvează Modificările</button>
                </form>
            </div>
        )}

        {activeTab === "users" && currentUserRole === 'admin' && (
          <div className={`p-6 sm:p-8 rounded-[2.5rem] border backdrop-blur-xl ${cardBg}`}>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <h2 className="text-2xl font-black">👥 Gestiune & Istoric Elevi</h2>
                <button onClick={handlePromoteAll} className="bg-green-600 hover:bg-green-500 text-white px-5 py-3 rounded-xl font-black text-sm transition shadow-lg shadow-green-500/20 whitespace-nowrap">⬆️ Promovează toți elevii (An Nou)</button>
            </div>
            
            <input placeholder="Caută elev / profesor..." className={`w-full p-4 mb-6 rounded-2xl outline-none border focus:border-red-500 ${inputBg}`} value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            
            <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {users.filter(u => u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase())).map(u => (
                <div key={u.id} className={`p-4 sm:p-6 rounded-2xl border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 ${darkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                  <div>
                      <p className="font-black text-lg mb-1 flex items-center gap-2">
                          {u.name} 
                          {u.role === 'profesor' && <span className="text-[10px] bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded font-bold uppercase">Profesor</span>}
                          {u.role === 'admin' && <span className="text-[10px] bg-red-500/20 text-red-500 px-2 py-0.5 rounded font-bold uppercase">Admin</span>}
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                          <p className="text-xs opacity-50 font-mono">{u.email}</p>
                          
                          <select value={u.class || ""} onChange={(e) => handleUserClassChange(u.id, e.target.value)} className={`text-xs p-1.5 rounded-lg border outline-none font-bold ${darkMode ? 'bg-slate-800 text-white border-white/20' : 'bg-white text-black border-slate-300'}`}>
                              <option value="Profesor">Profesor</option>
                              <option value="Absolvent">Absolvent</option>
                              {SCHOOL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>

                          <select value={u.role || "user"} onChange={(e) => handleUserRoleChange(u.id, e.target.value)} className={`text-xs p-1.5 rounded-lg border outline-none font-bold ${darkMode ? 'bg-slate-800 text-blue-400 border-white/20' : 'bg-white text-blue-600 border-slate-300'}`}>
                              <option value="user">Rol: Elev</option>
                              <option value="profesor">Rol: Profesor</option>
                              <option value="admin">Rol: Admin</option>
                          </select>
                      </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => showUserHistory(u)} className="bg-blue-500/10 text-blue-500 px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-blue-500 hover:text-white transition">Istoric</button>
                    <button onClick={() => handleDelete(u.id, 'users')} className="bg-red-500/10 text-red-500 px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-red-500 hover:text-white transition">Șterge</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "news" && (
            <form onSubmit={handleSavePost} className={`p-6 sm:p-8 rounded-[2.5rem] border backdrop-blur-xl ${cardBg}`}>
                <h2 className="text-2xl font-black mb-6">📢 Postează o Știre / Anunț</h2>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <input placeholder="Titlu Postare" className={`w-full p-4 rounded-2xl outline-none border ${inputBg}`} value={title} onChange={e=>setTitle(e.target.value)} required />
                    <input placeholder="Autor (ex: Director)" className={`w-full p-4 rounded-2xl outline-none border ${inputBg}`} value={authorName} onChange={e=>setAuthorName(e.target.value)} />
                </div>
                <div className="mb-4">
                    <label className="text-[10px] font-black uppercase text-blue-500 block mb-2">🔗 Etichetează o altă postare (Opțional)</label>
                    <select value={linkedPostId} onChange={e=>setLinkedPostId(e.target.value)} className={`w-full p-4 rounded-2xl border outline-none font-bold ${inputBg}`}>
                        <option value="">Fără etichetare</option>
                        {posts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                </div>
                <textarea placeholder="Conținutul anunțului..." className={`w-full p-4 rounded-2xl outline-none border h-32 resize-none mb-4 ${inputBg}`} value={content} onChange={e=>setContent(e.target.value)} required />
                <div className="mb-6"><label className="text-[10px] font-black uppercase opacity-50 block mb-2">Imagine Copertă (URL Extern)</label><input placeholder="Ex: https://imgur.com/poza.jpg" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} className={`w-full p-4 rounded-xl border ${inputBg}`} /></div>
                <p className="text-[10px] font-black tracking-widest text-red-500 uppercase mb-3">Afișează Doar Pentru</p>
                <div className="flex flex-wrap gap-2 mb-6">{SCHOOL_CLASSES.map(c => <button key={c} type="button" onClick={() => toggleClass(c)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${selectedClasses.includes(c) ? 'bg-red-600 border-red-500 text-white' : `${darkMode?'bg-white/5 border-white/10 text-gray-400':'bg-slate-100 border-slate-200 text-slate-600'}`}`}>{c}</button>)}</div>
                <button className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-lg hover:bg-red-500 transition">Publică Anunțul</button>
            </form>
        )}

        {activeTab === "events" && (
            <form onSubmit={handleSaveActivity} className={`p-6 sm:p-8 rounded-[2.5rem] border backdrop-blur-xl ${cardBg}`}>
                <h2 className="text-2xl font-black mb-6 text-green-500">📅 Calendar & Evenimente</h2>
                <div className="mb-6">
                    <label className="text-[10px] font-black tracking-widest uppercase opacity-50 block mb-2">Tip Eveniment</label>
                    <select value={eventType} onChange={e=>setEventType(e.target.value)} className={`w-full p-4 rounded-2xl outline-none font-bold border cursor-pointer ${inputBg}`}>
                        <option value="activity" className="text-black bg-white">🎟️ Eveniment cu Înscriere / Participare</option>
                        <option value="holiday" className="text-black bg-white">🌴 Vacanță / Zi Liberă (Doar informativ)</option>
                        <option value="exam" className="text-black bg-white">📝 Examen / Testare (Doar informativ)</option>
                    </select>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <input placeholder="Titlu Eveniment / Vacanță" className={`w-full p-4 rounded-2xl outline-none border ${inputBg}`} value={title} onChange={e=>setTitle(e.target.value)} required />
                    {eventType === 'activity' && <input placeholder="Organizator" className={`w-full p-4 rounded-2xl outline-none border ${inputBg}`} value={authorName} onChange={e=>setAuthorName(e.target.value)} />}
                </div>

                {eventType === 'activity' && (
                    <div className="grid sm:grid-cols-2 gap-4 mb-4 animate-fade-in">
                        <div>
                            <label className="text-[10px] font-black uppercase opacity-50 block mb-2">Telefon Organizator (Obligatoriu)</label>
                            <input placeholder="Ex: 0712345678" type="tel" className={`w-full p-4 rounded-2xl outline-none border ${inputBg}`} value={organizerPhone} onChange={e=>setOrganizerPhone(e.target.value.replace(/\D/g,'').slice(0,10))} required />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase opacity-50 block mb-2">Dată Limită Înscrieri (Opțional Timer)</label>
                            <input type="datetime-local" className={`w-full p-4 rounded-2xl outline-none border ${inputBg}`} value={regDeadline} onChange={e=>setRegDeadline(e.target.value)} />
                        </div>
                    </div>
                )}

                <textarea placeholder="Detalii suplimentare..." className={`w-full p-4 rounded-2xl outline-none border h-24 resize-none mb-4 ${inputBg}`} value={content} onChange={e=>setContent(e.target.value)} required />
                <div className="mb-6"><label className="text-[10px] font-black uppercase opacity-50 block mb-2">Imagine Copertă (URL Extern)</label><input placeholder="Ex: https://imgur.com/poza.jpg" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} className={`w-full p-4 rounded-xl border ${inputBg}`} /></div>

                {eventType === 'activity' && (
                    <div className={`mb-6 p-5 rounded-2xl border ${darkMode ? 'bg-black/30 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                        <label className="flex items-center gap-3 cursor-pointer mb-4"><input type="checkbox" checked={isTeamEvent} onChange={e=>setIsTeamEvent(e.target.checked)} className="w-5 h-5 accent-green-500 cursor-pointer rounded" /><span className="font-bold text-sm">👥 Eveniment cu Echipe (Liderul înscrie echipa)</span></label>
                        {isTeamEvent && (
                            <div className="grid sm:grid-cols-2 gap-4 animate-popup">
                                <div><label className="text-[10px] font-black uppercase opacity-50 block mb-2">Mărime Echipă</label><input type="number" min="2" max="10" className={`w-full p-3 rounded-xl outline-none border ${inputBg}`} value={teamSize} onChange={e=>setTeamSize(Number(e.target.value))} required /></div>
                                <div><label className="text-[10px] font-black uppercase opacity-50 block mb-2">Reguli Formare Echipă</label><select value={teamRule} onChange={e=>setTeamRule(e.target.value)} className={`w-full p-3 rounded-xl outline-none border ${inputBg}`}><option value="any">Fără Reguli (Liber)</option><option value="same_class">Strict: Toți din aceeași clasă</option><option value="same_class_plus_one">Maxim 1 elev din altă clasă</option></select></div>
                            </div>
                        )}
                    </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                    <div><label className="text-[10px] font-black uppercase opacity-50 block mb-2">Din data</label><input type="date" className={`w-full p-4 rounded-2xl outline-none border ${inputBg}`} value={startDate} onChange={e=>setStartDate(e.target.value)} required /></div>
                    <div>
                        <div className="flex justify-between items-end mb-2"><label className="text-[10px] font-black uppercase opacity-50 block">Până în (Opțional)</label><button type="button" onClick={() => setEndDate(startDate)} className="text-[10px] bg-green-500/20 text-green-500 px-3 py-1 rounded-lg font-bold hover:bg-green-500 hover:text-white transition">Același ca Start</button></div>
                        <input type="date" className={`w-full p-4 rounded-2xl outline-none border ${inputBg}`} value={endDate} onChange={e=>setEndDate(e.target.value)} />
                    </div>
                </div>

                <div className={`mb-4 p-5 rounded-2xl border transition-all ${darkMode ? 'bg-black/30 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                    <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={hasTime} onChange={e=>setHasTime(e.target.checked)} className="w-5 h-5 accent-green-500 cursor-pointer rounded" /><span className="font-bold text-sm">⏰ Adaugă Oră (Opțional)</span></label>
                    {hasTime && (
                        <div className="grid grid-cols-2 gap-4 mt-4 animate-fade-in">
                            <div><label className="text-[10px] font-black uppercase opacity-50 block mb-2">Ora Începerii</label><input type="time" className={`w-full p-3 rounded-xl outline-none border ${inputBg}`} value={startTime} onChange={e=>setStartTime(e.target.value)} required /></div>
                            <div><label className="text-[10px] font-black uppercase opacity-50 block mb-2">Ora Finalizării</label><input type="time" className={`w-full p-3 rounded-xl outline-none border ${inputBg}`} value={endTime} onChange={e=>setEndTime(e.target.value)} /></div>
                        </div>
                    )}
                </div>

                {eventType === 'activity' && (
                    <div className="grid sm:grid-cols-2 gap-4 mb-6 animate-fade-in">
                        <div><label className="text-[10px] font-black uppercase opacity-50 block mb-2">LOCAȚIE</label><input placeholder="Ex: Sala Festivă" className={`w-full p-4 rounded-2xl outline-none border ${inputBg}`} value={evLoc} onChange={e=>setEvLoc(e.target.value)} required /></div>
                        <div><label className="text-[10px] font-black uppercase opacity-50 block mb-2">LOCURI (0 = Nelimitat)</label><input type="number" min="0" className={`w-full p-4 rounded-2xl outline-none border ${inputBg}`} value={spots} onChange={e=>setSpots(Number(e.target.value))} required /></div>
                    </div>
                )}
                
                <p className="text-[10px] font-black tracking-widest text-green-500 uppercase mb-3">Afișează Doar Pentru</p>
                <div className="flex flex-wrap gap-2 mb-6">{SCHOOL_CLASSES.map(c => <button key={c} type="button" onClick={() => toggleClass(c)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${selectedClasses.includes(c) ? 'bg-green-600 border-green-500 text-white' : `${darkMode?'bg-white/5 border-white/10 text-gray-400':'bg-slate-100 border-slate-200 text-slate-600'}`}`}>{c}</button>)}</div>

                <button className="w-full py-4 bg-green-600 text-white rounded-2xl font-black text-lg hover:bg-green-500 transition shadow-lg shadow-green-500/20">Salvează în Calendar</button>
            </form>
        )}

        {activeTab === "notif" && currentUserRole === 'admin' && (
            <div className="grid lg:grid-cols-2 gap-8">
                <div className={`p-6 sm:p-8 rounded-[2.5rem] border backdrop-blur-xl ${cardBg}`}>
                  <h2 className="text-xl font-black mb-6">📢 Trimite Notificare</h2>
                  <div className="space-y-4">
                    <select value={selectedClassNotif} onChange={(e)=>setSelectedClassNotif(e.target.value)} className={`w-full p-4 rounded-2xl font-black outline-none border ${inputBg}`}>
                      <option value="Toată Școala" className="bg-white text-black">Către: Toată Școala</option>
                      {SCHOOL_CLASSES.map(c => <option key={c} value={c} className="bg-white text-black">Clasa: {c}</option>)}
                    </select>
                    <input placeholder="Titlu scurt" className={`w-full p-4 rounded-2xl font-bold border outline-none ${inputBg}`} value={notifTitle} onChange={e=>setNotifTitle(e.target.value)} />
                    <textarea placeholder="Mesajul tău..." className={`w-full p-4 rounded-2xl border outline-none h-32 resize-none ${inputBg}`} value={notifBody} onChange={e=>setNotifBody(e.target.value)} />
                    <button onClick={handleSendNotif} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-lg hover:bg-red-500 transition shadow-lg">Trimite Elevilor</button>
                  </div>
                </div>

                <div className={`p-6 sm:p-8 rounded-[2.5rem] border backdrop-blur-xl flex flex-col ${cardBg}`}>
                    <h2 className="text-xl font-black mb-6 flex items-center gap-2 text-blue-500">📥 Inbox Utilizatori</h2>
                    <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 max-h-[500px]">
                        {adminMessages.length === 0 && <p className="opacity-50 text-sm italic py-10 text-center">Niciun mesaj primit recent.</p>}
                        {adminMessages.map(msg => (
                            <div key={msg.id} className={`p-4 rounded-2xl border ${darkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex justify-between items-start mb-2 border-b border-black/10 dark:border-white/10 pb-2">
                                    <div>
                                        <p className="font-black text-sm">{msg.userName}</p>
                                        <p className="text-[10px] font-mono opacity-60">{msg.userClass} • {new Date(msg.createdAt).toLocaleString('ro-RO')}</p>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${msg.reason === 'Schimbare Clasă' ? 'bg-orange-500/20 text-orange-500' : msg.reason === 'Raportare Bug/Eroare' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                                        {msg.reason}
                                    </span>
                                </div>
                                <p className="text-sm opacity-80 mb-3 whitespace-pre-wrap">{msg.message}</p>
                                <div className="flex justify-end">
                                    <button onClick={() => handleDeleteMessage(msg.id)} className="text-[10px] font-bold text-red-500 hover:underline">Rezolvat (Șterge)</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === "whitelist" && currentUserRole === 'admin' && (
            <div className="grid lg:grid-cols-2 gap-8">
                <div className={`p-6 sm:p-8 rounded-[2.5rem] border backdrop-blur-xl ${cardBg}`}>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-black">Adaugă Emailuri</h2>
                        <label className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-[10px] sm:text-xs font-bold cursor-pointer transition shadow-lg flex items-center gap-2">📁 .txt / .csv <input type="file" accept=".txt,.csv" onChange={handleFileUpload} className="hidden" /></label>
                    </div>
                    <textarea value={emailList} onChange={e => setEmailList(e.target.value)} className={`w-full p-4 rounded-2xl outline-none border h-48 resize-none font-mono text-sm leading-relaxed ${inputBg}`} placeholder="popescu.ion&#10;ionescu.maria"/>
                    <button onClick={handleAddWhitelist} className={`w-full py-4 rounded-2xl font-black transition mt-6 ${darkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>Validează Lista</button>
                </div>
                <div className={`p-6 sm:p-8 rounded-[2.5rem] border backdrop-blur-xl ${cardBg}`}>
                    <h2 className="text-xl font-black mb-6">Conturi Aprobate</h2>
                    <input placeholder="Caută..." className={`w-full p-4 rounded-2xl outline-none border mb-4 ${inputBg}`} value={whitelistSearch} onChange={e => setWhitelistSearch(e.target.value)} />
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {whitelistDb.filter(w => w.id.includes(whitelistSearch.toLowerCase())).map(w => (
                            <div key={w.id} className={`flex justify-between items-center p-4 rounded-2xl border ${darkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                <span className={`text-sm font-mono opacity-80`}>{w.id}</span>
                                <button onClick={() => handleDelete(w.id, "whitelist")} className="text-red-500 text-xs font-bold px-4 py-2 bg-red-500/10 rounded-lg hover:bg-red-600 hover:text-white transition">Revocă</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {viewUserHistory && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-popup">
                <div className={`border p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl relative ${darkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200 text-slate-900'}`}>
                    <button onClick={() => setViewUserHistory(null)} className="absolute top-6 right-6 w-8 h-8 bg-black/10 dark:bg-white/10 rounded-full font-bold">✕</button>
                    <h2 className="text-2xl font-black mb-1">Istoric Activitate</h2>
                    <p className="text-xs text-blue-500 font-bold uppercase tracking-wider mb-2">{viewUserHistory.name}</p>
                    <p className="text-[10px] opacity-50 font-mono mb-6">Înregistrat pe site: {viewUserHistory.termsAcceptedAt ? new Date(viewUserHistory.termsAcceptedAt).toLocaleDateString('ro-RO') : 'Necunoscut'}</p>
                    
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                        {viewUserHistory.history.length === 0 ? <p className="text-sm italic opacity-60">Fără participări la evenimente.</p> : viewUserHistory.history.map((h:any, i:number) => (
                            <div key={i} className={`p-4 rounded-xl border ${darkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="font-bold text-sm mb-1">{h.eventTitle}</div>
                                <div className="flex justify-between items-center text-[10px] font-mono opacity-60">
                                    <span>Rol: <strong className="text-red-400">{h.role}</strong></span>
                                    <span>Data: {h.date}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {viewAttendeesModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-popup">
                <div className={`border p-8 rounded-[2.5rem] w-full max-w-2xl shadow-2xl relative ${darkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200 text-slate-900'}`}>
                    <button onClick={() => setViewAttendeesModal(null)} className="absolute top-6 right-6 w-8 h-8 bg-black/10 dark:bg-white/10 rounded-full font-bold hover:rotate-90 transition-transform">✕</button>
                    <h2 className="text-2xl font-black mb-1">{viewAttendeesModal.isTeamEvent ? "Echipe Înscrise" : "Lista Participanți"}</h2>
                    <p className="text-xs text-green-500 font-bold uppercase tracking-wider mb-6">{viewAttendeesModal.title}</p>
                    
                    <div className="max-h-[50vh] overflow-y-auto mb-6 pr-2 space-y-4 custom-scrollbar">
                        {viewAttendeesModal.isTeamEvent ? (
                            viewAttendeesModal.teams?.length === 0 ? <p className="text-sm italic opacity-60">Nicio echipă înscrisă.</p> :
                            viewAttendeesModal.teams?.map((t:any, idx:number) => (
                                <div key={idx} className={`p-4 rounded-2xl border ${darkMode ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-300'}`}>
                                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-black/10 dark:border-white/10">
                                        <div className="font-black text-sm text-red-500">Echipa #{idx + 1}</div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-[10px] opacity-50 font-mono">Înscris: {new Date(t.registeredAt).toLocaleString('ro-RO')}</div>
                                            <button onClick={() => removeTeamAdmin(viewAttendeesModal, t.leaderId)} className="text-[10px] bg-red-500/10 text-red-500 px-2 py-1 rounded hover:bg-red-500 hover:text-white transition font-bold">Șterge Echipa</button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-xs font-bold bg-black/5 dark:bg-white/5 p-2 rounded-lg">
                                            <span>👑 {t.leaderName} (Lider) <span className="opacity-50 text-[10px] ml-2">{t.leaderClass}</span></span>
                                            <span className="opacity-60 font-mono">{t.leaderPhone}</span>
                                        </div>
                                        {t.members?.map((m:any, i:number) => (
                                            <div key={i} className="flex justify-between items-center text-xs p-2">
                                                <span>👤 {m.name} <span className="opacity-50 text-[10px] ml-2">{m.class}</span></span>
                                                <div className="flex items-center gap-3">
                                                    <span className="opacity-60 font-mono">{m.phone}</span>
                                                    <button onClick={() => removeTeamMemberAdmin(viewAttendeesModal, t.leaderId, m.id)} className="text-[10px] text-red-500 hover:underline font-bold">🗑️ Elimina</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            viewAttendeesModal.attendees?.length === 0 ? <p className="text-sm italic opacity-60">Niciun elev înscris.</p> :
                            viewAttendeesModal.attendees?.map((a:any, idx:number) => (
                                <div key={idx} className={`flex justify-between items-center p-3 rounded-xl border ${darkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="font-bold text-sm">{idx + 1}. {a.name} <span className="opacity-50 text-[10px] ml-2">{a.class}</span></div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-[10px] font-mono opacity-60">{a.phone}</div>
                                        <button onClick={() => removeAttendeeAdmin(viewAttendeesModal, a.id)} className="text-[10px] bg-red-500/10 text-red-500 px-2 py-1 rounded hover:bg-red-500 hover:text-white transition font-bold">Elimină</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}