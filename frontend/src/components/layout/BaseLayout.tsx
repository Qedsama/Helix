import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Tooltip, Avatar, theme } from 'antd';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { getImageUrl } from '../../services/api';
import {
  HomeOutlined,
  WalletOutlined,
  MessageOutlined,
  PictureOutlined,
  CalendarOutlined,
  SettingOutlined,
  LogoutOutlined,
  CrownOutlined,
  SunOutlined,
  MoonOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

interface NavItem {
  path: string;
  icon: React.ReactNode;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/', icon: <HomeOutlined style={{ fontSize: '20px' }} />, label: '首页' },
  { path: '/assets', icon: <WalletOutlined style={{ fontSize: '20px' }} />, label: '资产' },
  { path: '/chat', icon: <MessageOutlined style={{ fontSize: '20px' }} />, label: '聊天' },
  { path: '/photos', icon: <PictureOutlined style={{ fontSize: '20px' }} />, label: '照片墙' },
  { path: '/calendar', icon: <CalendarOutlined style={{ fontSize: '20px' }} />, label: '日历' },
  { path: '/poker', icon: <CrownOutlined style={{ fontSize: '20px' }} />, label: '扑克' },
];

interface BaseLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
}

export const BaseLayout: React.FC<BaseLayoutProps> = ({
  children,
  title,
  subtitle,
  headerActions,
}) => {
  const { user, logout } = useAuthStore();
  const { mode, toggleTheme } = useThemeStore();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, colorBgLayout, colorBorder },
  } = theme.useToken();

  const currentNav = navItems.find(item => item.path === location.pathname);

  // 根据主题模式设置侧边栏样式
  const siderStyle = mode === 'dark'
    ? {
        background: '#1f1f1f',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)'
      }
    : {
        background: '#f5f5f5',
        borderRight: `1px solid ${colorBorder}`
      };

  const iconColor = mode === 'dark' ? '#a6a6a6' : '#666';
  const iconActiveColor = '#fff';
  const avatarBorder = mode === 'dark' ? '2px solid rgba(255,255,255,0.2)' : '2px solid rgba(0,0,0,0.1)';

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider
        width={64}
        style={{
          ...siderStyle,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 24,
          paddingBottom: 16,
        }}
        theme={mode}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', width: '100%' }}>
          {/* User Avatar - Moved to top */}
           <Avatar
              src={getImageUrl(user?.avatar || '')}
              size={40}
              style={{ marginBottom: 24, cursor: 'pointer', border: avatarBorder }}
           >
              {user?.username?.[0]?.toUpperCase()}
           </Avatar>

          {/* Navigation */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, width: '100%', alignItems: 'center' }}>
            {navItems.map((item) => (
              <Tooltip title={item.label} placement="right" key={item.path}>
                <div
                  onClick={() => navigate(item.path)}
                  style={{
                    width: 44,
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    backgroundColor: location.pathname === item.path ? '#1890ff' : 'transparent',
                    color: location.pathname === item.path ? iconActiveColor : iconColor,
                  }}
                  className={mode === 'dark' ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-black/5 hover:text-black'}
                >
                  {item.icon}
                </div>
              </Tooltip>
            ))}
          </div>

          {/* Bottom Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', width: '100%' }}>
            {/* Theme Toggle */}
            <Tooltip title={mode === 'dark' ? '切换亮色模式' : '切换暗色模式'} placement="right">
               <div
                  onClick={toggleTheme}
                  style={{
                    width: 44,
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    color: iconColor,
                  }}
                  className={mode === 'dark' ? 'hover:text-white' : 'hover:text-black'}
                >
                  {mode === 'dark' ? <SunOutlined style={{ fontSize: '20px' }} /> : <MoonOutlined style={{ fontSize: '20px' }} />}
                </div>
            </Tooltip>

            <Tooltip title="设置" placement="right">
               <div
                  onClick={() => navigate('/settings')}
                  style={{
                    width: 44,
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    color: location.pathname === '/settings' ? iconActiveColor : iconColor,
                    backgroundColor: location.pathname === '/settings' ? '#1890ff' : 'transparent',
                  }}
                  className={mode === 'dark' ? 'hover:text-white' : 'hover:text-black'}
                >
                  <SettingOutlined style={{ fontSize: '20px' }} />
                </div>
            </Tooltip>

            <Tooltip title="退出登录" placement="right">
                <div
                  onClick={() => logout()}
                  style={{
                    width: 44,
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    color: iconColor,
                  }}
                  className="hover:text-red-500"
                >
                  <LogoutOutlined style={{ fontSize: '20px' }} />
                </div>
            </Tooltip>
          </div>
        </div>
      </Sider>

      <Layout style={{ background: colorBgLayout }}>
        <Header 
            style={{ 
                padding: '0 24px', 
                background: colorBgContainer, 
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                height: 64,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}
            data-tauri-drag-region
        >
             <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                 {currentNav && (
                    <span style={{ fontSize: 16, fontWeight: 500 }}>
                        {currentNav.label}
                        {title && <span style={{ margin: '0 8px', color: '#d9d9d9' }}>/</span>}
                        {title}
                    </span>
                 )}
             </div>
             
             <div>
                 {headerActions}
             </div>
        </Header>

        <Content 
            style={{ 
                padding: 24, 
                margin: 0, 
                overflow: 'auto',
                background: colorBgLayout
            }}
        >
             <div style={{ maxWidth: 1200, margin: '0 auto', height: '100%' }}>
               {/* Page Header within content if needed */}
               {(title || subtitle) && (
                   <div style={{ marginBottom: 24 }}>
                       {title && !currentNav && <h1 style={{ margin: 0, fontSize: 24 }}>{title}</h1>}
                       {subtitle && <p style={{ color: 'rgba(0,0,0,0.45)', marginTop: 8 }}>{subtitle}</p>}
                   </div>
               )}
               
               {children}
             </div>
        </Content>
      </Layout>
    </Layout>
  );
};
