import { cp, mkdir } from 'node:fs/promises';
await mkdir(new URL('./dist/',import.meta.url),{recursive:true});
await cp(new URL('./public/',import.meta.url),new URL('./dist/',import.meta.url),{recursive:true});
console.log('静态网页已生成到 dist/。本机听写请使用 node server.mjs。');
