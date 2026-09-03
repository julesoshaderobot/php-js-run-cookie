import { Buffer } from "node:buffer";
const https = require('https');
const http = require('http');

const DNS_OVERRIDE = {
  'emuyobzniv.ccccocccc.cc': '185.27.134.130'
};


export default {
  async fetch (request) {
    if (request.method === "OPTIONS") {
      return handleOPTIONS();
    }
    const errHandler = (err) => {
      console.error(err);
      return new Response(err.message, fixCors({ status: err.status ?? 500 }));
    };
    try {
      return doproxy(request);
    } catch (err) {
      return errHandler(err);
    }
  }
};


class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}

const fixCors = ({ headers, status, statusText }) => {
  headers = new Headers(headers);
  headers.set("Access-Control-Allow-Origin", "*");
  return { headers, status, statusText };
};

const handleOPTIONS = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
      "Access-Control-Allow-Headers": "*",
    }
  });
};


function buildBaseUrl(reqUrl, t, protocol, targetPath) {
  const proxyBase = `${reqUrl.origin}/${t}/${protocol}`;
  
  // 处理以斜杠开头的路径
  const normalizedPath = targetPath.startsWith('/') 
    ? targetPath.slice(1) 
    : targetPath;
  
  // 获取域名部分（第一个路径段）
  const domain = normalizedPath.split('/')[0];
  
  return `${proxyBase}/${domain}`;
}

async function rewriteUrls(content, baseUrl) {
  // 替换相对路径为绝对路径
  return content.replace(
    /(href|src)=["']([^"']+)["']/g,
    (match, attr, path) => {
      if (path.startsWith('http') || path.startsWith('//')) {
        return match; // 跳过绝对路径
      }
      return `${attr}="${baseUrl}/${path}"`;
    }
  );
}

const ALLOWED_PROTOCOLS = ["http", "https"];

let decoder = new TextDecoder();

async function readStream(stream) {
  const reader = stream.getReader();
  try {
    let content = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // console.log('Received chunk:', value);
      content += decoder.decode(value, { stream: true });
    }
    return content;
  } finally {
    reader.releaseLock();
  }
}

// 在函数外部定义缓存和TTL常量
const cache = new Map();
const CACHE_TTL = 1 * 60 * 1000; // 5分钟，单位毫秒


async function doproxy(req) {
  let body = JSON.parse(await readStream(req.body))
  let burl = body["url"]
  delete body.url
  let params = JSON.stringify(body)

  const cacheKey = burl;
  
  try {
    let acookie = "";
    if (!cache.has(cacheKey) || Date.now() > cache.get(cacheKey)["expiry"] ) {
      if(cache.has(cacheKey)){
        cache.delete(cacheKey)
      }
      const isHttps = burl.startsWith('https:');
      const lib = isHttps ? https : http;
      
      const targetUrl = `${burl}/aes.js`
      // const response = await lib.request(targetUrl, {
      //   method: "GET",
      //   duplex: 'half' ,
      //   lookup: (hostname, opts, cb) => {
      //     console.log(hostname)
      //     const ip = DNS_OVERRIDE[hostname];
      //     cb(null, ip || '1.2.3.4', 4);
      //   }
      // });

      const response = await new Promise((resolve, reject) => {
        const req = lib.request(targetUrl, {
          method: 'GET',
          lookup: (hostname, opts, callback) => {
            console.log(hostname);
      
            const ip = DNS_OVERRIDE[hostname];
            console.log(ip);
            callback(null, ip || '1.2.3.4', 4);
          },
        }, res => {
          let body = '';
      
          res.setEncoding('utf8');
      
          res.on('data', chunk => {
            body += chunk;
          });
      
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body,
            });
          });
        });
      
        req.on('error', reject);
        req.end();
      });

      console.log(response)
      // let text = await response.text();
      let text = response.body;
  
      text = text.replace("var s=o.length;", "var s=o.length;let i=0;")
  
  
      let resp2 = await lib.request(`${burl}/sqlp.php?i=3`, {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.61 Chrome/126.0.6478.61 Not/A)Brand/8  Safari/537.36'
        },
        lookup: (hostname, opts, cb) => {
          const ip = DNS_OVERRIDE[hostname];
          cb(null, ip || '1.2.3.4', 4);
        }
      });
        
      let text2 = await resp2.text();
  
      console.log(text2)
      
      const r = /<html>.*<\/script><script>(.*)document.*/;
      const match = r.exec(text2); 
      text2 =  match[1]
      text = text + text2 + "toHex(slowAES.decrypt(c,2,a,b));"
      // text = text + 'function toNumbers(d){var e=[];d.replace(/(..)/g,function(d){e.push(parseInt(d,16))});return e}function toHex(){for(var d=[],d=1==arguments.length&&arguments[0].constructor==Array?arguments[0]:arguments,e="",f=0;f<d.length;f++)e+=(16>d[f]?"0":"")+d[f].toString(16);return e.toLowerCase()} var a=toNumbers("f655ba9d09a112d4968c63579db590b4"),b=toNumbers("98344c2eee86c3994890592585b49f80"),c=toNumbers("4f4c2cbaf6264e09f91c245ac70536db");toHex(slowAES.decrypt(c,2,a,b));'
      console.log(text)
      
      acookie = eval(text)

      cache.set(cacheKey, { value: acookie, expiry: Date.now() + CACHE_TTL });
    }else{
      acookie = cache.get(cacheKey)["value"];
    }

    let result = JSON.stringify({
      'Content-Type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.61 Chrome/126.0.6478.61 Not/A)Brand/8  Safari/537.36',
      'cookie': "__test=" + acookie
    })
    
    return new Response(result, fixCors({ status: 200 }));
  } catch (e) {
    console.log(e)
    return new Response("Invalid target URL", { status: 400 });
  }
}
