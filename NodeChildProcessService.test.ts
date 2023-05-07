// Copyright (c) 2023. Heusala Group Oy <info@hg.fi>. All rights reserved.

import { NodeChildProcessService } from "./NodeChildProcessService";
import { ChildProcessService } from "../core/ChildProcessService";
import { LogLevel } from "../core/types/LogLevel";

describe('NodeChildProcessService', () => {

    let service : ChildProcessService;

    beforeEach( () => {
        NodeChildProcessService.setLogLevel(LogLevel.NONE);
        service = new NodeChildProcessService();
    });

    afterEach( () => {
        service.destroy();
    });

    describe.skip('#destroy', () => {
        it.skip('can destroy the service', async () => {
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

    describe.skip('#waitAllChildProcessesStopped', () => {
        it.skip('can wait until all children are down', async () => {
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

    describe.skip('#shutdownChildProcesses', () => {
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
            const promise = service.executeCommand('ls');
            const result = await promise;
            expect(result).toBeDefined();
            expect(result.status).toBe(0);
            expect(result.output).toBeDefined();
        });

    });

});
