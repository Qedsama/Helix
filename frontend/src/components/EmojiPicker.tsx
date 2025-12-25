import React from 'react';
import { Popover } from 'antd';

interface EmojiItem {
  emoji: string;
  label: string;
  type: 'badge' | 'emoji';
  color?: string;
  bg?: string;
}

// 飞书风格表情列表 - 基于 Lark emoji types
// 文字徽章使用不同颜色来区分类别
export const FEISHU_EMOJIS: EmojiItem[] = [
  // 常用快捷文字徽章 - 飞书风格
  { emoji: 'OK', label: 'OK', type: 'badge', color: '#1890ff', bg: '#e6f7ff' },
  { emoji: 'DONE', label: '完成', type: 'badge', color: '#52c41a', bg: '#f6ffed' },
  { emoji: 'GET', label: '收到', type: 'badge', color: '#fa8c16', bg: '#fff7e6' },
  { emoji: 'YES', label: '好的', type: 'badge', color: '#722ed1', bg: '#f9f0ff' },
  { emoji: 'LGTM', label: 'LGTM', type: 'badge', color: '#13c2c2', bg: '#e6fffb' },
  { emoji: '+1', label: '+1', type: 'badge', color: '#eb2f96', bg: '#fff0f6' },
  // 手势表情
  { emoji: '👍', label: '赞', type: 'emoji' },
  { emoji: '👏', label: '鼓掌', type: 'emoji' },
  { emoji: '💪', label: '加油', type: 'emoji' },
  { emoji: '🙏', label: '感谢', type: 'emoji' },
  { emoji: '🤝', label: '握手', type: 'emoji' },
  { emoji: '✌️', label: '胜利', type: 'emoji' },
  // 心形表情
  { emoji: '❤️', label: '爱心', type: 'emoji' },
  { emoji: '💕', label: '两颗心', type: 'emoji' },
  { emoji: '💯', label: '100分', type: 'emoji' },
  { emoji: '⭐', label: '星星', type: 'emoji' },
  { emoji: '🔥', label: '火', type: 'emoji' },
  { emoji: '🎉', label: '庆祝', type: 'emoji' },
  // 面部表情
  { emoji: '😄', label: '开心', type: 'emoji' },
  { emoji: '😂', label: '笑哭', type: 'emoji' },
  { emoji: '🤣', label: '狂笑', type: 'emoji' },
  { emoji: '😊', label: '微笑', type: 'emoji' },
  { emoji: '🥰', label: '喜欢', type: 'emoji' },
  { emoji: '😘', label: '飞吻', type: 'emoji' },
  { emoji: '🤔', label: '思考', type: 'emoji' },
  { emoji: '😅', label: '尴尬', type: 'emoji' },
  { emoji: '😢', label: '难过', type: 'emoji' },
  { emoji: '😭', label: '大哭', type: 'emoji' },
  { emoji: '😱', label: '惊恐', type: 'emoji' },
  { emoji: '🤯', label: '爆炸', type: 'emoji' },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  children: React.ReactNode;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, children }) => {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };

  const renderEmojiItem = (item: EmojiItem) => {
    if (item.type === 'badge') {
      return (
        <div
          key={item.emoji}
          onClick={() => handleSelect(item.emoji)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 40,
            height: 32,
            padding: '0 8px',
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: 12,
            fontWeight: 600,
            background: item.bg,
            color: item.color,
            border: `1px solid ${item.color}20`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = `0 2px 8px ${item.color}30`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          title={item.label}
        >
          {item.emoji}
        </div>
      );
    }

    return (
      <div
        key={item.emoji}
        onClick={() => handleSelect(item.emoji)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all 0.2s',
          fontSize: 24,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#f5f5f5';
          e.currentTarget.style.transform = 'scale(1.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title={item.label}
      >
        {item.emoji}
      </div>
    );
  };

  // 分组：徽章和表情符号
  const badges = FEISHU_EMOJIS.filter(e => e.type === 'badge');
  const emojis = FEISHU_EMOJIS.filter(e => e.type === 'emoji');

  const content = (
    <div style={{ width: 280 }}>
      {/* 快捷文字徽章区 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>快捷回复</div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          {badges.map(renderEmojiItem)}
        </div>
      </div>

      {/* 分隔线 */}
      <div style={{ height: 1, background: '#f0f0f0', margin: '8px 0' }} />

      {/* 表情符号区 */}
      <div>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>表情</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 4,
        }}>
          {emojis.map(renderEmojiItem)}
        </div>
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="top"
      overlayStyle={{ padding: 0 }}
      overlayInnerStyle={{ padding: 12 }}
    >
      {children}
    </Popover>
  );
};

// 导出用于在 Chat.tsx 中判断是否为文字徽章
export const isBadgeEmoji = (emoji: string): boolean => {
  return ['OK', 'DONE', 'GET', 'YES', 'LGTM', '+1'].includes(emoji);
};

// 获取徽章颜色配置
export const getBadgeStyle = (emoji: string): { color: string; bg: string } | null => {
  const item = FEISHU_EMOJIS.find(e => e.emoji === emoji && e.type === 'badge');
  if (item && item.color && item.bg) {
    return { color: item.color, bg: item.bg };
  }
  return null;
};

export default EmojiPicker;
