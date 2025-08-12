import { TraceData, Task, ConversationState } from './types'
import { useState, useEffect } from 'react';

type TraceMessage = {
    id?: string
    dropdownTitle: string
    tasks: Task[]
    startTime: number
    type: string
    text: string
    messageId?: string // Add messageId to associate with a specific message
    componentType?: string // Add component type to track which component this trace belongs to
}

type Message = TraceMessage;

export function useTraceData(conversationState:ConversationState): {
    currentTrace: string | null,
    currentSubTrace: string | null,
    traces: TraceMessage[],
    traceStepCounter: { [key: string]: number },
} {
    const [ currentTrace, setCurrentTrace ] = useState<any>(null);
    const [ currentSubTrace , setCurrentSubTrace ] = useState<any>(null)
    const [ messages, setMessages ] = useState<TraceMessage[]>([]);
    const [ traceStepCounter, setTraceStepCounter ] = useState<{ [key: string]: number }>({});
    const [ tracesProcessed, setTracesProcessed ] = useState<number>(0);
    const [ currentMessageId, setCurrentMessageId ] = useState<string>('');
    const [ messageTraceGroups, setMessageTraceGroups ] = useState<{[key: string]: {[key: string]: TraceMessage}}>({});

    useEffect(() => {
        if (conversationState &&
            Array.isArray(conversationState.traces) &&
            conversationState.traces.length > tracesProcessed) {
                // Get the current message ID to associate with this trace
                const msgId = conversationState.messages.length > 0 
                    ? conversationState.messages[conversationState.messages.length - 1].id 
                    : 'unknown';
                
                // Update current message ID if it changed
                if (msgId !== currentMessageId) {
                    setCurrentMessageId(msgId || '');
                    // Reset trace groups for new message
                    if (msgId) {
                        setMessageTraceGroups(prev => ({...prev, [msgId]: {}}));
                    }
                }
                
                processData(conversationState.traces.slice(-1)[0], msgId || '');
                setTracesProcessed((prevCount) => prevCount + 1);
            }
    }, [conversationState?.traces]);

    function processData(data: TraceData, messageId: string) {
      if (!data || !data.content) {
        return;
      }

      const traceContent = data.content;
      let traceType: string = 'UnknownAgent';
      let subTraceTitle: string = '';
      let displayContent: string | null = null;
      let fullJsonContent: string | null = null;

      // ~~~~~~~~~~~~~~~~~~~~~~~~~
      // Identify trace specifics
      // ~~~~~~~~~~~~~~~~~~~~~~~~~
      if (
        traceContent?.trace?.routingClassifierTrace?.observation
          ?.agentCollaboratorInvocationOutput
      ) {
        const collaboratorOutput =
          traceContent.trace.routingClassifierTrace.observation
            .agentCollaboratorInvocationOutput;
        traceType = collaboratorOutput.agentCollaboratorName || 'UnknownAgent';
        subTraceTitle = 'Observation';
        const outputText = collaboratorOutput.output?.text;
        displayContent = outputText || "No 'text' content available.";
        fullJsonContent = JSON.stringify(traceContent, null, 2);
      }
      else if (
        traceContent?.trace?.orchestrationTrace?.observation
          ?.agentCollaboratorInvocationOutput
      ) {
        const collaboratorOutput =
          traceContent.trace.orchestrationTrace.observation
            .agentCollaboratorInvocationOutput;
        traceType = collaboratorOutput.agentCollaboratorName || 'UnknownAgent';
        subTraceTitle = 'Observation';
        const outputText = collaboratorOutput.output?.text;
        displayContent = outputText || "No 'text' content available.";
        fullJsonContent = JSON.stringify(traceContent, null, 2);
      }
      else if (traceContent?.trace?.orchestrationTrace?.observation?.finalResponse) {
        subTraceTitle = 'Final Response';
        traceType = traceContent.collaboratorName || 'SupervisorAgent';
        const finalResponse =
          traceContent.trace.orchestrationTrace.observation.finalResponse;
        displayContent = finalResponse.text || "No 'text' content available.";
        fullJsonContent = JSON.stringify(traceContent, null, 2);
      }
      else if (traceContent?.trace?.routingClassifierTrace?.observation?.finalResponse) {
        subTraceTitle = 'Observation - Final Response';
        traceType = traceContent.collaboratorName || 'SupervisorAgent';
        const finalResponse =
          traceContent.trace.routingClassifierTrace.observation.finalResponse;
        displayContent = finalResponse.text || "No 'text' content available.";
        fullJsonContent = JSON.stringify(traceContent, null, 2);
      }
      else if (traceContent?.trace?.orchestrationTrace?.rationale) {
        subTraceTitle = 'Rationale';
        traceType = traceContent.collaboratorName || 'SupervisorAgent';
        const rationale = traceContent.trace.orchestrationTrace.rationale;
        displayContent = rationale.text || "No 'text' content available.";
        fullJsonContent = JSON.stringify(traceContent, null, 2);
      }
      else if (traceContent?.trace?.guardrailTrace) {
        subTraceTitle = 'Guardrail Check';
        traceType = 'Guardrails';
        const guardrailTrace = traceContent.trace.guardrailTrace;
        displayContent = `Action: ${guardrailTrace.action || 'NONE'}`;
        fullJsonContent = JSON.stringify(traceContent, null, 2);
      }
      else if (traceContent?.trace?.orchestrationTrace?.modelInvocationInput) {
        subTraceTitle = 'Invoking Model';
        traceType = traceContent.collaboratorName || 'SupervisorAgent';
        let inputText = traceContent.trace.orchestrationTrace.modelInvocationInput?.text;
        if (inputText) {
          try {
            const parsedJson = JSON.parse(inputText);
            inputText = JSON.stringify(parsedJson, null, 2);
          } catch {
            // keep raw
          }
        }
        displayContent = inputText || "No 'text' content available.";
        fullJsonContent = JSON.stringify(traceContent, null, 2);
      }
      else if (traceContent?.trace?.orchestrationTrace?.modelInvocationOutput) {
        subTraceTitle = 'Invoking Model';
        traceType = traceContent.collaboratorName || 'SupervisorAgent';
        let rawResponseContent =
          traceContent.trace.orchestrationTrace.modelInvocationOutput?.rawResponse
            ?.content;
        if (rawResponseContent) {
          try {
            const parsedJson = JSON.parse(rawResponseContent);
            rawResponseContent = JSON.stringify(parsedJson, null, 2);
          } catch {
            // keep raw
          }
        }
        displayContent = rawResponseContent || "No 'content' attribute found.";
        fullJsonContent = JSON.stringify(traceContent, null, 2);
      }
      else if (
        traceContent?.trace?.orchestrationTrace?.invocationInput
          ?.actionGroupInvocationInput
      ) {
        subTraceTitle = 'Action Group Tool';
        traceType =
          traceContent.collaboratorName ||
          traceContent.trace.orchestrationTrace.invocationInput
            .actionGroupInvocationInput?.actionGroupName ||
          'ActionGroup';
        const actionGroupInvocationInput =
          traceContent.trace.orchestrationTrace.invocationInput
            .actionGroupInvocationInput;
        const valueAttribute =
          actionGroupInvocationInput?.requestBody?.content?.['application/json']?.[0]?.value;
        displayContent = valueAttribute || "No 'value' content available.";
        fullJsonContent = JSON.stringify(traceContent, null, 2);
      }
      else if (
        traceContent?.trace?.orchestrationTrace?.observation
          ?.actionGroupInvocationOutput
      ) {
        traceType = traceContent.collaboratorName || 'ActionGroup';
        const actionGroupOutput =
          traceContent.trace.orchestrationTrace.observation
            .actionGroupInvocationOutput?.text;

        try {
          const parsedOutput = JSON.parse(actionGroupOutput as string);
          const dataRows = parsedOutput.result?.ResultSet?.Rows || [];
          const cleanedData = dataRows.map((row: any) =>
            row.Data?.map((d: any) => d.VarCharValue).join(' | ')
          );
          displayContent =
            cleanedData.join('\n') || "No 'text' content available.";
        } catch {
          displayContent = "Invalid JSON format in 'text' attribute.";
        }

        fullJsonContent = JSON.stringify(traceContent, null, 2);
      }
      else if (
        traceContent?.trace?.routingClassifierTrace?.invocationInput
          ?.agentCollaboratorInvocationInput
      ) {
        const agentName =
          traceContent.trace.routingClassifierTrace.invocationInput
            .agentCollaboratorInvocationInput?.agentCollaboratorName ||
          'AgentCollaborator';
        subTraceTitle = `Agent Invocation - ${agentName}`;
        traceType = 'ROUTING_CLASSIFIER';
        const inputText =
          traceContent.trace.routingClassifierTrace.invocationInput
            .agentCollaboratorInvocationInput?.input?.text;
        displayContent = inputText || "No 'input.text' content available.";
        fullJsonContent = JSON.stringify(traceContent, null, 2);
      }
      else if (traceContent?.trace?.routingClassifierTrace) {
        // Possibly model invocation input or output
        if (traceContent.trace.routingClassifierTrace.modelInvocationOutput) {
          subTraceTitle = 'Routing Classifier Decision';
          traceType = 'ROUTING_CLASSIFIER';
          let rawResponseContent =
            traceContent.trace.routingClassifierTrace.modelInvocationOutput
              ?.rawResponse?.content;
          if (rawResponseContent) {
            try {
              const parsedJson = JSON.parse(rawResponseContent);
              rawResponseContent = JSON.stringify(parsedJson, null, 2);
            } catch {
              // keep raw
            }
          }
          displayContent = rawResponseContent || "No 'content' attribute found.";
          fullJsonContent = JSON.stringify(traceContent, null, 2);
        } else {
          subTraceTitle = 'Classifying Intent';
          traceType = 'ROUTING_CLASSIFIER';
          let modelInputText =
            traceContent.trace.routingClassifierTrace.modelInvocationInput?.text;
          if (modelInputText) {
            try {
              const parsedJson = JSON.parse(modelInputText);
              modelInputText = JSON.stringify(parsedJson, null, 2);
            } catch {
              // keep raw
            }
          }
          displayContent = modelInputText || "No 'text' content available.";
          fullJsonContent = JSON.stringify(traceContent, null, 2);
        }
      }
      else if (
        traceContent?.trace?.orchestrationTrace?.invocationInput
          ?.knowledgeBaseLookupInput
      ) {
        subTraceTitle = 'Knowledge Base Input';
        traceType = traceContent.collaboratorName || 'KnowledgeBase';
        const knowledgeBaseInput =
          traceContent.trace.orchestrationTrace.invocationInput
            .knowledgeBaseLookupInput;
        displayContent = knowledgeBaseInput.text || "No 'text' content available.";
        fullJsonContent = JSON.stringify(traceContent, null, 2);
      }
      else if (
        traceContent?.trace?.orchestrationTrace?.observation
          ?.knowledgeBaseLookupOutput
      ) {
        subTraceTitle = 'Knowledge Base Response';
        traceType = traceContent.collaboratorName || 'KnowledgeBase';
        const knowledgeBaseOutput =
          traceContent.trace.orchestrationTrace.observation
            .knowledgeBaseLookupOutput?.retrievedReferences;
        displayContent =
          knowledgeBaseOutput
            ?.map((reference: any) => reference.content.text)
            .join('\n\n---\n\n') || "No 'text' content available.";
        fullJsonContent = JSON.stringify(traceContent, null, 2);
      }
      else if (
        traceContent?.trace?.orchestrationTrace?.invocationInput
          ?.agentCollaboratorInvocationInput
      ) {
        const agentName =
          traceContent.trace.orchestrationTrace.invocationInput
            .agentCollaboratorInvocationInput?.agentCollaboratorName ||
          'AgentCollaborator';
        subTraceTitle = `Agent Invocation - ${agentName}`;
        traceType = 'ROUTING_CLASSIFIER';
        const inputText =
          traceContent.trace.orchestrationTrace.invocationInput
            .agentCollaboratorInvocationInput?.input?.text;
        displayContent = inputText || "No 'input.text' content available.";
        fullJsonContent = JSON.stringify(traceContent, null, 2);
      }
      else if (traceContent.collaboratorName) {
        traceType = traceContent.collaboratorName;
        fullJsonContent = JSON.stringify(traceContent, null, 2);
      }

      if (!fullJsonContent) {
        fullJsonContent = JSON.stringify(traceContent || {}, null, 2);
      }

      // For "Observation," "Rationale," "Final Response," skip incrementing step
      const isRationaleFinalOrObservation =
        subTraceTitle === 'Rationale' ||
        subTraceTitle === 'Final Response' ||
        subTraceTitle === 'Observation' ||
        subTraceTitle === 'Observation - Final Response';

      const subTraceLabel = subTraceTitle;
      const currentTime = Date.now();

      // Optionally show current agent & subtrace in your UI
      setCurrentTrace(traceType || 'Unknown');
      setCurrentSubTrace(subTraceTitle || '');

      setMessages((prevMessages: Message[]) => {
        // Create a new array for the updated messages
        const updatedMessages = [...prevMessages];
        let modelName = '';

        // Check if we have a trace group for this message and component type
        // For Guardrails, we always want to create a new group
        const msgTraceGroups = messageTraceGroups[messageId] || {};
        const existingTraceGroup = traceType === 'Guardrails' ? null : msgTraceGroups[traceType];

        // Helper function to add subtasks
        const addSubTask = (
          parentTask: Task,
          subTaskTitle: string,
          subTaskContent: string | object,
          subTaskJson: string | null
        ) => {
          if (!parentTask.subTasks) {
            parentTask.subTasks = [];
          }
          parentTask.content = undefined;
          parentTask.fullJson = undefined;

          const subStepIndex = parentTask.subTasks.length + 1;
          const subTimeDifference = (
            ((currentTime - (parentTask.timestamp || currentTime)) /
            1000)
          ).toFixed(2);

          parentTask.subTasks.push({
            title: `Step ${parentTask.stepNumber || 0}.${subStepIndex} - ${subTaskTitle} (${subTimeDifference} seconds)`,
            content: subTaskContent,
            fullJson: subTaskJson,
            timestamp: currentTime
          });
        };

        // Create the task for this trace
        const stepNumber = existingTraceGroup 
          ? existingTraceGroup.tasks.length + 1 
          : 1;
          
        const taskTitle = isRationaleFinalOrObservation
          ? `${subTraceLabel} (0 seconds)`
          : `Step ${stepNumber} - ${
              subTraceLabel === 'Knowledge Base Input'
                ? 'Knowledge Base Tool'
                : subTraceLabel
            } (0 seconds)`;

        const newTask: Task = {
          stepNumber: isRationaleFinalOrObservation ? 0 : stepNumber,
          title: subTraceTitle ? taskTitle : `Step ${stepNumber} (0 seconds)`,
          content: displayContent || traceContent,
          fullJson: fullJsonContent,
          timestamp: currentTime,
          subTasks: undefined
        };

        // immediate sub-task creation
        if (subTraceTitle === 'Action Group Tool') {
          newTask.content = undefined;
          newTask.fullJson = undefined;
          newTask.subTasks = [
            {
              title: `Step ${stepNumber}.1 - Action Group Input (0 seconds)`,
              content: displayContent,
              fullJson: fullJsonContent,
              timestamp: currentTime
            }
          ];
        } else if (subTraceTitle === 'Knowledge Base Input') {
          newTask.content = undefined;
          newTask.fullJson = undefined;
          newTask.subTasks = [
            {
              title: `Step ${stepNumber}.1 - Knowledge Base Input (0 seconds)`,
              content: displayContent,
              fullJson: fullJsonContent,
              timestamp: currentTime
            }
          ];
        } else if (subTraceTitle === 'Invoking Model') {
          newTask.content = undefined;
          newTask.fullJson = undefined;
          newTask.subTasks = [
            {
              title: `Step ${stepNumber}.1 - Model Invocation Input (0 seconds)`,
              content: displayContent,
              fullJson: fullJsonContent,
              timestamp: currentTime
            }
          ];
        } else if (subTraceTitle === 'Observation') {
          newTask.content = undefined;
          newTask.fullJson = undefined;
          newTask.subTasks = [
            {
              title: `Step ${stepNumber}.1 - Observation (0 seconds)`,
              content: displayContent,
              fullJson: fullJsonContent,
              timestamp: currentTime
            }
          ];
        }

        if (traceType === 'ROUTING_CLASSIFIER' || modelName === 'Unknown Model') {
          modelName = '';
        }

        const showTitle = modelName
          ? `${traceType === 'ROUTING_CLASSIFIER' ? 'Routing Classifier' : traceType} - ${modelName}`
          : traceType === 'ROUTING_CLASSIFIER' ? 'Routing Classifier' : traceType;

        // Update trace step counter
        setTraceStepCounter((prev) => ({
          ...prev,
          [traceType]: (prev[traceType] || 0) + 1
        }));

        // If we found an existing trace group for this component type within this message
        // Special handling for Guardrails - don't group them together
        if (existingTraceGroup && traceType !== 'Guardrails') {
          // Add the new task to the existing trace group
          existingTraceGroup.tasks.push(newTask);
          
          // Update the duration in the dropdown title
          const duration = ((currentTime - existingTraceGroup.startTime) / 1000).toFixed(2);
          const stepCount = existingTraceGroup.tasks.filter(t => !isRationaleFinalOrObservation).length;
          
          existingTraceGroup.dropdownTitle = 
            `${showTitle} (${duration} seconds, ${stepCount} steps)`;
            
          // No need to add to updatedMessages as the reference is already there
        } else {
          // Generate a unique ID for this trace group that includes the message ID and component type
          const traceGroupId = `trace-group-${messageId}-${traceType}-${currentTime}-${Math.random().toString(36).substring(2, 9)}`;
          
          // Create a new trace group with a unique ID
          const newTraceGroup: TraceMessage = {
            id: traceGroupId,
            type: 'trace-group',
            dropdownTitle: `${showTitle} (0 seconds, ${
              isRationaleFinalOrObservation ? 0 : 1
            } steps)`,
            startTime: currentTime,
            tasks: [newTask],
            text: 'Sub-trace steps..',
            messageId: messageId,
            componentType: traceType
          };

          // Add the new trace group to the messages
          updatedMessages.push(newTraceGroup);
          
          // Store reference to this trace group for this message and component type
          setMessageTraceGroups(prev => ({
            ...prev, 
            [messageId]: {
              ...prev[messageId],
              [traceType]: newTraceGroup
            }
          }));
        }
        
        return updatedMessages;
      });
    }

    return { traces: messages, currentTrace, currentSubTrace, traceStepCounter };
  };
