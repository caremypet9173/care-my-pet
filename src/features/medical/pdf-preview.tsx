"use client";
import {useEffect,useRef,useState} from "react";
import {useLocale} from "next-intl";
import type {PDFDocumentProxy,RenderTask} from "pdfjs-dist";
import {Button} from "@/components/ui/button";
import {medicalMessages} from "./messages";
export function PdfPreview({url}:{url:string}) {
  const locale=useLocale();const t=medicalMessages[locale];const canvas=useRef<HTMLCanvasElement>(null);
  const [document,setDocument]=useState<PDFDocumentProxy|null>(null);const [page,setPage]=useState(1);const [zoom,setZoom]=useState(100);
  const [error,setError]=useState(false);const [pageText,setPageText]=useState("");
  useEffect(()=>{
    let active=true;let destroy:(()=>void)|undefined;
    import("pdfjs-dist").then(pdf=>{
      if(!active)return;
      pdf.GlobalWorkerOptions.workerSrc=`/pdf-worker/${pdf.version}/pdf.worker.min.mjs`;
      const task=pdf.getDocument({url,useSystemFonts:true,disableAutoFetch:true,disableStream:true});
      destroy=()=>{void task.destroy();};
      return task.promise.then(doc=>{if(active)setDocument(doc);});
    }).catch((err)=>{console.error("[PdfPreview] load error:",err);if(active)setError(true);});
    return()=>{active=false;destroy?.();};
  },[url]);
  useEffect(()=>{
    if(!document)return;let active=true;let render:RenderTask|undefined;
    document.getPage(page).then(async pdfPage=>{
      if(!active||!canvas.current)return;
      const base=pdfPage.getViewport({scale:1});
      // Bound raster allocation for pathological PDF page dimensions.
      const scale=Math.min(1.5,1600/Math.max(base.width,base.height));const viewport=pdfPage.getViewport({scale});
      canvas.current.width=viewport.width;canvas.current.height=viewport.height;
      render=pdfPage.render({canvas:canvas.current,viewport});await render.promise;
      const content=await pdfPage.getTextContent();if(active)setPageText(content.items.map(item=>"str"in item?item.str:"").join(" "));
    }).catch(error=>{if(active&&error?.name!=="RenderingCancelledException")setError(true);});
    return()=>{active=false;render?.cancel();};
  },[document,page]);
  return <div className="medical-pdf">
    <div className="medical-pdf-controls"><Button variant="ghost" disabled={!document||page<=1} onClick={()=>setPage(page-1)} aria-label={locale==="pl"?"Poprzednia strona":"Previous page"}>←</Button><span>{page} / {document?.numPages??"—"}</span><Button variant="ghost" disabled={!document||page>=document.numPages} onClick={()=>setPage(page+1)} aria-label={locale==="pl"?"Następna strona":"Next page"}>→</Button><label>{t.zoom}<select value={zoom} onChange={event=>setZoom(Number(event.target.value))}>{[100,150,200].map(value=><option key={value} value={value}>{value}%</option>)}</select></label></div>
    {error?<p role="alert">{t.loadError} {t.open}.</p>:!document?<p role="status">{t.loading}</p>:null}
    <div className="medical-pdf-scroll" tabIndex={0} role="region" aria-label={`${t.original} — ${page}`}><canvas ref={canvas} role="img" aria-label={`${t.original} — ${page}`} style={{width:`${zoom}%`}}/></div>
    {pageText&&<details className="medical-pdf-text"><summary>{locale==="pl"?"Tekst strony (dostępność)":"Page text (accessibility)"}</summary><p>{pageText}</p></details>}
  </div>;
}
