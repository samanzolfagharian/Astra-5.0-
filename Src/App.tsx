
import React, { useState, useEffect, useRef } from 'react';
import Header from './Header';
import ApiKeyPrompt from './ApiKeyPrompt';
import { LiveAvatarService } from './services/live-session';
import { VeoService, SpeechService, SpeechOptions } from './gemini';
import { AspectRatio } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Video, Camera, Mic, MicOff, RefreshCw, AlertCircle, CheckCircle2, Settings, Volume2 } from 'lucide-react';

const ASTRA_AVATAR_URL = "https://i.ibb.co/zWDWymtV/1771300703380.jpg";

const App: React.FC = () => {
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0); 
  const [status, setStatus] = useState<'idle' | 'listening' | 'speaking'>('idle');
  const [isVisionSync, setIsVisionSync] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [error, setError] = useState<string | null>(null);
  const [lastMemory, setLastMemory] = useState<string | null>(null);
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  
  const [textInput, setTextInput] = useState('');
  const [astraResponse, setAstraResponse] = useState<string | null>(null);
  const latestResponseRef = useRef<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [mouthShape, setMouthShape] = useState({ scale: 1, skew: 0 });
  const [idleAction, setIdleAction] = useState<'none' | 'glance' | 'tilt' | 'shift'>('none');
  const [enableIdleActions, setEnableIdleActions] = useState(true);

  // Veo Animation States
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationStatus, setAnimationStatus] = useState<string>('');
  
  const [showSettings, setShowSettings] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<SpeechOptions>({
    voiceName: 'Kore',
    speakingRate: 1.0,
    pitch: 1.0,
    quality: 'high'
  });
  
  const liveService = useRef(new LiveAvatarService());
  const videoRef = useRef<HTMLVideoElement>(null);
  const isConnected = status !== 'idle';

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!(await window.aistudio.hasSelectedApiKey())) {
          setNeedsApiKey(true);
        }
      } catch (e) {
        console.error("Initial auth check failed", e);
      } finally {
        setIsAuthChecking(false);
      }
      const memory = liveService.current.getStoredMemory();
      if (memory.length > 0) setMemoryLoaded(true);
    };
    checkAuth();
    return () => liveService.current.stop();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    // Only trigger intense distortion when audioLevel is significant
    const distortionValue = status === 'speaking' && audioLevel > 0.1 
      ? 20 + (audioLevel * 100) 
      : (status === 'listening' ? 10 : 0);
    root.style.setProperty('--distortion-amount', distortionValue.toString());
  }, [audioLevel, status]);

  // Random Blinking Logic - Refined for more natural feel
  useEffect(() => {
    let blinkTimeout: number;
    const scheduleBlink = () => {
      // Natural variation: shorter intervals between some blinks, longer between others
      const isDoubleBlink = Math.random() > 0.8;
      const delay = isDoubleBlink ? 200 : (Math.random() * 5000 + 2500); 
      
      blinkTimeout = window.setTimeout(() => {
        setIsBlinking(true);
        // Vary blink duration slightly
        const blinkDuration = Math.random() * 50 + 100; 
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, blinkDuration);
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(blinkTimeout);
  }, []);

  // Lip Sync Simulation Logic
  useEffect(() => {
    if (status !== 'speaking' || !astraResponse) {
      setMouthShape({ scale: 1, skew: 0 });
      return;
    }

    const lastChar = astraResponse.trim().slice(-1).toLowerCase();
    let scale = 1;
    let skew = 0;

    // Enhanced mapping for more realistic lip-syncing
    const vowels = ['a', 'e', 'o', 'آ', 'ا', 'و', 'u', 'i', 'ی'];
    const plosives = ['p', 'b', 'm', 't', 'd', 'پ', 'ب', 'م', 'ت', 'د'];
    const fricatives = ['f', 'v', 's', 'z', 'ف', 'و', 'س', 'ز'];

    if (vowels.includes(lastChar)) {
      scale = 1.2 + (Math.random() * 0.1); // Wide open
      skew = 1.5;
    } else if (plosives.includes(lastChar)) {
      scale = 0.85; // Tight closed
      skew = -0.5;
    } else if (fricatives.includes(lastChar)) {
      scale = 1.05; // Slightly open
      skew = 0.8;
    } else {
      scale = 1.1; // Neutral
      skew = 0.3;
    }

    setMouthShape({ scale, skew });
  }, [astraResponse, status]);

  // Random Idle Actions Logic
  useEffect(() => {
    if (status !== 'idle' || !enableIdleActions) {
      setIdleAction('none');
      return;
    }

    let actionTimeout: number;
    const scheduleAction = () => {
      const delay = Math.random() * 8000 + 4000; // Action every 4-12 seconds
      actionTimeout = window.setTimeout(() => {
        const actions: ('glance' | 'tilt' | 'shift')[] = ['glance', 'tilt', 'shift'];
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        
        setIdleAction(randomAction);
        
        // Reset action after a short duration
        setTimeout(() => {
          setIdleAction('none');
          scheduleAction();
        }, 2000 + Math.random() * 1000);
      }, delay);
    };

    scheduleAction();
    return () => clearTimeout(actionTimeout);
  }, [status]);

  const handleSendMessage = async () => {
    if (!textInput.trim() || !isConnected) return;
    try {
      setIsTyping(true);
      setAstraResponse(null); // Clear previous response for new command
      await liveService.current.send(textInput); 
      setTextInput(''); 
    } catch (err) {
      console.error("Neural command failure:", err);
      setIsTyping(false);
    }
  };

  const startCamera = async (mode: 'user' | 'environment') => {
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: mode } 
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsVisionSync(true);
        setFacingMode(mode);
        if (isConnected) {
          setTimeout(() => {
            liveService.current.setVision(videoRef.current);
          }, 500);
        }
      }
    } catch (err) {
      setError("Neural lens access denied. Please check camera permissions.");
      setIsVisionSync(false);
    }
  };

  const toggleVision = async () => {
    if (isVisionSync) {
      setIsVisionSync(false);
      liveService.current.setVision(null);
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    } else {
      await startCamera(facingMode);
    }
  };

  const switchCamera = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    await startCamera(nextMode);
  };

  const handleAnimate = async () => {
    if (isAnimating) return;
    
    try {
      setIsAnimating(true);
      setError(null);
      
      // Fetch image and convert to base64
      const response = await fetch(ASTRA_AVATAR_URL);
      const blob = await response.blob();
      const reader = new FileReader();
      
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(blob);
      const base64 = await base64Promise;

      const url = await VeoService.animateImage(
        base64,
        'image/jpeg',
        AspectRatio.PORTRAIT,
        (msg) => setAnimationStatus(msg)
      );
      
      setVideoUrl(url);
    } catch (err: any) {
      console.error("Animation failed:", err);
      if (err.message === "API_KEY_PERMISSION_DENIED" || err.message === "API_KEY_EXPIRED") {
        setNeedsApiKey(true);
      } else if (err.message === "SERVICE_UNAVAILABLE") {
        setError("Neural animation engine is temporarily overloaded. Please try again in a few minutes.");
      } else if (err.message === "QUOTA_EXHAUSTED") {
        setError("Neural Quota Exhausted: You have reached your API limit. Please switch to a Paid API key or wait for the quota to reset.");
        setNeedsApiKey(true); // Re-prompt to allow switching keys
      } else {
        setError("Neural animation failed. Please ensure you are using a Paid API key.");
      }
    } finally {
      setIsAnimating(false);
      setAnimationStatus('');
    }
  };

  const toggleSession = async () => {
    if (status !== 'idle') {
      liveService.current.stop();
      setStatus('idle');
      setAstraResponse(null);
      setIsTyping(false);
      setAudioLevel(0);
      return;
    }

    try {
      setError(null);
      await liveService.current.start({
        onAudioLevel: (level) => setAudioLevel(level),
        onStatusChange: (s) => {
          setStatus(s);
          if (s === 'speaking') {
            setIsTyping(true);
          }
        },
        onError: (msg) => {
          setError(msg);
          setStatus('idle');
          setIsTyping(false);
          if (msg.includes("Model access denied") || msg.includes("Quota exhausted")) {
            setNeedsApiKey(true);
          }
        },
        onMemoryUpdate: (fact) => {
          setLastMemory(fact);
          setTimeout(() => setLastMemory(null), 8000);
        },
        onTranscription: (text) => {
          setAstraResponse(text);
          latestResponseRef.current = text;
          if (text.length > 0) setIsTyping(false);
        },
        onTurnComplete: async () => {
          setStatus('idle');
          setIsTyping(false);
          latestResponseRef.current = ''; // Reset for next turn
        }
      }, isVisionSync ? videoRef.current! : undefined, { ...voiceSettings, disableNativeAudio: false });
    } catch (err: any) {
      console.error("Session start failed:", err);
      const msg = err?.message || String(err);
      if (msg.includes("Permission denied") || msg.includes("NotAllowedError")) {
        setError("Microphone access is required for the Neural Bridge. Please check your browser permissions.");
      } else {
        setError(`Neural Bridge connection failed: ${msg}`);
      }
      setStatus('idle');
    }
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
          <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest animate-pulse">Initializing Neural Bridge...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 overflow-hidden selection:bg-indigo-500/30">
      {needsApiKey && <ApiKeyPrompt onSelect={() => { window.aistudio.openSelectKey(); setNeedsApiKey(false); }} />}
      
      <div className="max-w-4xl mx-auto px-6">
        <Header />

        <div className="flex flex-col items-center justify-center mt-8 space-y-10">
          
          {/* Avatar Container */}
          <div className="relative group">
            <div className={`absolute -inset-24 rounded-full blur-[120px] transition-all duration-1000 ${
              status === 'speaking' ? 'bg-indigo-500 scale-150 opacity-40' : 
              status === 'listening' ? 'bg-emerald-500 opacity-40' : 'bg-slate-800 animate-neural-pulse opacity-25'
            }`}></div>
            
            <div className={`relative w-80 h-80 md:w-[520px] md:h-[520px] rounded-full border-2 overflow-hidden shadow-[0_0_150px_rgba(0,0,0,0.9)] transition-all duration-1000 ${
              status === 'speaking' ? 'border-indigo-400/60 scale-[1.05]' : 
              status === 'listening' ? 'border-emerald-400/60 scale-[1.02]' : 'border-slate-800/50'
            }`}>
              <div className="w-full h-full relative overflow-hidden bg-slate-950">
                {videoUrl ? (
                  <video 
                    src={videoUrl} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <motion.div 
                    className={`w-full h-full bg-cover bg-center neural-distort`}
                    style={{ 
                      backgroundImage: `url(${ASTRA_AVATAR_URL})`,
                    }}
                    animate={{
                      scale: status === 'speaking' 
                        ? 1.1 + (audioLevel > 0.1 ? audioLevel * 0.15 : 0)
                        : 1.1,
                      scaleX: status === 'speaking' ? 1 - (audioLevel * 0.03) : 1, 
                      scaleY: status === 'speaking' 
                        ? (1 + (audioLevel * 0.12)) * mouthShape.scale // Lip Sync + Audio
                        : 1, 
                      rotate: status === 'speaking' 
                        ? [0, -1.5, 1.5, 0] 
                        : (idleAction === 'tilt' ? [0, 1.5, -1.5, 0] : [0, -0.4, 0.4, 0]), 
                      skewX: status === 'speaking' 
                        ? (audioLevel * 5) 
                        : (idleAction === 'shift' ? 1.2 : 0), 
                      skewY: status === 'speaking' 
                        ? (audioLevel * 2 + mouthShape.skew) 
                        : (idleAction === 'glance' ? 0.6 : 0), 
                      x: status === 'speaking' 
                        ? [0, -2, 2, 0] 
                        : (idleAction === 'shift' ? [0, 3, -3, 0] : [0, -0.6, 0.6, 0]),
                      y: status === 'speaking' 
                        ? [0, -2.5, 2.5, 0] 
                        : [0, -3, 3, 0],
                      filter: `
                        brightness(${status === 'idle' ? 0.7 : 1.1 + (audioLevel * 0.35)}) 
                        contrast(${1.1 + (audioLevel * 0.2)}) 
                        saturate(${1.1 + (audioLevel * 0.25)}) 
                        drop-shadow(0 0 ${audioLevel * 25}px rgba(99, 102, 241, ${audioLevel * 0.6}))
                        ${isBlinking ? 'brightness(0.2)' : 'brightness(1)'}
                      `
                    }}
                    transition={{
                      scale: { type: 'spring', damping: 25, stiffness: 150 },
                      scaleX: status === 'speaking' 
                        ? { type: 'spring', damping: 15, stiffness: 200 }
                        : { duration: 0.3 },
                      scaleY: status === 'speaking'
                        ? { type: 'spring', damping: 8, stiffness: 250 } // Snappier for lip sync
                        : { duration: 0.3 },
                      rotate: { 
                        repeat: Infinity, 
                        duration: status === 'speaking' ? 0.3 : 5, 
                        ease: "easeInOut" 
                      },
                      skewX: { type: 'spring', damping: 8, stiffness: 120 },
                      skewY: { type: 'spring', damping: 10, stiffness: 100 },
                      x: { 
                        repeat: Infinity, 
                        duration: status === 'speaking' ? 0.4 : 7, 
                        ease: "easeInOut" 
                      },
                      y: { 
                        repeat: Infinity, 
                        duration: status === 'speaking' ? 0.6 : 4, 
                        ease: "easeInOut" 
                      },
                      filter: { duration: isBlinking ? 0.08 : 0.25 }
                    }}
                  />
                )}
                
                {/* Enlarged Vision Preview */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 md:w-80 md:h-80 rounded-full border-4 border-cyan-400/60 overflow-hidden transition-all duration-700 shadow-[0_0_60px_rgba(6,182,212,0.4)] z-30 ${isVisionSync ? 'opacity-100 scale-100 animate-vision-pulse' : 'opacity-0 scale-50 pointer-events-none'}`}>
                   <video 
                     ref={videoRef} 
                     autoPlay 
                     playsInline 
                     muted 
                     className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
                   />
                   <div className="absolute inset-0 bg-cyan-500/10 pointer-events-none mix-blend-overlay"></div>
                   <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-cyan-500/80 backdrop-blur px-3 py-1 rounded-full text-[10px] text-white font-bold tracking-widest uppercase">
                     {facingMode === 'user' ? 'Self Lens' : 'External Lens'}
                   </div>
                </div>

                {status === 'idle' && !videoUrl && <div className="absolute inset-0 shimmer-overlay"></div>}

                {/* Animation Overlay */}
                <AnimatePresence>
                  {isAnimating && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-40 flex flex-col items-center justify-center p-8 text-center"
                    >
                      <div className="relative mb-6">
                        <div className="w-20 h-20 border-4 border-indigo-500/20 rounded-full animate-spin border-t-indigo-500"></div>
                        <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400 w-8 h-8 animate-pulse" />
                      </div>
                      <h3 className="text-xl font-display font-bold text-white mb-2">Neural Synthesis</h3>
                      <p className="text-indigo-300 text-sm font-medium animate-pulse">{animationStatus}</p>
                      <div className="mt-8 w-full max-w-[200px] h-1 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-indigo-500"
                          animate={{ 
                            x: ["-100%", "100%"]
                          }}
                          transition={{ 
                            duration: 2,
                            repeat: Infinity,
                            ease: "linear"
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Neural Bridge Status */}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-12 py-5 rounded-[35px] bg-slate-950/90 backdrop-blur-3xl border border-white/10 shadow-2xl flex flex-col items-center min-w-[300px]">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className={`w-3.5 h-3.5 rounded-full ${status === 'speaking' ? 'bg-indigo-400' : status === 'listening' ? 'bg-emerald-400' : 'bg-slate-600'}`}></div>
                  {status !== 'idle' && <div className={`absolute inset-0 rounded-full animate-ping opacity-75 ${status === 'speaking' ? 'bg-indigo-300' : 'bg-emerald-300'}`}></div>}
                </div>
