// 文本正则
let textReg = /\.(css|txt|htm|html|xml|java|properties|sql|js|md|json|conf|ini|vue|php|py|bat|gitignore|yml|go|sh|c|cpp|h|hpp|tsx|vtt|srt|ass|rs|lrc|strm)$/i
// 音乐正则
let audioReg = /\.(mp3|flac|ogg|m4a|wav|opus|wma)$/i
// 视频正则
let videoReg = /\.(mp4|mkv|avi|mov|rmvb|webm|flv|m3u8)$/i
// 图片正则
let pngReg = /\.(jpg|tiff|jpeg|png|gif|bmp|svg|ico|swf|webp|avif)$/i
// 字幕正则
let subtitleReg = /\.(srt|ass|vtt|xml)$/

let base1 = location.origin + location.pathname // 当前页面所在目录的绝对URL
let base2 = new URL("d",location).href // 下载路径
let base3 = "?path=" // 查询字符串部分
let base4 = base1 + base3 // 拼好的查询前缀

let pathCache=[]

async function loadPathCache(){
    try {
        let __HASH__ = 'aa5598c670c7f9c9ab8594d942390dad96b52631bfb78d060476b9a719365947'
        let promisify = request => new Promise((resolve, reject) => (
            request.onsuccess = () => resolve(request.result), 
            request.onerror = reject
        ));
        let fetchData = () => fetch("static/data.json.zst").then(res => res.arrayBuffer());
        let compressedData;
        
        try {
            let request = indexedDB.open(base2);
            request.onupgradeneeded = () => request.result.createObjectStore("files");
            let database = await promisify(request);
            let objectStore = database.transaction("files").objectStore("files");
            compressedData = await promisify(objectStore.get(__HASH__));
            
            if (!compressedData) {
                compressedData = await fetchData();
                objectStore = database.transaction("files", "readwrite").objectStore("files");
                objectStore.clear();
                objectStore.put(compressedData, __HASH__);
            }
            database.close();
        } catch(error) { 
            compressedData || (compressedData = await fetchData())
        }
        
        let decodedData = fzstd.decompress(new Uint8Array(compressedData));
        let jsonString = new TextDecoder().decode(decodedData);
        pathCache = JSON.parse(jsonString);
    } catch(error) {

    }

    function processNode(node) {
        const child = node[1];
        if (typeof child === "object") {
            node.c = child; 
            let total = 0;
            for (let i=child.length; i--;) {
                total += processNode(child[i]);
            }
            node[1] = total;
            return total;
        }
        return child;
    }
    processNode(pathCache);
    return {
        code: 200,
        message: "success",
        data: {
            allow_indexed: "false",
            allow_mounted: "false",
            announcement: "",
            audio_autoplay: "true",
            audio_cover: "images/logo.svg",
            auto_update_index: "false",
            default_page_size: "100",
            external_previews: "{}",
            favicon: "images/logo.svg",
            filename_char_mapping: '{"/":"|"}',
            filter_readme_scripts: "true",
            forward_direct_link_params: "false",
            hide_files: "/\\/README.md/i",
            home_container: "max_980px",
            home_icon: "🏠",
            iframe_previews: '{"doc,docx,xls,xlsx,ppt,pptx":{"Microsoft":"https://view.officeapps.live.com/op/view.aspx?src=$e_url","Google":"https://docs.google.com/gview?url=$e_url&embedded=true"},"pdf":{"PDF.js":"static/pdf.js/web/viewer.html?file=$e_url"},"epub":{"EPUB.js":"static/epub.js/viewer.html?url=$e_url"}}',
            ignore_direct_link_params: "sign,openlist_ts,raw",
            ldap_login_enabled: "false",
            ldap_login_tips: "login with ldap",
            logo: "images/logo.svg",
            main_color: "#1890ff",
            ocr_api: "https://openlistteam-ocr-api-server.hf.space/ocr/file/json",
            package_download: "true",
            pagination_type: "pagination", // all:全部  pagination:分页  load_more:加载更多  auto_load_more:自动加载更多
            preview_archives_by_default: "true",
            preview_download_by_default: "false",
            readme_autorender: "true",
            robots_txt: "User-agent:*\nAllow:/",
            search_index: "",
            settings_layout: "list",
            share_archive_preview: "false",
            share_icon: "🎁",
            share_preview: "false",
            share_preview_archives_by_default: "false",
            share_preview_download_by_default: "true",
            share_summary_content: '@{{creator}} shared {{#each files}}{{#if @first}}"{{filename this}}"{{/if}}{{#if @last}}{{#unless (eq @index 0)}} and {{@index}} more files{{/unless}}{{/if}}{{/each}} from {{site_title}}:{{base_url}}/@s/{{id}}{{#if pwd}} , the share code is {{pwd}}{{/if}}{{#if expires}}, please access before {{dateLocaleString expires}}.{{/if}}',
            show_disk_usage_in_plain_text: "false",
            site_title: "OpenList",
            sso_compatibility_mode: "false",
            sso_login_enabled: "false",
            sso_login_platform: "",
            version: "v4.1.6 (Commit: 08574785) - Frontend: v4.1.6 - Build at: 2025-11-03 03:40:51 +0000",
            video_autoplay: "true",
            webauthn_login_enabled: "false"
        }
    }
}

