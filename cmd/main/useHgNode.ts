// Copyright (c) 2023. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { LogService } from "../../../core/LogService";
import { HgNode } from "../../HgNode";
import { createMethodDecorator } from "../../../core/decorators/createMethodDecorator";
import { MethodDecoratorFunction } from "../../../core/decorators/types/MethodDecoratorFunction";

const LOG = LogService.createLogger( 'useHgNode' );

/**
 * Wraps the method body with Hg's Node initialization.
 *
 * E.g. it calls `HgNode.initialize();`
 *
 * Example usage:
 *
 *     ```typescript
 *     class MyApp {
 *
 *         @useHgNode()
 *         public static async run (
 *             args: string[] = []
 *         ): Promise<CommandExitStatus> {
 *             console.log('Hello world');
 *         }
 *
 *     }
 *
 * }
 */
export function useHgNode<T = any> () : MethodDecoratorFunction {
    LOG.debug(`calling createMethodDecorator`);
    return createMethodDecorator( (
        method: Function,
        context: ClassMethodDecoratorContext
    ) => {
        const propertyName = context.name;
        LOG.debug(`overriding method ${context.name.toString()}`);
        return function (
            this: T,
            ...args: readonly string[]
        ) {
            try {
                LOG.debug(`Initializing`);
                HgNode.initialize();
                return method.apply( this, args );
            } catch (err) {
                LOG.warn(`Warning! The useHgNode decorator for "${propertyName.toString()}" method had an error: `, err);
                throw err;
            }
        };
    } );
}
