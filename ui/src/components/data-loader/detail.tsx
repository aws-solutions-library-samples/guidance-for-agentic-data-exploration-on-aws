import { BulkLoadData, FeedCount, ParsedResponse } from './types';
import { 
  Header, 
  Container, 
  SpaceBetween, 
  Table, 
  Box, 
  Pagination, 
  Badge,
  Alert,
  Spinner,
  ExpandableSection,
  Grid,
  CopyToClipboard
} from '@cloudscape-design/components';
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { useEffect, useState } from 'react';
import jsonHighlight from "@cloudscape-design/code-view/highlight/json";
import CodeView from "@cloudscape-design/code-view/code-view";
import { determineLoadStatus, getStatusType, parseLoaderResponse } from './utils';

export function DataLoaderDetailComponent ({ item }:{ item: BulkLoadData }) {
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
    const [parsedResponse, setParsedResponse] = useState<ParsedResponse | null>(null);
    const [currentErrorPage, setCurrentErrorPage] = useState(1);
    const [errorsPerPage] = useState(10);
    const [currentFailedFeedPage, setCurrentFailedFeedPage] = useState(1);
    const [failedFeedsPerPage] = useState(5);
    const [isLoading, setIsLoading] = useState(true);
    const [displayStatus, setDisplayStatus] = useState(item.loadStatus);

    useEffect(() => {
        if (item.loaderResponse) {
            setIsLoading(true);
            try {
                const parsed = parseLoaderResponse(item);
                setParsedResponse(parsed);
                
                // Create a new item with the parsed response
                const updatedItem = { ...item };
                updatedItem.parsedResponse = parsed as any;
                
                // Determine the status based on the updated item
                const status = determineLoadStatus(updatedItem);
                setDisplayStatus(status);
                
                // Update the original item's parsedResponse
                item.parsedResponse = parsed as any;
            } catch (error) {
                console.error('Error processing loaderResponse:', error);
            } finally {
                setIsLoading(false);
            }
        } else {
            setIsLoading(false);
        }
    }, [item.loaderResponse]);

    // Calculate success rate if data is available
    const calculateSuccessRate = () => {
        if (parsedResponse?.overallStatus) {
            const total = parsedResponse.overallStatus.totalRecords || 0;
            const errors = (parsedResponse.overallStatus.insertErrors || 0) + 
                          (parsedResponse.overallStatus.datatypeMismatchErrors || 0) + 
                          (parsedResponse.overallStatus.parsingErrors || 0);
            
            if (total === 0) return "0%";
            const successRate = ((total - errors) / total) * 100;
            return `${successRate.toFixed(2)}%`;
        }
        return "N/A";
    };
    
    // Update display status whenever parsedResponse changes
    useEffect(() => {
        if (parsedResponse) {
            const updatedItem = { ...item };
            updatedItem.parsedResponse = parsedResponse as any;
            const status = determineLoadStatus(updatedItem);
            console.log('Updating status from:', displayStatus, 'to:', status);
            setDisplayStatus(status);
        }
    }, [parsedResponse]);

    const mainItems = [
        {
            label: "Load ID",
            value: (
                <Box color="text-status-info">
                    {item.loadId}
                </Box>
            )
        },
        {
            label: "Status",
            value: (
                <StatusIndicator 
                    type={getStatusType(displayStatus)}
                    colorOverride={displayStatus === 'LOAD_COMPLETED' ? 'green' : 
                                  displayStatus === 'LOAD_COMPLETE_W_ERRORS' ? 'yellow' : undefined}
                >
                    {displayStatus}
                </StatusIndicator>
            )
        },
        {
            label: "Total Records",
            value: (
                <Badge color="blue">
                    {item.totalRecords?.toLocaleString() || 0}
                </Badge>
            )
        },        
        {
            label: "Start Time",
            value: new Date(item.startTime).toLocaleString()
        },
        {
            label: "Time Spent",
            value: (
                <Box color="text-status-info">
                    {item.timeSpent} seconds
                </Box>
            )
        },
        {
            label: "Success Rate",
            value: (
                <Badge 
                    color={calculateSuccessRate() === "100.00%" ? "green" : 
                           calculateSuccessRate() === "N/A" ? "grey" : 
                           parseFloat(calculateSuccessRate().replace('%', '')) > 90 ? "blue" : "red"}
                >
                    {calculateSuccessRate()}
                </Badge>
            )
        },
    ];

    const overallStatusItems = parsedResponse?.overallStatus ? [
        {
            label: "Total Records",
            value: (
                <Badge color="blue">
                    {parsedResponse.overallStatus.totalRecords?.toLocaleString() || 0}
                </Badge>
            )
        },
        {
            label: "Insert Errors",
            value: (
                <Badge color={parsedResponse.overallStatus.insertErrors > 0 ? "red" : "green"}>
                    {parsedResponse.overallStatus.insertErrors?.toLocaleString() || 0}
                </Badge>
            )
        },
        {
            label: "Total Duplicates",
            value: (
                <Badge color={parsedResponse.overallStatus.totalDuplicates > 0 ? "blue" : "severity-low"}>
                    {parsedResponse.overallStatus.totalDuplicates?.toLocaleString() || 0}
                </Badge>
            )
        },
        {
            label: "Datatype Mismatch Errors",
            value: (
                <Badge color={parsedResponse.overallStatus.datatypeMismatchErrors > 0 ? "red" : "green"}>
                    {parsedResponse.overallStatus.datatypeMismatchErrors?.toLocaleString() || 0}
                </Badge>
            )
        },
        {
            label: "Parsing Errors",
            value: (
                <Badge color={parsedResponse.overallStatus.parsingErrors > 0 ? "red" : "green"}>
                    {parsedResponse.overallStatus.parsingErrors?.toLocaleString() || 0}
                </Badge>
            )
        },
        {
            label: "Retry Number",
            value: parsedResponse.overallStatus.retryNumber
        },
        {
            label: "Run Number",
            value: parsedResponse.overallStatus.runNumber
        },
        {
            label: "Full URI",
            value: (
                <CopyToClipboard
                copyButtonAriaLabel="Full URI"
                copyErrorText="Full URI failed to copy"
                copySuccessText="Full URI copied"
                textToCopy={parsedResponse.overallStatus.fullUri}
                variant="inline"
              />                
            )
        }
    ] : [];

    const errorItems = parsedResponse?.errors ? [
        {
            label: "Start Index",
            value: parsedResponse.errors.startIndex
        },
        {
            label: "End Index",
            value: parsedResponse.errors.endIndex
        },
        {
            label: "Error Count",
            value: (
                <Badge color={parsedResponse.errors.errorLogs.length > 0 ? "red" : "green"}>
                    {parsedResponse.errors.errorLogs.length.toString()}
                </Badge>
            )
        }
    ] : [];

    // Calculate pagination for error logs
    const errorLogs = parsedResponse?.errors?.errorLogs || [];
    const indexOfLastError = currentErrorPage * errorsPerPage;
    const indexOfFirstError = indexOfLastError - errorsPerPage;
    const currentErrors = errorLogs.slice(indexOfFirstError, indexOfLastError);

    // Calculate pagination for failed feeds
    const failedFeeds = parsedResponse?.failedFeeds || [];
    const indexOfLastFeed = currentFailedFeedPage * failedFeedsPerPage;
    const indexOfFirstFeed = indexOfLastFeed - failedFeedsPerPage;
    const currentFailedFeeds = failedFeeds.slice(indexOfFirstFeed, indexOfLastFeed);

    // Feed count summary
    const feedCountItems = parsedResponse?.feedCount ? 
        parsedResponse.feedCount.map((countObj: FeedCount) => {
            const status = Object.keys(countObj)[0];
            const count = countObj[status];
            return {
                label: status,
                value: (
                    <Badge color={status.includes("SUCCESS") ? "green" : 
                             status.includes("FAIL") ? "red" : "blue"}>
                        {count.toString()}
                    </Badge>
                )
            };
        }) : [];

    if (isLoading) {
        return (
            <Box textAlign="center" padding={{ top: "xxxl", bottom: "xxxl" }}>
                <SpaceBetween size="m" direction="vertical" alignItems="center">
                    <Spinner size="large" />
                    <Box variant="h3" color="text-status-info">
                        Loading bulk load details...
                    </Box>
                </SpaceBetween>
            </Box>
        );
    }

    return (
        <div data-testid="details">
            <SpaceBetween size="l">
                <Header 
                    variant="h1"
                    actions={
                        <SpaceBetween direction="horizontal" size="xs">
                            <Badge color={getStatusType(displayStatus) === 'success' ? "green" : 
                                    getStatusType(displayStatus) === 'warning' ? "severity-low" :
                                    getStatusType(displayStatus) === 'error' ? "red" : "blue"}>
                                {displayStatus}
                            </Badge>
                        </SpaceBetween>
                    }
                >
                    Bulk Load Details
                </Header>

                <Container
                    header={
                        <Header 
                            variant="h2"
                        >
                           Path: {item.sourcePath}
                        </Header>
                    }
                >
                    <SpaceBetween size="l">                        
                        <KeyValuePairs 
                            columns={3}
                            items={mainItems}
                        />
                    </SpaceBetween>
                </Container>

                <Grid
                    gridDefinition={[
                        { colspan: { default: 12, xxs: 12, xs: 12, s: 12, m: 6, l: 6, xl: 6 } },
                        { colspan: { default: 12, xxs: 12, xs: 12, s: 12, m: 6, l: 6, xl: 6 } }
                    ]}
                >
                    {overallStatusItems.length > 0 && (
                        <Container 
                            header={
                                <Header 
                                    variant="h2"
                                    description="Overall processing statistics"
                                >
                                    Overall Status
                                </Header>
                            }
                        >
                            <KeyValuePairs 
                                columns={2}
                                items={overallStatusItems}
                            />
                        </Container>
                    )}

                    {feedCountItems.length > 0 && (
                        <Container 
                            header={
                                <Header 
                                    variant="h2"
                                    description="Summary of feed processing results"
                                >
                                    Feed Count Summary
                                </Header>
                            }
                        >
                            <KeyValuePairs 
                                columns={2}
                                items={feedCountItems}
                            />
                        </Container>
                    )}                    

                </Grid>

                {errorItems.length > 0 && (
                    <Container 
                        header={
                            <Header 
                                variant="h2"
                                description="Details about errors encountered during processing"
                                counter={errorLogs.length > 0 ? `(${errorLogs.length})` : undefined}
                            >
                                Error Information
                            </Header>
                        }
                    >
                        <SpaceBetween size="l">
                            <KeyValuePairs 
                                columns={3}
                                items={errorItems}
                            />
                            
                            {errorLogs.length > 0 ? (
                                <>
                                    <Alert
                                        type="warning"
                                        header="Error logs found"
                                    >
                                        {errorLogs.length} error(s) were encountered during processing. Review the details below.
                                    </Alert>
                                    
                                    <Table
                                        columnDefinitions={[
                                            {
                                                id: "errorCode",
                                                header: "Error Code",
                                                cell: (item: any) => (
                                                    <Box color="text-status-error" fontWeight="bold">
                                                        {item.errorCode}
                                                    </Box>
                                                )
                                            },
                                            {
                                                id: "errorMessage",
                                                header: "Error Message",
                                                cell: (item: any) => item.errorMessage
                                            },
                                            {
                                                id: "fileName",
                                                header: "File Name",
                                                cell: (item: any) => (
                                                    <Box>
                                                        {item.fileName}
                                                    </Box>
                                                )
                                            },
                                            // hide value that appears to always be 0
                                            // {
                                            //     id: "recordNum",
                                            //     header: "Record Number",
                                            //     cell: (item: any) => (
                                            //         <Badge color="blue">
                                            //             {item.recordNum}
                                            //         </Badge>
                                            //     )
                                            // }
                                        ]}
                                        items={currentErrors}
                                        loadingText="Loading error logs"
                                        trackBy="errorMessage"
                                        stripedRows
                                        stickyHeader
                                        empty={
                                            <Box textAlign="center" color="inherit">
                                                <b>No error logs</b>
                                                <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                                                    No error logs to display.
                                                </Box>
                                            </Box>
                                        }
                                    />
                                    
                                    <Pagination
                                        currentPageIndex={currentErrorPage}
                                        onChange={({ detail }) => setCurrentErrorPage(detail.currentPageIndex)}
                                        pagesCount={Math.ceil(errorLogs.length / errorsPerPage)}
                                        ariaLabels={{
                                            nextPageLabel: "Next page",
                                            previousPageLabel: "Previous page",
                                            pageLabel: pageNumber => `Page ${pageNumber} of error logs`
                                        }}
                                    />
                                </>
                            ) : (
                                <Alert
                                    type="success"
                                    header="No errors found"
                                >
                                    No error logs were found for this bulk load job.
                                </Alert>
                            )}
                        </SpaceBetween>
                    </Container>
                )}

                {failedFeeds.length > 0 && (
                    <Container 
                        header={
                            <Header 
                                variant="h2"
                                description="Details about feeds that failed to process"
                                counter={`(${failedFeeds.length})`}
                            >
                                Failed Feeds
                            </Header>
                        }
                    >
                        <SpaceBetween size="l">
                            <Alert
                                type="error"
                                header="Failed feeds detected"
                            >
                                {failedFeeds.length} feed(s) failed during processing. Review the details below.
                            </Alert>
                            
                            <Table
                                columnDefinitions={[
                                    {
                                        id: "fullUri",
                                        header: "URI",
                                        cell: (item: any) => (
                                            <CopyToClipboard
                                                copyButtonAriaLabel="File URI"
                                                copyErrorText="File URI failed to copy"
                                                copySuccessText="File URI copied"
                                                textToCopy={item.fullUri}
                                                variant="inline"
                                            />                                             
                                        )
                                    },
                                    {
                                        id: "status",
                                        header: "Status",
                                        cell: (item: any) => (
                                            <StatusIndicator type="error">
                                                {item.status}
                                            </StatusIndicator>
                                        )
                                    },
                                    {
                                        id: "totalRecords",
                                        header: "Total Records",
                                        cell: (item: any) => (
                                            <Badge color="blue">
                                                {item.totalRecords?.toLocaleString() || 0}
                                            </Badge>
                                        )
                                    },
                                    {
                                        id: "insertErrors",
                                        header: "Insert Errors",
                                        cell: (item: any) => (
                                            <Badge color="red">
                                                {item.insertErrors?.toLocaleString() || 0}
                                            </Badge>
                                        )
                                    },
                                    {
                                        id: "totalTimeSpent",
                                        header: "Time Spent (s)",
                                        cell: (item: any) => item.totalTimeSpent
                                    }
                                ]}
                                items={currentFailedFeeds}
                                loadingText="Loading failed feeds"
                                trackBy="fullUri"
                                stripedRows
                                stickyHeader
                                empty={
                                    <Box textAlign="center" color="inherit">
                                        <b>No failed feeds</b>
                                        <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                                            No failed feeds to display.
                                        </Box>
                                    </Box>
                                }
                            />
                            
                            <Pagination
                                currentPageIndex={currentFailedFeedPage}
                                onChange={({ detail }) => setCurrentFailedFeedPage(detail.currentPageIndex)}
                                pagesCount={Math.ceil(failedFeeds.length / failedFeedsPerPage)}
                                ariaLabels={{
                                    nextPageLabel: "Next page",
                                    previousPageLabel: "Previous page",
                                    pageLabel: pageNumber => `Page ${pageNumber} of failed feeds`
                                }}
                            />
                        </SpaceBetween>
                    </Container>
                )}

                {parsedResponse && (
                    <ExpandableSection 
                        headerText="Raw Response Data" 
                        variant="container"
                        headerDescription="View the complete raw response data"
                    >
                        <Box 
                            padding="m"
                            color="text-body-secondary"
                            fontSize="body-m"
                        >
                            {renderJsonWithSyntaxHighlighting(parsedResponse)}
                        </Box>
                    </ExpandableSection>
                )}
            </SpaceBetween>
        </div>
    );
}
