import React, { useState, useEffect } from 'react';
import AppLayout from '@cloudscape-design/components/app-layout';
import { BreadcrumbGroup } from "@cloudscape-design/components";
import { I18nProvider } from '@cloudscape-design/components/i18n';
import HelpPanel from "@cloudscape-design/components/help-panel";
import Header from "@cloudscape-design/components/header"; 
import { ServiceNavigation } from '../side-navigation';
import { SchemaEditor } from './content';
import { GraphPreview } from './split-panel';
import { SchemaHandler } from '../../utils/schema-handler';

export function GraphSchemaEditor() {
    const [toolsOpen, setToolsOpen] = useState(false);
    const [splitPanelOpen, setSplitPanelOpen] = useState(false);
    const [schemaContent, setSchemaContent] = useState("");
    const [workingContent, setWorkingContent] = useState(""); 
    const [graphKey, setGraphKey] = useState(0); 
    const [isInitialized, setIsInitialized] = useState(false);

    const breadcrumbItems = [
        { text: "Home", href: "/" },
        { text: "Graph Schema Editor", href: "/schema-editor" }
    ];

    // Load schema on component mount
    useEffect(() => {
        const loadSchema = async () => {
            console.debug('Loading schema from index component...');
            try {
                const result = await SchemaHandler.downloadSchema();
                if (result.success) {
                    console.debug('Setting initial schema content. Length:', result.content.length);
                    setSchemaContent(result.content);
                    setWorkingContent(result.content);
                    setIsInitialized(true);
                } else {
                    console.error('Failed to load schema:', result.error);
                }
            } catch (err) {
                console.error('Error loading schema:', err);
            }
        };

        if (!isInitialized) {
            loadSchema();
        }
    }, [isInitialized]);

    const handleSplitPanelToggle = ({ detail }: { detail: { open: boolean } }) => {
        setSplitPanelOpen(detail.open);
        if (detail.open) {
            // Force graph refresh when opening the panel
            setGraphKey(prev => prev + 1);
        }
    };

    const i18nMessages = {
        'en': {
            'app-layout': {
                'navigationAriaLabel': {
                    value: "Side navigation"
                },
                'navigationClose': {
                    value: "Close navigation"
                },
                'navigationToggle': {
                    value: "Open navigation"
                },
                'notificationBarAriaLabel': {
                    value: "Notifications"
                },
                'notificationBarText': {
                    value: "Notifications"
                },
                'toolsAriaLabel': {
                    value: "Help panel"
                },
                'toolsClose': {
                    value: "Close help panel"
                },
                'toolsToggle': {
                    value: "Open help panel"
                },
                'splitPanelAriaLabel': {
                    value: "Graph preview panel"
                },
                'splitPanelClose': {
                    value: "Close graph preview"
                },
                'splitPanelToggle': {
                    value: "Open graph preview"
                }
            }
        }
    };

    const handleSchemaUpdate = (content: string) => {
        console.log('Schema updated:', content);
    };

    const HelpPanelContent = () => (
        <div>
            <p>This is the schema editor help content.</p>
            <p>Use the editor to define relationships between entities in your graph.</p>
            <p>Format: [Entity]—(RELATIONSHIP)→[Entity]</p>
        </div>
    );

    return (
        <I18nProvider messages={[i18nMessages]}>
            <AppLayout
                navigation={<ServiceNavigation />}
                breadcrumbs={<BreadcrumbGroup items={breadcrumbItems} />}
                content={
                    <SchemaEditor 
                        schemaContent={workingContent}
                        setSchemaContent={(content) => {
                            console.debug('Setting working content:', content.length);
                            setWorkingContent(content);
                        }}
                        savedContent={schemaContent}
                        onSave={(content) => {
                            console.debug('Saving schema content:', content.length);
                            setSchemaContent(content);
                            setWorkingContent(content);
                            // Force graph refresh when saving
                            setGraphKey(prev => prev + 1);
                        }}
                    />
                }
                disableContentPaddings={false}
                toolsHide={false}
                tools={
                    <HelpPanel 
                        header={
                            <Header
                                variant="h2"
                            >
                                Schema Editor
                            </Header>
                        }
                    >
                        <HelpPanelContent />
                    </HelpPanel>
                }
                toolsOpen={toolsOpen}
                onToolsChange={({ detail }) => setToolsOpen(detail.open)}
                splitPanel={
                    <GraphPreview 
                        schemaContent={schemaContent}
                        key={graphKey}
                        onSplitPanelToggle={handleSplitPanelToggle}
                    />
                }
                splitPanelOpen={splitPanelOpen}
                onSplitPanelToggle={handleSplitPanelToggle}
            />
        </I18nProvider>
    );
}
