import React, { useState, useRef, useEffect } from 'react';
import {
  Input,
  Button,
  Space,
  Typography,
  Spin,
  message as antMessage,
  Divider,
  Avatar,
  theme,
  Tag,
} from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  RocketOutlined,
  ClearOutlined,
  CheckCircleOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { travelApi } from '../../../services/api';
import type { AIChatMessage } from '../../../types';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface ToolCallResult {
  tool_name: string;
  arguments: Record<string, unknown>;
  result: { success: boolean; message?: string; error?: string; plan_id?: number; item_id?: number; [key: string]: unknown };
}

interface ChatDisplayMessage {
  role: 'user' | 'assistant' | 'tool_results';
  content: string;
  tool_results?: ToolCallResult[];
}

interface TravelAIChatProps {
  onPlanGenerated: (planId: number) => void;
}

// 本地存储key
const CHAT_STORAGE_KEY = 'helix_travel_ai_chat';

// 从localStorage加载聊天记录
const loadChatHistory = (): { apiMessages: AIChatMessage[], displayMessages: ChatDisplayMessage[] } => {
  try {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        apiMessages: Array.isArray(parsed.apiMessages) ? parsed.apiMessages : [],
        displayMessages: Array.isArray(parsed.displayMessages) ? parsed.displayMessages : [],
      };
    }
  } catch (e) {
    console.error('Failed to load chat history:', e);
  }
  return { apiMessages: [], displayMessages: [] };
};

// 保存聊天记录到localStorage
const saveChatHistory = (apiMessages: AIChatMessage[], displayMessages: ChatDisplayMessage[]) => {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ apiMessages, displayMessages }));
  } catch (e) {
    console.error('Failed to save chat history:', e);
  }
};

// 工具名称中文映射
const toolNameLabels: Record<string, string> = {
  create_travel_plan: '创建计划',
  list_travel_plans: '查看计划列表',
  get_travel_plan: '获取计划详情',
  add_itinerary: '添加行程',
  update_itinerary: '更新行程',
  delete_itinerary: '删除行程',
  search_poi: '搜索地点',
};

