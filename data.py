import os, re, json, ctypes, sys, hashlib
from pathlib import Path
from functools import cmp_to_key

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

# ========= 树构建 =========

def safe_stat(path):
    try:
        return os.stat(path, follow_symlinks=False)
    except Exception:
        return None


def scan_tree(path):
    """扫描目录并返回 [name, size或children, mtime]"""
    if os.path.islink(path):
        return None

    st = safe_stat(path)
    if not st:
        return None

    name = Path(path).name
    if os.path.isdir(path):
        try:
            entries = os.listdir(path)
        except OSError:
            return [name, [], int(st.st_mtime)]

        def cmp_entry(a, b):
            a_path, b_path = os.path.join(path, a), os.path.join(path, b)
            a_isdir, b_isdir = os.path.isdir(a_path), os.path.isdir(b_path)
            if a_isdir and not b_isdir:
                return -1
            elif b_isdir and not a_isdir:
                return 1
            return _cmp_name(a, b)

        children = filter(None, (
            scan_tree(os.path.join(path, e))
            for e in sorted(entries, key=cmp_to_key(cmp_entry))
        ))
        return [name, list(children), int(st.st_mtime)]
    else:
        return [name, st.st_size, int(st.st_mtime)]


# ========= 导出与压缩 =========

def export_data(tree, output_path):
    """
    将数据导出为 Zstandard 压缩的 JSON（.json.zst）
    返回：(压缩文件路径, 原始 JSON 字节)
    """
    try:
        import zstandard as zstd
    except ImportError:
        print("错误：未检测到 zstandard 模块，请先安装： pip install zstandard")
        sys.exit(1)

    json_bytes = json.dumps(tree, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    size_mb = len(json_bytes) / (1024 ** 2)

    level = 22 if size_mb < 32 else 19
    cctx = zstd.ZstdCompressor(level=level)
    compressed = cctx.compress(json_bytes)

    output_path = output_path.with_suffix(output_path.suffix + ".zst")
    with open(output_path, "wb") as f:
        f.write(compressed)

    print(f"数据已压缩导出到 {output_path} （压缩等级 {level}，原始大小 {size_mb:.2f} MiB）")
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
        print(f"已更新 {js_path} 中的哈希值为：{hash_value[:12]}...")


# ========= 主函数 =========

def main():
    root = "d"
    if not os.path.exists(root):
        print(f"错误：目录 '{root}' 不存在")
        return

    print("正在扫描目录，请稍候...")
    tree = scan_tree(root)
    if tree:
        tree[0] = ""  # 根名置空

    Path("static").mkdir(exist_ok=True)
    output_path = Path("static/data.json")

    json_bytes = export_data(tree, output_path)

    js_path = Path("static/index.js")
    update_hash_in_index(js_path, json_bytes)


if __name__ == "__main__":
    main()