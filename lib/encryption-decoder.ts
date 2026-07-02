interface EncryptedResponse {
  encrypted: boolean;
  payload: string;
  session_id?: string;
  timestamp?: string;
  algorithm: string;
}

interface DecryptionKey {
  key: CryptoKey;
  userId: string;
  timestamp: string;
}

class ResponseDecryption {
  private static keyCache = new Map<string, CryptoKey>();
  
  static async decrypt(response: any, userId?: string): Promise<any> {
    // Check if response is encrypted
    if (!this.isEncryptedResponse(response)) {
      return response;
    }
    
    try {
      if (response.session_id && response.timestamp) {
        // Session-specific decryption
        return await this.decryptWithSessionKey(response, response.session_id, response.timestamp);
      } else {
        // Master key decryption (fallback)
        return await this.decryptWithMasterKey(response);
      }
    } catch (error) {
      // Let callers fall back to ResponseDecoder when session-key decryption fails.
      if (this.isEncryptedResponse(response)) {
        throw error;
      }
      return response;
    }
  }
  
  private static isEncryptedResponse(response: any): response is EncryptedResponse {
    return (
      typeof response === 'object' &&
      response !== null &&
      response.encrypted === true &&
      'payload' in response &&
      'algorithm' in response
    );
  }
  
  private static async decryptWithSessionKey(
    response: EncryptedResponse, 
    userId: string, 
    timestamp: string
  ): Promise<any> {
    const cacheKey = `${userId}:${timestamp}`;
    
    let cryptoKey = this.keyCache.get(cacheKey);
    if (!cryptoKey) {
      cryptoKey = await this.deriveSessionKey(userId, timestamp);
      this.keyCache.set(cacheKey, cryptoKey);
      
      // Clean up old keys (keep only last 10)
      if (this.keyCache.size > 10) {
        const firstKey = this.keyCache.keys().next().value;
        this.keyCache.delete(firstKey);
      }
    }
    
    return await this.performDecryption(response.payload, cryptoKey);
  }
  
  private static async decryptWithMasterKey(response: EncryptedResponse): Promise<any> {
    // For master key decryption, we'd need the master key
    // This is less secure as the key would be in the frontend
    // Better to use session-specific keys
    throw new Error('Master key decryption not implemented for security reasons');
  }
  
  private static async deriveSessionKey(userId: string, timestamp: string): Promise<CryptoKey> {
    // Get the secret from environment or use a default (not recommended for production)
    const secret = process.env.NEXT_PUBLIC_ENCRYPTION_SECRET || 'bqitech_default_secret';
    const sessionData = `${userId}:${timestamp}:${secret}`;
    
    // Hash the session data
    const encoder = new TextEncoder();
    const data = encoder.encode(sessionData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Import the hash as a key
    return await crypto.subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
  }
  
  private static async performDecryption(encryptedPayload: string, key: CryptoKey): Promise<any> {
    try {
      // Decode the base64 payload
      const encryptedData = this.base64ToArrayBuffer(encryptedPayload);
      
      // Extract IV (first 12 bytes) and ciphertext
      const iv = encryptedData.slice(0, 12);
      const ciphertext = encryptedData.slice(12);
      
      // Decrypt
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        ciphertext
      );
      
      // Convert to string and parse JSON
      const decryptedText = new TextDecoder().decode(decryptedBuffer);
      return JSON.parse(decryptedText);
      
    } catch (error) {
      throw error;
    }
  }
  
  private static base64ToArrayBuffer(base64: string): Uint8Array {
    // Use URL-safe base64 decoding
    const binaryString = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
  
  static clearKeyCache(): void {
    this.keyCache.clear();
  }
}

// Enhanced fetch wrapper that automatically handles decryption
export async function encryptedFetch(
  url: string, 
  options?: RequestInit, 
  userId?: string
): Promise<Response> {
  const response = await fetch(url, options);
  
  if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
    const originalJson = response.json.bind(response);
    
    // Override the json() method to automatically decrypt
    response.json = async () => {
      const data = await originalJson();
      return await ResponseDecryption.decrypt(data, userId);
    };
  }
  
  return response;
}

// Utility to check if Web Crypto API is available
export function isEncryptionSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'crypto' in window &&
    'subtle' in window.crypto &&
    typeof window.crypto.subtle.decrypt === 'function'
  );
}

export { ResponseDecryption }; 