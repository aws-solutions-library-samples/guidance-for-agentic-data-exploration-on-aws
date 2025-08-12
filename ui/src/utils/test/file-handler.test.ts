import FileHandler, { FileContentHandler, FileContents } from '../file-handler';
import { uploadData, copy } from '@aws-amplify/storage';
import { vi, describe, expect, beforeEach, it, Mock } from "vitest";
 
// Mock the @aws-amplify/storage module
vi.mock('@aws-amplify/storage', () => ({
  uploadData: vi.fn(),
  copy: vi.fn()
}));

describe('FileHandler', () => {
  let fileHandler: FileHandler;
  let mockFileContents: FileContents
  
  beforeEach(() => {
    fileHandler = new FileHandler({
      bucketName: "bucket",
    });
    mockFileContents = {
      contentType: 'text/csv',
      name: 'test.csv',
      path: 'test/path/test.csv',
      size: 1000,
      bucket: 'XXXXXXXXXXXX',
      fullPath: 's3://sourceBucket/test/path/test.csv'
    };

    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new handler', () => {
      const mockHandler: FileContentHandler = {
        supports: () => ['application/json']
      };
      
      fileHandler.register(mockHandler);
      expect(fileHandler.handlers).toHaveLength(1);
      expect(fileHandler.handlers[0]).toBe(mockHandler);
    });
  });

  describe('accepts', () => {
    it('should return combined supported content types', () => {

      const mockHandler1: FileContentHandler = {
        supports: () => ['text/csv']
      };

      const mockHandler2: FileContentHandler = {
        supports: () => ['application/json']
      };
      
      fileHandler.register(mockHandler1);
      fileHandler.register(mockHandler2);
      
      expect(fileHandler.accepts()).toBe('text/csv,application/json');
    });

    it('should return empty string when no handlers registered', () => {
      expect(fileHandler.accepts()).toBe('');
    });
  });

  describe('upload', () => {
    it('should throw error when no handler supports the file type', async () => {
      const file = new File([], 'test.txt', { type: 'text/plain' });
      
      await expect(fileHandler.upload(file))
        .rejects
        .toThrow('No handler for file type "text/plain"');
    });

    it('should throw error when file size exceeds maximum', async () => {
      const mockHandler: FileContentHandler = {
        supports: () => ['text/csv']
      };
      fileHandler.register(mockHandler);
      
      const largeFile = new File([new ArrayBuffer(fileHandler.MAX_FILE_SIZE + 1)], 
        'large.csv', 
        { type: 'text/csv' }
      );
      
      await expect(fileHandler.upload(largeFile))
        .rejects
        .toThrow(`File size is too large, max is ${fileHandler.MAX_FILE_SIZE} bytes`);
    });

    it('should upload file successfully with personal option', async () => {
      const mockHandler: FileContentHandler = {
        supports: () => ['text/csv']
      };
      fileHandler.register(mockHandler);
      
      const file = new File(['test data'], 'test.csv', { type: 'text/csv' });
      const mockUploadResult = {
        path: 'user123/test.csv'
      };

      (uploadData as Mock).mockReturnValue({
        result: Promise.resolve(mockUploadResult)
      });

      const result = await fileHandler.upload(file, { personal: true });
      
      expect(uploadData).toHaveBeenCalledWith({
        data: file,
        path: expect.any(Function),
        options: { 
          contentType: 'text/csv',         
          bucket: "bucket",
        }
      });
      
      expect(result).toEqual({
        name: 'test.csv',
        contentType: 'text/csv',
        fullPath: "s3://bucket/user123/test.csv",
        size: file.size,
        bucket: "bucket",
        path: 'user123/test.csv'
      });
    });

    it('should upload file with custom bucket', async () => {
      const mockHandler: FileContentHandler = {
        supports: () => ['text/csv']
      };
      fileHandler.register(mockHandler);
      
      const file = new File(['test data'], 'test.csv', { type: 'text/csv' });
      const mockUploadResult = {
        path: 'test.csv'
      };

      (uploadData as Mock).mockReturnValue({
        result: Promise.resolve(mockUploadResult)
      });

      await fileHandler.upload(file, { bucket: 'XXXXXXXXXXXXX' });
      
      expect(uploadData).toHaveBeenCalledWith({
        data: file,
        path: file.name,
        options: {
          contentType: 'text/csv',
          bucket: 'XXXXXXXXXXXXX'
        }
      });
    });

    it('should call onComplete callback after successful file handling', async () => {
      // Create a mock handler with onComplete callback
      const mockOnComplete = vi.fn();
      const mockHandler: FileContentHandler = {
        supports: () => ['text/csv'],
        onComplete: mockOnComplete
      };
  
      // Register the mock handler
      fileHandler.register(mockHandler);
  
      // Create a test file
      const testContent = new ArrayBuffer(100);
      const testFile = new File([testContent], 'test.csv', { 
        type: 'text/csv' 
      });
  
      // Call upload and wait for it to complete
      const result = await fileHandler.upload(testFile);
  
      // Verify onComplete was called with the correct result
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
      expect(mockOnComplete).toHaveBeenCalledWith(result);
    });
  
    it('should handle errors in onComplete callback', async () => {
      const mockOnComplete = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
  
      const mockHandler: FileContentHandler = {
        supports: () => ['text/csv'],
        onComplete: mockOnComplete
      };
  
      fileHandler.register(mockHandler);
  
      const testContent = new ArrayBuffer(100);
      const testFile = new File([testContent], 'test.csv', { 
        type: 'text/csv' 
      });
  
      // Should propagate errors from onComplete
      await expect(fileHandler.upload(testFile))
        .rejects
        .toThrow('Callback error');
    });

    it('should successfully copy a file to the destination bucket', async () => {
      // Arrange
      const options = {
        source: 'bucket',
        destination: 'destinationBucket',
        pathPrefix: 'prefix'
      };
      const expectedCopyParams = {
        source: {
          bucket: options.source,
          path: mockFileContents.path
        },
        destination: {
          bucket: options.destination,
          path: `${options.pathPrefix}/${mockFileContents.path}`
        }
      };
      (copy as Mock).mockResolvedValue({ success: true });
  
      // Act
      const result = await fileHandler.copy(mockFileContents, options);
  
      // Assert
      expect(copy).toHaveBeenCalledWith(expectedCopyParams);
      expect(copy).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });
  
    it('should copy a file without pathPrefix', async () => {
      // Arrange
      const options = {
        source: 'bucket',
        destination: 'destinationBucket'
      };
      const expectedCopyParams = {
        source: {
          bucket: options.source,
          path: mockFileContents.path
        },
        destination: {
          bucket: options.destination,
          path: `/${mockFileContents.path}`
        }
      };
      (copy as Mock).mockResolvedValue({ success: true });
  
      // Act
      const result = await fileHandler.copy(mockFileContents, options);
  
      // Assert
      expect(copy).toHaveBeenCalledWith(expectedCopyParams);
      expect(copy).toHaveBeenCalledTimes(1);
    });
  
    it('should handle copy failure', async () => {
      // Arrange
      const options = {
        source: 'bucket',
        destination: 'destinationBucket',
        pathPrefix: 'prefix'
      };
      const error = new Error('Copy failed');
      (copy as Mock).mockRejectedValue(error);
  
      // Act & Assert
      await expect(fileHandler.copy(mockFileContents, options))
        .rejects
        .toThrow('Copy failed');
    });
  
    it('should handle empty file contents', async () => {
      // Arrange
      const emptyFileContents = {
        contentType: '',
        name: '',
        path: '',
        size: 0,
        bucket: '',
        fullPath: ''
      };
      const options = {
        source: 'bucket',
        destination: 'destinationBucket',
        pathPrefix: 'prefix'
      };
      (copy as Mock).mockResolvedValue({ success: true });
  
      // Act
      await fileHandler.copy(emptyFileContents, options);
  
      // Assert
      expect(copy).toHaveBeenCalledWith({
        source: {
          bucket: 'bucket',
          path: ''
        },
        destination: {
          bucket: options.destination,
          path: `${options.pathPrefix}/`
        }
      });
    });
  });
});