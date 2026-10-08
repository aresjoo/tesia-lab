export type ApiV13WireIssue = 'BAD_REQUEST' | 'BINDING_CONFLICT';
export declare function strictParseApiV13(payload: string, request?: boolean): unknown;
export declare function apiV13Issues(input: unknown, schemaRef: string): ApiV13WireIssue[];
export declare function validateApiV13(input: unknown, schemaRef: string): boolean;
