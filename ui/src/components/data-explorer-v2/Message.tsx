import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Message as MessageType, TraceMessage } from './types';
import ButtonGroup from "@cloudscape-design/components/button-group";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import ChatBubble from "@cloudscape-design/chat-components/chat-bubble";
import Avatar from "@cloudscape-design/chat-components/avatar";
import ReactMarkdown from 'react-markdown'; // markdown
import { StorageImage } from '@aws-amplify/ui-react-storage'
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import hljs from 'highlight.js'; // code highlighting
import 'highlight.js/styles/github.css'; // code highlighting
import Modal from "@cloudscape-design/components/modal";
import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Textarea from "@cloudscape-design/components/textarea";
import LoadingBar from "@cloudscape-design/chat-components/loading-bar";
import Steps from "@cloudscape-design/components/steps";
import { ExpandableSection } from "@cloudscape-design/components";
import { TraceDisplay } from './TraceDisplay';
import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { fetchAuthSession } from "aws-amplify/auth";
import './messages.scss';

// Global state to store thinking history across component instances
const globalThinkingHistory: {[key: string]: string[]} = {};
// Store the most recent thinking history to transfer to the next assistant message
let mostRecentThinkingHistory: string[] = [];
// Track user questions and their associated responses
const userQuestionMap: {[key: string]: string} = {};
// Store the most recent user question
let mostRecentUserQuestion: string = '';
// Track the last user message ID to detect new user questions
let lastUserMessageId: string | null = null;

interface MessageProps {
  message: MessageType;
  onResized?: () => void;
}

