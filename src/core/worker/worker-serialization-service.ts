import {
  createFunctionWithDependencies,
  extractAndLoadDependencies,
} from '../../utils';

/**
 * Service responsible for serializing functions, arguments, and context objects
 * for worker thread communication
 */
export class WorkerSerializationService {
  private contextRegistry: Map<string, AnyValue> | null = null;

  /**
   * Serialize a function for worker thread execution
   *
   * @param fn - Function to serialize
   * @returns Object containing serialized function and dependencies
   */
  async serializeFunction(fn: (...args: AnyValue[]) => AnyValue): Promise<{
    functionCode: string;
    dependencies: Record<string, string>;
  }> {
    const fnString = fn.toString();
    const dependencies: Record<string, string> = {};

    // Extract function calls from the function body
    const functionCalls = this.extractFunctionCalls(fnString);

    // Add dependencies for each function call
    for (const funcName of functionCalls) {
      if (!this.isGlobalFunction(funcName)) {
        // Try to get the function from the current scope
        const currentScope = globalThis as AnyValue;
        if (typeof currentScope[funcName] === 'function') {
          // Skip built-in functions that might cause serialization issues
          if (
            funcName !== 'toString' &&
            funcName !== 'valueOf' &&
            funcName !== 'toJSON'
          ) {
            dependencies[funcName] = currentScope[funcName].toString();
          }
        }
      }
    }

    // Extract external dependencies from the function
    try {
      const externalDependencies = await extractAndLoadDependencies(fnString);

      // Add external dependencies to the dependencies object
      for (const [name, module] of Object.entries(externalDependencies)) {
        if (typeof module === 'object' && module !== null) {
          // Serialize the module as JSON
          dependencies[`external_${name}`] = JSON.stringify(module);
        }
      }
    } catch (error) {
      console.warn('Failed to extract external dependencies:', error);
    }

    // Create the function code with external dependencies
    let functionCode = fnString;

    try {
      const externalDependencies = await extractAndLoadDependencies(fnString);
      if (Object.keys(externalDependencies).length > 0) {
        functionCode = createFunctionWithDependencies(
          fnString,
          externalDependencies
        );
      }
    } catch (error) {
      console.warn('Failed to create function with dependencies:', error);
      // Fallback to original function
      functionCode = fnString;
    }

    return {
      functionCode: `const fn = ${functionCode};`,
      dependencies,
    };
  }

