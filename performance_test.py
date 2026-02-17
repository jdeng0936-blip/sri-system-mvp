#!/usr/bin/env python3
"""
性能测试脚本 - 测量关键操作的响应时间
"""
import time
import requests
from datetime import datetime

def test_streamlit_response():
    """测试Streamlit页面响应时间"""
    url = "http://localhost:8501"
    
    print("=" * 60)
    print("🚀 性能测试")
    print("=" * 60)
    print()
    
    # 测试1：页面加载时间
    print("1️⃣ 测试页面加载时间...")
    start = time.time()
    try:
        response = requests.get(url, timeout=10)
        load_time = time.time() - start
        print(f"   ✓ 页面加载: {load_time:.2f}秒")
        print(f"   状态码: {response.status_code}")
        if load_time < 2:
            print("   评级: ⭐⭐⭐⭐⭐ 优秀")
        elif load_time < 5:
            print("   评级: ⭐⭐⭐⭐ 良好")
        else:
            print("   评级: ⭐⭐⭐ 需改进")
    except Exception as e:
        print(f"   ✗ 失败: {e}")
    
    print()
    
    # 测试2：WebSocket连接（Streamlit使用）
    print("2️⃣ 测试WebSocket连接...")
    ws_url = url.replace('http', 'ws') + '/stream'
    print(f"   WebSocket地址: {ws_url}")
    print("   （需要手动测试实际交互响应时间）")
    
    print()
    print("=" * 60)
    print("📋 建议的性能基准")
    print("=" * 60)
    print()
    print("  页面加载:      <2秒  ⭐⭐⭐⭐⭐")
    print("  文档上传:      <5秒/MB")
    print("  语义搜索:      <500ms")
    print("  AI生成答案:    <10秒")
    print("  战术护目镜:    <3秒")
    print()

if __name__ == '__main__':
    test_streamlit_response()
