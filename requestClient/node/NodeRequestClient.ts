// Copyright (c) 2022. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.
// Copyright (c) 2020-2021. Sendanor <info@sendanor.fi>. All rights reserved.

import URL from "url";
import PATH from "path";
import { Stats } from "fs";
import { RequestMethod , stringifyRequestMethod } from "../../../core/request/types/RequestMethod";
import { JsonAny, parseJson } from "../../../core/Json";
import { RequestClientInterface } from "../../../core/requestClient/RequestClientInterface";
import { ClientRequest, IncomingHttpHeaders, IncomingMessage} from "http";
import { NodeHttpUtils } from "./NodeHttpUtils";
import { LogService } from "../../../core/LogService";
import { REQUEST_CLIENT_NODE_ENABLED} from "../../../core/requestClient/request-client-constants";
import { isRequestError, RequestError } from "../../../core/request/types/RequestError";
import { LogLevel } from "../../../core/types/LogLevel";
import { ContentType } from "../../../core/request/ContentType";
import { RequestOptions } from "https";
import { KeyObject, PxfObject } from "tls";
import { isErrorDTO } from "../../../core/types/ErrorDTO";
import { isString } from "../../../core/types/String";
import { EntityStatusTypes, ResponseEntity } from "../../../core/request/ResponseEntity";
import { Headers } from "../../../core/request/Headers";

export const FsPromises = REQUEST_CLIENT_NODE_ENABLED ? require("fs").promises : undefined;

const LOG = LogService.createLogger('NodeRequestClient');

/**
 * For HTTP options, see https://nodejs.org/docs/latest-v14.x/api/http.html#http_http_request_options_callback
 * For SSL options, see https://nodejs.org/docs/latest-v14.x/api/tls.html#tls_tls_connect_options_callback
 */
export interface HttpClientOptions extends RequestOptions {

    readonly hostname   ?: string;
    readonly port       ?: number;
    readonly path       ?: string;
    readonly method     ?: string;
    readonly headers    ?: IncomingHttpHeaders;
    readonly socketPath ?: string;

    readonly ca                 ?: string | Buffer | Array<string | Buffer> | undefined;
    readonly cert               ?: string | Buffer | Array<string | Buffer> | undefined;
    readonly ciphers            ?: string | undefined;
    readonly clientCertEngine   ?: string | undefined;
    readonly crl                ?: string | Buffer | Array<string | Buffer> | undefined;
    readonly dhparam            ?: string | Buffer | undefined;
    readonly ecdhCurve          ?: string | undefined;
    readonly honorCipherOrder   ?: boolean | undefined;
    readonly key                ?: string | Buffer | Array<Buffer | KeyObject> | undefined;
    readonly passphrase         ?: string | undefined;
    readonly pfx                ?: string | Buffer | Array<string | Buffer | PxfObject> | undefined;
    readonly rejectUnauthorized ?: boolean;
    readonly secureOptions      ?: number | undefined;
    readonly secureProtocol     ?: string | undefined;
    readonly servername         ?: string;
    readonly sessionIdContext   ?: string | undefined;
    readonly highWaterMark      ?: number;

}

export interface HttpClientCallback {
    (response: IncomingMessage) : void;
}

export interface HttpModule {

    request (options : HttpClientOptions, callback : HttpClientCallback) : ClientRequest;
    request (url: string, options : HttpClientOptions, callback : HttpClientCallback) : ClientRequest;

}

export interface JsonHttpResponse {
    readonly method      : RequestMethod;
    readonly url         : string;
    readonly statusCode  : number;
    readonly headers    ?: IncomingHttpHeaders;
    readonly body       ?: JsonAny;
}

export interface TextHttpResponse {
    readonly method      : RequestMethod;
    readonly url         : string;
    readonly statusCode  : number;
    readonly headers    ?: IncomingHttpHeaders;
    readonly body       ?: string;
}

export class NodeRequestClient implements RequestClientInterface {

    public static setLogLevel (level: LogLevel) {
        LOG.setLogLevel(level);
    }

    private readonly _http           : HttpModule;
    private readonly _https          : HttpModule;
    private readonly _defaultOptions : Partial<HttpClientOptions> | undefined;

