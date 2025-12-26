import React, { useEffect, useState, useCallback } from 'react';
import { BaseLayout } from '../components/layout/BaseLayout';
import { calendarApi } from '../services/api';
import { checkEventReminders, requestNotificationPermission, clearExpiredReminders } from '../services/notificationService';
import type { CalendarEvent } from '../types';
import WeekView from '../components/WeekView';
import {
  Calendar as AntCalendar,
  Badge,
  Modal,
  Form,
  Input,
  DatePicker,
  Checkbox,
  Button,
  message as antMessage,
  Card,
  Popconfirm,
  Drawer,
  Typography,
  Space,
  Tag,
  Spin,
  Segmented,
  Select,
  theme,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ClockCircleOutlined, UserOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

// 直接解析时间，后端存储的已经是本地时间
const toLocalTime = (time: string) => dayjs(time);

const { TextArea } = Input;
const { Text } = Typography;

type ViewMode = 'month' | 'week' | 'year';

const Calendar: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [form] = Form.useForm();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  // Drawer state for viewing events on a specific day
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>([]);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await calendarApi.getEvents(
        selectedDate.year(),
        selectedDate.month() + 1
      );
      setEvents(response.data.events || []);
    } catch (error) {
      console.error('Failed to load events:', error);
      antMessage.error('加载日程失败');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // 事件提醒功能
  useEffect(() => {
    // 请求通知权限
    requestNotificationPermission();

    // 每分钟检查即将开始的事件
    const checkReminders = () => {
      if (events.length > 0) {
        checkEventReminders(events, 5); // 5分钟提前提醒
        clearExpiredReminders(events);
      }
    };

    // 立即检查一次
    checkReminders();

    // 设置定时器每分钟检查
    const interval = setInterval(checkReminders, 60000);

    return () => clearInterval(interval);
  }, [events]);

  const handleSubmit = async (values: { title: string; description?: string; timeRange: [Dayjs, Dayjs]; shared: boolean }) => {
    try {
      const eventData = {
        title: values.title,
        description: values.description,
        start_time: values.timeRange[0].format('YYYY-MM-DD HH:mm:ss'),
        end_time: values.timeRange[1].format('YYYY-MM-DD HH:mm:ss'),
        shared: values.shared,
      };

      await calendarApi.createEvent(eventData);
      setIsModalOpen(false);
      form.resetFields();
      antMessage.success('日程添加成功');
      loadEvents();
    } catch (error) {
      console.error('Failed to create event:', error);
      antMessage.error('添加失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await calendarApi.deleteEvent(id);
      antMessage.success('日程删除成功');
      loadEvents();
      // If drawer is open, remove from drawer list too
      setSelectedDayEvents(prev => prev.filter(e => e.id !== id));
    } catch (error) {
      console.error('Failed to delete event:', error);
      antMessage.error('删除失败');
    }
  };

  const dateCellRender = (value: Dayjs) => {
    const dayEvents = events.filter(event =>
      toLocalTime(event.start_time).format('YYYY-MM-DD') === value.format('YYYY-MM-DD')
    );

    return (
      <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
        {dayEvents.map(event => (
          <li key={event.id}>
            <Badge status={event.shared ? 'success' : 'processing'} text={event.title} />
          </li>
        ))}
      </ul>
    );
  };

  const onSelect = (newValue: Dayjs) => {
    setSelectedDate(newValue);
    const dayEvents = events.filter(event =>
      toLocalTime(event.start_time).format('YYYY-MM-DD') === newValue.format('YYYY-MM-DD')
    );
    if (dayEvents.length > 0) {
      setSelectedDayEvents(dayEvents);
      setDrawerOpen(true);
    }
  };

  const onPanelChange = (newValue: Dayjs) => {
    setSelectedDate(newValue);
  };

  const openAddModal = () => {
    form.setFieldsValue({
      timeRange: [selectedDate.hour(9).minute(0), selectedDate.hour(10).minute(0)],
      shared: false
    });
    setIsModalOpen(true);
  };

  // 周视图导航
  const goToPrevWeek = () => {
    setSelectedDate(prev => prev.subtract(7, 'day'));
  };

  const goToNextWeek = () => {
    setSelectedDate(prev => prev.add(7, 'day'));
  };

  const goToToday = () => {
    setSelectedDate(dayjs());
  };

  // 获取当前周的范围文本
  const getWeekRangeText = () => {
    const day = selectedDate.day();
    const diff = day === 0 ? 6 : day - 1;
    const weekStart = selectedDate.subtract(diff, 'day');
    const weekEnd = weekStart.add(6, 'day');

    if (weekStart.month() === weekEnd.month()) {
      return `${weekStart.format('YYYY年M月D日')} - ${weekEnd.format('D日')}`;
    } else if (weekStart.year() === weekEnd.year()) {
      return `${weekStart.format('M月D日')} - ${weekEnd.format('M月D日')}`;
    } else {
      return `${weekStart.format('YYYY年M月D日')} - ${weekEnd.format('YYYY年M月D日')}`;
    }
  };

  const getTitle = () => {
    if (viewMode === 'month') {
      return selectedDate.format('YYYY年M月');
    } else if (viewMode === 'week') {
      return getWeekRangeText();
    } else {
      return selectedDate.format('YYYY年');
    }
  };

  if (loading) {
    return (
      <BaseLayout title={getTitle()}>
        <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin size="large" />
        </div>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout
      title={getTitle()}
      headerActions={
        <Space>
          {viewMode === 'week' && (
            <>
              <Button icon={<LeftOutlined />} onClick={goToPrevWeek} />
              <Button onClick={goToToday}>今天</Button>
              <Button icon={<RightOutlined />} onClick={goToNextWeek} />
            </>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
            添加日程
          </Button>
        </Space>
      }
    >
      {/* 月视图 / 年视图 */}
      {(viewMode === 'month' || viewMode === 'year') && (
        <div style={{ background: colorBgContainer, padding: 24, borderRadius: 8 }}>
          <AntCalendar
            value={selectedDate}
            onSelect={onSelect}
            onPanelChange={onPanelChange}
            cellRender={dateCellRender}
            mode={viewMode === 'year' ? 'year' : 'month'}
            headerRender={({ value, onChange }) => {
              const year = value.year();
              const month = value.month();
              const years = [];
              for (let i = year - 10; i <= year + 10; i++) {
                years.push(i);
              }
              const months = [];
              for (let i = 0; i < 12; i++) {
                months.push(i);
              }

              return (
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 0', gap: 8 }}>
                  <Select
                    value={year}
                    onChange={(newYear) => {
                      const newDate = value.year(newYear);
                      onChange(newDate);
                    }}
                    style={{ width: 80 }}
                    options={years.map(y => ({ value: y, label: y }))}
                  />
                  <Select
                    value={month}
                    onChange={(newMonth) => {
                      const newDate = value.month(newMonth);
                      onChange(newDate);
                    }}
                    style={{ width: 80 }}
                    options={months.map(m => ({ value: m, label: `${m + 1}月` }))}
                  />
                  <Segmented
                    options={[
                      { label: '周', value: 'week' },
                      { label: '月', value: 'month' },
                      { label: '年', value: 'year' },
                    ]}
                    value={viewMode}
                    onChange={(val) => setViewMode(val as ViewMode)}
                  />
                </div>
              );
            }}
          />
        </div>
      )}

      {/* 周视图 */}
      {viewMode === 'week' && (
        <>
          <div style={{ background: colorBgContainer, padding: '8px 24px', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Select
              value={selectedDate.year()}
              onChange={(newYear) => setSelectedDate(prev => prev.year(newYear))}
              style={{ width: 80 }}
              options={Array.from({ length: 21 }, (_, i) => selectedDate.year() - 10 + i).map(y => ({ value: y, label: y }))}
            />
            <Select
              value={selectedDate.month()}
              onChange={(newMonth) => setSelectedDate(prev => prev.month(newMonth))}
              style={{ width: 80 }}
              options={Array.from({ length: 12 }, (_, i) => ({ value: i, label: `${i + 1}月` }))}
            />
            <Segmented
              options={[
                { label: '周', value: 'week' },
                { label: '月', value: 'month' },
                { label: '年', value: 'year' },
              ]}
              value={viewMode}
              onChange={(val) => setViewMode(val as ViewMode)}
            />
          </div>
          <WeekView
          currentDate={selectedDate}
          events={events}
          onEventClick={(event) => {
            setSelectedDayEvents([event]);
            setDrawerOpen(true);
          }}
          onEventDelete={handleDelete}
          onDateClick={(date) => {
            setSelectedDate(date);
            const dayEvents = events.filter(e =>
              toLocalTime(e.start_time).format('YYYY-MM-DD') === date.format('YYYY-MM-DD')
            );
            if (dayEvents.length > 0) {
              setSelectedDayEvents(dayEvents);
              setDrawerOpen(true);
            }
          }}
        />
        </>
      )}

      {/* Add Event Modal */}
      <Modal
        title="添加日程"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="日程标题" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={2} placeholder="详细描述（可选）" />
          </Form.Item>

          <Form.Item
            name="timeRange"
            label="时间"
            rules={[{ required: true, message: '请选择时间' }]}
          >
            <DatePicker.RangePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="shared"
            valuePropName="checked"
          >
            <Checkbox>共享给对方</Checkbox>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                添加
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Day Details Drawer */}
      <Drawer
        title={selectedDate.format('YYYY年M月D日') + ' 的日程'}
        placement="right"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        width={400}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {selectedDayEvents.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', marginTop: 40 }}>
              暂无日程
            </div>
          ) : (
            selectedDayEvents.map(event => (
              <Card
                key={event.id}
                size="small"
                title={
                  <Space>
                    <Badge status={event.shared ? 'success' : 'processing'} />
                    <Text strong>{event.title}</Text>
                  </Space>
                }
                extra={
                  <Popconfirm
                    title="确定删除这个日程吗?"
                    onConfirm={() => handleDelete(event.id)}
                    okText="是"
                    cancelText="否"
                  >
                    <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                  </Popconfirm>
                }
              >
                {event.description && (
                  <div style={{ marginBottom: 8, color: '#666' }}>{event.description}</div>
                )}
                <Space direction="vertical" size={4} style={{ fontSize: 12, color: '#888' }}>
                  <Space>
                    <ClockCircleOutlined />
                    {toLocalTime(event.start_time).format('HH:mm')} - {toLocalTime(event.end_time).format('HH:mm')}
                  </Space>
                  {event.shared && (
                    <Space>
                      <UserOutlined />
                      <Tag color="green" style={{ margin: 0 }}>已共享</Tag>
                    </Space>
                  )}
                </Space>
              </Card>
            ))
          )}
          <Button block type="dashed" icon={<PlusOutlined />} onClick={openAddModal}>
            添加新日程
          </Button>
        </Space>
      </Drawer>
    </BaseLayout>
  );
};

export default Calendar;
