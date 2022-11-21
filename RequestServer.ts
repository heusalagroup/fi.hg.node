// Copyright (c) 2020-2021 Sendanor. All rights reserved.

import URL from "url";
import { HttpServerService } from "./requestServer/HttpServerService";
import { IncomingHttpHeaders, IncomingMessage, ServerResponse} from "http";
import { RequestRouter } from "./requestServer/RequestRouter";
import { RequestStatus, isRequestStatus, stringifyRequestStatus } from "../core/request/types/RequestStatus";
import { RequestError, createRequestError, isRequestError } from "../core/request/types/RequestError";
import { ServerService } from "../core/requestServer/types/ServerService";
import { RequestHandler} from "../core/requestServer/types/RequestHandler";
import { parseRequestMethod} from "../core/request/types/RequestMethod";
import { LogService } from "../core/LogService";
import { isRequestController} from "../core/request/types/RequestController";
import { JsonAny } from "../core/Json";
import { NodeHttpUtils } from "./requestClient/node/NodeHttpUtils";
import { ResponseEntity } from "../core/request/ResponseEntity";
import { isArray, isString} from "../core/modules/lodash";
import { Headers } from "../core/request/Headers";
import { LogLevel } from "../core/types/LogLevel";
import { Observer, ObserverCallback, ObserverDestructor } from "../core/Observer";

const LOG = LogService.createLogger('RequestServer');

export const DEFAULT_REQUEST_SERVER_CONFIG_STRING = 'http://localhost:3000';

export enum RequestServerEvent {
    CONTROLLER_ATTACHED = "RequestServer:controllerAttached",
    STARTED = "RequestServer:started",
    STOPPED = "RequestServer:stopped"
}

export type RequestServerDestructor = ObserverDestructor;


export class RequestServer {

    private readonly _server: ServerService<IncomingMessage, ServerResponse>;
    private readonly _router: RequestRouter;
    private readonly _handleRequestCallback: RequestHandler<any, any>;

    public static setLogLevel (level: LogLevel) {
        LOG.setLogLevel(level);
    }

    private readonly _observer: Observer<RequestServerEvent>;

    public static Event = RequestServerEvent;

    public on (
        name: RequestServerEvent,
        callback: ObserverCallback<RequestServerEvent>
    ): RequestServerDestructor {
        return this._observer.listenEvent(name, callback);
    }

    public constructor(
        config: string = DEFAULT_REQUEST_SERVER_CONFIG_STRING
    ) {
        this._observer = new Observer<RequestServerEvent>("RequestServer");
        this._server = RequestServer.createServerService(config);
        this._router = new RequestRouter();
        this._handleRequestCallback = this._handleRequest.bind(this);
        this._server.setHandler(this._handleRequestCallback);
    }

    public destroy (): void {
        this._observer.destroy();
    }

    /**
     * Attach an instance which was previously annotated with our Request annotation
     * implementation.
     *
     * @param controller Class instance which has internal Request annotations
     */
    public attachController (
        controller : any
    ) {
        if (isRequestController(controller)) {
            this._router.attachController(controller);
        } else {
            throw new TypeError(`RequestServer: The provided controller was not RequestController`);
        }
        if (this._observer.hasCallbacks(RequestServerEvent.CONTROLLER_ATTACHED)) {
            this._observer.triggerEvent(RequestServerEvent.CONTROLLER_ATTACHED);
        }
    }

    public start () {
        LOG.debug(`Starting server`);
        this._server.start();
        if (this._observer.hasCallbacks(RequestServerEvent.STARTED)) {
            this._observer.triggerEvent(RequestServerEvent.STARTED);
        }
    }

    public stop () {
        LOG.debug(`Stopping server`);
        this._server.stop();
        if (this._observer.hasCallbacks(RequestServerEvent.STOPPED)) {
            this._observer.triggerEvent(RequestServerEvent.STOPPED);
        }
    }

