"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Lock,
  ScrollText,
  FileCheck2,
  HeartPulse,
  BookHeartIcon,
  MessageCircleHeart,
  Mic,
  LifeBuoy,
  DatabaseZap,
  ArrowRight,
  Phone,
  ListChecks,
  ChevronRight,
  BookHeart,
} from "lucide-react";
import { useApp } from "@/lib/store";
import type { View } from "@/lib/store";
import { APP_TAGLINE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const trustBadges = [
  { icon: Lock, label: { en: "Encrypted", hi: "एन्क्रिप्टेड" } },
  { icon: ShieldCheck, label: { en: "RBAC", hi: "RBAC" } },
  { icon: ScrollText, label: { en: "Audit-logged", hi: "ऑडिट लॉग" } },
  { icon: FileCheck2, label: { en: "Consent-tracked", hi: "सहमति दर्ज" } },
];

const features = [
  {
    icon: HeartPulse,
    view: "assessment" as View,
    action: { en: "Start a check-in", hi: "चेक-इन शुरू करें" },
    title: { en: "Daily Check-ins", hi: "दैनिक चेक-इन" },
    description: { en: "A 60-second wellbeing pulse that tracks patterns over time without disrupting your day.", hi: "60 सेकंड का वेलबीइंग चेक-इन, जो आपके दिन में बाधा डाले बिना समय के साथ पैटर्न दर्ज करता है।" },
  },
  {
    icon: BookHeart,
    view: "daily-log" as View,
    action: { en: "Open daily journal", hi: "दैनिक जर्नल खोलें" },
    title: { en: "Daily Journal", hi: "दैनिक जर्नल" },
    description: { en: "A private space to reflect, with optional AI-assisted summaries of how your week has felt.", hi: "अपने विचारों के लिए निजी स्थान, जिसमें आपके सप्ताह के अनुभवों का वैकल्पिक AI-सहायता प्राप्त सारांश है।" },
  },
  {
    icon: MessageCircleHeart,
    view: "ai-companion" as View,
    action: { en: "Meet the AI companion", hi: "AI साथी से जुड़ें" },
    title: { en: "AI Companion", hi: "AI साथी" },
    description: { en: "A grounded, non-diagnostic AI companion for low-intensity support between check-ins.", hi: "चेक-इन के बीच हल्के समर्थन के लिए एक गैर-नैदानिक AI साथी।" },
  },
  {
    icon: Mic,
    view: "voice-journal" as View,
    action: { en: "Start voice journal", hi: "वॉइस जर्नल शुरू करें" },
    title: { en: "Voice Journaling", hi: "वॉइस जर्नलिंग" },
    description: { en: "Speak your thoughts when writing feels like too much. Auto-transcribed, always private.", hi: "जब लिखना कठिन लगे तो अपने विचार बोलें। स्वचालित ट्रांसक्रिप्शन और हमेशा निजी।" },
  },
  {
    icon: LifeBuoy,
    view: "support" as View,
    action: { en: "Request support", hi: "सहायता का अनुरोध करें" },
    title: { en: "Professional Support", hi: "पेशेवर सहायता" },
    description: { en: "Discreet requests for support that route to your unit wellbeing officer or clinician.", hi: "सहायता के गोपनीय अनुरोध आपके यूनिट वेलबीइंग अधिकारी या चिकित्सक तक पहुंचते हैं।" },
  },
  {
    icon: DatabaseZap,
    view: "privacy" as View,
    action: { en: "See privacy details", hi: "गोपनीयता विवरण देखें" },
    title: { en: "Secure Data Handling", hi: "सुरक्षित डेटा प्रबंधन" },
    description: { en: "Field-level encryption, role-based access, and audit logs on every sensitive action.", hi: "फील्ड-स्तरीय एन्क्रिप्शन, भूमिका-आधारित पहुंच और हर संवेदनशील कार्रवाई का ऑडिट लॉग।" },
  },
];

const moodReadings = [72, 78, 75, 82, 79, 86, 84];

const trustCards = [
  { icon: Lock, title: { en: "Encrypted at rest", hi: "संग्रहित डेटा एन्क्रिप्टेड" }, body: { en: "Field-level protection for sensitive content.", hi: "संवेदनशील सामग्री के लिए फ़ील्ड-स्तरीय सुरक्षा।" }, detail: { en: "Sensitive wellbeing information is protected before it is stored, limiting exposure even if a record is accessed improperly.", hi: "संवेदनशील वेलबीइंग जानकारी संग्रहीत होने से पहले सुरक्षित की जाती है, जिससे रिकॉर्ड के अनुचित रूप से देखे जाने पर भी जोखिम सीमित रहता है।" } },
  { icon: ShieldCheck, title: { en: "Role-based access", hi: "भूमिका-आधारित पहुंच" }, body: { en: "Only authorised roles see what they need to.", hi: "केवल अधिकृत भूमिकाएं आवश्यक जानकारी देखती हैं।" }, detail: { en: "Access is limited by role and responsibility, so people only see the records required for their work.", hi: "पहुंच भूमिका और जिम्मेदारी के आधार पर सीमित है, इसलिए लोग अपने काम के लिए आवश्यक रिकॉर्ड ही देखते हैं।" } },
  { icon: ScrollText, title: { en: "Audit logging", hi: "ऑडिट लॉगिंग" }, body: { en: "Every sensitive action is recorded.", hi: "हर संवेदनशील कार्रवाई दर्ज की जाती है।" }, detail: { en: "Important access and account actions are recorded with timestamps to support accountability and review.", hi: "जवाबदेही और समीक्षा के लिए महत्वपूर्ण पहुंच और खाता कार्रवाइयां समय सहित दर्ज की जाती हैं।" } },
  { icon: FileCheck2, title: { en: "Consent-tracked", hi: "सहमति दर्ज" }, body: { en: "Granular consent with version history.", hi: "संस्करण इतिहास के साथ विस्तृत सहमति।" }, detail: { en: "Your choices are recorded by purpose and version, making it clear what you agreed to and when.", hi: "आपकी पसंद उद्देश्य और संस्करण के अनुसार दर्ज की जाती है, जिससे यह स्पष्ट रहता है कि आपने किस बात पर और कब सहमति दी।" } },
];

const revealViewport = { once: true, amount: 0.2 };
const revealEase = [0.22, 1, 0.36, 1] as const;

export default function LandingView() {
  const navigate = useApp((s) => s.navigate);
  const language = useApp((s) => s.language);
  const isHindi = language === "hi";
  const [selectedFeature, setSelectedFeature] = useState(0);
  const [expandedTrustCard, setExpandedTrustCard] = useState<number | null>(null);
  const latestMood = moodReadings[moodReadings.length - 1];
  const selectedMood = latestMood;
  const weeklyChange = latestMood - moodReadings[0];
  const weeklyMin = Math.min(...moodReadings);
  const weeklyMax = Math.max(...moodReadings);
  const moodPoints = moodReadings.map((value, index) => ({
    x: 28 + index * (644 / (moodReadings.length - 1)),
    y: 150 - ((value - 60) / 40) * 120,
  }));
  const moodPolyline = moodPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const moodArea = `${moodPolyline} 672,180 28,180`;

  return (
    <div className="landing-type bg-background text-foreground">
      {/* ---------------------------------------------------------------- HERO */}
      <section className="relative isolate overflow-hidden bg-[#1d256f]">
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage:
              "linear-gradient(rgba(29, 37, 111, 0.84), rgba(29, 37, 111, 0.84)), url('/bannerphoto.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
          aria-hidden="true"
        />
        <div className="hero-grid absolute inset-0 -z-10 h-full w-full opacity-40" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-48 sm:px-6 sm:pb-24 sm:pt-52 lg:px-8 lg:pb-28 lg:pt-56">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl lg:text-6xl xl:text-7xl">
                {isHindi ? "महत्वपूर्ण पलों के लिए शांत सहायता।" : "Calm support for the moments that matter."}
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-200 sm:text-lg">
                {isHindi ? "निजी दैनिक चेक-इन, जर्नलिंग, बीच के पलों के लिए AI-सहायता प्राप्त साथी और जरूरत पड़ने पर गोपनीय मानवीय सहायता।" : `${APP_TAGLINE} Private daily check-ins, journaling, an AI-assisted companion for in-between moments, and discreet human support when you need it.`}
              </p>

              <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row">
                <Button size="lg" onClick={() => navigate("register")} className="h-12 w-full min-w-44 justify-center rounded-none border-l-2 border-[#d8b36a] bg-[#f6f2e9] px-6 text-base font-semibold text-[#172638] hover:bg-[#e8e3d8] sm:w-auto">
                  {isHindi ? "शुरू करें" : "Get Started"} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("how-it-works")}
                  className="h-12 w-full min-w-44 justify-center rounded-none border border-[#172638] bg-[#172638] px-6 text-base font-semibold text-[#f6f2e9] hover:bg-[#263c52] sm:w-auto"
                >
                  {isHindi ? "यह कैसे काम करता है" : "How It Works"}
                </Button>
              </div>

            </div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="relative mx-auto w-full max-w-xl"
            >
              <div className="absolute -inset-3 rounded-2xl border border-white/20" aria-hidden="true" />
              <div className="landing-data-font relative overflow-hidden bg-[#e8e3d8]/95 p-3 shadow-[7px_7px_0_rgba(23,38,56,0.22)] sm:p-5">
                <div className="flex items-center justify-between border-b border-[#aeb9ba] bg-[#d9d4c9] px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#91a0a5] bg-[#eee9df] text-[#172638]">
                      <HeartPulse className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#53606a]">{isHindi ? "आज" : "Today"}</p>
                        <p className="text-sm font-semibold text-[#172638]">{isHindi ? "वेलबीइंग पल्स" : "Wellbeing pulse"}</p>
                    </div>
                  </div>
                  <div>
                    <span className="border-y-2 border-[#35604e] bg-[#d9e0dc] px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#35604e]">
                      {isHindi ? "स्थिर" : "Stable"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 border border-[#7e8b91] bg-[#f6f2e9] p-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#53606a]">{isHindi ? "मूड ट्रेंड" : "Mood trend"}</p>
                      <p className="mt-2 font-mono text-5xl font-semibold tracking-[-0.08em] text-[#172638]">{selectedMood}%</p>
                    </div>
                      <div className="rounded-full border border-[#91a99b] bg-[#d9e0dc] px-2.5 py-1 font-mono text-xs font-medium text-[#35604e]">
                      {isHindi ? `इस सप्ताह +${weeklyChange}%` : `+${weeklyChange}% this week`}
                    </div>
                  </div>

                  <div className="relative mt-5 h-36 overflow-hidden border border-[#c1c8c7] bg-[#fbf8f1]" aria-label={isHindi ? "साप्ताहिक मूड ट्रेंड" : "Weekly mood trend"} role="img">
                    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_24%,#c1c8c755_25%,transparent_26%,transparent_49%,#c1c8c755_50%,transparent_51%,transparent_74%,#c1c8c755_75%,transparent_76%)]" />
                    <svg viewBox="0 0 700 180" className="relative h-full w-full" preserveAspectRatio="none" aria-label={isHindi ? "साप्ताहिक मूड ट्रेंड" : "Weekly mood trend"} role="img">
                      <polyline points={moodPolyline} fill="none" stroke="#536b83" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points={moodArea} fill="#536b83" fillOpacity="0.12" stroke="none" />
                      {moodPoints.map((point, index) => (
                        <circle
                          key={`${point.x}-${point.y}`}
                          cx={point.x}
                          cy={point.y}
                          r="6"
                          fill="#f6f2e9"
                          stroke="#536b83"
                          strokeWidth="4"
                          aria-label={`${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}: ${moodReadings[index]}%`}
                        />
                      ))}
                    </svg>
                  </div>
                  <div className="mt-2 flex justify-between px-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#53606a]">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}
                  </div>
                  <div className="mt-4 grid grid-cols-3 border-t border-[#c1c8c7] pt-3 text-[10px] uppercase tracking-[0.12em] text-[#53606a]">
                    <span><strong className="block font-mono text-sm text-[#172638]">07</strong>{isHindi ? "अवलोकन" : "Observations"}</span>
                    <span><strong className="block font-mono text-sm text-[#172638]">{selectedMood}%</strong>{isHindi ? "चयनित" : "Selected"}</span>
                    <span><strong className="block font-mono text-sm text-[#172638]">{weeklyMin}–{weeklyMax}</strong>{isHindi ? "साप्ताहिक सीमा" : "Weekly range"}</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-[#aeb9ba] bg-[#d9d4c9] p-3">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#53606a]">{isHindi ? "चेक-इन" : "Check-in"}</p>
                    <p className="mt-2 text-lg font-semibold text-[#172638]">{isHindi ? "3/4 पूर्ण" : "3/4 complete"}</p>
                    <p className="mt-1 text-xs text-[#53606a]">{isHindi ? "इस सप्ताह आपकी लय स्थिर है।" : "Your rhythm is steady this week."}</p>
                  </div>
                  <div className="rounded-lg border border-[#aeb9ba] bg-[#d9d4c9] p-3">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#53606a]">{isHindi ? "दैनिक लॉग" : "Daily log"}</p>
                    <p className="mt-2 text-lg font-semibold text-[#172638]">{isHindi ? "1 शेष" : "1 remaining"}</p>
                    <p className="mt-1 text-xs text-[#53606a]">{isHindi ? "आज का प्रतिबिंब अभी बाकी है।" : "Today's reflection is still remaining."}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- FEATURES INDEX */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={revealViewport}
        transition={{ duration: 0.8, ease: revealEase }}
        className="mb-8 border-y-8 border-background border-t-[#172638] bg-[#1d256f] text-[#f6f2e9]"
      >
        <div className="mx-auto max-w-7xl px-0 py-8 sm:px-4 lg:px-8 lg:py-16">
          <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:gap-12 lg:gap-20">
            <div className="px-4 sm:px-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d8b36a]">
              {isHindi ? "आपको क्या मिलता है" : "What you get"}
            </p>
            <h2 className="landing-serif mt-3 text-4xl font-medium leading-tight tracking-[-0.04em] text-[#f6f2e9] sm:text-5xl">
              {isHindi ? "एक प्लेटफॉर्म, अपना ख्याल रखने के छह तरीके" : "One platform, six ways to look after yourself"}
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-[#e1e5e5]/75 sm:text-base">
              {isHindi ? "गोपनीय, निजी और सेवा जीवन की वास्तविकताओं के लिए बनाया गया, कोई सामान्य वेलनेस ऐप नहीं।" : "Discreet, private, and built for the realities of service life — not a consumer wellness app."}
            </p>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
              className="calm-scroll mt-10 max-h-[380px] overflow-y-auto border-t border-[#d9e0dc]/35 pr-2"
            >
              {features.map((f, i) => (
                <motion.button
                  key={f.title.en}
                  type="button"
                  onClick={() => setSelectedFeature(i)}
                  variants={{
                    hidden: { opacity: 0, x: -18 },
                    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
                  }}
                  className={`flex w-full items-center gap-4 border-b border-[#d9e0dc]/35 py-4 text-left transition-colors ${selectedFeature === i ? "border-l-2 border-[#d8b36a] bg-[#172638]/65 px-3 text-[#f6f2e9]" : "text-[#e1e5e5]/80 hover:bg-[#405a71] hover:text-[#f6f2e9]"}`}
                >
                  <span className="flex-1 text-base font-semibold">{f.title[language]}</span>
                  <ChevronRight className={`h-4 w-4 transition-transform ${selectedFeature === i ? "translate-x-1 text-[#d8b36a]" : ""}`} />
                </motion.button>
              ))}
            </motion.div>
            </div>

            <motion.div
              key={selectedFeature}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="relative min-h-[390px] overflow-hidden border border-[#d9e0dc] bg-[#e8e3d8] p-7 text-[#172638] sm:p-10"
            >
              <div className="absolute right-0 top-0 h-28 w-28 border-b border-l border-border/70 bg-[#e8e3d8]" aria-hidden="true" />
              <div className="relative flex h-full flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-primary">0{selectedFeature + 1} / 06</span>
                    {(() => { const FeatureIcon = features[selectedFeature].icon; return (
                      <span className="inline-flex h-12 w-12 items-center justify-center border border-primary/35 bg-primary/5 text-primary">
                        <FeatureIcon className="h-6 w-6" strokeWidth={1.8} />
                      </span>
                    ); })()}
                  </div>
                  <h3 className="landing-serif mt-20 max-w-lg text-4xl font-medium leading-tight tracking-[-0.04em] text-foreground sm:text-5xl">
                    {features[selectedFeature].title[language]}
                  </h3>
                  <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                    {features[selectedFeature].description[language]}
                  </p>
                </div>
                <div className="mt-12 flex items-end justify-between border-t border-border/70 pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <span>{isHindi ? "निजी सेवा" : "Private service"}</span>
                  <span>{isHindi ? "सक्रिय" : "Available now"}</span>
                </div>
                <Button
                  type="button"
                  onClick={() => navigate(features[selectedFeature].view)}
                  className="mt-5 w-full justify-between rounded-none bg-[#172638] text-[#f6f2e9] hover:bg-[#263c52]"
                >
                  {features[selectedFeature].action[language]}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* -------------------------------------------------- NEED IMMEDIATE HELP */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={revealViewport}
        transition={{ duration: 0.8, ease: revealEase }}
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <div className="overflow-hidden border-y border-red-200 border-l-4 border-l-red-700 bg-red-50/45 dark:border-red-900/40 dark:border-l-red-500 dark:bg-red-950/15">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:p-10">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight text-red-900 dark:text-red-200 sm:text-2xl">
                  Need immediate help?
                </h2>
              </div>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-red-800/90 dark:text-red-100/80">
                If you are in crisis or in immediate danger, please contact your
                local emergency services. CRPF MHS is not an emergency service —
                but we can help you reach the right people within your unit and
                chain of care.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={() => navigate("support")}
                  className="rounded-none bg-red-700 text-white hover:bg-red-800"
                >
                  <LifeBuoy className="mr-1.5 h-4 w-4" />
                  Contact Support
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("support", { focus: "emergency" })}
                  className="rounded-none border-red-300 bg-transparent text-red-900 hover:bg-red-100 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40"
                >
                  <Phone className="mr-1.5 h-4 w-4" />
                  Emergency Assistance
                </Button>
              </div>
            </div>

            <div className="border-l border-red-300 pl-5 dark:border-red-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">
                If you are in immediate danger
              </p>
              <p className="mt-2 text-sm text-red-900 dark:text-red-100">
                Use your local emergency number or go to the nearest emergency
                department. If you are with someone who is at immediate risk,
                do not leave them alone.
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* --------------------------------------------------------- PRIVACY/TRUST */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={revealViewport}
        transition={{ duration: 0.8, ease: revealEase }}
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {isHindi ? "गोपनीयता और विश्वास" : "Privacy & trust"}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {isHindi ? "न्यूनतम अधिकार, स्पष्ट सहमति, पूर्ण ऑडिट ट्रेल" : "Least privilege, explicit consent, full audit trail"}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {isHindi
                ? "CRPF MHS ऐसे वातावरण के लिए बनाया गया है जहां विश्वास अनिवार्य है। आपका वेलबीइंग डेटा फ़ील्ड-स्तरीय सुरक्षा के साथ एन्क्रिप्टेड रहता है, पहुंच केवल आवश्यकता के आधार पर दी जाती है और हर संवेदनशील कार्रवाई एक अपरिवर्तनीय ऑडिट लॉग में दर्ज होती है। आप तय करते हैं कि किसके लिए सहमति देनी है और उसे वापस भी ले सकते हैं।"
                : "CRPF MHS is built for environments where trust is non-negotiable. Your wellbeing data is encrypted at rest with field-level protection, access is granted only on a need-to-know basis, and every sensitive action is written to an immutable audit log. You decide what you consent to — and you can withdraw it."}
            </p>
            <div className="mt-6">
              <Button variant="link" onClick={() => navigate("privacy")} className="group px-0">
                {isHindi ? "पूरी गोपनीयता नीति पढ़ें" : "Read the full privacy policy"} <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-1 group-focus-visible:translate-x-1" />
              </Button>
            </div>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
            className="grid gap-3 sm:grid-cols-2"
          >
            {trustCards.map((p, index) => (
              <motion.div
                key={p.title.en}
                layout
                variants={{
                  hidden: { opacity: 0, height: 72, y: 16 },
                  visible: {
                    opacity: 1,
                    height: "auto",
                    y: 0,
                    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
                  },
                }}
                className="overflow-hidden"
              >
              <Card className="gap-0 py-0 transition-shadow duration-300 hover:shadow-md">
                <CardContent className="p-0">
                  <motion.button
                    type="button"
                    aria-expanded={expandedTrustCard === index}
                    onClick={() => setExpandedTrustCard(expandedTrustCard === index ? null : index)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.45, delay: 0.18, ease: "easeOut" }}
                    className="flex w-full flex-col gap-2 p-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <p.icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-foreground">{p.title[language]}</span>
                    <span className="text-xs leading-relaxed text-muted-foreground">{p.body[language]}</span>
                    {expandedTrustCard === index && (
                      <span className="border-t border-border/70 pt-3 text-xs leading-relaxed text-foreground/75">
                        {p.detail[language]}
                      </span>
                    )}
                  </motion.button>
                </CardContent>
              </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* ----------------------------------------------------------- FINAL CTA */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={revealViewport}
        transition={{ duration: 0.8, ease: revealEase }}
        className="border-t border-border/60 bg-primary text-primary-foreground"
      >
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-9">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-2xl">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#d8b36a]">
                {isHindi ? "अगला कदम" : "The next step"}
              </p>
              <h2 className="landing-serif text-3xl font-medium leading-tight tracking-[-0.03em] sm:text-4xl">
                {isHindi ? "वेलबीइंग शक्ति का संकेत है।" : "Wellbeing is a sign of strength."}
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-primary-foreground/80 sm:text-base">
                {isHindi ? "आज एक निजी चेक-इन शुरू करें। आपका डेटा आपका ही रहता है।" : "Start a private check-in today. Your data stays yours."}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:mr-12 lg:flex-col lg:items-start">
              <Button
                size="lg"
                variant="secondary"
                onClick={() => navigate("register")}
                className="group min-w-44 justify-between"
              >
                {isHindi ? "शुरू करें" : "Get Started"}
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                  className="ml-3 inline-flex"
                >
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-1" />
                </motion.span>
              </Button>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
