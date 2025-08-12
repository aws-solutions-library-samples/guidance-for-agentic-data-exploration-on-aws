import { BulkLoadData, ParsedResponse } from './types';

/**
 * Parses the loader response from a BulkLoadData item
 * @param item The bulk load data item
 * @returns The parsed response or null if parsing fails
 */
export const parseLoaderResponse = (item: BulkLoadData): ParsedResponse | null => {
  if (!item.loaderResponse) {
    return null;
  }

  try {
    let jsonString: string = '';
    
    if (typeof item.loaderResponse === 'string') {
      // The string appears to be base64 encoded
      try {
        // First try to decode as base64
        try {
          // For browser environments
          jsonString = atob(item.loaderResponse);
        } catch (e) {
          console.log('atob failed - not an encoded string');
          jsonString = item.loaderResponse;
        }
      } catch (decodeError) {
        console.error('Base64 decoding failed:', decodeError);
        // If base64 decoding fails, use the original string
        jsonString = item.loaderResponse;
      }
    } else if (item.loaderResponse && typeof item.loaderResponse === 'object') {
      // Handle object format (like DynamoDB's { B: [...] } format)
      if ('B' in (item.loaderResponse as Record<string, any>)) {
        const binaryData = (item.loaderResponse as Record<string, any>).B;
        if (Array.isArray(binaryData)) {
          // First try to convert from base64
          try {
            const base64String = binaryData.map(byte => String.fromCharCode(byte)).join('');
            jsonString = atob(base64String);
          } catch (e) {
            // If that fails, try direct UTF-8 decoding
            const byteArray = new Uint8Array(binaryData);
            const decoder = new TextDecoder('utf-8');
            jsonString = decoder.decode(byteArray);
          }
        } else {
          jsonString = JSON.stringify(item.loaderResponse);
        }
      } else {
        // If it's already an object but not in B format, stringify it
        jsonString = JSON.stringify(item.loaderResponse);
      }
    } else {
      console.error('Unsupported loaderResponse type:', typeof item.loaderResponse);
      return null;
    }
    
    // Parse the JSON string
    try {
      const parsed = JSON.parse(jsonString);
      return parsed as ParsedResponse;
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('JSON string (first 200 chars):', jsonString.substring(0, 200));
      return null;
    }
  } catch (error) {
    console.error('Error processing loaderResponse:', error);
    return null;
  }
};

/**
 * Determines the actual load status based on feed counts
 * @param item The bulk load data item
 * @returns The determined status: LOAD_COMPLETED, LOAD_COMPLETE_W_ERRORS, LOAD_FAILED, or the original status
 */
export const determineLoadStatus = (item: BulkLoadData): string => {
  // If we have parsed response with feed count data, use it to determine the status
  if (item.parsedResponse?.feedCount && item.parsedResponse.feedCount.length > 0) {
    let hasSuccessfulFeeds = false;
    let hasFailedFeeds = false;
    
    // Check if there are both successful and failed feeds
    item.parsedResponse.feedCount.forEach((countObj: any) => {
      const status = Object.keys(countObj)[0];
      const count = typeof countObj[status] === 'string' ? parseInt(countObj[status]) : countObj[status];
      
      if (status === 'LOAD_COMPLETED' && count > 0) {
        hasSuccessfulFeeds = true;
      }
      if (status === 'LOAD_FAILED' && count > 0) {
        hasFailedFeeds = true;
      }
    });
    
    // If there are both successful and failed feeds, mark as LOAD_COMPLETE_W_ERRORS
    if (hasSuccessfulFeeds && hasFailedFeeds) {
      return 'COMPLETED_W_ERRORS';
    }
    
    // If there are only successful feeds, mark as LOAD_COMPLETED
    if (hasSuccessfulFeeds && !hasFailedFeeds) {
      return 'COMPLETED';
    }
    
    // If there are only failed feeds, mark as LOAD_FAILED
    if (!hasSuccessfulFeeds && hasFailedFeeds) {
      return 'FAILED';
    }
  }
  
  // Default: keep the original status
  return item.loadStatus;
};

/**
 * Gets the status indicator type based on the load status
 * @param status The load status
 * @returns The status indicator type for Cloudscape StatusIndicator component
 */
export const getStatusType = (status: string): 'error' | 'warning' | 'success' | 'info' | 'stopped' | 'pending' | 'in-progress' | 'loading' => {
  if (status === 'COMPLETED') return 'success';
  if (status === 'COMPLETED_W_ERRORS') return 'warning';
  if (status === 'LOAD_IN_PROGRESS') return 'in-progress';
  if (status === 'FAILED') return 'error';
  return 'pending';
};
