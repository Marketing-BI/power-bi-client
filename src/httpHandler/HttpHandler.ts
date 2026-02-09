import iconv from 'iconv-lite';
import fetch, { RequestInit, Response } from 'node-fetch';
import { logger } from '../configuration';
import { HttpError } from './HttpError';

const ERROR_TOO_MANY_REQUESTS = 429;

export class HttpHandler {
  /**
   * Sleep for a specified duration in milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Extract the retry delay from Retry-After header (in seconds)
   */
  private static getRetryAfterSeconds(retryAfterHeader: string | null): number {
    if (!retryAfterHeader) {
      return 60; // Default fallback
    }

    // Retry-After can be either seconds (integer) or HTTP date
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds)) {
      return seconds;
    }

    // If it's an HTTP date, calculate the difference
    const retryDate = new Date(retryAfterHeader);
    const now = new Date();
    const delayMs = retryDate.getTime() - now.getTime();
    return Math.max(1, Math.ceil(delayMs / 1000));
  }

  /**
   * Handles HTTP calls with automatic retry logic for rate limiting.
   *
   * Executes an HTTP request to the specified URL with optional path and query parameters.
   * If a 429 (Too Many Requests) response is received, automatically retries the request
   * after the duration specified in the Retry-After header.
   *
   * @template T - The expected type of the parsed response body
   * @param url - The base URL for the HTTP request
   * @param requestInit - The fetch RequestInit object containing method, headers, body, etc.
   * @param pathParams - Optional object containing path parameters to be replaced in the URL
   * @param queryParams - Optional object containing query parameters to be appended to the URL
   * @returns A promise that resolves to the processed HTTP response of type T
   * @throws Will throw if the HTTP response is not successful (after retry attempts if applicable)
   */
  public static async handleHttpCall<T = unknown>(
    url: string,
    requestInit: RequestInit,
    pathParams?: Record<string, string>,
    queryParams?: Record<string, string>,
  ): Promise<T> {
    let callUrl: string = HttpHandler.assembleUrl(url, pathParams, queryParams);

    logger.info('Start calling url: %s', callUrl);
    let response: Response = await fetch(callUrl, requestInit);

    // Handle 429 Too Many Requests with retry
    if (response.status === ERROR_TOO_MANY_REQUESTS) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const delaySeconds = HttpHandler.getRetryAfterSeconds(retryAfterHeader);
      const delayMs = delaySeconds * 1000;

      logger.warn('Received 429 Too Many Requests. Retrying after %d seconds', delaySeconds);

      // Wait for the specified duration
      await HttpHandler.sleep(delayMs);

      // Retry the same request
      logger.info('Retrying request to url: %s', callUrl);
      response = await fetch(callUrl, requestInit);
    }

    return HttpHandler.handleHttpResponse<T>(response);
  }

  /**
   * Processes an HTTP response and parses the response body based on Content-Type.
   *
   * Supports multiple response formats:
   * - JSON (default)
   * - XML (with charset detection)
   * - ZIP files (as text)
   *
   * @template T - The expected type of the parsed response body
   * @param res - The HTTP Response object to process
   * @returns A promise that resolves to the parsed response body of type T
   * @throws HttpError if the response is not successful (status is not 2xx)
   */
  public static async handleHttpResponse<T = unknown>(res: Response): Promise<T> {
    if (res?.ok) {
      let data: any;
      let content = res.headers.get('Content-Type');
      if (content.includes('application/xml') || content.includes('text/xml')) {
        let charset = 'utf8';
        if (res.headers.get('Content-Type').includes('charset=')) {
          const cType = res.headers.get('Content-Type').split(';');
          charset = cType.find((hPossibility) => hPossibility.includes('charset=')).split('=')[1];
        }
        return res.buffer().then((b) => iconv.decode(b, charset) as T);
      } else if (content === 'application/zip') {
        data = await res.text();
      } else {
        const respBody = await res.text();
        data = respBody && JSON.parse(respBody);
      }

      return data as T;
    } else {
      const responseBody = await res.text();
      logger.error(responseBody);
      throw new HttpError(HttpError.ERROR_MESSAGES.COMMUNICATION_ERROR, {
        '%STATUS%': res.status,
        '%STATUS_TEXT%': res.statusText,
      });
    }
  }

  public static assembleUrl(url: string, pathParams?: Record<string, any>, queryParams?: Record<string, any>): string {
    let callUrl: string = url;
    if (pathParams) {
      for (const pathParam of Object.keys(pathParams)) {
        callUrl = callUrl.replace(':' + pathParam, pathParams[pathParam]);
      }
    }
    if (queryParams) {
      const search = "'";
      const replacer = new RegExp(search, 'g');

      const queryParamsAsString = Object.keys(queryParams)
        .map((key) => key.replace(replacer, '') + '=' + queryParams[key])
        .join('&');

      callUrl += '?' + queryParamsAsString;
    }

    return callUrl;
  }

  public static assembleRequestInit(method: string, body?: any, customHeaders?: Record<string, any>): RequestInit {
    let finalHeaders = {
      ...customHeaders,
    };

    if (!finalHeaders.hasOwnProperty('Content-Type')) {
      finalHeaders['Content-Type'] = 'application/json';
    }

    return {
      method: method,
      headers: finalHeaders,
      body: body,
    };
  }
}
