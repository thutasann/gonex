/**
 * Function Registry for Worker Threads
 *
 * This registry provides a centralized way to register and manage functions
 * that can be executed in worker threads. It eliminates the need for
 * passing dependencies and args, making it more robust for all function types.
 */

/**
 * Function metadata for registration
 */
export type FunctionMetadata = {
  /** Unique identifier for the function */
  id: string;
  /** Function name for debugging */
  name: string;
  /** Function implementation */
  fn: (...args: AnyValue[]) => AnyValue;
  /** Function signature for validation */
  signature?: string;
  /** Whether the function is async */
  isAsync?: boolean;
  /** Function description */
  description?: string;
  /** Version of the function */
  version?: string;
  /** Tags for categorization */
  tags?: string[];
};

/**
 * Registry entry with metadata
 */
export type RegistryEntry = {
  metadata: FunctionMetadata;
  serializedFn: string;
  dependencies: Record<string, string>;
  createdAt: number;
  lastUsed: number;
  usageCount: number;
};

/**
 * Function registry for worker thread execution
 *
 * Provides a centralized way to register and manage functions
 * that can be executed in worker threads without passing
 * dependencies or args for each execution.
 */
export class FunctionRegistry {
  private registry: Map<string, RegistryEntry> = new Map();
  private globalDependencies: Map<string, string> = new Map();
  private isInitialized = false;

  constructor() {
    this.registerGlobalDependencies();
  }

  /**
   * Register global dependencies that are commonly used
   */
  private registerGlobalDependencies(): void {
    // Common utility functions
    this.globalDependencies.set(
      'sleep',
      `
      function sleep(duration) {
        if (typeof duration !== 'number' || duration < 0 || !isFinite(duration)) {
          throw new Error('Invalid sleep duration: must be a non-negative finite number');
        }
        return new Promise(resolve => {
          setTimeout(resolve, duration);
        });
      }
    `
    );

    this.globalDependencies.set(
      'validateTimeout',
      `
      function validateTimeout(timeout, name) {
        if (typeof timeout !== 'number' || timeout < 0 || !isFinite(timeout)) {
          throw new Error(\`Invalid \${name}: must be a non-negative finite number\`);
        }
      }
    `
    );

    this.globalDependencies.set(
      'validateDuration',
      `
      function validateDuration(duration, name) {
        if (typeof duration !== 'number' || duration < 0 || !isFinite(duration)) {
          throw new Error(\`Invalid \${name}: must be a non-negative finite number\`);
        }
      }
    `
    );

    this.globalDependencies.set(
      'log',
      `
      const log = {
        info: console.log,
        error: console.error,
        warn: console.warn,
        debug: console.debug
      };
    `
    );

    // Math utilities
    this.globalDependencies.set(
      'Math',
      `
      const Math = globalThis.Math;
    `
    );

    // JSON utilities
    this.globalDependencies.set(
      'JSON',
      `
      const JSON = globalThis.JSON;
    `
    );

    // Array utilities
    this.globalDependencies.set(
      'Array',
      `
      const Array = globalThis.Array;
    `
    );

    // Object utilities
    this.globalDependencies.set(
      'Object',
      `
      const Object = globalThis.Object;
    `
    );

    // String utilities
    this.globalDependencies.set(
      'String',
      `
      const String = globalThis.String;
    `
    );

    // Number utilities
    this.globalDependencies.set(
      'Number',
      `
      const Number = globalThis.Number;
    `
    );

    // Boolean utilities
    this.globalDependencies.set(
      'Boolean',
      `
      const Boolean = globalThis.Boolean;
    `
    );

    // Date utilities
    this.globalDependencies.set(
      'Date',
      `
      const Date = globalThis.Date;
    `
    );

    // RegExp utilities
    this.globalDependencies.set(
      'RegExp',
      `
      const RegExp = globalThis.RegExp;
    `
    );

    // Error utilities
    this.globalDependencies.set(
      'Error',
      `
      const Error = globalThis.Error;
    `
    );

    // Promise utilities
    this.globalDependencies.set(
      'Promise',
      `
      const Promise = globalThis.Promise;
    `
    );
  }

  /**
   * Register a function in the registry
   *
   * @param metadata - Function metadata
   * @returns Registry entry ID
   */
  register(metadata: FunctionMetadata): string {
    const { id, fn } = metadata;

    if (this.registry.has(id)) {
      throw new Error(`Function with ID '${id}' is already registered`);
    }

    // Serialize the function and extract dependencies
    const { serializedFn, dependencies } = this.serializeFunction(fn);

    // Create registry entry
    const entry: RegistryEntry = {
      metadata: {
        ...metadata,
        isAsync: this.isAsyncFunction(fn),
      },
      serializedFn,
      dependencies: {
        ...Object.fromEntries(this.globalDependencies),
        ...dependencies,
      },
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 0,
    };

    this.registry.set(id, entry);
    return id;
  }

  /**
   * Unregister a function from the registry
   *
   * @param id - Function ID to unregister
   * @returns Whether the function was unregistered
   */
  unregister(id: string): boolean {
    return this.registry.delete(id);
  }

