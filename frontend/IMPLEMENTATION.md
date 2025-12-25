# Helix 前端重构实现方案

## 一、设计理念

### 1.1 参考风格
- **导航**: 类似 Discord/QQ 的垂直图标侧边栏（深色，简洁图标）
- **内容区**: 类似"循踪觅意"网站的暖色调、卡片式布局
- **整体**: 简洁、现代、专注内容

### 1.2 色彩方案
```
主色调:
- 侧边栏背景: #1e1f22 (深灰)
- 内容背景: #f8f5f2 (暖白)
- 强调色: #c4a574 (暖金)
- 文字主色: #2d2d2d
- 文字次色: #8b8b8b

功能色:
- 资产: #52c41a (绿)
- 聊天: #1890ff (蓝)
- 相册: #ff4d4f (红)
- 日历: #722ed1 (紫)
- 德扑: #faad14 (金)
```

## 二、目录结构

```
frontend/src/
├── main.tsx                 # 入口文件
├── App.tsx                  # 根组件
├── index.css                # 全局样式
├── vite-env.d.ts
│
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx     # 主布局壳（侧边栏+内容区）
│   │   ├── Sidebar.tsx      # 左侧图标导航栏
│   │   ├── TitleBar.tsx     # Tauri 自定义标题栏
│   │   └── ContentArea.tsx  # 右侧内容区容器
│   │
│   ├── common/
│   │   ├── Card.tsx         # 通用卡片组件
│   │   ├── Button.tsx       # 按钮组件
│   │   ├── Modal.tsx        # 弹窗组件
│   │   ├── Avatar.tsx       # 头像组件
│   │   └── Loading.tsx      # 加载状态
│   │
│   └── features/
│       ├── assets/          # 资产相关组件
│       ├── chat/            # 聊天相关组件
│       ├── photos/          # 相册相关组件
│       ├── calendar/        # 日历相关组件
│       └── poker/           # 德扑相关组件
│
├── pages/
│   ├── Login.tsx            # 登录页
│   ├── Dashboard.tsx        # 首页/概览
│   ├── Assets.tsx           # 资产管理
│   ├── Chat.tsx             # 聊天
│   ├── Photos.tsx           # 照片墙
│   ├── Calendar.tsx         # 日程表
│   ├── Poker.tsx            # 德扑大厅
│   ├── PokerTable.tsx       # 德扑牌桌
│   └── Settings.tsx         # 设置页
│
├── hooks/
│   ├── useTauri.ts          # Tauri API hooks
│   └── useApi.ts            # API 请求 hooks
│
├── services/
│   └── api.ts               # API 服务层
│
├── stores/
│   ├── authStore.ts         # 认证状态
│   └── uiStore.ts           # UI 状态
│
└── types/
    └── index.ts             # TypeScript 类型定义
```

## 三、核心布局设计

### 3.1 主布局 (AppShell)

```
+------------------------------------------+
|  TitleBar (仅 Tauri，32px)               |
+------+-----------------------------------+
|      |                                   |
| Side |        ContentArea                |
| bar  |                                   |
| 64px |        (页面内容)                  |
|      |                                   |
|      |                                   |
+------+-----------------------------------+
```

### 3.2 Sidebar 设计

```
+--------+
|  Logo  |   <- 应用图标
+--------+
|   首   |   <- 首页 (概览)
+--------+
|   资   |   <- 资产管理
+--------+
|   聊   |   <- 聊天
+--------+
|   相   |   <- 相册
+--------+
|   日   |   <- 日历
+--------+
|   扑   |   <- 德扑
+--------+
|        |
| (空白) |
|        |
+--------+
|  头像  |   <- 用户菜单
+--------+
```

