// Copyright (c) 2023. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { ChildProcess, spawn, SpawnOptions, SerializationType, StdioOptions } from "child_process";

import { filter } from "../core/functions/filter";
import { map } from "../core/functions/map";
import { forEach } from "../core/functions/forEach";
import { ChildProcessService, CommandOptions, CommandResponse } from "../core/ChildProcessService";
import { LogService } from "../core/LogService";
import { LogLevel } from "../core/types/LogLevel";
import { ChildProcessError, isChildProcessError } from "../core/types/ChildProcessError";
import { isNumber } from "../core/types/Number";

const LOG = LogService.createLogger('NodeChildProcessService');

interface StoredChild {
    readonly name : string,
    readonly args : readonly string[],
    child ?: ChildProcess;
    stdout : Buffer[];
    stderr : Buffer[];
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

    private _destroyed : boolean;

    /**
     * Construct the service
     */
    public constructor () {
        this._destroyed = false;
        this._children = [];
        LOG.debug(`constructor`);
    }

    /**
     * @see {@link ChildProcessService.destroy}
     * @inheritdoc
     */
    public destroy () : void {
        this._destroyed = true;
        LOG.debug(`destroy: `, this._children);
        this.shutdownChildProcesses().catch((err: any) => {
            LOG.error(`Error happened when shutting down the service: `, err);
        });
    }

    /**
     * @see {@link ChildProcessService.countRunningChildren}
     * @inheritdoc
     */
    public async countChildProcesses () : Promise<number> {
        LOG.debug(`countChildProcesses: `, this._children);
        return this._children.length;
    }

    /**
     * @see {@link ChildProcessService.waitUntilDown}
     * @inheritdoc
     */
    public async waitAllChildProcessesStopped () : Promise<void> {
        LOG.debug(`start: waitAllChildProcessesStopped: `, this._children);
        // Collect children's promises
        const promises : Promise<void>[] = map(
            this._children,
            async (child : StoredChild) : Promise<void> => {
                try {
                    if (child.promise) {
                        await child.promise;
                    }
                } catch (err) {
                    if (isChildProcessError(err) && err.signal === (child.killSignal ?? 'SIGTERM')) {
                        LOG.debug(`Child successfully shutdown with signal ${err.signal}: `, child);
                    } else {
                        LOG.debug(`Child failed to shutdown: `, err, child);
                    }
                }
            }
        );
        // Wait for the children to shut down
        await Promise.allSettled(promises);
        LOG.debug(`end: waitAllChildProcessesStopped: `, this._children);
    }


    /**
     * @see {@link ChildProcessService.shutdown}
     * @inheritdoc
     */
    /** @inheritdoc */
    public async shutdownChildProcesses () : Promise<void> {
        LOG.debug(`start: shutdownChildProcesses: `, this._children);
        this._sendShutdownToChildren();
        await this.waitAllChildProcessesStopped();
        LOG.debug(`end: shutdownChildProcesses: `, this._children);
    }

    /**
     * @see {@link ChildProcessService.executeCommand}
     * @inheritdoc
     */
    public async executeCommand (
        name  : string,
        args ?: readonly string[],
        opts ?: CommandOptions
    ) : Promise<CommandResponse> {
        if (this._destroyed) throw new TypeError(`The service has been destroyed`);
        LOG.debug(`start: executeCommand: `, name, args, opts, this._children);
        const p = await this._execFile(name, args, opts);
        LOG.debug(`end: executeCommand: `, name, args, opts, this._children);
        return p;
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
            argv0,
            serialization,
            timeout,
            uid,
            gid,
            killSignal,
            stdio,
            detached
        } = opts;

        const storedItem : StoredChild = {
            name,
            args,
            child: undefined,
            stdout: [],
            stderr: [],
            killSignal
        };

        const nodeOpts : SpawnOptions = {
            ...(cwd !== undefined ? staticSpawnOptionsTypeGuard({cwd}) : {}),
            ...(env !== undefined ? staticSpawnOptionsTypeGuard({env}) : {}),
            ...(argv0 !== undefined ? staticSpawnOptionsTypeGuard({argv0}) : {}),
            ...(serialization !== undefined ? staticSpawnOptionsTypeGuard({serialization: serialization as SerializationType}) : {}),
            ...(detached !== undefined ? staticSpawnOptionsTypeGuard({detached}) : {}),
            ...(timeout !== undefined ? staticSpawnOptionsTypeGuard({timeout}) : {}),
            ...(uid !== undefined ? staticSpawnOptionsTypeGuard({uid}) : {}),
            ...(gid !== undefined ? staticSpawnOptionsTypeGuard({gid}) : {}),
            ...(stdio !== undefined ? staticSpawnOptionsTypeGuard({stdio: stdio as StdioOptions}) : {}),
            ...(killSignal !== undefined ? staticSpawnOptionsTypeGuard({killSignal: killSignal as NodeJS.Signals|number}) : {}),
        };

