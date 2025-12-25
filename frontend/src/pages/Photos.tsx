import React, { useEffect, useState } from 'react';
import { BaseLayout } from '../components/layout/BaseLayout';
import { photoApi, messageApi, getImageUrl, validateImageFile } from '../services/api';
import type { Photo, Message } from '../types';
import { Upload, Button, Input, List, Image, Card, Popconfirm, Avatar, message as antMessage, Empty, Spin, Row, Col } from 'antd';
import { InboxOutlined, DeleteOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import dayjs from 'dayjs';

const { Dragger } = Upload;
const { TextArea } = Input;

const Photos: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [photosRes, messagesRes] = await Promise.all([
        photoApi.getAll(),
        messageApi.getAll(),
      ]);
      setPhotos(photosRes.data.photos || []);
      setMessages(messagesRes.data.messages || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      antMessage.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const uploadProps: UploadProps = {
    name: 'photo',
    multiple: false,
    showUploadList: false,
    beforeUpload: async (file) => {
      // 验证文件类型和大小
      const validation = validateImageFile(file);
      if (!validation.valid) {
        antMessage.error(validation.error);
        return false;
      }

      const formData = new FormData();
      formData.append('photo', file);
      try {
        await photoApi.upload(formData);
        antMessage.success('照片上传成功');
        loadData();
      } catch (error) {
        console.error('Failed to upload photo:', error);
        antMessage.error('上传失败');
      }
      return false;
    },
  };

  const handleDeletePhoto = async (id: number) => {
    try {
      await photoApi.delete(id);
      antMessage.success('照片删除成功');
      loadData();
    } catch (error) {
      console.error('Failed to delete photo:', error);
      antMessage.error('删除失败');
    }
  };

  const handleAddMessage = async () => {
    if (!newMessage.trim()) return;

    setSubmitting(true);
    try {
      await messageApi.create(newMessage.trim());
      setNewMessage('');
      antMessage.success('留言发送成功');
      loadData();
    } catch (error) {
      console.error('Failed to add message:', error);
      antMessage.error('留言失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMessage = async (id: number) => {
    try {
      await messageApi.delete(id);
      antMessage.success('留言删除成功');
      loadData();
    } catch (error) {
      console.error('Failed to delete message:', error);
      antMessage.error('删除失败');
    }
  };

  if (loading) {
    return (
      <BaseLayout title="照片留言墙">
         <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin size="large" />
        </div>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout
      title="照片留言墙"
      subtitle="记录美好时光, 分享心情与感动"
    >
        <Row gutter={24} style={{ height: '100%' }}>
            {/* Left: Photo Wall */}
            <Col xs={24} lg={14} style={{ marginBottom: 24 }}>
                <Card
                    title={`照片墙 (${photos.length}张)`}
                    bordered={false}
                    style={{ borderRadius: 8, height: '100%' }}
                    bodyStyle={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}
                >
                    {/* Upload Section */}
                    <Dragger {...uploadProps} style={{ marginBottom: 16 }}>
                        <p className="ant-upload-drag-icon">
                            <InboxOutlined />
                        </p>
                        <p className="ant-upload-text">点击或拖拽照片上传</p>
                    </Dragger>

                    {/* Photos Gallery */}
                    {photos.length > 0 ? (
                        <Image.PreviewGroup>
                            <Row gutter={[12, 12]}>
                                {photos.map((photo) => (
                                    <Col xs={12} sm={8} md={6} key={photo.id}>
                                        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
                                            <Image
                                                src={getImageUrl(photo.filename)}
                                                alt={photo.caption || ''}
                                                style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 8 }}
                                            />
                                            <div style={{
                                                position: 'absolute',
                                                top: 4,
                                                right: 4
                                            }}>
                                                <Popconfirm
                                                    title="确定删除这张照片吗?"
                                                    onConfirm={() => handleDeletePhoto(photo.id)}
                                                    okText="是"
                                                    cancelText="否"
                                                >
                                                    <Button
                                                        type="primary"
                                                        danger
                                                        shape="circle"
                                                        icon={<DeleteOutlined />}
                                                        size="small"
                                                    />
                                                </Popconfirm>
                                            </div>
                                        </div>
                                    </Col>
                                ))}
                            </Row>
                        </Image.PreviewGroup>
                    ) : (
                        <Empty description="暂无照片" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                </Card>
            </Col>

            {/* Right: Message Wall */}
            <Col xs={24} lg={10} style={{ marginBottom: 24 }}>
                <Card
                    title="留言墙"
                    bordered={false}
                    style={{ borderRadius: 8, height: '100%', display: 'flex', flexDirection: 'column' }}
                    bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 280px)' }}
                >
                    {/* Message Input */}
                    <div style={{ marginBottom: 16 }}>
                        <TextArea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="想对你说..."
                            autoSize={{ minRows: 2, maxRows: 4 }}
                            style={{ marginBottom: 8 }}
                        />
                        <div style={{ textAlign: 'right' }}>
                            <Button
                                type="primary"
                                icon={<SendOutlined />}
                                onClick={handleAddMessage}
                                loading={submitting}
                                disabled={!newMessage.trim()}
                            >
                                发送留言
                            </Button>
                        </div>
                    </div>

                    {/* Message List */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        <List
                            itemLayout="horizontal"
                            dataSource={messages}
                            renderItem={(msg) => (
                                <List.Item
                                    actions={[
                                        <Popconfirm
                                            title="确定删除这条留言吗?"
                                            onConfirm={() => handleDeleteMessage(msg.id)}
                                            okText="是"
                                            cancelText="否"
                                        >
                                            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                                        </Popconfirm>
                                    ]}
                                >
                                    <List.Item.Meta
                                        avatar={<Avatar style={{ backgroundColor: '#fde3cf', color: '#f56a00' }} icon={<UserOutlined />} />}
                                        title={
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{msg.username || '未知用户'}</span>
                                                <span style={{ fontSize: 12, color: '#999', fontWeight: 'normal' }}>
                                                    {dayjs(msg.created_at).format('MM-DD HH:mm')}
                                                </span>
                                            </div>
                                        }
                                        description={<div style={{ color: 'rgba(0,0,0,0.85)', whiteSpace: 'pre-wrap' }}>{msg.content}</div>}
                                    />
                                </List.Item>
                            )}
                            locale={{ emptyText: <Empty description="还没有留言，写下第一条吧~" /> }}
                        />
                    </div>
                </Card>
            </Col>
        </Row>
    </BaseLayout>
  );
};

export default Photos;
