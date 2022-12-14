// Copyright (c) 2022. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { RequestClient } from "../core/RequestClient";
import { NodeRequestClient } from "./requestClient/node/NodeRequestClient";
import { LogLevel } from "../core/types/LogLevel";
import { LogService } from "../core/LogService";
import { RequestClientInterface } from "../core/requestClient/RequestClientInterface";

const LOG = LogService.createLogger('initializeHgNode');

export class HgNode {

    public static setLogLevel (level: LogLevel) {
        LOG.setLogLevel(level);
    }

    /**
     * This method will initialize our libraries using frontend implementations.
     *
     * Right now it will call `RequestClient.setClient()` with a standard NodeJS
     * implementation. It has a dependency to NodeJS's http and https modules.
     *
     * @param requestClient
     */
    public static initialize (
        requestClient ?: RequestClientInterface | undefined
    ) {
        if (!requestClient) {
            const HTTP = require('http');
            const HTTPS = require('https');
            requestClient = new NodeRequestClient(HTTP, HTTPS);
        }
        RequestClient.setClient(requestClient);
    }

}
