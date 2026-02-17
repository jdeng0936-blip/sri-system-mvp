#!/usr/bin/env python3
"""
深度功能监控（从Antigravity学习）
不仅检查语法，还要验证功能实现
"""
import os
import re

def check_streaming_enabled():
    """检查流式生成是否启用"""
    with open('app.py', 'r') as f:
        content = f.read()
    
    has_stream_func = 'generate_rag_answer_stream' in content
    is_called = 'st.write_stream(' in content or 'write_stream(' in content
    
    return {
        'implemented': has_stream_func,
        'enabled': is_called,
        'status': '✅' if is_called else '⚠️',
        'issue': None if is_called else '流式函数已实现但未被调用'
    }

def check_chat_history():
    """检查聊天历史持久化"""
    with open('app.py', 'r') as f:
        content = f.read()
    
    has_messages = 'st.session_state.messages' in content or 'session_state.messages' in content
    has_append = '.messages.append(' in content
    has_display = 'for msg in' in content and 'messages' in content
    
    return {
        'has_storage': has_messages,
        'has_append': has_append,
        'has_display': has_display,
        'status': '✅' if (has_messages and has_append and has_display) else '❌',
        'issue': None if (has_messages and has_append) else '缺少消息列表或追加机制'
    }

def check_tactical_goggle():
    """检查战术护目镜是否硬编码"""
    with open('app.py', 'r') as f:
        content = f.read()
    
    # 查找战术护目镜部分
    goggle_match = re.search(r'战术护目镜.*?st\.warning\((.*?)\)', content, re.DOTALL)
    
    if goggle_match:
        warning_content = goggle_match.group(1)
        # 检查是否包含硬编码的【镇海炼化】
        is_hardcoded = '镇海炼化' in warning_content or '"' in warning_content[:50]
        has_function_call = 'generate_' in warning_content or 'tactical' in warning_content
        
        return {
            'exists': True,
            'hardcoded': is_hardcoded,
            'has_ai': has_function_call,
            'status': '❌' if is_hardcoded else '✅',
            'issue': '完全硬编码，永远显示【镇海炼化】' if is_hardcoded else None
        }
    
    return {'exists': False, 'status': '❌', 'issue': '战术护目镜不存在'}

def check_fire_call_button():
    """检查炮火呼叫按钮是否真实"""
    with open('app.py', 'r') as f:
        content = f.read()
    
    # 查找呼叫按钮
    button_match = re.search(r'呼叫后方技术群.*?if st\.button.*?\n(.*?)\n', content, re.DOTALL)
    
    if button_match:
        button_code = button_match.group(1)
        is_fake = 'st.success' in button_code and '已将现场' in button_code
        has_real_func = 'generate_support_ticket' in button_code or 'save_ticket' in button_code
        
        return {
            'exists': True,
            'is_fake': is_fake,
            'has_real_logic': has_real_func,
            'status': '✅' if has_real_func else '❌',
            'issue': '只有假提示，无真实工单生成' if is_fake and not has_real_func else None
        }
    
    return {'exists': False, 'status': '❌', 'issue': '呼叫按钮不存在'}

def check_support_ticket_module():
    """检查工单模块是否存在"""
    exists = os.path.exists('support_ticket.py')
    
    if exists:
        with open('support_ticket.py', 'r') as f:
            content = f.read()
        has_generate = 'generate_support_ticket' in content
        has_save = 'save_ticket' in content
        
        return {
            'exists': True,
            'functional': has_generate and has_save,
            'status': '✅' if (has_generate and has_save) else '⚠️'
        }
    
    return {
        'exists': False,
        'status': '❌',
        'issue': 'support_ticket.py 模块缺失'
    }

def generate_deep_report():
    """生成深度功能检查报告"""
    print("=" * 70)
    print("🔍 深度功能验证报告")
    print("=" * 70)
    print()
    
    # 1. 流式输出
    streaming = check_streaming_enabled()
    print("1️⃣ 流式输出")
    print(f"   状态: {streaming['status']}")
    print(f"   已实现: {'✅' if streaming['implemented'] else '❌'}")
    print(f"   已启用: {'✅' if streaming['enabled'] else '❌'}")
    if streaming['issue']:
        print(f"   问题: {streaming['issue']}")
    print()
    
    # 2. 聊天历史
    history = check_chat_history()
    print("2️⃣ 聊天历史持久化")
    print(f"   状态: {history['status']}")
    print(f"   消息存储: {'✅' if history['has_storage'] else '❌'}")
    print(f"   追加机制: {'✅' if history['has_append'] else '❌'}")
    print(f"   历史显示: {'✅' if history['has_display'] else '❌'}")
    if history['issue']:
        print(f"   问题: {history['issue']}")
    print()
    
    # 3. 战术护目镜
    goggle = check_tactical_goggle()
    print("3️⃣ 战术护目镜")
    print(f"   状态: {goggle['status']}")
    print(f"   存在: {'✅' if goggle['exists'] else '❌'}")
    if goggle.get('hardcoded') is not None:
        print(f"   硬编码: {'❌ 是' if goggle['hardcoded'] else '✅ 否'}")
        print(f"   AI生成: {'✅' if goggle['has_ai'] else '❌'}")
    if goggle.get('issue'):
        print(f"   问题: {goggle['issue']}")
    print()
    
    # 4. 炮火呼叫
    fire_call = check_fire_call_button()
    print("4️⃣ 炮火呼叫按钮")
    print(f"   状态: {fire_call['status']}")
    print(f"   存在: {'✅' if fire_call['exists'] else '❌'}")
    if fire_call.get('is_fake') is not None:
        print(f"   假功能: {'❌ 是' if fire_call['is_fake'] else '✅ 否'}")
        print(f"   真实逻辑: {'✅' if fire_call['has_real_logic'] else '❌'}")
    if fire_call.get('issue'):
        print(f"   问题: {fire_call['issue']}")
    print()
    
    # 5. 工单模块
    ticket = check_support_ticket_module()
    print("5️⃣ 工单模块")
    print(f"   状态: {ticket['status']}")
    print(f"   文件存在: {'✅' if ticket['exists'] else '❌'}")
    if ticket.get('functional') is not None:
        print(f"   功能完整: {'✅' if ticket['functional'] else '❌'}")
    if ticket.get('issue'):
        print(f"   问题: {ticket['issue']}")
    print()
    
    # 总结
    print("=" * 70)
    print("📊 功能完整度")
    print("=" * 70)
    
    total_issues = sum([
        1 if streaming['issue'] else 0,
        1 if history['issue'] else 0,
        1 if goggle.get('issue') else 0,
        1 if fire_call.get('issue') else 0,
        1 if ticket.get('issue') else 0
    ])
    
    print(f"发现问题: {total_issues} 个")
    
    if total_issues == 0:
        print("✅ 所有功能验证通过！")
    else:
        print("\n⚠️ 需要修复的功能:")
        if streaming['issue']:
            print(f"  • 流式输出: {streaming['issue']}")
        if history['issue']:
            print(f"  • 聊天历史: {history['issue']}")
        if goggle.get('issue'):
            print(f"  • 战术护目镜: {goggle['issue']}")
        if fire_call.get('issue'):
            print(f"  • 炮火呼叫: {fire_call['issue']}")
        if ticket.get('issue'):
            print(f"  • 工单模块: {ticket['issue']}")
    
    print("=" * 70)

if __name__ == '__main__':
    generate_deep_report()
