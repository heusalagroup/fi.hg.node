// Copyright (c) 2020-2021 Sendanor. All rights reserved.

import { Server, createServer, IncomingMessage, RequestListener, ServerResponse } from "http";
import { LogService } from "../../core/LogService";
import { ServerService } from "../../core/requestServer/types/ServerService";
import { RequestHandler } from "../../core/requestServer/types/RequestHandler";

const LOG = LogService.createLogger('HttpServerService');

const DEFAULT_HOSTNAME : string | undefined = undefined;
const DEFAULT_PORT = 3000;

export class HttpServerService implements ServerService<IncomingMessage, ServerResponse> {

    private readonly _requestHandler : RequestListener;
    private readonly _hostname       : string | undefined;
    private readonly _port           : number;
    private readonly _closeCallback  : () => void;
    private readonly _listenCallback : () => void;

    private _server            : Server;
    private _handler           : RequestHandler<IncomingMessage, ServerResponse> | undefined;

    /**
     *
     * @param port
     * @param hostname
     * @param handler
     * @fixme Convert to use a configuration string instead of port + hostname, so that also
     *     sockets, etc can be supported.
     */
    public constructor (
        port     : number                         = DEFAULT_PORT,
        hostname : string             | undefined = DEFAULT_HOSTNAME,
        handler  : RequestHandler<IncomingMessage, ServerResponse> | undefined = undefined
    ) {

        LOG.debug('new: ', hostname, port, handler);

        this._requestHandler = this._onRequest.bind(this);
        this._listenCallback = this._onListen.bind(this);
        this._closeCallback  = this._onClose.bind(this);

        this._hostname = hostname;
        this._port     = port;
        this._handler  = handler;
        this._server   = createServer(this._requestHandler);

    }

    public start () {
        LOG.debug(`Going to start server at ${this._getConnectionString()}`);
        if (this._hostname === undefined) {
            this._server.listen(this._port, this._listenCallback);
        } else {
            this._server.listen(this._port, this._hostname, this._listenCallback);
        }
    }

    public stop () {
        LOG.debug(`Going to stop server at ${this._getConnectionString()}`)
        this._server.close(this._closeCallback);
    }

    public setHandler (newHandler : RequestHandler<IncomingMessage, ServerResponse> | undefined) {
        LOG.debug(`Setting handler at ${this._getConnectionString()} as "${newHandler}", was "${this._handler}"`);
        this._handler = newHandler;
    }

    private _getConnectionString () : string {
        if (this._hostname === undefined) {
            return `http://${this._port}`;
        } else {
            return `http://${this._hostname}:${this._port}`;
        }
    }

    private async _callRequestHandler (req: IncomingMessage, res: ServerResponse) : Promise<void> {
        if ( this._handler !== undefined ) {
            try {
                await this._handler(req, res);
            } catch (e) {
                LOG.error(`"${req.method} ${req.url}": Response handler had an error: `, e);
            }
            if (!res.writableEnded) {
                LOG.warn(`"${req.method} ${req.url}": Warning! Request handler did not close the response.`);
                res.end();
            }
        } else {
            LOG.error(`"${req.method} ${req.url}": No handler configured"`);
            res.end('Error');
        }
    }

    private _onRequest (req: IncomingMessage, res: ServerResponse) {
        this._callRequestHandler(req, res).catch((err : any) => {
            LOG.error(`${req.method} ${req.url}: Error: `, err);
        });
    }

    private _onListen () {
        LOG.info(`Started at ${this._getConnectionString()}`);
    }

    private _onClose () {
        LOG.debug(`Closed at ${this._getConnectionString()}`);
    }

}
