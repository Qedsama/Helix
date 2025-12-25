import React, { useEffect, useState, useRef, useCallback } from 'react';
import { BaseLayout } from '../components/layout/BaseLayout';
import { chatApi, authApi, getImageUrl, validateImageFile } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { notify, requestNotificationPermission } from '../services/notificationService';
import type { ChatMessage, User, ChatReaction } from '../types';
import { Input, Button, Avatar, Upload, Tooltip, Empty, Spin, message as antMessage } from 'antd';
import {
  SendOutlined,
  PictureOutlined,
  PaperClipOutlined,
  UserOutlined,
  SmileOutlined
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import EmojiPicker, { getBadgeStyle } from '../components/EmojiPicker';

const { TextArea } = Input;

dayjs.extend(utc);

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [partner, setPartner] = useState<User | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const notifiedMsgIdsRef = useRef<Set<number>>(new Set());
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const fetchPartner = async () => {
      try {
        const response = await authApi.getUsers();
        if (response.data.success && user) {
          const partnerId = user.id === 1 ? 2 : 1;
          const partnerUser = response.data.users.find((u: User) => u.id === partnerId);
          setPartner(partnerUser || null);
        }
      } catch (err) {
        console.error('Failed to fetch partner:', err);
      }
    };
    fetchPartner();
  }, [user]);

  // 请求通知权限
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const loadMessages = async () => {
    try {
      const response = await chatApi.getMessages();
      const fetchedMessages: ChatMessage[] = response.data.messages || [];

      // 检查是否有来自对方的新消息，如果应用不在前台则发送通知
      if (user && document.hidden) {
        for (const msg of fetchedMessages) {
          // 只通知对方发的消息，且未通知过
          if (msg.sender_id !== user.id && !notifiedMsgIdsRef.current.has(msg.id)) {
            const content = msg.message_type === 'text'
              ? msg.content
              : '[图片]';
            await notify('Helix 新消息', content);
            notifiedMsgIdsRef.current.add(msg.id);
          }
        }
      } else {
        // 应用在前台时，也要记录消息ID，避免切换后台时重复通知
        for (const msg of fetchedMessages) {
          notifiedMsgIdsRef.current.add(msg.id);
        }
      }

      setMessages(fetchedMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await chatApi.send(newMessage.trim());
      setNewMessage('');
      loadMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
      antMessage.error('发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReaction = useCallback(async (messageId: number, emoji: string) => {
    try {
      const response = await chatApi.addReaction(messageId, emoji);
      if (response.data.success) {
        // 刷新消息列表以获取最新反应状态
        loadMessages();
      }
    } catch (error) {
      console.error('Failed to add reaction:', error);
      antMessage.error('添加表情失败');
    }
  }, []);

  const uploadProps: UploadProps = {
    showUploadList: false,
    beforeUpload: async (file) => {
      // 验证文件类型和大小
      const validation = validateImageFile(file);
      if (!validation.valid) {
        antMessage.error(validation.error);
        return false;
      }

      const formData = new FormData();
      formData.append('image', file);
      try {
        await chatApi.uploadImage(formData);
        loadMessages();
        antMessage.success('图片发送成功');
      } catch (error) {
        console.error('Failed to upload image:', error);
        antMessage.error('图片发送失败');
      }
      return false; // Prevent auto upload by antd
    },
  };

  const partnerName = partner?.username || '';

  // 渲染消息的表情反应
  const renderReactions = (reactions: ChatReaction[] | undefined, messageId: number) => {
    if (!reactions || reactions.length === 0) return null;

    return (
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 4
      }}>
        {reactions.map((reaction) => {
          const hasReacted = reaction.users.some(u => u.user_id === user?.id);
          const badgeStyle = getBadgeStyle(reaction.emoji);

          // 使用徽章样式或默认样式
          const baseStyle = badgeStyle
            ? {
                background: hasReacted ? badgeStyle.bg : '#f5f5f5',
                border: hasReacted ? `1px solid ${badgeStyle.color}` : '1px solid #e8e8e8',
                color: badgeStyle.color,
                fontSize: 11,
                fontWeight: 600 as const,
              }
            : {
                background: hasReacted ? '#e6f7ff' : '#f5f5f5',
                border: hasReacted ? '1px solid #1890ff' : '1px solid #e8e8e8',
                fontSize: 14,
                fontWeight: 400 as const,
              };

          return (
            <Tooltip
              key={reaction.emoji}
              title={reaction.users.map(u => u.username).join(', ')}
            >
              <div
                onClick={() => handleReaction(messageId, reaction.emoji)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  ...baseStyle
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <span>{reaction.emoji}</span>
                {reaction.count > 1 && (
                  <span style={{ fontSize: 11, color: badgeStyle ? badgeStyle.color : '#666' }}>{reaction.count}</span>
                )}
              </div>
            </Tooltip>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <BaseLayout title={partnerName}>
        <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin size="large" />
        </div>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout
      title={partnerName}
      subtitle="在线"
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
        {/* Messages Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f5f5f5' }}>
          {messages.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description="开始聊天吧~" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {messages.map((msg) => {
                const isOwn = msg.sender_id === user?.id;
                const isHovered = hoveredMessageId === msg.id;
                return (
                  <div
                    key={msg.id}
                    style={{
                        display: 'flex',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                        gap: 12
                    }}
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                  >
                    {!isOwn && (
                        <Avatar style={{ backgroundColor: '#fde3cf', color: '#f56a00' }} icon={<UserOutlined />} />
                    )}

                    <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', position: 'relative' }}>
                      {/* 消息气泡行：包含气泡和表情按钮 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexDirection: isOwn ? 'row-reverse' : 'row' }}>
                        {msg.message_type === 'text' ? (
                          <div
                            style={{
                              padding: '10px 16px',
                              borderRadius: 12,
                              background: isOwn ? '#1890ff' : '#fff',
                              color: isOwn ? '#fff' : 'rgba(0,0,0,0.85)',
                              borderTopRightRadius: isOwn ? 2 : 12,
                              borderTopLeftRadius: isOwn ? 12 : 2,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              wordWrap: 'break-word',
                              whiteSpace: 'pre-wrap'
                            }}
                          >
                            {msg.content}
                          </div>
                        ) : (
                          <div
                             style={{
                                  padding: 4,
                                  background: isOwn ? '#1890ff' : '#fff',
                                  borderRadius: 12,
                                  borderTopRightRadius: isOwn ? 2 : 12,
                                  borderTopLeftRadius: isOwn ? 12 : 2,
                             }}
                          >
                              <img
                                src={getImageUrl(`chat_images/${msg.image_filename}`)}
                                alt="chat-image"
                                style={{ borderRadius: 8, maxWidth: '100%', maxHeight: 300, display: 'block' }}
                              />
                          </div>
                        )}

                        {/* 表情按钮 - 悬停时显示 */}
                        <div style={{
                          opacity: isHovered ? 1 : 0,
                          transition: 'opacity 0.2s',
                          flexShrink: 0
                        }}>
                          <EmojiPicker onSelect={(emoji) => handleReaction(msg.id, emoji)}>
                            <Button
                              type="text"
                              size="small"
                              icon={<SmileOutlined style={{ fontSize: 16, color: '#999' }} />}
                              style={{
                                padding: '4px 8px',
                                height: 'auto',
                                background: '#f5f5f5',
                                borderRadius: 12
                              }}
                            />
                          </EmojiPicker>
                        </div>
                      </div>

                      {/* 表情反应 */}
                      {renderReactions(msg.reactions, msg.id)}

                      <span style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                         {dayjs.utc(msg.created_at).utcOffset(8).format('HH:mm')}
                      </span>
                    </div>

                    {isOwn && (
                        <Avatar style={{ backgroundColor: '#87d068' }} icon={<UserOutlined />} src={getImageUrl(user?.avatar || '')} />
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div style={{ padding: '16px', background: '#fff', borderTop: '1px solid #f0f0f0' }}>
            <div style={{ marginBottom: 8, display: 'flex', gap: 16 }}>
                <Upload {...uploadProps}>
                    <Tooltip title="发送图片">
                        <Button type="text" icon={<PictureOutlined style={{ fontSize: 20 }} />} />
                    </Tooltip>
                </Upload>
                <Tooltip title="发送文件">
                     <Button type="text" icon={<PaperClipOutlined style={{ fontSize: 20 }} />} />
                </Tooltip>
            </div>
            
            <TextArea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息..."
                autoSize={{ minRows: 3, maxRows: 6 }}
                bordered={false}
                style={{ marginBottom: 8, resize: 'none', fontSize: 14 }}
            />
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
                 <span style={{ fontSize: 12, color: '#999' }}>Enter 发送</span>
                 <Button 
                    type="primary" 
                    onClick={handleSend} 
                    loading={sending}
                    icon={<SendOutlined />}
                    disabled={!newMessage.trim() && !sending}
                 >
                    发送
                 </Button>
            </div>
        </div>
      </div>
    </BaseLayout>
  );
};

export default Chat;
