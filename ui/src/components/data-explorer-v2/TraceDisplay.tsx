import React from 'react';
import { Task } from './types';
import { Box, ExpandableSection, SpaceBetween, Container, Header } from '@cloudscape-design/components';
import { MarkdownRenderer } from '../data-explorer-v2/Message';
import jsonHighlight from "@cloudscape-design/code-view/highlight/json";
import CodeView from "@cloudscape-design/code-view/code-view";
import CopyToClipboard from '@cloudscape-design/components';
import './trace-styles.css';

interface TraceDisplayProps {
  tasks: Task[];
  agentName: string;
  duration: string;
}

export const TraceDisplay: React.FC<TraceDisplayProps> = ({ tasks, agentName, duration }) => {
  // Function to render JSON with syntax highlighting
  const renderJsonWithSyntaxHighlighting = (json: any) => {
    if (!json) return null;
    
    // Convert JSON object to a properly formatted string
    const jsonString = typeof json === 'string' ? json : JSON.stringify(json, null, 2);
    
    return (
      <CodeView 
        content={jsonString} 
        highlight={jsonHighlight}
        wrapLines={true}
        lineNumbers={true}
      />
    );
  };

  // Helper function to determine if content is JSON
  const isJsonObject = (content: any): boolean => {
    return typeof content === 'object' && content !== null;
  };

  // Helper function to try parsing JSON strings
  const tryParseJson = (content: any): any => {
    if (typeof content !== 'string') return content;
    
    try {
      // Check if it looks like JSON (starts with { or [)
      if ((content.trim().startsWith('{') && content.trim().endsWith('}')) || 
          (content.trim().startsWith('[') && content.trim().endsWith(']'))) {
        
        // First attempt: try standard JSON parsing
        try {
          const parsed = JSON.parse(content);
          return parsed;
        } catch (parseError) {
          // If standard parsing fails, try a more lenient approach
          // This is a fallback for malformed JSON with bad escape sequences
          try {
            // Replace common problematic escape sequences
            const sanitizedContent = content
              .replace(/\\(?!["\\/bfnrt])/g, '\\\\') // Fix invalid escapes
              .replace(/\n/g, '\\n')                // Fix newlines
              .replace(/\r/g, '\\r')                // Fix carriage returns
              .replace(/\t/g, '\\t')                // Fix tabs
              .replace(/\f/g, '\\f');               // Fix form feeds
            
            const parsed = JSON.parse(sanitizedContent);
            return parsed;
          } catch (fallbackError) {
            // If all parsing attempts fail, log and return original
            console.log('Failed to parse JSON string even after sanitization:', parseError);
            return content;
          }
        }
      }
    } catch (e) {
      // If any other error occurs, return the original content
      console.log('Error in JSON processing:', e);
    }
    
    return content;
  };

  // Function to render content with appropriate formatting
  const renderContent = (content: any) => {
    // First try to parse if it's a JSON string
    const processedContent = tryParseJson(content);
    
    // If it's an object after parsing or was already an object, use JSON viewer
    if (isJsonObject(processedContent)) {
      try {
        // Convert the object to a properly formatted JSON string before rendering
        const jsonString = JSON.stringify(processedContent, null, 2);
        return renderJsonWithSyntaxHighlighting(jsonString);
      } catch (renderError) {
        console.log('Error rendering JSON with syntax highlighting:', renderError);
        // Fallback to string representation if JSON viewer fails
        return <MarkdownRenderer content={`\`\`\`json\n${JSON.stringify(processedContent, null, 2)}\n\`\`\``} />;
      }
    }
    
    // Otherwise use markdown renderer
    return <MarkdownRenderer content={typeof content === 'string' ? content : JSON.stringify(content, null, 2)} />;
  };

  // Filter out non-step tasks (like Rationale, Final Response, etc.)
  const stepTasks = tasks.filter(
    task => !task.title.startsWith('Rationale') && 
            !task.title.startsWith('Final Response') && 
            !task.title.includes('Observation')
  );

  // Special tasks like Rationale, Final Response
  const specialTasks = tasks.filter(
    task => task.title.startsWith('Rationale') || 
            task.title.startsWith('Final Response') || 
            task.title.includes('Observation')
  );

  return (
    <Box padding="s">
      <ExpandableSection 
        headerText={`${agentName === 'ROUTING_CLASSIFIER' ? 'Routing Classifier' : agentName} (${duration} seconds, ${stepTasks.length} steps)`}
        variant="inline"
        defaultExpanded={false}
      >
        <SpaceBetween size="m">
          {/* Display steps in a sequential format */}
          <Box>
            {stepTasks.map((task, index) => {
              const isLastStep = index === stepTasks.length - 1;
              const stepTitle = task.title.split(' - ')[1]?.split(' (')[0] || task.title;
              
              return (
                <div key={index} className="trace-step">
                  <Container
                    header={
                      <Header variant="h3" className="trace-step-header">
                        Step {index + 1}: {stepTitle}
                      </Header>
                    }
                  >
                    <Box>
                      {task.content && (
                        <Box>
                          {renderContent(task.content)}
                        </Box>
                      )}
                      
                      {task.subTasks && task.subTasks.length > 0 && (
                        <SpaceBetween size="xs">
                          {task.subTasks.map((subTask, subIndex) => (
                            <Box key={subIndex} padding="s" className="subtask-content">
                              <div className="subtask-header">{subTask.title.split(' - ')[1]?.split(' (')[0] || subTask.title}</div>
                              <Box padding="xs">
                                {renderContent(subTask.content)}
                              </Box>
                            </Box>
                          ))}
                        </SpaceBetween>
                      )}
                    </Box>
                  </Container>
                </div>
              );
            })}
          </Box>
          
          {specialTasks.length > 0 && (
            <Box>
              <SpaceBetween size="s">
                {specialTasks.map((task, index) => (
                  <ExpandableSection 
                    key={index} 
                    headerText={task.title.split(' (')[0]}
                  >
                    <Box padding="s">
                      {renderContent(task.content)}
                    </Box>
                  </ExpandableSection>
                ))}
              </SpaceBetween>
            </Box>
          )}
        </SpaceBetween>
      </ExpandableSection>
    </Box>
  );
};

export default TraceDisplay;
