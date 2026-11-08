/** Resources installed through PDF.js's public ownerDocument boundary. */
export function createPdfDocumentResources(document:Document):{
  document:Document;
  dispose():void;
  counts():{fonts:number;nodes:number;stylesheets:number};
}{
  let disposed=false;
  let inert:Document|null=null;
  const fonts=new Set<FontFace>();const nodes=new Set<Element>();const sheets=new Set<CSSStyleSheet>();
  const listeners=new Set<{type:string;listener:EventListenerOrEventListenerObject;capture:boolean}>();
  const inactive=()=>inert??=document.implementation.createHTMLDocument('');
  const nativeFonts=document.fonts;
  let ownedFonts:FontFaceSet|undefined;
  ownedFonts=nativeFonts?new Proxy(nativeFonts,{
    get(target,key){
      if(key==='add')return(face:FontFace)=>{if(!disposed){fonts.add(face);target.add(face);}return ownedFonts;};
      if(key==='delete')return(face:FontFace)=>{fonts.delete(face);return target.delete(face);};
      const value:unknown=Reflect.get(target,key,target);return typeof value==='function'?(value as (...args:unknown[])=>unknown).bind(target):value;
    },
  }):undefined;
  const proxy=new Proxy(document,{
    get(target,key){
      if(key==='fonts')return ownedFonts;
      if(disposed&&(key==='body'||key==='head'||key==='documentElement'))return inactive()[key];
      if(key==='createElement')return(...args:Parameters<Document['createElement']>)=>{const node=(disposed?inactive():target).createElement(...args);if(!disposed&&node.tagName==='STYLE')nodes.add(node);return node;};
      if(key==='createElementNS')return(namespace:string|null,name:string,options?:ElementCreationOptions)=>{const node=(disposed?inactive():target).createElementNS(namespace,name,options);if(!disposed&&namespace==='http://www.w3.org/2000/svg'&&name.toLowerCase()==='svg')nodes.add(node);return node;};
      if(key==='adoptedStyleSheets'){
        if(disposed)return[];
        const adopted=target.adoptedStyleSheets;if(!adopted)return adopted;
        return new Proxy(adopted,{get(array,property){if(property==='push')return(...added:CSSStyleSheet[])=>{for(const sheet of added)sheets.add(sheet);return array.push(...added);};const value:unknown=Reflect.get(array,property,array);return typeof value==='function'?(value as (...args:unknown[])=>unknown).bind(array):value;}});
      }
      if(key==='addEventListener')return(type:string,listener:EventListenerOrEventListenerObject|null,options?:boolean|AddEventListenerOptions)=>{if(!listener||disposed)return;const capture=typeof options==='boolean'?options:options?.capture??false;listeners.add({type,listener,capture});target.addEventListener(type,listener,options);};
      if(key==='removeEventListener')return(type:string,listener:EventListenerOrEventListenerObject|null,options?:boolean|EventListenerOptions)=>{const capture=typeof options==='boolean'?options:options?.capture??false;target.removeEventListener(type,listener,options);for(const owned of listeners)if(owned.type===type&&owned.listener===listener&&owned.capture===capture)listeners.delete(owned);};
      const value:unknown=Reflect.get(target,key,target);return typeof value==='function'?(value as (...args:unknown[])=>unknown).bind(target):value;
    },
    set(target,key,value){if(disposed&&key==='adoptedStyleSheets')return true;return Reflect.set(target,key,value,target);},
  });
  return {document:proxy,
    counts:()=>({fonts:fonts.size,nodes:nodes.size,stylesheets:sheets.size}),
    dispose(){
      if(disposed)return;disposed=true;
      for(const owned of listeners)document.removeEventListener(owned.type,owned.listener,owned.capture);listeners.clear();
      for(const face of fonts)nativeFonts.delete(face);fonts.clear();
      for(const node of nodes)node.remove();nodes.clear();
      if(sheets.size&&document.adoptedStyleSheets)document.adoptedStyleSheets=document.adoptedStyleSheets.filter(sheet=>!sheets.has(sheet));sheets.clear();
    },
  };
}