    public constructor (
        http            : HttpModule,
        https           : HttpModule,
        defaultOptions ?: Partial<HttpClientOptions>
    ) {
        this._http = http;
        this._https = https;
        this._defaultOptions = defaultOptions;
    }

    public async textRequest (
        method   : RequestMethod,
        url      : string,
        headers ?: IncomingHttpHeaders,
        data    ?: string
    ) : Promise<string|undefined> {
        switch (method) {
            case RequestMethod.GET:    return await this._textRequest(RequestMethod.GET    , url, headers, data).then(NodeRequestClient._successTextResponse);
            case RequestMethod.POST:   return await this._textRequest(RequestMethod.POST   , url, headers, data).then(NodeRequestClient._successTextResponse);
            case RequestMethod.PATCH:  return await this._textRequest(RequestMethod.PATCH  , url, headers, data).then(NodeRequestClient._successTextResponse);
            case RequestMethod.PUT:    return await this._textRequest(RequestMethod.PUT    , url, headers, data).then(NodeRequestClient._successTextResponse);
            case RequestMethod.DELETE: return await this._textRequest(RequestMethod.DELETE , url, headers, data).then(NodeRequestClient._successTextResponse);
            default:                   throw new TypeError(`NodeRequestClient: Unsupported method: ${method}`);
        }
    }

    public async jsonRequest (
        method   : RequestMethod,
        url      : string,
        headers ?: IncomingHttpHeaders,
        data    ?: JsonAny
    ) : Promise<JsonAny| undefined> {
        switch (method) {
            case RequestMethod.GET:    return await this._jsonRequest(RequestMethod.GET    , url, headers, data).then(NodeRequestClient._successJsonResponse);
            case RequestMethod.POST:   return await this._jsonRequest(RequestMethod.POST   , url, headers, data).then(NodeRequestClient._successJsonResponse);
            case RequestMethod.PATCH:  return await this._jsonRequest(RequestMethod.PATCH  , url, headers, data).then(NodeRequestClient._successJsonResponse);
            case RequestMethod.PUT:    return await this._jsonRequest(RequestMethod.PUT    , url, headers, data).then(NodeRequestClient._successJsonResponse);
            case RequestMethod.DELETE: return await this._jsonRequest(RequestMethod.DELETE , url, headers, data).then(NodeRequestClient._successJsonResponse);
            default:                   throw new TypeError(`NodeRequestClient: Unsupported method: ${method}`);
        }
    }

    public async textEntityRequest (
        method   : RequestMethod,
        url      : string,
        headers ?: IncomingHttpHeaders,
        data    ?: string
    ) : Promise<ResponseEntity<string|undefined>> {
        switch (method) {
            case RequestMethod.GET:    return await this._textRequest(RequestMethod.GET    , url, headers, data).then(NodeRequestClient._successTextEntityResponse);
            case RequestMethod.POST:   return await this._textRequest(RequestMethod.POST   , url, headers, data).then(NodeRequestClient._successTextEntityResponse);
            case RequestMethod.PATCH:  return await this._textRequest(RequestMethod.PATCH  , url, headers, data).then(NodeRequestClient._successTextEntityResponse);
            case RequestMethod.PUT:    return await this._textRequest(RequestMethod.PUT    , url, headers, data).then(NodeRequestClient._successTextEntityResponse);
            case RequestMethod.DELETE: return await this._textRequest(RequestMethod.DELETE , url, headers, data).then(NodeRequestClient._successTextEntityResponse);
            default:                   throw new TypeError(`NodeRequestClient: Unsupported method: ${method}`);
        }
    }

