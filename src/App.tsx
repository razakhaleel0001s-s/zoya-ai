import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  MicOff,
  Loader2,
  Volume2,
  VolumeX,
  Keyboard,
  Send,
  Trash2,
  Globe,
  FileText,
  Settings,
  Monitor,
  Radio,
} from "lucide-react";
import {
  getMuskanResponse,
  getMuskanAudio,
  resetMuskanSession,
  markSessionGreeted,
  detectMasterPromptRequest,
  generateMasterPromptForNotepad,
  syncDailyIntelligenceBriefing,
} from "./services/geminiService";
import {
  processCommand,
  openTrackedTab,
  closeTrackedTab,
  closeAllTrackedTabs,
  triggerOsProtocol,
} from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import {
  ChatMessage,
  loadChatHistory,
  saveChatHistory,
  appendOrMergeMessage,
  clearAllBrowserMemory,
} from "./services/memoryService";
import {
  BrainProviderId,
  StoredBrainConfig,
  loadBrainConfig,
  saveBrainConfig,
  clearBrainConfig,
  getProviderInfo,
} from "./services/brainConfigService";
import {
  loadWakeWordPreference,
  saveWakeWordPreference,
  isWakeWordMatch,
  playWakeChime,
} from "./services/wakeWordService";
import { usePWAInstall } from "./utils/usePWAInstall";
import Visualizer from "./components/Visualizer";
import PermissionModal from "./components/PermissionModal";
import PromptNotepad from "./components/PromptNotepad";
import BrainSetupScreen from "./components/BrainSetupScreen";
import {
  playPCM,
  stopCurrentAudio,
  speakBrowserFallback,
} from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";

