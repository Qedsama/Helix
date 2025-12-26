import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BaseLayout } from '../components/layout/BaseLayout';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { dashboardApi, getImageUrl } from '../services/api';
import { Card, Row, Col, Statistic, List, Avatar, Typography, Timeline, Button, Empty, Spin, theme } from 'antd';
import {
  WalletOutlined,
  MessageOutlined,
  PictureOutlined,
  CalendarOutlined,
  UserOutlined,
  ClockCircleOutlined,
  HeartOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text } = Typography;

interface DashboardData {
  total_assets: number;
  today_events: Array<{ id: number; title: string; start_time: string }>;
  recent_photos: Array<{ id: number; filename: string }>;
  recent_messages: Array<{ id: number; content: string; created_at: string }>;
}

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { mode } = useThemeStore();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const {
    token: { colorBgContainer, colorText, colorTextSecondary },
  } = theme.useToken();

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await dashboardApi.getData();
        setData(response.data.data as DashboardData);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '早上好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  const statCards = [
    {
      title: '总资产',
      value: data?.total_assets,
      precision: 2,
      prefix: '¥',
      icon: <WalletOutlined style={{ fontSize: 24, color: '#1890ff' }} />,
      link: '/assets',
    },
    {
      title: '今日日程',
      value: data?.today_events?.length || 0,
      suffix: '项',
      icon: <CalendarOutlined style={{ fontSize: 24, color: '#722ed1' }} />,
      link: '/calendar',
    },
    {
      title: '照片回忆',
      value: data?.recent_photos?.length || 0,
      suffix: '张',
      icon: <PictureOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
      link: '/photos',
    },
    {
      title: '最近留言',
      value: data?.recent_messages?.length || 0,
      suffix: '条',
      icon: <MessageOutlined style={{ fontSize: 24, color: '#fa8c16' }} />,
      link: '/chat',
    },
  ];

  if (loading) {
    return (
      <BaseLayout>
        <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin size="large" />
        </div>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout>
      <div style={{ paddingBottom: 24 }}>
        {/* Welcome Section */}
        <Card
          bordered={false}
          style={{
            marginBottom: 24,
            background: colorBgContainer,
            borderRadius: 16,
            boxShadow: mode === 'light' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
          }}
          bodyStyle={{ padding: '32px 40px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <Avatar size={80} src={getImageUrl(user?.avatar || '')} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
                <div>
                    <Title level={2} style={{ color: colorText, margin: 0, marginBottom: 8 }}>
                        {greeting()}，{user?.username || '用户'}
                    </Title>
                    <Text style={{ color: colorTextSecondary, fontSize: 16 }}>
                        欢迎回到 Helix，准备好开启美好的一天了吗？
                    </Text>
                </div>
            </div>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 36, fontWeight: 'bold', color: colorText }}>
                    {dayjs().format('HH:mm')}
                </div>
                <div style={{ color: colorTextSecondary }}>
                    {dayjs().format('YYYY年M月D日 dddd')}
                </div>
            </div>
          </div>
        </Card>

        {/* Stats Grid */}
        <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
          {statCards.map((stat, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <Card 
                hoverable 
                bordered={false} 
                style={{ borderRadius: 12, height: '100%' }}
                onClick={() => navigate(stat.link)}
              >
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Statistic 
                        title={stat.title} 
                        value={stat.value} 
                        precision={stat.precision}
                        prefix={stat.prefix}
                        suffix={stat.suffix}
                        valueStyle={{ fontWeight: 'bold' }}
                    />
                    <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {stat.icon}
                    </div>
                 </div>
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={24}>
          {/* Left Column */}
          <Col xs={24} lg={16}>
            {/* Quick Actions */}
            <Card title="快捷访问" bordered={false} style={{ marginBottom: 24, borderRadius: 12 }}>
                <Row gutter={[16, 16]}>
                    {[
                        { label: '记一笔', icon: <WalletOutlined />, path: '/assets', color: '#1890ff' },
                        { label: '传照片', icon: <PictureOutlined />, path: '/photos', color: '#52c41a' },
                        { label: '订日程', icon: <CalendarOutlined />, path: '/calendar', color: '#722ed1' },
                        { label: '发消息', icon: <MessageOutlined />, path: '/chat', color: '#fa8c16' },
                    ].map(action => (
                        <Col span={6} key={action.label}>
                            <Button 
                                type="text" 
                                block 
                                style={{ height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                onClick={() => navigate(action.path)}
                            >
                                <div style={{ 
                                    width: 40, 
                                    height: 40, 
                                    borderRadius: '50%', 
                                    background: `${action.color}15`, 
                                    color: action.color,
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    fontSize: 20
                                }}>
                                    {action.icon}
                                </div>
                                <span>{action.label}</span>
                            </Button>
                        </Col>
                    ))}
                </Row>
            </Card>

            {/* Photos Preview */}
            <Card 
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <HeartOutlined style={{ color: '#eb2f96' }} />
                        <span>美好瞬间</span>
                    </div>
                }
                extra={<Button type="link" onClick={() => navigate('/photos')}>查看全部</Button>}
                bordered={false}
                style={{ borderRadius: 12, minHeight: 400 }}
            >
                {data?.recent_photos && data.recent_photos.length > 0 ? (
                    <Row gutter={[16, 16]}>
                        {data.recent_photos.slice(0, 6).map((photo) => (
                            <Col span={8} key={photo.id}>
                                <div 
                                    style={{ 
                                        aspectRatio: '4/3', 
                                        borderRadius: 8, 
                                        overflow: 'hidden', 
                                        cursor: 'pointer',
                                        position: 'relative'
                                    }}
                                    className="group"
                                >
                                    <img 
                                        src={getImageUrl(photo.filename)}
                                        alt="memory" 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                                        className="group-hover:scale-110"
                                    />
                                    <div style={{ 
                                        position: 'absolute', 
                                        inset: 0, 
                                        background: 'rgba(0,0,0,0.3)', 
                                        opacity: 0, 
                                        transition: 'opacity 0.3s' 
                                    }} className="group-hover:opacity-100" />
                                </div>
                            </Col>
                        ))}
                    </Row>
                ) : (
                    <Empty description="暂无照片，去上传一张吧" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
            </Card>
          </Col>

          {/* Right Column */}
          <Col xs={24} lg={8}>
             {/* Timeline */}
             <Card 
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ClockCircleOutlined style={{ color: '#1890ff' }} />
                        <span>今日日程</span>
                    </div>
                }
                extra={<Button type="link" onClick={() => navigate('/calendar')}>更多</Button>}
                bordered={false} 
                style={{ marginBottom: 24, borderRadius: 12 }}
            >
                {data?.today_events && data.today_events.length > 0 ? (
                    <Timeline
                        items={data.today_events.map(event => ({
                            color: 'blue',
                            children: (
                                <>
                                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                                        {dayjs(event.start_time).format('HH:mm')}
                                    </Text>
                                    <Text strong>{event.title}</Text>
                                </>
                            )
                        }))}
                    />
                ) : (
                    <Empty description="今日暂无安排" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
             </Card>

             {/* Recent Messages */}
             <Card 
                title="最新留言" 
                extra={<Button type="link" onClick={() => navigate('/chat')}>全部</Button>}
                bordered={false}
                style={{ borderRadius: 12 }}
             >
                <List
                    itemLayout="horizontal"
                    dataSource={data?.recent_messages || []}
                    renderItem={(item) => (
                        <List.Item>
                            <List.Item.Meta
                                avatar={<Avatar style={{ backgroundColor: '#fde3cf', color: '#f56a00' }}>U</Avatar>}
                                title={<Text ellipsis={{ tooltip: item.content }} style={{ maxWidth: 180 }}>{item.content}</Text>}
                                description={<Text type="secondary" style={{ fontSize: 12 }}>{dayjs(item.created_at).fromNow()}</Text>}
                            />
                        </List.Item>
                    )}
                    locale={{ emptyText: <Empty description="暂无留言" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                />
             </Card>
          </Col>
        </Row>
      </div>
    </BaseLayout>
  );
};

export default Dashboard;
