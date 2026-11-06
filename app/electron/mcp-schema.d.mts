import type { McpOperation, McpWorkbookOperation } from '../src/app/mcp-contract.ts'
export function validateMutation(value: unknown): value is McpOperation
export function validateOutputOperation(value: unknown): boolean
export const outputTools: { name: string; description: string; inputSchema: object; annotations: object }[]
export function matchesSchema(value: unknown, schema: object, depth?: number): boolean
export const commandSchema: object
export const mutationTools: { name: string; description: string; inputSchema: object; annotations: object }[]
export const workbookTools: { name: string; description: string; inputSchema: object; annotations: object }[]
export function validateWorkbookOperation(value: unknown): value is McpWorkbookOperation
