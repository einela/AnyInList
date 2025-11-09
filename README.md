# AnyInList： 无服务器，无后端，纯静态 OpenList 网页，对 10 万以上的文件进行特殊优化
- [x] 文件预览（PDF、markdown、代码、纯文本等）
- [x] 画廊模式下的图片预览
- [x] 视频和音频预览，支持歌词和字幕
- [x] Office 文档预览（docx、pptx、xlsx 等）
- [x] `README.md` 预览渲染
- [x] 文件永久链接复制和直接文件下载
- [x] 黑暗模式
- [x] 国际化
- [x] 文件/文件夹打包下载

# 部署方法
1. 将文件复制到项目目录下的 d 文件夹中；
2. 在终端下执行命令 python data.py 生成 data.json 数据文件
3. 启动本地 HTTP 服务
python -m http.server 5244
4. 打开浏览器，访问：
👉 http://127.0.0.1:5244

# 基于 IPFS 的部署方法
> 假设你的 CID 是 bafy123...
1. 运行 python cid.py bafy123... 生成 data.json 数据文件
2. 将整个目录添加到 IPFS
3. 在 IPFS 中 删除 d 文件夹
4. 导入 CID (bafy123...) 并命名为 d

# 许可证
- 随意使用，无需许可

## 备注
- 源码在位于 static/index.js 中
- 如果 data.json.zst 超过了 10 MiB，建议使用 sql.js-httpvfs 或者 summa
- fsGet fsList fsSearch fsDirs 均可以换成异步函数，但是 fsGet 和 fsList 需要格外处理
```
cancelID = 0
async function fsGet(path) {
    let id = cancelID;
    ...

    if(id !== cancelID) return Promise.reject("cancel")
}
async function fsList(path) {
    let id = ++cancelID;
    ...

    if(id !== cancelID) return Promise.reject("cancel")
}
```
- 对于 1 MiB 的 JSON 小文件使用 PPMd 有奇效