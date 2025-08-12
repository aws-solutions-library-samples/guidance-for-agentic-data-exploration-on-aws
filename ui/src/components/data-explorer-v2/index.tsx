import { useState, useEffect, useRef, useMemo } from "react";
import { ServiceNavigation } from "../side-navigation";
import { AppLayout, Box, Container, FlashbarProps, Header, HelpPanel, Spinner } from "@cloudscape-design/components";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import FileHandler, { CsvFileHandler } from "../../utils/file-handler";
import { Alert, Button, StatusIndicator } from "@cloudscape-design/components";
import { v4 as uuidv4 } from 'uuid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Message, ConversationState, TraceData, TraceMessage } from './types'
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";
import useSSMParameter from "../../hooks/use-ssm-parameter";
import { BedrockAgentRuntimeClient, InvokeAgentCommand, InvokeAgentRequest, GetAgentMemoryCommand, MemoryType } from "@aws-sdk/client-bedrock-agent-runtime";
import { useAmplifyContext } from "../../utils/AmplifyContext";
import { useTraceData } from "./tracing";
import { useNavigate, useParams } from 'react-router-dom';
import { UserInputComponent } from "./input";
import React from "react";
import { MessageComp } from "./Message";
import { MessageList } from "./MessageList";
import './messages.scss';