type AppState = "idle" | "listening" | "processing" | "speaking";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  // Persistent Brain API Key configuration
  const [brainConfig, setBrainConfig] = useState<StoredBrainConfig | null>(() =>
    loadBrainConfig(),
  );
  const [showBrainSettings, setShowBrainSettings] = useState(false);

  // Hands-free "Hello Muskan" wake-word state (enabled by default after 1-time setup)
  const [wakeWordEnabled, setWakeWordEnabled] = useState<boolean>(() =>
    loadWakeWordPreference(),
  );
  const [isWakeListening, setIsWakeListening] = useState(false);

  const handleToggleWakeWord = useCallback((enabled: boolean) => {
    setWakeWordEnabled(enabled);
    saveWakeWordPreference(enabled);
  }, []);

  // PWA / Desktop App Install hook
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Brief cinematic entrance animation when opening with an already-saved Brain key
  const [isInitialEntrance, setIsInitialEntrance] = useState<boolean>(() =>
    Boolean(loadBrainConfig()),
  );

  useEffect(() => {
    if (!isInitialEntrance) return;
    const timer = setTimeout(() => {
      setIsInitialEntrance(false);
    }, 1150);
    return () => clearTimeout(timer);
  }, [isInitialEntrance]);

  const [appState, setAppState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadChatHistory(),
  );
  const messagesRef = useRef<ChatMessage[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
    saveChatHistory(messages);
  }, [messages]);

  // Simple Personal Notepad state (persisted safely in localStorage)
  const [notepadContent, setNotepadContent] = useState<string>(() => {
    try {
      return localStorage.getItem("muskan_simple_notepad") || "";
    } catch {
      return "";
    }
  });
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("muskan_simple_notepad", notepadContent);
    } catch {
      // Ignore storage quota errors
    }
  }, [notepadContent]);

  const updateNotepadAndOpen = useCallback((content: string) => {
    setNotepadContent(content);
    setIsNotepadOpen(true);
  }, []);

  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.setMuted(isMuted);
    }
    if (isMuted) {
      stopCurrentAudio();
    }
  }, [isMuted]);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const recognitionRef = useRef<any>(null);
  const wakeRecRef = useRef<any>(null);
  const isTogglingRef = useRef(false);

  const speakResponseText = useCallback(
    async (text: string) => {
      if (isMuted) return;
      setAppState("speaking");
      const audioBase64 = await getMuskanAudio(text);
      if (audioBase64) {
        await playPCM(audioBase64);
      } else {
        await speakBrowserFallback(text);
      }
    },
    [isMuted],
  );

  const handleGeneratePromptToNotepad = useCallback(
    async (topic: string) => {
      setAppState("processing");
      setScanStatus("WRITING TO NOTEPAD...");
      try {
        const shouldSpeak = !isMuted && !isSessionActive;
        const spokenConfirm =
          "Ji Boss, maine Notepad mein prompt likh diya hai. Aap ek click mein copy kar sakte hain, Sir.";

        const [result, audioBase64] = await Promise.all([
          generateMasterPromptForNotepad(topic),
          shouldSpeak ? getMuskanAudio(spokenConfirm) : Promise.resolve(null),
        ]);

        updateNotepadAndOpen(result.promptContent);
        setScanStatus(null);
        setMessages((prev) =>
          appendOrMergeMessage(prev, "muskan", result.spokenReply, false),
        );

        if (shouldSpeak) {
          setAppState("speaking");
          if (audioBase64) {
            await playPCM(audioBase64);
          } else {
            await speakBrowserFallback(spokenConfirm);
          }
          setAppState("idle");
        } else {
          setAppState(isSessionActive ? "listening" : "idle");
        }
      } finally {
        setScanStatus(null);
      }
    },
    [updateNotepadAndOpen, isMuted, isSessionActive],
  );

  const handleTextCommand = useCallback(
    async (finalTranscript: string) => {
      const trimmed = finalTranscript.trim();
      if (!trimmed) {
        setAppState(isSessionActive ? "listening" : "idle");
        return;
      }

      const previousMessages = messagesRef.current;

      setMessages((prev) =>
        appendOrMergeMessage(prev, "user", trimmed, false),
      );

      // 1. Check for browser, tab, OS app, or Notepad ON/OFF commands
      const commandResult = processCommand(trimmed);

      if (commandResult.isBrowserAction) {
        setScanStatus(null);
        if (commandResult.notepadAction === "open") {
          setIsNotepadOpen(true);
        } else if (commandResult.notepadAction === "close") {
          setIsNotepadOpen(false);
        } else if (commandResult.notepadAction === "toggle") {
          setIsNotepadOpen((prev) => !prev);
        }

        const responseText = commandResult.action;
        setMessages((prev) =>
          appendOrMergeMessage(prev, "muskan", responseText, false),
        );

        if (commandResult.closeAllTabs) {
          closeAllTrackedTabs();
        } else if (commandResult.closeTabTarget) {
          closeTrackedTab(commandResult.closeTabTarget);
        } else if (commandResult.osProtocolUrl) {
          triggerOsProtocol(commandResult.osProtocolUrl);
        } else if (commandResult.url) {
          openTrackedTab(commandResult.url);
        }

        if (!isMuted && !isSessionActive) {
          await speakResponseText(responseText);
        }

        setAppState(isSessionActive ? "listening" : "idle");
        return;
      }

      // 2. Check if user is asking for a prompt/text to be written to the Notepad
      const masterPromptTopic = detectMasterPromptRequest(trimmed);
      if (masterPromptTopic) {
        await handleGeneratePromptToNotepad(masterPromptTopic);
        return;
      }

      // If Gemini live session is active, send text through it
      if (isSessionActive && liveSessionRef.current) {
        liveSessionRef.current.sendText(trimmed);
        return;
      }

      setAppState("processing");

      const lower = trimmed.toLowerCase();
      if (
        lower.includes("website") ||
        lower.includes("site") ||
        lower.includes("article") ||
        lower.includes("telangana") ||
        lower.includes("hyderabad") ||
        lower.includes("trend") ||
        lower.includes(".com") ||
        lower.includes(".in")
      ) {
        setScanStatus("CHECKING LIVE NETWORK DATA...");
      }

      // 3. Super-Intelligence Conversation & Live Search via Connected Brain
      const responseText = await getMuskanResponse(trimmed, previousMessages);
      setScanStatus(null);
      setMessages((prev) =>
        appendOrMergeMessage(prev, "muskan", responseText, false),
      );

      if (!isMuted) {
        await speakResponseText(responseText);
      }
      setAppState(isSessionActive ? "listening" : "idle");
    },
    [
      isMuted,
      isSessionActive,
      handleGeneratePromptToNotepad,
      speakResponseText,
    ],
  );

  const stopWakeWordListener = useCallback(() => {
    setIsWakeListening(false);
    if (wakeRecRef.current) {
      try {
        wakeRecRef.current.onend = null;
        wakeRecRef.current.onerror = null;
        wakeRecRef.current.onresult = null;
        wakeRecRef.current.stop();
      } catch {}
      wakeRecRef.current = null;
    }
  }, []);

  const stopAllVoiceSessions = useCallback(() => {
    setIsSessionActive(false);
    setScanStatus(null);
    stopCurrentAudio();
    if (liveSessionRef.current) {
      liveSessionRef.current.stop();
      liveSessionRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setAppState("idle");
    resetMuskanSession();
  }, []);

  const startVoiceSession = useCallback(async () => {
    if (isTogglingRef.current || isSessionActive) return;
    isTogglingRef.current = true;

    try {
      stopWakeWordListener();
      stopCurrentAudio();
      setIsSessionActive(true);
      resetMuskanSession();
      markSessionGreeted(false);

      // Bring window to focus if possible
      try {
        window.focus();
      } catch {}

      // If connected Brain is non-Gemini (Groq, OpenRouter, Mistral, Cohere), use Web Speech API + External Brain
      if (brainConfig && brainConfig.providerId !== "gemini") {
        const SpeechRec =
          window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
          setShowTextInput(true);
          setIsSessionActive(false);
          setAppState("idle");
          return;
        }

        const recognition = new SpeechRec();
        recognition.lang = "hi-IN";
        recognition.continuous = true;
        recognition.interimResults = false;
        recognitionRef.current = recognition;

        recognition.onstart = () => {
          setAppState("listening");
        };

        recognition.onresult = async (event: any) => {
          const lastIdx = event.results.length - 1;
          const transcript = event.results[lastIdx]?.[0]?.transcript?.trim();
          if (transcript) {
            try {
              recognition.stop();
            } catch {}
            await handleTextCommand(transcript);
            if (recognitionRef.current === recognition) {
              try {
                recognition.start();
                setAppState("listening");
              } catch {}
            }
          }
        };

        recognition.onerror = (e: any) => {
          if (e?.error === "not-allowed") {
            setShowPermissionModal(true);
            stopAllVoiceSessions();
          }
        };

        recognition.onend = () => {
          if (recognitionRef.current === recognition) {
            try {
              recognition.start();
            } catch {}
          }
        };

        recognition.start();
        const greeting =
          "Assalamualaikum, Khaleel Sir. Ji Boss, main hazir hoon. Bataiye aaj hum kis cheez par kaam karein, Sir?";
        markSessionGreeted(true);
        setMessages((prev) =>
          appendOrMergeMessage(prev, "muskan", greeting, false),
        );
        await speakResponseText(greeting);
        setAppState("listening");
        return;
      }

      // Gemini Live API Real-Time Voice Session
      try {
        const session = new LiveSessionManager();
        session.setMuted(isMuted);
        liveSessionRef.current = session;

        session.onStateChange = (state) => {
          setAppState(state);
        };

        session.onMessage = (sender, text) => {
          setMessages((prev) =>
            appendOrMergeMessage(prev, sender, text, true),
          );
        };

        session.onCommand = (url) => {
          openTrackedTab(url);
        };

        session.onScanStatus = (status) => {
          setScanStatus(status);
        };

        session.onMasterPromptCreated = (content) => {
          updateNotepadAndOpen(content);
        };

        session.onNotepadToggle = (open) => {
          setIsNotepadOpen(open);
        };

        session.onSessionEnd = () => {
          setIsSessionActive(false);
          setScanStatus(null);
          setAppState("idle");
        };

        await session.start(messagesRef.current);
      } catch {
        setShowPermissionModal(true);
        setIsSessionActive(false);
        setAppState("idle");
      }
    } finally {
      isTogglingRef.current = false;
    }
  }, [
    isSessionActive,
    stopWakeWordListener,
    brainConfig,
    isMuted,
    handleTextCommand,
    stopAllVoiceSessions,
    speakResponseText,
    updateNotepadAndOpen,
  ]);

  const toggleListening = async () => {
    if (isSessionActive) {
      stopAllVoiceSessions();
    } else {
      await startVoiceSession();
    }
  };

  // Always-On Hands-Free "Hello Muskan" Wake-Word Standby Listener
  useEffect(() => {
    if (
      !brainConfig ||
      showBrainSettings ||
      !wakeWordEnabled ||
      isSessionActive ||
      appState !== "idle"
    ) {
      stopWakeWordListener();
      return;
    }

    const SpeechRec =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    let isCancelled = false;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;

    const startWakeListener = () => {
      if (isCancelled) return;
      try {
        const wakeRec = new SpeechRec();
        wakeRec.lang = "en-IN";
        wakeRec.continuous = true;
        wakeRec.interimResults = true;
        wakeRecRef.current = wakeRec;

        wakeRec.onstart = () => {
          if (!isCancelled) setIsWakeListening(true);
        };

        wakeRec.onresult = (event: any) => {
          if (isCancelled) return;
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i]?.[0]?.transcript || "";
            if (isWakeWordMatch(transcript)) {
              isCancelled = true;
              stopWakeWordListener();
              playWakeChime();
              setScanStatus('WAKE WORD: "HELLO MUSKAN" DETECTED...');
              setTimeout(() => {
                setScanStatus(null);
                startVoiceSession();
              }, 150);
              return;
            }
          }
        };

        wakeRec.onerror = (e: any) => {
          if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
            isCancelled = true;
            setIsWakeListening(false);
          }
        };

        wakeRec.onend = () => {
          if (!isCancelled) {
            restartTimer = setTimeout(() => {
              if (!isCancelled) startWakeListener();
            }, 350);
          }
        };

        wakeRec.start();
      } catch {
        // Ignore if browser speech recognition is busy
      }
    };

    const initDelay = setTimeout(startWakeListener, 400);

    return () => {
      isCancelled = true;
      clearTimeout(initDelay);
      if (restartTimer) clearTimeout(restartTimer);
      stopWakeWordListener();
    };
  }, [
    brainConfig,
    showBrainSettings,
    wakeWordEnabled,
    isSessionActive,
    appState,
    stopWakeWordListener,
    startVoiceSession,
  ]);

  useEffect(() => {
    if (brainConfig) {
      syncDailyIntelligenceBriefing(false).catch(() => {});
    }
    return () => {
      stopWakeWordListener();
      stopCurrentAudio();
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [brainConfig, stopWakeWordListener]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    handleTextCommand(textInput);
    setTextInput("");
    setShowTextInput(false);
  };

  const handleActivateBrain = useCallback(
    (providerId: BrainProviderId, apiKey: string) => {
      stopAllVoiceSessions();
      const saved = saveBrainConfig(providerId, apiKey);
      setBrainConfig(saved);
      setShowBrainSettings(false);
    },
    [stopAllVoiceSessions],
  );

  const handleRemoveBrain = useCallback(() => {
    stopAllVoiceSessions();
    clearBrainConfig();
    setBrainConfig(null);
    setShowBrainSettings(false);
  }, [stopAllVoiceSessions]);

  // 1. If NO Brain API key is connected yet (or user opened Settings to change/remove key)
  if (!brainConfig || showBrainSettings) {
    return (
      <BrainSetupScreen
        existingConfig={brainConfig}
        isSettingsModal={Boolean(brainConfig && showBrainSettings)}
        wakeWordEnabled={wakeWordEnabled}
        onToggleWakeWord={handleToggleWakeWord}
        onActivateBrain={handleActivateBrain}
        onRemoveBrain={brainConfig ? handleRemoveBrain : undefined}
        onCloseSettings={
          brainConfig ? () => setShowBrainSettings(false) : undefined
        }
      />
    );
  }

  const activeProviderInfo = getProviderInfo(brainConfig.providerId);

  return (
    <div className="relative h-[100dvh] w-screen bg-[radial-gradient(ellipse_at_center,_#071928_0%,_#030a11_55%,_#010408_100%)] text-slate-100 overflow-hidden m-0 p-0 select-none">
      {/* Startup Entrance Animation Overlay when opening with saved Brain */}
      <AnimatePresence>
        {isInitialEntrance && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.06 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-[radial-gradient(ellipse_at_center,_#071928_0%,_#030a11_55%,_#010408_100%)] flex flex-col items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center"
            >
              <div className="w-28 h-28 rounded-full border-2 border-cyan-400/70 flex items-center justify-center shadow-[0_0_50px_rgba(34,211,238,0.5)] mb-4">
                <span className="font-display font-bold tracking-[0.26em] text-lg text-white pl-[0.26em]">
                  MUSKAN
                </span>
              </div>
              <span className="text-xs font-mono tracking-[0.24em] text-cyan-300 uppercase">
                {activeProviderInfo.shortName} BRAIN SYNCHRONIZED
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showPermissionModal && (
        <PermissionModal onClose={() => setShowPermissionModal(false)} />
      )}

      {/* Simple Compact Floating Notepad */}
      <PromptNotepad
        isOpen={isNotepadOpen}
        onClose={() => setIsNotepadOpen(false)}
        content={notepadContent}
        onChangeContent={setNotepadContent}
      />

      {/* Unified Seamless Ambient Lighting & Holographic Dot Matrix */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at center, rgba(34, 211, 238, 0.5) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/10 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-sky-500/10 blur-[140px] rounded-full" />
      </div>

      {/* Floating Top-Left "Hello Muskan" Hands-Free Wake Status */}
      <div className="absolute top-5 left-6 md:top-7 md:left-10 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleToggleWakeWord(!wakeWordEnabled)}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border backdrop-blur-md text-[11px] font-mono tracking-[0.15em] uppercase transition-all duration-200 cursor-pointer ${
            wakeWordEnabled
              ? "bg-emerald-500/10 border-emerald-400/35 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.15)]"
              : "bg-white/5 border-white/15 text-slate-400 hover:text-slate-200"
          }`}
          title="Toggle Hands-Free 'Hello Muskan' Wake Word"
        >
          <Radio
            size={14}
            className={
              wakeWordEnabled && (isWakeListening || isSessionActive)
                ? "text-emerald-400 animate-pulse"
                : "opacity-60"
            }
          />
          <span className="hidden sm:inline">
            {wakeWordEnabled ? 'Say "Hello Muskan"' : "Wake Word Off"}
          </span>
        </button>
      </div>

      {/* Floating Top-Right Minimal Controls (Install Desktop App + Clear Memory + Mute + Settings) */}
      <div className="absolute top-5 right-6 md:top-7 md:right-10 z-30 flex items-center gap-2.5">
        {!isInstalled && isInstallable && (
          <button
            type="button"
            onClick={install}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-cyan-400/20 hover:bg-cyan-400/30 border border-cyan-300/50 text-cyan-200 text-xs font-display font-bold tracking-[0.14em] uppercase backdrop-blur-md transition-all duration-200 cursor-pointer shadow-[0_0_20px_rgba(34,211,238,0.25)]"
            title="Install Muskan AI as Desktop App with Custom Icon"
          >
            <Monitor size={15} />
            <span className="hidden sm:inline">Install App</span>
          </button>
        )}

        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              stopCurrentAudio();
              clearAllBrowserMemory();
              setMessages([]);
              resetMuskanSession();
              markSessionGreeted(false);
            }}
            className="p-2.5 rounded-full bg-cyan-500/10 hover:bg-red-500/20 border border-cyan-400/20 hover:border-red-400/40 text-cyan-200 hover:text-red-300 backdrop-blur-md transition-all duration-200 cursor-pointer"
            title="Clear Memory"
          >
            <Trash2 size={17} />
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsMuted(!isMuted)}
          className={`p-2.5 rounded-full border backdrop-blur-md transition-all duration-200 cursor-pointer ${
            isMuted
              ? "bg-amber-500/20 text-amber-300 border-amber-400/40"
              : "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 border-cyan-400/20"
          }`}
          title={isMuted ? "Unmute Audio" : "Mute Audio"}
        >
          {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>

        <button
          type="button"
          onClick={() => setShowBrainSettings(true)}
          className="p-2.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-400/25 hover:border-cyan-300 text-cyan-200 hover:text-white backdrop-blur-md transition-all duration-200 cursor-pointer"
          title={`AI Brain & Desktop Settings (${activeProviderInfo.shortName} Connected)`}
        >
          <Settings size={17} />
        </button>
      </div>

      {/* Unified Full-Screen Main Canvas */}
      <main className="relative w-full h-full flex items-center justify-between px-6 md:px-12 pointer-events-none z-10">
        {/* Left Status Indicator */}
        <section className="flex w-[28%] h-full flex-col justify-center gap-4 z-10">
          <div className="h-8 flex items-center">
            <AnimatePresence>
              {appState === "processing" && (
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-400/30 text-sky-300 text-xs font-mono tracking-[0.18em] backdrop-blur-md"
                >
                  <Loader2 size={14} className="animate-spin text-sky-400" />
                  <span>{scanStatus ? "CHECKING..." : "RESPONDING..."}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Center Visualizer */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <Visualizer state={appState} />
        </div>

        {/* Right Status Indicator */}
        <section className="flex w-[28%] h-full flex-col justify-center items-end gap-4 z-10">
          <div className="h-8 flex items-center justify-end">
            <AnimatePresence>
              {appState === "listening" && (
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs font-mono tracking-[0.18em] backdrop-blur-md"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>LISTENING</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* Floating Bottom Action Controls (No black footer bar) */}
      <div className="absolute bottom-6 md:bottom-8 inset-x-0 z-20 flex flex-col items-center justify-center px-6 gap-3.5 pointer-events-none">
        <AnimatePresence>
          {scanStatus && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="pointer-events-auto flex items-center gap-2.5 px-4 py-2 rounded-full bg-cyan-950/70 border border-cyan-400/35 text-cyan-200 text-xs font-mono tracking-[0.14em] backdrop-blur-xl"
            >
              <Globe size={14} className="animate-spin text-cyan-400" />
              <span>{scanStatus}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showTextInput && (
            <motion.form
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleTextSubmit}
              className="pointer-events-auto w-full max-w-lg flex items-center gap-2 bg-[#071928]/85 border border-cyan-400/35 rounded-full p-1.5 pl-5 backdrop-blur-2xl shadow-[0_15px_40px_rgba(0,0,0,0.6)]"
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Message Muskan..."
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-slate-400 text-sm select-text"
                autoFocus
              />
              <button
                type="submit"
                disabled={!textInput.trim() || appState === "processing"}
                className="p-2.5 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 disabled:opacity-35 transition-all cursor-pointer"
              >
                <Send size={16} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onClick={toggleListening}
            className={`group relative flex items-center gap-3 px-7 py-3.5 rounded-full font-display font-bold text-sm md:text-base tracking-[0.14em] uppercase backdrop-blur-xl transition-all duration-300 cursor-pointer ${
              isSessionActive
                ? "bg-red-500/20 text-red-300 border border-red-400/50 hover:bg-red-500/30 shadow-[0_0_25px_rgba(239,68,68,0.25)]"
                : "bg-cyan-500/15 text-white border border-cyan-400/40 hover:border-cyan-300/80 hover:bg-cyan-500/25 shadow-[0_0_25px_rgba(6,182,212,0.2)]"
            }`}
          >
            {isSessionActive ? (
              <>
                <MicOff size={18} className="text-red-400" />
                <span>End Session</span>
              </>
            ) : (
              <>
                <Mic
                  size={18}
                  className="text-cyan-300 group-hover:scale-110 transition-transform"
                />
                <span>Start Session</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsNotepadOpen((prev) => !prev)}
            className={`relative p-3.5 rounded-full border backdrop-blur-xl transition-all duration-200 cursor-pointer ${
              isNotepadOpen
                ? "bg-cyan-400/25 border-cyan-300/70 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                : "bg-cyan-500/10 border-cyan-400/25 hover:bg-cyan-500/20 text-cyan-100"
            }`}
            title={isNotepadOpen ? "Close Notepad" : "Open Notepad"}
          >
            <FileText size={18} />
            {notepadContent.trim().length > 0 && !isNotepadOpen && (
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowTextInput((prev) => !prev)}
            className={`p-3.5 rounded-full border backdrop-blur-xl transition-all duration-200 cursor-pointer ${
              showTextInput
                ? "bg-cyan-400/25 border-cyan-300/70 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                : "bg-cyan-500/10 border-cyan-400/25 hover:bg-cyan-500/20 text-cyan-100"
            }`}
            title="Type a message"
          >
            <Keyboard size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