function fail(s){
    return {code:500,message:s,data:null}
}

function getFiles(path) {
    let node = pathCache, m;
    // 去除为空的字符串，相当于 filter(e=>e!=="")
    for (let part of path.split("/").filter(e=>e)) {
        m = node.m || (node.m = new Map)
        if (m.has(part)) {
          node = m.get(part);
          continue;
        }
        node = node.c
        if (!node) return 0; // 0..c -> undefined
        node = node.find(child => child[0] === part);
        if (!node) return 0;
        m.set(part, node);
    }
    return node;
}

function fsList(path,page,per_page){
    // 0..c -> undefined
    let b = getFiles(path).c
    if(b){
        let start = (page - 1) * per_page // 没有分页时，默认请求 page=1 per_page=0
        let end = per_page ? Math.min(start + per_page, b.length) : b.length;
        let c = {
            "code": 200,
            "message": "success",
            "data": {
                "content": [],
                "total": b.length,
                "readme": "",
                "header": "",
                "write": false,
            }
        }
        for(let i=start;i<end;i++){
            let [n,s,m] = b[i]
            if(b[i].c){
                t = 1            
            }else{
                t = getFileType(n)
            }
            let content =  {
                "name": n,
                "size": s,
                "is_dir": t == 1,
                "modified": m,
                "sign": "",
                "thumb": "",
                "type": t,
            }
            c.data.content.push(content);
        }
        return c
    }else{
        return fail(path + " is not a folder")
    }
}

function fsGet(path){
    let index = path.lastIndexOf('/')
    let n = path.slice(index + 1),f = getFiles(path.slice(0, index)).c; // 0..c --> undefined
    if(!f) return fail("Network Error")
    let b = path == "/" ? pathCache : f.find(r=>r[0]==n)
    if(!b) return fail(n + " is not Found")
    if(b.c){
        return {
            "code": 200,
            "message": "success",
            "data": {
                "name": n || "root",
                "size": 0,
                "is_dir": true,
                "modified": 0,
                "sign": "",
                "thumb": "",
                "type": 0,
                "raw_url": "",
                "readme": "",
                "header": "",
                "related": null
            }
        }
    }else{
        let [n,s,m] = b , t = getFileType(n)
        let c = {
            "code": 200,
            "message": "success",
            "data": {
                "name": n,
                "size": s,
                "is_dir": false,
                "modified": m,
                "sign": "",
                "thumb": "",
                "type": t,
                "raw_url": gateway(path.split("/").map(r=>encodeURIComponent(r)).join("/")),
                "readme": "",
                "header": "",
                "related": null
            }
        }
        if(t == 2){
            let related = [];
            let w = n.replace(videoReg,"");
            for(let link of f){
                let [n,s,m] = link
                if(!link.c && subtitleReg.test(n) && n.startsWith(w)){
                    let content = {
                        "name": n,
                        "size": s,
                        "is_dir": false,
                        "modified": m,
                        "sign": "",
                        "thumb": "",
                        "type": 4
                    }
                    related.push(content);
                }
            }
            c.data.related = related
        }
        return c
    }
}

