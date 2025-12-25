import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BaseLayout } from '../components/layout/BaseLayout';
import { useAuthStore } from '../stores/authStore';
import { getImageUrl } from '../services/api';
import { Card, Button, Input, Form, Tabs, Typography, Avatar, Descriptions, message as antMessage } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  SaveOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const Settings: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        username: user.username
      });
    }
  }, [user, form]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSaveProfile = async (values: { username: string }) => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: values.username }),
      });

      const data = await response.json();
      if (data.success) {
        antMessage.success('保存成功!');
      } else {
        antMessage.error(data.error || '保存失败');
      }
    } catch {
      antMessage.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const items = [
    {
      key: 'profile',
      label: (
        <span>
          <UserOutlined />
          个人信息
        </span>
      ),
      children: (
        <Card bordered={false} title="基本信息">
            <div style={{ display: 'flex', gap: 32, flexDirection: 'column', maxWidth: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                     <Avatar
                        size={80}
                        src={getImageUrl(user?.avatar || '')}
                        icon={<UserOutlined />}
                        style={{ backgroundColor: '#1890ff' }}
                     />
                     <div>
                         <Title level={4} style={{ margin: 0 }}>{user?.username || '用户'}</Title>
                         <Text type="secondary">ID: {user?.id}</Text>
                     </div>
                </div>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSaveProfile}
                    initialValues={{ username: user?.username }}
                >
                    <Form.Item
                        label="用户名"
                        name="username"
                        rules={[{ required: true, message: '请输入用户名' }]}
                    >
                        <Input placeholder="输入你的用户名" prefix={<UserOutlined />} />
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                            保存修改
                        </Button>
                    </Form.Item>
                </Form>
            </div>
        </Card>
      ),
    },
    {
        key: 'about',
        label: (
            <span>
                <InfoCircleOutlined />
                关于
            </span>
        ),
        children: (
            <Card bordered={false} title="关于应用">
                <Descriptions bordered column={1}>
                    <Descriptions.Item label="应用名称">Helix</Descriptions.Item>
                    <Descriptions.Item label="版本">2.0.0</Descriptions.Item>
                    <Descriptions.Item label="描述">Couples' Private Space</Descriptions.Item>
                    <Descriptions.Item label="开发者">Helix Team</Descriptions.Item>
                </Descriptions>

                <div style={{ marginTop: 24 }}>
                    <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>
                        退出登录
                    </Button>
                </div>
            </Card>
        )
    }
  ];

  return (
    <BaseLayout
      title="设置"
      subtitle="管理您的账户和偏好"
    >
      <div style={{ background: '#fff', padding: 24, borderRadius: 8, minHeight: 'calc(100vh - 140px)' }}>
        <Tabs defaultActiveKey="profile" items={items} tabPosition="left" />
      </div>
    </BaseLayout>
  );
};

export default Settings;
