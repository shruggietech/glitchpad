import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

/** Original Apache-2.0 fixture. No third-party document content or fonts. */
export function createPdfFixture({pages=4,padding=1024*1024,hostile=true}={}) {
  const objects=[];
  const add=(value)=>{objects.push(value);return objects.length;};
  const ref=(id)=>String(id)+' 0 R';
  const stream=(text)=>'<< /Length '+Buffer.byteLength(text,'ascii')+' >>\nstream\n'+text+'\nendstream';
  const catalog=add('');const tree=add('');
  const regular=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const italic=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>');
  const symbol=add('<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>');
  const info=add('<< /Title (S049 local PDF) /Author (Glitchpad fixtures) /Subject (Worker compatibility) /Keywords (local search navigation) /Creator (Self-authored fixture generator) /Producer (Glitchpad S049) /CreationDate (D:20261108000000Z) /ModDate (D:20261108000000Z) >>');
  const outline=add('');const entry=add('');const destinations=add('');
  const action=add('<< /S /JavaScript /JS (globalThis.__s049PdfExecuted = true;) >>');
  const pagesIds=[];
  for(let index=0;index<pages;index++) {
    const content=add(stream('BT /F1 18 Tf 48 720 Td (Glitchpad PDF compatibility page '+(index+1)+') Tj 0 -32 Td /F2 14 Tf (Search cats and dogs. Local document only.) Tj 0 -28 Td /F3 14 Tf (Readable italic text.) Tj 0 -28 Td /F4 14 Tf (abc) Tj ET'));
    const link=add('<< /Type /Annot /Subtype /Link /Rect [48 540 280 570] /Border [0 0 0] /Dest (chapter-two) >>');
    const external=add('<< /Type /Annot /Subtype /Link /Rect [48 500 280 530] /Border [0 0 0] /A << /S /URI /URI (https://example.invalid/s049) >> >>');
    const rejected=add('<< /Type /Annot /Subtype /Link /Rect [48 460 280 490] /A << /S /URI /URI (javascript:globalThis.__s049PdfExecuted=true) >> >>');
    pagesIds.push(add('<< /Type /Page /Parent '+ref(tree)+' /MediaBox [0 0 612 792] /Resources << /Font << /F1 '+ref(regular)+' /F2 '+ref(bold)+' /F3 '+ref(italic)+' /F4 '+ref(symbol)+' >> >> /Contents '+ref(content)+' /Annots ['+ref(link)+' '+ref(external)+' '+ref(rejected)+'] >>'));
  }
  objects[catalog-1]='<< /Type /Catalog /Pages '+ref(tree)+' /PageLabels << /Nums [0 << /S /r >> 1 << /S /D /St 1 >>] >> /Outlines '+ref(outline)+' /Names << /Dests '+ref(destinations)+' >>'+(hostile?' /OpenAction '+ref(action):'')+' >>';
  objects[tree-1]='<< /Type /Pages /Count '+pages+' /Kids ['+pagesIds.map(ref).join(' ')+'] >>';
  objects[outline-1]='<< /Type /Outlines /First '+ref(entry)+' /Last '+ref(entry)+' /Count 1 >>';
  objects[entry-1]='<< /Title (Second chapter) /Parent '+ref(outline)+' /Dest (chapter-two) >>';
  objects[destinations-1]='<< /Names [(chapter-two) ['+ref(pagesIds[Math.min(1,pagesIds.length-1)])+' /XYZ null null null]] >>';
  if(padding) add(stream(' '.repeat(padding)));
  const parts=[Buffer.from('%PDF-1.7\n% Original Glitchpad fixture\n','ascii')];const offsets=[0];let length=parts[0].length;
  for(let index=0;index<objects.length;index++){offsets.push(length);const bytes=Buffer.from(String(index+1)+' 0 obj\n'+objects[index]+'\nendobj\n','ascii');parts.push(bytes);length+=bytes.length;}
  const xref=length;
  parts.push(Buffer.from('xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(objects.length+1)+' /Root '+ref(catalog)+' /Info '+ref(info)+' >>\nstartxref\n'+xref+'\n%%EOF\n','ascii'));
  return Buffer.concat(parts);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const directory=new URL('../fixtures/pdf/',import.meta.url);await mkdir(directory,{recursive:true});
  const files={ 's049-compatibility.pdf':createPdfFixture(), 's049-small.pdf':createPdfFixture({padding:0}), 's049-malformed.pdf':Buffer.from('%PDF-1.7\ninvalid\n','ascii') };
  const manifest=[];
  for(const [name,bytes] of Object.entries(files)){await writeFile(new URL(name,directory),bytes);manifest.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),author:'Glitchpad contributors',license:'Apache-2.0'});}
  await writeFile(new URL('pdf-fixtures.json',directory),JSON.stringify({generator:'scripts/generate-pdf-fixtures.mjs',fixtures:manifest},null,2)+'\n','utf8');
}
