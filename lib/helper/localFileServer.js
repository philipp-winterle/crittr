const path=require("path"),http=require("http"),URL=require("url"),fs=require("fs-extra"),staticServerFunc=t=>http.createServer((e,s)=>{const o=URL.parse(e.url);let i=`${t}${o.pathname}`;const a={".ico":"image/x-icon",".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".png":"image/png",".jpg":"image/jpeg",".wav":"audio/wav",".mp3":"audio/mpeg",".svg":"image/svg+xml",".pdf":"application/pdf",".doc":"application/msword",".eot":"appliaction/vnd.ms-fontobject",".ttf":"aplication/font-sfnt"};fs.exists(i,t=>{if(!t)return s.statusCode=404,s.end(`File ${i} not found!`),void console.log("404 - FILE NOT FOUND",i);fs.statSync(i).isDirectory()&&(i+="/index.html"),fs.readFile(i,(t,e)=>{if(t)s.statusCode=500,s.end(`Error getting the file: ${t}.`),console.log("500 - ERROR GETTING FILE",i);else{const t=path.parse(i).ext;s.setHeader("Content-type",a[t]||"text/plain"),s.end(e)}})})});module.exports=(t=>{const e=staticServerFunc(t);return e.setTimeout(1e3),e});