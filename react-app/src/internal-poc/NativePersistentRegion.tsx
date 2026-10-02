import type { ReactNode } from 'react'
import { ClientPersistentRegion } from '../components/ClientPersistentRegion'

/** Move only our unmanaged host. The portal target, React subtree and local
 * request/auth state stay identical across conversation/document placement.
 * The enclosing conversation key remains the ownership/lifetime boundary.
 */
export function NativePersistentRegion({ target, children }: { target?: HTMLElement | null; children: ReactNode }) {
  return <ClientPersistentRegion target={target} className="native-persistent-region" contents>{children}</ClientPersistentRegion>
}
