// Copyright (c) 2022. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { RequestClient } from "../core/RequestClient";
import { REQUEST_CLIENT_NODE_ENABLED } from "../core/requestClient/request-client-constants";
import { NodeRequestClient } from "./requestClient/node/NodeRequestClient";
import { LogLevel } from "../core/types/LogLevel";
import { LogService } from "../core/LogService";

const LOG = LogService.createLogger('initializeHgNode');

export const HTTP = REQUEST_CLIENT_NODE_ENABLED ? require('http') : undefined;
export const HTTPS = REQUEST_CLIENT_NODE_ENABLED ? require('https') : undefined;

export class HgNode {

    public static setLogLevel (level: LogLevel) {
        LOG.setLogLevel(level);
        RequestClient.setLogLevel(level);
        NodeRequestClient.setLogLevel(level);
    }

    public initialize () {

        RequestClient.useClient(
            new NodeRequestClient(HTTP, HTTPS)
        );

    }

}
