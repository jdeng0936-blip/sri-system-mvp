import re

# 读取app.py
with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 统计
stats = {}

# 1. 函数数量
stats['functions'] = len(re.findall(r'^def\s+\w+', content, re.MULTILINE))

# 2. 类数量
stats['classes'] = len(re.findall(r'^class\s+\w+', content, re.MULTILINE))

# 3. import语句
stats['imports'] = len(re.findall(r'^import\s+|^from\s+', content, re.MULTILINE))

# 4. st.xxx调用
stats['streamlit_calls'] = len(re.findall(r'st\.\w+\(', content))

# 5. 注释行
stats['comments'] = len(re.findall(r'^\s*#', content, re.MULTILINE))

# 6. 文档字符串
stats['docstrings'] = len(re.findall(r'"""[\s\S]*?"""', content))

# 7. TODO/FIXME
stats['todos'] = len(re.findall(r'#\s*(TODO|FIXME)', content, re.IGNORECASE))

# 8. try-except块
stats['error_handling'] = len(re.findall(r'try:', content))

# 9. with语句
stats['with_statements'] = len(re.findall(r'^\s*with\s+', content, re.MULTILINE))

# 10. 字符串数量
stats['strings'] = len(re.findall(r'["\'].*?["\']', content))

# 输出
for key, value in stats.items():
    print(f"{key}: {value}")

# 代码行分类
lines = content.split('\n')
stats['total_lines'] = len(lines)
stats['blank_lines'] = sum(1 for line in lines if not line.strip())
stats['code_lines'] = stats['total_lines'] - stats['blank_lines'] - stats['comments']

print(f"\ntotal_lines: {stats['total_lines']}")
print(f"blank_lines: {stats['blank_lines']}")
print(f"code_lines: {stats['code_lines']}")
print(f"comment_lines: {stats['comments']}")
