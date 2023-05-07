// Copyright (c) 2023. Heusala Group Oy <info@hg.fi>. All rights reserved.

import { NodeChildProcessService } from "./NodeChildProcessService";
import { LogLevel } from "../core/types/LogLevel";

describe('NodeChildProcessService', () => {

    let service : NodeChildProcessService;

    beforeEach( () => {
        console.debug('BeforeEach');
        NodeChildProcessService.setLogLevel(LogLevel.DEBUG);
        service = new NodeChildProcessService();
    });

    afterEach( async () => {
        try {
            console.debug('AfterEach');
            await service.shutdownChildProcesses();
            service.destroy();
            service = undefined as unknown as NodeChildProcessService;
        } catch (err) {
            console.error(`AfterEach failed: `, err);
        }
    });

    describe('#destroy', () => {
        it('can destroy the service', async () => {
            const promise = service.executeCommand('sleep', ['10']);
            service.destroy();
            await service.waitAllChildProcessesStopped();
            try {
                await promise;
            } catch (err) {
                expect(`${err}`).toContain('Signal SIGTERM');
            }
            expect( await service.countChildProcesses() ).toBe(0);
        });
    });

    describe('#waitAllChildProcessesStopped', () => {
        it('can wait until all children are down', async () => {
            const promise = service.executeCommand('sleep', ['10']);
            const shutdownPromise = service.shutdownChildProcesses();
            await service.waitAllChildProcessesStopped();
            await shutdownPromise;
            try {
                await promise;
            } catch (err) {
                expect(`${err}`).toContain('Signal SIGTERM');
            }
            expect( await service.countChildProcesses() ).toBe(0);
        });
    });

    describe('#countChildProcesses', () => {
        it('can count running children', async () => {
            expect( await service.countChildProcesses() ).toBe(0);
            const promise = service.executeCommand('ls');
            expect( await service.countChildProcesses() ).toBe(1);
            await promise;
            expect( await service.countChildProcesses() ).toBe(0);
        });
    });

    describe('#shutdownChildProcesses', () => {
        it('can shutdown child processes', async () => {
            const promise = service.executeCommand('sleep', ['10']);
            await service.shutdownChildProcesses();
            try {
                await promise;
            } catch (err) {
                expect(`${err}`).toContain('Signal SIGTERM');
            }
        });
    });

    describe('#executeCommand', () => {
        it(`can execute 'ls' command`, async () => {
            console.debug('#executeCommand');
            const promise = service.executeCommand('ls');
            const result = await promise;
            expect(result).toBeDefined();
            expect(result.name).toBe('ls');
            expect(result.args).toStrictEqual([]);
            expect(result.output).toContain('README.md');
            console.debug('#executeCommand success');
        });
    });

});