    public async jsonEntityRequest (
        method   : RequestMethod,
        url      : string,
        headers ?: IncomingHttpHeaders,
        data    ?: JsonAny
    ) : Promise<ResponseEntity<JsonAny| undefined>> {
        switch (method) {
            case RequestMethod.GET:    return await this._jsonRequest(RequestMethod.GET    , url, headers, data).then(NodeRequestClient._successJsonEntityResponse);
            case RequestMethod.POST:   return await this._jsonRequest(RequestMethod.POST    , url, headers, data).then(NodeRequestClient._successJsonEntityResponse);
            case RequestMethod.PATCH:  return await this._jsonRequest(RequestMethod.PATCH  , url, headers, data).then(NodeRequestClient._successJsonEntityResponse);
            case RequestMethod.PUT:    return await this._jsonRequest(RequestMethod.PUT    , url, headers, data).then(NodeRequestClient._successJsonEntityResponse);
            case RequestMethod.DELETE: return await this._jsonRequest(RequestMethod.DELETE , url, headers, data).then(NodeRequestClient._successJsonEntityResponse);
            default:                   throw new TypeError(`NodeRequestClient: Unsupported method: ${method}`);
        }
    }

    private async _textRequest (
        method   : RequestMethod,
        url      : string,
        headers ?: IncomingHttpHeaders,
        body    ?: string
    ) : Promise<TextHttpResponse> {
        let options : HttpClientOptions = {
            method: NodeRequestClient._getMethod(method),
            headers: {
                'Content-Type': ContentType.TEXT,
            }
        };
        LOG.debug(`_textRequest: options = `, options);
        if (headers) {
            options = {
                ...options,
                headers: {
                    ...options.headers,
                    ...headers
                }
            };
        }
        const response : IncomingMessage = await this._httpRequest(url, options, body);
        const result : string | undefined = await NodeHttpUtils.getRequestDataAsString(response);
        const statusCode = response?.statusCode ?? 0;
        return {
            method,
            url,
            statusCode,
            headers: response.headers,
            body: result
        };
    }

    private async _jsonRequest (
        method   : RequestMethod,
        url      : string,
        headers ?: IncomingHttpHeaders,
        body    ?: JsonAny
    ) : Promise<JsonHttpResponse> {
        let options : HttpClientOptions = {
            method: NodeRequestClient._getMethod(method),
            headers: {
                'Content-Type': ContentType.JSON,
            }
        };
        LOG.debug(`_jsonRequest: options = `, options);
        if (headers) {
            options = {
                ...options,
                headers : {
                    ...options.headers,
                    ...headers
                }
            }
        }
        const bodyString : string | undefined = body ? JSON.stringify(body) : undefined;
        const response : IncomingMessage = await this._httpRequest(url, options, bodyString);
        const result : JsonAny | undefined = await NodeHttpUtils.getRequestDataAsJson(response);
        const statusCode = response?.statusCode ?? 0;
        return {
            method,
            url,
            statusCode,
            headers: response.headers,
            body: result
        };
    }

    private static _getMethod (method: RequestMethod) : string {
        switch (method) {
            case RequestMethod.OPTIONS : return 'OPTIONS';
            case RequestMethod.GET     : return 'GET';
            case RequestMethod.POST    : return 'POST';
            case RequestMethod.PUT     : return 'PUT';
            case RequestMethod.DELETE  : return 'DELETE';
            case RequestMethod.PATCH   : return 'PATCH';
            case RequestMethod.TRACE   : return 'TRACE';
            case RequestMethod.HEAD    : return 'HEAD';
        }
        throw new TypeError(`Unknown method: ${method}`);
    }

