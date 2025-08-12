export interface Task {
  title: string;
  content?: any;
  fullJson?: any;
  timestamp?: number;
  subTasks?: Task[];
  stepNumber?: number; // Added to fix TypeScript error
}

export interface Message {
  id?: string;
  type: string;
  content: string;
  timestamp: number;
  actions?: React.ReactNode;
  traces?: TraceMessage[];
  traceDuration?: string;
}

export interface TraceData {
  content: any;
  collaboratorName?: string;
  id?: string;
  timestamp?: number;
}

export interface TraceMessage {
  id?: string;
  dropdownTitle: string;
  tasks: Task[];
  startTime: number;
  type: string;
  text: string;
  messageId?: string;
  componentType?: string;
}

export interface ConversationState {
  messages: Message[];
  traces: TraceData[];
}