    private async _handleRequest(
        req: IncomingMessage,
        res: ServerResponse
    ) : Promise<void> {
        const reqMethod = req.method;
        const reqUrl = req.url;
        try {
            const method = parseRequestMethod(reqMethod);
            const responseData : ResponseEntity<any> = await this._router.handleRequest(
                method,
                reqUrl,
                (headers: Headers) => RequestServer._requestBodyParser(req, headers),
                this._parseRequestHeaders(req.headers)
            );
            LOG.debug(`"${reqMethod} ${reqUrl}": Processing responseEntity`);
            this._handleResponse(responseData, res);
        } catch (err) {
            LOG.debug(`"${reqMethod} ${reqUrl}": Error, passing it on: `, err);
            this._handleErrorResponse(err, res);
        }
    }

    private static async _requestBodyParser (
        req: IncomingMessage,
        headers : Headers
    ) : Promise<JsonAny | undefined> {
        const contentType : string = headers.getFirst('content-type')?.toLowerCase() ?? 'application/json';
        switch (contentType) {
            case 'application/x-www-form-urlencoded':
                return NodeHttpUtils.getRequestDataAsFormUrlEncoded(req);
            default:
                return NodeHttpUtils.getRequestDataAsJson(req);
        }
    }

    private _handleResponse(
        responseEntity : ResponseEntity<any>,
        res            : ServerResponse
    ): void {
        const statusCode : RequestStatus | number = responseEntity.getStatusCode();
        res.statusCode    = statusCode;
        res.statusMessage = stringifyRequestStatus(statusCode);
        const headers : Headers = responseEntity.getHeaders();
        if (!headers.isEmpty()) {
            headers.keySet().forEach((headerKey : string) => {
                const headerValue = headers.getValue(headerKey) ?? '';
                LOG.debug(`_handleResponse: Setting response header as "${headerKey}": "${headerValue}"`);
                if (isArray(headerValue)) {
                    res.setHeader(headerKey, [...headerValue] as string[]);
                } else {
                    res.setHeader(headerKey, headerValue);
                }
            });
        }
        if (responseEntity.hasBody()) {
            const body = responseEntity.getBody();
            if (isString(body)) {
                LOG.debug('_handleResponse: Ending as text ', statusCode, body);
                if (!headers.containsKey('Content-Type')) {
                    res.setHeader('Content-Type', 'text/plain');
                }
                res.end(body);
            } else {
                LOG.debug('_handleResponse: Ending as json ', statusCode, body);
                if (!headers.containsKey('Content-Type')) {
                    res.setHeader('Content-Type', 'application/json');
                }
                res.end(JSON.stringify(body, null, 2));
            }
        } else {
            LOG.debug('_handleResponse: Ending without body ', statusCode);
            res.end();
        }
    }

    private _handleErrorResponse(
        error: any,
        res: ServerResponse
    ): void {
        let responseEntity : ResponseEntity<RequestError> | undefined;
        if (isRequestStatus(error)) {
            responseEntity = new ResponseEntity(error);
        } else if (isRequestError(error)) {
            responseEntity = new ResponseEntity(error, error.getStatusCode());
        } else {
            LOG.error('_handleErrorResponse_ Exception: ', error);

            // FIXME: We should have an public API for testing production mode
            if ( process?.env?.NODE_ENV === 'production' ) {
                responseEntity = ResponseEntity.internalServerError();
            } else {
                responseEntity = new ResponseEntity<RequestError>(
                    createRequestError(RequestStatus.InternalServerError, `Internal Server Error: ${error}`),
                    RequestStatus.InternalServerError
                );
            }

        }
        this._handleResponse(responseEntity, res);
    }

    /**
     *
     * @param value
     * @private
     */
    private _parseRequestHeaders (value : IncomingHttpHeaders) : Headers {
        return new Headers(value);
    }

    static createServerService(
        config: string
    ): ServerService<IncomingMessage, ServerResponse> {
        const url = new URL.URL(config);
        if (url.protocol === 'http:') {
            const port = url.port ? parseInt(url.port, 10) : 80;
            return new HttpServerService(port, url.hostname);
        } else {
            throw new TypeError(`RequestServer: Protocol "${url.protocol}" not yet supported`);
        }
    }

}
