/** Owner-bound React presentation only, not an HTTP schema, authorization or
 * security policy. The host must obtain facts through approved SDK operations.
 * null/omitted means unknown; an empty list means a confirmed empty result. */
export type ClientSecurityPresentation = {
  sourceLabel: string
  password?: { statusLabel: string; hint?: string }
  twoFactor?: { enabled: boolean; description: string }
  devices?: readonly { id: string; label: string; current: boolean; activityLabel?: string }[] | null
  permissions?: readonly {
    id: string; label: string; value: string; description?: string
    /** An explicitly observed connection identity. A permission id is never
     * treated as a connection id, and omitted means no disconnect capability. */
    exchangeConnection?: { id: string }
  }[] | null
}

/** UI capabilities only. No actual provider currently supplies these operations.
 * Password policy is explicitly supplied, never inferred from the source mock.
 * Completion acknowledges the request, not a new security state. Hosts refresh
 * the presentation after authoritative confirmation. Abort only discards local
 * observation; it is not proof of server cancellation. Never log credentials. */
export type ClientSecurityActions = {
  password?: {
    hint: string
    accepts: (newPassword: string) => boolean
    submit: (currentPassword: string, newPassword: string, signal: AbortSignal) => Promise<void>
  }
  twoFactor?: (enabled: boolean, signal: AbortSignal) => Promise<void>
  logoutOthers?: (signal: AbortSignal) => Promise<void>
  logoutDevice?: (deviceId: string, signal: AbortSignal) => Promise<void>
  disconnectExchange?: (connectionId: string, signal: AbortSignal) => Promise<void>
  /** May navigate to the existing connection surface; it grants no permission. */
  connectExchange?: (signal: AbortSignal) => Promise<void> | void
}
