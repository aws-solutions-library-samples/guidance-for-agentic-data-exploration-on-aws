export interface BulkLoadData {
    loaderResponse?: string;
    parsedResponse?: {
        feedCount: Array<{
            LOAD_COMPLETED: string;
        }>;
        overallStatus: {
            totalRecords: string;
            totalTimeSpent: string;
            insertErrors: string;
            totalDuplicates: string;
            datatypeMismatchErrors: string;
            retryNumber: string;
            runNumber: string;
            startTime: string;
            fullUri: string;
            parsingErrors: string;
            status: string;
        };
        errors: {
            startIndex: string;
            loadId: string;
            endIndex: string;
            errorLogs: any[];
        };
    };
    startTime: string;
    totalRecords: string;
    sourcePath: string;
    loadId: string;
    loadStatus: string;
    timeSpent: number;
}


// Define interfaces for the response data structure
export interface ErrorLog {
    errorCode: string;
    errorMessage: string;
    fileName: string;
    recordNum: number;
}

export interface FailedFeed {
    fullUri: string;
    status: string;
    totalRecords: number;
    insertErrors: number;
    totalTimeSpent: number;
    runNumber: number;
    retryNumber: number;
    totalDuplicates: number;
    parsingErrors: number;
    datatypeMismatchErrors: number;
    startTime: number;
}

export interface FeedCount {
    [key: string]: number;
}

export interface ParsedResponse {
    feedCount?: FeedCount[];
    overallStatus?: {
        fullUri: string;
        runNumber: number;
        retryNumber: number;
        status: string;
        totalTimeSpent: number;
        startTime: number;
        totalRecords: number;
        totalDuplicates: number;
        parsingErrors: number;
        datatypeMismatchErrors: number;
        insertErrors: number;
    };
    failedFeeds?: FailedFeed[];
    errors?: {
        startIndex: number;
        endIndex: number;
        loadId: string;
        errorLogs: ErrorLog[];
    };
}