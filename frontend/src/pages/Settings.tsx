import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BaseLayout } from '../components/layout/BaseLayout';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { getImageUrl, authApi, validateImageFile } from '../services/api';
import { Card, Button, Input, Form, Tabs, Typography, Avatar, Descriptions, message as antMessage, Switch, theme } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  SaveOutlined,
  InfoCircleOutlined,
  BulbOutlined,
  CameraOutlined,
  LockOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const Settings: React.FC = () => {
  const { user, logout, refreshUser } = useAuthStore();
  const { mode, setTheme } = useThemeStore();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    token: { colorBgContainer },
  } = theme.useToken();

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

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      antMessage.error(validation.error);
      return;
    }

    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await authApi.uploadAvatar(formData);
      if (response.data.success) {
        antMessage.success('头像更新成功');
        refreshUser();
      } else {
        antMessage.error('头像更新失败');
      }
    } catch {
      antMessage.error('头像上传失败');
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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

  const handleChangePassword = async (values: { oldPassword: string; newPassword: string; confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      antMessage.error('两次输入的新密码不一致');
      return;
    }
    setPasswordLoading(true);
    try {
      const response = await authApi.changePassword(values.oldPassword, values.newPassword);
      if (response.data.success) {
        antMessage.success('密码修改成功!');
        passwordForm.resetFields();
      } else {
        antMessage.error(response.data.message || '密码修改失败');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      antMessage.error(err.response?.data?.error || '密码修改失败');
    } finally {
      setPasswordLoading(false);
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
                     <div
                       style={{ position: 'relative', cursor: 'pointer' }}
                       onClick={handleAvatarClick}
                     >
                       <Avatar
                          size={80}
                          src={getImageUrl(user?.avatar || '')}
                          icon={<UserOutlined />}
                          style={{ backgroundColor: '#1890ff', opacity: avatarLoading ? 0.5 : 1 }}
                       />
                       <div style={{
                         position: 'absolute',
                         bottom: 0,
                         right: 0,
                         background: '#1890ff',
                         borderRadius: '50%',
                         width: 24,
                         height: 24,
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center',
                         border: '2px solid white'
                       }}>
                         <CameraOutlined style={{ color: 'white', fontSize: 12 }} />
                       </div>
                       <input
                         type="file"
                         ref={fileInputRef}
                         style={{ display: 'none' }}
                         accept="image/png,image/jpeg,image/gif"
                         onChange={handleAvatarChange}
                       />
                     </div>
                     <div>
                         <Title level={4} style={{ margin: 0 }}>{user?.username || '用户'}</Title>
                         <Text type="secondary">ID: {user?.id}</Text>
                         <br />
                         <Text type="secondary" style={{ fontSize: 12 }}>点击头像更换</Text>
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
      key: 'security',
      label: (
        <span>
          <LockOutlined />
          安全
        </span>
      ),
      children: (
        <Card bordered={false} title="修改密码">
            <Form
                form={passwordForm}
                layout="vertical"
                onFinish={handleChangePassword}
                style={{ maxWidth: 400 }}
            >
                <Form.Item
                    label="当前密码"
                    name="oldPassword"
                    rules={[{ required: true, message: '请输入当前密码' }]}
                >
                    <Input.Password placeholder="输入当前密码" prefix={<LockOutlined />} />
                </Form.Item>

                <Form.Item
                    label="新密码"
                    name="newPassword"
                    rules={[
                      { required: true, message: '请输入新密码' },
                      { min: 4, message: '密码长度至少4位' }
                    ]}
                >
                    <Input.Password placeholder="输入新密码" prefix={<LockOutlined />} />
                </Form.Item>

                <Form.Item
                    label="确认新密码"
                    name="confirmPassword"
                    rules={[
                      { required: true, message: '请再次输入新密码' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('newPassword') === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('两次输入的密码不一致'));
                        },
                      }),
                    ]}
                >
                    <Input.Password placeholder="再次输入新密码" prefix={<LockOutlined />} />
                </Form.Item>

                <Form.Item>
                    <Button type="primary" htmlType="submit" loading={passwordLoading} icon={<SaveOutlined />}>
                        修改密码
                    </Button>
                </Form.Item>
            </Form>
            <Text type="secondary" style={{ fontSize: 12 }}>
                默认密码为 helix，建议首次登录后修改
            </Text>
        </Card>
      ),
    },
    {
      key: 'appearance',
      label: (
        <span>
          <BulbOutlined />
          外观
        </span>
      ),
      children: (
        <Card bordered={false} title="外观设置">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 600 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <Title level={5} style={{ margin: 0 }}>暗色模式</Title>
                        <Text type="secondary">切换应用的亮色/暗色主题</Text>
                    </div>
                    <Switch
                        checked={mode === 'dark'}
                        onChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                        checkedChildren="暗"
                        unCheckedChildren="亮"
                    />
                </div>
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
      <div style={{ background: colorBgContainer, padding: 24, borderRadius: 8, minHeight: 'calc(100vh - 140px)' }}>
        <Tabs defaultActiveKey="profile" items={items} tabPosition="left" />
      </div>
    </BaseLayout>
  );
};

export default Settings;
