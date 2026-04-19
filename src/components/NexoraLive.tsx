import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, MicOff, X, Mic } from 'lucide-react';
import { ai, LIVE_MODEL } from '@/src/lib/gemini';
import { LiveServerMessage, Modality } from "@google/genai";

interface NexoraLiveProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NexoraLive: React.FC<NexoraLiveProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextStartTimeRef = useRef(0);

  const cleanup = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setStatus('idle');
    isPlayingRef.current = false;
    audioQueueRef.current = [];
  };

  useEffect(() => {
    if (isOpen) {
      startLive();
    } else {
      cleanup();
    }
    return cleanup;
  }, [isOpen]);

  const startLive = async () => {
    try {
      setStatus('connecting');
      setError(null);

      // 1. Check for support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone access is not supported by your browser or environment.");
      }

      // 2. Get Microphone Stream
      // Try simple audio: true first, as previous specific constraints failed for the user
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true 
        });
      } catch (e: any) {
        console.error("getUserMedia error:", e);
        if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
          throw new Error("No microphone found. Please connect one and try again.");
        } else if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          throw new Error("Microphone permission denied. Please enable it in your browser.");
        } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
          throw new Error("Microphone is currently in use by another application.");
        } else {
          throw new Error(`Microphone error: ${e.message || 'Unknown error'}`);
        }
      }
      streamRef.current = stream;

      // 3. Setup Audio Context
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      nextStartTimeRef.current = audioCtx.currentTime;

      // 3. Connect to Live API
      const sessionPromise = ai.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are Nexora Live, a real-time voice assistant. Speak naturally, be helpful, and engage in fluid conversation. Aakrit Mandal made you using Gemini Ai.",
        },
        callbacks: {
          onopen: () => {
            console.log("Live API connected");
            setStatus('listening');
            
            // Start sending audio
            const source = audioCtx.createMediaStreamSource(stream);
            const processor = audioCtx.createScriptProcessor(2048, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              // Convert Float32Array to Int16Array (PCM)
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
              }
              
              // Convert to base64
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };

            source.connect(processor);
            processor.connect(audioCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              setStatus('speaking');
              const audioPart = message.serverContent.modelTurn.parts.find(p => p.inlineData);
              if (audioPart?.inlineData?.data) {
                handleIncomingAudio(audioPart.inlineData.data);
              }
            }

            if (message.serverContent?.interrupted) {
              console.log("Live AI interrupted");
              stopPlayback();
              setStatus('listening');
            }

            if (message.serverContent?.turnComplete) {
              setStatus('listening');
            }
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Connection failed. Please check your microphone and try again.");
            setStatus('error');
          },
          onclose: () => {
            console.log("Live API closed");
            if (isOpen) {
              setError("Session ended unexpectedly.");
              setStatus('error');
            }
          }
        }
      });

      sessionRef.current = await sessionPromise;

    } catch (err: any) {
      console.error("Live Start Error:", err);
      setError(err.message || "Could not start Live mode.");
      setStatus('error');
    }
  };

  const handleIncomingAudio = (base64Audio: string) => {
    const binary = atob(base64Audio);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    // Convert PCM16 to Float32 for Web Audio API
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 0x7FFF;
    }

    playAudioBuffer(float32);
  };

  const playAudioBuffer = (float32: Float32Array) => {
    if (!audioContextRef.current) return;
    
    const audioCtx = audioContextRef.current;
    const buffer = audioCtx.createBuffer(1, float32.length, 16000);
    buffer.getChannelData(0).set(float32);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);

    // Schedule playback for gapless audio
    const startTime = Math.max(audioCtx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;
  };

  const stopPlayback = () => {
    // In ScriptProcessor approach, it's hard to stop individual scheduled buffers perfectly
    // but resetting nextStartTime helps.
    if (audioContextRef.current) {
        nextStartTimeRef.current = audioContextRef.current.currentTime;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-24 right-8 z-50 w-80 rounded-2xl bg-indigo-600 shadow-2xl p-6 text-white flex flex-col items-center gap-4 border border-white/20"
        >
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center relative">
            <motion.div 
              animate={{ 
                scale: status === 'listening' ? [1, 1.3, 1] : status === 'speaking' ? [1, 1.5, 1] : [1, 1, 1],
                opacity: status === 'listening' ? [0.5, 0.2, 0.5] : status === 'speaking' ? [0.8, 0.3, 0.8] : [0.2, 0.2, 0.2]
              }}
              transition={{ repeat: Infinity, duration: status === 'speaking' ? 1 : 2 }}
              className="absolute inset-0 rounded-full bg-white/30"
            />
            <Zap size={32} className={cn("transition-all", status === 'connecting' ? 'animate-spin' : 'animate-pulse')} />
          </div>
          
          <div className="text-center">
            <h3 className="font-bold text-lg">Nexora Live</h3>
            <p className="text-xs opacity-70">
              {status === 'connecting' && 'Opening session...'}
              {status === 'listening' && 'Listening for your voice...'}
              {status === 'speaking' && 'Nexora is speaking...'}
              {status === 'error' && 'Something went wrong.'}
              {status === 'idle' && 'Ready to start.'}
            </p>
            {error && <p className="text-[10px] text-red-300 mt-1 max-w-full truncate">{error}</p>}
          </div>

          <div className="flex gap-4">
            {status === 'error' ? (
                <button onClick={startLive} className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-all flex items-center gap-2">
                    <Mic size={18} />
                    <span className="text-xs font-medium">Retry</span>
                </button>
            ) : (
                <button onClick={onClose} className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all">
                    <MicOff size={20} />
                </button>
            )}
            <button onClick={onClose} className="p-3 rounded-full bg-red-500 hover:bg-red-400 transition-all">
              <X size={20} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