  /**
   * Serialize context objects for worker thread communication
   *
   * @param ctx - Context object to serialize
   * @returns Serialized context object
   */
  serializeContext(ctx: AnyValue): AnyValue {
    if (
      ctx &&
      typeof ctx === 'object' &&
      'err' in ctx &&
      'done' in ctx &&
      'deadline' in ctx
    ) {
      // This is a context object - serialize it with its actual ID
      const contextId = ctx.getContextId
        ? ctx.getContextId()
        : `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Store the context reference for later updates
      if (!this.contextRegistry) {
        this.contextRegistry = new Map();
      }
      this.contextRegistry.set(contextId, ctx);

      // Extract context values if available
      const contextValues: Record<string, AnyValue> = {};
      if (ctx.value && typeof ctx.value === 'function') {
        // Try to extract common context values
        const commonKeys = [
          'user',
          'requestId',
          'session',
          'environment',
          'userId',
          'config',
          'auth',
          'counter',
          'level',
          'final',
        ];
        for (const key of commonKeys) {
          try {
            const value = ctx.value(key);
            if (value !== null && value !== undefined) {
              contextValues[key] = value;
            }
          } catch (error) {
            // Ignore errors when accessing context values
          }
        }
      }

      return {
        __isContext: true,
        contextId,
        deadline: ctx.deadline ? ctx.deadline() : [undefined, false],
        err: ctx.err ? ctx.err() : null,
        values: contextValues,
        // We'll need to handle done() channel separately
      };
    }
    return ctx;
  }

  /**
   * Serialize arguments and extract function dependencies
   *
   * @param args - Arguments to serialize
   * @returns Object containing serialized arguments and additional dependencies
   */
  serializeArguments(args: AnyValue[]): {
    serializedArgs: AnyValue[];
    additionalDependencies: Record<string, string>;
  } {
    const serializedArgs: AnyValue[] = [];
    const additionalDependencies: Record<string, string> = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (typeof arg === 'function') {
        // Create a unique name for this function
        const funcName = `arg_func_${i}_${Date.now()}`;

        // Serialize the function and add it to dependencies
        additionalDependencies[funcName] = arg.toString();

        // Replace the function with its name in the arguments
        serializedArgs.push(funcName);
      } else if (
        arg &&
        typeof arg === 'object' &&
        'err' in arg &&
        'done' in arg &&
        'deadline' in arg
      ) {
        // This is a context object - serialize it
        serializedArgs.push(this.serializeContext(arg));
      } else {
        serializedArgs.push(arg);
      }
    }

    return {
      serializedArgs,
      additionalDependencies,
    };
  }

  /**
   * Serialize variables following the multithreading library's approach
   *
   * @param variables - Variables to serialize
   * @returns Serialized variables
   */
  serializeVariables(
    variables: Record<string, AnyValue>
  ): Record<string, AnyValue> {
    const serialized: Record<string, AnyValue> = {};

    for (const [key, value] of Object.entries(variables)) {
      if (typeof value === 'function') {
        serialized[key] = {
          wasType: 'function',
          value: value.toString(),
        };
      } else if (
        value &&
        typeof value === 'object' &&
        'err' in value &&
        'done' in value &&
        'deadline' in value
      ) {
        // This is a context object - serialize it
        serialized[key] = this.serializeContext(value);
      } else {
        serialized[key] = value;
      }
    }

    return serialized;
  }

  /**
   * Extract function calls from a function string
   *
   * @param fnString - Function string to analyze
   * @returns Array of function names called in the function
   */
  private extractFunctionCalls(fnString: string): string[] {
    const functionCalls: string[] = [];
    const skipList = [
      'console',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      'Math',
      'JSON',
      'Array',
      'Object',
      'String',
      'Number',
      'Boolean',
      'Date',
      'RegExp',
      'Error',
      'Promise',
      'async',
      'await',
      'return',
      'if',
      'else',
      'for',
      'while',
      'do',
      'switch',
      'case',
      'default',
      'try',
      'catch',
      'finally',
      'throw',
      'new',
      'typeof',
      'instanceof',
      'delete',
      'void',
      'in',
      'of',
      'yield',
      'let',
      'const',
      'var',
      'function',
      'class',
      'extends',
      'super',
      'this',
      'arguments',
      'data',
      'result',
      'error',
      'i',
      'j',
      'k',
      'x',
      'y',
      'z',
    ];

    // Find function calls using regex
    const callPattern = /\b(\w+)\s*\(/g;
    const matches = [...fnString.matchAll(callPattern)];

    for (const match of matches) {
      const funcName = match[1];
      if (
        funcName &&
        !skipList.includes(funcName) &&
        !functionCalls.includes(funcName)
      ) {
        functionCalls.push(funcName);
      }
    }

    return functionCalls;
  }

  /**
   * Check if a function is a global function
   *
   * @param funcName - Function name to check
   * @returns Whether the function is global
   */
  private isGlobalFunction(funcName: string): boolean {
    const globalFunctions = [
      'console',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      'Math',
      'JSON',
      'Array',
      'Object',
      'String',
      'Number',
      'Boolean',
      'Date',
      'RegExp',
      'Error',
      'Promise',
      'toString',
      'valueOf',
      'toJSON',
      'hasOwnProperty',
      'isPrototypeOf',
      'propertyIsEnumerable',
    ];
    return globalFunctions.includes(funcName);
  }

  /**
   * Get the context registry for external access
   *
   * @returns Context registry map
   */
  getContextRegistry(): Map<string, AnyValue> | null {
    return this.contextRegistry;
  }

  /**
   * Update context state and get serialized context data
   *
   * @param contextId - Context ID to update
   * @returns Serialized context state or null if not found
   */
  getContextState(contextId: string): Record<string, AnyValue> | null {
    if (!this.contextRegistry || !this.contextRegistry.has(contextId)) {
      return null;
    }

    const ctx = this.contextRegistry.get(contextId);
    if (!ctx) return null;

    // Extract current context values
    const contextValues: Record<string, AnyValue> = {};
    if (ctx.value && typeof ctx.value === 'function') {
      // Try to extract common context values
      const commonKeys = [
        'user',
        'requestId',
        'session',
        'environment',
        'userId',
        'config',
        'auth',
        'counter',
        'level',
        'final',
      ];
      for (const key of commonKeys) {
        try {
          const value = ctx.value(key);
          if (value !== null && value !== undefined) {
            contextValues[key] = value;
          }
        } catch (error) {
          // Ignore errors when accessing context values
        }
      }
    }

    // Get current context state
    return {
      contextId,
      deadline: ctx.deadline ? ctx.deadline() : [undefined, false],
      err: ctx.err ? ctx.err() : null,
      values: contextValues,
    };
  }

  /**
   * Clear the context registry
   */
  clearContextRegistry(): void {
    if (this.contextRegistry) {
      this.contextRegistry.clear();
    }
  }
}
