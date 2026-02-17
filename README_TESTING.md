# 🧪 测试与优化指南

## 📋 快速开始

### 1️⃣ 在 Antigravity IDE 中运行测试

#### 方法 A：使用运行按钮
1. 在 Antigravity 中打开 `run_tests.py`
2. 点击右上角的 ▶️ 运行按钮
3. 查看终端输出的测试结果

#### 方法 B：使用集成终端
1. 按 `` Ctrl+` `` 打开终端
2. 运行命令：
```bash
python3 run_tests.py
```

#### 方法 C：通过 OpenClaw 助手
直接在聊天中说：
```
"运行项目测试"
"检查代码质量"
"运行 run_tests.py"
```

### 2️⃣ 代码质量检查

在终端运行：
```bash
python3 code_check.py
```

或通过 OpenClaw：
```
"检查销售AI情报系统的代码质量"
```

## 🤖 OpenClaw 集成功能

### 自动化测试
```
"为 database.py 编写单元测试"
"测试 llm_service 的所有函数"
"运行测试并显示覆盖率"
```

### 代码审查
```
"审查 app.py 的性能问题"
"检查代码中的安全漏洞"
"建议优化方案"
```

### 重构建议
```
"帮我重构 app.py（1933行太长）"
"拆分 app.py 为多个模块"
"提取配置到单独文件"
```

## 📊 测试覆盖率

生成详细的覆盖率报告：
```bash
python3 run_tests.py --coverage
```

然后打开 `htmlcov/index.html` 查看可视化报告

## 🎯 当前测试状态

### ✅ 已创建的测试文件
- `tests/test_database.py` - 数据库功能测试（需修复）
- `tests/test_llm_service.py` - LLM 服务测试（Mock 版本）

### 🚧 待完善
- [ ] 修复 database 测试的 API 兼容性
- [ ] 添加 app.py 的集成测试
- [ ] 添加端到端测试
- [ ] 提高测试覆盖率到 80%+

## 💡 优化建议

### 高优先级
1. **拆分 app.py**（1933行 → 建议拆成 4-5 个模块）
2. **添加日志系统**（便于调试和监控）
3. **添加配置文件**（避免硬编码）

### 中优先级
4. 添加错误处理机制
5. 实现数据备份功能
6. 添加性能监控

### 低优先级
7. 添加用户权限管理
8. 实现数据导出功能
9. 优化 UI 响应速度

## 🔧 故障排查

### 测试失败？
1. 确保虚拟环境已激活：`source .venv/bin/activate`
2. 确保依赖已安装：`pip install pytest pytest-cov`
3. 检查数据库文件权限

### OpenClaw 无法连接？
1. 确保 OpenClaw 插件已安装
2. 检查项目路径是否正确
3. 重启 Antigravity IDE

## 📞 获取帮助

直接在 Telegram 中向 OpenClaw 助手询问：
```
"测试失败了，帮我调试"
"如何提高测试覆盖率？"
"给我详细的代码审查"
```

---

✨ **提示**：OpenClaw 可以直接读取和修改你的代码，实时协助开发和测试！
