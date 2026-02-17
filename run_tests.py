#!/usr/bin/env python3
"""
测试运行器
一键运行所有测试并生成报告
"""
import subprocess
import sys
import os

def run_tests():
    """运行所有测试"""
    print("=" * 60)
    print("🧪 销售AI情报系统 - 测试套件")
    print("=" * 60)
    
    # 确保在虚拟环境中
    venv_python = os.path.join(os.path.dirname(__file__), '.venv', 'bin', 'python')
    
    if not os.path.exists(venv_python):
        print("❌ 错误：未找到虚拟环境")
        print("请先运行：python -m venv .venv && source .venv/bin/activate")
        return 1
    
    # 运行测试
    print("\n📋 运行单元测试...\n")
    result = subprocess.run(
        [venv_python, '-m', 'pytest', 'tests/', '-v', '--tb=short', '--color=yes'],
        cwd=os.path.dirname(__file__)
    )
    
    if result.returncode == 0:
        print("\n✅ 所有测试通过！")
    else:
        print("\n❌ 部分测试失败")
    
    return result.returncode

def run_with_coverage():
    """运行测试并生成覆盖率报告"""
    print("\n📊 生成测试覆盖率报告...\n")
    venv_python = os.path.join(os.path.dirname(__file__), '.venv', 'bin', 'python')
    
    subprocess.run([
        venv_python, '-m', 'pytest',
        'tests/',
        '--cov=.',
        '--cov-report=term',
        '--cov-report=html',
        '-v'
    ], cwd=os.path.dirname(__file__))
    
    print("\n📈 覆盖率报告已生成到 htmlcov/index.html")

if __name__ == "__main__":
    if '--coverage' in sys.argv:
        exit_code = run_with_coverage()
    else:
        exit_code = run_tests()
    
    sys.exit(exit_code)
