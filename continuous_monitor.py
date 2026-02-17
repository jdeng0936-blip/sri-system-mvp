#!/usr/bin/env python3
"""
持续代码监控系统
每10分钟输出一次更新报告
"""
import os
import time
import hashlib
import ast
import json
from datetime import datetime
from pathlib import Path

# 监控的核心文件
WATCH_FILES = [
    'app.py',
    'database.py',
    'llm_service.py',
    'config.py',
    'rag_qa_module.py',
    'utils/rag_engine.py',
    'support_ticket.py',  # 可能新建的文件
]

# 状态文件
STATE_FILE = '.monitor_state.json'

def get_file_hash(filepath):
    """获取文件MD5哈希"""
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()

def get_file_stats(filepath):
    """获取文件统计信息"""
    if not os.path.exists(filepath):
        return None
    
    stat = os.stat(filepath)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')
    
    return {
        'size': stat.st_size,
        'lines': len(lines),
        'mtime': stat.st_mtime,
        'hash': get_file_hash(filepath)
    }

def check_code_quality(filepath):
    """检查代码质量"""
    if not os.path.exists(filepath) or not filepath.endswith('.py'):
        return None
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 基础检查
        issues = []
        
        # 1. 语法检查
        try:
            ast.parse(content)
        except SyntaxError as e:
            issues.append(f"语法错误: 第{e.lineno}行")
        
        # 2. 简单质量检查
        lines = content.split('\n')
        
        # 过长的行
        long_lines = [i+1 for i, line in enumerate(lines) if len(line) > 120]
        if long_lines:
            issues.append(f"过长的行 (>120字符): {len(long_lines)}处")
        
        # TODO 注释
        todo_count = sum(1 for line in lines if 'TODO' in line or 'FIXME' in line)
        if todo_count > 0:
            issues.append(f"待办事项: {todo_count}处")
        
        # print 调试语句
        debug_prints = sum(1 for line in lines if line.strip().startswith('print('))
        if debug_prints > 5:
            issues.append(f"调试print语句过多: {debug_prints}处")
        
        return {
            'status': 'warning' if issues else 'ok',
            'issues': issues
        }
    
    except Exception as e:
        return {
            'status': 'error',
            'issues': [f"检查失败: {str(e)}"]
        }

def load_previous_state():
    """加载上次的状态"""
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_current_state(state):
    """保存当前状态"""
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)

def format_size(bytes):
    """格式化文件大小"""
    for unit in ['B', 'KB', 'MB']:
        if bytes < 1024.0:
            return f"{bytes:.1f} {unit}"
        bytes /= 1024.0
    return f"{bytes:.1f} GB"

def generate_report():
    """生成监控报告"""
    print("=" * 70)
    print(f"📊 代码监控报告 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    previous_state = load_previous_state()
    current_state = {}
    
    print("\n🔍 文件状态扫描:\n")
    
    total_lines = 0
    changed_files = []
    new_files = []
    quality_issues = []
    
    for filepath in WATCH_FILES:
        stats = get_file_stats(filepath)
        
        if stats is None:
            if filepath in previous_state:
                print(f"  ❌ {filepath}: 已删除")
            else:
                print(f"  ⚪ {filepath}: 不存在")
            continue
        
        current_state[filepath] = stats
        total_lines += stats['lines']
        
        # 检查变化
        prev = previous_state.get(filepath)
        if prev is None:
            # 新文件
            new_files.append(filepath)
            print(f"  ✨ {filepath}: 新创建")
            print(f"     大小: {format_size(stats['size'])} | 行数: {stats['lines']}")
        elif prev['hash'] != stats['hash']:
            # 文件已修改
            changed_files.append(filepath)
            lines_diff = stats['lines'] - prev['lines']
            size_diff = stats['size'] - prev['size']
            
            print(f"  📝 {filepath}: 已修改")
            print(f"     行数: {prev['lines']} → {stats['lines']} ({lines_diff:+d})")
            print(f"     大小: {format_size(prev['size'])} → {format_size(stats['size'])} ({size_diff:+d} B)")
        else:
            # 未修改
            print(f"  ✅ {filepath}: 无变化")
            print(f"     大小: {format_size(stats['size'])} | 行数: {stats['lines']}")
        
        # 代码质量检查
        if filepath.endswith('.py'):
            quality = check_code_quality(filepath)
            if quality and quality['status'] != 'ok':
                quality_issues.append({
                    'file': filepath,
                    'status': quality['status'],
                    'issues': quality['issues']
                })
    
    # 统计摘要
    print("\n" + "=" * 70)
    print("📈 统计摘要:")
    print("=" * 70)
    print(f"  总文件数: {len([f for f in WATCH_FILES if os.path.exists(f)])}")
    print(f"  总代码行: {total_lines:,}")
    print(f"  新增文件: {len(new_files)}")
    print(f"  修改文件: {len(changed_files)}")
    print(f"  质量问题: {len(quality_issues)}")
    
    # 变化详情
    if new_files or changed_files:
        print("\n" + "=" * 70)
        print("🔄 本次变化:")
        print("=" * 70)
        if new_files:
            print(f"\n  ✨ 新增文件 ({len(new_files)}):")
            for f in new_files:
                print(f"     - {f}")
        if changed_files:
            print(f"\n  📝 修改文件 ({len(changed_files)}):")
            for f in changed_files:
                print(f"     - {f}")
    
    # 质量问题
    if quality_issues:
        print("\n" + "=" * 70)
        print("⚠️  代码质量问题:")
        print("=" * 70)
        for issue in quality_issues:
            icon = "❌" if issue['status'] == 'error' else "⚠️"
            print(f"\n  {icon} {issue['file']}:")
            for i in issue['issues']:
                print(f"     - {i}")
    else:
        print("\n✅ 代码质量检查通过！")
    
    # 保存当前状态
    save_current_state(current_state)
    
    print("\n" + "=" * 70)
    print(f"⏰ 下次检查: 10分钟后")
    print("=" * 70)
    print()

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == '--loop':
        # 循环模式
        print("🔍 启动持续监控模式（每10分钟检查一次）")
        print("按 Ctrl+C 停止监控\n")
        
        try:
            while True:
                generate_report()
                time.sleep(600)  # 10分钟
        except KeyboardInterrupt:
            print("\n\n监控已停止")
    else:
        # 单次检查
        generate_report()
