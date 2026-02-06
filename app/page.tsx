"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "./lib/firebase"; 
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // NOU: Câmpuri extra pentru înregistrare
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");

  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.endsWith("@ghibabirta.ro")) { setError("Acces permis doar cu email @ghibabirta.ro"); return; }

    try {
      if (isRegistering) {
        // VALIDĂRI NOI
        if (password !== confirmPassword) { setError("Parolele nu coincid!"); return; }
        if (phone.length < 10) { setError("Număr de telefon invalid!"); return; }

        // Verificare Whitelist
        const whitelistRef = doc(db, "whitelist", email.toLowerCase());
        const whitelistSnap = await getDoc(whitelistRef);
        if (!whitelistSnap.exists()) { setError("⛔ Email neaprobat. Cere accesul unui profesor."); return; }

        const result = await createUserWithEmailAndPassword(auth, email, password);
        
        let displayName = "Elev";
        try { displayName = email.split("@")[0].split(".").map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(" "); } catch(e){}
        
        // SALVĂM ȘI TELEFONUL LA ÎNCEPUT
        await setDoc(doc(db, "users", result.user.uid), { 
          email: result.user.email, 
          name: displayName, 
          phone: phone, // <--- Salvam telefonul
          class: "",    // Clasa o alege in popup
          role: "student", 
          interests: [], 
          onboardingCompleted: false 
        });

      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push("/dashboard");
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') setError("Date incorecte.");
      else if (err.code === 'auth/weak-password') setError("Parola trebuie să aibă minim 6 caractere.");
      else setError(err.message);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-900">
      
      {/* Anime Blobs */}
      <div className="blob bg-red-600 w-96 h-96 top-0 left-0 -translate-x-1/4 -translate-y-1/4 animate-blob-1"></div>
      <div className="blob bg-yellow-600 w-80 h-80 bottom-0 right-0 translate-x-1/4 translate-y-1/4 animate-blob-2"></div>
      <div className="blob bg-purple-600 w-72 h-72 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-blob-3"></div>

      <div className="glass p-8 rounded-3xl shadow-2xl max-w-md w-full z-10 mx-4 relative">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-yellow-400 tracking-tight">GhibaPlus</h1>
          <p className="text-gray-300 mt-1 font-medium text-xs tracking-[0.2em]">PORTALUL ELEVILOR</p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-4">
            <input type="email" placeholder="Email Școlar" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 bg-black/30 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500 text-white placeholder-gray-500" required />
            
            {/* CÂMPURI EXTRA DOAR LA REGISTER */}
            {isRegistering && (
                <>
                    <input type="tel" placeholder="Telefon (07xx...)" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-3 bg-black/30 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500 text-white placeholder-gray-500" required />
                </>
            )}

            <input type="password" placeholder="Parolă" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-black/30 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500 text-white placeholder-gray-500" required />
            
            {isRegistering && (
                <input type="password" placeholder="Confirmă Parola" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full p-3 bg-black/30 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500 text-white placeholder-gray-500" required />
            )}
            
            <button className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all transform active:scale-95">
              {isRegistering ? "Creează Cont" : "Intră în Cont"}
            </button>
        </form>

        <div className="mt-6 text-center">
            <button onClick={() => {setError(""); setIsRegistering(!isRegistering)}} className="text-gray-400 hover:text-white text-sm font-semibold transition-colors">
                {isRegistering ? "Ai deja cont? Autentifică-te" : "Nu ai cont? Înregistrează-te"}
            </button>
        </div>
        
        {error && <div className="mt-4 bg-red-500/20 border border-red-500/50 p-3 rounded-xl text-red-200 text-sm font-bold text-center animate-pulse">{error}</div>}
      </div>
    </div>
  );
}