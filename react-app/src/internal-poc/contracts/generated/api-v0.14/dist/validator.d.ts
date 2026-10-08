export type ApiV14WireIssue = 'BAD_REQUEST' | 'BINDING_CONFLICT';
export declare function strictParseApiV14(payload: string, request?: boolean): unknown;
export declare function apiV14Issues(input: unknown, schemaRef: string): ApiV14WireIssue[];
export declare function validateApiV14(input: unknown, schemaRef: string): boolean;