    private async _httpRequest (
        url      : string,
        options  : HttpClientOptions,
        body    ?: string
    ) : Promise<IncomingMessage> {
        if (this._defaultOptions !== undefined) {
            options = {
                ...this._defaultOptions,
                ...options
            };
        }
        const bodyString : string | undefined = body ? body : undefined;
        const urlParsed = new URL.URL(url);
        let httpModule : HttpModule | undefined;
        const protocol : string = urlParsed?.protocol ?? '';
        if ( protocol === 'unix:' || protocol === 'socket:' ) {

            const fullSocketPath = urlParsed?.pathname ? urlParsed?.pathname : '/';
            if (fullSocketPath === '/') {
                throw new TypeError(`No socket path found for unix protocol URL: ${url}`);
            }

            const realSocketPath : string | undefined = await this._findSocketFile(fullSocketPath);
            if (!realSocketPath) {
                throw new TypeError(`No socket path found for unix protocol URL: ${url}`);
            }

            const socketSuffix = realSocketPath.length < fullSocketPath.length ? fullSocketPath.substr(realSocketPath.length) : '';
            const path : string = `${socketSuffix}${urlParsed.search !== '?' ? urlParsed.search : ''}`;

            options = {
                ...options,
                socketPath: realSocketPath,
                path
            };

            url = '';

            httpModule = this._http;

        } else if (protocol === 'https:') {
            httpModule = this._https;
        } else {
            httpModule = this._http;
        }
        return await new Promise( (resolve, reject) => {
            let resolved = false;
            try {

                if (!httpModule) {
                    throw new Error('HTTP module not defined. This error should not happen.');
                }

                const callback = (res: IncomingMessage) => {
                    if (resolved) {
                        LOG.warn('Warning! Request had already ended when the response was received.');
                    } else {
                        resolved = true;
                        resolve(res);
                    }
                };

                let req : ClientRequest | undefined;
                if ( url ) {
                    options = {
                        ...options,
                        hostname: urlParsed.hostname,
                        port: (urlParsed?.port ? parseInt(urlParsed.port, 10) : undefined) ?? (protocol === "https:" ? 443 : 80),
                        path: urlParsed.pathname + urlParsed.search
                    };
                }

                req = httpModule.request(options, callback);

                req.on('error', (err : any) => {
                    if (resolved) {
                        LOG.warn('Warning! Request had already ended when the response was received.');
                        LOG.debug('Error from event: ', err);
                    } else {
                        LOG.debug('Passing on error from event: ', err);
                        resolved = true;
                        reject(err);
                    }
                });

                if (bodyString) {
                    req.write(bodyString);
                }
                req.end();

            } catch(err) {
                if (resolved) {
                    LOG.warn('Warning! Request had already ended when the response was received.');
                    LOG.debug('Exception: ', err);
                } else {
                    LOG.debug('Passing on error: ', err);
                    resolved = true;
                    reject(err);
                }
            }
        });
    }

    private static async _successJsonResponse (response: JsonHttpResponse) : Promise<JsonAny | undefined> {

        const statusCode = response?.statusCode;

        if ( statusCode < 200 || statusCode >= 400 ) {
            LOG.error(`Unsuccessful response with status ${statusCode}: `, response);
            const statusMessage = NodeRequestClient._stringifyErrorBodyJson(response?.body);
            throw new RequestError(
                statusCode,
                `${statusCode}${statusMessage ? ` "${statusMessage}"` : ''} for ${stringifyRequestMethod(response.method)} ${response.url}`,
                response.method,
                response.url,
                response.body
            );
        }

        //LOG.debug(`Successful response with status ${statusCode}: `, response);

        return response.body;

    }

    private static async _successTextResponse (response: TextHttpResponse) : Promise<string|undefined> {

        const statusCode = response?.statusCode;

        if ( statusCode < 200 || statusCode >= 400 ) {
            LOG.error(`Unsuccessful response with status ${statusCode}: `, response);
            const statusMessage = NodeRequestClient._stringifyErrorBodyString(response?.body);
            throw new RequestError(
                statusCode,
                `${statusCode}${statusMessage ? ` "${statusMessage}"` : ''} for ${stringifyRequestMethod(response.method)} ${response.url}`,
                response.method,
                response.url,
                response.body
            );
        }

        //LOG.debug(`Successful response with status ${statusCode}: `, response);

        return response.body;

    }

    private static async _successJsonEntityResponse (response: JsonHttpResponse) : Promise<ResponseEntity<JsonAny| undefined>> {
        const statusCode = response?.statusCode;
        if ( statusCode < 200 || statusCode >= 400 ) {
            LOG.error(`Unsuccessful response with status ${statusCode}: `, response);
            const statusMessage = NodeRequestClient._stringifyErrorBodyJson(response?.body);
            throw new RequestError(
                statusCode,
                `${statusCode}${statusMessage ? ` "${statusMessage}"` : ''} for ${stringifyRequestMethod(response.method)} ${response.url}`,
                response.method,
                response.url,
                response.body
            );
        }
        LOG.debug(`Successful response with status ${statusCode}: `, response);
        const body    : JsonAny| undefined = response.body;
        const headers : Headers = new Headers(response.headers);
        const status  : EntityStatusTypes = statusCode;
        return new ResponseEntity<JsonAny|undefined>(
            body,
            headers,
            status
        );
    }

