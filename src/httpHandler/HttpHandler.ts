import iconv from 'iconv-lite';
import fetch, { RequestInit, Response } from 'node-fetch';
import { logger } from '../configuration';
import { HttpError } from './HttpError';

export class HttpHandler {

    public static async handleHttpCall(url: string, requestInit: RequestInit, pathParams?: Record<string, any>, queryParams?: Record<string, any>) {
        let callUrl: string = HttpHandler.assembleUrl(url, pathParams, queryParams);

        logger.info('Start calling url: %s', callUrl);
        const response: Response = await fetch(callUrl, requestInit);
        return HttpHandler.handleHttpResponse(response);
    }

    public static async handleHttpResponse(res: Response): Promise<any> {
        if (res?.ok) {
            let data: any;
            let content = res.headers.get('Content-Type');
            if (content.includes('application/xml') || content.includes('text/xml')) {
                let charset = 'utf8';
                if (res.headers.get('Content-Type').includes('charset=')) {
                    const cType = res.headers.get('Content-Type').split(';');
                    charset = cType
                        .find((hPossibility) => hPossibility.includes('charset='))
                        .split('=')[1];
                }
                return res.buffer()
                    .then((b) => iconv.decode(b, charset));
            } else if (content === 'application/zip') {
                data = await res.text();
            } else {
                const respBody = await res.text();
                data = respBody && JSON.parse(respBody);
            }

            return data;

        } else {
            const responseBody = await res.text();
            logger.error(responseBody);
            throw new HttpError(HttpError.ERROR_MESSAGES.COMMUNICATION_ERROR, {
                "%STATUS%": res.status,
                '%STATUS_TEXT%': res.statusText
            })
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
            const search = '\'';
            const replacer = new RegExp(search, 'g')

            const queryParamsAsString = Object.keys(queryParams)
                .map((key) => key.replace(replacer,'') + '=' + queryParams[key])
                .join('&');

            callUrl += '?' + queryParamsAsString;
        }

        return callUrl;
    }

    public static assembleRequestInit(method: string, body?: any, customHeaders?: Record<string, any>): RequestInit{
        let finalHeaders = {
            ...customHeaders
        }

        if (!finalHeaders.hasOwnProperty('Content-Type')){
            finalHeaders['Content-Type'] = 'application/json'
        }

        return {
            'method': method,
            'headers': finalHeaders,
            'body': body,
        }
    }
}