特点:
- 宽度: 64px
- 背景: 深色 (#1e1f22)
- 图标: 白色/灰色，hover 时显示彩色
- 当前页面: 左侧有指示条 + 图标高亮

### 3.3 内容区设计

- 背景: 暖白色 (#f8f5f2)
- 左上角圆角 (与侧边栏衔接)
- 内部使用卡片布局
- 卡片: 白色背景、轻微阴影、圆角

## 四、功能页面规划

### 4.1 登录页 (Login)
- 全屏渐变背景
- 中央登录卡片
- 用户名/密码输入
- 记住登录状态

### 4.2 首页/概览 (Dashboard)
- 欢迎信息卡片
- 统计卡片 (总资产、今日日程、照片数)
- 今日日程列表
- 最近照片预览
- 快捷入口

### 4.3 资产管理 (Assets)
- 总资产统计卡片
- 分类饼图
- 趋势折线图
- 资产列表表格
- 添加/编辑资产弹窗

### 4.4 聊天 (Chat)
- 聊天窗口布局
- 消息列表 (气泡样式)
- 图片消息支持
- 输入框 + 发送按钮
- 图片上传

### 4.5 照片墙 (Photos)
- 瀑布流/网格布局
- 图片预览弹窗
- 上传照片区域
- 留言板区域

### 4.6 日程表 (Calendar)
- 周视图日历
- 时间轴布局
- 事件块显示
- 添加/编辑事件弹窗
- 支持重复事件

### 4.7 德扑 (Poker)
**大厅页:**
- 创建游戏表单
- 最近游戏列表
- 游戏规则说明

**牌桌页:**
- 椭圆牌桌布局
- 玩家座位 (8人)
- 手牌显示
- 公共牌区域
- 操作按钮 (弃牌/跟注/加注/全下)
- 筹码显示

### 4.8 设置 (Settings)
- 个人信息
- 修改密码
- 退出登录

## 五、技术实现细节

### 5.1 技术栈
- **框架**: React 19 + TypeScript
- **构建**: Vite
- **桌面**: Tauri v2
- **状态**: Zustand
- **UI 库**: Ant Design (按需)
- **样式**: Tailwind CSS
- **图表**: Recharts
- **路由**: React Router v7

### 5.2 API 集成
所有 API 调用通过 `/api/*` 前缀访问 Flask 后端:
- 认证: `/api/login`, `/api/logout`, `/api/check-auth`
- 资产: `/api/assets/*`
- 照片: `/api/photos/*`
- 留言: `/api/messages/*`
- 日历: `/api/events/*`
- 聊天: `/api/chat/*`
- 德扑: `/poker/*`

### 5.3 Tauri 集成
- 自定义标题栏 (无系统装饰)
- 窗口控制 (最小化/最大化/关闭)
- 拖拽区域

### 5.4 响应式设计
- 桌面优先 (主要为 Tauri 应用)
- 最小宽度: 800px
- 侧边栏固定宽度
- 内容区自适应

## 六、样式规范

### 6.1 间距
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px

### 6.2 圆角
- sm: 4px
- md: 8px
- lg: 12px
- xl: 16px

### 6.3 阴影
```css
/* 卡片阴影 */
box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);

/* hover 阴影 */
box-shadow: 0 4px 12px rgba(0,0,0,0.1);
```

### 6.4 字体
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

## 七、开发顺序

1. **基础框架** - 创建目录结构、配置文件
2. **布局组件** - AppShell, Sidebar, TitleBar
3. **通用组件** - Card, Button, Modal, Avatar
4. **认证流程** - Login, authStore, ProtectedRoute
5. **首页** - Dashboard
6. **核心功能** - Assets, Chat, Photos
7. **扩展功能** - Calendar, Poker
8. **细节优化** - 动画、加载状态、错误处理

## 八、关键代码结构示例

### 8.1 Sidebar 图标导航
```tsx
const navItems = [
  { key: '/', icon: <HomeIcon />, label: '首页' },
  { key: '/assets', icon: <WalletIcon />, label: '资产' },
  { key: '/chat', icon: <ChatIcon />, label: '聊天', badge: unreadCount },
  { key: '/photos', icon: <PhotoIcon />, label: '相册' },
  { key: '/calendar', icon: <CalendarIcon />, label: '日历' },
  { key: '/poker', icon: <PokerIcon />, label: '德扑' },
];
```

### 8.2 卡片组件
```tsx
<Card title="今日日程" extra={<Link>查看更多</Link>}>
  <EventList events={todayEvents} />
</Card>
```

## 九、性能优化

- 路由懒加载 (React.lazy)
- 图片懒加载
- API 请求缓存
- 虚拟列表 (长列表场景)

## 十、后续迭代

- [ ] 深色模式支持
- [ ] 推送通知
- [ ] 数据导出
- [ ] 多语言支持
