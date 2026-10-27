import type { McpOperation } from '../src/app/mcp-contract.ts'
export function validateMutation(value: unknown): value is McpOperation
export function matchesSchema(value: unknown, schema: object, depth?: number): boolean
export const commandSchema: object
export const mutationTools: { name: string; description: string; inputSchema: object; annotations: object }[]
