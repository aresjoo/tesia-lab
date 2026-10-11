import {useEffect,useId,useRef,type ReactNode} from 'react'
import {X} from 'lucide-react'
import {useClientPreferences} from '../client-preferences'
import {sharingDetailCopy} from '../client-sharing-detail-copy'

/** Original sharing dialog behavior, without importing the preview producer. */
export function CopyActionDialog({title,children,onClose,trigger,focusKey}:{title:string;children:ReactNode;onClose:()=>void;trigger?:HTMLElement;focusKey?:string}){
 const {language}=useClientPreferences(),ref=useRef<HTMLDialogElement>(null),id=useId()
 useEffect(()=>{const el=ref.current!,origin=trigger??document.activeElement,scroll=document.getElementById('research-main')?.style
  const overflow=scroll?.getPropertyValue('overflow-y'),priority=scroll?.getPropertyPriority('overflow-y')
  el.showModal();scroll?.setProperty('overflow-y','hidden')
  return()=>{el.close();if(scroll){if(overflow)scroll.setProperty('overflow-y',overflow,priority);else scroll.removeProperty('overflow-y')}if(origin instanceof HTMLElement&&origin.isConnected&&!origin.closest('[inert],[hidden]'))origin.focus({preventScroll:true})}
 },[trigger])
 useEffect(()=>{const body=ref.current?.querySelector<HTMLElement>('.ss3-dialog-body');if(body)body.scrollTop=0;ref.current?.querySelector<HTMLElement>('h2')?.focus({preventScroll:true})},[focusKey])
 return <dialog className="ss3-dialog" ref={ref} aria-labelledby={id} onCancel={event=>{event.preventDefault();event.stopPropagation();onClose()}} onKeyDown={event=>{if(event.key==='Escape'&&(event.nativeEvent.isComposing||event.keyCode===229)){event.preventDefault();event.stopPropagation()}}} onClick={event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)onClose()}}><header><h2 id={id} tabIndex={-1}>{title}</h2><button type="button" aria-label={sharingDetailCopy(language,'닫기')} onClick={onClose}><X size={20}/></button></header><div className="ss3-dialog-body">{children}</div></dialog>
}
