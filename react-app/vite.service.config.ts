import { createInternalPocConfig } from './vite.internal-poc.config.ts'

// Explicit packaging choice; neither a visitor's hash nor a failed request can
// switch the service to the local-preview producer.
export default createInternalPocConfig({ serviceOnly: true })
