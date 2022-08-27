/*
 * Copyright (c) 2022. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.
 * Copyright (c) 2013, Mahmud Ridwan <m@hjr265.me>. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * The views and conclusions contained in the software and documentation are those
 * of the authors and should not be interpreted as representing official policies,
 * either expressed or implied, of the FreeBSD Project.
 */

import { connect, Socket, NetConnectOpts } from "net";
import { toASCII } from 'punycode';
import { isString, parseInteger } from "../../core/modules/lodash";
import { LogService } from "../../core/LogService";
import { WhoisService } from "../../core/whois/WhoisService";
import { createWhoisLookupResult, WhoisLookupResult } from "../../core/whois/types/WhoisLookupResult";
import { WhoisServerOptions } from "../../core/whois/types/WhoisServerOptions";
import { WhoisServerList } from "../../core/whois/types/WhoisServerList";
import { WhoisLookupOptions } from "../../core/whois/types/WhoisLookupOptions";

const LOG = LogService.createLogger('NodeWhoisService');

export class NodeWhoisService implements WhoisService {

    private readonly _servers: WhoisServerList;

    /**
     *
     * @param servers
     */
    public constructor (servers: WhoisServerList) {
        this._servers = servers;
    }

    /**
     *
     * @param addr
     * @param options
     */
    async whoisLookup (
        addr: string,
        options?: WhoisLookupOptions
    ): Promise<readonly WhoisLookupResult[]> {

        const _options: WhoisLookupOptions = {
            ...{
                responseEncoding: 'utf8',
                follow: 2,
                timeout: 60000 // 60 seconds in ms
            },
            ...(options ?? {})
        };

        const server: WhoisServerOptions | undefined = NodeWhoisService._parseServerOptions(_options.server);
        if ( !server ) {
            throw new Error('lookup: no whois server is known for this kind of object');
        }
        LOG.debug(`server = `, server);

        const sockOpts: NetConnectOpts = {
            host: server.host,
            port: server.port
        };

        if ( _options.bind ) {
            sockOpts.localAddress = _options.bind;
        }

        LOG.debug(`sockOpts = `, sockOpts);

        const socket = connect(sockOpts);
        if ( _options.timeout ) {
            socket.setTimeout(_options.timeout);
        }
        if ( _options.encoding ) {
            socket.setEncoding(_options.encoding);
        }

        const buffer = await NodeWhoisService._whoisSocketQuery(
            socket,
            server.punycode !== false && _options.punycode !== false ? toASCII(addr) : addr,
            server.query
        );

        const data = buffer.toString(_options.responseEncoding);
        LOG.debug(`data = `, data);

        if ( _options.follow > 0 ) {
            const nextServer = NodeWhoisService._parseNextServer(data);
            if ( nextServer && nextServer !== server.host ) {
                return [
                    createWhoisLookupResult(server.host, data)
                ].concat(
                    await this.whoisLookup(
                        addr,
                        {
                            ..._options,
                            ...{
                                follow: _options.follow - 1,
                                server: nextServer
                            }
                        }
                    )
                );
            }
        }

        return [
            createWhoisLookupResult(server.host, data)
        ];

    }

    /**
     *
     * @param server
     * @private
     */
    private static _parseServerOptions (
        server: string | WhoisServerOptions | undefined
    ) : WhoisServerOptions | undefined {
        if ( !server ) return undefined;
        if ( isString(server) ) {
            const parts = server.split(':');
            server = {
                host: parts[0],
                port: parts.length >= 2 ? parseInteger(parts[1]) : 43
            };
        }
        server = {
            ...{
                port: 43,
                query: "$addr\r\n"
            },
            ...server
        };
        return {
            ...server,
            host: server.host.trim()
        };
    }

    private static _parseNextServer (
        data: string
    ): string | undefined {
        const match = data.replace(/\r/gm, '').match(/(ReferralServer|Registrar Whois|Whois Server|WHOIS Server|Registrar WHOIS Server):[^\S\n]*((?:r?whois|https?):\/\/)?(.*)/);
        return match != null ? NodeWhoisService._cleanParsingErrors(match[3].trim()) : undefined;
    }

    private static _cleanParsingErrors (string: string) {
        return string.replace(/^[:\s]+/, '').replace(/^https?[:\/]+/, '') || string;
    }

    private static async _whoisSocketQuery (
        socket: Socket,
        idn: string,
        query: string
    ): Promise<Buffer> {
        return await new Promise(
            (resolve, reject) => {
                try {
                    const chunks: Buffer[] = [];
                    socket.write(query.replace('$addr', idn));
                    socket.on('data', (chunk) => {
                        chunks.push(chunk);
                    });
                    socket.on('timeout', () => {
                        socket.destroy();
                        reject(new Error('lookup: timeout'));
                    });
                    socket.on('error', (err) => {
                        reject(err);
                    });
                    return socket.on('close', () => {
                        resolve(Buffer.concat(chunks));
                    });
                } catch (err) {
                    reject(err);
                }
            }
        );
    }

}
