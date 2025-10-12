// Shared D3.js graph rendering functionality
class GraphRenderer {
    constructor() {
        this.currentSimulation = null;
        this.resizeObserver = null;
        this.resizeTimeout = null;
        this.currentGraphData = null;
        this.currentCanvasElement = null;
        this.currentOptions = null;
        this.lastWidth = 0;
        this.lastHeight = 0;
    }

    // Parse graph model text into D3.js format
    parseGraphModel(graphModelText) {
        const nodes = [];
        const links = [];
        const nodeMap = new Map();
        
        try {
            const lines = graphModelText.split('\n');
            let currentSection = null;
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                
                // Handle bracket notation: [ProductionLine] —(LOCATED_AT)→ [Facility]
                const bracketMatch = trimmed.match(/\[(\w+)\]\s*—\(([^)]+)\)→\s*\[(\w+)\]/);
                if (bracketMatch) {
                    const source = bracketMatch[1];
                    const label = bracketMatch[2];
                    const target = bracketMatch[3];
                    
                    // Ensure both nodes exist
                    if (!nodeMap.has(source)) {
                        nodes.push({ id: source, name: source, properties: [] });
                        nodeMap.set(source, nodes.length - 1);
                    }
                    if (!nodeMap.has(target)) {
                        nodes.push({ id: target, name: target, properties: [] });
                        nodeMap.set(target, nodes.length - 1);
                    }
                    
                    links.push({
                        source: source,
                        target: target,
                        label: label
                    });
                    continue;
                }
                
                if (trimmed.includes('Nodes:')) {
                    currentSection = 'nodes';
                    continue;
                } else if (trimmed.includes('Relationships:') || trimmed.includes('Edges:')) {
                    currentSection = 'relationships';
                    continue;
                }
                
                if (currentSection === 'nodes') {
                    // Parse node lines like "- User (id, name, email)"
                    const nodeMatch = trimmed.match(/^-\s*(\w+)(?:\s*\(([^)]+)\))?/);
                    if (nodeMatch) {
                        const nodeName = nodeMatch[1];
                        const properties = nodeMatch[2] ? nodeMatch[2].split(',').map(p => p.trim()) : [];
                        
                        if (!nodeMap.has(nodeName)) {
                            nodes.push({
                                id: nodeName,
                                name: nodeName,
                                properties: properties
                            });
                            nodeMap.set(nodeName, nodes.length - 1);
                        }
                    }
                } else if (currentSection === 'relationships') {
                    // Parse relationship lines like "- User -> Order (PLACED)"
                    const relMatch = trimmed.match(/^-\s*(\w+)\s*->\s*(\w+)(?:\s*\(([^)]+)\))?/);
                    if (relMatch) {
                        const source = relMatch[1];
                        const target = relMatch[2];
                        const label = relMatch[3] || 'RELATED_TO';
                        
                        // Ensure both nodes exist
                        if (!nodeMap.has(source)) {
                            nodes.push({ id: source, name: source, properties: [] });
                            nodeMap.set(source, nodes.length - 1);
                        }
                        if (!nodeMap.has(target)) {
                            nodes.push({ id: target, name: target, properties: [] });
                            nodeMap.set(target, nodes.length - 1);
                        }
                        
                        links.push({
                            source: source,
                            target: target,
                            label: label
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing graph model:', error);
        }
        
        return { nodes, links };
    }

    // Render graph using D3.js
    renderGraph(graphData, canvasElement, options = {}) {
        const showLinkLabels = options.showLinkLabels !== false;
        
        // Clear previous graph
        d3.select(canvasElement).selectAll("*").remove();
        if (this.currentSimulation) {
            this.currentSimulation.stop();
        }
        
        // Store data for resize
        this.currentGraphData = graphData;
        this.currentCanvasElement = canvasElement;
        this.currentOptions = options;

        if (!graphData.nodes.length) {
            d3.select(canvasElement)
                .append('div')
                .style('display', 'flex')
                .style('align-items', 'center')
                .style('justify-content', 'center')
                .style('height', '100%')
                .style('color', '#666')
                .text('No graph data to display');
            return;
        }

        const container = d3.select(canvasElement);
        const containerRect = canvasElement.getBoundingClientRect();
        const width = containerRect.width;
        const height = containerRect.height;

        const svg = container
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });
        
        svg.call(zoom);

        // Create main group for all graph elements
        const g = svg.append('g');

