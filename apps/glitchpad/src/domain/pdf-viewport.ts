/** Content geometry, independent of product chrome spacing. */
export function pageOffsets(count:number,estimate:number,measured:ReadonlyMap<number,number>):number[]{
  const result=[0];for(let index=0;index<count;index++)result.push(result[index]+(measured.get(index)??estimate)+8);return result;
}
export function pageAtOffset(offsets:readonly number[],offset:number):number{
  let low=0,high=offsets.length-1;while(low<high){const middle=Math.floor((low+high+1)/2);if(offsets[middle]<=offset)low=middle;else high=middle-1;}return Math.max(0,Math.min(offsets.length-2,low));
}
export function continuousFits(offsets:readonly number[],maximum:number):boolean{return offsets[offsets.length-1]<=maximum;}
export function measurePdfScrollCeiling(document:Document):number{
  const probe=document.createElement('div');const content=document.createElement('div');probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;width:1px;height:1px;overflow:auto;';content.style.height='1000000000px';probe.append(content);document.body.append(probe);const maximum=probe.scrollHeight;probe.remove();return maximum>1024?maximum-64:8_000_000;
}
