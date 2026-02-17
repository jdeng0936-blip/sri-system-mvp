#!/bin/bash
# 启动持续监控系统

cd ~/Desktop/销售AI情报系统

echo "🔍 启动代码监控系统..."
echo "监控间隔: 10分钟"
echo "按 Ctrl+C 停止"
echo ""

# 启动循环监控
python3 continuous_monitor.py --loop
