import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

// Binary file detection patterns
const BINARY_EXTENSIONS = [
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.tif', '.tiff', '.webp', '.avif',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.wav', '.flac', '.ogg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.o', '.obj', '.pyc', '.pyo', '.class',
];

/**
 * Check if a file is binary based on extension or content sampling
 * @param filePath Path to the file
 * @returns True if file is likely binary
 */
export function isBinaryFile(filePath: string): boolean {
  // Check by extension first (faster)
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.includes(ext)) {
    return true;
  }
  
  try {
    // Sample first 8KB of the file to check for binary content
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(8 * 1024); // 8KB buffer
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    fs.closeSync(fd);
    
    // If we couldn't read anything, treat as non-binary
    if (bytesRead === 0) {
      return false;
    }
    
    // Check for null bytes in the first 8KB
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) {
        return true;
      }
    }
    
    // Count control characters (non-CR, non-LF)
    let controlChars = 0;
    for (let i = 0; i < bytesRead; i++) {
      const c = buffer[i];
      if (c < 32 && c !== 9 && c !== 10 && c !== 13) {
        controlChars++;
      }
    }
    
    // If more than 10% of the first 8KB is control characters, consider it binary
    return (controlChars / bytesRead) > 0.1;
  } catch (error) {
    logger.warn(`Error checking if file is binary: ${filePath}`, error);
    return false;
  }
}

/**
 * Calculate hash for file content
 * @param filePath Path to the file
 * @param algorithm Hash algorithm to use (default: sha256)
 * @returns Hash string
 */
export function hashFile(filePath: string, algorithm = 'sha256'): string {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash(algorithm);
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (error) {
    logger.error(`Error hashing file: ${filePath}`, error);
    throw error;
  }
}

/**
 * Calculate hash for string content
 * @param content Content to hash
 * @param algorithm Hash algorithm to use (default: sha256)
 * @returns Hash string
 */
export function hashContent(content: string, algorithm = 'sha256'): string {
  const hashSum = crypto.createHash(algorithm);
  hashSum.update(content);
  return hashSum.digest('hex');
}

/**
 * Efficiently hash a file using streams (good for large files)
 * @param filePath Path to the file
 * @param algorithm Hash algorithm to use (default: sha256)
 * @returns Promise resolving to hash string
 */
export function hashFileStream(filePath: string, algorithm = 'sha256'): Promise<string> {
  return new Promise((resolve, reject) => {
    const hashSum = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', (data) => {
      hashSum.update(data);
    });
    
    stream.on('end', () => {
      resolve(hashSum.digest('hex'));
    });
    
    stream.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Get appropriate hash function based on file size
 * - Uses regular hashFile for small files
 * - Uses stream-based hashing for large files
 * @param filePath Path to the file
 * @param algorithm Hash algorithm to use (default: sha256)
 * @returns Promise resolving to hash string
 */
export async function getFileHash(filePath: string, algorithm = 'sha256'): Promise<string> {
  try {
    const stats = fs.statSync(filePath);
    
    // Use stream-based hashing for files larger than 10MB
    if (stats.size > 10 * 1024 * 1024) {
      return hashFileStream(filePath, algorithm);
    }
    
    // Use regular hashing for smaller files
    return hashFile(filePath, algorithm);
  } catch (error) {
    logger.error(`Error getting file hash: ${filePath}`, error);
    throw error;
  }
}

/**
 * Read and process file content based on whether it's binary or text
 * @param filePath Path to the file
 * @returns Object with content, hash, and binary flag
 */
export async function processFile(filePath: string): Promise<{
  content: string | Buffer;
  hash: string;
  isBinary: boolean;
}> {
  try {
    const binary = isBinaryFile(filePath);
    let content: string | Buffer;
    let hash: string;
    
    if (binary) {
      // For binary files, read as buffer and calculate hash
      content = fs.readFileSync(filePath);
      hash = await getFileHash(filePath);
    } else {
      // For text files, read as utf-8 and calculate hash of content
      content = fs.readFileSync(filePath, 'utf-8');
      hash = hashContent(content);
    }
    
    return {
      content,
      hash,
      isBinary: binary,
    };
  } catch (error) {
    logger.error(`Error processing file: ${filePath}`, error);
    throw error;
  }
}
