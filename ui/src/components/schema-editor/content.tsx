import { useState, useEffect, useCallback } from 'react';
import Box from "@cloudscape-design/components/box";
import Header from "@cloudscape-design/components/header";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Alert from "@cloudscape-design/components/alert";
import { SchemaHandler } from '../../utils/schema-handler';
import Textarea from "@cloudscape-design/components/textarea";
import './schema-editor.css';

interface SchemaEditorProps {
    schemaContent: string;
    setSchemaContent: (content: string) => void;
    savedContent: string;
    onSave: (content: string) => void;
}

interface SchemaValidationError {
    row: number;
    column: number;
    text: string;
    type: "error" | "warning" | "info";
}

interface Notification {
    id: string;
    type: "success" | "error";
    message: string;
}

export function SchemaEditor({ 
    schemaContent, 
    setSchemaContent, 
    savedContent,
    onSave 
}: SchemaEditorProps) {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Skip initial load if content is already provided from parent
    useEffect(() => {
        if (schemaContent && !initialLoadComplete) {
            setInitialLoadComplete(true);
        }
    }, [schemaContent, initialLoadComplete]);

    // Debug logging for schema content
    useEffect(() => {
        console.debug('schemaContent updated:', schemaContent?.length);
        console.debug('savedContent:', savedContent?.length);
    }, [schemaContent, savedContent]);

    // Track unsaved changes
    useEffect(() => {
        if (initialLoadComplete) {
            const hasChanges = schemaContent !== savedContent;
            console.debug('Checking for unsaved changes:', hasChanges);
            console.debug('Current content length:', schemaContent?.length);
            console.debug('Saved content length:', savedContent?.length);
            setHasUnsavedChanges(hasChanges);
        }
    }, [schemaContent, savedContent, initialLoadComplete]);
    
    const addNotification = useCallback((type: "success" | "error", message: string) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setNotifications(prev => [...prev, { type, message, id }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    }, []);

    const validateSchema = (schema: string): { isValid: boolean; errors: { line: number; messages: string[] }[]; normalizedContent?: string } => {
        const errorMap = new Map<number, string[]>();
        
        // Normalize the content first
        let normalizedContent = schema;
        
        // Replace various arrow combinations with the correct symbol
        const arrowVariations = [')>[', ')->[', ') ->[', ')-> ['];
        arrowVariations.forEach(variant => {
            normalizedContent = normalizedContent.replaceAll(variant, ')→[');
        });
    
        // Replace various dash combinations with the correct symbol
        const dashVariations = [']-(', '] -(', ']--(', '] --('];
        dashVariations.forEach(variant => {
            normalizedContent = normalizedContent.replaceAll(variant, ']—(');
        });
    
        // Remove all spaces from the content
        normalizedContent = normalizedContent.split('\n')
            .map(line => line.trim().replace(/\s+/g, ''))
            .filter(line => line.length > 0) // Remove empty lines
            .join('\n');
    
        const lines = normalizedContent.split('\n');
        
        // Regex for valid line format: [Block1]—(Relation)→[Block2]
        const lineRegex = /^\[([^\s\[\]]+)\]—\(([^\s\(\)]+)\)→\[([^\s\[\]]+)\]$/;
        
        lines.forEach((line, index) => {
            if (line.trim() === '') return; // Skip empty lines
            
            const lineNumber = index + 1;
            const errors: string[] = [];
    
            if (!lineRegex.test(line.trim())) {
                // Collect all errors for this line
                if (!line.includes('—(')) {
                    errors.push('Missing correct dash before relation');
                }
                if (!line.includes(')→')) {
                    errors.push('Missing correct arrow');
                }
                if ((line.match(/\[/g) || []).length !== 2) {
                    errors.push('Should have exactly two blocks in square brackets');
                }
                if ((line.match(/\(/g) || []).length !== 1) {
                    errors.push('Should have exactly one relation in parentheses');
                }
                
                if (errors.length === 0) {
                    errors.push('Invalid format');
                }
    
                errorMap.set(lineNumber, errors);
            }
        });
    
        // Convert error map to array of formatted errors
        const formattedErrors = Array.from(errorMap.entries()).map(([line, messages]) => ({
            line,
            messages
        }));
    
        return {
            isValid: formattedErrors.length === 0,
            errors: formattedErrors,
            normalizedContent
        };
    };
    
    const handleSave = async () => {
        console.debug('Starting save operation...');
        try {
            setSaving(true);
            setError("");
            
            // Validate schema before saving
            const validation = validateSchema(schemaContent);
            
            // If content was normalized, update the text area
            if (validation.normalizedContent && validation.normalizedContent !== schemaContent) {
                setSchemaContent(validation.normalizedContent);
                addNotification('success', 'Schema format has been automatically corrected');
            }
    
            if (!validation.isValid) {
                const errorMessage = [
                    'Schema validation failed:',
                    '',
                    ...validation.errors.map(error => 
                        `Line ${error.line}:\n${error.messages.map(msg => `  • ${msg}`).join('\n')}`
                    )
                ].join('\n');
                throw new Error(errorMessage);
            }
    
            // Use the normalized content for upload
            const contentToSave = validation.normalizedContent || schemaContent;
            
            // Clear the cache before uploading to ensure we get a fresh copy next time
            SchemaHandler.clearCache();
            
            const uploadResult = await SchemaHandler.uploadSchema(contentToSave);
            
            if (!uploadResult.success) {
                throw new Error(uploadResult.error || 'Failed to upload schema');
            }
            
            // Only call onSave if the upload was successful
            onSave(contentToSave);
            setHasUnsavedChanges(false);
            console.debug('Save operation completed successfully');
            setError("");
            addNotification('success', 'Schema saved successfully');
        } catch (err: any) {
            console.error('Save operation failed:', err);
            setError(err.message || 'Failed to save schema');
            addNotification('error', err.message || 'Failed to save schema');
        } finally {
            setSaving(false);
        }
    };
    
    useEffect(() => {
        const loadSchema = async () => {
            console.debug('Starting to load schema...');
            try {
                setLoading(true);
                
                // Clear the cache to ensure we get a fresh copy
                SchemaHandler.clearCache();
                
                const result = await SchemaHandler.downloadSchema();

                if (result.success) {
                    console.debug('Setting schema content. Length:', result.content.length);
                    setSchemaContent(result.content);
                    onSave(result.content); 
                    setError("");
                } else {
                    console.error('Failed to load schema:', result.error);
                    setError(result.error || "Failed to load schema");
                    addNotification('error', result.error || "Failed to load schema");
                }
            } catch (err: any) {
                console.error('Error in loadSchema:', err);
                setError("Failed to load schema: " + err.message);
                addNotification('error', "Failed to load schema: " + err.message);
            } finally {
                setLoading(false);
                setInitialLoadComplete(true);
            }
        };

        // Only load if we don't already have content and haven't completed initial load
        if (!initialLoadComplete) {
            loadSchema();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialLoadComplete]); // Only depend on initialLoadComplete to prevent loops

    const handleRetry = useCallback(() => {
        setLoading(true);
        // Retry loading the editor
        setTimeout(() => {
            setLoading(false);
        }, 100);
    }, []);

    return (
        <SpaceBetween size="m">
            <Header
                variant="h1"
                description="Edit the schema that defines the structure of your knowledge graph."
                data-testid="schema-editor-header"
            >
                Schema Editor
            </Header>
            
            <SpaceBetween size="xs">
                {notifications.map(notification => (
                    <Alert
                        key={notification.id}
                        type={notification.type}
                        data-testid="schema-notification"
                        dismissible
                        onDismiss={() => {
                            setNotifications(prev => 
                                prev.filter(n => n.id !== notification.id)
                            );
                        }}
                    >
                        {notification.message}
                    </Alert>
                ))}
            </SpaceBetween>

            <Box>
                <div className="schema-editor-container">
                    <div className="textarea-container">
                        {hasUnsavedChanges && <div className="textarea-unsaved-overlay"></div>}
                        <Textarea
                            onChange={({ detail }) => {
                                console.debug('Textarea onChange:', detail.value.length);
                                setSchemaContent(detail.value);
                                // Clear any previous errors when user makes changes
                                if (error) setError("");
                            }}
                            value={schemaContent || ""}
                            placeholder="Enter your schema here..."
                            rows={20}
                            disabled={loading}
                            data-testid="schema-editor-textarea"
                        />
                    </div>
                </div>
            </Box>
            <Box float="left">
                <SpaceBetween direction="horizontal" size="xs">
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        loading={saving}
                        disabled={loading || saving}
                        data-testid="schema-save-button"
                    >
                        Save Schema
                    </Button>
                    {hasUnsavedChanges && (
                        <div className="unsaved-changes-text">
                            You have unsaved changes
                        </div>
                    )}
                </SpaceBetween>
            </Box>
        </SpaceBetween>
    );
}