function fsDirs(path){
    let b = getFiles(path).c
    if(b){
        let c = {
            "code": 200,
            "message": "success",
            "data": []
        }
        for(let link of b){
            let n = link[0]
            if(link.c){
                c.data.push({
                    "name": n,
                    "modified": link[2],
                });
            }
        }
        return c
    }else{
        return fail(path + " is not a folder")
    }      
}

// https://github.com/farzher/fuzzysort v1.9.0 最大长度为 8192
let[fuzzy,init]=function(){function r(e){return n+e<i?t.subarray(n,n+=e):(n=0,t=new Uint16Array(i<<=1),r(e))}let e,f,n=0,i=16384,t=new Uint16Array(i);var a=new Map,o=r(8192),l=r(8192),u=function(e){for(var f=e.length,n=r(f),i=0;i<f;++i)n[i]=e.charCodeAt(i);for(e=0,f=n.length-1;0<=f;--f)e|=1<<(97<=(i=n[f])&&122>=i?i-97:48<=i&&57>=i?26:32===i?27:127>=i?28:29);return[n,e]};return[function(n){if(!(n=n[0]))return 0;var i=n.toLowerCase();let[t,v]=e;if((n=a.get(i))||a.set(i,n=u(i)),(v&n[1])!=v)n=0;else r:{var s=n,b=f,c=t[0],g=s[0];n=t.length;for(var h=g.length,k=0,w=0,y=0;;){if(c===g[w]){if(o[y++]=w,++k===n)break;c=t[k]}if(++w>=h){n=0;break r}}k=0,c=!1;var d=0,A=s[2];if(!A){var z=A=g.length;w=[];for(var C=0,U=!1,p=0;p<z;++p){var x=g[p];x=97<=x&&122>=x||48<=x&&57>=x;var L=!U||!x;U=x,L&&(w[C++]=p)}for(z=r(A),C=w[0],p=U=0;p<A;++p)C>p?z[p]=C:(C=w[++U],z[p]=void 0===C?A:C);A=s[2]=z}if(s=0,(w=0===o[0]?0:A[o[0]-1])!==h)for(;;)if(w>=h){if(0>=k)break;if(200<++s)break;--k,w=A[l[--d]]}else if(t[k]===g[w]){if(l[d++]=w,++k===n){c=!0;break}++w}else w=A[w];if(g=i.indexOf(b,o[0]),(i=~g)&&!c)for(b=0;b<y;++b)o[b]=g+b;for(y=!1,i&&(y=A[g-1]==g),k=c?l:o,s=g=0,b=n-1;1<=b;--b)1!==k[b]-k[b-1]&&(g-=k[b],++s);if(g-=(k[n-1]-k[0]-(n-1))*s,0!==k[0]&&(g-=10*k[0]),c){for(c=1,b=A[0];b<h;b=A[b])++c;24<c&&(g*=10*(c-24))}else g*=1e3;i&&(g/=10),y&&(g/=10),n=g-(h-n)-1}return n},function(r){f=r,e=u(r)}]}()

