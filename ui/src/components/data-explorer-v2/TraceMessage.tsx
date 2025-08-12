import React from 'react';
import ChatBubble from "@cloudscape-design/chat-components/chat-bubble";
import Avatar from "@cloudscape-design/chat-components/avatar";
import { TraceDisplay } from './TraceDisplay';

interface TraceMessageProps {
  traceData: {
    id: string;
    type: string;
    dropdownTitle: string;
    tasks: any[];
    startTime: number;
    text: string;
  };
  timestamp: number;
}

export const TraceMessage: React.FC<TraceMessageProps> = ({ traceData, timestamp }) => {
  // Extract agent name and duration from the dropdown title
  const titleParts = traceData.dropdownTitle.split(' (');
  const agentName = titleParts[0];
  const durationPart = titleParts[1]?.split(',')[0] || '0 seconds';
  const duration = durationPart.replace(' seconds', '');

  return (
    <div className="single-msg trace-message">
      <ChatBubble
        type="incoming"
        avatar={<Avatar ariaLabel="Agent Trace" color="gen-ai" />}
        ariaLabel={`Trace-${timestamp}`}
      >
        <TraceDisplay 
          tasks={traceData.tasks} 
          agentName={agentName} 
          duration={duration} 
        />
      </ChatBubble>
    </div>
  );
};

export default TraceMessage;
