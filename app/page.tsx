"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "./lib/firebase"; 
import { doc, setDoc, getDoc, collection, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { SCHOOL_CLASSES } from "./lib/constants";

const TRANSLATIONS: any = {
  ro: { 
      portal: "Portalul Elevilor", emailPlace: "Nume.Prenume@ghibabirta.ro", phonePlace: "Telefon", classPlace: "Clasa", passPlace: "Parolă", confirmPlace: "Confirmă Parola", accept1: "Accept ", termsBtn: "Termenii și Condițiile", accept2: " de utilizare.", btnRegister: "Creează Contul", btnLogin: "Intră în Cont", switchLogin: "Ai deja cont? Autentifică-te.", switchRegister: "Nou aici? Solicită un cont.", errEmail: "Folosește emailul școlii (@ghibabirta.ro).", errClass: "Alege-ți clasa!", errTerms: "Trebuie să accepți Termenii și Condițiile.", errPassMatch: "Parolele nu coincid!", errPhone: "Numărul de telefon trebuie să aibă 10 cifre!", errWhitelist: "⛔ Cont neaprobat.", errCreds: "Parolă sau email incorect.", errInUse: "Acest cont a fost deja creat.", errTooMany: "🔒 Ai încercat de prea multe ori. Așteaptă 5 minute.", classWarning: "⚠️ Atenție: Clasa nu mai poate fi modificată ulterior!", tTitle: "📄 Termeni și Condiții", tBtn: "Am înțeles și Accept", 
      tc1: "1. Despre Platformă: Aplicația a fost dezvoltată inițial în cadrul unui proiect Erasmus+ desfășurat în Portugalia. Deși este o inițiativă independentă a elevilor și nu un canal administrativ oficial al liceului, aceasta servește ca un mediu sigur și modern pentru informarea școlară.", 
      tc2: "2. Securitatea Datelor: Siguranța datelor tale este prioritatea noastră. Toate informațiile introduse (nume, email, număr de telefon) sunt criptate și stocate securizat pe serverele Google Firebase. Nu distribuim datele către terți.", 
      tc3: "3. Utilizarea Datelor (GDPR): Datele sunt colectate exclusiv pentru funcționarea platformei (trimiterea de notificări legate de școală, organizarea de evenimente interne, și validarea identității de elev al școlii noastre).", 
      tc4: "4. Conduita Utilizatorului: Platforma promovează respectul reciproc. Orice formă de limbaj licențios, bullying, spam sau încercare de sabotaj informatic va atrage de la sine blocarea definitivă a contului.", 
      tc5: "5. Moderare: Administratorii platformei (Consiliul Elevilor / Echipajul Tehnic) își rezervă dreptul de a suspenda sau revoca accesul oricărui utilizator care încalcă prezentul regulament, fără notificare prealabilă.",
      forgotPass: "Ai uitat parola?", resetSent: "✅ Link-ul de resetare a fost trimis! Verifică-ți emailul (inclusiv folderul Spam).", enterEmailFirst: "Te rugăm să îți scrii emailul mai sus pentru a reseta parola."
  },
  en: { portal: "Student Portal", emailPlace: "Name.Surname@ghibabirta.ro", phonePlace: "Phone", classPlace: "Class", passPlace: "Password", confirmPlace: "Confirm Password", accept1: "I accept the ", termsBtn: "Terms and Conditions", accept2: ".", btnRegister: "Create Account", btnLogin: "Sign In", switchLogin: "Already have an account? Sign in.", switchRegister: "New here? Request an account.", errEmail: "Use school email.", errClass: "Choose class!", errTerms: "Accept Terms.", errPassMatch: "Passwords don't match!", errPhone: "10 digits required!", errWhitelist: "⛔ Account not approved.", errCreds: "Incorrect credentials.", errInUse: "Account exists.", errTooMany: "🔒 Too many attempts. Please wait 5 minutes.", classWarning: "⚠️ Warning: Class cannot be changed later!", tTitle: "📄 Terms and Conditions", tBtn: "I Accept", tc1: "1. Origin: App developed during an Erasmus+ project in Portugal.", tc2: "2. Unofficial: Not an official administrative tool.", tc3: "3. Data: Secured in Google Firebase.", tc4: "4. Conduct: No bullying or spam.", tc5: "5. Moderation: Access can be revoked.", forgotPass: "Forgot password?", resetSent: "✅ Reset link sent! Check your email (and Spam folder).", enterEmailFirst: "Please enter your email above to reset your password." },
  fr: { portal: "Portail Étudiant", emailPlace: "Nom.Prenom@ghibabirta.ro", phonePlace: "Téléphone", classPlace: "Classe", passPlace: "Mot de passe", confirmPlace: "Confirmer le mot de passe", accept1: "J'accepte les ", termsBtn: "Conditions", accept2: ".", btnRegister: "Créer un Compte", btnLogin: "Se Connecter", switchLogin: "Déjà un compte ? Connectez-vous.", switchRegister: "Nouveau ? Demandez un compte.", errEmail: "Email de l'école requis.", errClass: "Choisissez la classe!", errTerms: "Acceptez les conditions.", errPassMatch: "Mots de passe différents!", errPhone: "10 chiffres requis!", errWhitelist: "⛔ Non approuvé.", errCreds: "Erreur.", errInUse: "Compte existant.", errTooMany: "🔒 Trop de tentatives. Veuillez patienter 5 minutes.", classWarning: "⚠️ La classe ne peut plus être modifiée!", tTitle: "📄 Conditions", tBtn: "J'accepte", tc1: "1. Origine : Projet Erasmus+ au Portugal.", tc2: "2. Non officiel.", tc3: "3. Données : Sécurisées.", tc4: "4. Conduite : Pas de harcèlement.", tc5: "5. Modération : Accès révocable.", forgotPass: "Mot de passe oublié ?", resetSent: "✅ Lien envoyé ! Vérifiez vos emails (et Spam).", enterEmailFirst: "Veuillez entrer votre email ci-dessus." },
  de: { portal: "Schülerportal", emailPlace: "Name.Vorname@ghibabirta.ro", phonePlace: "Telefon", classPlace: "Klasse", passPlace: "Passwort", confirmPlace: "Passwort bestätigen", accept1: "Ich akzeptiere die ", termsBtn: "Bedingungen", accept2: ".", btnRegister: "Konto erstellen", btnLogin: "Anmelden", switchLogin: "Schon ein Konto?", switchRegister: "Neu hier?", errEmail: "Schul-E-Mail verwenden.", errClass: "Klasse wählen!", errTerms: "Bedingungen akzeptieren.", errPassMatch: "Passwörter falsch!", errPhone: "10 Ziffern!", errWhitelist: "⛔ Nicht genehmigt.", errCreds: "Falsch.", errInUse: "Konto existiert.", errTooMany: "🔒 Zu viele Versuche. Bitte warten Sie 5 Minuten.", classWarning: "⚠️ Klasse kann nicht geändert werden!", tTitle: "📄 Bedingungen", tBtn: "Akzeptieren", tc1: "1. Herkunft: Erasmus+ Projekt Portugal.", tc2: "2. Inoffiziell.", tc3: "3. Daten sicher.", tc4: "4. Kein Mobbing.", tc5: "5. Zugang kann entzogen werden.", forgotPass: "Passwort vergessen?", resetSent: "✅ Link gesendet! Überprüfen Sie Ihre E-Mails.", enterEmailFirst: "Bitte geben Sie oben Ihre E-Mail ein." },
  es: { portal: "Portal Estudiantil", emailPlace: "Nombre.Apellido@ghibabirta.ro", phonePlace: "Teléfono", classPlace: "Clase", passPlace: "Contraseña", confirmPlace: "Confirmar Contraseña", accept1: "Acepto los ", termsBtn: "Términos", accept2: ".", btnRegister: "Crear Cuenta", btnLogin: "Iniciar Sesión", switchLogin: "¿Ya tienes cuenta?", switchRegister: "¿Nuevo aquí?", errEmail: "Usa tu correo escolar.", errClass: "¡Elige tu clase!", errTerms: "Acepta los Términos.", errPassMatch: "¡No coinciden!", errPhone: "¡10 dígitos!", errWhitelist: "⛔ No aprobada.", errCreds: "Incorrecto.", errInUse: "Cuenta existe.", errTooMany: "🔒 Demasiados intentos. Por favor, espere 5 minutos.", classWarning: "⚠️ ¡La clase no se puede cambiar!", tTitle: "📄 Términos", tBtn: "Acepto", tc1: "1. Origen: Proyecto Erasmus+ en Portugal.", tc2: "2. No oficial.", tc3: "3. Datos seguros.", tc4: "4. Sin acoso.", tc5: "5. Moderación activa.", forgotPass: "¿Olvidaste tu contraseña?", resetSent: "✅ ¡Enlace enviado! Revisa tu correo (y Spam).", enterEmailFirst: "Introduce tu correo arriba para restablecer la contraseña." }
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [currentLang, setCurrentLang] = useState("ro"); 
  const [isRegistering, setIsRegistering] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState(""); // NOU: Mesaj de succes pentru resetare
  const router = useRouter();
  
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS["ro"];

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    const formattedEmail = email.toLowerCase().trim();
    if (!formattedEmail.endsWith("@ghibabirta.ro")) return setError(t.errEmail); 

    try {
      if (isRegistering) {
        if (!studentClass) return setError(t.errClass); 
        if (!acceptedTerms) return setError(t.errTerms); 
        if (password !== confirmPassword) return setError(t.errPassMatch); 
        if (phone.length !== 10) return setError(t.errPhone); 

        const whitelistSnap = await getDoc(doc(db, "whitelist", formattedEmail));
        if (!whitelistSnap.exists()) return setError(t.errWhitelist); 

        const result = await createUserWithEmailAndPassword(auth, formattedEmail, password);
        let displayName = formattedEmail.split("@")[0].split(".").map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(" ");
        
        await setDoc(doc(db, "users", result.user.uid), { 
          uid: result.user.uid, email: result.user.email, name: displayName, phone: phone, 
          class: studentClass, role: "student", interests: [], language: currentLang,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`, termsAcceptedAt: new Date().toISOString()
        });

        await addDoc(collection(db, "users", result.user.uid, "notifications"), {
          type: "welcome", sentAt: new Date().toISOString(), read: false
        });

      } else {
        await signInWithEmailAndPassword(auth, formattedEmail, password);
      }
      router.push("/dashboard");
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') setError(t.errCreds);
      else if (err.code === 'auth/email-already-in-use') setError(t.errInUse);
      else if (err.code === 'auth/too-many-requests') setError(t.errTooMany);
      else setError(err.message);
    }
  };

  // NOU: Funcția de resetare a parolei
  const handleResetPassword = async () => {
      setError("");
      setSuccessMsg("");
      const formattedEmail = email.toLowerCase().trim();
      if (!formattedEmail) return setError(t.enterEmailFirst);
      if (!formattedEmail.endsWith("@ghibabirta.ro")) return setError(t.errEmail);

      try {
          await sendPasswordResetEmail(auth, formattedEmail);
          setSuccessMsg(t.resetSent);
      } catch (err: any) {
          setError(err.code === 'auth/too-many-requests' ? t.errTooMany : err.message);
      }
  };

  const inputClass = "w-full p-4 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 transition-all font-bold backdrop-blur-md bg-white/10 border border-white/20 text-white placeholder-gray-300 hover:bg-white/20 shadow-inner";

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden font-sans bg-slate-950 selection:bg-red-500/30">
      <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse duration-[10000ms]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse duration-[8000ms]"></div>
      </div>

      <div className="absolute top-6 right-6 z-20">
          <select value={currentLang} onChange={(e) => setCurrentLang(e.target.value)} className="bg-slate-900/80 text-white border border-white/20 rounded-xl px-4 py-2 font-bold outline-none cursor-pointer backdrop-blur-xl shadow-lg hover:border-white/40 transition-colors">
              <option value="ro" className="text-black bg-white">🇷🇴 RO</option>
              <option value="en" className="text-black bg-white">🇬🇧 EN</option>
              <option value="fr" className="text-black bg-white">🇫🇷 FR</option>
              <option value="de" className="text-black bg-white">🇩🇪 DE</option>
              <option value="es" className="text-black bg-white">🇪🇸 ES</option>
          </select>
      </div>

      <div className="p-10 rounded-[2.5rem] max-w-md w-full z-10 mx-4 relative backdrop-blur-2xl border border-white/20 shadow-2xl bg-slate-900/40 my-8">
        <div className="flex flex-col items-center mb-8">
          <img src="/favicon.ico" alt="Logo" className="w-24 h-24 rounded-[2rem] mb-6 shadow-lg transform hover:scale-110 transition-transform duration-500 border border-white/20" />
          <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-md">Ghiba<span className="text-red-500">+</span></h1>
          <p className="text-gray-300 mt-2 font-black text-[10px] tracking-[0.2em] uppercase bg-white/10 px-4 py-1.5 rounded-full">{t.portal}</p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-4">
            <input type="email" placeholder={t.emailPlace} value={email} onChange={e => setEmail(e.target.value)} className={inputClass} required />
            
            {isRegistering && (
                <div className="animate-fade-in space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <input type="tel" placeholder={t.phonePlace} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} maxLength={10} className={inputClass} required />
                        <select value={studentClass} onChange={e => setStudentClass(e.target.value)} className={`${inputClass} appearance-none`} required>
                            <option value="" className="text-black bg-white">{t.classPlace}</option>
                            {SCHOOL_CLASSES.map(c => <option key={c} value={c} className="text-black bg-white">{c}</option>)}
                        </select>
                    </div>
                    <p className="text-[10px] text-red-400 font-bold ml-1 tracking-wide">{t.classWarning}</p>
                </div>
            )}
            
            <input type="password" placeholder={t.passPlace} value={password} onChange={e => setPassword(e.target.value)} className={inputClass} required />
            
            {!isRegistering && (
                <div className="flex justify-end">
                    <button type="button" onClick={handleResetPassword} className="text-xs font-bold text-gray-400 hover:text-white transition-colors">
                        {t.forgotPass}
                    </button>
                </div>
            )}

            {isRegistering && (
                <div className="animate-fade-in space-y-4">
                    <input type="password" placeholder={t.confirmPlace} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} required />
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-black/30 border border-white/10">
                        <input type="checkbox" id="terms" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="w-5 h-5 accent-red-500 cursor-pointer rounded-md shrink-0" />
                        <label htmlFor="terms" className="text-xs leading-relaxed text-gray-300 font-medium">
                            {t.accept1} <button type="button" onClick={() => setShowTerms(true)} className="text-red-400 font-bold hover:text-red-300 underline">{t.termsBtn}</button>{t.accept2}
                        </label>
                    </div>
                </div>
            )}
            
            <button className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl transition-all transform hover:-translate-y-1 mt-6 text-lg border border-red-500/50 shadow-lg shadow-red-500/20">
              {isRegistering ? t.btnRegister : t.btnLogin}
            </button>
        </form>

        <div className="mt-8 text-center pt-6">
            <button onClick={() => {setError(""); setSuccessMsg(""); setIsRegistering(!isRegistering)}} className="text-gray-400 hover:text-white text-sm font-bold transition-colors">
                {isRegistering ? t.switchLogin : t.switchRegister}
            </button>
        </div>
        {error && <div className="mt-4 bg-red-500/20 border border-red-500/50 p-4 rounded-2xl text-red-200 text-sm font-bold text-center animate-pulse">{error}</div>}
        {successMsg && <div className="mt-4 bg-green-500/20 border border-green-500/50 p-4 rounded-2xl text-green-200 text-sm font-bold text-center animate-fade-in">{successMsg}</div>}
      </div>

      {showTerms && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
            <div className="w-full max-w-3xl rounded-[2.5rem] p-8 sm:p-12 shadow-2xl border bg-slate-900 border-white/20 text-white relative overflow-hidden">
                <button onClick={() => setShowTerms(false)} className="absolute top-6 right-6 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 font-bold transition">✕</button>
                <h2 className="text-2xl sm:text-3xl font-black mb-8 flex items-center gap-3"><span className="text-red-500">📄</span> Termeni și Condiții</h2>
                <div className="overflow-y-auto max-h-[60vh] text-sm text-gray-300 space-y-6 pr-4 custom-scrollbar font-medium leading-relaxed">
                    <p><strong>{t.tc1.split(':')[0]}:</strong>{t.tc1.split(':')[1]}</p>
                    <p><strong>{t.tc2.split(':')[0]}:</strong>{t.tc2.split(':')[1]}</p>
                    <p><strong>{t.tc3.split(':')[0]}:</strong>{t.tc3.split(':')[1]}</p>
                    <p><strong>{t.tc4.split(':')[0]}:</strong>{t.tc4.split(':')[1]}</p>
                    <p><strong>{t.tc5.split(':')[0]}:</strong>{t.tc5.split(':')[1]}</p>
                </div>
                <button onClick={() => {setShowTerms(false); setAcceptedTerms(true);}} className="mt-8 bg-white text-black w-full py-4 rounded-2xl font-black text-lg hover:bg-gray-200 transition-colors shadow-xl">{t.tBtn}</button>
            </div>
        </div>
      )}
    </div>
  );
}