let prevPath = "", prevName, prevType
function fsSearch(path,searchName,searchType,page,per_page){
    let c = {
        "code": 200,
        "message": "success",
        "data": {
            "content": [],
            "total": 0
        }
    }
    if(!per_page) per_page= 2e9 // 不大可能超过这个数
    searchName = searchName.trim().toLowerCase() // 去除搜查空格
    let cached = searchName == prevName && (prevType ==  0 || prevType == searchType) && path.startsWith(prevPath)
    // 如果搜寻名字相同，且搜寻类型相同，且路径是之前的子路径，可以不用重复查找
    if(!cached){ prevName = searchName ; prevPath = path ; prevType = searchType}
    init(searchName)
    let results = []
    let files = getFiles(path);
    function dfs(files,depth) {
        if (depth === 20) {  // 最大搜寻深度为 20
            return;
        }
        for (let file of files.c) {
            let child = file.c
            if(child){
                // 为目录时
                file.p = files
                if(searchType !== 2){  // 0 都搜寻、1 搜寻目录、2 搜寻文件 
                    if (cached ? file.s : file.s=fuzzy(file)){
                        results.push(file)
                    }
                }
                dfs(file , depth + 1);
            }else{
                // 为文件时
                if(searchType !== 1){ // 0 都搜寻、1 搜寻目录、2 搜寻文件 
                    if(cached ? file.s : file.s=fuzzy(file)){
                        file.p = files
                        results.push(file)
                    }
                }
            }
        }
    }
    if(searchName && files){  
        dfs(files,0) // 当 searchName 和 files 存在时进行搜查
    }
    let path1 = path == "/" ? path : path + "/"
    c.data.total = results.length
    c.data.content = results.sort((a,b)=>b.s-a.s).slice((page-1)*per_page,page*per_page).map(c=>{
        let parts = []
        let node = c
        while ((node = node.p) !== files) {
            parts.push(node[0])
        }
        let parent
        if(parts.length){
            // 拼接字符串
            parent = path1 + parts.reverse().join("/")
        }else{
            parent = path
        }
        let is_dir = !!c.c
        return {
            "parent": parent,
            "name": c[0],
            "is_dir": is_dir,
            "size": is_dir? 0:c[1],
            "type": is_dir? 1:getFileType(c[0])
        }
    })
    return c
}

function getSearch(n){
    return new URL(location).searchParams.get(n) || "";
}


function generateUrl(path){
    // 将 /a/b/c?d 路径转为 ?path=/a/b/c&d 形式
    let x = path.indexOf("?")
    if(~x){
        return base4 + path.slice(0,x) + "&"+ path.slice(x+1);
    }else{
        return base4 + path;
    }
}

function hookXhref(r){
    // ?path=/a/b/c 获取 /a/b/c
    let path = (new URL(r).searchParams.get("path")||"").split("/").map(r=>encodeURIComponent(r)).join("/").replace("%40", "@")
    return path ? new URL(path,base1).href : r;
}

function gateway(path) {
    return base2 + path
}

history.replaceState1 = function(a,b,url){
    url = decodeURIComponent(url);
    let x = url.indexOf('?')  // aa.cn?a=1 => ?path=aa.cn&a=1
    if(~x){
        url = base3 + encodeURIComponent(getSearch("path")) + "&" + url.slice(x+1)
    }else{
        url = base3 + encodeURIComponent(url)
    }
    return history.replaceState(a,b,url)
}

// 搜查，路径，跳转，分页会使用到
history.pushState1 = function(a,b,url){
    // 将 ?from_search=1&a=1 转为 ?path=...&from_search=1&a=1
    url = decodeURIComponent(url);
    let x = url.indexOf('?')
    if(~x){ 
        url = base3 + encodeURIComponent(url.slice(0,x)) + "&" + url.slice(x+1)
    }else{
        url = base3 + encodeURIComponent(url)
    }
    return history.pushState(a,b,url)
}

Object.defineProperties(location,{
    pathname1:{
        get:function(){
            return getSearch("path").split("/").map(r=>encodeURIComponent(r)).join("/").replace("%40","@") || "/";
        },
        set:function(){
            alert("can't hook")
        }
    },
    search1:{
        get:function(){
            // 删除 location.search 中的 path 参数
            let url = new URL(location.href);
            url.searchParams.delete("path");
            return url.search;
        },
        set:function(){
            alert("can't hook")
        }
    }
})

function getFileType(n){
    // 未知 0、目录 1、视频 2、音乐 3、文本 4、图片 5 
    if(textReg.test(n)){
        return 4
    }else if(audioReg.test(n)){
        return 3
    }else if(videoReg.test(n)){
        return 2
    }else if(pngReg.test(n)){
        return 5
    }else{
        return 0
    }
}

function hookdownload(i,o,a){
    // i 是否进行 302 跳转，默认 200 无需考虑
    // o 是否文件直接链接
    // a 给定路径
    if(o){
        return gateway(a)
    }else{
        return generateUrl(a);
    }
}