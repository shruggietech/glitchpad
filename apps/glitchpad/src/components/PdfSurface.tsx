import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Button, Field, TextInput } from '../../../../brand/web/react/server';
import type { ShellSession } from '../domain/contracts';
import { PdfController, type PdfPageSurface } from '../domain/pdf-controller';
import { createPdfSourceLease } from '../domain/pdf-source-gateway';
import { classifyPdfFailure, type PdfDocumentState } from '../domain/pdf-contract';
import type { TextEditorHandle } from './TextEditorSurface';
import { TaskSurface } from './TaskSurface';
import './PdfSurface.css';

interface Props {
  session:ShellSession;
  onPdfChange?:(id:string,expectedRevision:number,state:PdfDocumentState)=>void;
  onOpenMetadata?:(opener:HTMLElement)=>void;
}
export const PdfSurface=forwardRef<TextEditorHandle,Props>(function PdfSurface({session,onPdfChange,onOpenMetadata},handleRef){
  const controller=useMemo(()=>new PdfController(session.id),[session.id,session.revision]);
  const [state,setState]=useState(controller.state);
  const [visible,setVisible]=useState(document.visibilityState!=='hidden');
  const [pageReady,setPageReady]=useState(false);
  const [pageError,setPageError]=useState<string|null>(null);
  const [preparation,setPreparation]=useState<string|null>(null);
  const [password,setPassword]=useState('');
  const [retry,setRetry]=useState(0);
  const [scale,setScale]=useState(1);
  const [rotation,setRotation]=useState(0);
  const [width,setWidth]=useState(640);
  const canvas=useRef<HTMLCanvasElement>(null);
  const text=useRef<HTMLDivElement>(null);
  const pane=useRef<HTMLDivElement>(null);
  const callbacks=useRef({onPdfChange,onOpenMetadata});callbacks.current={onPdfChange,onOpenMetadata};
  useEffect(()=>controller.subscribe(next=>{setState(next);callbacks.current.onPdfChange?.(session.id,session.revision,next);}),[controller,session.id,session.revision]);
  useEffect(()=>{const update=()=>setVisible(document.visibilityState!=='hidden');document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  useEffect(()=>{
    if(!visible){controller.cancel();return;}
    let active=true;const preparationAbort=new AbortController();setPreparation(null);
    void createPdfSourceLease(session,undefined,undefined,{signal:preparationAbort.signal,onProgress(processed,total){if(active)setPreparation('Preparing PDF: '+(processed/1048576).toFixed(1)+' MiB'+(total===null?'':' of '+(total/1048576).toFixed(1)+' MiB'));}}).then(lease=>{if(!active){void lease.close();return;}setPreparation(null);return controller.open(lease);}).catch(error=>{if(active){setPreparation(null);setPageError(classifyPdfFailure(error));controller.sourceFailed(error);}});
    return()=>{active=false;preparationAbort.abort();controller.dispose();};
  },[controller,session.source_state,retry,visible]);
  useEffect(()=>{
    const element=pane.current;if(!element)return;
    const measure=()=>setWidth(Math.max(48,element.clientWidth-16));measure();
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);observer?.observe(element);return()=>observer?.disconnect();
  },[]);
  useEffect(()=>{
    let active=true;const renderAbort=new AbortController();let surface:PdfPageSurface|null=null;setPageReady(false);setPageError(null);
    if(!state.capabilities.view || !canvas.current || !text.current || !controller.document)return;
    const render=async()=>{
      const page=await controller.document!.getPage(state.navigation.page+1);if(!active)return;
      const base=page.getViewport({scale:1,rotation});const fit=Math.min(width/base.width,2);const zoom=fit*scale;
      const container=text.current!;container.style.setProperty('--total-scale-factor',String(zoom));
      const result=await controller.renderPage(state.navigation.page,canvas.current!,container,zoom,rotation,renderAbort.signal);
      if(!active){result.dispose();return;}surface=result;setPageReady(true);
    };
    void render().catch(error=>{if(active)setPageError(classifyPdfFailure(error));});
    return()=>{active=false;renderAbort.abort();surface?.dispose();};
  },[controller,state.capabilities.view,state.navigation.page,scale,rotation,width]);
  const go=(offset:number)=>{try{controller.navigate(state.navigation.page+offset);}catch{/* Boundaries are disabled below. */}};
  useImperativeHandle(handleRef,()=>({
    invoke(command,opener){if(command==='metadata'&&opener){callbacks.current.onOpenMetadata?.(opener);return true;}if(!state.capabilities.view)return false;if(command==='zoom_in'){setScale(x=>Math.min(4,x*1.25));return true;}if(command==='zoom_out'){setScale(x=>Math.max(0.25,x/1.25));return true;}if(command==='fit'){setScale(1);return true;}return false;},
    selectRange(){return false;},
    dismissModal(){if(state.state==='password_required'){setPassword('');controller.cancel();return true;}return false;},
  }));
  return <div className="pdf-layout" data-pdf-owner={state.owner_id} data-pdf-state={state.state} data-pdf-ready={pageReady} data-pdf-worker={controller.workerReady} data-pdf-engine="6.5.438">
    <div className="pdf-controls" role="group" aria-label="PDF controls">
      <Button variant="ghost" disabled={!state.capabilities.navigate||state.navigation.page===0} onClick={()=>go(-1)} aria-label="Previous page">‹</Button>
      <output aria-label="PDF page">{state.page_count ? String(state.navigation.page+1)+' / '+String(state.page_count) : 'PDF'}</output>
      <Button variant="ghost" disabled={!state.capabilities.navigate||state.navigation.page+1===(state.page_count??0)} onClick={()=>go(1)} aria-label="Next page">›</Button>
      <Button variant="ghost" disabled={!state.capabilities.zoom} onClick={()=>setScale(1)}>Fit</Button>
      <Button variant="ghost" disabled={!state.capabilities.zoom} onClick={()=>setRotation(x=>(x+90)%360)}>Rotate</Button>
    </div>
    <div className="pdf-pane" ref={pane} tabIndex={0} aria-label="PDF pages">
      <div className="pdf-page" aria-label={'Page '+String(state.navigation.page+1)}><canvas ref={canvas} aria-hidden="true"/><div ref={text} className="pdf-text-layer"/></div>
    </div>
    {(!pageReady||pageError||state.error)&&<p className="pdf-status" role="status">{pageError??state.error??preparation??(state.state==='loading'?'Loading PDF…':state.state==='password_required'?'Password required':state.state)}{state.state==='failed'&&<Button variant="secondary" onClick={()=>setRetry(x=>x+1)}>Retry PDF</Button>}</p>}
    <TaskSurface open={state.state==='password_required'} onOpenChange={open=>{if(!open){setPassword('');controller.cancel();}}} title="PDF password" className="pdf-tools">
      <form onSubmit={event=>{event.preventDefault();controller.password(password);setPassword('');}}>
        <Field id="pdf-password" label="Password" error={state.error==='incorrect_password'?'The password was not accepted.':undefined} control={<TextInput type="password" autoComplete="off" value={password} onChange={event=>setPassword(event.target.value)}/>}/>
        <Button type="submit">Open PDF</Button>
      </form>
    </TaskSurface>
  </div>;
});
