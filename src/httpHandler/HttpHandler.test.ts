import { HttpHandler } from './HttpHandler';
import fetch, { RequestInit, Response } from 'node-fetch';
import { logger } from '../configuration';

// Mock the fetch module
jest.mock('node-fetch');

// Mock the logger
jest.mock('../configuration', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('HttpHandler', () => {
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    // Mock setTimeout for faster test execution
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('handleHttpCall - Retry on 429', () => {
    it('should retry when receiving 429 with Retry-After in seconds', async () => {
      const mockSuccessResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn((key) => {
            if (key === 'Content-Type') return 'application/json';
            return null;
          }),
        },
        text: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
      } as unknown as Response;

      const mock429Response = {
        ok: false,
        status: 429,
        headers: {
          get: jest.fn((key) => {
            if (key === 'Retry-After') return '2'; // 2 seconds
            return null;
          }),
        },
      } as unknown as Response;

      // First call returns 429, second call returns success
      mockFetch.mockResolvedValueOnce(mock429Response).mockResolvedValueOnce(mockSuccessResponse);

      const testUrl = 'https://api.example.com/test';
      const requestInit: RequestInit = { method: 'GET' };

      const callPromise = HttpHandler.handleHttpCall(testUrl, requestInit);

      // Need to flush multiple microtasks to ensure:
      // 1. First fetch completes
      // 2. Code checks for 429
      // 3. setTimeout is scheduled
      // Now advance the timer
      await jest.runAllTimersAsync();

      const result = await callPromise;

      // Verify fetch was called twice
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(1, testUrl, requestInit);
      expect(mockFetch).toHaveBeenNthCalledWith(2, testUrl, requestInit);

      // Verify logger was called with warning
      expect(logger.warn).toHaveBeenCalledWith('Received 429 Too Many Requests. Retrying after %d seconds', 2);

      // Verify the successful response was returned
      expect(result).toEqual({ success: true });
    });

    it('should retry when receiving 429 with Retry-After as HTTP date', async () => {
      const mockSuccessResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn((key) => {
            if (key === 'Content-Type') return 'application/json';
            return null;
          }),
        },
        text: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
      } as unknown as Response;

      const futureDate = new Date(Date.now() + 3000).toUTCString(); // 3 seconds from now

      const mock429Response = {
        ok: false,
        status: 429,
        headers: {
          get: jest.fn((key) => {
            if (key === 'Retry-After') return futureDate;
            return null;
          }),
        },
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mock429Response).mockResolvedValueOnce(mockSuccessResponse);

      const testUrl = 'https://api.example.com/test';
      const requestInit: RequestInit = { method: 'GET' };

      const callPromise = HttpHandler.handleHttpCall(testUrl, requestInit);

      // Flush microtasks to let setTimeout be scheduled
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Advance timers (3 seconds)
      jest.advanceTimersByTime(3000);

      const result = await callPromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should use default retry delay when Retry-After header is missing', async () => {
      const mockSuccessResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn((key) => {
            if (key === 'Content-Type') return 'application/json';
            return null;
          }),
        },
        text: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
      } as unknown as Response;

      const mock429Response = {
        ok: false,
        status: 429,
        headers: {
          get: jest.fn(() => null), // No Retry-After header
        },
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mock429Response).mockResolvedValueOnce(mockSuccessResponse);

      const testUrl = 'https://api.example.com/test';
      const requestInit: RequestInit = { method: 'GET' };

      const callPromise = HttpHandler.handleHttpCall(testUrl, requestInit);

      // Flush microtasks to let setTimeout be scheduled
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Advance timers (60 seconds default)
      jest.advanceTimersByTime(60000);

      const result = await callPromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Should log with default 60 seconds
      expect(logger.warn).toHaveBeenCalledWith(
        'Received 429 Too Many Requests. Retrying after %d seconds',
        expect.any(Number),
      );
      expect(result).toEqual({ success: true });
    });

    it('should wait for the correct duration before retrying', async () => {
      const mockSuccessResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn((key) => {
            if (key === 'Content-Type') return 'application/json';
            return null;
          }),
        },
        text: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
      } as unknown as Response;

      const mock429Response = {
        ok: false,
        status: 429,
        headers: {
          get: jest.fn((key) => {
            if (key === 'Retry-After') return '5'; // 5 seconds
            return null;
          }),
        },
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mock429Response).mockResolvedValueOnce(mockSuccessResponse);

      const testUrl = 'https://api.example.com/test';
      const requestInit: RequestInit = { method: 'GET' };

      const resultPromise = HttpHandler.handleHttpCall(testUrl, requestInit);

      // Flush microtasks to let setTimeout be scheduled
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Advance timer by 5 seconds
      jest.advanceTimersByTime(5000);

      const result = await resultPromise;

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-429 errors', async () => {
      const mock500Response = {
        ok: false,
        status: 500,
        headers: {
          get: jest.fn(() => null),
        },
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mock500Response);

      const testUrl = 'https://api.example.com/test';
      const requestInit: RequestInit = { method: 'GET' };

      await expect(HttpHandler.handleHttpCall(testUrl, requestInit)).rejects.toThrow();

      // Should only call fetch once (no retry)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should handle successful response without 429', async () => {
      const mockSuccessResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn((key) => {
            if (key === 'Content-Type') return 'application/json';
            return null;
          }),
        },
        text: jest.fn().mockResolvedValue(JSON.stringify({ data: 'test' })),
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mockSuccessResponse);

      const testUrl = 'https://api.example.com/test';
      const requestInit: RequestInit = { method: 'GET' };

      const result = await HttpHandler.handleHttpCall(testUrl, requestInit);

      // Should only call fetch once (no retry needed)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: 'test' });
    });

    it('should handle path parameters correctly', async () => {
      const mockSuccessResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn((key) => {
            if (key === 'Content-Type') return 'application/json';
            return null;
          }),
        },
        text: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mockSuccessResponse);

      const testUrl = 'https://api.example.com/users/:userId/posts';
      const pathParams = { userId: '123' };
      const requestInit: RequestInit = { method: 'GET' };

      const result = await HttpHandler.handleHttpCall(testUrl, requestInit, pathParams);

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/users/123/posts', requestInit);
      expect(result).toEqual({ success: true });
    });

    it('should handle query parameters correctly', async () => {
      const mockSuccessResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn((key) => {
            if (key === 'Content-Type') return 'application/json';
            return null;
          }),
        },
        text: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mockSuccessResponse);

      const testUrl = 'https://api.example.com/search';
      const queryParams = { q: 'test', limit: '10' };
      const requestInit: RequestInit = { method: 'GET' };

      const result = await HttpHandler.handleHttpCall(testUrl, requestInit, undefined, queryParams);

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/search?q=test&limit=10', requestInit);
      expect(result).toEqual({ success: true });
    });
  });

  describe('assembleRequestInit', () => {
    it('should create request init with method and headers', () => {
      const result = HttpHandler.assembleRequestInit(
        'POST',
        { key: 'value' },
        {
          'X-Custom-Header': 'test',
        },
      );

      expect(result.method).toBe('POST');
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
      expect(result.headers).toHaveProperty('X-Custom-Header', 'test');
      expect(result.body).toEqual({ key: 'value' });
    });

    it('should not override custom Content-Type', () => {
      const result = HttpHandler.assembleRequestInit(
        'PUT',
        { key: 'value' },
        {
          'Content-Type': 'application/xml',
        },
      );

      expect(result.headers).toHaveProperty('Content-Type', 'application/xml');
    });
  });
});
