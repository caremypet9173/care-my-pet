import {mkdir,copyFile,readFile} from 'node:fs/promises';
const {version}=JSON.parse(await readFile(new URL('../node_modules/pdfjs-dist/package.json',import.meta.url),'utf8'));
const target=new URL(`../public/pdf-worker/${version}/`,import.meta.url);
await mkdir(target,{recursive:true});
await copyFile(new URL('../node_modules/pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url),new URL('pdf.worker.min.mjs',target));
await copyFile(new URL('../node_modules/pdfjs-dist/LICENSE',import.meta.url),new URL('LICENSE',target));
