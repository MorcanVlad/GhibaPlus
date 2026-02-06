// app/dashboard/page.tsx
"use client";
import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase"; 
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, collection, query, getDocs, arrayUnion, arrayRemove, orderBy } from "firebase/firestore";
import { INTEREST_CATEGORIES, SCHOOL_CLASSES, CALENDAR_TYPES } from "../lib/constants";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [news, setNews] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

  // UI States
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  
  // State Înscriere & Editare
  const [confirmPhone, setConfirmPhone] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editClass, setEditClass] = useState("");

  const router = useRouter();

  useEffect(() => {
    const init = async () => {
        auth.onAuthStateChanged(async (u) => {
            if (!u) return router.push("/");
            
            const snap = await getDoc(doc(db, "users", u.uid));
            if (snap.exists()) {
                const d = snap.data();
                setUser(d);
                setEditPhone(d.phone || "");
                setEditClass(d.class || "");
                if (!d.onboardingCompleted) setShowSettings(true);
            }
            
            const newsSnap = await getDocs(query(collection(db, "news"), orderBy("date", "desc")));
            setNews(newsSnap.docs.map(d => ({id: d.id, type: 'news', ...d.data()})));

            const actSnap = await getDocs(query(collection(db, "activities"), orderBy("date", "asc")));
            setActivities(actSnap.docs.map(d => ({id: d.id, type: 'activity', ...d.data()})));

            const calSnap = await getDocs(query(collection(db, "calendar_events"), orderBy("start", "asc")));
            setCalendarEvents(calSnap.docs.map(d => ({id: d.id, ...d.data()})));
        });
    };
    init();
  }, []);

  const saveSettings = async () => {
    if (editPhone.length < 10) { alert("Telefon invalid!"); return; }
    await updateDoc(doc(db, "users", auth.currentUser!.uid), { interests: user.interests, phone: editPhone, class: editClass, onboardingCompleted: true });
    setUser({...user, phone: editPhone, class: editClass, onboardingCompleted: true});
    setShowSettings(false);
  };

  const toggleInterest = (interest: string) => {
    let newInterests = user.interests || [];
    if (newInterests.includes(interest)) newInterests = newInterests.filter((i:any) => i !== interest);
    else newInterests.push(interest);
    setUser({...user, interests: newInterests});
  };

  const handleRegister = async () => {
    // 1. Calculăm telefonul final
    const finalPhone = confirmPhone || user.phone;
    
    // 2. Validare Telefon
    if (!finalPhone || finalPhone.length < 10) { 
        alert("Te rugăm să introduci un număr de telefon valid (minim 10 cifre)."); 
        return; 
    }
    
    // 3. Salvăm telefonul în profil dacă e nou
    if (finalPhone !== user.phone) {
        try {
            await updateDoc(doc(db, "users", user.uid), { phone: finalPhone });
            // Actualizăm starea locală ca să nu mai ceară data viitoare
            setUser((prev: any) => ({ ...prev, phone: finalPhone }));
        } catch (e) {
            console.error("Nu am putut salva telefonul în profil:", e);
        }
    }

    // 4. PREGĂTIM DATELE (AICI ERA PROBLEMA)
    // Folosim || "" sau || "..." pentru a ne asigura că NICIUN câmp nu este undefined
    const safeName = user.name || "Elev Fără Nume";
    const safeClass = user.class || "Nespecificat";
    const safeUid = user.uid || auth.currentUser?.uid;

    const registrationData = { 
        uid: safeUid, 
        name: safeName, 
        phone: finalPhone, 
        class: safeClass 
    };

    console.log("Se trimit datele:", registrationData); // Pentru debug

    try {
        // 5. Trimitem la Firebase
        await updateDoc(doc(db, "activities", selectedActivity.id), { 
            registeredStudents: arrayUnion(registrationData) 
        });
        
        // 6. Actualizăm interfața (UI)
        const updatedActs = activities.map(act => {
            if (act.id === selectedActivity.id) {
                return { 
                    ...act, 
                    registeredStudents: [...(act.registeredStudents || []), registrationData] 
                };
            }
            return act;
        });
        
        setActivities(updatedActs);
        setSelectedActivity(null); 
        setConfirmPhone("");
        alert("✅ Te-ai înscris cu succes!");

    } catch (e: any) { 
        console.error("Eroare Firebase:", e);
        alert("Eroare la înscriere: " + e.message); 
    }
  };

  const handleLike = async (item: any) => {
      const uid = auth.currentUser!.uid;
      const currentLikes = item.likes || [];
      const isLiked = currentLikes.includes(uid);
      const collectionName = item.type === 'news' ? "news" : "activities";

      const ref = doc(db, collectionName, item.id);
      await updateDoc(ref, { likes: isLiked ? arrayRemove(uid) : arrayUnion(uid) });

      const newLikeArray = isLiked ? currentLikes.filter((id: string) => id !== uid) : [...currentLikes, uid];
      if (item.type === 'news') setNews(news.map(n => n.id === item.id ? { ...n, likes: newLikeArray } : n));
      else setActivities(activities.map(a => a.id === item.id ? { ...a, likes: newLikeArray } : a));
  };

  const handleLogout = () => { auth.signOut(); router.push("/"); };

  if (!user) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Se încarcă...</div>;

  // Filtrare feed
  const allItems = [...news, ...activities];
  const filteredItems = allItems.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()));

  // Widget Calendar
  const CalendarWidget = () => {
    const today = new Date();
    const currentMonthEvents = calendarEvents.filter(ev => {
        const evDate = new Date(ev.start);
        return evDate.getMonth() === today.getMonth() && evDate.getFullYear() === today.getFullYear();
    });

    return (
        <div className="glass p-6 rounded-3xl border border-white/5 sticky top-28">
            <h3 className="font-bold text-lg mb-4 text-white flex items-center gap-2">
                <span className="text-2xl">📅</span> Calendar {today.toLocaleString('ro-RO', { month: 'long' })}
            </h3>
            {currentMonthEvents.length === 0 ? <p className="text-gray-500 text-sm italic p-2">Niciun eveniment major luna asta.</p> : (
                <div className="space-y-3">
                    {currentMonthEvents.map(ev => {
                         const typeInfo = CALENDAR_TYPES[ev.type as keyof typeof CALENDAR_TYPES] || {color: 'bg-gray-500'};
                         return (
                            <div key={ev.id} className={`p-4 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition relative overflow-hidden`}>
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${typeInfo.color}`}></div>
                                <div className={`text-[10px] font-bold uppercase ${typeInfo.color.replace('bg-', 'text-')} brightness-125 mb-1`}>{typeInfo.label}</div>
                                <div className="font-bold text-white text-sm leading-tight">{ev.title}</div>
                                <div className="text-xs text-gray-400 mt-2 flex items-center gap-2">
                                    <span className="bg-white/10 px-2 py-0.5 rounded text-white">{new Date(ev.start).getDate()}</span>
                                    <span>-</span>
                                    <span className="bg-white/10 px-2 py-0.5 rounded text-white">{new Date(ev.end).getDate()} {today.toLocaleString('ro-RO', { month: 'short' })}</span>
                                </div>
                            </div>
                         )
                    })}
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="relative min-h-screen bg-slate-900 text-white font-sans overflow-x-hidden selection:bg-red-500 selection:text-white">
        
        {/* ANIMATED BACKGROUND */}
        <div className="fixed inset-0 pointer-events-none">
             <div className="blob bg-red-600/20 w-96 h-96 top-0 left-0 -translate-x-1/2 -translate-y-1/2 animate-blob-1"></div>
             <div className="blob bg-yellow-600/10 w-80 h-80 bottom-0 right-0 translate-x-1/4 translate-y-1/4 animate-blob-2"></div>
        </div>

        {/* --- NAVBAR RESTAURAT --- */}
        <nav className="fixed top-0 w-full z-50 glass border-b border-white/5 px-4 py-3 bg-slate-900/60 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-800 rounded-xl flex items-center justify-center font-bold shadow-lg shadow-red-900/20 text-xl">G</div>
                    <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 hidden md:block">GhibaPlus</h1>
                </div>
                
                {/* SEARCH BAR CENTRAL */}
                <div className="flex-1 max-w-xl mx-4 relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</div>
                    <input 
                        placeholder="Caută activități, știri..." 
                        className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:bg-white/10 transition-all text-white placeholder-gray-500"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex gap-3 items-center">
                    <button onClick={() => setShowSettings(true)} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition border border-white/5 text-gray-300 hover:text-white" title="Setări">⚙️</button>
                    
                    {user.role === 'admin' && (
                        <button onClick={() => router.push('/admin')} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-full text-xs font-bold shadow-lg shadow-red-900/30 transition transform hover:scale-105">
                            ADMIN PANEL
                        </button>
                    )}
                    
                    <button onClick={handleLogout} className="text-xs font-bold text-red-400 hover:text-red-300 px-2 py-1">IEȘIRE</button>
                </div>
            </div>
        </nav>

        <main className="max-w-7xl mx-auto p-4 mt-24 grid lg:grid-cols-3 gap-8 relative z-10">
            {/* COLOANA PRINCIPALA */}
            <div className="lg:col-span-2 space-y-8">
                 <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-white">Noutăți & Feed</h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div>
                 </div>

                 {filteredItems.map(item => (
                    <div key={item.id} className="glass rounded-3xl border border-white/5 hover:border-red-500/20 transition-all duration-300 group overflow-hidden hover:shadow-2xl hover:shadow-black/50">
                        {item.imageUrl && (
                            <div className="h-48 w-full bg-cover bg-center relative group-hover:scale-105 transition-transform duration-700" style={{backgroundImage: `url(${item.imageUrl})`}}>
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-90"></div>
                            </div>
                        )}
                        
                        <div className="p-6 relative">
                            <div className="flex justify-between items-start mb-3">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${item.type === 'activity' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                    {item.type === 'activity' ? 'Eveniment' : 'Știre'} • {item.category}
                                </span>
                                <span className="text-xs text-gray-500 font-mono">{new Date(item.postedAt || item.date).toLocaleDateString()}</span>
                            </div>

                            <h3 className="text-2xl font-bold mb-3 group-hover:text-red-400 transition-colors">{item.title}</h3>
                            
                            {item.type === 'activity' && (
                                <div className="bg-white/5 p-4 rounded-2xl mb-4 border border-white/5 backdrop-blur-sm">
                                    <div className="flex gap-4 mb-4 text-sm text-gray-300">
                                        <div className="flex items-center gap-2">📅 <span className="text-white font-bold">{new Date(item.date).toLocaleString()}</span></div>
                                        <div className="flex items-center gap-2">📍 <span className="text-white font-bold">{item.location || "Liceu"}</span></div>
                                    </div>
                                    <button onClick={() => {setSelectedActivity(item); setConfirmPhone(user.phone || "");}} className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 py-3 rounded-xl font-bold text-sm transition shadow-lg shadow-red-900/20">
                                        Vezi Detalii & Înscrie-te
                                    </button>
                                </div>
                            )}
                            
                            {item.content && <p className="text-gray-400 text-sm leading-relaxed mb-4 line-clamp-3 group-hover:text-gray-300 transition-colors">{item.content}</p>}

                            <div className="pt-4 border-t border-white/5">
                                <button onClick={() => handleLike(item)} className={`flex items-center gap-2 text-sm font-bold transition px-4 py-2 rounded-xl hover:bg-white/5 ${item.likes?.includes(auth.currentUser?.uid) ? "text-red-500" : "text-gray-500 hover:text-gray-300"}`}>
                                    <span className="text-xl transform transition active:scale-125">{item.likes?.includes(auth.currentUser?.uid) ? "❤️" : "🤍"}</span> 
                                    {item.likes?.length || 0}
                                </button>
                            </div>
                        </div>
                    </div>
                 ))}
            </div>

            {/* COLOANA DREAPTA */}
            <div>
                <CalendarWidget />
            </div>
        </main>

        {/* MODALURILE (Settings & Details) */}
        {/* Păstrăm modalurile, dar le stilizăm mai bine */}
        {selectedActivity && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
                <div className="glass w-full max-w-lg rounded-3xl p-0 bg-slate-900 border border-white/10 overflow-hidden shadow-2xl">
                    <div className="bg-gradient-to-r from-red-900 to-slate-900 p-6 relative">
                        <button onClick={() => setSelectedActivity(null)} className="absolute top-4 right-4 text-white/50 hover:text-white transition bg-black/20 w-8 h-8 rounded-full flex items-center justify-center">✕</button>
                        <h2 className="text-2xl font-bold text-white pr-8">{selectedActivity.title}</h2>
                        <div className="text-xs text-red-300 font-bold uppercase mt-1">{selectedActivity.category}</div>
                    </div>
                    
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                <div className="text-gray-500 text-[10px] uppercase font-bold">Organizator</div>
                                <div className="text-white font-semibold">{selectedActivity.organizers}</div>
                            </div>
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                <div className="text-gray-500 text-[10px] uppercase font-bold">Locuri</div>
                                <div className={selectedActivity.registeredStudents?.length >= selectedActivity.maxSpots ? "text-red-400 font-bold" : "text-green-400 font-bold"}>
                                    {selectedActivity.registeredStudents?.length || 0} / {selectedActivity.maxSpots}
                                </div>
                            </div>
                        </div>

                        <div className="text-sm text-gray-300 bg-black/20 p-4 rounded-xl border border-white/5">
                            <p className="font-bold text-gray-400 text-xs mb-1 uppercase">Cerințe</p>
                            {selectedActivity.requirements || "Fără cerințe speciale."}
                        </div>
                        
                        <div className="pt-2">
                            <label className="text-xs text-gray-500 font-bold ml-1 mb-1 block">CONFIRMĂ TELEFONUL</label>
                            <input 
                                value={confirmPhone} 
                                onChange={e => setConfirmPhone(e.target.value)} 
                                className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-red-500 font-mono" 
                                placeholder="07xx..."
                            />
                            <button onClick={handleRegister} className="w-full mt-4 bg-green-600 hover:bg-green-500 py-3.5 rounded-xl font-bold text-white transition shadow-lg shadow-green-900/30 transform active:scale-95">Confirmă Participarea</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {showSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
                <div className="glass w-full max-w-2xl rounded-3xl p-8 bg-slate-900 border border-white/10 max-h-[90vh] overflow-y-auto shadow-2xl">
                    <h2 className="text-3xl font-bold mb-2 text-white">Profilul Tău</h2>
                    <p className="text-gray-400 mb-8 text-sm">Personalizează experiența GhibaPlus.</p>
                    
                    <div className="grid md:grid-cols-2 gap-6 mb-8">
                        <div>
                            <label className="text-xs text-red-400 font-bold ml-1 block mb-2">CLASA</label>
                            <select value={editClass} onChange={e => setEditClass(e.target.value)} className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-red-500 appearance-none">
                                <option value="">Alege Clasa</option>
                                {SCHOOL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-red-400 font-bold ml-1 block mb-2">TELEFON</label>
                            <input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-red-500" />
                        </div>
                    </div>

                    <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 border-b border-white/10 pb-2">Interese</h3>
                    <div className="space-y-6 mb-8">
                        {Object.entries(INTEREST_CATEGORIES).map(([cat, items]) => (
                            <div key={cat}>
                                <div className="text-xs text-gray-400 mb-2 font-bold">{cat}</div>
                                <div className="flex flex-wrap gap-2">
                                    {items.map(tag => (
                                        <button key={tag} onClick={() => toggleInterest(tag)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${user.interests?.includes(tag) ? "bg-red-600 border-red-500 text-white shadow-md shadow-red-900/30" : "border-white/10 text-gray-400 hover:border-white/30 hover:text-white bg-white/5"}`}>{tag}</button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-4 border-t border-white/10 pt-6">
                        <button onClick={saveSettings} className="bg-white text-black px-8 py-3 rounded-xl font-bold hover:bg-gray-200 transition shadow-lg transform hover:scale-105">Salvează Modificările</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}