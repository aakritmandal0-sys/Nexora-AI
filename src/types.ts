export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
  attachments?: string[]; // Base64 strings
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  model: string;
  temperature: number;
  topP: number;
  topK: number;
  systemInstruction: string;
  persona: string;
  autoVoice: boolean;
}
