#!/usr/bin/env python3
"""
文件变化监控脚本
实时监控 Antigravity 的修改进度
"""
import os
import time
import hashlib
from datetime import datetime

# 监控的文件
WATCH_FILES = [
    'app.py',
    'rag_qa_module.py',
]

def get_file_hash(filepath):
    """获取文件MD5哈希"""
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()

def get_file_info(filepath):
    """获取文件详细信息"""
    if not os.path.exists(filepath):
        return None
    
    stat = os.stat(filepath)
    with open(filepath, 'r') as f:
        lines = len(f.readlines())
    
    return {
        'size': stat.st_size,
        'lines': lines,
        'mtime': stat.st_mtime,
        'hash': get_file_hash(filepath)
    }

def format_time(timestamp):
    """格式化时间"""
    return datetime.fromtimestamp(timestamp).strftime('%H:%M:%S')

# 初始状态
print("=" * 60)
print("🔍 文件监控系统已启动")
print("=" * 60)
print(f"\n监控时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("\n监控文件:")

initial_state = {}
for filepath in WATCH_FILES:
    info = get_file_info(filepath)
    if info:
        initial_state[filepath] = info
        print(f"  {filepath}: {info['lines']} 行, {info['size']/1024:.1f} KB")
    else:
        print(f"  {filepath}: 不存在")
        initial_state[filepath] = None

print("\n等待文件变化...")
print("按 Ctrl+C 停止监控")
print("-" * 60)

# 监控循环
try:
    while True:
        time.sleep(2)  # 每2秒检查一次
        
        for filepath in WATCH_FILES:
            current_info = get_file_info(filepath)
            previous_info = initial_state.get(filepath)
            
            # 检测变化
            if previous_info is None and current_info:
                # 新文件创建
                print(f"\n[{format_time(time.time())}] ✨ 新文件创建: {filepath}")
                print(f"  大小: {current_info['size']/1024:.1f} KB")
                print(f"  行数: {current_info['lines']}")
                initial_state[filepath] = current_info
                
            elif previous_info and current_info:
                if previous_info['hash'] != current_info['hash']:
                    # 文件已修改
                    lines_diff = current_info['lines'] - previous_info['lines']
                    size_diff = (current_info['size'] - previous_info['size']) / 1024
                    
                    print(f"\n[{format_time(time.time())}] 📝 文件已修改: {filepath}")
                    print(f"  行数: {previous_info['lines']} → {current_info['lines']} ({lines_diff:+d})")
                    print(f"  大小: {previous_info['size']/1024:.1f} → {current_info['size']/1024:.1f} KB ({size_diff:+.1f} KB)")
                    
                    initial_state[filepath] = current_info

except KeyboardInterrupt:
    print("\n\n监控已停止")
    print("=" * 60)
