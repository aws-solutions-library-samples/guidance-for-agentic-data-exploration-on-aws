import { useEffect, useState, useCallback, useRef } from 'react';
import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";
import SplitPanel, { SplitPanelProps } from "@cloudscape-design/components/split-panel";
import ForceGraph2D from 'react-force-graph-2d';

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

interface GraphPreviewProps {
    schemaContent: string;
    onSplitPanelToggle?: ({ detail }: { detail: { open: boolean } }) => void;
}

export function GraphPreview({ schemaContent }: GraphPreviewProps) {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);


    // Add handler for split panel changes
    const handleSplitPanelResize = useCallback(() => {
        // Small delay to let the panel finish resizing
        setTimeout(() => {
            if (fgRef.current) {
                fgRef.current.d3ReheatSimulation();
            }
        }, 100);
    }, []);


    const [graphData, setGraphData] = useState<GraphData>({
        nodes: [],
        links: []
    });
    
    const fgRef = useRef<any>(null);

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
        
        const lines = content.split('\n');
        lines.forEach(line => {
            const match = line.match(/\[([^\]]+)\]—\(([^\)]+)\)→\[([^\]]+)\]/);
            if (match) {
                const [_, source, relation, target] = match;
                nodes.add(source);
                nodes.add(target);
                links.push({
                    source,
                    target,
                    label: relation
                });
            }
        });

        setGraphData({
            nodes: Array.from(nodes).map(id => ({ id, name: id })),
            links
        });
    }, []);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            updateGraphData(schemaContent);
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [schemaContent, updateGraphData]);

    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions({ width, height });
                // Refresh graph on container resize
                handleSplitPanelResize();
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [handleSplitPanelResize]);
    return (
        <SplitPanel header="Schema Preview" data-testid="schema-preview-panel">
            <Box padding="m">
                <SpaceBetween size="m">
                <div 
                        ref={containerRef}
                        data-testid="graph-preview-container"
                        style={{ 
                            height: 'max(calc(100vh - 800px), 40vh)',
                            width: '100%',
                            position: 'relative',
                            overflow: 'hidden'
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
                    </div>

                </SpaceBetween>
            </Box>
        </SplitPanel>
    );
}