type ChatHistoryResponse = {
  items: Message[],
  cursor: string
}
export function DataExplorerV2() {
  const [files, setFiles] = useState<File[]>([]);
  const [running, setRunning] = useState<boolean>(false);
  const [enableTrace, setEnableTrace] = useState<boolean>(true);
  const [flashbarItems, setFlashbarItems] = useState<FlashbarProps.MessageDefinition[]>([]);
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { region, domainName } = useAmplifyContext();
  const { value:bedrockInfo } = useSSMParameter('/panoptic/bedrock-info', region)
  const {sessionId} = useParams();
  const navigate = useNavigate();
  
  // agent id and alias
  const client = async (message:Message) => {
    const session = await fetchAuthSession()
    const client = new BedrockAgentRuntimeClient({ region: region, credentials: session.credentials })
    const input:InvokeAgentRequest = {
        sessionId: sessionId!,
        memoryId: session.userSub,
        agentId: bedrockInfo![0],
        agentAliasId: bedrockInfo![1],
        inputText: message.content,
        enableTrace,
    }
    const command = new InvokeAgentCommand(input)
    const response = await client.send(command)
    return response;
  }

  const bedrockMemoryClient = async() => {
    const session = await fetchAuthSession()
    const client = new BedrockAgentRuntimeClient({ region: region, credentials: session.credentials })
    const input = {
        sessionId: sessionId!,
        memoryId: session.userSub,
        agentId: bedrockInfo![0],
        agentAliasId: bedrockInfo![1],
        memoryType: MemoryType.SESSION_SUMMARY
    }
    const command = new GetAgentMemoryCommand(input)
    const response = await client.send(command)
    return response;

  }

  const fileHandler = useMemo<FileHandler>(() => {
    const fh = new FileHandler();
    fh.register(new CsvFileHandler());
    return fh;
  }, []);

  const fallbackRender = ({error, resetErrorBoundary}:FallbackProps) => { 
    console.error('error in Data Explorer', error);   
    return (
      <Alert data-testid="alert" 
        type="error"
        header="Something went wrong"
        action={<Button onClick={resetErrorBoundary}>Reset Conversation</Button>}>
          {error.message}
      </Alert>
    );
  }

  const agentMemory = useQuery({
    queryKey: ['br-memory'],
    queryFn: bedrockMemoryClient,
  })

  const chatHistoryFn = async(body?:any): Promise<any[]> => {
    const { userId } = await getCurrentUser();
    const response = await fetch(`${domainName}/chat-history/${userId}:${sessionId}`, {
      method: !!body ? 'POST':'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await fetchAuthSession()).tokens?.idToken?.toString()}`
      },
      body: !!body ? JSON.stringify({
        ...body,
        id: `${userId}:${sessionId}`
      }) : undefined
    });
    if ((!body) && response.ok) {
      const items = await response.json() as unknown as ChatHistoryResponse
      return items.items.map(i=>{ return {
        ...i,
        id: i.timestamp
      }});
    }
    return [];
  }

  const { data: conversation, isLoading } = useQuery<ConversationState>({
      queryKey: ['conversation', sessionId],
      queryFn: async() => {
        let messages = [];
        try {
          messages = await chatHistoryFn();
        } catch (error) {
        }
        return {
          messages,
          traces: []
        }
      },
      enabled: true,
    })

  const [showTraces, setShowTraces] = useState<boolean>(false);
  const { traces, currentTrace, currentSubTrace } = useTraceData(conversation || { messages: [], traces: [] });
  
  const reset = ()=>{
    setFiles([]);
    navigate(`${uuidv4()}`, {
      replace: true
    })
  }

  function handleFileChange(files: File[]):void {
    setFiles([...files]) 
    if (files.length === 1) {
      analyzeFile(files[0]);
    } else if (files.length > 1) {
      analyzeMultipleFiles(files);
    }
  }

  // Global thinking history state to persist across message changes
  const [globalThinkingHistory, setGlobalThinkingHistory] = useState<{[key: string]: string[]}>({});
  
  // Helper function to add a message to the conversation
  const addAssistantMessage = (content: string, actions?: React.ReactNode) => {

    const timestamp = Date.now();
    const messageId = `assistant-${timestamp}`;
    
    queryClient.setQueryData(['conversation', sessionId], (prevData: any) => {
      const currentMessages = prevData?.messages || [];
      
      // Find the most recent thinking message to associate with this assistant message
      const recentThinkingMessage = [...currentMessages].reverse().find(m => m.type === 'thinking');
      
      // If there was a thinking message, associate its history with this new assistant message
      if (recentThinkingMessage && recentThinkingMessage.id) {
        const thinkingId = recentThinkingMessage.id.toString();
        if (globalThinkingHistory[thinkingId]) {
          setGlobalThinkingHistory(prev => ({
            ...prev,
            [messageId]: [...globalThinkingHistory[thinkingId]]
          }));
        }
      }
      
      return {
        ...prevData,
        messages: [...currentMessages, {
          id: messageId,
          content: content,
          type: 'assistant',
          timestamp: timestamp,
          actions: actions
        }]
      };
    });
  };

  // Consolidated function to handle both single and multiple file uploads
  async function processFiles(files: File[]) {
    setRunning(true);
    
    try {
      // Ensure initial greeting is present before processing files
      //ensureInitialGreeting();
      
      const fileInfos = await fileHandler.uploadMultiple(files, {
        personal: true
      });
      
      const fileNames = fileInfos.map(info => info.name).join(' | ');
      const isSingleFile = fileInfos.length === 1;
      
      // Create upload success message
      const uploadMessage = isSingleFile 
        ? `File upload successful: ${fileInfos[0].name}`
        : `Multiple files upload successful: Uploaded ${fileInfos.length} files: ${fileNames}`;
      
      // Generate a unique ID for this message to reference it later
      const messageId = `assistant-file-upload-${Date.now()}`;
      
      // Create action buttons
      const actionButtons = (
        <div>
          <Button data-testid="data-analyzer-submit-btn" onClick={async ()=>{
            // First update the message to remove buttons and show processing state
            queryClient.setQueryData(['conversation', sessionId], (prevData: any) => {
              const updatedMessages = prevData.messages.map((msg: Message) => {
                if (msg.id === messageId) {
                  return {
                    ...msg,
                    actions: <div><StatusIndicator type="loading">Processing...</StatusIndicator></div>
                  };
                }
                return msg;
              });
              
              return {
                ...prevData,
                messages: updatedMessages
              };
            });
            
            // Process the files / Generate a unique batch ID 
            const timestamp = Date.now().toString().slice(-4);
            const randomChars = Math.random().toString(36).substring(2, 4);
            const pathPrefix = `analyze/batch${timestamp}${randomChars}`;
            
            for (const fileInfo of fileInfos) {
              await fileHandler.copy(fileInfo, 
                { source: "userDataBucket", 
                  destination: "dataLoaderBucket", 
                  pathPrefix: pathPrefix
                });
            }

            const confirmMessage = isSingleFile 
              ? `I've saved your file to S3 prefix: ${pathPrefix}/${fileInfos[0].name}<br/><br/>Use the Data Explorer to perform analysis with this command:<br/><br/><strong>Analyze all files at ${pathPrefix}</strong>`
              : `I've saved your files to S3 prefix: ${pathPrefix}/<br/><br/>Use the Data Explorer to perform analysis with this command:<br/><br/><strong>Analyze all files at ${pathPrefix}</strong>`;
              
            queryClient.setQueryData(['conversation', sessionId], (prevData: any) => {
              const updatedMessages = prevData.messages.map((msg: Message) => {
                if (msg.id === messageId) {
                  return {
                    ...msg,
                    content: uploadMessage + "\n\n" + confirmMessage,
                    actions: null
                  };
                }
                return msg;
              });
              
              return {
                ...prevData,
                messages: updatedMessages
              };
            });
          }}>
            Store for Analysis
          </Button>
          &nbsp; &nbsp;
          <Button data-testid="data-loader-submit-btn" onClick={async ()=>{
            // First update the message to remove buttons and show processing state
            queryClient.setQueryData(['conversation', sessionId], (prevData: any) => {
              const updatedMessages = prevData.messages.map((msg: Message) => {
                if (msg.id === messageId) {
                  return {
                    ...msg,
                    actions: <div><StatusIndicator type="loading">Processing...</StatusIndicator></div>
                  };
                }
                return msg;
              });
              
              return {
                ...prevData,
                messages: updatedMessages
              };
            });
            
            // Process the files
            for (const fileInfo of fileInfos) {
              await fileHandler.copy(fileInfo, 
                { source: "userDataBucket", 
                  destination: "dataLoaderBucket", 
                  pathPrefix: 'incoming'
                });
            }
            
            // Update the message with confirmation and no buttons
            const confirmMessage = isSingleFile 
              ? `I've saved your file to <strong>S3 prefix: incoming/${fileInfos[0].name}</strong> and triggered the ETL process.<br/><br/>See <a href="/#/data-classifier">Data Classifier</a> for results.`
              : `I've saved your files to <strong>S3 prefix: incoming/</strong> and triggered the ETL Process.<br/><br/>See <a href="/#/data-classifier">Data Classifier</a> for results.`;
            
            queryClient.setQueryData(['conversation', sessionId], (prevData: any) => {
              const updatedMessages = prevData.messages.map((msg: Message) => {
                if (msg.id === messageId) {
                  return {
                    ...msg,
                    content: uploadMessage + "\n\n" + confirmMessage,
                    actions: null
                  };
                }
                return msg;
              });
              
              return {
                ...prevData,
                messages: updatedMessages
              };
            });
          }}>
            Save to Graph
          </Button>
          &nbsp; &nbsp;
          <Button data-testid="kb-submit-btn" onClick={async ()=>{
            // First update the message to remove buttons and show processing state
            queryClient.setQueryData(['conversation', sessionId], (prevData: any) => {
              const updatedMessages = prevData.messages.map((msg: Message) => {
                if (msg.id === messageId) {
                  return {
                    ...msg,
                    actions: <div><StatusIndicator type="loading">Processing...</StatusIndicator></div>
                  };
                }
                return msg;
              });
              
              return {
                ...prevData,
                messages: updatedMessages
              };
            });
            
            // Process the files
            for (const fileInfo of fileInfos) {
              await fileHandler.copy(fileInfo, 
                { source: "userDataBucket", 
                  destination: "dataLoaderBucket", 
                  pathPrefix: 'kbupload'
                });
            }
            
            // Update the message with confirmation and no buttons
            const confirmMessage = isSingleFile 
              ? `I've saved your file to the knowledge base at <strong>S3 prefix: kbupload/${fileInfos[0].name}</strong>.<br/><br/>Once it has loaded, the Data Explorer can be used to perform analysis.`
              : `I've saved your files to the knowledge base at <strong>S3 prefix: kbupload/</strong>.<br/><br/>Once they have loaded, the Data Explorer can be used to perform analysis.`;

            queryClient.setQueryData(['conversation', sessionId], (prevData: any) => {
              const updatedMessages = prevData.messages.map((msg: Message) => {
                if (msg.id === messageId) {
                  return {
                    ...msg,
                    content: uploadMessage + "\n\n" + confirmMessage,
                    actions: null
                  };
                }
                return msg;
              });
              
              return {
                ...prevData,
                messages: updatedMessages
              };
            });
          }}>
            Save to KB
          </Button>
        </div>
      );
      
      // Add message with action buttons to chat
      queryClient.setQueryData(['conversation', sessionId], (prevData: any) => {
        const currentMessages = prevData?.messages || [];
        
        return {
          ...prevData,
          messages: [...currentMessages, {
            id: messageId,
            content: uploadMessage + "\n\nWhat would you like to do with these files?",
            type: 'assistant',
            timestamp: Date.now(),
            actions: actionButtons
          }]
        };
      });

    } catch (error) {
      console.error('Error processing files:', error);
      // Add error message to chat
      addAssistantMessage(`Error uploading files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRunning(false);
    }
  }

  // Legacy functions that now call the consolidated function
  async function analyzeMultipleFiles(files: File[]) {
    await processFiles(files);
  }

  async function analyzeFile(file: File) {
    await processFiles([file]);
  } 

  const handleError = (error:any) => {
    console.error('Error in API call:', error);
    queryClient.setQueryData(['conversation', sessionId], (prevData: any) => {
      // Check if prevData exists, if not create an initial structure
      const safeData = prevData || { messages: [], traces: [] };
      
      // Make sure we have messages before trying to slice
      const currentMessages = safeData.messages || [];
      const messagesToKeep = currentMessages.length > 0 ? 
        currentMessages.slice(0, -1) : [];
      
      return {
        ...safeData,
        messages: [
          ...messagesToKeep,
          {
            id: `error-${Date.now()}`,
            type: 'assistant',
            content: `Error: ${(error as Error).message}`,
            timestamp: Date.now()
          } as Message
        ]
      };
    });
  }

  const sendMessage = useMutation({
    mutationFn: client,
    onMutate: async (message: Message) => {
      setRunning(true)
      // Save the current state to restore on error
      const previousMessages = queryClient.getQueryData(['conversation', sessionId]);
      
      // Add optimistic update - SAFELY CHECK FOR UNDEFINED
      queryClient.setQueryData(['conversation', sessionId], (prevData: any) => {
        // Check if prevData exists, if not create an initial structure
        const safeData = prevData || { messages: [], traces: [] };
        
        return {
          ...safeData,
          messages: [
            ...(safeData.messages || []), // Safely access messages with fallback
            message
          ]
        };
      });

      return chatHistoryFn(message);
    },
    onSettled: ()=>{
      setRunning(false)
    },
    onSuccess: async ({ completion }, { id }) => {
      if (!completion) return;
      const decoder = new TextDecoder();
      const responseTimestamp = Date.now();
      let accumulatedContent = "";

      const assistantMsg = {
        id: responseTimestamp,
        content: accumulatedContent,
        type: 'assistant',
        timestamp: responseTimestamp
      }

      for await (const value of completion) {
        const chunk = value.chunk;
        if (value.trace) {
          //console.log("trace part", JSON.stringify(value.trace))
          queryClient.setQueryData(['conversation', sessionId], (prevData: any) => {
            // Check if prevData exists, if not create an initial structure
            const safeData = prevData || { messages: [], traces: [] };
            
            return {
              ...safeData,
              traces: [
                ...(safeData.traces || []),
                {
                  id: `trace-${id}-${Date.now()}`, // Add timestamp to ensure uniqueness
                  content: value.trace,
                  timestamp: responseTimestamp
                } as TraceData
              ],
            };
          });
        }
        
        if (value.chunk) {
          const decoded = decoder.decode(value.chunk?.bytes);
          assistantMsg.content += decoded;
          queryClient.setQueryData(['conversation', sessionId], (prevData: any) => {
            // Check if prevData exists, if not create an initial structure
            const safeData = prevData || { messages: [], traces: [] };
            
            return {
              ...safeData,
              messages: [...(safeData.messages || []), assistantMsg]
            };
          });
        }
      }
      return chatHistoryFn(assistantMsg);
    },
    onError: (error, variables, context) => {
      handleError(error);
    },
  })

  const { isPending, submittedAt } = sendMessage;

  const handleSubmit = async (msg:string) => {
      if (msg.trim() === '') return;
      const timestamp = Date.now();
      sendMessage.mutate({
          id: ""+timestamp,
          content: msg,
          type: 'user',
          timestamp
      });
    };

    const HelpPanelContent = () => (
      <div>
        <Header variant="h2">Data Explorer</Header>
        <p>
          Use the Data Explorer to analyze and interact with your data. Here are some tips:
        </p>
        <ul>
          <li>Type your questions in natural language</li>
          <li>Upload relevant files using the file input button</li>
          <li>Use the example prompts for guidance</li>
        </ul>
        <hr/>
        <h3>Getting Started</h3>
        <p>To get started, simply ask a question or upload a file.</p>
        <ul>
          <li>Say "hello" to learn more about Panoptic's capabilities.</li>
          <li>Upload a file for analysis.</li>
          <li>Ask a question about your data</li>
        </ul>
      </div>
    );
    
  const [navigationOpen, setNavigationOpen] = useState<boolean>(false);
  
  return (
    <div>
      <AppLayout
        navigation={<ServiceNavigation />}
        // breadcrumbs={<BreadcrumbGroup data-testid="breadcrumb-group" items={breadcrumbItems} />}
        headerSelector="#top-navigation"
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        content={
          <Container header={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Header variant="h3" 
                actions={
                  <Button iconName="refresh" onClick={() => navigate('/data-explorer')} ariaLabel="New Chat">
                    New Chat
                  </Button>
                }
              >
                Data Explorer
              </Header>
            </div>
        }
            fitHeight
            disableContentPaddings
            footer={
              <ErrorBoundary fallbackRender={fallbackRender}
                onReset={reset}>
                { isLoading ? <Spinner size="large"></Spinner> : 
                <MessageList messages={conversation?.messages || []} 
                  traces={traces} showTraces={showTraces}
                  isPending={isPending} submittedAt={submittedAt} currentSubTrace={currentSubTrace} currentTrace={currentTrace} />
                }
                <UserInputComponent 
                  handleSubmit={handleSubmit}
                  disabled={running||isLoading} 
                  handleFileSelection={handleFileChange}
                  acceptsFileTypes={fileHandler.accepts()}
                  showTraces={showTraces}
                  setShowTraces={setShowTraces}
                  />
            </ErrorBoundary>
            }
          >
          </Container>
        }
        tools={
          <HelpPanel data-testid="help-panel"
            header={<Header variant="h2">Help Panel</Header>}
          >
            <HelpPanelContent />
          </HelpPanel>
        }
      />
    </div>
  );
}

export function DataExplorerBouncer() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`${uuidv4()}`, {
      replace: true
    })
  }, [navigate])
  return (
    <div>loading...</div>
  )
}