  /**
   * Get a function by ID
   *
   * @param id - Function ID
   * @returns Registry entry or null if not found
   */
  get(id: string): RegistryEntry | null {
    const entry = this.registry.get(id);
    if (entry) {
      entry.lastUsed = Date.now();
      entry.usageCount++;
    }
    return entry || null;
  }

  /**
   * Check if a function is registered
   *
   * @param id - Function ID
   * @returns Whether the function is registered
   */
  has(id: string): boolean {
    return this.registry.has(id);
  }

  /**
   * Get all registered function IDs
   *
   * @returns Array of function IDs
   */
  getRegisteredIds(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Get all registry entries
   *
   * @returns Array of registry entries
   */
  getAllEntries(): RegistryEntry[] {
    return Array.from(this.registry.values());
  }

  /**
   * Clear all registered functions
   */
  clear(): void {
    this.registry.clear();
  }

  /**
   * Get registry statistics
   *
   * @returns Registry statistics
   */
  getStats(): {
    totalFunctions: number;
    totalUsage: number;
    averageUsage: number;
    oldestFunction: number;
    newestFunction: number;
  } {
    const entries = Array.from(this.registry.values());
    const totalUsage = entries.reduce(
      (sum, entry) => sum + entry.usageCount,
      0
    );
    const timestamps = entries.map(entry => entry.createdAt);

    return {
      totalFunctions: entries.length,
      totalUsage,
      averageUsage: entries.length > 0 ? totalUsage / entries.length : 0,
      oldestFunction: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestFunction: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    };
  }

  /**
   * Serialize a function for worker thread execution
   *
   * @param fn - Function to serialize
   * @returns Object containing serialized function and dependencies
   */
  private serializeFunction(fn: (...args: AnyValue[]) => AnyValue): {
    serializedFn: string;
    dependencies: Record<string, string>;
  } {
    const fnString = fn.toString();
    const dependencies: Record<string, string> = {};

    // Extract function calls from the function body
    const functionCalls = this.extractFunctionCalls(fnString);

    // Add dependencies for each function call
    for (const funcName of functionCalls) {
      if (!this.globalDependencies.has(funcName)) {
        // Try to get the function from the current scope
        const currentScope = globalThis as AnyValue;
        if (typeof currentScope[funcName] === 'function') {
          dependencies[funcName] = currentScope[funcName].toString();
        }
      }
    }

    // Create a simple async function wrapper
    const bodyMatch = fnString.match(/=>\s*\{([\s\S]*)\}$/);
    if (bodyMatch && bodyMatch[1]) {
      const functionBody = bodyMatch[1].trim();
      const serializedFn = `async function(data) {
        ${functionBody}
      }`;

      return {
        serializedFn,
        dependencies,
      };
    }

    // Fallback to original function if parsing fails
    return {
      serializedFn: fnString,
      dependencies,
    };
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
   * Check if a function is async
   *
   * @param fn - Function to check
   * @returns Whether the function is async
   */
  private isAsyncFunction(fn: (...args: AnyValue[]) => AnyValue): boolean {
    return fn.constructor.name === 'AsyncFunction';
  }

  /**
   * Initialize the registry with common functions
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Register common utility functions
    this.register({
      id: 'sleep',
      name: 'sleep',
      fn: (duration: number) => {
        return new Promise(resolve => setTimeout(resolve, duration));
      },
      description: 'Sleep for a specified duration',
      isAsync: true,
    });

    this.register({
      id: 'validateTimeout',
      name: 'validateTimeout',
      fn: (timeout: number, name: string) => {
        if (typeof timeout !== 'number' || timeout < 0 || !isFinite(timeout)) {
          throw new Error(
            `Invalid ${name}: must be a non-negative finite number`
          );
        }
      },
      description: 'Validate timeout value',
    });

    this.register({
      id: 'validateDuration',
      name: 'validateDuration',
      fn: (duration: number, name: string) => {
        if (
          typeof duration !== 'number' ||
          duration < 0 ||
          !isFinite(duration)
        ) {
          throw new Error(
            `Invalid ${name}: must be a non-negative finite number`
          );
        }
      },
      description: 'Validate duration value',
    });

    this.isInitialized = true;
  }

  /**
   * Shutdown the registry
   */
  async shutdown(): Promise<void> {
    this.clear();
    this.isInitialized = false;
  }
}

/**
 * Global function registry instance
 */
let globalFunctionRegistry: FunctionRegistry | null = null;

/**
 * Get the global function registry instance
 */
export function getFunctionRegistry(): FunctionRegistry {
  if (!globalFunctionRegistry) {
    globalFunctionRegistry = new FunctionRegistry();
  }
  return globalFunctionRegistry;
}

/**
 * Initialize the global function registry
 */
export async function initializeFunctionRegistry(): Promise<void> {
  const registry = getFunctionRegistry();
  await registry.initialize();
}

/**
 * Shutdown the global function registry
 */
export async function shutdownFunctionRegistry(): Promise<void> {
  if (globalFunctionRegistry) {
    await globalFunctionRegistry.shutdown();
    globalFunctionRegistry = null;
  }
}
