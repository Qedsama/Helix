import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BaseLayout } from '../components/layout/BaseLayout';
import { pokerApi, authApi } from '../services/api';
import type { PokerGame } from '../types';
import {
  Card,
  Button,
  Form,
  Select,
  InputNumber,
  List,
  Tag,
  Typography,
  Row,
  Col,
  Empty,
  Spin,
  message as antMessage,
  Switch
} from 'antd';
import {
  PlayCircleOutlined,
  RightOutlined,
  TrophyOutlined,
  UserOutlined,
  DollarOutlined,
  TeamOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface User {
  id: number;
  username: string;
}

const Poker: React.FC = () => {
  const [recentGames, setRecentGames] = useState<PokerGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [enableSecondPlayer, setEnableSecondPlayer] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const navigate = useNavigate();

  const [config, setConfig] = useState({
    ai_difficulty: 'medium',
    small_blind: 10,
    big_blind: 20,
    buy_in: 1000,
    ai_player_count: 7,
    second_user_id: undefined as number | undefined,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [gamesRes, usersRes, authRes] = await Promise.all([
          pokerApi.getRecentGames(),
          authApi.getUsers(),
          authApi.checkAuth()
        ]);
        setRecentGames(gamesRes.data.games || []);
        setUsers(usersRes.data.users || []);
        if (authRes.data.authenticated && authRes.data.user) {
          setCurrentUserId(authRes.data.user.id);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // 当启用双人模式时，自动设置AI数量和第二个玩家
  useEffect(() => {
    if (enableSecondPlayer && currentUserId && users.length > 1) {
      // 找到另一个用户
      const otherUser = users.find(u => u.id !== currentUserId);
      if (otherUser) {
        setConfig(prev => ({
          ...prev,
          ai_player_count: 6,
          second_user_id: otherUser.id
        }));
      }
    } else {
      setConfig(prev => ({
        ...prev,
        ai_player_count: 7,
        second_user_id: undefined
      }));
    }
  }, [enableSecondPlayer, currentUserId, users]);

  const handleCreateGame = async () => {
    setCreating(true);
    try {
      const response = await pokerApi.createGame(config);
      if (response.data.success) {
        navigate(`/poker/game/${response.data.game_id}`);
      }
    } catch (error) {
      console.error('Failed to create game:', error);
      antMessage.error('创建游戏失败');
    } finally {
      setCreating(false);
    }
  };

  const onValuesChange = (_: any, allValues: any) => {
      setConfig(allValues);
  };

  if (loading) {
    return (
      <BaseLayout title="德州扑克">
        <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin size="large" />
        </div>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout
      title="德州扑克"
      subtitle="与AI对战, 提升扑克技巧"
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Row gutter={24}>
          {/* Create Game */}
          <Col xs={24} lg={8}>
             <Card 
                title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><PlayCircleOutlined /> 创建新游戏</span>} 
                bordered={false}
                style={{ marginBottom: 24, borderRadius: 8 }}
             >
                <Form
                    layout="vertical"
                    initialValues={config}
                    onValuesChange={onValuesChange}
                >
                    <Form.Item label="AI难度" name="ai_difficulty">
                        <Select>
                            <Option value="easy">简单</Option>
                            <Option value="medium">中等</Option>
                            <Option value="hard">困难</Option>
                        </Select>
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="小盲注" name="small_blind">
                                <InputNumber style={{ width: '100%' }} min={1} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="大盲注" name="big_blind">
                                <InputNumber style={{ width: '100%' }} min={2} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item label="买入金额" name="buy_in">
                        <InputNumber
                            style={{ width: '100%' }}
                            min={100}
                            step={100}
                            prefix="¥"
                        />
                    </Form.Item>

                    <Form.Item label={
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TeamOutlined /> 双人模式
                      </span>
                    }>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Switch
                          checked={enableSecondPlayer}
                          onChange={(checked) => setEnableSecondPlayer(checked)}
                        />
                        <Text type="secondary">
                          {enableSecondPlayer
                            ? `与 ${users.find(u => u.id !== currentUserId)?.username || '另一位玩家'} 一起游戏 (6个AI)`
                            : '单人模式 (7个AI)'}
                        </Text>
                      </div>
                    </Form.Item>

                    <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
                        <Button 
                            type="primary" 
                            block 
                            size="large"
                            onClick={handleCreateGame}
                            loading={creating}
                            icon={<PlayCircleOutlined />}
                            style={{ background: '#52c41a', borderColor: '#52c41a' }}
                        >
                            开始游戏
                        </Button>
                    </Form.Item>
                </Form>
             </Card>
          </Col>

          {/* Recent Games & Rules */}
          <Col xs={24} lg={16}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Recent Games */}
                <Card title="最近的游戏" bordered={false} style={{ borderRadius: 8 }}>
                    <List
                        dataSource={recentGames}
                        renderItem={(game) => (
                            <List.Item
                                actions={[
                                    (game.status === 'waiting' || game.status === 'playing') ? (
                                        <Button 
                                            type="primary" 
                                            ghost 
                                            size="small"
                                            onClick={() => navigate(`/poker/game/${game.id}`)}
                                        >
                                            继续 <RightOutlined />
                                        </Button>
                                    ) : (
                                        <Tag>已结束</Tag>
                                    )
                                ]}
                            >
                                <List.Item.Meta
                                    avatar={
                                        <div style={{ 
                                            width: 40, 
                                            height: 40, 
                                            background: '#f0f5ff', 
                                            borderRadius: 8, 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            color: '#1890ff'
                                        }}>
                                            <TrophyOutlined style={{ fontSize: 20 }} />
                                        </div>
                                    }
                                    title={`游戏 #${game.id}`}
                                    description={
                                        <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                                            <span><DollarOutlined /> 盲注: {game.small_blind}/{game.big_blind}</span>
                                            <span><UserOutlined /> 难度: {game.ai_difficulty === 'easy' ? '简单' : game.ai_difficulty === 'medium' ? '中等' : '困难'}</span>
                                        </div>
                                    }
                                />
                            </List.Item>
                        )}
                        locale={{ emptyText: <Empty description="还没有游戏记录，创建一个新游戏开始吧！" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                    />
                </Card>

                {/* Rules */}
                <Card title="游戏规则" bordered={false} style={{ borderRadius: 8 }}>
                    <Typography>
                        <Title level={5}>无限注德州扑克</Title>
                        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                            <li><Text strong>牌组:</Text> 标准52张扑克牌</li>
                            <li><Text strong>玩法:</Text> 每个玩家发2张底牌, 翻牌3张公共牌, 转牌1张, 河牌1张</li>
                            <li><Text strong>下注轮:</Text> 翻牌前、翻牌、转牌、河牌</li>
                            <li><Text strong>牌型大小:</Text> 皇家同花顺 &gt; 同花顺 &gt; 四条 &gt; 葫芦 &gt; 同花 &gt; 顺子 &gt; 三条 &gt; 两对 &gt; 一对 &gt; 高牌</li>
                            <li><Text strong>可用操作:</Text> 弃牌、跟注/过牌、加注、全下(All-in)</li>
                        </ul>
                        <div style={{ 
                            padding: 16, 
                            background: '#e6f7ff', 
                            border: '1px solid #91d5ff', 
                            borderRadius: 8,
                            marginTop: 16
                        }}>
                            <Text strong style={{ color: '#1890ff' }}>[单人练习模式]</Text>
                            <Paragraph style={{ margin: 0, marginTop: 4, color: '#0050b3' }}>
                                单人对战多个AI玩家, 无需等待其他玩家, 随时可以开始练习!
                            </Paragraph>
                        </div>
                    </Typography>
                </Card>
            </div>
          </Col>
        </Row>
      </div>
    </BaseLayout>
  );
};

export default Poker;
