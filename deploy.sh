#!/bin/bash
# 销售AI系统 - 快速部署脚本
# 用法：./deploy.sh your_server_ip

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================="
echo "销售AI情报系统 - 快速部署"
echo "=================================="
echo ""

# 检查参数
if [ $# -eq 0 ]; then
    echo -e "${RED}错误：请提供服务器IP地址${NC}"
    echo "用法：./deploy.sh your_server_ip"
    exit 1
fi

SERVER_IP=$1
SERVER_USER=${2:-root}  # 默认用户root
SERVER_PORT=${3:-22}    # 默认端口22

echo -e "${GREEN}目标服务器：${NC}$SERVER_USER@$SERVER_IP:$SERVER_PORT"
echo ""

# 1. 测试SSH连接
echo -e "${YELLOW}[1/6] 测试SSH连接...${NC}"
if ssh -p $SERVER_PORT -o ConnectTimeout=5 $SERVER_USER@$SERVER_IP "echo '连接成功'" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ SSH连接正常${NC}"
else
    echo -e "${RED}✗ SSH连接失败，请检查：${NC}"
    echo "  1. IP地址是否正确"
    echo "  2. SSH密钥是否配置"
    echo "  3. 服务器是否在线"
    exit 1
fi

# 2. 打包项目
echo ""
echo -e "${YELLOW}[2/6] 打包项目文件...${NC}"
cd ~/Desktop
if [ -d "销售AI情报系统" ]; then
    tar -czf sales-ai-deploy.tar.gz 销售AI情报系统/ --exclude='销售AI情报系统/__pycache__' --exclude='销售AI情报系统/.git'
    echo -e "${GREEN}✓ 打包完成${NC}"
else
    echo -e "${RED}✗ 项目目录不存在${NC}"
    exit 1
fi

# 3. 上传到服务器
echo ""
echo -e "${YELLOW}[3/6] 上传到服务器...${NC}"
scp -P $SERVER_PORT sales-ai-deploy.tar.gz $SERVER_USER@$SERVER_IP:/tmp/
echo -e "${GREEN}✓ 上传完成${NC}"

# 4. 远程部署
echo ""
echo -e "${YELLOW}[4/6] 执行远程部署...${NC}"
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP << 'ENDSSH'
set -e

echo "  → 解压文件..."
cd /opt
rm -rf sales-ai
tar -xzf /tmp/sales-ai-deploy.tar.gz
mv 销售AI情报系统 sales-ai
rm /tmp/sales-ai-deploy.tar.gz

echo "  → 创建虚拟环境..."
cd /opt/sales-ai
python3 -m venv venv
source venv/bin/activate

echo "  → 安装依赖..."
pip install --upgrade pip > /dev/null
pip install -r requirements.txt > /dev/null

echo "  → 配置系统服务..."
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

[Install]
WantedBy=multi-user.target
EOF

echo "  → 配置防火墙..."
if command -v ufw > /dev/null; then
    ufw allow 8501/tcp > /dev/null 2>&1 || true
fi

echo "  → 启动服务..."
systemctl daemon-reload
systemctl enable sales-ai
systemctl restart sales-ai

echo "  → 等待服务启动..."
sleep 5

ENDSSH

echo -e "${GREEN}✓ 远程部署完成${NC}"

# 5. 检查服务状态
echo ""
echo -e "${YELLOW}[5/6] 检查服务状态...${NC}"
SERVICE_STATUS=$(ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP "systemctl is-active sales-ai")
if [ "$SERVICE_STATUS" = "active" ]; then
    echo -e "${GREEN}✓ 服务运行正常${NC}"
else
    echo -e "${RED}✗ 服务未启动，查看日志：${NC}"
    ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP "journalctl -u sales-ai -n 20 --no-pager"
    exit 1
fi

# 6. 完成
echo ""
echo -e "${YELLOW}[6/6] 清理临时文件...${NC}"
rm ~/Desktop/sales-ai-deploy.tar.gz
echo -e "${GREEN}✓ 清理完成${NC}"

echo ""
echo "=================================="
echo -e "${GREEN}部署成功！${NC}"
echo "=================================="
echo ""
echo "访问地址："
echo "  http://$SERVER_IP:8501"
echo ""
echo "管理命令（SSH到服务器后）："
echo "  systemctl status sales-ai   # 查看状态"
echo "  systemctl restart sales-ai  # 重启服务"
echo "  journalctl -u sales-ai -f   # 查看日志"
echo ""
echo "下一步："
echo "  1. 配置域名（可选）"
echo "  2. 配置HTTPS（推荐）"
echo "  3. 添加访问密码（推荐）"
echo ""
