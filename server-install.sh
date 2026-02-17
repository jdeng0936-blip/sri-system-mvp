#!/bin/bash
# 销售AI系统 - 服务器端一键安装脚本
# 在服务器上执行此脚本（项目文件需手动上传到/opt/sales-ai/）

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

clear
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        销售AI情报系统 - 服务器端一键安装              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# 检查是否root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}请使用root权限运行此脚本${NC}"
    echo "用法：sudo bash server-install.sh"
    exit 1
fi

# 检测系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VERSION=$VERSION_ID
else
    echo -e "${RED}无法识别系统${NC}"
    exit 1
fi

echo -e "${BLUE}检测到系统：${NC}$OS $VERSION"
echo ""

# 确认继续
read -p "是否继续安装？(y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# 1. 更新系统
echo ""
echo -e "${YELLOW}[1/10] 更新系统...${NC}"
if [[ $OS == *"Ubuntu"* ]] || [[ $OS == *"Debian"* ]]; then
    apt update > /dev/null && apt upgrade -y > /dev/null
    echo -e "${GREEN}✓ 系统更新完成${NC}"
elif [[ $OS == *"CentOS"* ]] || [[ $OS == *"Red Hat"* ]]; then
    yum update -y > /dev/null
    echo -e "${GREEN}✓ 系统更新完成${NC}"
fi

# 2. 安装基础软件
echo ""
echo -e "${YELLOW}[2/10] 安装基础软件...${NC}"
if [[ $OS == *"Ubuntu"* ]] || [[ $OS == *"Debian"* ]]; then
    apt install -y python3 python3-venv python3-pip git wget curl htop > /dev/null
elif [[ $OS == *"CentOS"* ]] || [[ $OS == *"Red Hat"* ]]; then
    yum install -y python3 python3-pip git wget curl htop > /dev/null
fi
echo -e "${GREEN}✓ 基础软件安装完成${NC}"

# 3. 检查项目目录
echo ""
echo -e "${YELLOW}[3/10] 检查项目目录...${NC}"
if [ ! -d "/opt/sales-ai" ]; then
    echo -e "${BLUE}项目目录不存在，请选择操作：${NC}"
    echo "  1) 我稍后手动上传文件到 /opt/sales-ai/"
    echo "  2) 我有Git仓库，输入URL克隆"
    echo "  3) 创建空目录，我现在上传"
    read -p "选择 (1-3): " choice
    
    case $choice in
        1)
            mkdir -p /opt/sales-ai
            echo -e "${YELLOW}已创建目录 /opt/sales-ai/${NC}"
            echo -e "${YELLOW}请上传项目文件后重新运行此脚本${NC}"
            exit 0
            ;;
        2)
            read -p "输入Git仓库URL: " git_url
            cd /opt
            git clone $git_url sales-ai
            echo -e "${GREEN}✓ 代码克隆完成${NC}"
            ;;
        3)
            mkdir -p /opt/sales-ai
            echo -e "${BLUE}目录已创建：/opt/sales-ai/${NC}"
            echo -e "${BLUE}请使用scp上传文件：${NC}"
            echo "  scp -r ~/Desktop/销售AI情报系统/* root@$(hostname -I | awk '{print $1}'):/opt/sales-ai/"
            read -p "上传完成后按Enter继续..."
            ;;
    esac
fi

# 验证必要文件
if [ ! -f "/opt/sales-ai/app.py" ]; then
    echo -e "${RED}✗ 未找到app.py文件${NC}"
    echo "请确保项目文件已上传到 /opt/sales-ai/"
    exit 1
fi
echo -e "${GREEN}✓ 项目文件检查完成${NC}"

# 4. 创建虚拟环境
echo ""
echo -e "${YELLOW}[4/10] 创建Python虚拟环境...${NC}"
cd /opt/sales-ai
if [ -d "venv" ]; then
    rm -rf venv
fi
python3 -m venv venv
echo -e "${GREEN}✓ 虚拟环境创建完成${NC}"

# 5. 安装依赖
echo ""
echo -e "${YELLOW}[5/10] 安装Python依赖（可能需要几分钟）...${NC}"
source venv/bin/activate
pip install --upgrade pip > /dev/null 2>&1

