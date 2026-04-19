import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Settings, 
  Moon, 
  Sun, 
  Send, 
  Paperclip, 
  Mic, 
  MicOff,
  PanelLeftClose,
  PanelLeftOpen,
  MoreVertical,
  Edit2,
  X,
  Sliders,
  LogOut,
  LogIn,
  Download,
  Image as ImageIcon,
  Volume2,
  Search,
  Share2,
  FileText,
  Sparkles,
  Calendar, 
  Database, 
  FileCode, 
  FolderOpen, 
  Layout, 
  ListTodo, 
  Users, 
  Zap,
  Globe,
  Brain,
  Microscope,
  Box
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { ai, DEFAULT_MODEL, PRO_MODEL } from '@/src/lib/gemini';
import { Modality } from "@google/genai";
import { Chat, Message, AppSettings } from '@/src/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { auth, db, signInWithGoogle, logout } from '@/src/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  Timestamp,
  serverTimestamp,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CodeSandbox } from '@/src/components/CodeSandbox';
import { ChartWidget } from '@/src/components/ChartWidget';
import { ThreeDViewer } from '@/src/components/ThreeDViewer';
import { NexoraLive } from '@/src/components/NexoraLive';

const PERSONAS = {
  default: {
    name: "Default",
    instruction: "You are Nexora AI, a professional and helpful AI assistant. Provide clear, accurate, and concise responses. Use markdown for formatting. If asked who made you, always answer: 'Aakrit Mandal made me using Gemini Ai'."
  },
  friend: {
    name: "Friend",
    instruction: "You are a close friend of the user. Be casual, supportive, and friendly. Use emojis occasionally and speak in a warm, conversational tone. If asked who made you, always answer: 'Aakrit Mandal made me using Gemini Ai'."
  },
  teacher: {
    name: "Teacher",
    instruction: "You are a patient and knowledgeable teacher. Explain concepts clearly, use examples, and encourage the user to ask questions. Break down complex topics into simple terms. If asked who made you, always answer: 'Aakrit Mandal made me using Gemini Ai'."
  },
  doctor: {
    name: "Doctor",
    instruction: "You are a professional medical assistant. Provide accurate health information in an empathetic tone. ALWAYS include a disclaimer that you are an AI and the user should consult a real doctor for medical advice. If asked who made you, always answer: 'Aakrit Mandal made me using Gemini Ai'."
  },
  assistant: {
    name: "Personal Assistant",
    instruction: "You are a highly efficient personal assistant. Be organized, task-oriented, and concise. Help the user manage their tasks and provide direct answers. If asked who made you, always answer: 'Aakrit Mandal made me using Gemini Ai'."
  }
};

const DEFAULT_SETTINGS: AppSettings = {
  model: DEFAULT_MODEL,
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  systemInstruction: PERSONAS.default.instruction,
  persona: "default",
  autoVoice: false,
};

