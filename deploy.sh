#!/bin/bash

# Helix 上线部署脚本
# 用法: ./deploy.sh [frontend|backend|all]

set -e

HELIX_DIR="/root/Helix"
FRONTEND_DIR="$HELIX_DIR/frontend"
BACKEND_DIR="$HELIX_DIR/backend"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 部署前端
deploy_frontend() {
    print_step "开始部署前端..."

    cd "$FRONTEND_DIR"

    # 安装依赖（如果需要）
    if [ "$1" == "--install" ]; then
        print_step "安装前端依赖..."
        npm install
    fi

    # 构建
    print_step "构建前端项目..."
    if npm run build; then
        print_success "前端构建成功"
    else
        print_error "前端构建失败"
        return 1
    fi

    # 复制到 web 目录
    print_step "复制文件到 /var/www/helix..."
    rm -rf /var/www/helix/*
    cp -r dist/* /var/www/helix/
    chown -R www-data:www-data /var/www/helix/
    print_success "文件复制成功"

    # 重载 nginx（如果配置有变化）
    print_step "重载 Nginx..."
    if nginx -t 2>/dev/null; then
        systemctl reload nginx
        print_success "Nginx 重载成功"
    else
        print_warning "Nginx 配置检查失败，跳过重载"
    fi

    print_success "前端部署完成"
}

# 部署后端
deploy_backend() {
    print_step "开始部署后端..."

    cd "$BACKEND_DIR"

    # 安装依赖（如果需要）
    if [ "$1" == "--install" ]; then
        print_step "安装后端依赖..."
        pip install -r requirements.txt -q
    fi

    # 重启服务
    print_step "重启 Helix 后端服务..."
    if systemctl restart helix.service; then
        sleep 2
        if systemctl is-active --quiet helix.service; then
            print_success "后端服务重启成功"
        else
            print_error "后端服务启动失败"
            systemctl status helix.service --no-pager
            return 1
        fi
    else
        print_error "后端服务重启失败"
        return 1
    fi

    print_success "后端部署完成"
}

# 显示状态
show_status() {
    echo ""
    echo -e "${BLUE}=== 服务状态 ===${NC}"
    echo ""

    echo -n "后端服务 (helix.service): "
    if systemctl is-active --quiet helix.service; then
        echo -e "${GREEN}运行中${NC}"
    else
        echo -e "${RED}已停止${NC}"
    fi

    echo -n "Nginx 服务: "
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}运行中${NC}"
    else
        echo -e "${RED}已停止${NC}"
    fi

    echo ""
    echo -e "${BLUE}=== 版本信息 ===${NC}"
    if [ -f "$FRONTEND_DIR/package.json" ]; then
        VERSION=$(grep '"version"' "$FRONTEND_DIR/package.json" | head -1 | cut -d'"' -f4)
        echo "前端版本: $VERSION"
    fi

    echo ""
}

# 主逻辑
case "${1:-all}" in
    frontend|f)
        deploy_frontend "$2"
        show_status
        ;;
    backend|b)
        deploy_backend "$2"
        show_status
        ;;
    all|a)
        deploy_frontend "$2"
        echo ""
        deploy_backend "$2"
        show_status
        ;;
    status|s)
        show_status
        ;;
    *)
        echo "Helix 部署脚本"
        echo ""
        echo "用法: $0 [命令] [选项]"
        echo ""
        echo "命令:"
        echo "  frontend, f    只部署前端"
        echo "  backend, b     只部署后端"
        echo "  all, a         部署前端和后端 (默认)"
        echo "  status, s      查看服务状态"
        echo ""
        echo "选项:"
        echo "  --install      同时安装依赖"
        echo ""
        echo "示例:"
        echo "  $0              # 部署全部"
        echo "  $0 frontend     # 只部署前端"
        echo "  $0 backend      # 只部署后端"
        echo "  $0 all --install # 部署全部并安装依赖"
        exit 1
        ;;
esac