        // Create arrow marker
        svg.append('defs').append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '-0 -5 10 10')
            .attr('refX', 20)
            .attr('refY', 0)
            .attr('orient', 'auto')
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('xoverflow', 'visible')
            .append('svg:path')
            .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
            .attr('fill', '#666')
            .style('stroke', 'none');

        // Create simulation
        const linkDistance = showLinkLabels ? 200 : 150;
        this.currentSimulation = d3.forceSimulation(graphData.nodes)
            .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(linkDistance))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2));

        // Create links
        const link = g.append('g')
            .selectAll('line')
            .data(graphData.links)
            .enter().append('line')
            .attr('stroke', '#666')
            .attr('stroke-width', 2)
            .attr('marker-end', 'url(#arrowhead)');

        // Create link labels (conditionally)
        let linkLabel = null;
        if (showLinkLabels) {
            linkLabel = g.append('g')
                .selectAll('text')
                .data(graphData.links)
                .enter().append('text')
                .attr('text-anchor', 'middle')
                .attr('font-size', '12px')
                .attr('fill', '#333')
                .text(d => d.label);
        }

        // Color scale for nodes
        const baseColors = [
            '#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#FDD835', 
            '#00ACC1', '#795548', '#E91E63', '#4CAF50', '#3F51B5', '#FF5722'
        ];
        
        const colorScale = (nodeId) => {
            const nodeIndex = graphData.nodes.findIndex(n => n.id === nodeId);
            return baseColors[nodeIndex % baseColors.length];
        };

        // Create nodes
        const node = g.append('g')
            .selectAll('circle')
            .data(graphData.nodes)
            .enter().append('circle')
            .attr('r', 12)
            .attr('fill', d => colorScale(d.id))
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .call(d3.drag()
                .on('start', (event, d) => this.dragstarted(event, d))
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragended(event, d)));

        // Create node labels
        const nodeLabel = g.append('g')
            .selectAll('text')
            .data(graphData.nodes)
            .enter().append('text')
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .attr('fill', '#000')
            .attr('dy', 25)
            .text(d => d.name);

        // Update positions on tick
        this.currentSimulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            if (linkLabel) {
                linkLabel
                    .attr('x', d => (d.source.x + d.target.x) / 2)
                    .attr('y', d => (d.source.y + d.target.y) / 2);
            }

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            nodeLabel
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

        // Auto-fit graph when simulation stabilizes
        setTimeout(() => {
            const nodes = graphData.nodes;
            if (nodes.length === 0) return;

            const padding = 50;
            const xExtent = d3.extent(nodes, d => d.x);
            const yExtent = d3.extent(nodes, d => d.y);
            
            const nodeWidth = xExtent[1] - xExtent[0];
            const nodeHeight = yExtent[1] - yExtent[0];
            
            if (nodeWidth > 0 && nodeHeight > 0) {
                const scale = Math.min(
                    (width - padding * 2) / nodeWidth,
                    (height - padding * 2) / nodeHeight,
                    0.8
                );
                
                const centerX = (xExtent[0] + xExtent[1]) / 2;
                const centerY = (yExtent[0] + yExtent[1]) / 2;
                
                const transform = d3.zoomIdentity
                    .translate(width / 2, height / 2)
                    .scale(scale)
                    .translate(-centerX, -centerY);
                
                svg.call(zoom.transform, transform);
            }
        }, 1000);
        
        // Set up resize observer for responsive behavior (only for significant size changes)
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        this.lastWidth = width;
        this.lastHeight = height;
        
        this.resizeObserver = new ResizeObserver(() => {
            // Only resize if the change is significant (more than 50px)
            const newRect = canvasElement.getBoundingClientRect();
            const widthDiff = Math.abs(newRect.width - this.lastWidth);
            const heightDiff = Math.abs(newRect.height - this.lastHeight);
            
            if (widthDiff > 50 || heightDiff > 50) {
                // Debounce resize to avoid too many redraws
                clearTimeout(this.resizeTimeout);
                this.resizeTimeout = setTimeout(() => {
                    this.handleResize();
                }, 500); // Longer delay to avoid interfering with user interaction
            }
        });
        
        this.resizeObserver.observe(canvasElement);
    }
    
    // Handle container resize
    handleResize() {
        if (this.currentGraphData && this.currentCanvasElement) {
            // Store current zoom transform before re-rendering
            const svg = d3.select(this.currentCanvasElement).select('svg');
            const currentTransform = svg.empty() ? null : d3.zoomTransform(svg.node());
            
            // Update stored dimensions
            const newRect = this.currentCanvasElement.getBoundingClientRect();
            this.lastWidth = newRect.width;
            this.lastHeight = newRect.height;
            
            // Re-render the graph
            this.renderGraph(this.currentGraphData, this.currentCanvasElement, this.currentOptions);
            
            // Restore zoom transform if it existed
            if (currentTransform && !svg.empty()) {
                const zoom = d3.zoom();
                svg.call(zoom.transform, currentTransform);
            }
        }
    }

    // Drag functions
    dragstarted(event, d) {
        if (!event.active) this.currentSimulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    dragended(event, d) {
        if (!event.active) this.currentSimulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
    
    // Cleanup method
    cleanup() {
        if (this.currentSimulation) {
            this.currentSimulation.stop();
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
    }
}

// Global instance
window.graphRenderer = new GraphRenderer();
