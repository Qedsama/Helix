import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BaseLayout } from '../components/layout/BaseLayout';
import { pokerApi } from '../services/api';
import type { PokerState } from '../types';
import {
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Spin,
  message as antMessage,
  Avatar,
  Slider,
  InputNumber
} from 'antd';
import {
  UserOutlined,
  RobotOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  TrophyOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

// 扑克牌显示组件
const PokerCard: React.FC<{ card: string }> = ({ card }) => {
  if (card === '??' || !card) {
    return (
      <div style={{
        width: 50,
        height: 70,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        ?
      </div>
    );
  }

  // 解析牌面，格式如 "Ah" "Ks" "Td" "2c"
  const rank = card.slice(0, -1);
  const suit = card.slice(-1).toLowerCase();

  const suitSymbols: Record<string, string> = {
    'h': '\u2665', // 红心
    'd': '\u2666', // 方块
    'c': '\u2663', // 梅花
    's': '\u2660', // 黑桃
  };

  const isRed = suit === 'h' || suit === 'd';

  return (
    <div style={{
      width: 50,
      height: 70,
      background: '#fff',
      borderRadius: 6,
      border: '1px solid #d9d9d9',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: isRed ? '#cf1322' : '#000',
      fontWeight: 'bold',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{ fontSize: 18, lineHeight: 1 }}>{rank}</div>
      <div style={{ fontSize: 20, lineHeight: 1 }}>{suitSymbols[suit] || suit}</div>
    </div>
  );
};

// 手牌显示
const HandDisplay: React.FC<{ hand: string }> = ({ hand }) => {
  if (!hand) return null;
  const cards = hand.split(' ').filter(c => c);
  return (
    <Space size={4}>
      {cards.map((card, i) => (
        <PokerCard key={i} card={card} />
      ))}
    </Space>
  );
};

const PokerGame: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<PokerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState<number>(0);
  const [aiThinkingTime, setAiThinkingTime] = useState<number>(0);

  const loadGameState = useCallback(async () => {
    if (!gameId) return;
    try {
      const response = await pokerApi.getGameState(parseInt(gameId));
      if (response.data.error) {
        antMessage.error(response.data.error);
        navigate('/poker');
        return;
      }
      setGameState(response.data);
    } catch (error) {
      console.error('Failed to load game state:', error);
      antMessage.error('加载游戏状态失败');
    } finally {
      setLoading(false);
    }
  }, [gameId, navigate]);

  useEffect(() => {
    loadGameState();
  }, [loadGameState]);

  // AI 自动行动 - 使用 current_player 作为依赖，确保每个 AI 都能行动
  useEffect(() => {
    if (!gameState || !gameState.pending_ai_action || gameState.is_hand_over) {
      setAiThinkingTime(0);
      return;
    }

    // 开始2秒倒计时
    setAiThinkingTime(2);
    const countdownInterval = setInterval(() => {
      setAiThinkingTime(prev => Math.max(0, prev - 0.1));
    }, 100);

    const timer = setTimeout(async () => {
      clearInterval(countdownInterval);
      try {
        const response = await pokerApi.aiAction(parseInt(gameId!));
        if (response.data.game_state) {
          if (response.data.game_state.no_action) {
            loadGameState();
          } else {
            setGameState(response.data.game_state);
          }
        } else {
          loadGameState();
        }
      } catch (error) {
        console.error('AI action failed:', error);
        loadGameState();
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearInterval(countdownInterval);
    };
  }, [gameState?.current_player, gameState?.pending_ai_action, gameState?.is_hand_over, gameId, loadGameState]);

  // 初始化加注金额
  useEffect(() => {
    if (gameState && gameState.min_raise > 0) {
      setRaiseAmount(gameState.min_raise);
    }
  }, [gameState?.min_raise]);

  const handleAction = async (action: number, amount?: number) => {
    if (!gameId || actionLoading) return;
    setActionLoading(true);
    try {
      const response = await pokerApi.makeAction(parseInt(gameId), action, amount);
      if (response.data.game_state?.error) {
        antMessage.error(response.data.game_state.error);
      } else if (response.data.game_state) {
        setGameState(response.data.game_state);
      }
    } catch (error) {
      console.error('Action failed:', error);
      antMessage.error('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNewHand = async () => {
    if (!gameId) return;
    try {
      const response = await pokerApi.newHand(parseInt(gameId));
      if (response.data.game_state) {
        setGameState(response.data.game_state);
      }
    } catch (error) {
      console.error('New hand failed:', error);
      antMessage.error('开始新手牌失败');
    }
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

  if (!gameState) {
    return (
      <BaseLayout title="德州扑克">
        <div style={{ textAlign: 'center', marginTop: 100 }}>
          <Text>游戏不存在</Text>
          <br />
          <Button type="primary" onClick={() => navigate('/poker')}>返回大厅</Button>
        </div>
      </BaseLayout>
    );
  }

  const isMyTurn = gameState.my_position !== null && gameState.current_player === gameState.my_position && !gameState.is_hand_over;

  return (
    <BaseLayout
      title={`第 ${gameState.hand_number} 手`}
      subtitle={`${gameState.round} | 底池: ${gameState.pot}`}
      headerActions={
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/poker')}>
          返回大厅
        </Button>
      }
    >
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* 公共牌区域 */}
        <Card bordered={false} style={{ marginBottom: 16, textAlign: 'center' }}>
          <div style={{ marginBottom: 16 }}>
            <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>{gameState.round}</Tag>
            <Tag color="gold" style={{ fontSize: 14, padding: '4px 12px' }}>底池: {gameState.pot}</Tag>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, minHeight: 70 }}>
            {gameState.public_cards ? (
              <HandDisplay hand={gameState.public_cards} />
            ) : (
              <Text type="secondary">等待发牌...</Text>
            )}
          </div>

          {gameState.last_action && (
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                {gameState.players[gameState.last_action.player]?.name}: {gameState.last_action.action_name}
              </Text>
            </div>
          )}
        </Card>

        {/* 玩家列表 */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {gameState.players.map((player) => {
            const isDealer = player.position === gameState.dealer_position;
            const isSB = player.position === gameState.sb_position;
            const isBB = player.position === gameState.bb_position;
            const isCurrent = player.position === gameState.current_player;
            const isMe = player.position === gameState.my_position;
            const isFolded = !player.is_active;

            return (
              <Col xs={12} sm={8} md={6} key={player.id}>
                <Card
                  size="small"
                  style={{
                    background: isFolded ? '#f5f5f5' : (isCurrent ? '#e6f7ff' : (isMe ? '#f6ffed' : '#fff')),
                    border: isCurrent ? '2px solid #1890ff' : '1px solid #d9d9d9',
                    opacity: isFolded ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Avatar
                      size="small"
                      icon={player.is_ai ? <RobotOutlined /> : <UserOutlined />}
                      style={{ background: isFolded ? '#999' : (isMe ? '#52c41a' : (player.is_ai ? '#1890ff' : '#faad14')) }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong ellipsis style={{ display: 'block', color: isFolded ? '#999' : undefined }}>{player.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{player.chips} 筹码</Text>
                    </div>
                    <Space size={2}>
                      {isFolded && <Tag color="default">已弃牌</Tag>}
                      {isDealer && !isFolded && <Tag color="orange">D</Tag>}
                      {isSB && !isFolded && <Tag color="blue">SB</Tag>}
                      {isBB && !isFolded && <Tag color="purple">BB</Tag>}
                    </Space>
                  </div>

                  {/* 手牌 */}
                  <div style={{ minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isFolded ? (
                      <Text type="secondary" style={{ fontSize: 12 }}>已弃牌</Text>
                    ) : player.hand && player.hand !== '??' ? (
                      <HandDisplay hand={player.hand} />
                    ) : (
                      <Space size={4}>
                        <PokerCard card="??" />
                        <PokerCard card="??" />
                      </Space>
                    )}
                  </div>

                  {/* 思考中提示 */}
                  {isCurrent && player.is_ai && aiThinkingTime > 0 && (
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                      <Tag color="processing">思考中 {aiThinkingTime.toFixed(1)}s</Tag>
                    </div>
                  )}

                  {player.current_bet > 0 && !isFolded && (
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                      <Tag color="red">下注: {player.current_bet}</Tag>
                    </div>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>

        {/* 操作按钮区域 */}
        <Card bordered={false}>
          {gameState.is_hand_over ? (
            <div style={{ textAlign: 'center' }}>
              {gameState.winner_info && (
                <div style={{ marginBottom: 16 }}>
                  <TrophyOutlined style={{ fontSize: 32, color: '#faad14' }} />
                  <Title level={4} style={{ margin: '8px 0' }}>
                    {gameState.winner_info.winner_name} 赢得 {gameState.winner_info.pot_won} 筹码!
                  </Title>
                </div>
              )}

              {gameState.is_game_over ? (
                <Button type="primary" size="large" onClick={() => navigate('/poker')}>
                  游戏结束 - 返回大厅
                </Button>
              ) : (
                <Button type="primary" size="large" icon={<ReloadOutlined />} onClick={handleNewHand}>
                  开始下一手
                </Button>
              )}
            </div>
          ) : isMyTurn ? (
            <div style={{ textAlign: 'center' }}>
              <Text style={{ marginBottom: 12, display: 'block' }}>轮到你行动</Text>
              <Space size="middle" wrap style={{ marginBottom: gameState.legal_actions?.includes(5) ? 16 : 0 }}>
                {gameState.legal_actions?.filter(a => a !== 5).map((action) => (
                  <Button
                    key={action}
                    type={action === 4 ? 'primary' : 'default'}
                    danger={action === 0}
                    size="large"
                    onClick={() => handleAction(action)}
                    loading={actionLoading}
                    style={{ minWidth: 100 }}
                  >
                    {gameState.action_names?.[gameState.legal_actions?.indexOf(action) ?? 0] || action}
                  </Button>
                ))}
              </Space>

              {/* 自定义加注控件 */}
              {gameState.legal_actions?.includes(5) && gameState.min_raise && gameState.min_raise > 0 && (
                <div style={{ marginTop: 16, padding: '16px', background: '#f5f5f5', borderRadius: 8 }}>
                  <Text style={{ marginBottom: 8, display: 'block' }}>
                    自定义加注 (范围: {gameState.min_raise} - {gameState.max_raise})
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, maxWidth: 500, margin: '0 auto' }}>
                    <Slider
                      style={{ flex: 1 }}
                      min={gameState.min_raise}
                      max={gameState.max_raise}
                      value={raiseAmount}
                      onChange={(val) => setRaiseAmount(val)}
                      step={gameState.big_blind || 10}
                    />
                    <InputNumber
                      style={{ width: 100 }}
                      min={gameState.min_raise}
                      max={gameState.max_raise}
                      value={raiseAmount}
                      onChange={(val) => setRaiseAmount(val || gameState.min_raise)}
                    />
                    <Button
                      type="primary"
                      size="large"
                      onClick={() => handleAction(5, raiseAmount)}
                      loading={actionLoading}
                    >
                      加注 {raiseAmount}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <Spin size="small" style={{ marginRight: 8 }} />
              <Text type="secondary">
                等待 {gameState.players[gameState.current_player]?.name || 'AI'} 行动...
              </Text>
            </div>
          )}
        </Card>
      </div>
    </BaseLayout>
  );
};

export default PokerGame;
