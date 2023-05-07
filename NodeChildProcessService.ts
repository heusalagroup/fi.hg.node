// Copyright (c) 2023. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { ChildProcess, execFile, ExecFileOptions } from "child_process";
import { ObjectEncodingOptions } from "fs";

import { filter } from "../core/functions/filter";
import { map } from "../core/functions/map";
import { forEach } from "../core/functions/forEach";
import { ChildProcessService, CommandOptions, CommandResponse } from "../core/ChildProcessService";
import { LogService } from "../core/LogService";
import { LogLevel } from "../core/types/LogLevel";
import { ChildProcessError } from "../core/types/ChildProcessError";
import { isNumber } from "../core/types/Number";

const LOG = LogService.createLogger('NodeChildProcessService');

interface StoredChild {
    child ?: ChildProcess;
    killSignal ?: number | string;
    promise ?: Promise<CommandResponse>;
}

/**
 * Implementation to run child processes in the system using NodeJS APIs.
 *
 * @see {@link ChildProcessService}
 */
export class NodeChildProcessService implements ChildProcessService {

    /**
     * Set service log level
     * @param level
     */
    public static setLogLevel (level: LogLevel) : void {
        LOG.setLogLevel(level);
    }

    /**
     * Array of any started child processes
     */
    private _children : StoredChild[];

    /**
     * Construct the service
     */
    public constructor () {
        this._children = [];
    }

    /**
     * @see {@link ChildProcessService.destroy}
     * @inheritdoc
     */
    public destroy () : void {
        this.shutdownChildProcesses().catch((err: any) => {
            LOG.error(`Error happened when shutting down the service: `, err);
        });
    }

    /**
     * @see {@link ChildProcessService.countRunningChildren}
     * @inheritdoc
     */
    public async countChildProcesses () : Promise<number> {
        return this._children.length;
    }

    /**
     * @see {@link ChildProcessService.waitUntilDown}
     * @inheritdoc
     */
    public async waitAllChildProcessesStopped () : Promise<void> {

        // Collect children's promises
        const promises : Promise<void>[] = map(
            this._children,
            async (child : StoredChild) : Promise<void> => {
                if (child.promise) {
                    await child.promise;
                }
            }
        );

        // Wait for the children to shut down
        await Promise.allSettled(promises);

    }


    /**
     * @see {@link ChildProcessService.shutdown}
     * @inheritdoc
     */
    /** @inheritdoc */
    public async shutdownChildProcesses () : Promise<void> {
        this._sendShutdownToChildren();
        await this.waitAllChildProcessesStopped();
    }

    /**
     * @see {@link ChildProcessService.executeCommand}
     * @inheritdoc
     */
    public async executeCommand (
        name : string,
        args : readonly string[]
    ) : Promise<CommandResponse> {
        return await this._execFile(name, args);
    }

    /**
     *
     * @param name
     * @param args
     * @param opts
     * @private
     */
    private async _execFile (
        name  : string,
        args ?: readonly string[],
        opts ?: CommandOptions
    ) : Promise<CommandResponse> {
        if (!args) args = [];
        if (!opts) opts = {};

        const {
            cwd,
            env,
            encoding,
            timeout,
            uid,
            gid,
            killSignal,
            maxBuffer
        } = opts;

        let storedItem : StoredChild = {
            child: undefined,
            killSignal
        };

        const nodeOpts : ObjectEncodingOptions & ExecFileOptions = {
            ...(cwd !== undefined ? myTypeGuard({cwd}) : {}),
            ...(env !== undefined ? myTypeGuard({env}) : {}),
            ...(encoding !== undefined ? myTypeGuard({encoding: encoding as BufferEncoding}) : {}),
            ...(timeout !== undefined ? myTypeGuard({timeout}) : {}),
            ...(uid !== undefined ? myTypeGuard({uid}) : {}),
            ...(gid !== undefined ? myTypeGuard({gid}) : {}),
            ...(killSignal !== undefined ? myTypeGuard({killSignal: killSignal as NodeJS.Signals|number}) : {}),
            ...(maxBuffer !== undefined ? myTypeGuard({maxBuffer}) : {}),
        };

        const childPromise = storedItem.promise = new Promise<CommandResponse>(
            (resolve, reject) => {
                try {
                    const child = execFile(
                        name,
                        args,
                        nodeOpts,
                        (error, stdout, stderr) => {
                        try {

                            let status : number = -1;
                            if (error) {
                                status = isNumber(error?.code) ? (error?.code ?? -2) : -2;

                                if (error.signal) {
                                    LOG.debug(`Command "${name}${args?.length?' ':''}${(args??[]).join(' ')}" failed: Signal received: ${error.signal}: `, stdout, stderr, error);
                                    reject(new ChildProcessError(name, args ?? [], status, error.signal as string|number, stderr))
                                    return;
                                }

                                if (status >= 0) {
                                    LOG.debug(`Command "${name}${args?.length?' ':''}${(args??[]).join(' ')}" failed: Exit code: ${status}: `, stdout, stderr, error);
                                    reject(new ChildProcessError(name, args ?? [], status, undefined, stderr))
                                    return;
                                }

                                LOG.debug(`Command "${name}${args?.length?' ':''}${(args??[]).join(' ')}" failed: `, stdout, stderr, error);
                                reject(new ChildProcessError(name, args ?? [], status, undefined, stderr));
                                return;
                            }

                            LOG.debug(`Command "${name}${args?.length?' ':''}${(args??[]).join(' ')}" succeed: `, stdout, stderr);

                            resolve(
                                {
                                    status: 0,
                                    output: stdout,
                                    ...(stderr ? {errors: stderr} : {})
                                }
                            );

                        } catch (err) {
                            LOG.warn(`Exception handled from command "${name} ${(args??[]).join(' ')}": `, err);
                            reject(new ChildProcessError(name, args ?? [], -3, undefined, stderr));

                        } finally {

                            // Remove child from running children if found
                            this._children = filter(this._children, (item) => item !== storedItem);
                            storedItem.child = undefined;
                            storedItem.killSignal = undefined;

                        }
                    });
                    storedItem.child = child;
                    this._children.push(storedItem);
                } catch (err) {
                    LOG.warn(`Exception handled from command "${name} ${(args??[]).join(' ')}": `, err);
                    reject(new ChildProcessError(name, args ?? [], -4));
                }
            }
        );

        // Remove reference to the promise once it resolves
        childPromise.finally(
            () => {
                storedItem.promise = undefined;
            }
        );

        return childPromise;
    }

    private _sendShutdownToChildren () {
        // Send kill signals to all children
        forEach(
            this._children,
            (item: StoredChild) : void => {
                const {child, killSignal} = item;
                if (child) {
                    let status : boolean;
                    if (killSignal) {
                        status = child.kill(killSignal as number|NodeJS.Signals);
                    } else {
                        status = child.kill();
                    }
                    if (!status) {
                        LOG.warn(`Warning! Could not signal child process to stop.`);
                    }
                }
            }
        );
    }

}

function myTypeGuard (
    value: ObjectEncodingOptions & ExecFileOptions
) : ObjectEncodingOptions & ExecFileOptions {
    return value;
}