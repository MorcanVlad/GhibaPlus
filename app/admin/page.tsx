// app/admin/page.tsx
"use client";
import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { useRouter } from "next/navigation";
import { doc, getDoc, collection, addDoc, setDoc, getDocs, query, orderBy, deleteDoc, updateDoc } from "firebase/firestore";
import { INTEREST_CATEGORIES, CALENDAR_TYPES, SCHOOL_CLASSES } from "../lib/constants";

export default function AdminPanel() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("news");
  const [existingData, setExistingData] = useState<any[]>([]); 
  const [viewParticipants, setViewParticipants] = useState<any>(null);
  
  // Dark Mode State
  const [darkMode, setDarkMode] = useState(false);

  // Users DB & Whitelist DB
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [whitelistData, setWhitelistData] = useState<any[]>([]); // <--- NOU
  const [userSearch, setUserSearch] = useState("");
  const [whitelistSearch, setWhitelistSearch] = useState(""); // <--- NOU

  const router = useRouter();
  
  // Form States Generale
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("General");
  const [imageUrl, setImageUrl] = useState("");
  
  // State Activitati
  const [spots, setSpots] = useState(30);
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [organizers, setOrganizers] = useState("");
  const [requirements, setRequirements] = useState("");
  
  // State Calendar
  const [calType, setCalType] = useState("vacation");
  const [calStart, setCalStart] = useState("");
  const [calEnd, setCalEnd] = useState("");
  const [calTarget, setCalTarget] = useState("Toată Școala"); // <--- NOU: Pentru cine e evenimentul
  const [editingCalId, setEditingCalId] = useState<string | null>(null); // <--- NOU: ID-ul evenimentului editat

  // State Whitelist
  const [emailList, setEmailList] = useState("");

  useEffect(() => {
    if (localStorage.getItem("admin_theme") === "dark") setDarkMode(true);

    auth.onAuthStateChanged(async (u) => {
        if (!u) return router.push("/");
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists() && snap.data().role === 'admin') {
            setUser(snap.data());
            fetchData("news");
        } else {
            router.push("/dashboard");
        }
    });
  }, []);

  const toggleTheme = () => {
      const newVal = !darkMode;
      setDarkMode(newVal);
      localStorage.setItem("admin_theme", newVal ? "dark" : "light");
  };

  const fetchData = async (type: string) => {
      try {
        if (type === "whitelist") {
            // Whitelist-ul e special, ID-ul documentului e emailul
            const snap = await getDocs(collection(db, "whitelist"));
            setWhitelistData(snap.docs.map(d => ({id: d.id, ...d.data()}))); // id = email
            return;
        }

        let sortField = "postedAt";
        if (type === "news") sortField = "date";
        if (type === "calendar_events") sortField = "start";
        if (type === "users") sortField = "name";

        const q = query(collection(db, type), orderBy(sortField, type === "calendar_events" ? "asc" : "desc"));
        const snap = await getDocs(q);

        if (type === "users") setAllUsers(snap.docs.map(d => ({id: d.id, ...d.data()})));
        else setExistingData(snap.docs.map(d => ({id: d.id, ...d.data()})));
      } catch (e) { console.error(e); }
  };

  const handleTabChange = (tab: string) => {
      setActiveTab(tab);
      setExistingData([]);
      // Reset form calendar
      setEditingCalId(null); setTitle(""); setCalStart(""); setCalEnd(""); setCalTarget("Toată Școala");

      if (tab === "news") fetchData("news");
      if (tab === "activities" || tab === "manage_activities") fetchData("activities");
      if (tab === "users_db") fetchData("users");
      if (tab === "calendar") fetchData("calendar_events");
      if (tab === "users_whitelist") fetchData("whitelist");
  };

  const handleDelete = async (id: string, collectionName: string) => {
      if (!confirm("Sigur ștergi definitiv?")) return;
      await deleteDoc(doc(db, collectionName, id));
      alert("Element șters!");
      
      if (collectionName === "users") fetchData("users");
      else if (collectionName === "whitelist") fetchData("whitelist");
      else fetchData(collectionName);
  };

  // --- LOGICA NOULUI CALENDAR (ADD + EDIT) ---
  const handleSaveCalendar = async (e: React.FormEvent) => {
      e.preventDefault();
      const eventData = { 
          title, 
          type: calType, 
          start: calStart, 
          end: calEnd, 
          targetClass: calTarget, // <--- Salvam clasa
          postedAt: new Date().toISOString() 
      };

      try {
        if (editingCalId) {
            // EDITARE
            await updateDoc(doc(db, "calendar_events", editingCalId), eventData);
            alert("✅ Eveniment actualizat!");
            setEditingCalId(null);
        } else {
            // ADĂUGARE NOUĂ
            await addDoc(collection(db, "calendar_events"), eventData);
            alert("✅ Eveniment adăugat!");
        }
        // Reset
        setTitle(""); setCalStart(""); setCalEnd(""); setCalTarget("Toată Școala");
        fetchData("calendar_events");
      } catch (e: any) { alert("Eroare: " + e.message); }
  };

  const handleEditCalendar = (ev: any) => {
      setEditingCalId(ev.id);
      setTitle(ev.title);
      setCalType(ev.type);
      setCalStart(ev.start);
      setCalEnd(ev.end);
      setCalTarget(ev.targetClass || "Toată Școala");
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Mergem sus la formular
  };

  // --- WHITELIST ---
  const handleAddEmails = async () => {
    const emails = emailList.split(/[\n,]+/).map(e => e.trim().toLowerCase()).filter(e => e);
    let added = 0;
    for (const email of emails) { 
        const ref = doc(db, "whitelist", email); 
        const snap = await getDoc(ref); 
        if (!snap.exists()) { await setDoc(ref, { allowed: true, dateAdded: new Date().toISOString() }); added++; } 
    }
    alert(`✅ ${added} emailuri noi.`); setEmailList("");
    fetchData("whitelist");
  };

  // --- FILTRE ---
  const filteredUsers = allUsers.filter(u => u.email?.toLowerCase().includes(userSearch.toLowerCase()) || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.phone?.includes(userSearch));
  const filteredWhitelist = whitelistData.filter(w => w.id.toLowerCase().includes(whitelistSearch.toLowerCase()));

  // CLASE CSS
  const bgClass = darkMode ? "bg-gray-900 text-gray-100" : "bg-slate-50 text-gray-800";
  const cardClass = darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const inputClass = `w-full p-3 border rounded mb-3 outline-none focus:ring-2 focus:ring-red-500 transition ${darkMode ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900"}`;
  const tableHeaderClass = darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600";
  const tableRowClass = darkMode ? "border-gray-700 hover:bg-gray-700/50" : "border-gray-100 hover:bg-gray-50";

  // --- COMPONENTE ---
  const TagSelector = () => (
    <select className={inputClass} value={tag} onChange={e => setTag(e.target.value)}>
        <option value="General">General</option>
        {Object.entries(INTEREST_CATEGORIES).map(([cat, tags]) => (
            <optgroup key={cat} label={cat} className="text-black">{tags.map(t => <option key={t} value={t} className="text-black">{t}</option>)}</optgroup>
        ))}
    </select>
  );

  const handleAddNews = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, "news"), { title, content, category: tag, imageUrl, likes: [], date: new Date().toISOString() }); 
    alert("✅ Știre postată!"); setTitle(""); setContent(""); fetchData("news"); 
  };
  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, "activities"), { title, category: tag, maxSpots: Number(spots), date, imageUrl, location, organizers, requirements, postedAt: new Date().toISOString(), registeredStudents: [], likes: [] });
    alert("✅ Activitate creată!"); setTitle(""); setLocation(""); setRequirements(""); setOrganizers(""); fetchData("activities");
  };

  if (!user) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${bgClass}`}>
      <div className={`${darkMode ? "bg-red-950" : "bg-red-900"} text-white p-4 sticky top-0 z-50 flex justify-between items-center shadow-lg`}>
        <div className="flex items-center gap-4">
             <h1 className="text-xl font-bold flex items-center gap-2">🛡️ Admin Panel</h1>
             <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-white/10 text-lg transition">{darkMode ? "☀️" : "🌙"}</button>
        </div>
        <button onClick={() => router.push('/dashboard')} className="bg-white text-red-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-100 transition shadow">Înapoi la Site</button>
      </div>

      <main className="p-6 max-w-6xl mx-auto">
        <div className={`flex gap-2 mb-8 border-b pb-1 overflow-x-auto ${darkMode ? "border-gray-700" : "border-gray-300"}`}>
            {['news', 'activities', 'calendar', 'users_db', 'users_whitelist', 'manage_activities'].map((t) => (
                <button key={t} onClick={() => handleTabChange(t)} className={`px-5 py-2.5 rounded-t-xl font-bold capitalize whitespace-nowrap transition-all ${activeTab === t ? "bg-red-700 text-white shadow-lg transform -translate-y-1" : `hover:bg-gray-200 ${darkMode ? "text-gray-400 hover:bg-gray-800" : "text-gray-600"}`}`}>
                    {t.replace('_', ' ')}
                </button>
            ))}
        </div>

        <div className={`p-8 rounded-2xl shadow-xl border ${cardClass}`}>
            
            {/* --- STIRI --- */}
            {activeTab === "news" && (
                <>
                <form onSubmit={handleAddNews} className={`mb-10 border-b pb-8 ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                    <h2 className="font-bold text-2xl mb-6 flex items-center gap-2">📰 Postează Știre</h2>
                    <input className={inputClass} placeholder="Titlu Știre" value={title} onChange={e => setTitle(e.target.value)} required />
                    <TagSelector />
                    <input className={inputClass} placeholder="Link Poză (Opțional)" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
                    <textarea className={inputClass} placeholder="Conținut..." rows={4} value={content} onChange={e => setContent(e.target.value)} required />
                    <button className="bg-red-700 text-white py-3 px-6 rounded-lg font-bold w-full hover:shadow-lg transition">Publică</button>
                </form>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {existingData.map((item:any) => (
                        <div key={item.id} className={`flex justify-between p-4 border rounded-xl items-center ${tableRowClass}`}>
                            <span className="font-bold">{item.title}</span>
                            <button onClick={() => handleDelete(item.id, "news")} className="text-red-500 font-bold px-3 py-1 bg-red-500/10 rounded-lg">Șterge</button>
                        </div>
                    ))}
                </div>
                </>
            )}

            {/* --- ACTIVITATI --- */}
            {activeTab === "activities" && (
                 <>
                 <form onSubmit={handleAddActivity} className={`mb-10 border-b pb-8 ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                    <h2 className="font-bold text-2xl mb-6 text-green-600">⚽ Creează Activitate</h2>
                    <input className={inputClass} placeholder="Nume Eveniment" value={title} onChange={e => setTitle(e.target.value)} required />
                    <TagSelector />
                    <input className={inputClass} placeholder="Link Poză" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
                    <div className="grid grid-cols-2 gap-4">
                        <input className={inputClass} type="datetime-local" value={date} onChange={e => setDate(e.target.value)} required />
                        <input className={inputClass} type="number" placeholder="Locuri" value={spots} onChange={e => setSpots(Number(e.target.value))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <input className={inputClass} placeholder="Locație" value={location} onChange={e => setLocation(e.target.value)} required />
                         <input className={inputClass} placeholder="Organizator" value={organizers} onChange={e => setOrganizers(e.target.value)} required />
                    </div>
                    <textarea className={inputClass} placeholder="Cerințe Speciale..." rows={3} value={requirements} onChange={e => setRequirements(e.target.value)} />
                    <button className="bg-green-600 text-white py-3 px-6 rounded-lg font-bold w-full transition">Creează</button>
                </form>
                <div className="space-y-3">
                    {existingData.map((item:any) => (
                        <div key={item.id} className={`flex justify-between p-4 border rounded-xl items-center ${tableRowClass}`}>
                            <span className="font-bold">{item.title}</span>
                            <button onClick={() => handleDelete(item.id, "activities")} className="text-red-500 font-bold px-3 py-1 bg-red-500/10 rounded-lg">Șterge</button>
                        </div>
                    ))}
                </div>
                </>
            )}

            {/* --- CALENDAR (CU EDITARE SI FILTRARE CLASA) --- */}
            {activeTab === "calendar" && (
                <>
                    <form onSubmit={handleSaveCalendar} className={`mb-10 border-b pb-8 ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                        <h2 className="font-bold text-2xl mb-6 text-purple-600 flex items-center gap-2">
                            {editingCalId ? "✏️ Editează Eveniment" : "📅 Adaugă în Calendar"}
                        </h2>
                        
                        <input className={inputClass} placeholder="Nume (ex: Teză Matematică)" value={title} onChange={e => setTitle(e.target.value)} required />
                        
                        <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                                <label className="text-xs font-bold mb-1 block opacity-70">Tip</label>
                                <select className={inputClass} value={calType} onChange={e => setCalType(e.target.value)}>
                                    {Object.entries(CALENDAR_TYPES).map(([key, val]) => (
                                        <option key={key} value={key}>{val.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold mb-1 block opacity-70">Pentru cine?</label>
                                <select className={inputClass} value={calTarget} onChange={e => setCalTarget(e.target.value)}>
                                    <option value="Toată Școala">🌍 Toată Școala</option>
                                    {SCHOOL_CLASSES.map(cls => (
                                        <option key={cls} value={cls}>Clasa {cls}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-3">
                            <div><label className="text-xs font-bold mb-1 block opacity-70">Început</label><input type="date" className={inputClass} value={calStart} onChange={e => setCalStart(e.target.value)} required /></div>
                            <div><label className="text-xs font-bold mb-1 block opacity-70">Sfârșit</label><input type="date" className={inputClass} value={calEnd} onChange={e => setCalEnd(e.target.value)} required /></div>
                        </div>
                        
                        <div className="flex gap-2">
                            <button className={`flex-1 py-3 px-6 rounded-lg font-bold text-white transition shadow-lg ${editingCalId ? "bg-blue-600 hover:bg-blue-700" : "bg-purple-600 hover:bg-purple-700"}`}>
                                {editingCalId ? "Salvează Modificările" : "Adaugă Eveniment"}
                            </button>
                            {editingCalId && (
                                <button type="button" onClick={() => {setEditingCalId(null); setTitle(""); setCalTarget("Toată Școala");}} className="px-6 rounded-lg font-bold bg-gray-500 text-white">Anulează</button>
                            )}
                        </div>
                    </form>
                    
                    <h3 className="font-bold mb-4 opacity-70">Listă Evenimente:</h3>
                    <div className="space-y-2">
                        {existingData.map((ev: any) => (
                            <div key={ev.id} className={`flex justify-between p-3 border-b items-center ${tableRowClass}`}>
                                <div>
                                    <div className="font-bold">{ev.title}</div>
                                    <div className="text-xs opacity-60 flex gap-2">
                                        <span>{ev.start} - {ev.end}</span>
                                        <span className={`font-bold px-1 rounded ${ev.targetClass === "Toată Școala" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}>
                                            {ev.targetClass || "Toată Școala"}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEditCalendar(ev)} className="bg-blue-100 text-blue-600 px-3 py-1 rounded-lg text-sm font-bold hover:bg-blue-600 hover:text-white transition">✏️</button>
                                    <button onClick={() => handleDelete(ev.id, "calendar_events")} className="bg-red-100 text-red-600 px-3 py-1 rounded-lg text-sm font-bold hover:bg-red-600 hover:text-white transition">🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* --- USERS DB --- */}
            {activeTab === "users_db" && (
                <div>
                    <h2 className="font-bold text-2xl mb-6">👥 Bază de Date Elevi</h2>
                    <input type="text" placeholder="Caută elev..." className={inputClass} value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                    <div className={`overflow-x-auto rounded-xl border ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                        <table className="w-full text-left border-collapse">
                            <thead className={tableHeaderClass}>
                                <tr>
                                    <th className="p-4">Nume</th><th className="p-4">Clasa</th><th className="p-4 text-right">Acțiuni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(u => (
                                    <tr key={u.id} className={`border-b ${tableRowClass}`}>
                                        <td className="p-4 font-bold">{u.name}<br/><span className="text-xs opacity-50 font-normal">{u.email}</span></td>
                                        <td className="p-4"><span className="bg-gray-500/10 px-2 py-1 rounded text-xs font-bold">{u.class || "?"}</span></td>
                                        <td className="p-4 text-right"><button onClick={() => handleDelete(u.id, "users")} className="text-red-500 font-bold text-sm">Elimină</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            
            {/* --- WHITELIST CU TABEL SI SEARCH --- */}
             {activeTab === "users_whitelist" && (
                 <div>
                    <h2 className="font-bold text-xl mb-4 text-blue-600">📧 Gestionare Whitelist</h2>
                    
                    {/* Add Form */}
                    <div className={`p-4 rounded-xl mb-6 ${darkMode ? "bg-gray-700/30" : "bg-blue-50"}`}>
                        <label className="text-xs font-bold mb-2 block opacity-70">Adaugă Emailuri Noi (separate prin virgulă sau linie nouă)</label>
                        <textarea rows={3} className={inputClass} placeholder="elev1@ghibabirta.ro&#10;elev2@ghibabirta.ro" value={emailList} onChange={e => setEmailList(e.target.value)} />
                        <button onClick={handleAddEmails} className="bg-blue-600 text-white py-2 px-6 rounded font-bold hover:bg-blue-700 transition">Aprobă Emailuri</button>
                    </div>

                    {/* Search & List */}
                    <input type="text" placeholder="Caută email în whitelist..." className={inputClass} value={whitelistSearch} onChange={e => setWhitelistSearch(e.target.value)} />
                    
                    <div className={`overflow-y-auto max-h-[400px] rounded-xl border ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                        <table className="w-full text-left">
                            <thead className={tableHeaderClass}>
                                <tr>
                                    <th className="p-3">Email Aprobat</th>
                                    <th className="p-3 text-right">Acțiuni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredWhitelist.length === 0 ? (
                                    <tr><td colSpan={2} className="p-4 text-center opacity-50">Niciun rezultat.</td></tr>
                                ) : (
                                    filteredWhitelist.map((item) => (
                                        <tr key={item.id} className={`border-b ${tableRowClass}`}>
                                            <td className="p-3 font-mono text-sm">{item.id}</td>
                                            <td className="p-3 text-right">
                                                <button onClick={() => handleDelete(item.id, "whitelist")} className="text-red-500 hover:bg-red-500/10 px-3 py-1 rounded text-xs font-bold transition">Șterge</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
             
            {/* --- PARTICIPANTI --- */}
            {activeTab === "manage_activities" && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold mb-4">Alege un eveniment</h2>
                    {existingData.map(act => (
                        <div key={act.id} className={`flex justify-between items-center p-4 border rounded hover:bg-gray-50/5 transition ${tableRowClass}`}>
                            <div><div className="font-bold">{act.title}</div><div className="text-sm opacity-60">{new Date(act.date).toLocaleString('ro-RO')}</div></div>
                            <button onClick={() => setViewParticipants(act)} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 text-sm">Participanți</button>
                        </div>
                    ))}
                    {viewParticipants && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <div className={`rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[80vh] ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                                <div className="bg-red-900 text-white p-4 flex justify-between items-center">
                                    <h3 className="font-bold">Participanți: {viewParticipants.title}</h3>
                                    <button onClick={() => setViewParticipants(null)} className="text-white">✕</button>
                                </div>
                                <div className="p-4 overflow-y-auto flex-1">
                                    {viewParticipants.registeredStudents?.map((s:any, i:number) => (
                                        <div key={i} className={`border-b py-3 flex justify-between items-center ${darkMode ? "border-gray-700" : "border-gray-100"}`}>
                                            <span className="font-bold">{s.name}</span>
                                            <span className="font-mono text-blue-500 bg-blue-500/10 px-2 py-1 rounded text-sm">{s.phone}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
      </main>
    </div>
  );
}