import { getUrl, downloadData, uploadData } from 'aws-amplify/storage';

interface SchemaHandlerResponse {
  success: boolean;
  content: string;
  error?: string;
}

export class SchemaHandler {
    private static readonly SCHEMA_KEY = 'schema/graph.txt';
    private static readonly DEFAULT_SCHEMA = '';
    private static readonly DATA_LOADER_BUCKET = 'dataLoaderBucket';
    private static cachedSchema: string | null = null;

    static async uploadSchema(content: string): Promise<SchemaHandlerResponse> {
        try {
            //console.log('Attempting to upload schema to:', this.SCHEMA_KEY);
            console.debug('Upload content length:', content.length);

            const encoder = new TextEncoder();
            const data = encoder.encode(content);

            // Upload directly to the data loader bucket
            await uploadData({
                key: this.SCHEMA_KEY,
                data,
                options: {
                    contentType: 'text/plain',
                    bucket: this.DATA_LOADER_BUCKET,
                    useAccelerateEndpoint: false
                }
            });

            // Update the cache with the latest content
            this.cachedSchema = content;
            
            console.debug('Successfully uploaded schema');
            return {
                success: true,
                content
            };

        } catch (error: any) {
            console.error('Upload error:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            return {
                success: false,
                content: '',
                error: `Failed to upload schema: ${error.message || 'Unknown error occurred'}`
            };
        }
    }

    static async downloadSchema(): Promise<SchemaHandlerResponse> {
        try {
            // If we have a cached schema, use it
            if (this.cachedSchema !== null) {
                console.log('Using cached schema, length:', this.cachedSchema.length);
                return {
                    success: true,
                    content: this.cachedSchema
                };
            }
            
            //console.log('Starting schema download from:', this.SCHEMA_KEY);
            
            const downloadResult = await downloadData({
                key: this.SCHEMA_KEY,
                options: {
                    bucket: this.DATA_LOADER_BUCKET,
                    useAccelerateEndpoint: false,
                }
            });
    
    
            // Wait for the promise to resolve
            const response = await downloadResult.result;
    
            if (!response || !response.body) {
                console.log('No response body, returning default schema');
                this.cachedSchema = this.DEFAULT_SCHEMA;
                return {
                    success: true,
                    content: this.DEFAULT_SCHEMA
                };
            }

            if (response.body instanceof Blob) {
                const text = await response.body.text();
                this.cachedSchema = text;
                return {
                    success: true,
                    content: text
                };
            }
    
            // Handle other response types
            let content: string;
            if (response.body instanceof Uint8Array) {
                const decoder = new TextDecoder('utf-8');
                content = decoder.decode(response.body);
            } else if (typeof response.body === 'string') {
                content = response.body;
            } else {
                console.log('Unexpected body type:', typeof response.body);
                content = String(response.body);
            }

            
            if (!content.trim()) {
                console.log('Empty content after decoding, returning default schema');
                this.cachedSchema = this.DEFAULT_SCHEMA;
                return {
                    success: true,
                    content: this.DEFAULT_SCHEMA
                };
            }
    
            // Cache the downloaded schema
            this.cachedSchema = content;
            
            return {
                success: true,
                content
            };
    
        } catch (error: any) {
            console.error('Download error:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            if (error.name === 'NoSuchKey') {
                console.log('Schema file not found, returning default schema');
                this.cachedSchema = this.DEFAULT_SCHEMA;
                return {
                    success: true,
                    content: this.DEFAULT_SCHEMA
                };
            }
    
            return {
                success: false,
                content: '',
                error: `Failed to download schema: ${error.message || 'Unknown error occurred'}`
            };
        }
    }
    
    // Method to clear the cache - useful for debugging or forcing a refresh
    static clearCache(): void {
        console.debug('Clearing schema cache');
        this.cachedSchema = null;
    }
}
