#!/bin/bash

# Helix 服务管理脚本

case "$1" in
    start)
        echo "🚀 启动 Helix 服务..."
        systemctl start helix.service
        echo "✅ 服务已启动"
        ;;
    stop)
        echo "🛑 停止 Helix 服务..."
        systemctl stop helix.service
        echo "✅ 服务已停止"
        ;;
    restart)
        echo "🔄 重启 Helix 服务..."
        systemctl restart helix.service
        echo "✅ 服务已重启"
        ;;
    status)
        echo "📊 Helix 服务状态:"
        systemctl status helix.service
        ;;
    logs)
        echo "📋 Helix 服务日志:"
        journalctl -u helix.service -f
        ;;
    *)
        echo "❓ 使用方法: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "  start   - 启动服务"
        echo "  stop    - 停止服务"
        echo "  restart - 重启服务"
        echo "  status  - 查看服务状态"
        echo "  logs    - 查看服务日志"
        exit 1
        ;;
esac