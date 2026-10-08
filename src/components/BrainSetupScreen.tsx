import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  KeyRound,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  Trash2,
  X,
  Cpu,
  ShieldCheck,
  Download,
  Monitor,
  Mic,
} from "lucide-react";
import {
  BrainProviderId,
  FREE_AI_BRAIN_PROVIDERS,
  StoredBrainConfig,
  detectProviderFromKey,
  getProviderInfo,
} from "../services/brainConfigService";
import {
  usePWAInstall,
  downloadLaptopAutoStartScript,
} from "../utils/usePWAInstall";

interface BrainSetupScreenProps {
  existingConfig: StoredBrainConfig | null;
  isSettingsModal?: boolean;
  wakeWordEnabled: boolean;
  onToggleWakeWord: (enabled: boolean) => void;
  onActivateBrain: (providerId: BrainProviderId, apiKey: string) => void;
  onRemoveBrain?: () => void;
  onCloseSettings?: () => void;
}

type FlowStage = "welcome" | "welcome_anim" | "brain_input" | "activating";

export default function BrainSetupScreen({
  existingConfig,
  isSettingsModal = false,
  wakeWordEnabled,
  onToggleWakeWord,
  onActivateBrain,
  onRemoveBrain,
  onCloseSettings,
}: BrainSetupScreenProps) {
  const [stage, setStage] = useState<FlowStage>(
    isSettingsModal ? "brain_input" : "welcome",
  );
  const [selectedProvider, setSelectedProvider] = useState<BrainProviderId>(
    existingConfig?.providerId || "gemini",
  );
  const [apiKeyInput, setApiKeyInput] = useState<string>(
    existingConfig?.apiKey || "",
  );
  const [showKey, setShowKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bootProgress, setBootProgress] = useState(0);
  const [activationStep, setActivationStep] = useState(0);

  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Stage 2: Welcome Animation progression
  useEffect(() => {
    if (stage !== "welcome_anim") return;
    setBootProgress(0);
    const interval = setInterval(() => {
      setBootProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, 35);

    const timer = setTimeout(() => {
      setStage("brain_input");
    }, 1950);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [stage]);

  // Stage 4: Active Brain Connection Animation progression
  useEffect(() => {
    if (stage !== "activating") return;
    setActivationStep(0);
    const t1 = setTimeout(() => setActivationStep(1), 650);
    const t2 = setTimeout(() => setActivationStep(2), 1350);
    const t3 = setTimeout(() => {
      const cleanKey = apiKeyInput.trim();
      const finalProvider = detectProviderFromKey(cleanKey, selectedProvider);
      onActivateBrain(finalProvider, cleanKey);
    }, 2150);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [stage, apiKeyInput, selectedProvider, onActivateBrain]);

  const handleKeyChange = (val: string) => {
    setApiKeyInput(val);
    if (errorMsg) setErrorMsg(null);
    const autoDetected = detectProviderFromKey(val, selectedProvider);
    if (autoDetected !== selectedProvider) {
      setSelectedProvider(autoDetected);
    }
  };

  const handleConnectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = apiKeyInput.trim();
    if (trimmed.length < 10) {
      setErrorMsg("Please enter a valid Brain API Key to activate Muskan AI.");
      return;
    }
    setErrorMsg(null);
    setStage("activating");
  };

  const currentProviderInfo = getProviderInfo(selectedProvider);

  return (
    <div className="fixed inset-0 z-50 w-screen h-[100dvh] bg-[radial-gradient(ellipse_at_center,_#071928_0%,_#030a11_55%,_#010408_100%)] text-slate-100 flex items-center justify-center overflow-y-auto p-4 sm:p-6 select-none">
      {/* Subtle Holographic Grid Texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, rgba(34, 211, 238, 0.5) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <AnimatePresence mode="wait">
        {/* STAGE 1: WELCOME SCREEN */}
        {stage === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative z-10 flex flex-col items-center text-center max-w-lg w-full px-6 py-10"
          >
            {/* Animated Holographic Emblem */}
            <div className="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center mb-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0"
              >
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  <circle
                    cx="100"
                    cy="100"
                    r="94"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.2"
                    strokeDasharray="12 8 4 8"
                    opacity="0.5"
                  />
                </svg>
              </motion.div>

              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                className="absolute inset-4"
              >
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  <circle
                    cx="100"
                    cy="100"
                    r="88"
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="1.8"
                    strokeDasharray="50 35"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                </svg>
              </motion.div>

              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full border border-cyan-400/60 bg-[#04121e]/90 flex flex-col items-center justify-center shadow-[0_0_45px_rgba(6,182,212,0.45),inset_0_0_25px_rgba(6,182,212,0.35)]"
              >
                <span className="font-display font-bold tracking-[0.26em] text-lg sm:text-xl text-white pl-[0.26em] drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]">
                  MUSKAN
                </span>
                <span className="text-[9px] font-mono tracking-[0.22em] text-cyan-300/80 mt-1">
                  AI CORE
                </span>
              </motion.div>
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/25 text-cyan-300 text-[11px] font-mono tracking-[0.2em] uppercase mb-4">
              <Sparkles size={12} />
              <span>Welcome Khaleel Boss</span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-[0.16em] text-white uppercase mb-3">
              MUSKAN SUPER-INTELLIGENCE
            </h1>

            <p className="text-slate-300/75 text-sm sm:text-base leading-relaxed mb-8 max-w-md">
              Personal Executive AI Voice & Strategy Assistant with Hands-Free{" "}
              <span className="text-cyan-300 font-semibold">
                "Hello Muskan"
              </span>{" "}
              Voice Wake Activation.
            </p>

            <button
              type="button"
              onClick={() => setStage("welcome_anim")}
              className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 font-display font-bold text-base tracking-[0.18em] uppercase shadow-[0_0_35px_rgba(34,211,238,0.45)] transition-all duration-300 cursor-pointer"
            >
              <span>Initialize System</span>
              <ArrowRight
                size={18}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>
          </motion.div>
        )}

        {/* STAGE 2: WELCOME BOOT ANIMATION SCREEN */}
        {stage === "welcome_anim" && (
          <motion.div
            key="welcome_anim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.35 }}
            className="relative z-10 flex flex-col items-center justify-center text-center max-w-md w-full px-6"
          >
            <div className="relative w-48 h-48 flex items-center justify-center mb-8">
              <motion.div
                animate={{ rotate: 360, scale: [0.96, 1.04, 0.96] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-400/60"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                className="absolute inset-5 rounded-full border-2 border-cyan-300 border-t-transparent border-b-transparent"
              />
              <div className="flex flex-col items-center justify-center">
                <Cpu size={34} className="text-cyan-300 animate-pulse mb-2" />
                <span className="font-mono text-lg font-bold text-white tracking-widest">
                  {bootProgress}%
                </span>
              </div>
            </div>

            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-[0.22em] text-cyan-300 uppercase mb-2">
              BOOTING NEURAL INTERFACE
            </h2>
            <p className="text-xs font-mono tracking-[0.18em] text-slate-400 uppercase mb-5">
              {bootProgress < 45
                ? "LOADING HOLOGRAPHIC ENGINE..."
                : bootProgress < 80
                  ? "CALIBRATING 'HELLO MUSKAN' WAKE ENGINE..."
                  : "OPENING MULTI-BRAIN GATEWAY..."}
            </p>

            <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-cyan-300 shadow-[0_0_12px_#22d3ee]"
                style={{ width: `${bootProgress}%` }}
              />
            </div>
          </motion.div>
        )}

        {/* STAGE 3: BRAIN API KEY & ONE-TIME DESKTOP / WAKE-WORD SETUP */}
        {stage === "brain_input" && (
          <motion.div
            key="brain_input"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.97 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative z-10 w-full max-w-3xl bg-[#04101a]/90 border border-cyan-500/30 rounded-3xl p-5 sm:p-7 backdrop-blur-2xl shadow-[0_25px_80px_rgba(0,0,0,0.85)] my-auto"
          >
            {/* Top Glowing Accent Bar */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

            {/* Header Row with Custom Muskan Desktop App Icon */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3.5">
                <img
                  src="/icon.svg"
                  alt="Muskan AI Desktop Icon"
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border border-cyan-400/40 shadow-[0_0_20px_rgba(34,211,238,0.25)] shrink-0"
                />
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/25 text-cyan-300 text-[10px] font-mono tracking-[0.18em] uppercase mb-1">
                    <KeyRound size={11} />
                    <span>One-Time System & Brain Setup</span>
                  </div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold tracking-[0.12em] text-white uppercase">
                    Muskan AI — Brain & Desktop Setup
                  </h2>
                </div>
              </div>

              {isSettingsModal && onCloseSettings && (
                <button
                  type="button"
                  onClick={onCloseSettings}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Close Settings"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* One-Time Desktop App & Hands-Free "Hello Muskan" Automation Bar */}
            <div className="mb-5 p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-400/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-cyan-400/15 border border-cyan-400/30 text-cyan-300 shrink-0 mt-0.5">
                  <Mic size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-sm tracking-wider text-white uppercase">
                      "Hello Muskan" Voice Wake & Desktop App
                    </span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 uppercase">
                      {wakeWordEnabled ? "Wake Active" : "Paused"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300/75 leading-snug mt-0.5">
                    Say <strong>"Hello Muskan"</strong> anytime to activate
                    hands-free without clicking. Use the buttons on the right
                    for 1-time Desktop App & Laptop Startup installation.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => onToggleWakeWord(!wakeWordEnabled)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-mono uppercase tracking-wider border transition-colors cursor-pointer ${
                    wakeWordEnabled
                      ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-200"
                      : "bg-white/5 border-white/15 text-slate-300"
                  }`}
                >
                  {wakeWordEnabled ? "Wake: ON" : "Wake: OFF"}
                </button>

                {!isInstalled && isInstallable && (
                  <button
                    type="button"
                    onClick={install}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[11px] font-bold tracking-wider uppercase transition-colors cursor-pointer"
                  >
                    <Monitor size={13} />
                    <span>Install Desktop App</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={downloadLaptopAutoStartScript}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-cyan-400/20 border border-cyan-400/30 text-cyan-200 text-[11px] font-mono transition-colors cursor-pointer"
                  title="Download 1-Time Windows Laptop Startup Auto-Wake Installer (.bat)"
                >
                  <Download size={13} />
                  <span>1-Time Laptop Auto-Start</span>
                </button>
              </div>
            </div>

            {/* 5 Free AI Providers Grid with Official Links */}
            <div className="mb-5">
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-cyan-300/80 mb-2.5">
                1. Choose AI Brain & Get Free API Key (5 Free Providers):
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {FREE_AI_BRAIN_PROVIDERS.map((provider) => {
                  const isSelected = selectedProvider === provider.id;
                  return (
                    <div
                      key={provider.id}
                      onClick={() => setSelectedProvider(provider.id)}
                      className={`group relative rounded-2xl p-3 border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-cyan-500/15 border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.2)]"
                          : "bg-white/[0.03] border-white/10 hover:border-cyan-400/40 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-display font-bold text-sm tracking-wider text-white">
                            {provider.shortName}
                          </span>
                          <span
                            className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                              isSelected
                                ? "bg-cyan-400/20 border-cyan-300/50 text-cyan-200"
                                : "bg-white/5 border-white/10 text-slate-300"
                            }`}
                          >
                            {provider.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300/70 leading-snug mb-2.5">
                          {provider.description}
                        </p>
                      </div>

                      <a
                        href={provider.apiKeyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#030b12]/80 hover:bg-cyan-400/20 border border-cyan-400/25 hover:border-cyan-300 text-cyan-300 text-[11px] font-mono transition-colors"
                      >
                        <span className="truncate">Get Free API Key</span>
                        <ExternalLink size={12} className="shrink-0" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Brain API Key Input Form */}
            <form onSubmit={handleConnectSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-mono uppercase tracking-[0.18em] text-cyan-300/90">
                    2. Enter Brain API Key ({currentProviderInfo.name}):
                  </label>
                  <a
                    href={currentProviderInfo.apiKeyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
                  >
                    <span>Open {currentProviderInfo.shortName} Key Portal</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                <div className="relative flex items-center">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKeyInput}
                    onChange={(e) => handleKeyChange(e.target.value)}
                    placeholder={`Paste your ${currentProviderInfo.shortName} API Key (${currentProviderInfo.placeholder})`}
                    className="w-full bg-[#02080e] border border-cyan-500/35 focus:border-cyan-300 rounded-2xl px-4 py-3 pr-12 text-sm text-white placeholder:text-slate-500 outline-none font-mono transition-colors select-text"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((prev) => !prev)}
                    className="absolute right-3.5 p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={showKey ? "Hide API Key" : "Show API Key"}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {errorMsg && (
                  <p className="text-xs text-red-400 mt-2 font-medium">
                    {errorMsg}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {existingConfig && onRemoveBrain ? (
                  <button
                    type="button"
                    onClick={onRemoveBrain}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/35 text-red-300 text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} />
                    <span>Remove Saved Key</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <ShieldCheck size={15} className="text-emerald-400" />
                    <span>
                      One-time setup — stays permanently connected & ready for
                      "Hello Muskan".
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 font-display font-bold text-sm sm:text-base tracking-[0.16em] uppercase shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all cursor-pointer ml-auto"
                >
                  <Sparkles size={17} />
                  <span>
                    {existingConfig
                      ? "Update & Activate Brain"
                      : "Connect Brain & Activate"}
                  </span>
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* STAGE 4: ACTIVE BRAIN SYNCHRONIZATION ANIMATION */}
        {stage === "activating" && (
          <motion.div
            key="activating"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.08 }}
            transition={{ duration: 0.4 }}
            className="relative z-10 flex flex-col items-center justify-center text-center max-w-md w-full px-6"
          >
            <div className="relative w-52 h-52 flex items-center justify-center mb-8">
              <motion.div
                animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-emerald-400/15 blur-2xl"
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-400/70"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                className="absolute inset-5 rounded-full border-2 border-cyan-300 border-l-transparent border-r-transparent"
              />
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="relative w-28 h-28 rounded-full bg-[#041821] border border-emerald-400/80 flex flex-col items-center justify-center shadow-[0_0_45px_rgba(52,211,153,0.5)]"
              >
                <CheckCircle2 size={38} className="text-emerald-400 mb-1" />
                <span className="text-[10px] font-mono tracking-[0.2em] text-emerald-300 uppercase">
                  ACTIVE
                </span>
              </motion.div>
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-[0.2em] text-white uppercase mb-2">
              {activationStep === 0
                ? "VERIFYING BRAIN KEY..."
                : activationStep === 1
                  ? `LINKING ${currentProviderInfo.shortName.toUpperCase()}...`
                  : "MUSKAN AI ACTIVATED"}
            </h2>

            <p className="text-xs sm:text-sm font-mono tracking-[0.16em] text-emerald-300/90 uppercase">
              {activationStep < 2
                ? "ARMING 'HELLO MUSKAN' WAKE-WORD DETECTOR..."
                : "ALL SYSTEMS ONLINE — SAY 'HELLO MUSKAN' ANYTIME"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
