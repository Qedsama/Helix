import React, { forwardRef } from 'react';
import { Tag } from 'antd';
import {
  EnvironmentOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CompassOutlined,
  CoffeeOutlined,
  CarOutlined,
  BankOutlined,
  CheckCircleFilled,
  StarFilled,
  SwapOutlined,
} from '@ant-design/icons';
import type { TravelPlanDetail, TravelItinerary, CityGroup } from '../../../types';
import dayjs from 'dayjs';

// 高德地图 Web 服务 API Key（用于静态地图）
const AMAP_WEB_KEY = '4750e5ce1e64ae856ce6ba4c7e498ad7';

// 行程类型图标和颜色映射
const categoryConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  attraction: { icon: <CompassOutlined />, color: '#3b82f6', label: '景点' },
  food: { icon: <CoffeeOutlined />, color: '#f97316', label: '餐饮' },
  transport: { icon: <CarOutlined />, color: '#22c55e', label: '交通' },
  hotel: { icon: <BankOutlined />, color: '#06b6d4', label: '酒店' },
};

const getCategoryConfig = (category: string) =>
  categoryConfig[category] || { icon: <EnvironmentOutlined />, color: '#6b7280', label: category };

// 每天的主题色 - 更柔和的配色
const dayColors = ['#3b82f6', '#22c55e', '#f97316', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444'];

// 生成静态地图URL
const generateStaticMapUrl = (items: TravelItinerary[], dayColor: string): string | null => {
  const points = items
    .filter(item => item.longitude && item.latitude)
    .map(item => ({
      lng: item.longitude!,
      lat: item.latitude!,
    }));

  if (points.length === 0) return null;

  // 构建 markers 参数 - 使用数字标记
  const markers = points
    .map((p, idx) => `mid,${dayColor.replace('#', '0x')},${idx + 1}:${p.lng},${p.lat}`)
    .join('|');

  // 构建 paths 参数 - 路线
  let paths = '';
  if (points.length > 1) {
    const pathPoints = points.map(p => `${p.lng},${p.lat}`).join(';');
    paths = `&paths=6,${dayColor.replace('#', '0x')},1,,:${pathPoints}`;
  }

  return `https://restapi.amap.com/v3/staticmap?size=680*200&scale=2&markers=${markers}${paths}&key=${AMAP_WEB_KEY}`;
};

interface TravelExportCardProps {
  plan: TravelPlanDetail;
  cityGroups?: Record<number, CityGroup[]>;
}

const TravelExportCard = forwardRef<HTMLDivElement, TravelExportCardProps>(({ plan, cityGroups }, ref) => {
  const daysArray = Array.from({ length: plan.days_count }, (_, i) => i + 1);

  // 计算总费用
  const totalEstimatedCost = Object.values(plan.itinerary_by_day).flat().reduce((sum, item) => sum + (item.cost || 0), 0);
  const totalActualCost = Object.values(plan.itinerary_by_day).flat().reduce((sum, item) => sum + (item.actual_cost || 0), 0);
  const grandTotal = totalActualCost > 0 ? totalActualCost : totalEstimatedCost;

  // 渲染一组行程项的时间线
  const renderItemsTimeline = (items: TravelItinerary[], keyPrefix = '') => {
    const regularItems = items.filter(item => !item.is_hotel_injection);
    const hotelInjections = items.filter(item => item.is_hotel_injection);

    if (items.length === 0) {
      return (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0', fontSize: 14 }}>
          暂无行程安排
        </div>
      );
    }

    return (
      <div style={{ position: 'relative' }}>
        {regularItems.map((item, idx) => {
          const config = getCategoryConfig(item.category);
          const isLast = idx === regularItems.length - 1 && hotelInjections.length === 0;

          return (
            <div key={`${keyPrefix}${item.id}`} style={{ position: 'relative', paddingLeft: 32 }}>
              {!isLast && (
                <div
                  style={{
                    position: 'absolute',
                    left: 11,
                    top: 24,
                    bottom: 0,
                    width: 2,
                    background: '#e2e8f0',
                  }}
                />
              )}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 4,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: config.color,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {idx + 1}
              </div>
              {idx > 0 && item.transport_duration && item.transport_duration > 0 && (
                <div
                  style={{
                    fontSize: 11,
                    color: '#64748b',
                    marginBottom: 8,
                    padding: '4px 10px',
                    background: '#f1f5f9',
                    borderRadius: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <CarOutlined />
                  {item.transport_mode === 'transit' ? '公交' : '驾车'} {item.transport_duration}分钟
                  {item.transport_distance && (
                    <span>· {(item.transport_distance / 1000).toFixed(1)}km</span>
                  )}
                </div>
              )}
              <div
                style={{
                  background: '#f8fafc',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: isLast ? 0 : 16,
                  borderLeft: `3px solid ${config.color}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 15, color: '#1e293b' }}>{item.title}</span>
                      <Tag
                        style={{
                          margin: 0,
                          background: `${config.color}15`,
                          color: config.color,
                          border: 'none',
                          borderRadius: 4,
                          fontSize: 11,
                        }}
                      >
                        {config.label}
                      </Tag>
                      {item.visited && (
                        <span style={{ color: '#22c55e', fontSize: 12, display: 'flex', alignItems: 'center', gap: 2 }}>
                          <CheckCircleFilled /> 已打卡
                        </span>
                      )}
                      {item.rating && item.rating > 0 && (
                        <span style={{ color: '#f59e0b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 2 }}>
                          <StarFilled /> {item.rating}
                        </span>
                      )}
                    </div>
                    {item.start_time && (
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ClockCircleOutlined />
                        {item.start_time}
                        {item.end_time && ` - ${item.end_time}`}
                      </div>
                    )}
                    {item.location_address && (
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <EnvironmentOutlined />
                        {item.location_address}
                      </div>
                    )}
                    {item.description && (
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 8, lineHeight: 1.5 }}>
                        {item.description}
                      </div>
                    )}
                    {item.review && (
                      <div
                        style={{
                          fontSize: 12,
                          color: '#059669',
                          marginTop: 10,
                          padding: '10px 12px',
                          background: '#ecfdf5',
                          borderRadius: 8,
                          lineHeight: 1.5,
                          borderLeft: '3px solid #10b981',
                        }}
                      >
                        {item.review}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 70, marginLeft: 12 }}>
                    {item.actual_cost ? (
                      <div style={{ color: '#1e293b', fontWeight: 600, fontSize: 15 }}>
                        ¥{item.actual_cost.toLocaleString()}
                      </div>
                    ) : item.cost && item.cost > 0 ? (
                      <div style={{ color: '#94a3b8', fontSize: 14 }}>¥{item.cost.toLocaleString()}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {hotelInjections.map(hotel => (
          <div key={`${keyPrefix}hotel-${hotel.id}`} style={{ paddingLeft: 32, marginTop: 8 }}>
            <div
              style={{
                background: '#ecfeff',
                borderRadius: 12,
                padding: 14,
                borderLeft: '3px solid #06b6d4',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ color: '#06b6d4', fontSize: 14 }}><SwapOutlined /></span>
              <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{hotel.title}</span>
              <Tag
                style={{
                  margin: 0,
                  background: '#06b6d415',
                  color: '#06b6d4',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                Day {hotel.check_in_day}-{hotel.check_out_day} 住宿
              </Tag>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      ref={ref}
      style={{
        width: 750,
        padding: 0,
        background: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* 顶部封面区域 */}
      <div
        style={{
          background: '#1e293b',
          padding: '40px 32px 32px',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 装饰性背景图案 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 300,
            height: 300,
            background: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: 200,
            height: 200,
            background: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
            transform: 'translate(-30%, 30%)',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: '-0.5px' }}>
                {plan.title}
              </h1>
              {plan.destination && (
                <div style={{ fontSize: 16, opacity: 0.8, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <EnvironmentOutlined />
                  {plan.destination}
                </div>
              )}
            </div>
            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: '12px 16px',
                textAlign: 'center',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 700 }}>{plan.days_count}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>DAYS</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24, fontSize: 14, opacity: 0.85 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarOutlined />
              {plan.start_date} - {plan.end_date}
            </span>
          </div>

          {plan.description && (
            <div style={{ marginTop: 16, fontSize: 14, opacity: 0.7, lineHeight: 1.6, maxWidth: 500 }}>
              {plan.description}
            </div>
          )}
        </div>
      </div>

      {/* 费用概览 */}
      <div style={{ padding: '24px 32px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {totalActualCost > 0 ? '实际花费' : '预计费用'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>
              {grandTotal > 0 ? `¥${grandTotal.toLocaleString()}` : '-'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              行程项目数
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#f97316' }}>
              {Object.values(plan.itinerary_by_day).flat().length}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {/* 每日行程 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 20,
          paddingBottom: 8,
          borderBottom: '2px solid #e2e8f0',
        }}>
          <CompassOutlined style={{ color: '#f97316', fontSize: 18 }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>行程安排</span>
        </div>

        {daysArray.map((day) => {
          const dayItems = plan.itinerary_by_day[day] || [];
          const dayDate = dayjs(plan.start_date).add(day - 1, 'day');
          const dayCost = dayItems.reduce((sum, item) => sum + (item.cost || 0), 0);
          const dayActualCost = dayItems.reduce((sum, item) => sum + (item.actual_cost || 0), 0);
          const dayColor = dayColors[(day - 1) % dayColors.length];
          const dayCityGroups = cityGroups?.[day];
          const hasMultipleCities = dayCityGroups && dayCityGroups.length > 1;

          return (
            <div
              key={day}
              style={{
                marginBottom: 20,
                borderRadius: 16,
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
              }}
            >
              {/* 日期标题栏 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  background: dayColor,
                  color: 'white',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      borderRadius: 8,
                      padding: '4px 12px',
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    DAY {day}
                  </div>
                  <span style={{ fontWeight: 500, fontSize: 15 }}>{dayDate.format('M月D日')}</span>
                  <span style={{ opacity: 0.8, fontSize: 13 }}>{dayDate.format('dddd')}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                  {dayActualCost > 0 && (
                    <span>实际 ¥{dayActualCost.toLocaleString()}</span>
                  )}
                  {dayCost > 0 && !dayActualCost && (
                    <span>预计 ¥{dayCost.toLocaleString()}</span>
                  )}
                </div>
              </div>

              {hasMultipleCities ? (
                /* 多城市：每个城市分别渲染地图+行程 */
                dayCityGroups.map((group, groupIdx) => {
                  const groupMapUrl = generateStaticMapUrl(group.items, dayColor);
                  return (
                    <div key={group.cityKey}>
                      {/* 城市子标题 */}
                      <div
                        style={{
                          padding: '10px 20px',
                          background: '#f1f5f9',
                          borderBottom: '1px solid #e2e8f0',
                          borderTop: groupIdx > 0 ? '1px solid #e2e8f0' : undefined,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <EnvironmentOutlined style={{ color: dayColor }} />
                        <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
                          {group.cityName}
                        </span>
                        <span style={{ fontSize: 12, color: '#64748b' }}>
                          ({group.items.length}项)
                        </span>
                      </div>
                      {/* 城市分组地图 */}
                      {groupMapUrl && (
                        <div style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <img
                            src={groupMapUrl}
                            alt={`Day ${day} - ${group.cityName}`}
                            style={{ width: '100%', height: 'auto', display: 'block' }}
                            crossOrigin="anonymous"
                          />
                        </div>
                      )}
                      {/* 城市分组行程 */}
                      <div style={{ padding: '16px 20px' }}>
                        {renderItemsTimeline(group.items, `city-${groupIdx}-`)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <>
                  {/* 单城市：原有逻辑 */}
                  {(() => {
                    const mapUrl = generateStaticMapUrl(dayItems, dayColor);
                    return mapUrl ? (
                      <div style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <img
                          src={mapUrl}
                          alt={`Day ${day} Route Map`}
                          style={{ width: '100%', height: 'auto', display: 'block' }}
                          crossOrigin="anonymous"
                        />
                      </div>
                    ) : null;
                  })()}
                  <div style={{ padding: '16px 20px' }}>
                    {renderItemsTimeline(dayItems)}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 底部 */}
      <div
        style={{
          textAlign: 'center',
          padding: '20px 32px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
        }}
      >
        <div style={{ color: '#94a3b8', fontSize: 12 }}>
          Powered by Helix Travel · {dayjs().format('YYYY-MM-DD HH:mm')}
        </div>
      </div>
    </div>
  );
});

TravelExportCard.displayName = 'TravelExportCard';

export default TravelExportCard;
