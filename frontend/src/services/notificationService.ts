import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

// 检查是否在 Tauri 环境中运行
const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

// 请求通知权限
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!isTauri()) {
    console.log('Not running in Tauri environment, notifications disabled');
    return false;
  }

  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === 'granted';
    }
    return granted;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return false;
  }
};

// 发送通知
export const notify = async (title: string, body: string): Promise<void> => {
  if (!isTauri()) {
    console.log('Notification (web fallback):', title, body);
    return;
  }

  try {
    const granted = await requestNotificationPermission();
    if (granted) {
      sendNotification({ title, body });
    }
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
};

// 已提醒的事件ID集合，避免重复提醒
const notifiedEvents = new Set<number>();

// 检查并发送即将开始的事件提醒
export const checkEventReminders = async (
  events: Array<{
    id: number;
    title: string;
    start_time: string;
  }>,
  reminderMinutes: number = 5
): Promise<void> => {
  const now = new Date();

  for (const event of events) {
    // 跳过已提醒的事件
    if (notifiedEvents.has(event.id)) {
      continue;
    }

    const eventStart = new Date(event.start_time);
    const diffMs = eventStart.getTime() - now.getTime();
    const diffMinutes = diffMs / (1000 * 60);

    // 如果事件在指定分钟内开始（且还未开始）
    if (diffMinutes > 0 && diffMinutes <= reminderMinutes) {
      await notify(
        'Helix 日程提醒',
        `「${event.title}」将在${Math.ceil(diffMinutes)}分钟后开始`
      );
      notifiedEvents.add(event.id);
    }
  }
};

// 清除已过期事件的提醒记录（每天凌晨清理）
export const clearExpiredReminders = (
  events: Array<{ id: number; start_time: string }>
): void => {
  const now = new Date();
  const eventIds = new Set(events.map(e => e.id));

  // 移除不在当前事件列表中的已提醒ID
  for (const id of notifiedEvents) {
    if (!eventIds.has(id)) {
      notifiedEvents.delete(id);
    }
  }

  // 移除已过去24小时的事件提醒记录
  for (const event of events) {
    const eventStart = new Date(event.start_time);
    const diffMs = now.getTime() - eventStart.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours > 24) {
      notifiedEvents.delete(event.id);
    }
  }
};
