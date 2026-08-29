"use client";

import { Logo } from "@/components/shared/logo";
import { useApp } from "@/lib/store";
import { Lock, FileText } from "lucide-react";

export function PublicFooter() {
  const navigate = useApp((s) => s.navigate);
  const language = useApp((s) => s.language);
  const isHindi = language === "hi";
  return (
    <footer className="mt-auto border-t border-white/15 bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
              {isHindi ? "सशस्त्र बलों और वर्दीधारी सेवा कर्मियों के लिए गोपनीय, AI-सहायता प्राप्त वेलबीइंग और प्रारंभिक सहायता प्लेटफॉर्म। यह पेशेवर देखभाल का विकल्प नहीं है।" : "A confidential, AI-assisted wellbeing and early-support platform for armed forces and uniformed-service personnel. Not a substitute for professional care."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/70">
              <span className="inline-flex items-center gap-1.5"><Logo size={18} /> {isHindi ? "सुरक्षित एन्क्रिप्शन" : "Encrypted at rest"}</span>
              <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> {isHindi ? "RBAC + ऑडिट लॉगिंग" : "RBAC + audit logging"}</span>
              <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {isHindi ? "सहमति दर्ज" : "Consent-tracked"}</span>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/80">{isHindi ? "प्लेटफॉर्म" : "Platform"}</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><button className="text-white/70 hover:text-white" onClick={() => navigate("about")}>{isHindi ? "हमारे बारे में" : "About"}</button></li>
              <li><button className="text-white/70 hover:text-white" onClick={() => navigate("how-it-works")}>{isHindi ? "यह कैसे काम करता है" : "How It Works"}</button></li>
              <li><button className="text-white/70 hover:text-white" onClick={() => navigate("resources")}>{isHindi ? "संसाधन" : "Resources"}</button></li>
              <li><button className="text-white/70 hover:text-white" onClick={() => navigate("support")}>{isHindi ? "सहायता" : "Support"}</button></li>
              <li><button className="text-white/70 hover:text-white" onClick={() => navigate("contact")}>{isHindi ? "संपर्क" : "Contact"}</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/80">{isHindi ? "खाता" : "Account"}</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><button className="text-white/70 hover:text-white" onClick={() => navigate("login")}>{isHindi ? "लॉगिन" : "Login"}</button></li>
              <li><button className="text-white/70 hover:text-white" onClick={() => navigate("register")}>{isHindi ? "खाता बनाएं" : "Create account"}</button></li>
              <li><button className="text-white/70 hover:text-white" onClick={() => navigate("privacy")}>{isHindi ? "गोपनीयता" : "Privacy"}</button></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-white/15 pt-6 text-xs text-white/60 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} CRPF MHS {isHindi ? "वेलबीइंग प्लेटफॉर्म। डेवलपमेंट बिल्ड, काल्पनिक डेटा।" : "Wellbeing Platform. Development build — fictional data."}</p>
          <p className="italic">{isHindi ? "यदि आप तत्काल खतरे में हैं, तो अपनी स्थानीय आपातकालीन सेवाओं से संपर्क करें।" : "If you are in immediate danger, contact your local emergency services."}</p>
        </div>
      </div>
      <div className="h-[6px] w-full bg-[linear-gradient(90deg,#FF9933_0,#FF9933_33.33%,#FFFFFF_33.33%,#FFFFFF_66.66%,#138808_66.66%,#138808_100%)]" aria-hidden="true" />
    </footer>
  );
}