const TravelAIChat: React.FC<TravelAIChatProps> = ({ onPlanGenerated }) => {
  const { apiMessages: savedApi, displayMessages: savedDisplay } = loadChatHistory();
  const [apiMessages, setApiMessages] = useState<AIChatMessage[]>(savedApi);
  const [displayMessages, setDisplayMessages] = useState<ChatDisplayMessage[]>(savedDisplay);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 保存聊天记录到localStorage
  useEffect(() => {
    saveChatHistory(apiMessages, displayMessages);
  }, [apiMessages, displayMessages]);

  const {
    token: { colorBgContainer, colorBorder, colorPrimary, colorBgTextHover },
  } = theme.useToken();

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayMessages]);

  // 发送消息
  const handleSend = async () => {
    if (!inputValue.trim() || loading) return;

    const userMessage: AIChatMessage = {
      role: 'user',
      content: inputValue.trim(),
    };

    const newApiMessages = [...apiMessages, userMessage];
    const newDisplayMessages: ChatDisplayMessage[] = [...displayMessages, { role: 'user', content: inputValue.trim() }];
    setApiMessages(newApiMessages);
    setDisplayMessages(newDisplayMessages);
    setInputValue('');
    setLoading(true);

    try {
      const response = await travelApi.aiChat(newApiMessages);

      if (response.data.success) {
        const toolCalls = response.data.tool_calls || [];
        const aiContent = response.data.message || '';

        // Add assistant message to API messages for context
        const updatedApiMessages = [...newApiMessages, { role: 'assistant' as const, content: aiContent }];
        setApiMessages(updatedApiMessages);

        // Build display messages
        const newDisplay = [...newDisplayMessages];

        // Show tool results if any
        if (toolCalls.length > 0) {
          newDisplay.push({
            role: 'tool_results',
            content: '',
            tool_results: toolCalls,
          });

          // Check if any tool created a plan - notify parent
          for (const tc of toolCalls) {
            if (tc.tool_name === 'create_travel_plan' && tc.result.success && tc.result.plan_id) {
              // Don't auto-navigate, let user see the full result first
            }
          }
        }

        // Show assistant message if present
        if (aiContent) {
          newDisplay.push({ role: 'assistant', content: aiContent });
        }

        setDisplayMessages(newDisplay);
      } else {
        antMessage.error(response.data.error || 'AI响应失败');
      }
    } catch (error: any) {
      console.error('AI chat error:', error);
      antMessage.error(error.response?.data?.error || 'AI服务暂时不可用，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 清空聊天记录
  const handleClearChat = () => {
    setApiMessages([]);
    setDisplayMessages([]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
  };

  // 从工具结果中提取plan_id用于跳转
  const getCreatedPlanId = (): number | null => {
    for (const msg of displayMessages) {
      if (msg.tool_results) {
        for (const tc of msg.tool_results) {
          if (tc.tool_name === 'create_travel_plan' && tc.result.success && tc.result.plan_id) {
            return tc.result.plan_id as number;
          }
        }
      }
    }
    return null;
  };

  // 快捷提示
  const quickPrompts = [
    '帮我规划一个5天的日本东京之旅，预算1万元，喜欢美食和动漫',
    '我想去云南丽江大理玩4天，两个人，喜欢自然风光和摄影',
    '周末两天上海周边自驾游，带小孩，有什么推荐？',
    '国庆节去成都重庆7天，想体验当地美食和文化',
  ];

  const createdPlanId = getCreatedPlanId();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: colorBgContainer,
    }}>
      {/* 头部 */}
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${colorBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar
            icon={<RobotOutlined />}
            style={{ background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)' }}
          />
          <div>
            <Text strong style={{ fontSize: 16 }}>AI旅行规划助手</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              告诉我你的旅行计划，我来帮你规划行程
            </Text>
          </div>
        </div>
        <Space>
          {createdPlanId && (
            <Button
              type="primary"
              size="small"
              onClick={() => onPlanGenerated(createdPlanId)}
            >
              查看已创建的计划
            </Button>
          )}
          {displayMessages.length > 0 && (
            <Button
              icon={<ClearOutlined />}
              size="small"
              onClick={handleClearChat}
            >
              新对话
            </Button>
          )}
        </Space>
      </div>

      {/* 消息列表 */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {displayMessages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <RocketOutlined style={{ fontSize: 48, color: '#8c8c8c', marginBottom: 16 }} />
            <Paragraph type="secondary">
              你好！我是你的AI旅行规划助手。
              <br />
              告诉我你想去哪里、什么时候去、预算多少，我会帮你自动创建旅行计划和行程。
            </Paragraph>
            <Divider>试试这些</Divider>
            <Space direction="vertical" style={{ width: '100%' }}>
              {quickPrompts.map((prompt, index) => (
                <Button
                  key={index}
                  type="text"
                  block
                  style={{
                    textAlign: 'left',
                    height: 'auto',
                    padding: '8px 12px',
                    background: colorBgTextHover,
                    borderRadius: 8,
                  }}
                  onClick={() => setInputValue(prompt)}
                >
                  <Text style={{ whiteSpace: 'normal' }}>{prompt}</Text>
                </Button>
              ))}
            </Space>
          </div>
        ) : (
          displayMessages.map((msg, index) => {
            // Tool results display
            if (msg.role === 'tool_results' && msg.tool_results) {
              return (
                <div key={index} style={{ display: 'flex', gap: 8 }}>
                  <Avatar
                    icon={<ToolOutlined />}
                    size="small"
                    style={{ background: '#faad14', flexShrink: 0 }}
                  />
                  <div style={{
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: '16px 16px 16px 4px',
                    background: '#fffbe6',
                    border: '1px solid #ffe58f',
                  }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                      <ToolOutlined /> 执行了 {msg.tool_results.length} 个操作
                    </Text>
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      {msg.tool_results.map((tc, tcIdx) => (
                        <div key={tcIdx} style={{ fontSize: 13 }}>
                          {tc.result.success ? (
                            <Tag color="success" style={{ marginRight: 4 }}>
                              <CheckCircleOutlined /> {toolNameLabels[tc.tool_name] || tc.tool_name}
                            </Tag>
                          ) : (
                            <Tag color="error" style={{ marginRight: 4 }}>
                              {toolNameLabels[tc.tool_name] || tc.tool_name}
                            </Tag>
                          )}
                          <Text style={{ fontSize: 12 }}>
                            {tc.result.message || tc.result.error || ''}
                          </Text>
                        </div>
                      ))}
                    </Space>
                  </div>
                </div>
              );
            }

            // User / assistant messages
            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  gap: 8,
                }}
              >
                {msg.role === 'assistant' && (
                  <Avatar
                    icon={<RobotOutlined />}
                    size="small"
                    style={{ background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)', flexShrink: 0 }}
                  />
                )}
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)'
                      : colorBgTextHover,
                    color: msg.role === 'user' ? '#fff' : 'inherit',
                  }}
                >
                  <Paragraph
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      color: msg.role === 'user' ? '#fff' : 'inherit',
                    }}
                  >
                    {msg.content}
                  </Paragraph>
                </div>
                {msg.role === 'user' && (
                  <Avatar
                    icon={<UserOutlined />}
                    size="small"
                    style={{ background: colorPrimary, flexShrink: 0 }}
                  />
                )}
              </div>
            );
          })
        )}

        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Avatar
              icon={<RobotOutlined />}
              size="small"
              style={{ background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)' }}
            />
            <div style={{
              padding: '10px 14px',
              borderRadius: '16px 16px 16px 4px',
              background: colorBgTextHover,
            }}>
              <Spin size="small" /> <Text type="secondary">正在思考...</Text>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div style={{
        padding: '12px 20px',
        borderTop: `1px solid ${colorBorder}`,
      }}>
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="描述你的旅行计划，例如：我想去日本东京玩5天..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            style={{ resize: 'none' }}
            disabled={loading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            disabled={!inputValue.trim()}
          >
            发送
          </Button>
        </Space.Compact>
        <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
          按 Enter 发送，Shift + Enter 换行
        </Text>
      </div>
    </div>
  );
};

export default TravelAIChat;
