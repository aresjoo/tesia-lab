import {createRoot,type Root} from 'react-dom/client'
import {NativeServiceApp,type NativeServicePresentations} from '../internal-poc/NativeServiceApp'
import type {CandidateCopyInput} from './use-copy-execution'
import {api18CandidateFixture} from './candidate-fixture'

/** Explicit local developer fixture. No public entry or environment flag enables it. */
export function mountCandidateCopyDevelopment(element:HTMLElement,input:CandidateCopyInput,presentations?:NativeServicePresentations):Root{
 if(!import.meta.env.DEV||!['localhost','127.0.0.1','[::1]'].includes(window.location.hostname)||input.fixture!==api18CandidateFixture)throw new Error('CANDIDATE_NOT_PUBLISHED')
 const root=createRoot(element)
 root.render(<NativeServiceApp presentations={presentations} copyExecutionInput={input} copyExecutionEnabled/>)
 return root
}
