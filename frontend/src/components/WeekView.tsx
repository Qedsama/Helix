import React from 'react';
import { Card, Popconfirm, Button, Tooltip, theme } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { CalendarEvent } from '../types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import type { Dayjs } from 'dayjs';

dayjs.extend(utc);

// 将 UTC 时间转换为本地时间 (UTC+8)
const toLocalTime = (time: string) => dayjs.utc(time).utcOffset(8);

interface WeekViewProps {
  currentDate: Dayjs;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onEventDelete?: (id: number) => void;
  onDateClick?: (date: Dayjs) => void;
}

const HOUR_HEIGHT = 48; // 每小时的高度(px)
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const WeekView: React.FC<WeekViewProps> = ({
  currentDate,
  events,
  onEventClick,
  onEventDelete,
  onDateClick,
}) => {
  const {
    token: { colorBorder, colorBorderSecondary, colorTextSecondary, colorText, colorPrimaryBg },
  } = theme.useToken();
  // 获取当前周的起始日期（周一）
  const getWeekStart = (date: Dayjs) => {
    const day = date.day();
    // 如果是周日(0)，往前6天；否则往前 day-1 天
    const diff = day === 0 ? 6 : day - 1;
    return date.subtract(diff, 'day').startOf('day');
  };

  const weekStart = getWeekStart(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));

  // 获取某天的事件
  const getEventsForDay = (day: Dayjs) => {
    return events.filter(event =>
      toLocalTime(event.start_time).format('YYYY-MM-DD') === day.format('YYYY-MM-DD')
    );
  };

  // 计算事件在时间轴上的位置和高度
  const getEventStyle = (event: CalendarEvent) => {
    const start = toLocalTime(event.start_time);
    const end = toLocalTime(event.end_time);

    const startMinutes = start.hour() * 60 + start.minute();
    const endMinutes = end.hour() * 60 + end.minute();
    const duration = Math.max(endMinutes - startMinutes, 30); // 最小30分钟高度

    const top = (startMinutes / 60) * HOUR_HEIGHT;
    const height = (duration / 60) * HOUR_HEIGHT;

    return {
      top: `${top}px`,
      height: `${Math.max(height, 24)}px`, // 最小24px
      minHeight: '24px',
    };
  };

  // 事件颜色
  const getEventColor = (event: CalendarEvent) => {
    return event.shared ? '#52c41a' : '#1890ff';
  };

  const isToday = (day: Dayjs) => {
    return day.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD');
  };

  return (
    <Card bordered={false} style={{ borderRadius: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* 头部：星期和日期 */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${colorBorder}`, paddingBottom: 8 }}>
          {/* 时间列占位 */}
          <div style={{ width: 60, flexShrink: 0 }} />

          {/* 7天的头部 */}
          {weekDays.map((day, index) => (
            <div
              key={index}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px 4px',
                cursor: 'pointer',
              }}
              onClick={() => onDateClick?.(day)}
            >
              <div style={{ fontSize: 12, color: colorTextSecondary }}>
                {['周一', '周二', '周三', '周四', '周五', '周六', '周日'][index]}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: isToday(day) ? 'bold' : 'normal',
                  color: isToday(day) ? '#1890ff' : colorText,
                  width: 36,
                  height: 36,
                  lineHeight: '36px',
                  borderRadius: '50%',
                  margin: '4px auto 0',
                  background: isToday(day) ? colorPrimaryBg : 'transparent',
                }}
              >
                {day.date()}
              </div>
            </div>
          ))}
        </div>

        {/* 时间网格 */}
        <div style={{ display: 'flex', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
          {/* 时间刻度列 */}
          <div style={{ width: 60, flexShrink: 0 }}>
            {HOURS.map(hour => (
              <div
                key={hour}
                style={{
                  height: HOUR_HEIGHT,
                  borderBottom: `1px solid ${colorBorderSecondary}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end',
                  paddingRight: 8,
                  paddingTop: 0,
                  fontSize: 12,
                  color: colorTextSecondary,
                }}
              >
                {hour.toString().padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* 7天的事件列 */}
          {weekDays.map((day, dayIndex) => {
            const dayEvents = getEventsForDay(day);

            return (
              <div
                key={dayIndex}
                style={{
                  flex: 1,
                  position: 'relative',
                  borderLeft: `1px solid ${colorBorder}`,
                  background: isToday(day) ? colorPrimaryBg : 'transparent',
                }}
              >
                {/* 小时网格线 */}
                {HOURS.map(hour => (
                  <div
                    key={hour}
                    style={{
                      height: HOUR_HEIGHT,
                      borderBottom: `1px solid ${colorBorderSecondary}`,
                    }}
                  />
                ))}

                {/* 事件块 */}
                {dayEvents.map(event => (
                  <Tooltip
                    key={event.id}
                    title={
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{event.title}</div>
                        <div>{toLocalTime(event.start_time).format('HH:mm')} - {toLocalTime(event.end_time).format('HH:mm')}</div>
                        {event.description && <div style={{ fontSize: 12 }}>{event.description}</div>}
                      </div>
                    }
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 2,
                        right: 2,
                        ...getEventStyle(event),
                        background: getEventColor(event),
                        borderRadius: 4,
                        padding: '2px 6px',
                        color: '#fff',
                        fontSize: 12,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                      onClick={() => onEventClick?.(event)}
                    >
                      <div style={{
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                      }}>
                        {event.title}
                      </div>
                      <div style={{ fontSize: 10, opacity: 0.9 }}>
                        {toLocalTime(event.start_time).format('HH:mm')}
                      </div>
                      {onEventDelete && (
                        <Popconfirm
                          title="确定删除?"
                          onConfirm={(e) => {
                            e?.stopPropagation();
                            onEventDelete(event.id);
                          }}
                          okText="是"
                          cancelText="否"
                        >
                          <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            style={{
                              position: 'absolute',
                              top: 2,
                              right: 2,
                              color: 'rgba(255,255,255,0.8)',
                              padding: 0,
                              width: 16,
                              height: 16,
                              minWidth: 16,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Popconfirm>
                      )}
                    </div>
                  </Tooltip>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

export default WeekView;
