import { downloadData, uploadData, copy } from '@aws-amplify/storage';
import { Amplify } from 'aws-amplify';

export type FileContents = {
    contentType: string,
    name: string,
    path: string,
    size: number,
    bucket: string,
    fullPath: string
    head?: ()=>Promise<string|Buffer>
}

export type FileContentHandler = {
    supports: () => string[],
    //onComplete takes a function and calls back with the FileContents object
    onComplete?: (file: FileContents) => void
}

export class CsvFileHandler implements FileContentHandler {
    supports(): string[] {
        return ['text/csv']
    }
}

export default class FileHandler {
    handlers: FileContentHandler[]
    readonly MAX_FILE_SIZE = 1024 * 1024 * 100;
    bucketName?: string

    constructor(options?: {
        bucketName?:string,
    }) {
        this.bucketName = options?.bucketName;
        this.handlers = []
    }

    register(handler: FileContentHandler) {
        this.handlers.push(handler)
    }

    accepts():string {
        return this.handlers.flatMap(handler => handler.supports()).join(',');
    }

    async upload(file:File, 
        options?: {
            bucket?:string,
            personal?:boolean,
        }):Promise<FileContents>
    {
        // validate content type
        const handler = this.handlers.find(handler => handler.supports().includes(file.type))
        if (!handler) {
            throw new Error(`No handler for file type "${file.type}"`)
        }
        // validate file size is not greater than maximum
        if (file.size > this.MAX_FILE_SIZE) {
            throw new Error(`File size is too large, max is ${this.MAX_FILE_SIZE} bytes`)
        }
        const storeByUserId = options && options.personal;
        //user 
        const uploadOptions = {
            contentType: file.type
        } as any;

        if (options?.bucket) {
            uploadOptions.bucket = options?.bucket;
        } else if (this.bucketName) {
            uploadOptions.bucket = this.bucketName;
        }

        const uploadResult = await uploadData({
            data: file,
            path: storeByUserId ? ({identityId}) => `${identityId}/${file.name}` : file.name,
            options: uploadOptions
        }).result;

        const fileContents = { 
            ...{ name: file.name, contentType: file.type, size: file.size }, 
            ...uploadResult, 
        } as FileContents

        fileContents.bucket = uploadOptions.bucket || Amplify.getConfig().Storage?.S3.bucket
        fileContents.fullPath = `s3://${fileContents.bucket}/${fileContents.path}`;
        console.log("uploadResult",JSON.stringify(fileContents));
        if (handler.onComplete) handler.onComplete(fileContents);
        return fileContents;
    }
    
    async uploadMultiple(files: File[], 
        options?: {
            bucket?:string,
            personal?:boolean,
        }):Promise<FileContents[]>
    {
        const results: FileContents[] = [];
        
        for (const file of files) {
            try {
                const result = await this.upload(file, options);
                results.push(result);
            } catch (error) {
                console.error('Error uploading file:', { fileName: file.name, error });
                // Continue with other files even if one fails
            }
        }
        
        return results;
    }

    async copy (file:FileContents, options: {
        source: string,
        destination: string,
        pathPrefix?: string
    }) {
        return await copy({
            source: {
                bucket: options.source,
                path: file.path
            },
            destination: {
                bucket: options.destination,
                path: `${options.pathPrefix || ''}/${file.name}`
            }
        })
    }
    // get file header for validation
    // async head(file: {
    //     path: string,
    //     size?: number|undefined
    // }): Promise<FileContents> {
    //     return new Promise((resolve) => {
    //         downloadData({ 
    //             path: file.path,
    //             options: {
    //                 bytesRange: {
    //                     start: 0,
    //                     end: Math.max(file.size||0, 1024)
    //                 }
    //             }
    //         }).result.then(data => {
    //             return data.body.text().then(text => {
    //                 resolve( {
    //                     contentType: data.contentType || 'text/plain',
    //                     name: file.path,
    //                     content: text
    //                 })
    //             })
    //         })
    //     })
    // }
}
