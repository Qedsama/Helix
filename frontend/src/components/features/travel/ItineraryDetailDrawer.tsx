import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Space,
  Typography,
  Tag,
  Rate,
  Input,
  InputNumber,
  Button,
  Upload,
  Image,
  Divider,
  message as antMessage,
  Popconfirm,
  Card,
  Switch,
  theme,
} from 'antd';
import {
  EnvironmentOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  CameraOutlined,
  DeleteOutlined,
  CarOutlined,
  CheckCircleOutlined,
  EditOutlined,
  SaveOutlined,
  SwapOutlined,
  BankOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { travelApi, API_BASE_URL } from '../../../services/api';
import type { TravelItinerary } from '../../../types';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

// 行程类型配置
const categoryConfig: Record<string, { color: string; label: string }> = {
  attraction: { color: '#1890ff', label: '景点' },
  food: { color: '#fa8c16', label: '餐饮' },
  transport: { color: '#52c41a', label: '交通' },
  hotel: { color: '#13c2c2', label: '酒店' },
};

const getCategoryConfig = (category: string) =>
  categoryConfig[category] || { color: '#8c8c8c', label: category };

interface ItineraryDetailDrawerProps {
  item: TravelItinerary | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
  routeInfo?: {
    driving?: { distance: number; duration: number; toll: number };
    transit?: { distance: number; duration: number };
  };
}

const ItineraryDetailDrawer: React.FC<ItineraryDetailDrawerProps> = ({
  item,
  open,
  onClose,
  onUpdate,
  routeInfo,
}) => {
  const [editing, setEditing] = useState(false);
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(0);
  const [actualCost, setActualCost] = useState<number | null>(null);
  const [visited, setVisited] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  theme.useToken(); // keep theme hook active

  // 初始化表单数据
  useEffect(() => {
    if (item) {
      setReview(item.review || '');
      setRating(item.rating || 0);
      setActualCost(item.actual_cost || null);
      setVisited(item.visited || false);
    }
  }, [item]);

  if (!item) return null;

  const config = getCategoryConfig(item.category);

  // 保存感受
  const handleSaveReview = async () => {
    setSaving(true);
    try {
      await travelApi.addReview(item.id, {
        review,
        rating: rating || undefined,
        actual_cost: actualCost || undefined,
        visited,
      });
      antMessage.success('保存成功');
      setEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Save review error:', error);
      antMessage.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 上传照片
  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file as File);
      
      const response = await travelApi.uploadItineraryPhoto(item.id, formData);
      
      if (response.data.success) {
        antMessage.success('上传成功');
        onSuccess?.(response.data);
        onUpdate();
      } else {
        throw new Error(response.data.error);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      antMessage.error(error.message || '上传失败');
      onError?.(error);
    } finally {
      setUploading(false);
    }
  };

  // 删除照片
  const handleDeletePhoto = async (filename: string) => {
    try {
      await travelApi.deleteItineraryPhoto(item.id, filename);
      antMessage.success('删除成功');
      onUpdate();
    } catch (error) {
      console.error('Delete photo error:', error);
      antMessage.error('删除失败');
    }
  };

  // 格式化时长
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`;
  };

  // 格式化距离
  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${meters}米`;
    return `${(meters / 1000).toFixed(1)}公里`;
  };

  return (
    <Drawer
      title={
        <Space>
          <Tag color={config.color}>{config.label}</Tag>
          <span>{item.title}</span>
          {item.visited && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
        </Space>
      }
      open={open}
      onClose={onClose}
      width={480}
      extra={
        editing ? (
          <Space>
            <Button onClick={() => setEditing(false)}>取消</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveReview} loading={saving}>
              保存
            </Button>
          </Space>
        ) : (
          <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
            编辑感受
          </Button>
        )
      }
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* 基本信息 */}
        <Card size="small">
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {/* 交通类型：显示起终点 */}
            {item.category === 'transport' && item.from_location_name && (
              <Text>
                <SwapOutlined style={{ color: '#52c41a' }} /> {item.from_location_name} → {item.location_name || item.title}
                {item.departure_datetime && item.arrival_datetime && (
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {new Date(item.departure_datetime).toLocaleString()} - {new Date(item.arrival_datetime).toLocaleString()}
                  </Text>
                )}
              </Text>
            )}
            {/* 酒店类型：显示入住退房 */}
            {item.category === 'hotel' && item.check_in_day && item.check_out_day && (
              <Text>
                <BankOutlined style={{ color: '#13c2c2' }} /> Day {item.check_in_day} 入住 - Day {item.check_out_day} 退房
              </Text>
            )}
            {item.location_address && (
              <Text type="secondary">
                <EnvironmentOutlined /> {item.location_address}
              </Text>
            )}
            {item.start_time && (
              <Text type="secondary">
                <ClockCircleOutlined /> {item.start_time}
                {item.end_time && ` - ${item.end_time}`}
                {item.duration_minutes && ` (约${item.duration_minutes}分钟)`}
              </Text>
            )}
            {item.cost !== undefined && item.cost > 0 && (
              <Text type="secondary">
                <DollarOutlined /> 预计费用: {item.cost.toLocaleString()}元
              </Text>
            )}
          </Space>
        </Card>

        {/* AI建议/描述 */}
        {item.description && (
          <>
            <Divider style={{ margin: '8px 0' }}>这里可以</Divider>
            <Paragraph style={{ background: '#f6f8fa', padding: 12, borderRadius: 8, margin: 0 }}>
              {item.description}
            </Paragraph>
          </>
        )}

        {/* 通勤信息 */}
        {routeInfo && (routeInfo.driving || routeInfo.transit) && (
          <>
            <Divider style={{ margin: '8px 0' }}>到达方式</Divider>
            <Card size="small">
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {routeInfo.driving && (
                  <Space>
                    <CarOutlined style={{ color: '#1890ff' }} />
                    <Text>打车/驾车: {formatDistance(routeInfo.driving.distance)}, 约{formatDuration(routeInfo.driving.duration)}</Text>
                    {routeInfo.driving.toll > 0 && <Tag>过路费 {routeInfo.driving.toll}元</Tag>}
                  </Space>
                )}
                {routeInfo.transit && (
                  <Space>
                    <span style={{ color: '#52c41a' }}>🚇</span>
                    <Text>公共交通: {formatDistance(routeInfo.transit.distance)}, 约{formatDuration(routeInfo.transit.duration)}</Text>
                  </Space>
                )}
              </Space>
            </Card>
          </>
        )}

        {/* 打卡状态 */}
        <Divider style={{ margin: '8px 0' }}>打卡记录</Divider>
        
        <Space>
          <Text>已打卡:</Text>
          <Switch
            checked={visited}
            onChange={setVisited}
            disabled={!editing}
            checkedChildren="是"
            unCheckedChildren="否"
          />
          {item.visited_at && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              ({new Date(item.visited_at).toLocaleString()})
            </Text>
          )}
        </Space>

        {/* 评分 */}
        <Space>
          <Text>评分:</Text>
          <Rate
            value={rating}
            onChange={setRating}
            disabled={!editing}
            allowHalf
          />
        </Space>

        {/* 实际花费 */}
        <Space>
          <Text>实际花费:</Text>
          {editing ? (
            <InputNumber
              value={actualCost}
              onChange={(v) => setActualCost(v)}
              min={0}
              addonAfter="元"
              style={{ width: 150 }}
            />
          ) : (
            <Text>{actualCost ? `${actualCost.toLocaleString()}元` : '未记录'}</Text>
          )}
        </Space>

        {/* 感受 */}
        <div>
          <Text>真实感受:</Text>
          {editing ? (
            <TextArea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="记录你的真实感受..."
              rows={4}
              style={{ marginTop: 8 }}
            />
          ) : (
            <Paragraph
              style={{
                background: review ? '#f6f8fa' : 'transparent',
                padding: review ? 12 : 0,
                borderRadius: 8,
                marginTop: 8,
                color: review ? 'inherit' : '#999',
              }}
            >
              {review || '暂无感受记录，点击编辑添加'}
            </Paragraph>
          )}
        </div>

        {/* 照片 */}
        <Divider style={{ margin: '8px 0' }}>照片记录</Divider>
        
        <div>
          {/* 已上传的照片 */}
          {item.photos && item.photos.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Image.PreviewGroup>
                <Space wrap>
                  {item.photos.map((photo, index) => (
                    <div key={index} style={{ position: 'relative' }}>
                      <Image
                        src={`${API_BASE_URL}/static/uploads/travel/${photo}`}
                        width={100}
                        height={100}
                        style={{ objectFit: 'cover', borderRadius: 8 }}
                      />
                      <Popconfirm
                        title="确定删除这张照片？"
                        onConfirm={() => handleDeletePhoto(photo)}
                      >
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            background: 'rgba(255,255,255,0.8)',
                          }}
                        />
                      </Popconfirm>
                    </div>
                  ))}
                </Space>
              </Image.PreviewGroup>
            </div>
          )}

          {/* 上传按钮 */}
          <Upload
            customRequest={handleUpload}
            showUploadList={false}
            accept="image/*"
          >
            <Button icon={<CameraOutlined />} loading={uploading}>
              上传照片
            </Button>
          </Upload>
        </div>
      </Space>
    </Drawer>
  );
};

export default ItineraryDetailDrawer;