if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt > /dev/null 2>&1
    echo -e "${GREEN}✓ 依赖安装完成${NC}"
else
    echo -e "${YELLOW}未找到requirements.txt，安装常用依赖...${NC}"
    pip install streamlit openai chromadb sentence-transformers pandas numpy plotly > /dev/null 2>&1
    echo -e "${GREEN}✓ 常用依赖安装完成${NC}"
fi

# 6. 创建数据目录
echo ""
echo -e "${YELLOW}[6/10] 创建数据目录...${NC}"
mkdir -p /opt/sales-ai/data
mkdir -p /opt/sales-ai/logs
echo -e "${GREEN}✓ 数据目录创建完成${NC}"

# 7. 配置systemd服务
echo ""
echo -e "${YELLOW}[7/10] 配置系统服务...${NC}"
cat > /etc/systemd/system/sales-ai.service << 'EOF'
[Unit]
Description=Sales AI Intelligence System
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/sales-ai
Environment="PATH=/opt/sales-ai/venv/bin"
ExecStart=/opt/sales-ai/venv/bin/streamlit run app.py --server.address=0.0.0.0 --server.port=8501 --server.headless=true
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
echo -e "${GREEN}✓ 系统服务配置完成${NC}"

# 8. 配置防火墙
echo ""
echo -e "${YELLOW}[8/10] 配置防火墙...${NC}"
if command -v ufw > /dev/null; then
    ufw allow 8501/tcp > /dev/null 2>&1
    ufw allow 80/tcp > /dev/null 2>&1
    ufw allow 443/tcp > /dev/null 2>&1
    echo -e "${GREEN}✓ ufw防火墙配置完成${NC}"
elif command -v firewall-cmd > /dev/null; then
    firewall-cmd --permanent --add-port=8501/tcp > /dev/null 2>&1
    firewall-cmd --permanent --add-port=80/tcp > /dev/null 2>&1
    firewall-cmd --permanent --add-port=443/tcp > /dev/null 2>&1
    firewall-cmd --reload > /dev/null 2>&1
    echo -e "${GREEN}✓ firewalld防火墙配置完成${NC}"
else
    echo -e "${YELLOW}未检测到防火墙，跳过${NC}"
fi

# 9. 启动服务
echo ""
echo -e "${YELLOW}[9/10] 启动服务...${NC}"
systemctl enable sales-ai > /dev/null 2>&1
systemctl start sales-ai

# 等待服务启动
echo -e "${BLUE}等待服务启动...${NC}"
sleep 5

# 10. 验证安装
echo ""
echo -e "${YELLOW}[10/10] 验证安装...${NC}"

SERVICE_STATUS=$(systemctl is-active sales-ai)
if [ "$SERVICE_STATUS" = "active" ]; then
    echo -e "${GREEN}✓ 服务运行正常${NC}"
    
    # 测试端口
    if netstat -tulpn | grep -q ":8501"; then
        echo -e "${GREEN}✓ 端口8501监听正常${NC}"
    else
        echo -e "${RED}✗ 端口8501未监听${NC}"
    fi
else
    echo -e "${RED}✗ 服务启动失败${NC}"
    echo "查看日志："
    journalctl -u sales-ai -n 20 --no-pager
    exit 1
fi

# 获取服务器IP
SERVER_IP=$(hostname -I | awk '{print $1}')

# 完成
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    安装完成！                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}访问地址：${NC}"
echo "  http://$SERVER_IP:8501"
echo ""
echo -e "${BLUE}管理命令：${NC}"
echo "  systemctl status sales-ai    # 查看状态"
echo "  systemctl start sales-ai     # 启动服务"
echo "  systemctl stop sales-ai      # 停止服务"
echo "  systemctl restart sales-ai   # 重启服务"
echo "  journalctl -u sales-ai -f    # 查看日志"
echo ""
echo -e "${BLUE}下一步建议：${NC}"
echo "  1. 配置域名和Nginx反向代理"
echo "  2. 配置HTTPS证书（Let's Encrypt）"
echo "  3. 添加应用层访问密码"
echo "  4. 设置定时备份"
echo ""
echo -e "${YELLOW}详细文档：查看 自有服务器部署指南.md${NC}"
echo ""
