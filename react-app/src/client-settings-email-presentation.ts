/** Presentation capabilities, NOT HTTP DTOs or authentication policy.
 * The authenticated host must confirm delivery using an approved SDK before
 * returning a verifier bound to that owner/address/challenge. No challenge
 * token crosses this UI boundary. Aborting discards observation; it does not
 * guarantee that the server stopped processing an explicit request. */
export type ClientEmailVerification = {
  verify: (code: string, signal: AbortSignal) => Promise<void>
}
export type ClientEmailChangeRequest = (email: string, signal: AbortSignal) => Promise<ClientEmailVerification>
