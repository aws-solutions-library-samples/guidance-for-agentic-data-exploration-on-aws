import React, { useRef, useMemo, useEffect } from 'react';
import Box from '@cloudscape-design/components/box'
import { Message, TraceMessage } from './types';
import { MessageComp } from './Message';
import { useDebouncedCallback } from 'use-debounce'

export const MessageList: React.FC<{
  messages: Message[],
  traces: TraceMessage[],
  showTraces: boolean,
  isPending: boolean,
  submittedAt: number,
  currentTrace?: string|null,
  currentSubTrace?: string|null
}> = ({ messages, traces, showTraces, isPending, submittedAt, currentTrace, currentSubTrace }) => {

  const bottomRef = useRef<HTMLDivElement>(null);
  // Helper function to get traces associated with a message

  const onResize = useDebouncedCallback(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  },250);

  const getTracesForMessage = (message: Message): TraceMessage[] => {
    if (!traces || !message) return [];

    // For user messages, get traces that were created after this message
    if (message.type === 'user') {
      // Get the timestamp from the message ID
      const messageTimestamp = parseInt("" + message.id);

      // Find the next user message to determine the end of the trace window
      const nextUserMessage = messages.find(m =>
        m.type === 'user' &&
        parseInt("" + m.id) > messageTimestamp
      );

      // If there's a next user message, only include traces between this message and the next
      const nextMessageTimestamp = nextUserMessage
        ? parseInt("" + nextUserMessage.id)
        : Infinity;

      // Return traces that were created after this message and before the next user message
      const messageTraces = traces.filter(trace =>
        trace.startTime > messageTimestamp &&
        trace.startTime < nextMessageTimestamp
      );

      return messageTraces;
    }

    // For assistant messages, find the preceding user message and use its traces
    if (message.type === 'assistant') {
      const messageTimestamp = parseInt("" + message.id);

      // Find the most recent user message before this assistant message
      const precedingUserMessage = [...(messages || [])]
        .reverse()
        .find(m =>
          m.type === 'user' &&
          parseInt("" + m.id) < messageTimestamp
        );

      if (precedingUserMessage) {
        // Use the traces associated with the preceding user message
        const userMessageTraces: TraceMessage[] = getTracesForMessage(precedingUserMessage);
        return userMessageTraces;
      }
    }

    return [];
  };


  return (
    <div data-testid="messages"
      style={{
        height: 'calc(100vh - 290px)', //TODO: responsive
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        padding: '0',
        scrollBehavior: 'smooth'
      }}>
      <Box
        padding={{ bottom: "s" }}
        data-testid="messages-container"
      >
        <div>
          <MessageComp message={{
            id: 'initial',
            type: 'assistant',
            content:
              "Hello there! I'm Panoptic, an AI-powered data integration and analytics platform. I'm here to help you unlock the power of your data and deliver real-time, actionable insights. Feel free to ask a question to get started.",
            timestamp: -1,
          }} />
          {messages.map((m) =>
            <React.Fragment key={m.id}>
              {m.type === 'user' ? (
                <MessageComp message={m} onResized={onResize} />
              ) : (
                <MessageComp onResized={onResize}
                  message={{
                    ...m,
                    traces: showTraces ? getTracesForMessage(m) : [],
                  }}
                />
              )}
            </React.Fragment>
          )}
          {isPending && 
            (<MessageComp message={{
                id: `thinking-${submittedAt}`,
                type: 'thinking',
                content: currentTrace 
                ? `${typeof currentTrace === 'string' && currentTrace === 'ROUTING_CLASSIFIER' ? 'Routing Classifier' : currentTrace} - ${currentSubTrace || 'Processing...'}` 
                : 'Thinking...' ,
                timestamp: -1
            }} />)
        }
        </div>
      </Box>
      <div id="bottom" ref={bottomRef}></div>
    </div>);
};

export default MessageList;