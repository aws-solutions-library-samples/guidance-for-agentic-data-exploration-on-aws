import { SchemaTranslatorItem } from './types';
import { Header, Container, SpaceBetween, Box, Modal, Button } from '@cloudscape-design/components';
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import './schema-translator.css';

interface GraphData {
    nodes: Array<{
        id: string;
        name: string;
    }>;
    links: Array<{
        source: string;
        target: string;
        label: string;
    }>;
}

export function SchemaTranslatorDetailComponent ({ item }:{ item: SchemaTranslatorItem }) {
    const mainItems = [
        {
            label: "Timestamp",
            value: new Date(item.timestamp).toLocaleString()
        },
        {
            label: "Batch ID",
            value: item.id
        },  
    ];

    // Graph visualization state and refs
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [modalDimensions, setModalDimensions] = useState({ width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const modalContainerRef = useRef<HTMLDivElement>(null);
    const fgRef = useRef<any>(null);
    const modalFgRef = useRef<any>(null);
    const [graphData, setGraphData] = useState<GraphData>({
        nodes: [],
        links: []
    });
    
    // Modal state
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Parse the translated schema to extract nodes and links
    const updateGraphData = useCallback((content: string) => {
        if (!content.trim()) {
            setGraphData({
                nodes: [],
                links: []
            });
            return;
        }

        const nodes = new Set<string>();
        const links: GraphData['links'] = [];
        
        // Log the content for debugging
        // console.log("Parsing schema content:", content);
        
        const lines = content.split('\n');
        
        // Try multiple regex patterns to match different possible formats
        lines.forEach(line => {
            // Original format with flexible spacing: [Entity] —(relationship)→ [Entity]
            let match = line.match(/\[([^\]]+)\]\s*—\s*\(([^\)]+)\)\s*→\s*\[([^\]]+)\]/);
            
            if (match) {
                const [_, source, relation, target] = match;
                nodes.add(source);
                nodes.add(target);
                links.push({
                    source,
                    target,
                    label: relation
                });
                // console.log(`Found relationship: ${source} -[${relation}]-> ${target}`);
            } else if (line.trim() && !line.startsWith('//') && !line.startsWith('#')) {
                // If line has content but didn't match any pattern, log it for debugging
                console.log("No match for line:", line);                
            }
        });
        
        const graphData = {
            nodes: Array.from(nodes).map(id => ({ id, name: id })),
            links
        };
        
        // console.log("Generated graph data:", graphData);
        setGraphData(graphData);
    }, []);

    // Update graph data when the translated schema changes
    useEffect(() => {
        // console.log("Schema results changed:", item.results);
        updateGraphData(item.results);
    }, [item.results, updateGraphData]);

    // Handle container resizing
    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.contentBoxSize) {
                    // For browsers that support contentBoxSize
                    const contentBoxSize = Array.isArray(entry.contentBoxSize) 
                        ? entry.contentBoxSize[0] 
                        : entry.contentBoxSize;
                    
                    const width = contentBoxSize.inlineSize;
                    const height = contentBoxSize.blockSize;
                    
                    setDimensions({ width, height });
                } else {
                    // Fallback for browsers that don't support contentBoxSize
                    const { width, height } = entry.contentRect;
                    setDimensions({ width, height });
                }
                
                // Refresh graph on container resize
                setTimeout(() => {
                    if (fgRef.current) {
                        fgRef.current.d3ReheatSimulation();
                    }
                }, 100);
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);
    
    // Handle modal container resizing
    useEffect(() => {
        if (!modalContainerRef.current || !isModalVisible) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.contentBoxSize) {
                    // For browsers that support contentBoxSize
                    const contentBoxSize = Array.isArray(entry.contentBoxSize) 
                        ? entry.contentBoxSize[0] 
                        : entry.contentBoxSize;
                    
                    const width = contentBoxSize.inlineSize;
                    const height = contentBoxSize.blockSize;
                    
                    setModalDimensions({ width, height });
                } else {
                    // Fallback for browsers that don't support contentBoxSize
                    const { width, height } = entry.contentRect;
                    setModalDimensions({ width, height });
                }
                
                // Refresh graph on container resize
                setTimeout(() => {
                    if (modalFgRef.current) {
                        modalFgRef.current.d3ReheatSimulation();
                        modalFgRef.current.zoomToFit(400, 50);
                    }
                }, 100);
            }
        });

        resizeObserver.observe(modalContainerRef.current);
        return () => resizeObserver.disconnect();
    }, [isModalVisible]);

    return (
        <div data-testid="details">
            <SpaceBetween size="m">
                <Header variant='h1'>
                    {item.id}
                </Header>   
                <ColumnLayout columns={1} variant="text-grid">
                    <Container>
                        <KeyValuePairs columns={2} items={mainItems} />
                    </Container>
                </ColumnLayout>
                
                <ColumnLayout columns={1} variant="text-grid">
                    <Container header={<Header variant='h2'>Graph Schema</Header>}>
                        <div style={{ display: 'flex', flexDirection: 'row', gap: '20px' }}>
                            {/* Graph visualization */}
                            <div style={{ flex: 1, minWidth: '50%', position: 'relative' }}>
                                <div 
                                    ref={containerRef}
                                    data-testid="graph-preview-container"
                                    style={{ 
                                        height: '400px',
                                        width: '100%',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        border: '1px solid #eaeded',
                                        borderRadius: '4px'
                                    }}
                                >
                                    <ForceGraph2D
                                        ref={fgRef}
                                        width={dimensions.width}
                                        height={dimensions.height}
                                        graphData={graphData}
                                        nodeLabel="name"
                                        nodeAutoColorBy="id"
                                        data-testid="force-graph"
                                        linkLabel="label"
                                        backgroundColor="#ffffff"
                                        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                                            // Draw node circle
                                            ctx.beginPath();
                                            ctx.arc(node.x!, node.y!, 5, 0, 2 * Math.PI);
                                            ctx.fillStyle = node.color || '#1E88E5';
                                            ctx.fill();

                                            // Draw node label
                                            const label = node.name;
                                            const fontSize = 14/globalScale;
                                            ctx.font = `${fontSize}px Sans-Serif`;
                                            ctx.textAlign = 'center';
                                            ctx.textBaseline = 'middle';
                                            ctx.fillStyle = '#000';
                                            ctx.fillText(label, node.x!, node.y! + 8);
                                        }}
                                        linkDirectionalArrowLength={4.5}
                                        linkDirectionalArrowRelPos={1}
                                        d3AlphaDecay={0.005}
                                        linkCurvature={0}
                                        cooldownTicks={100}
                                        onEngineStop={() => {
                                            const fg = fgRef.current as any;
                                            if (fg) {
                                                fg.zoomToFit(400, 50);
                                            }
                                        }}
                                    />
                                    <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 100 }}>
                                        <Button 
                                            iconName="external" 
                                            variant="normal" 
                                            onClick={() => setIsModalVisible(true)}
                                            ariaLabel="Expand graph view"
                                        >
                                            
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Text representation */}
                            <div style={{ 
                                flex: 1, 
                                minWidth: '50%', 
                                maxHeight: '400px', 
                                overflowY: 'auto', 
                                border: '1px solid #eaeded', 
                                borderRadius: '4px', 
                                padding: '10px',
                                position: 'relative'
                            }}>
                                <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 100 }}>
                                <Button
                                    iconName="copy"
                                    ariaLabel="Copy graph schema to clipboard"
                                    onClick={() => {
                                        if (item.results) {
                                            navigator.clipboard.writeText(item.results)
                                                .then(() => {
                                                    // Add visual feedback
                                                    const btn = document.querySelector('[aria-label="Copy graph schema to clipboard"]');
                                                    if (btn) {
                                                        btn.setAttribute('data-copied', 'true');
                                                        setTimeout(() => {
                                                            btn.removeAttribute('data-copied');
                                                        }, 2000);
                                                    }
                                                })
                                                .catch(err => console.error('Failed to copy: ', err));
                                        }
                                    }}
                                />
                                </div>                                
                                <Box variant="p">{item.results.split('\n').map((line, i) => (
                                    <React.Fragment key={i}>
                                        {line}
                                        <br />
                                    </React.Fragment>
                                ))}</Box>
                            </div>
                        </div>                             
                    </Container>
                </ColumnLayout>                
                
                <ColumnLayout columns={1} variant="text-grid">
                    <Container header={<Header variant='h2'>Original Input</Header>}>
                        <Box variant="p">{item.input.split('\n').map((line, i) => (
                            <React.Fragment key={i}>
                                {line}
                                <br />
                            </React.Fragment>
                        ))}</Box>                    
                    </Container>
                </ColumnLayout>                
            </SpaceBetween>
            
            {/* Modal for expanded graph view */}
            <Modal
                visible={isModalVisible}
                onDismiss={() => setIsModalVisible(false)}
                size="large"
                header={<Header variant="h2">Graph Schema Visualizer</Header>}
            >
                <div 
                    ref={modalContainerRef}
                    style={{ 
                        height: '70vh',
                        width: '100%',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    <ForceGraph2D
                        ref={modalFgRef}
                        width={modalDimensions.width}
                        height={modalDimensions.height}
                        graphData={graphData}
                        nodeLabel="name"
                        nodeAutoColorBy="id"
                        linkLabel="label"
                        backgroundColor="#ffffff"
                        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                            // Draw node circle
                            ctx.beginPath();
                            ctx.arc(node.x!, node.y!, 6, 0, 2 * Math.PI);
                            ctx.fillStyle = node.color || '#1E88E5';
                            ctx.fill();

                            // Draw node label
                            const label = node.name;
                            const fontSize = 16/globalScale;
                            ctx.font = `${fontSize}px Sans-Serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillStyle = '#000';
                            ctx.fillText(label, node.x!, node.y! + 10);
                        }}
                        linkDirectionalArrowLength={5}
                        linkDirectionalArrowRelPos={1}
                        d3AlphaDecay={0.005}
                        linkCurvature={0}
                        cooldownTicks={100}
                        onEngineStop={() => {
                            const fg = modalFgRef.current as any;
                            if (fg) {
                                fg.zoomToFit(400, 50);
                            }
                        }}
                    />
                </div>
                <Box margin={{ top: "l" }}>
                    <Button onClick={() => setIsModalVisible(false)}>Close</Button>
                </Box>
            </Modal>
        </div>
    );
}
