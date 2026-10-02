// Generated closed wire types. No session or trading authority.
export type CatalogResponse = {"apiContractVersion":"0.12.0";"data":{"providers":Array<{"available":boolean;"exchangeId":ExchangeId;"reason":(StableCode) | (null)}>}};
export type ConnectionsResponse = {"apiContractVersion":"0.12.0";"data":{"connections":Array<{"connectedAt":Timestamp;"connectionId":Id;"exchangeId":ExchangeId;"maskedAccountLabel":string;"permissions":{"futuresTrade":boolean;"read":true;"spotTrade":boolean;"withdrawal":false};"permissionsVerified":boolean;"status":"connected" | "disconnected"}>}};
export type DisconnectResponse = {"apiContractVersion":"0.12.0";"data":{"connectionId":Id;"revocation":"local_only" | "revoked";"status":"disconnected"}};
export type ErrorCode = "BAD_REQUEST" | "AUTHENTICATION_REQUIRED" | "FORBIDDEN" | "CSRF_INVALID" | "ORIGIN_INVALID" | "NOT_FOUND" | "PROVIDER_UNAVAILABLE" | "TRANSACTION_EXPIRED" | "TRANSACTION_REPLAYED" | "PROVIDER_FAILED" | "PERMISSION_REJECTED" | "ACCOUNT_CONFLICT" | "RATE_LIMITED" | "INTERNAL_ERROR";
export type ErrorEnvelope = {"apiContractVersion":"0.12.0";"error":{"code":ErrorCode;"message":string}};
export type ExchangeId = "bybit" | "bitget" | "bingx" | "gate" | "mexc" | "htx";
export type Id = string;
export type StableCode = string;
export type StartRequest = {"exchangeId":ExchangeId};
export type Timestamp = string;
export type TransactionResponse = {"apiContractVersion":"0.12.0";"data":{"authorizationUrl":(string) | (null);"connectionId":(Id) | (null);"exchangeId":ExchangeId;"expiresAt":Timestamp;"failureCode":(ErrorCode) | (null);"status":"pending" | "processing" | "connected" | "failed" | "cancelled" | "expired";"transactionId":Id}};
export type DeepReadonly<T> = T extends object ? {readonly [K in keyof T]:DeepReadonly<T[K]>} : T;