        const childPromise = storedItem.promise = new Promise<CommandResponse>(
            (resolve, reject) => {
                try {
                    const child : ChildProcess = spawn(name, args ?? [], nodeOpts);
                    storedItem.child = child;
                    this._children.push(storedItem);

                    if (child.stdout) {
                        child.stdout.on('data', (chunk: Buffer) => {
                            LOG.debug('stdout data on ', storedItem)
                            storedItem.stdout.push(chunk);
                        });
                    }

                    if (child.stderr) {
                        child.stderr.on('data', (chunk: Buffer) => {
                            LOG.debug('stderr data on ', storedItem)
                            storedItem.stderr.push(chunk);
                        });
                    }

                    child.on('close', () => {
                        LOG.debug('close on ', storedItem);
                        this._onStoredChildClose(
                            name,
                            args ?? [],
                            storedItem,
                            child.exitCode ?? undefined,
                            child.signalCode ?? undefined
                        ).then(resolve, reject);
                    });

                } catch (err) {
                    LOG.warn(`Exception handled from command "${name}${args?.length?' ':''}${(args??[]).join(' ')}": `, err);
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
                try {
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
                } catch (err) {
                    LOG.warn(`Warning! Could not send shutdown signal to child: `, err);
                }
            }
        );
    }

    private async _onStoredChildClose (
        name: string,
        args: readonly string[],
        storedItem: StoredChild,
        exitCode   ?: number,
        signalCode ?: string | number
    ) : Promise<CommandResponse> {
        LOG.debug('_onStoredChildClose on ', storedItem);
        const stderr : string = Buffer.concat(storedItem.stderr).toString('utf8');
        const stdout : string = Buffer.concat(storedItem.stdout).toString('utf8');
        try {
            return await this._onChildProcessClose(name, args, exitCode, signalCode, stdout, stderr);
        } catch (err) {
            if (isChildProcessError(err)) {
                throw err;
            }
            LOG.warn(`Unexpected exception handled: "${name} ${(args??[]).join(' ')}": `, err);
            throw new ChildProcessError(name, args ?? [], -3, undefined, stderr);
        } finally {
            try {
                // Remove child from running children if found
                if (storedItem) {
                    this._children = filter(this._children, (item) => item !== storedItem);
                    storedItem.child = undefined;
                    storedItem.killSignal = undefined;
                }
            } catch (err) {
                LOG.warn(`Error when removing the child from internal array: `, err);
            }
        }
    }

    private async _onChildProcessClose (
        name        : string,
        args        : readonly string[],
        exitCode   ?: number,
        signalCode ?: string | number,
        stdout     ?: string,
        stderr     ?: string
    ) : Promise<CommandResponse> {

        if ( signalCode !== undefined ) {
            LOG.debug(`Command failed: "${name}${args?.length?' ':''}${(args??[]).join(' ')}": Signal received: ${signalCode}: `, stdout, stderr);
            throw new ChildProcessError(name, args ?? [], -2, signalCode as string|number, stderr);
        }

        if ( exitCode !== undefined && exitCode !== 0 ) {
            const status = isNumber(exitCode) ? exitCode : -1;

            if (status >= 0) {
                LOG.debug(`Command failed: "${name}${args?.length?' ':''}${(args??[]).join(' ')}": Exit code: ${status}: `, stdout, stderr);
                throw new ChildProcessError(name, args ?? [], status, undefined, stderr);
            }

            LOG.debug(`Command failed: "${name}${args?.length?' ':''}${(args??[]).join(' ')}": `, stdout, stderr);
            throw new ChildProcessError(name, args ?? [], status, undefined, stderr);
        }

        LOG.debug(`Command succeed: "${name}${args?.length?' ':''}${(args??[]).join(' ')}": `, stdout, stderr);
        return {
            name,
            args,
            output: stdout ?? '',
            ...(stderr ? {errors: stderr} : {})
        };
    }

}

function staticSpawnOptionsTypeGuard (
    value: SpawnOptions
) : SpawnOptions {
    return value;
}