export const MessageComp: React.FC<MessageProps> = ({ message, onResized }) => {
  const isUser = message.type === 'user';
  const [likePressed, setLikePressed] = useState(false);
  const [dislikePressed, setDislikePressed] = useState(false);
  const [showDislikeFeedback, setShowDislikeFeedback] = useState(false);
  const [dislikeFeedback, setDislikeFeedback] = useState('');
  const [showFeedbackConfirmation, setShowFeedbackConfirmation] = useState(false);
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [region, setRegion] = useState('us-east-1'); // Default region, you might want to get this from context
  const [showThinkingModal, setShowThinkingModal] = useState(false);
  const [userQuestion, setUserQuestion] = useState<string | null>(null);
  const messageRef = useRef<HTMLDivElement>(null); 
  // For thinking messages, we also want to track history
  const [thinkingHistory, setThinkingHistory] = useState<string[]>([]);

  // Calculate total duration from all trace groups for a message
  const calculateTotalDuration = (traces: any[]) => {
    let totalDuration = 0;
    traces.forEach(trace => {
      const durationMatch = trace.dropdownTitle?.match(/\(([0-9.]+) seconds/);
      if (durationMatch && durationMatch[1]) {
        totalDuration += parseFloat(durationMatch[1]);
      }
    });
    return totalDuration.toFixed(2);
  }
  
  useEffect(() => {
    if (messageRef.current) {
      const observer = new ResizeObserver((e)=> {
        if (onResized) {
          onResized();
        }
      })
      observer.observe(messageRef.current);
      return ()=> observer.disconnect();
    }
  })
  
  
  // Track user messages to associate with responses
  useEffect(() => {
    if (message.type === 'user' && message.content && message.content.trim() !== '') {
      // Check if this is a new user message (different from the last one)
      if (message.id !== lastUserMessageId) {
        // Store the most recent user question
        mostRecentUserQuestion = message.content;
        
        // Clear the most recent thinking history when a new user question is asked
        mostRecentThinkingHistory = [];
        
        // Update the last user message ID
        lastUserMessageId = message.id || null;
        
        // Also store it with the message ID
        if (message.id) {
          userQuestionMap[message.id] = message.content;
        }
      }
    }
  }, [message.content, message.type, message.id]);
  
  // Initialize from global state if available
  useEffect(() => {
    if (message.id && globalThinkingHistory[message.id]) {
      setThinkingHistory(globalThinkingHistory[message.id]);
    }
    
    // Get the associated user question if available
    if (message.id && userQuestionMap[message.id]) {
      setUserQuestion(userQuestionMap[message.id]);
    }
  }, [message.id]);
  
  // For assistant messages, grab the most recent thinking history and user question
  useEffect(() => {
    if (message.type === 'assistant' && mostRecentThinkingHistory.length > 0) {
      setThinkingHistory(mostRecentThinkingHistory);
      
      // Store this history with this message ID
      if (message.id) {
        globalThinkingHistory[message.id] = [...mostRecentThinkingHistory];
        
        // Also associate this message with the most recent user question
        if (mostRecentUserQuestion) {
          userQuestionMap[message.id] = mostRecentUserQuestion;
          setUserQuestion(mostRecentUserQuestion);
        }
      }
    }
  }, [message.type, message.id]);
  
  // Update thinking history when content changes for thinking messages
  useEffect(() => {
    if (message.type === 'thinking' && message.content && message.content.trim() !== '') {
      // Check if this is the first thinking message or if we need to reset
      const isFirstThinking = thinkingHistory.length === 0;
      
      if (isFirstThinking) {
        // For the first thinking message, start a new history
        setThinkingHistory([message.content]);
        mostRecentThinkingHistory = [message.content];
        
        // Also update the global state
        if (message.id) {
          globalThinkingHistory[message.id] = [message.content];
        }
      } else {
        // For subsequent thinking messages, append to history
        setThinkingHistory(prevHistory => {
          // Only add the message if it's not already in the history
          if (!prevHistory.includes(message.content)) {
            const newHistory = [...prevHistory, message.content];
            
            // Update the global most recent thinking history
            mostRecentThinkingHistory = [...newHistory];
            
            // Also update the global state
            if (message.id) {
              globalThinkingHistory[message.id] = [...newHistory];
            }
            
            return newHistory;
          }
          return prevHistory;
        });
      }
    }
  }, [message.content, message.type, message.id, thinkingHistory]);

  // Update message history when content changes
  useEffect(() => {
    if (message.type === 'trace' && message.content && message.content.trim() !== '') {
      setMessageHistory(prevHistory => {
        // Only add the message if it's not already in the history
        if (!prevHistory.includes(message.content)) {
          return [...prevHistory, message.content];
        }
        return prevHistory;
      });
    }
  }, [message.content, message.type]);

  const avatar = (isLoading:boolean) => {
    if (isUser) {
      return <Avatar ariaLabel="User" iconName="user-profile" />
    } else {
      return <Avatar ariaLabel="Assistant" color="gen-ai" iconName="gen-ai" loading={isLoading} />
    }
  }

  // Function to handle copying message content to clipboard
  const handleCopy = async (messageContent: string) => {
    try {
      await navigator.clipboard.writeText(messageContent);
      return true; // Return true to show the success popover
    } catch (error) {
      console.error('Failed to copy message:', error);
      return false;
    }
  };

  // Function to log metrics to CloudWatch
  const logMetricToCloudWatch = async (metricName: string, value: number) => {
    try {
      const session = await fetchAuthSession();
      const cloudWatchClient = new CloudWatchClient({ 
        region: region,
        credentials: session.credentials
      });

      const command = new PutMetricDataCommand({
        Namespace: 'Panoptic/Feedback',
        MetricData: [
          {
            MetricName: metricName,
            Value: value,
            Unit: 'Count',
            Dimensions: [
              {
                Name: 'MessageId',
                Value: message.id?.toString() || 'unknown'
              },
              {
                Name: 'MessageType',
                Value: message.type || 'unknown'
              }
            ],
            Timestamp: new Date()
          }
        ]
      });

      await cloudWatchClient.send(command);
      console.log(`Successfully logged ${metricName} metric to CloudWatch`);
    } catch (error) {
      console.error('Error logging metric to CloudWatch:', error);
    }
  };

  // Handle like button click
  const handleLike = async () => {
    setLikePressed(true);
    setDislikePressed(false);
    await logMetricToCloudWatch('MessageLike', 1);
  };

  // Handle dislike button click
  const handleDislike = async () => {
    setDislikePressed(true);
    setLikePressed(false);
    setShowDislikeFeedback(true);
    await logMetricToCloudWatch('MessageDislike', 1);
  };

  // Handle dislike feedback submission
  const handleDislikeFeedbackSubmit = async () => {
    // Log the detailed feedback if provided
    if (dislikeFeedback.trim()) {
      console.debug('Dislike feedback submitted:', dislikeFeedback);
      // You could send this to a backend service or log it somewhere
      
      // Log additional metric with feedback length
      // await logMetricToCloudWatch('MessageDislikeFeedbackLength', dislikeFeedback.length);
    }
    
    // Show confirmation and hide the feedback form
    setShowDislikeFeedback(false);
    setShowFeedbackConfirmation(true);
    
    // Clear the feedback text
    setDislikeFeedback('');
    
    // Hide confirmation after a delay
    setTimeout(() => {
      setShowFeedbackConfirmation(false);
    }, 3000);
  };

  // Toggle thinking history modal
  const toggleThinkingModal = () => {
    setShowThinkingModal(!showThinkingModal);
  };

  // For assistant messages, show the thinking steps icon
  const showThinkingIcon = message.type === 'assistant' && !message.actions;

  if (message.type === 'thinking') {
    return (
      <div className="single-msg">
      <ChatBubble
        type={"incoming"}
        avatar={avatar(true)}
        ariaLabel={message.id || "thinking"}
        key={message.id}
      >
        <Box>
          <SpaceBetween size="s">
            <LoadingBar variant="gen-ai-masked" />
            <div className="thinking-msg">
              {thinkingHistory.length > 0 ? (
                <Steps
                  steps={thinkingHistory.map((step, index) => ({
                    header: `Step ${index + 1}`,
                    details: step,
                    status: index === thinkingHistory.length - 1 ? "loading" : "success",
                    statusIconAriaLabel: index === thinkingHistory.length - 1 ? "Loading" : "Success"
                  }))}
                />
              ) : (
                "Thinking..."
              )}
            </div>
          </SpaceBetween>
        </Box>
      </ChatBubble>
      </div>
    )
  }
  
  // Create action items array
  const actionItems = [
    ...(showThinkingIcon ? [
      {
        type: "group" as const,
        text: "Agent Steps",
        items: [
          {
            type: "icon-button" as const,
            id: "thinking",
            iconName: "transcript" as const,
            text: "View Agent Steps",
            popoverFeedback: (
              <StatusIndicator type="info">
                Opening thinking steps
              </StatusIndicator>
            )
          }
        ]
      }
    ] : []),
    {
      type: "group" as const,
      text: "Vote",
      items: [
        {
          type: "icon-toggle-button" as const,
          id: "like",
          iconName: "thumbs-up" as const,
          pressedIconName: "thumbs-up-filled" as const,
          text: "Like",
          pressed: likePressed,
          popoverFeedback: (
            <StatusIndicator type="success">
              Thank you!
            </StatusIndicator>
          )
        },
        {
          type: "icon-toggle-button" as const,
          id: "dislike",
          iconName: "thumbs-down" as const,
          pressedIconName: "thumbs-down-filled" as const,
          text: "Dislike",
          pressed: dislikePressed
        }
      ]
    },
    {
      type: "group" as const,
      text: "Copy",
      items: [
        {
          type: "icon-button" as const,
          id: "copy",
          iconName: "copy" as const,
          text: "Copy",
          popoverFeedback: (
            <StatusIndicator type="success">
              Message copied
            </StatusIndicator>
          )
        }
      ]
    }
  ];
  
  return (
    <div className="single-msg" ref={messageRef}>
      <ChatBubble
        key={message.id}
        type={isUser ? "outgoing" : "incoming"}
        avatar={avatar(false)}
        ariaLabel={message.id || "message"}
        actions={
          (message.type === 'assistant' && !message.actions && message.id !== 'initial' &&
            <ButtonGroup
              variant="icon"
              onItemClick={(e) => {
                if (e.detail.id === 'copy') {
                  handleCopy(message.content);
                } else if (e.detail.id === 'like') {
                  handleLike();
                } else if (e.detail.id === 'dislike') {
                  handleDislike();
                } else if (e.detail.id === 'thinking') {
                  toggleThinkingModal();
                }
              }}
              items={actionItems}
            />
          )
        }
      >
        {message.type === 'trace' ? (
          <div className="message-history">
            <Steps
              steps={messageHistory.map((content, index) => ({
                header: `Step ${index + 1}`,
                details: (
                  <MarkdownRenderer content={content} />
                ),
                status: index === messageHistory.length - 1 ? "loading" : "success",
                statusIconAriaLabel: index === messageHistory.length - 1 ? "Loading" : "Success"
              }))}
            />
          </div>
        ) : (
          <>
            <MarkdownRenderer content={message.content} />
            {message.traces && message.traces.length > 0 && (
              <>
                <div className="trace-message-inline">
                  <ExpandableSection 
                    headerText={`Agent Trace (${message.traces.length} components, ${message.traces.reduce((total, trace) => total + (trace.tasks?.length || 0), 0)} steps, ${calculateTotalDuration(message.traces) || '0'} seconds)`}
                    variant="inline"
                  >
                    {message.traces.map((trace, index) => (
                      <TraceDisplay
                        key={`trace-${message.id}-${index}`}
                        tasks={trace.tasks || []}
                        agentName={trace.dropdownTitle?.split(' (')[0] || 'Agent'}
                        duration={trace.dropdownTitle?.split(' (')[1]?.split(' seconds')[0] || '0'}
                      />
                    ))}
                  </ExpandableSection>
                </div>
              </>
            )}
          </>
        )}
        {message.actions && (
          <div style={{ marginTop: '10px' }}>
            {message.actions}
          </div>
        )}
      </ChatBubble>

      {/* Dislike Feedback Modal */}
      <Modal
        visible={showDislikeFeedback}
        onDismiss={() => setShowDislikeFeedback(false)}
        size="medium"
        header="Help us improve"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowDislikeFeedback(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleDislikeFeedbackSubmit}>
                Submit feedback
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="l">
          <Box variant="p">
            We appreciate your feedback. Please let us know how we can improve this response.
          </Box>
          <FormField
            label="What would have made this response more helpful?"
            constraintText="Your feedback helps us train our AI to provide better responses."
          >
            <Textarea
              value={dislikeFeedback}
              onChange={({ detail }) => setDislikeFeedback(detail.value)}
              placeholder="Please provide specific details about what was incorrect or could be improved..."
              rows={5}
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Thinking Steps Modal */}
      <Modal
        visible={showThinkingModal}
        onDismiss={() => setShowThinkingModal(false)}
        size="large"
        header="Agent Steps"
        footer={
          <Box float="right">
            <Button variant="primary" onClick={() => setShowThinkingModal(false)}>
              Close
            </Button>
          </Box>
        }
      >
        <SpaceBetween size="l">
          {userQuestion && (
            <Box variant="awsui-key-label">
              User input: {userQuestion}
            </Box>
          )}
          <Steps
            steps={thinkingHistory.length > 0 ? 
              thinkingHistory.map((step, index) => ({
                header: `Step ${index + 1}`,
                details: step,
                status: "success",
                statusIconAriaLabel: "Success"
              })) : 
              [{
                header: "No thinking steps available",
                details: "Thinking steps cannot be loaded for this response.",
                status: "stopped" as const,
                statusIconAriaLabel: "Stopped"
              }]
            }
          />
        </SpaceBetween>
      </Modal>
    </div>
  )
}

export const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  useEffect(() => {
    hljs.highlightAll();
  }, [content]);

  return useMemo(()=>(
    <div className="markdown-content">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        code({ node, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return match ? (
            <pre className="overflow-x-auto">
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          ) : (
            <div className="codeWrapper">
              <code className={className} {...props}>
              {children}
              </code>
            </div>
          );
        },
        p: ({ node, children}) => {
          if (typeof children === 'object' && 
            Object.hasOwn(children as any, 'type') && 
                (children as any).type === 'storage-image') {
                  const url:string = (children as any).props.children;
                  const path = url.match(/s3\:\/\/[\w\-]+\/(.+)/);
                  return (Array.isArray(path) && path.length > 0) ? 
                    <StorageImage alt={url} path={path![1]}/> 
                    : <p>{children}</p>
          }
          return <p>{children}</p>
        }
        }
      }
    >
      {content}
    </ReactMarkdown>
    </div>
  ),[content]);
};