    private static async _successTextEntityResponse (response: TextHttpResponse) : Promise<ResponseEntity<string|undefined>> {
        const statusCode = response?.statusCode;
        if ( statusCode < 200 || statusCode >= 400 ) {
            LOG.error(`Unsuccessful response with status ${statusCode}: `, response);
            const statusMessage = NodeRequestClient._stringifyErrorBodyString(response?.body);
            throw new RequestError(
                statusCode,
                `${statusCode}${statusMessage ? ` "${statusMessage}"` : ''} for ${stringifyRequestMethod(response.method)} ${response.url}`,
                response.method,
                response.url,
                response.body
            );
        }
        LOG.debug(`Successful response with status ${statusCode}: `, response);
        const body    : string| undefined = response.body;
        const headers : Headers = new Headers(response.headers);
        const status  : EntityStatusTypes = statusCode;
        return new ResponseEntity<string|undefined>(
            body,
            headers,
            status
        );
    }

    private static _stringifyErrorBodyJson (body: JsonAny | undefined) : string {
        try {
            if (body === undefined) return '';
            const bodyObject = body;
            if (bodyObject) {
                if (isRequestError(bodyObject)) return bodyObject.message;
                if (isErrorDTO(bodyObject)) return bodyObject.error;
                const errorString = (bodyObject as unknown as any)?.error;
                if (isString(errorString)) return errorString;
            }
            return JSON.stringify(body, null, 2);
        } catch (err) {
            LOG.warn(`Warning! Could not stringify error body: `, err, body);
            return body ? JSON.stringify(body, null, 2) : '';
        }
    }

    private static _stringifyErrorBodyString (body: string | undefined) : string {
        try {
            if (body === undefined) return '';
            const bodyObject = parseJson(body);
            if (bodyObject) {
                if (isRequestError(bodyObject)) return bodyObject.message;
                if (isErrorDTO(bodyObject)) return bodyObject.error;
                const errorString = (bodyObject as unknown as any)?.error;
                if (isString(errorString)) return errorString;
            }
            return body;
        } catch (err) {
            LOG.warn(`Warning! Could not stringify error body: `, err, body);
            return body ?? '';
        }
    }

    /**
     * If the result is true, this is a socket file.
     * If the result is false, you cannot find socket from the parent file.
     * If the result is undefined, you may search parent paths.
     *
     * @param path
     * @private
     */
    private async _checkSocketFile (path : string) : Promise<boolean|undefined> {

        try {

            // LOG.debug('_checkSocketFile: path =', path);

            const stat : Stats = await FsPromises.stat(path);

            // LOG.debug('_checkSocketFile: stat =', stat);

            if ( stat.isSocket()    ) return true;

            // if ( stat.isFile()      ) return false;
            // if ( stat.isDirectory() ) return false;

            return false;

        } catch (err : any) {

            const code = err?.code;

            if (code === 'ENOTDIR') {
                LOG.debug('_checkSocketFile: ENOTDIR: ', err);
                return undefined;
            }

            if (code === 'ENOENT') {
                LOG.debug('_checkSocketFile: ENOENT: ', err);
                return undefined;
            }

            LOG.error(`_checkSocketFile: Error "${code}" passed on: `, err);

            throw err;

        }

    }

    private async _findSocketFile (fullPath : string) : Promise<string | undefined> {

        // LOG.debug('_findSocketFile: fullPath: ', fullPath);

        let socketExists : boolean | undefined = await this._checkSocketFile(fullPath);

        // LOG.debug('_findSocketFile: socketExists: ', socketExists);

        if (socketExists === true) return fullPath;
        if (socketExists === false) return undefined;

        const parentPath = PATH.dirname(fullPath);
        // LOG.debug('_findSocketFile: parentPath: ', parentPath);

        if ( parentPath === "/" || parentPath === fullPath ) {
            return undefined;
        }

        return await this._findSocketFile(parentPath);

    }

}
