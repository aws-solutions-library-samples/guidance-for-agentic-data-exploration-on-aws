import React, { FormEvent, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormField, Link, Button } from '@cloudscape-design/components';
import PromptInput from '@cloudscape-design/components/prompt-input';
import SpaceBetween from '@cloudscape-design/components/space-between';

interface UserInputProps extends React.HTMLAttributes<HTMLInputElement> {
    disabled: boolean
    handleSubmit: (e: string) => void
    handleFileSelection: (files: File[]) => void
    acceptsFileTypes: string
    showTraces: boolean
    setShowTraces: (showTraces: boolean) => void
}

export function UserInputComponent(props:UserInputProps) {
    const [tracesOn, setTracesOn] = useState<boolean>(false); // Initialize to false by default
    const [inputMessage, setInputMessage] = useState<string>('');
    const { handleSubmit } = useForm();
    const [showPromptGroup, setShowPromptGroup] = useState<boolean>(false);

    // Support prompt groups
    const supportPrompts = [
      { title: "Graph Summary", prompts: [
        "Show me the graph summary",
      ]},
      { title: "Graph Query", prompts: [
        "Provide a comprehensive list of all Facilities",
        "Show the top performing Suppliers based on their Supplier KPIs",
      ]},
      { title: "Data Visualizer", prompts: [
        "Create a word cloud using the following content:",
        "Generate a bar chart with the following data:",
      ]},            
      { title: "Data Analyzer", prompts: [
        "Analyze all files located at analyze/example/"
      ]},
      { title: "Schema Translator", prompts: [
        "Create a graph schema from the following relational schema: ",
      ]},
      { title: "Graph DB Bulk Loader", prompts: [
        "Bulk load data from [[S3 Prefix]]",
        "Bulk load data from output-edges/",
        "What is the status of Bulk Load Job [[JOB ID]]"
      ]},
      { title: "Synthetic Data", prompts: [
        `Generate synthetic data for company that manufactures steel using this schema:
        [Products] —(CONTAINS)→ [Parts] 
        [Customers] —(PLACES)→ [SalesOrders] 
        [SalesOrders] —(REFERENCES)→ [Products]`
      ]},
      { title: "Weather Data", prompts: [
        "What's the weather forecast for Seattle this week?",
        "What was the temperature in New York last week?",
      ]},
      { title: "SAP Order Status", prompts: [
        "What is the status of SAP order 1234567?",
        "Show me all SAP orders for customer ABC Corp",
      ]},
    ];

    const onSubmit = (e: FormEvent) => {
      e.preventDefault();
      if (inputMessage.trim() !== '') {
        props.handleSubmit(inputMessage);
        setInputMessage('');
      }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        props.handleFileSelection(Array.from(e.target.files));
        // Reset the file input
        e.target.value = '';
      }
    };

    // Custom AccessibleFileInput component implementation
    const AccessibleFileInput = () => {
        return (
          <>
            <Button
              iconName="upload"
              variant="icon"
              onClick={() => document.getElementById('file-input')?.click()}
              ariaLabel="Upload file"
            />
            <input
              id="file-input"
              type="file"
              style={{ display: 'none' }}
              multiple
              accept={props.acceptsFileTypes}
              onChange={handleFileInputChange}
            />
          </>
        );
      };
    
    // Custom SupportPromptGroup component implementation
    const SupportPromptGroup = () => {
      return (
        <div className="custom-support-prompt-group">
          <Button
            iconName="suggestions"
            variant="icon"
            onClick={() => setShowPromptGroup(!showPromptGroup)}
            ariaLabel="Show prompt suggestions"
          />
          {showPromptGroup && (
            <div className="support-prompt-overlay" onClick={() => setShowPromptGroup(false)}>
              <div 
                className="support-prompt-container" 
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  bottom: '60px',
                  left: '10px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 0 10px rgba(0,0,0,0.2)',
                  padding: '16px',
                  zIndex: 1000,
                  maxWidth: '400px',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0 }}>Select a prompt</h3>
                  <Button
                    iconName="close"
                    variant="icon"
                    onClick={() => setShowPromptGroup(false)}
                    ariaLabel="Close prompt suggestions"
                  />
                </div>
                
                {supportPrompts.map((group, groupIndex) => (
                  <div key={groupIndex} style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#545b64' }}>{group.title}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {group.prompts.map((prompt, promptIndex) => (
                        <Button
                          key={promptIndex}
                          variant="link"
                          onClick={() => {
                            setInputMessage(prompt);
                            setShowPromptGroup(false);
                          }}
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    };

    return (
        <form onSubmit={handleSubmit(() => {
            props.handleSubmit(inputMessage)
            setInputMessage('')
        })}>
        <FormField
        stretch
        constraintText={
          <>
            Use of this service is subject to the{' '}
            <Link href="https://aws.amazon.com/ai/responsible-ai/policy/" external variant="primary" fontSize="inherit">
              AWS Responsible AI Policy
            </Link>
            .
          </>
        }
      >
      <PromptInput
        onChange={(e) => setInputMessage(e.detail.value)}
        value={inputMessage}
        actionButtonAriaLabel={props.disabled ? 'Send message button - suppressed' : 'Send message'}
        actionButtonIconName="send"
        ariaLabel={props.disabled ? 'Prompt input - suppressed' : 'Prompt input'}
        placeholder="Ask a question"
        minRows={2}
        autoFocus
        disabled={props.disabled}
        disableSecondaryActionsPaddings
        secondaryActions={
          <>
          <SpaceBetween direction="horizontal" size="s">
            <SupportPromptGroup />
            <AccessibleFileInput />
            <Button 
              variant="icon" 
              iconName={tracesOn ? "zoom-out" : "zoom-in"}  
              onClick={(e) => {
                e.preventDefault(); // Prevent form submission
                const newValue = !tracesOn;
                setTracesOn(newValue);
                props.setShowTraces(newValue); // Directly call parent setter for immediate effect
              }}
              ariaLabel={tracesOn ? "Hide agent traces" : "Show agent traces"}
            />
          </SpaceBetween>
          </>
      }
      />
    </FormField>
    </form>
)

}
