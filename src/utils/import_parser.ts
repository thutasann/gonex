import { pathToFileURL } from 'node:url';

/**
 * Types for import parsing
 */
export type ImportType = 'import' | 'variable';

export type YieldItem = {
  type: ImportType;
  name: string;
  absolutePath?: string;
};

export type YieldList = YieldItem[];

/**
 * Parse import statements from a function string
 *
 * @param fnStr - Function string to parse
 * @returns Promise that resolves with list of imports
 */
export async function parseTopLevelImportStatements(
  fnStr: string
): Promise<YieldList> {
  const bodyStart = fnStr.indexOf('{') + 1;
  const code = fnStr.slice(bodyStart, -1).trim();
  const lines = code.split(/(?:\s*[;\r\n]+\s*)+/);

  const importList: YieldList = [];

  for (const line of lines) {
    // Skip comments
    if (line.startsWith('//') || line.startsWith('/*')) continue;

    // Look for import statements
    if (line.includes('import ')) {
      const importMatch = line.match(/import\s+(.+?)\s+from\s+["'`](.+?)["'`]/);
      if (importMatch && importMatch[2]) {
        const moduleName = importMatch[2];

        importList.push({
          type: 'import',
          name: moduleName,
          absolutePath: await parseImport(moduleName),
        });
      }
    }

    // Look for require statements
    if (line.includes('require(')) {
      const requireMatch = line.match(/require\s*\(\s*["'`](.+?)["'`]\s*\)/);
      if (requireMatch && requireMatch[1]) {
        const moduleName = requireMatch[1];

        importList.push({
          type: 'import',
          name: moduleName,
          absolutePath: await parseImport(moduleName),
        });
      }
    }
  }

  return importList;
}

/**
 * Parse import name and resolve to absolute path
 *
 * @param name - Import name to resolve
 * @returns Promise that resolves with absolute path
 */
async function parseImport(name: string): Promise<string> {
  try {
    // Handle different import types
    if (
      name.startsWith('http://') ||
      name.startsWith('https://') ||
      name.startsWith('npm:') ||
      name.startsWith('node:')
    ) {
      return name;
    }

    // For Node.js, try to resolve the module
    try {
      const resolved = require.resolve(name);
      return pathToFileURL(resolved).toString();
    } catch (error) {
      // If require.resolve fails, return the original name
      return name;
    }
  } catch (error) {
    // Fallback to original name
    return name;
  }
}

/**
 * Extract and load external dependencies from a function
 *
 * @param fnStr - Function string to analyze
 * @returns Promise that resolves with loaded dependencies
 */
export async function extractAndLoadDependencies(
  fnStr: string
): Promise<Record<string, AnyValue>> {
  const imports = await parseTopLevelImportStatements(fnStr);
  const dependencies: Record<string, AnyValue> = {};

  for (const importItem of imports) {
    if (importItem.type === 'import' && importItem.absolutePath) {
      try {
        // Only pre-load Node.js built-in modules
        // npm packages will be loaded at runtime in the worker
        if (importItem.name.startsWith('node:')) {
          const module = await import(importItem.absolutePath);
          dependencies[importItem.name] = module;
        }
      } catch (error) {
        console.warn(`Failed to load module ${importItem.name}:`, error);
      }
    }
  }

  return dependencies;
}

/**
 * Create a function wrapper that includes external dependencies
 *
 * @param fnStr - Original function string
 * @param dependencies - External dependencies to include
 * @returns Function string with dependencies included
 */
export function createFunctionWithDependencies(
  fnStr: string,
  dependencies: Record<string, AnyValue>
): string {
  // Create dependency assignments
  const dependencyAssignments = Object.entries(dependencies)
    .map(([name, module]) => {
      if (typeof module === 'object' && module !== null) {
        // Handle ES module exports
        if (module.default) {
          return `const ${name} = ${JSON.stringify(module)};`;
        } else {
          return `const ${name} = ${JSON.stringify(module)};`;
        }
      }
      return `const ${name} = ${JSON.stringify(module)};`;
    })
    .join('\n');

  // Insert dependencies at the beginning of the function
  const bodyStart = fnStr.indexOf('{') + 1;
  const bodyEnd = fnStr.lastIndexOf('}');

  const functionStart = fnStr.substring(0, bodyStart);
  const functionBody = fnStr.substring(bodyStart, bodyEnd);
  const functionEnd = fnStr.substring(bodyEnd);

  return `${functionStart}\n${dependencyAssignments}\n${functionBody}\n${functionEnd}`;
}
