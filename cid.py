import sys, os, re, json, ctypes, requests, hashlib
from functools import cmp_to_key
from urllib.parse import quote
from pathlib import Path

# ========= 排序逻辑 =========
if os.name == "nt":
    _strcmp = ctypes.windll.shlwapi.StrCmpLogicalW
    _strcmp.argtypes, _strcmp.restype = [ctypes.c_wchar_p, ctypes.c_wchar_p], ctypes.c_int
    def _cmp_name(a, b):
        return _strcmp(str(a), str(b))
else:
    def _alphanum_key(s):
        return [int(x) if x.isdigit() else x.lower() for x in re.split(r'(\d+)', s)]
    def _cmp_name(a, b):
        ka, kb = _alphanum_key(a), _alphanum_key(b)
        return (ka > kb) - (ka < kb)

# ========= IPFS API =========
API = "http://127.0.0.1:5001/api/v0"
session = requests.Session()

def ipfs(endpoint, arg):
    r = session.post(f"{API}/{endpoint}?arg={quote(arg)}")
    r.raise_for_status()
    return r.json()

def check_cid(cid):
    try:
        res = ipfs("cid/format", cid)
        return not res.get("ErrorMsg", ""), res
    except Exception as e:
        return False, str(e)

# ========= 树构建 =========
def fetch_tree(cid, path="/", name=""):
    print(path)
    links = ipfs("ls", f"{cid}{path if path != '/' else ''}").get("Objects", [{}])[0].get("Links", [])
    children = []
    for e in links:
        if e["Type"] == 1:  # 文件夹
            children.append(fetch_tree(cid, f"{path.rstrip('/')}/{e['Name']}", e["Name"]))
        else:
            children.append([e["Name"], int(e["Size"])])
    # 目录优先 + 自然排序
    children.sort(key=cmp_to_key(lambda a, b:
        -1 if isinstance(a[-1], list) and not isinstance(b[-1], list)
        else 1 if not isinstance(a[-1], list) and isinstance(b[-1], list)
        else _cmp_name(a[0], b[0])
    ))
    return [name, children]


# ========= 压缩导出 =========
def export_zstd(tree, output_path):
    """将数据导出为 Zstandard 压缩的 JSON（.json.zst），返回 (压缩文件路径, json_bytes)。"""
    try:
        import zstandard as zstd
    except ImportError:
        print("错误：未检测到 zstandard 模块，请先安装： pip install zstandard")
        sys.exit(1)

    json_bytes = json.dumps(tree, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    size_mb = len(json_bytes) / (1024 ** 2)
    level = 22 if size_mb < 32 else 19

    compressed = zstd.ZstdCompressor(level=level).compress(json_bytes)
    output_path = output_path.with_suffix(output_path.suffix + ".zst")
    output_path.write_bytes(compressed)

    print(f"✅ 数据已压缩导出到 {output_path} （压缩等级 {level}，原始大小 {size_mb:.2f} MiB）")
    return json_bytes


# ========= hash 更新 =========
def update_hash_in_index(js_path: Path, json_bytes: bytes):
    """计算 JSON 数据 hash，并修改 index.js 中的 __HASH__ = ..."""
    if not js_path.exists():
        print(f"错误：文件 {js_path} 不存在，无法写入哈希")
        sys.exit(1)

    hash_value = hashlib.sha256(json_bytes).hexdigest()
    text = js_path.read_text(encoding="utf-8")
    new_text, count = re.subn(
        r"(__HASH__\s*=\s*)['\"]?[0-9a-fA-F]*['\"]?",
        rf"\1'{hash_value}'",
        text,
        count=1,
    )
    if count == 0:
        print(f"警告：未在 {js_path} 中找到 __HASH__ = ... 替换点")
    else:
        js_path.write_text(new_text, encoding="utf-8")
        print(f"✅ 已更新 {js_path} 中的哈希值为：{hash_value[:12]}...")


# ========= 主函数 =========
def main():
    if len(sys.argv) < 2:
        print("用法: python cid.py <CID>")
        sys.exit(1)

    cid = sys.argv[1]
    ok, info = check_cid(cid)
    if not ok:
        print(f"❌ CID 无效: {info}")
        sys.exit(1)

    print("✅ CID 格式有效，开始获取树")
    tree = fetch_tree(cid)
    tree[0] = ""

    Path("static").mkdir(exist_ok=True)
    output_path = Path("static/data.json")

    json_bytes = export_zstd(tree, output_path)

    # 更新 hash 至 index.js
    js_path = Path("static/index.js")
    update_hash_in_index(js_path, json_bytes)


if __name__ == "__main__":
    main()