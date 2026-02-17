#!/usr/bin/env python3
"""
代码质量检查工具
检查代码风格、复杂度、潜在问题
"""
import os
import subprocess

def check_code_style():
    """检查代码风格"""
    print("🎨 检查代码风格...")
    
    python_files = ['app.py', 'database.py', 'llm_service.py']
    
    for file in python_files:
        if os.path.exists(file):
            print(f"\n检查 {file}...")
            # 使用 flake8 检查（如果安装了）
            try:
                result = subprocess.run(
                    ['python', '-m', 'flake8', file, '--max-line-length=100'],
                    capture_output=True,
                    text=True
                )
                if result.stdout:
                    print(result.stdout)
                else:
                    print(f"  ✅ {file} 代码风格良好")
            except Exception:
                print(f"  ⚠️  flake8 未安装，跳过风格检查")
                break

def analyze_complexity():
    """分析代码复杂度"""
    print("\n📊 分析代码复杂度...")
    
    print("\n文件大小分析：")
    for file in ['app.py', 'database.py', 'llm_service.py']:
        if os.path.exists(file):
            lines = len(open(file).readlines())
            status = "⚠️" if lines > 500 else "✅"
            print(f"  {status} {file}: {lines} 行")
            
            if lines > 500:
                print(f"     建议：{file} 过大，考虑拆分模块")

def suggest_improvements():
    """给出改进建议"""
    print("\n💡 改进建议：")
    
    suggestions = [
        "1. app.py (1933行) 建议拆分为多个模块：",
        "   - ui_components.py (UI 组件)",
        "   - business_logic.py (业务逻辑)",
        "   - config.py (配置管理)",
        "",
        "2. 添加更多单元测试以提高覆盖率",
        "",
        "3. 考虑添加日志记录功能用于调试",
        "",
        "4. 添加错误处理和异常捕获",
        "",
        "5. 考虑添加配置文件替代硬编码配置",
    ]
    
    for suggestion in suggestions:
        print(suggestion)

if __name__ == "__main__":
    print("=" * 60)
    print("🔍 销售AI情报系统 - 代码质量检查")
    print("=" * 60)
    
    check_code_style()
    analyze_complexity()
    suggest_improvements()
    
    print("\n" + "=" * 60)
    print("✅ 检查完成")
    print("=" * 60)
