import { ETLLoaderItem } from './types';
import { 
    Header, 
    Container, 
    SpaceBetween, 
    Badge, 
    ColumnLayout, 
    Box, 
    StatusIndicator,
    Table
} from '@cloudscape-design/components';
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import { useEffect, useState } from 'react';

// Types
type MatchingEdges = {
    matching_edges: string[];
}

export function DataClassificationDetailComponent ({ item }:{ item: ETLLoaderItem }) {
    // State to store the item data
    const [itemData, setItemData] = useState<ETLLoaderItem | null>(null);
    
    // Update state when item changes
    useEffect(() => {
        if (item) {
            setItemData(item);
            // console.log("Updated item data:", item);
        }
    }, [item]);
    
    // If no item data, show loading
    if (!itemData) {
        return <div>Loading...</div>;
    }
    // Safely access properties with null checks
    const safeItem = {
        ...itemData,
        row_count: itemData?.row_count ?? 0,
        edge_count: itemData?.edge_count ?? 0,
        status_code: itemData?.status_code ?? 0,
        file_name: itemData?.file_name ?? "Unnamed File",
        timestamp: itemData?.timestamp ?? "",
        original_headers: Array.isArray(itemData?.original_headers) ? itemData.original_headers : [],
        new_headers: Array.isArray(itemData?.new_headers) ? itemData.new_headers : [],
        edges: itemData?.edges ?? "{}",
        node_label: itemData?.node_label ?? "",
        unique_id: itemData?.unique_id ?? "",
        output_key: itemData?.output_key ?? "",
        edge_output_key: itemData?.edge_output_key ?? "",
        id: itemData?.id ?? "",
        status_message: itemData?.status_message ?? ""
    };
    
    // Format timestamp nicely with null check
    const formattedTimestamp = safeItem.timestamp ? new Date(safeItem.timestamp).toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : "Unknown";

    // Job Metadata Items with consistent font sizes
    const jobMetadataItems = [
        { 
            label: "File Name", 
            value: safeItem.file_name
        },
        { 
            label: "ID", 
            value: safeItem.id
        },
        { 
            label: "Node Label", 
            value: <Badge color="blue">{safeItem.node_label}</Badge>
        },
        { 
            label: "Unique ID", 
            value: safeItem.unique_id
        },
        { 
            label: "Vertices Output Key", 
            value: safeItem.output_key
        },
        { 
            label: "Edges Output Key", 
            value: safeItem.edge_output_key
        },
    ];

    // Create header mapping data for side-by-side comparison
    const originalHeaders = Array.isArray(safeItem.original_headers) ? safeItem.original_headers : [];
    const newHeaders = Array.isArray(safeItem.new_headers) ? safeItem.new_headers : [];
    const maxHeaders = Math.max(originalHeaders.length, newHeaders.length);
    
    // Create header mapping items for table display
    const headerMappingData = Array.from({ length: maxHeaders }, (_, i) => ({
        index: i + 1,
        original: originalHeaders[i] || "-",
        new: newHeaders[i] || "-"
    }));

    // Edge-related Items
    const edgeItems = [
        {
            label: "",
            value: (() => {
                try {
                    const parsedEdges = JSON.parse(safeItem.edges || "{}");
                    const edges = parsedEdges?.matching_edges || [];
                    
                    if (edges.length === 0) {
                        return <StatusIndicator type="warning">No matching edges found</StatusIndicator>;
                    }
                    
                    return (
                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                            {edges.map((edge: string, index: number) => (
                                <li key={index}>
                                    <Badge color="green">{edge}</Badge>
                                </li>
                            ))}
                        </ul>
                    );
                } catch (error) {
                    return <StatusIndicator type="error">Error loading edges</StatusIndicator>;
                }
            })()
        },
    ];

    // Summary stats for the top section
    const summaryItems = [
        {
            label: "Total Rows",
            value: safeItem.row_count.toLocaleString()
        },
        {
            label: "Header Fields",
            value: originalHeaders.length.toString()
        },
        {
            label: "Edges",
            value: safeItem.edge_count.toString()
        }
    ];

    return (
        <div data-testid="details">
            <SpaceBetween size="l">
                <Container>
                    <ColumnLayout columns={2} variant="text-grid">
                        <div>
                            <Header variant='h1' 
                                description={`Processed on ${formattedTimestamp}`}
                                actions={
                                    <Badge color={Number(safeItem.status_code) === 200 ? "green" : "red"}>
                                        {Number(safeItem.status_code) === 200 ? "Success" : `Error ${safeItem.status_code}`}
                                    </Badge>
                                }
                            >
                                {safeItem.file_name}
                            </Header>
                        </div>
                        <div>
                            <KeyValuePairs items={summaryItems} />
                        </div>
                    </ColumnLayout>
                </Container>
                
                <Container 
                    header={
                        <Header 
                            variant='h2'
                            description="Metadata about the processed file"
                        >
                            Job Details
                        </Header>
                    }
                >
                    <KeyValuePairs columns={2} items={jobMetadataItems} />
                </Container>

                <Container 
                    header={
                        <Header 
                            variant='h2'
                            description="Edge relationships identified in the data"
                            counter={`${safeItem.edge_count} edges`}
                        >
                            Edge Information
                        </Header>
                    }
                >
                    <KeyValuePairs items={edgeItems} />
                </Container>

                <Container 
                    header={
                        <Header 
                            variant='h2'
                            description="Mapping between original and new headers"
                            counter={`${originalHeaders.length} headers`}
                        >
                            Header Mapping
                        </Header>
                    }
                >
                    <Table
                        columnDefinitions={[
                            {
                                id: "index",
                                header: "#",
                                cell: item => item.index,
                                width: 50
                            },
                            {
                                id: "original",
                                header: "Original Header",
                                cell: item => item.original
                            },
                            {
                                id: "new",
                                header: "New Header",
                                cell: item => item.new
                            }
                        ]}
                        items={headerMappingData}
                        loadingText="Loading headers"
                        trackBy="index"
                        empty={
                            <Box textAlign="center" color="inherit">
                                <b>No headers</b>
                                <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                                    No header mapping information is available.
                                </Box>
                            </Box>
                        }
                        variant="embedded"
                    />
                </Container>
            </SpaceBetween>
        </div>
    );
}