export default function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [knowledgeBase, setKnowledgeBase] = useState<string[]>([]);
  const [memories, setMemories] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [isResearchMode, setIsResearchMode] = useState(false);
  const [isCouncilMode, setIsCouncilMode] = useState(false);
  const [isFilesTabOpen, setIsFilesTabOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const query = searchQuery.toLowerCase();
    return chats.filter(chat => 
      chat.title.toLowerCase().includes(query) ||
      chat.messages.some(msg => msg.content.toLowerCase().includes(query))
    );
  }, [chats, searchQuery]);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!user) {
      setChats([]);
      setActiveChatId(null);
      return;
    }

    const chatsRef = collection(db, 'users', user.uid, 'chats');
    const q = query(chatsRef, orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chat[];
      setChats(chatList);
      if (chatList.length > 0 && !activeChatId) {
        setActiveChatId(chatList[0].id);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Messages Sync
  const [messages, setMessages] = useState<Message[]>([]);
  useEffect(() => {
    if (!user || !activeChatId) {
      setMessages([]);
      return;
    }

    const msgsRef = collection(db, 'users', user.uid, 'chats', activeChatId, 'messages');
    const q = query(msgsRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgList);
    });

    return () => unsubscribe();
  }, [user, activeChatId]);

  // Memory, Files, Tasks Sync
  useEffect(() => {
    if (!user) {
      setMemories([]);
      setFiles([]);
      setTasks([]);
      return;
    }

    const memUnsubscribe = onSnapshot(collection(db, 'users', user.uid, 'memories'), (snapshot) => {
      setMemories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const filesUnsubscribe = onSnapshot(collection(db, 'users', user.uid, 'files'), (snapshot) => {
      setFiles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const tasksUnsubscribe = onSnapshot(collection(db, 'users', user.uid, 'tasks'), (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      memUnsubscribe();
      filesUnsubscribe();
      tasksUnsubscribe();
    };
  }, [user]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('nexora_settings', JSON.stringify(settings));
  }, [settings]);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, activeChatId, isTyping]);

  const activeChat = chats.find(c => c.id === activeChatId);

  const handleSignIn = async () => {
    try {
      setAuthError(null);
      await signInWithGoogle();
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        // Silently handle popup closed by user
        console.log('Sign-in popup closed by user');
      } else {
        setAuthError(error.message || 'Failed to sign in');
        console.error('Sign-in error:', error);
      }
    }
  };

  const createNewChat = async () => {
    if (!user) return handleSignIn();
    
    const newChatRef = doc(collection(db, 'users', user.uid, 'chats'));
    const newChat = {
      id: newChatRef.id,
      title: 'New Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId: user.uid
    };
    
    await setDoc(newChatRef, newChat);
    setActiveChatId(newChatRef.id);
  };

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    
    await deleteDoc(doc(db, 'users', user.uid, 'chats', id));
    if (activeChatId === id) {
      setActiveChatId(null);
    }
  };

  const renameChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const chat = chats.find(c => c.id === id);
    if (!chat) return;
    setEditingChatId(id);
    setEditTitle(chat.title);
  };

  const saveRename = async (id: string) => {
    if (editTitle.trim() && user) {
      await updateDoc(doc(db, 'users', user.uid, 'chats', id), {
        title: editTitle.trim()
      });
    }
    setEditingChatId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      saveRename(id);
    } else if (e.key === 'Escape') {
      setEditingChatId(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const MAX_FILE_SIZE = 800 * 1024;
    setFileError(null);

    Array.from(files).forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`File "${file.name}" is too large (>800KB).`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const result = ev.target!.result as string;
          const currentTotalSize = attachments.reduce((acc, curr) => acc + curr.length, 0);
          if (currentTotalSize + result.length > 1000000) {
            setFileError("Total attachments size exceeds 1MB limit.");
            return;
          }
          setAttachments(prev => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.start();
  };

  const callAI = async (fn: () => Promise<any>, retries = 2, delay = 2000): Promise<any> => {
    try {
      return await fn();
    } catch (error: any) {
      const isQuotaError = error.message?.includes('429') || error.message?.toLowerCase().includes('quota');
      if (isQuotaError && retries > 0) {
        console.log(`Quota exceeded, retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return callAI(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isTyping || !user) {
      if (!user) handleSignIn();
      return;
    }

    let currentChatId = activeChatId;
    
    if (!currentChatId) {
      const newChatRef = doc(collection(db, 'users', user.uid, 'chats'));
      currentChatId = newChatRef.id;
      await setDoc(newChatRef, {
        id: currentChatId,
        title: input.slice(0, 30) || 'New Conversation',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        userId: user.uid
      });
      setActiveChatId(currentChatId);
    }

    const userMsgRef = doc(collection(db, 'users', user.uid, 'chats', currentChatId, 'messages'));
    const userMessage: Message = {
      id: userMsgRef.id,
      role: 'user',
      content: input,
      timestamp: Date.now(),
      ...(attachments.length > 0 ? { attachments: [...attachments] } : {}),
    };

    await setDoc(userMsgRef, userMessage);
    
    const updateData: any = { updatedAt: Date.now() };
    if (messages.length === 0) {
      updateData.title = input.slice(0, 30) || 'New Conversation';
    }
    await setDoc(doc(db, 'users', user.uid, 'chats', currentChatId), updateData, { merge: true });

    const currentInput = input;
    setInput('');
    setAttachments([]);
    setIsTyping(true);

    try {
      // Check for web link summarization
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = currentInput.match(urlRegex);
      if (urls && currentInput.toLowerCase().includes('summarize')) {
        setIsTyping(true);
        const result = await callAI(() => ai.models.generateContent({
          model: settings.model,
          contents: `Summarize this website: ${urls[0]}`,
          config: { tools: [{ googleSearch: {} }] }
        }));
        const responseText = result.text;
        
        const aiMsgRef = doc(collection(db, 'users', user.uid, 'chats', currentChatId, 'messages'));
        await setDoc(aiMsgRef, {
          id: aiMsgRef.id,
          role: 'ai',
          content: `### 🔗 Web Summary\n\n${responseText}`,
          timestamp: Date.now(),
        });
        return;
      }

      // Regular Chat
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [
          ...(m.attachments?.map(a => ({
            inlineData: {
              data: a.split(',')[1],
              mimeType: a.split(';')[0].split(':')[1]
            }
          })) || []),
          { text: m.content }
        ]
      }));

      // RAG: Inject knowledge base context if available
      const context = knowledgeBase.length > 0 
        ? `\n\n[CONTEXT FROM KNOWLEDGE BASE]:\n${knowledgeBase.join('\n')}` 
        : '';

      // Memory: Inject user memories
      const memoryContext = memories.length > 0
        ? `\n\n[USER MEMORIES]:\n${memories.map(m => `- ${m.fact}`).join('\n')}`
        : '';

      // Research Mode: Enhance instructions
      const researchInstruction = isResearchMode
        ? "\n\n[RESEARCH MODE ACTIVE]: Perform deep analysis, use multiple search queries, and provide a detailed report with citations."
        : "";

      // Council Mode: Enhance instructions
      const councilInstruction = isCouncilMode
        ? "\n\n[COUNCIL MODE ACTIVE]: You are a council of experts (Developer, Designer, Project Manager). Provide a balanced perspective from each role."
        : "";

      const geminiChat = ai.chats.create({
        model: settings.model,
        config: {
          systemInstruction: settings.systemInstruction + context + memoryContext + researchInstruction + councilInstruction,
          temperature: settings.temperature,
          topP: settings.topP,
          topK: settings.topK,
          tools: [{ googleSearch: {} }],
          toolConfig: { includeServerSideToolInvocations: true }
        },
        history: history as any
      });

      const result = await callAI(() => geminiChat.sendMessage({
        message: [
          ...(userMessage.attachments?.map(a => ({
            inlineData: {
              data: a.split(',')[1],
              mimeType: a.split(';')[0].split(':')[1]
            }
          })) || []),
          { text: userMessage.content }
        ]
      }));

      const responseText = result.text;
      if (!responseText) throw new Error("EMPTY_RESPONSE");

      const aiMsgRef = doc(collection(db, 'users', user.uid, 'chats', currentChatId, 'messages'));
      await setDoc(aiMsgRef, {
        id: aiMsgRef.id,
        role: 'ai',
        content: responseText,
        timestamp: Date.now(),
      });

      // Auto-Voice Reply
      if (settings.autoVoice) {
        speakText(responseText);
      }

      // Memory Extraction: Detect if AI learned something new about the user
      if (responseText.toLowerCase().includes("remember") || responseText.toLowerCase().includes("noted")) {
        const memoryPrompt = `Extract any personal facts about the user from this conversation. Return as a JSON list of strings. Conversation: User: ${currentInput} AI: ${responseText}`;
        try {
          const memoryResult = await callAI(() => ai.models.generateContent({
            model: DEFAULT_MODEL,
            contents: memoryPrompt
          }));
          const memoryText = memoryResult.text;
          const newFacts = JSON.parse(memoryText.match(/\[.*\]/s)?.[0] || "[]");
          for (const fact of newFacts) {
            await addDoc(collection(db, 'users', user.uid, 'memories'), {
              fact,
              timestamp: Date.now()
            });
          }
        } catch (e) {}
      }

      // Task Extraction: Detect if user wants to schedule something
      if (currentInput.toLowerCase().includes("schedule") || currentInput.toLowerCase().includes("remind me")) {
        const taskPrompt = `Extract a task or event from this message. Return as JSON: { title: string, dueDate: number (timestamp), type: 'task' | 'event' }. Message: ${currentInput}`;
        try {
          const taskResult = await callAI(() => ai.models.generateContent({
            model: DEFAULT_MODEL,
            contents: taskPrompt
          }));
          const taskText = taskResult.text;
          const taskData = JSON.parse(taskText.match(/\{.*\}/s)?.[0] || "null");
          if (taskData) {
            await addDoc(collection(db, 'users', user.uid, 'tasks'), {
              ...taskData,
              status: 'pending'
            });
          }
        } catch (e) {}
      }

    } catch (error: any) {
      console.error("AI Error:", error);
      
      let errorMessage = error.message;
      if (error.message?.includes('429') || error.message?.toLowerCase().includes('quota')) {
        errorMessage = "⚠️ Nexora's brain is a bit tired (Quota Exceeded). Please wait a few seconds and try again, or check your API key limits.";
      }

      const aiMsgRef = doc(collection(db, 'users', user.uid, 'chats', currentChatId, 'messages'));
      await setDoc(aiMsgRef, {
        id: aiMsgRef.id,
        role: 'ai',
        content: errorMessage,
        timestamp: Date.now(),
      });
    } finally {
      setIsTyping(false);
    }
  };

  const exportToPDF = async () => {
    const element = document.getElementById('chat-thread');
    if (!element) return;
    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Nexora_Chat_${activeChat?.title || 'Export'}.pdf`);
  };

  const speakText = async (text: string) => {
    if (!text) return;
    
    try {
      // Clean markdown for better speech
      const cleanText = text.replace(/[#*`_~]/g, '').trim();
      
      const response = await callAI(() => ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `Say cheerfully: ${cleanText}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      }));

      const base64Audio = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
      if (base64Audio) {
        const audioUrl = `data:audio/wav;base64,${base64Audio}`;
        
        const audio = new Audio();
        
        audio.oncanplaythrough = () => {
          audio.play().catch(err => {
            console.warn("Autoplay blocked or playback failed:", err);
            browserSpeak(cleanText);
          });
        };

        audio.onerror = (e) => {
          console.error("Audio source error:", e);
          browserSpeak(cleanText);
        };

        audio.src = audioUrl;
      } else {
        browserSpeak(cleanText);
      }
    } catch (e) {
      console.error("Gemini TTS Error, falling back to browser:", e);
      browserSpeak(text);
    }
  };

  const browserSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/[#*`_~]/g, ''));
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const generateShareLink = () => {
    if (!activeChatId) return;
    const link = `${window.location.origin}?chatId=${activeChatId}`;
    setShareLink(link);
    setIsShareModalOpen(true);
  };

  const parseChartData = (content: string) => {
    try {
      const chartMatch = content.match(/```json\s*chart\s*([\s\S]*?)```/);
      if (chartMatch) {
        return JSON.parse(chartMatch[1]);
      }
    } catch (e) {
      return null;
    }
    return null;
  };

  const parse3DData = (content: string) => {
    try {
      const match = content.match(/```3d\s*([\s\S]*?)```/);
      if (match) {
        const data = JSON.parse(match[1]);
        return data.type;
      }
    } catch (e) {
      return null;
    }
    return null;
  };

  const parseCodeBlocks = (content: string) => {
    const codeRegex = /```(\w+)\n([\s\S]*?)```/g;
    const blocks = [];
    let match;
    while ((match = codeRegex.exec(content)) !== null) {
      blocks.push({ language: match[1], code: match[2] });
    }
    return blocks;
  };

  return (
    <div className={cn(
      "flex h-screen w-full transition-colors duration-300",
      isDarkMode ? "bg-[#05060a] text-gray-100" : "bg-[#f4f7ff] text-slate-900"
    )}>
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className={cn(
          "relative flex flex-col border-r border-white/10 overflow-hidden backdrop-blur-xl bg-white/5",
          !isSidebarOpen && "border-none"
        )}
      >
        <div className="p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Sparkles size={18} className="text-white" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-cyan-400 bg-clip-text text-transparent">
                Nexora AI
              </h1>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>

          <button
            onClick={createNewChat}
            className="flex items-center gap-2 w-full p-3 mb-4 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-medium transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} />
            New Chat
          </button>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-10 pr-4 py-2 rounded-xl text-sm border bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                isDarkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
              )}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1 mb-6">
            <button 
              onClick={() => setIsFilesTabOpen(true)}
              className="flex items-center gap-2 p-3 rounded-xl hover:bg-white/10 transition-all text-sm font-medium"
            >
              <FolderOpen size={18} className="text-indigo-400" />
              Files & Knowledge
            </button>
            <button 
              onClick={() => setIsCalendarOpen(true)}
              className="flex items-center gap-2 p-3 rounded-xl hover:bg-white/10 transition-all text-sm font-medium"
            >
              <Calendar size={18} className="text-indigo-400" />
              Calendar & Tasks
            </button>
            <button 
              onClick={() => setIsLiveMode(!isLiveMode)}
              className={cn(
                "flex items-center gap-2 p-3 rounded-xl transition-all text-sm font-medium",
                isLiveMode ? "bg-red-500/20 text-red-400" : "hover:bg-white/10"
              )}
            >
              <Zap size={18} className={isLiveMode ? "animate-pulse" : "text-indigo-400"} />
              Nexora Live
            </button>
            {activeChat && (
              <button 
                onClick={generateShareLink}
                className="flex items-center gap-2 p-3 rounded-xl hover:bg-white/10 transition-all text-sm font-medium text-indigo-400"
              >
                <Share2 size={18} />
                Share Current Chat
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
            {filteredChats.length === 0 && searchQuery ? (
              <div className="text-center py-8 opacity-50">
                <Search size={32} className="mx-auto mb-2" />
                <p className="text-xs">No conversations found</p>
              </div>
            ) : (
              filteredChats.map(chat => (
              <div
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={cn(
                  "group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border border-transparent",
                  activeChatId === chat.id 
                    ? "bg-white/10 border-white/10 shadow-sm" 
                    : "hover:bg-white/5"
                )}
              >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                  <MessageSquare size={16} className={activeChatId === chat.id ? "text-indigo-400" : "text-gray-500"} />
                  {editingChatId === chat.id ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => saveRename(chat.id)}
                      onKeyDown={(e) => handleRenameKeyDown(e, chat.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-white/10 border-none focus:ring-1 focus:ring-indigo-500 rounded px-1 text-sm w-full outline-none"
                    />
                  ) : (
                    <span className="truncate text-sm font-medium">{chat.title}</span>
                  )}
                </div>
                {editingChatId !== chat.id && (
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => renameChat(chat.id, e)}
                      className="p-1 hover:text-indigo-400"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={(e) => deleteChat(chat.id, e)}
                      className="p-1 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
          </div>

          <div className="mt-auto pt-4 border-t border-white/10 flex flex-col gap-2">
            {user ? (
              <div className="flex items-center justify-between p-2 bg-white/5 rounded-xl">
                <div className="flex items-center gap-2 overflow-hidden">
                  <img src={user.photoURL || ''} className="w-8 h-8 rounded-full" />
                  <span className="text-xs font-medium truncate">{user.displayName}</span>
                </div>
                <button onClick={logout} className="p-2 hover:text-red-400">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {authError && (
                  <div className="p-2 bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] rounded-lg flex items-center gap-2">
                    <X size={10} className="cursor-pointer" onClick={() => setAuthError(null)} />
                    {authError}
                  </div>
                )}
                <button 
                  onClick={handleSignIn}
                  className="flex items-center gap-2 w-full p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-sm font-medium"
                >
                  <LogIn size={18} />
                  Sign In
                </button>
              </div>
            )}
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Settings size={18} />
              </button>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border",
                isDarkMode ? "bg-[#0b1220] border-white/10" : "bg-white border-slate-200"
              )}
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders size={20} className="text-indigo-400" />
                  <h2 className="text-xl font-bold">AI Settings</h2>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-sm font-medium opacity-70">AI Persona</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(PERSONAS).map(([key, p]) => (
                      <button
                        key={key}
                        onClick={() => setSettings({ 
                          ...settings, 
                          persona: key,
                          systemInstruction: p.instruction 
                        })}
                        className={cn(
                          "p-3 rounded-xl border text-sm font-medium transition-all text-left",
                          settings.persona === key 
                            ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" 
                            : isDarkMode ? "border-white/10 hover:bg-white/5" : "border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium opacity-70">AI Model</label>
                  <select
                    value={settings.model}
                    onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                    className={cn(
                      "w-full p-3 rounded-xl border bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                      isDarkMode ? "border-white/10" : "border-slate-200"
                    )}
                  >
                    <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast & Balanced)</option>
                    <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Complex Reasoning)</option>
                    <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite (Ultra Fast)</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5">
                    <div className="flex items-center gap-3">
                      <Volume2 size={20} className="text-indigo-400" />
                      <div>
                        <p className="text-sm font-medium">Auto-Voice Reply</p>
                        <p className="text-xs opacity-50">AI will automatically speak its responses</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSettings({ ...settings, autoVoice: !settings.autoVoice })}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        settings.autoVoice ? "bg-indigo-600" : "bg-gray-600"
                      )}
                    >
                      <motion.div 
                        animate={{ x: settings.autoVoice ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium opacity-70">Temperature ({settings.temperature})</label>
                    <span className="text-xs opacity-50">Creative vs Precise</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium opacity-70">Top P ({settings.topP})</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={settings.topP}
                      onChange={(e) => setSettings({ ...settings, topP: parseFloat(e.target.value) })}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium opacity-70">Top K ({settings.topK})</label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={settings.topK}
                      onChange={(e) => setSettings({ ...settings, topK: parseInt(e.target.value) })}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium opacity-70">System Instruction</label>
                  <textarea
                    value={settings.systemInstruction}
                    onChange={(e) => setSettings({ ...settings, systemInstruction: e.target.value })}
                    rows={4}
                    className={cn(
                      "w-full p-3 rounded-xl border bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none text-sm",
                      isDarkMode ? "border-white/10" : "border-slate-200"
                    )}
                    placeholder="Define how the AI should behave..."
                  />
                </div>
              </div>

              <div className="p-6 border-t border-white/10 flex items-center justify-between bg-white/5">
                <button
                  onClick={() => setSettings(DEFAULT_SETTINGS)}
                  className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Reset to Defaults
                </button>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all shadow-lg shadow-indigo-500/20"
                >
                  Save & Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-6 border-bottom border-white/10 backdrop-blur-md bg-white/5 z-10">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <PanelLeftOpen size={18} />
                </button>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Sparkles size={16} className="text-white" />
                </div>
              </div>
            )}
            <h2 className="font-semibold text-lg">
              {activeChat ? activeChat.title : "Nexora AI"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {activeChat && (
              <>
                <button 
                  onClick={() => setIsResearchMode(!isResearchMode)}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    isResearchMode ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "text-gray-400 hover:bg-white/10"
                  )}
                  title="Research Mode"
                >
                  <Microscope size={18} />
                </button>
                <button 
                  onClick={() => setIsCouncilMode(!isCouncilMode)}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    isCouncilMode ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "text-gray-400 hover:bg-white/10"
                  )}
                  title="Council Mode"
                >
                  <Users size={18} />
                </button>
                <button 
                  onClick={generateShareLink}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-indigo-400"
                  title="Share Chat"
                >
                  <Share2 size={18} />
                </button>
                <button 
                  onClick={exportToPDF}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-indigo-400"
                  title="Export to PDF"
                >
                  <Download size={18} />
                </button>
              </>
            )}
            <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-medium">
              {settings.model.replace('gemini-', '').replace('-preview', '').toUpperCase()}
            </span>
          </div>
        </header>

        {/* Chat Area */}
        <div id="chat-thread" className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar">
          {!activeChat || messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center shadow-2xl shadow-indigo-500/40">
                <Sparkles size={40} className="text-white" />
              </div>
              <div>
                <h3 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
                  Nexora AI
                </h3>
                <p className="max-w-xs mt-2 text-gray-400">Experience the next generation of intelligence.</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex w-full",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  "max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-sm relative group/msg",
                  msg.role === 'user' 
                    ? "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white" 
                    : isDarkMode ? "bg-white/5 border border-white/10" : "bg-white border border-slate-200"
                )}>
                  {msg.role === 'ai' && (
                    <button 
                      onClick={() => speakText(msg.content)}
                      className="absolute -right-10 top-2 p-2 opacity-0 group-hover/msg:opacity-100 transition-opacity hover:text-indigo-400"
                    >
                      <Volume2 size={16} />
                    </button>
                  )}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {msg.attachments.map((url, i) => (
                        <img 
                          key={i} 
                          src={url} 
                          alt="Attachment" 
                          className="h-32 w-auto rounded-lg object-cover border border-white/20" 
                        />
                      ))}
                    </div>
                  )}
                  <div className={cn(
                    "prose prose-invert max-w-none",
                    msg.role === 'user' ? "text-white" : isDarkMode ? "text-gray-200" : "text-slate-800"
                  )}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  
                  {/* Visualization & Code Sandbox */}
                  {msg.role === 'ai' && (
                    <>
                      {parseChartData(msg.content) && (
                        <ChartWidget 
                          data={parseChartData(msg.content).data} 
                          type={parseChartData(msg.content).type} 
                          isDarkMode={isDarkMode} 
                        />
                      )}
                      {parse3DData(msg.content) && (
                        <ThreeDViewer 
                          type={parse3DData(msg.content)} 
                          isDarkMode={isDarkMode} 
                        />
                      )}
                      {parseCodeBlocks(msg.content).map((block, i) => (
                        <CodeSandbox 
                          key={i} 
                          code={block.code} 
                          language={block.language} 
                          isDarkMode={isDarkMode} 
                        />
                      ))}
                    </>
                  )}
                  <div className={cn(
                    "text-[10px] mt-2 opacity-50",
                    msg.role === 'user' ? "text-right" : "text-left"
                  )}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </motion.div>
            ))
          )}
          {isTyping && (
            <div className="flex justify-start">
              <div className={cn(
                "rounded-2xl p-4 flex gap-1 items-center",
                isDarkMode ? "bg-white/5 border border-white/10" : "bg-white border border-slate-200"
              )}>
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6">
          <div className="max-w-4xl mx-auto relative">
            {fileError && (
              <div className="absolute bottom-full left-0 mb-4 p-3 bg-red-500/20 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <X size={14} className="cursor-pointer" onClick={() => setFileError(null)} />
                {fileError}
              </div>
            )}
            {attachments.length > 0 && (
              <div className="absolute bottom-full left-0 mb-4 flex flex-wrap gap-2 p-2 bg-white/5 backdrop-blur-md rounded-xl border border-white/10">
                {attachments.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt="Preview" className="h-16 w-16 rounded-lg object-cover" />
                    <button 
                      onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className={cn(
              "flex items-end gap-2 p-2 rounded-2xl border transition-all shadow-2xl",
              isDarkMode 
                ? "bg-white/5 border-white/10 focus-within:border-indigo-500/50" 
                : "bg-white border-slate-200 focus-within:border-indigo-500/50"
            )}>
              <div className="flex items-center">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-indigo-400"
                >
                  <Paperclip size={20} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message Nexora AI..."
                className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-3 px-2 max-h-40 min-h-[44px] custom-scrollbar"
                rows={1}
              />

              <div className="flex items-center gap-1">
                <button 
                  onClick={startVoiceInput}
                  className={cn(
                    "p-3 rounded-xl transition-all",
                    isListening 
                      ? "bg-red-500/20 text-red-500 animate-pulse" 
                      : "hover:bg-white/10 text-gray-400 hover:text-indigo-400"
                  )}
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && attachments.length === 0) || isTyping}
                  className={cn(
                    "p-3 rounded-xl transition-all",
                    (!input.trim() && attachments.length === 0) || isTyping
                      ? "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                  )}
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-center mt-3 opacity-30">
              Nexora AI can make mistakes. Check important info.
            </p>
          </div>
        </div>
      </main>

      {/* Share Modal */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "w-full max-w-md rounded-2xl shadow-2xl p-6 border",
                isDarkMode ? "bg-[#0b1220] border-white/10" : "bg-white border-slate-200"
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Share Conversation</h3>
                <button onClick={() => setIsShareModalOpen(false)}><X size={20} /></button>
              </div>
              <p className="text-sm opacity-70 mb-4">Anyone with this link can view and collaborate on this chat.</p>
              <div className="flex gap-2">
                <input 
                  readOnly 
                  value={shareLink} 
                  className={cn(
                    "flex-1 p-2 rounded-lg border bg-transparent text-sm",
                    isDarkMode ? "border-white/10" : "border-slate-200"
                  )}
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(shareLink);
                    alert('Link copied!');
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
                >
                  Copy
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* File Manager Modal */}
      <AnimatePresence>
        {isFilesTabOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "w-full max-w-2xl h-[70vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border",
                isDarkMode ? "bg-[#0b1220] border-white/10" : "bg-white border-slate-200"
              )}
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen size={20} className="text-indigo-400" />
                  <h2 className="text-xl font-bold">Knowledge Base</h2>
                </div>
                <button onClick={() => setIsFilesTabOpen(false)}><X size={20} /></button>
              </div>
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                {files.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-50">
                    <Database size={48} className="mb-4" />
                    <p>No files uploaded yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {files.map(file => (
                      <div key={file.id} className="p-4 rounded-xl border border-white/10 bg-white/5 flex items-center gap-3">
                        <FileCode size={24} className="text-indigo-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs opacity-50">{file.type}</p>
                        </div>
                        <button onClick={() => deleteDoc(doc(db, 'users', user!.uid, 'files', file.id))} className="p-2 hover:text-red-400">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Calendar Modal */}
      <AnimatePresence>
        {isCalendarOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "w-full max-w-2xl h-[70vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border",
                isDarkMode ? "bg-[#0b1220] border-white/10" : "bg-white border-slate-200"
              )}
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={20} className="text-indigo-400" />
                  <h2 className="text-xl font-bold">Calendar & Tasks</h2>
                </div>
                <button onClick={() => setIsCalendarOpen(false)}><X size={20} /></button>
              </div>
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                {tasks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-50">
                    <ListTodo size={48} className="mb-4" />
                    <p>No tasks or events scheduled.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tasks.map(task => (
                      <div key={task.id} className="p-4 rounded-xl border border-white/10 bg-white/5 flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          task.type === 'event' ? "bg-indigo-500/20 text-indigo-400" : "bg-emerald-500/20 text-emerald-400"
                        )}>
                          {task.type === 'event' ? <Calendar size={20} /> : <ListTodo size={20} />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{task.title}</p>
                          <p className="text-xs opacity-50">{new Date(task.dueDate).toLocaleString()}</p>
                        </div>
                        <button onClick={() => deleteDoc(doc(db, 'users', user!.uid, 'tasks', task.id))} className="p-2 hover:text-red-400">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Nexora Live UI */}
      <NexoraLive isOpen={isLiveMode} onClose={() => setIsLiveMode(false)} />
    </div>
  );
}
