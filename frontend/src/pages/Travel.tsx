import React, { useEffect, useState, useCallback, useRef } from 'react';
import { BaseLayout } from '../components/layout/BaseLayout';
import { travelApi } from '../services/api';
import type { TravelPlan, TravelPlanDetail, TravelItinerary, AmapPoi, CityGroup } from '../types';
import TravelAIChat from '../components/features/travel/TravelAIChat';
import ItineraryDetailDrawer from '../components/features/travel/ItineraryDetailDrawer';
import TravelExportCard from '../components/features/travel/TravelExportCard';
import { clusterItemsByDistance, haversineDistance } from '../utils/cityGrouping';
import { toPng } from 'html-to-image';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  Checkbox,
  message as antMessage,
  Spin,
  Empty,
  Tag,
  Drawer,
  Space,
  Timeline,
  Tabs,
  Select,
  InputNumber,
  Popconfirm,
  Tooltip,
  Typography,
  theme,
  List,
  Avatar,
  Collapse,
  TimePicker,
  AutoComplete,
  Radio,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  DollarOutlined,
  SearchOutlined,
  CarOutlined,
  CoffeeOutlined,
  BankOutlined,
  CompassOutlined,
  ClockCircleOutlined,
  SwapOutlined,
  AimOutlined,
  LeftOutlined,
  RobotOutlined,
  DownloadOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Text } = Typography;
const { RangePicker } = DatePicker;

// 高德地图JS API Key（前端使用）
const AMAP_JS_KEY = '696a8bac3cd37428b5bd82a6334cc586';

// 行程类型图标和颜色映射
const categoryConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  attraction: { icon: <CompassOutlined />, color: '#1890ff', label: '景点' },
  food: { icon: <CoffeeOutlined />, color: '#fa8c16', label: '餐饮' },
  transport: { icon: <CarOutlined />, color: '#52c41a', label: '交通' },
  hotel: { icon: <BankOutlined />, color: '#13c2c2', label: '酒店' },
};

const getCategoryConfig = (category: string) =>
  categoryConfig[category] || { icon: <EnvironmentOutlined />, color: '#8c8c8c', label: category };

const Travel: React.FC = () => {
  const [plans, setPlans] = useState<TravelPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<TravelPlanDetail | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'ai-chat'>('list');
  
  // 弹窗状态
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [itineraryDrawerOpen, setItineraryDrawerOpen] = useState(false);
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // 表单
  const [planForm] = Form.useForm();
  const [itineraryForm] = Form.useForm();

  // 编辑状态
  const [editingItinerary, setEditingItinerary] = useState<TravelItinerary | null>(null);
  
  // 搜索相关
  const [searchKeywords, setSearchKeywords] = useState('');
  const [searchCity, setSearchCity] = useState('');

  // 内联地点搜索（行程编辑表单内）
  const [locationOptions, setLocationOptions] = useState<{ value: string; label: React.ReactNode; poi: AmapPoi }[]>([]);
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  const locationSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 行程详情抽屉
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedItinerary, setSelectedItinerary] = useState<TravelItinerary | null>(null);
  const [searchResults, setSearchResults] = useState<AmapPoi[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(1);

  // 交通子类型 & 路线信息
  const [transportSubtype, setTransportSubtype] = useState<'taxi' | 'metro' | 'manual'>('taxi');
  const [routeInfo, setRouteInfo] = useState<any>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // 城市分组
  const [cityGroups, setCityGroups] = useState<Record<number, CityGroup[]>>({});
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const cityNameCacheRef = useRef<Map<string, string>>(new Map());

  // 地图标记点（用于图例显示）
  const [mapPoints, setMapPoints] = useState<Array<{ lng: number; lat: number; name: string; type: string; order: number; time: string; id: number }>>([]);
  
  // 地图
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  
  const {
    token: { colorBgContainer, colorBorderSecondary, colorFillQuaternary },
  } = theme.useToken();

  // 加载计划列表
  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      const response = await travelApi.getPlans();
      setPlans(response.data.plans || []);
    } catch (error) {
      console.error('Failed to load plans:', error);
      antMessage.error('加载旅行计划失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载计划详情
  const loadPlanDetail = useCallback(async (planId: number) => {
    try {
      setLoading(true);
      const response = await travelApi.getPlan(planId);
      setCurrentPlan(response.data.plan);
      setViewMode('detail');
    } catch (error) {
      console.error('Failed to load plan detail:', error);
      antMessage.error('加载计划详情失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // 计算城市分组
  useEffect(() => {
    if (!currentPlan) {
      setCityGroups({});
      return;
    }

    const computeGroups = async () => {
      const groups: Record<number, CityGroup[]> = {};
      const daysCount = currentPlan.days_count || 0;

      for (let day = 1; day <= daysCount; day++) {
        const items = currentPlan.itinerary_by_day[day] || [];
        // Filter items that have coordinates
        const geoItems = items.filter(
          (i) => (i.latitude && i.longitude) || (i.from_latitude && i.from_longitude)
        );

        if (geoItems.length === 0) {
          groups[day] = [{
            cityName: '全部',
            cityKey: 'all',
            centerLng: 0,
            centerLat: 0,
            items: items,
          }];
          continue;
        }

        const clusters = clusterItemsByDistance(geoItems, 50);

        if (clusters.length <= 1) {
          // Single cluster - no sub-tabs needed
          groups[day] = [{
            cityName: '全部',
            cityKey: 'all',
            centerLng: clusters[0]?.centerLng || 0,
            centerLat: clusters[0]?.centerLat || 0,
            items: items,
          }];
          continue;
        }

        // Multiple clusters - reverse geocode each center
        const dayGroups: CityGroup[] = [];

        for (const cluster of clusters) {
          const cacheKey = `${cluster.centerLng.toFixed(3)},${cluster.centerLat.toFixed(3)}`;
          let cityName = cityNameCacheRef.current.get(cacheKey);

          if (!cityName) {
            try {
              const res = await travelApi.amapRegeo({
                location: `${cluster.centerLng},${cluster.centerLat}`,
              });
              if (res.data.success && res.data.result) {
                cityName = res.data.result.city || res.data.result.province || '未知';
              } else {
                cityName = '未知';
              }
            } catch {
              cityName = '未知';
            }
            cityNameCacheRef.current.set(cacheKey, cityName);
          }

          const clusterItems = items.filter((i) => cluster.itemIds.has(i.id));
          dayGroups.push({
            cityName,
            cityKey: `${day}-${cacheKey}`,
            centerLng: cluster.centerLng,
            centerLat: cluster.centerLat,
            items: clusterItems,
          });
        }

        groups[day] = dayGroups;
      }

      setCityGroups(groups);
    };

    computeGroups();
  }, [currentPlan]);

  // 初始化地图
  useEffect(() => {
    if (viewMode === 'detail' && currentPlan && mapContainerRef.current && AMAP_JS_KEY) {
      // 动态加载高德地图JS
      if (!(window as any).AMap) {
        const script = document.createElement('script');
        script.src = `https://webapi.amap.com/maps?v=1.4.15&key=${AMAP_JS_KEY}&plugin=AMap.ToolBar,AMap.Scale`;
        script.async = true;
        script.onload = () => {
          setTimeout(() => initMap(), 100); // 等待AMap完全加载
        };
        script.onerror = () => {
          console.error('Failed to load AMap');
        };
        document.head.appendChild(script);
      } else {
        initMap();
      }
    }
  }, [viewMode, currentPlan]);
  
  // 当选择的天数变化时更新地图
  useEffect(() => {
    if (mapInstance.current && currentPlan) {
      updateMapMarkers();
    }
  }, [selectedDay, selectedCity, currentPlan]);

  // 当选择的天数变化时自动选择城市
  useEffect(() => {
    const dayGroupList = cityGroups[selectedDay];
    if (dayGroupList && dayGroupList.length > 1) {
      setSelectedCity(dayGroupList[0].cityKey);
    } else {
      setSelectedCity(null);
    }
  }, [selectedDay, cityGroups]);

  // 路线引用
  const polylinesRef = useRef<any[]>([]);
  
  // 每天的路线颜色
  const dayColors = ['#1890ff', '#52c41a', '#fa8c16', '#eb2f96', '#722ed1', '#13c2c2', '#f5222d'];

  const initMap = () => {
    if (!mapContainerRef.current || !(window as any).AMap) return;

    const AMap = (window as any).AMap;

    // 尝试从行程中获取初始中心点
    let defaultCenter: [number, number] = [116.397428, 39.90923]; // 兜底：北京
    if (currentPlan) {
      const allItems = Object.values(currentPlan.itinerary_by_day).flat();
      const firstWithCoords = allItems.find(i => i.longitude && i.latitude);
      if (firstWithCoords) {
        defaultCenter = [firstWithCoords.longitude!, firstWithCoords.latitude!];
      }
    }

    // 创建地图
    mapInstance.current = new AMap.Map(mapContainerRef.current, {
      zoom: 12,
      center: defaultCenter,
      mapStyle: 'amap://styles/normal',
    });
    
    // 添加工具条和比例尺
    AMap.plugin(['AMap.ToolBar', 'AMap.Scale'], () => {
      mapInstance.current.addControl(new AMap.ToolBar({ position: 'RT' }));
      mapInstance.current.addControl(new AMap.Scale());
    });
    
    // 更新标记和路线
    updateMapMarkers();
  };

  const updateMapMarkers = () => {
    if (!mapInstance.current || !currentPlan || !(window as any).AMap) return;

    const AMap = (window as any).AMap;

    // 清除旧标记和路线
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];

    // 只获取当天的行程
    let items = currentPlan.itinerary_by_day[selectedDay] || [];

    // 如果有选中的城市且当天有多个分组，过滤到选中城市的items
    const dayGroupList = cityGroups[selectedDay];
    const activeGroup = (selectedCity && dayGroupList && dayGroupList.length > 1)
      ? dayGroupList.find((g) => g.cityKey === selectedCity) : null;
    if (activeGroup) {
      const groupItemIds = new Set(activeGroup.items.map((i) => i.id));
      items = items.filter((i) => groupItemIds.has(i.id));
    }

    const points: Array<{ lng: number; lat: number; name: string; type: string; order: number; time: string; id: number }> = [];

    items.forEach((item) => {
      // 当选中城市时，判断交通项是否跨城市（起终点都有坐标但距离>50km）
      if (activeGroup && item.category === 'transport'
        && item.from_latitude && item.from_longitude
        && item.latitude && item.longitude) {
        const dist = haversineDistance(item.from_latitude, item.from_longitude, item.latitude, item.longitude);
        if (dist > 50) {
          // 跨城市交通：只显示属于当前城市的那个端点
          const fromNear = haversineDistance(item.from_latitude, item.from_longitude, activeGroup.centerLat, activeGroup.centerLng) <= 50;
          const toNear = haversineDistance(item.latitude, item.longitude, activeGroup.centerLat, activeGroup.centerLng) <= 50;
          if (fromNear) {
            points.push({
              lng: item.from_longitude,
              lat: item.from_latitude,
              name: `${item.from_location_name || '出发地'} [${item.title}]`,
              type: item.category,
              order: points.length + 1,
              time: item.departure_datetime ? dayjs(item.departure_datetime).format('HH:mm') : '',
              id: item.id,
            });
          }
          if (toNear) {
            points.push({
              lng: item.longitude,
              lat: item.latitude,
              name: `${item.location_name || item.title} [到达]`,
              type: item.category,
              order: points.length + 1,
              time: item.arrival_datetime ? dayjs(item.arrival_datetime).format('HH:mm') : '',
              id: item.id,
            });
          }
          return; // 不走下面的默认逻辑
        }
      }

      // For transport items, also add the origin point
      if (item.category === 'transport' && item.from_longitude && item.from_latitude) {
        points.push({
          lng: item.from_longitude,
          lat: item.from_latitude,
          name: item.from_location_name || '出发地',
          type: item.category,
          order: points.length + 1,
          time: item.departure_datetime ? dayjs(item.departure_datetime).format('HH:mm') : '',
          id: item.id,
        });
      }
      if (item.longitude && item.latitude) {
        points.push({
          lng: item.longitude,
          lat: item.latitude,
          name: item.category === 'transport' ? (item.location_name || item.title) : item.title,
          type: item.category || 'other',
          order: points.length + 1,
          time: item.category === 'transport'
            ? (item.arrival_datetime ? dayjs(item.arrival_datetime).format('HH:mm') : '')
            : (item.start_time || ''),
          id: item.id,
        });
      }
    });
    
    const dayColor = dayColors[(selectedDay - 1) % dayColors.length];

    // 保存点位用于图例
    setMapPoints(points);

    // 添加标记 - 仅显示编号圆点，文字放到地图外图例
    points.forEach((point) => {
      const config = categoryConfig[point.type] || { icon: <EnvironmentOutlined />, color: '#8c8c8c', label: point.type };

      const markerContent = document.createElement('div');
      markerContent.innerHTML = `
        <div style="
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: ${config.color};
          color: white;
          font-size: 12px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          border: 2px solid white;
          cursor: pointer;
        ">${point.order}</div>
      `;

      const marker = new AMap.Marker({
        position: [point.lng, point.lat],
        content: markerContent,
        offset: new AMap.Pixel(-12, -12),
      });
      
      marker.setMap(mapInstance.current);
      markersRef.current.push(marker);
    });
    
    // 绘制当天路线
    if (points.length > 1) {
      const path = points.map(p => [p.lng, p.lat]);
      
      const polyline = new AMap.Polyline({
        path: path,
        strokeColor: dayColor,
        strokeWeight: 5,
        strokeOpacity: 0.9,
        strokeStyle: 'solid',
        lineJoin: 'round',
        lineCap: 'round',
        showDir: true,
      });
      
      polyline.setMap(mapInstance.current);
      polylinesRef.current.push(polyline);
    }
    
    // 调整视野以包含所有标记
    if (markersRef.current.length > 0) {
      mapInstance.current.setFitView(markersRef.current, false, [60, 60, 60, 60]);
    } else if (points.length === 0) {
      // 如果当天没有地点，显示默认位置
      mapInstance.current.setCenter([110.35, 20.02]); // 海口
      mapInstance.current.setZoom(10);
    }
  };

  // 创建计划
  const handleCreatePlan = async (values: any) => {
    try {
      const data = {
        title: values.title,
        description: values.description,
        destination: values.destination,
        start_date: values.dateRange[0].format('YYYY-MM-DD'),
        end_date: values.dateRange[1].format('YYYY-MM-DD'),
        budget: values.budget || 0,
        shared: values.shared || false,
      };
      
      const response = await travelApi.createPlan(data);
      if (response.data.success) {
        antMessage.success('创建成功');
        setCreateModalOpen(false);
        planForm.resetFields();
        loadPlans();
        // 自动打开新创建的计划
        if (response.data.id) {
          loadPlanDetail(response.data.id);
        }
      }
    } catch (error) {
      console.error('Failed to create plan:', error);
      antMessage.error('创建失败');
    }
  };

  // 删除计划
  const handleDeletePlan = async (planId: number) => {
    try {
      await travelApi.deletePlan(planId);
      antMessage.success('删除成功');
      loadPlans();
    } catch (error) {
      console.error('Failed to delete plan:', error);
      antMessage.error('删除失败');
    }
  };

  // 添加/更新行程项目
  const handleSaveItinerary = async (values: any) => {
    if (!currentPlan) return;

    try {
      const category = values.category;
      // 编辑时保留原来的天数，新建时用当前选中的天数
      const effectiveDay = editingItinerary ? editingItinerary.day_number : selectedDay;
      const data: Record<string, any> = {
        title: values.title,
        category: category,
        notes: values.notes,
        description: values.description,
      };

      if (category === 'hotel') {
        // 酒店：用check_in_day作为day_number
        data.day_number = values.check_in_day;
        data.check_in_day = values.check_in_day;
        data.check_out_day = values.check_out_day;
        data.location_name = values.location_name;
        data.location_address = values.location_address;
        data.latitude = values.latitude;
        data.longitude = values.longitude;
        data.poi_id = values.poi_id;
        data.cost = values.cost;
      } else if (category === 'transport') {
        // 交通：起终点+时间
        data.from_location_name = values.from_location_name;
        data.from_location_address = values.from_location_address;
        data.from_latitude = values.from_latitude;
        data.from_longitude = values.from_longitude;
        data.location_name = values.location_name;
        data.location_address = values.location_address;
        data.latitude = values.latitude;
        data.longitude = values.longitude;
        data.poi_id = values.poi_id;

        if (transportSubtype === 'taxi' || transportSubtype === 'metro') {
          // 打车/地铁：自动用当天天数
          data.day_number = effectiveDay;
          // 自动生成标题
          const subtypeLabel = transportSubtype === 'taxi' ? '打车' : '地铁';
          const fromName = values.from_location_name || '出发地';
          const toName = values.location_name || '目的地';
          data.title = `${subtypeLabel}: ${fromName} → ${toName}`;

          // 从TimePicker构造完整datetime: plan start_date + (effectiveDay-1) + time
          if (values.departure_time && currentPlan) {
            const dayDate = dayjs(currentPlan.start_date).add(effectiveDay - 1, 'day');
            const departureDateTime = dayDate
              .hour(values.departure_time.hour())
              .minute(values.departure_time.minute())
              .second(0);
            data.departure_datetime = departureDateTime.format('YYYY-MM-DDTHH:mm:ss');

            // 路线信息 + 自动计算到达时间
            if (routeInfo && routeInfo.paths && routeInfo.paths.length > 0) {
              const path = routeInfo.paths[0];
              const arrivalTime = departureDateTime.add(parseInt(path.duration), 'second');
              data.arrival_datetime = arrivalTime.format('YYYY-MM-DDTHH:mm:ss');
            }
          }

          // 路线信息
          const mode = transportSubtype === 'taxi' ? 'driving' : 'transit';
          data.transport_mode = mode;
          if (routeInfo && routeInfo.paths && routeInfo.paths.length > 0) {
            const path = routeInfo.paths[0];
            data.transport_duration = Math.round(parseInt(path.duration) / 60); // 秒转分钟
            data.transport_distance = parseInt(path.distance);
            if (transportSubtype === 'taxi') {
              data.transport_cost = routeInfo.taxi_cost || 0;
              data.cost = routeInfo.taxi_cost || 0;
            } else {
              data.transport_cost = path.cost || 0;
              data.cost = path.cost || 0;
            }
            data.transport_info = routeInfo;
          }
        } else {
          // 手动模式：高铁/飞机/其他
          data.day_number = effectiveDay;

          if (currentPlan) {
            const dayDate = dayjs(currentPlan.start_date).add(effectiveDay - 1, 'day');

            if (values.departure_time) {
              const departureDateTime = dayDate
                .hour(values.departure_time.hour())
                .minute(values.departure_time.minute())
                .second(0);
              data.departure_datetime = departureDateTime.format('YYYY-MM-DDTHH:mm:ss');

              if (values.arrival_time) {
                let arrivalDateTime = dayDate
                  .hour(values.arrival_time.hour())
                  .minute(values.arrival_time.minute())
                  .second(0);
                // 到达时间早于出发时间，视为次日到达
                if (arrivalDateTime.isBefore(departureDateTime)) {
                  arrivalDateTime = arrivalDateTime.add(1, 'day');
                }
                data.arrival_datetime = arrivalDateTime.format('YYYY-MM-DDTHH:mm:ss');
              }
            }
          }
          data.cost = values.cost;
        }
      } else {
        // 景点/餐饮：时间段+地点
        data.day_number = effectiveDay;
        data.location_name = values.location_name;
        data.location_address = values.location_address;
        data.latitude = values.latitude;
        data.longitude = values.longitude;
        data.poi_id = values.poi_id;
        data.start_time = values.time_range?.[0]?.format('HH:mm');
        data.end_time = values.time_range?.[1]?.format('HH:mm');
        data.duration_minutes = values.duration_minutes;
        data.cost = values.cost;
      }

      if (editingItinerary) {
        await travelApi.updateItinerary(editingItinerary.id, data);
        antMessage.success('更新成功');
      } else {
        await travelApi.addItinerary(currentPlan.id, data);
        antMessage.success('添加成功');
      }

      setItineraryDrawerOpen(false);
      itineraryForm.resetFields();
      setEditingItinerary(null);
      loadPlanDetail(currentPlan.id);
    } catch (error) {
      console.error('Failed to save itinerary:', error);
      antMessage.error('保存失败');
    }
  };

  // 删除行程项目
  const handleDeleteItinerary = async (itemId: number) => {
    if (!currentPlan) return;
    
    try {
      await travelApi.deleteItinerary(itemId);
      antMessage.success('删除成功');
      loadPlanDetail(currentPlan.id);
    } catch (error) {
      console.error('Failed to delete itinerary:', error);
      antMessage.error('删除失败');
    }
  };

  // 搜索地点
  const handleSearch = async () => {
    if (!searchKeywords.trim()) {
      antMessage.warning('请输入搜索关键词');
      return;
    }

    try {
      setSearchLoading(true);
      const response = await travelApi.amapSearch({
        keywords: searchKeywords,
        city: searchCity,
      });

      if (response.data.success) {
        setSearchResults(response.data.pois || []);
      } else {
        antMessage.error(response.data.error || '搜索失败');
      }
    } catch (error) {
      console.error('Search failed:', error);
      antMessage.error('搜索失败，请检查高德地图API配置');
    } finally {
      setSearchLoading(false);
    }
  };

  // 内联地点搜索（带防抖）
  const handleLocationSearch = useCallback((value: string) => {
    // 清除之前的定时器
    if (locationSearchTimer.current) {
      clearTimeout(locationSearchTimer.current);
    }

    if (!value.trim() || value.length < 2) {
      setLocationOptions([]);
      return;
    }

    // 防抖：500ms 后执行搜索
    locationSearchTimer.current = setTimeout(async () => {
      try {
        setLocationSearchLoading(true);
        const city = currentPlan?.destination || '';
        const response = await travelApi.amapSearch({
          keywords: value,
          city: city,
        });

        if (response.data.success && response.data.pois) {
          const options = response.data.pois.map((poi) => ({
            value: poi.name,
            label: (
              <div style={{ padding: '4px 0' }}>
                <div style={{ fontWeight: 500 }}>{poi.name}</div>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                  <EnvironmentOutlined style={{ marginRight: 4 }} />
                  {poi.address || '暂无地址'}
                </div>
                {poi.type && (
                  <Tag style={{ fontSize: 10, marginTop: 2 }}>{poi.type.split(';')[0]}</Tag>
                )}
              </div>
            ),
            poi: poi,
          }));
          setLocationOptions(options);
        }
      } catch (error) {
        console.error('Location search failed:', error);
      } finally {
        setLocationSearchLoading(false);
      }
    }, 500);
  }, [currentPlan]);

  // 获取路线信息（打车/地铁）
  const fetchRouteInfo = useCallback(async (fromLng: number, fromLat: number, toLng: number, toLat: number, mode: 'driving' | 'transit') => {
    try {
      setRouteLoading(true);
      setRouteInfo(null);
      const city = currentPlan?.destination || '北京';
      const response = await travelApi.amapDirection({
        origin: `${fromLng},${fromLat}`,
        destination: `${toLng},${toLat}`,
        mode,
        city,
      });
      if (response.data.success && response.data.route) {
        setRouteInfo(response.data.route);
      }
    } catch (error) {
      console.error('Route fetch failed:', error);
    } finally {
      setRouteLoading(false);
    }
  }, [currentPlan]);

  // 检查打车/地铁模式下起终点是否都有坐标，自动获取路线
  const tryFetchRouteFromForm = useCallback(() => {
    if (transportSubtype === 'manual') return;
    // 延迟读取，确保 setFieldsValue 已生效
    setTimeout(() => {
      const fromLat = itineraryForm.getFieldValue('from_latitude');
      const fromLng = itineraryForm.getFieldValue('from_longitude');
      const toLat = itineraryForm.getFieldValue('latitude');
      const toLng = itineraryForm.getFieldValue('longitude');
      if (fromLat && fromLng && toLat && toLng) {
        const mode = transportSubtype === 'taxi' ? 'driving' : 'transit';
        fetchRouteInfo(fromLng, fromLat, toLng, toLat, mode);
      }
    }, 50);
  }, [transportSubtype, itineraryForm, fetchRouteInfo]);

  // 从搜索结果添加到行程
  const handleAddFromSearch = (poi: AmapPoi) => {
    itineraryForm.setFieldsValue({
      title: poi.name,
      location_name: poi.name,
      location_address: poi.address,
      latitude: poi.latitude,
      longitude: poi.longitude,
      poi_id: poi.id,
      day_number: selectedDay,
      category: 'attraction',
    });
    setSearchDrawerOpen(false);
    setItineraryDrawerOpen(true);
  };

  // 打开添加行程抽屉
  const openItineraryDrawer = (day?: number, item?: TravelItinerary) => {
    // 清除搜索状态
    setLocationOptions([]);
    setRouteInfo(null);

    if (item) {
      setEditingItinerary(item);
      // 检测交通子类型
      if (item.category === 'transport' && item.transport_mode) {
        if (item.transport_mode === 'driving') {
          setTransportSubtype('taxi');
        } else if (item.transport_mode === 'transit') {
          setTransportSubtype('metro');
        } else {
          setTransportSubtype('manual');
        }
        // 恢复路线信息
        if (item.transport_info) {
          setRouteInfo(typeof item.transport_info === 'string' ? JSON.parse(item.transport_info) : item.transport_info);
        }
      } else {
        setTransportSubtype('manual');
      }
      itineraryForm.setFieldsValue({
        ...item,
        time_range: item.start_time && item.end_time
          ? [dayjs(item.start_time, 'HH:mm'), dayjs(item.end_time, 'HH:mm')]
          : undefined,
        // 交通类型字段
        departure_datetime: item.departure_datetime ? dayjs(item.departure_datetime) : undefined,
        departure_time: item.departure_datetime ? dayjs(item.departure_datetime) : undefined,
        arrival_datetime: item.arrival_datetime ? dayjs(item.arrival_datetime) : undefined,
        arrival_time: item.arrival_datetime ? dayjs(item.arrival_datetime) : undefined,
        // 酒店字段
        check_in_day: item.check_in_day,
        check_out_day: item.check_out_day,
      });
    } else {
      setEditingItinerary(null);
      setTransportSubtype('taxi');
      itineraryForm.resetFields();
      if (day) {
        itineraryForm.setFieldsValue({ day_number: day, category: 'attraction' });
        setSelectedDay(day);

        // 自动推断出发地：上一个行程的终点 或 当天酒店
        if (currentPlan) {
          const dayItems = (currentPlan.itinerary_by_day[day] || [])
            .filter((i: TravelItinerary) => !i.is_hotel_injection);
          if (dayItems.length > 0) {
            // 有行程：用最后一个行程的终点作为出发地
            const lastItem = dayItems[dayItems.length - 1];
            if (lastItem.latitude && lastItem.longitude) {
              itineraryForm.setFieldsValue({
                from_location_name: lastItem.location_name || lastItem.title,
                from_location_address: lastItem.location_address || '',
                from_latitude: lastItem.latitude,
                from_longitude: lastItem.longitude,
              });
            }
          } else {
            // 当天没有行程：找覆盖当天的酒店
            const allItems = Object.values(currentPlan.itinerary_by_day).flat() as TravelItinerary[];
            const hotel = allItems.find(
              (i: TravelItinerary) => i.category === 'hotel'
                && !i.is_hotel_injection
                && i.check_in_day && i.check_out_day
                && i.check_in_day <= day && day <= i.check_out_day
            );
            if (hotel && hotel.latitude && hotel.longitude) {
              itineraryForm.setFieldsValue({
                from_location_name: hotel.location_name || hotel.title,
                from_location_address: hotel.location_address || '',
                from_latitude: hotel.latitude,
                from_longitude: hotel.longitude,
              });
            }
          }
        }
      }
    }
    setItineraryDrawerOpen(true);
  };

  // 返回列表
  const backToList = () => {
    setViewMode('list');
    setCurrentPlan(null);
    loadPlans();
  };

  // 导出为图片
  const handleExportImage = async () => {
    if (!currentPlan || !exportRef.current) return;

    try {
      setExporting(true);
      // 等待渲染完成
      await new Promise(resolve => setTimeout(resolve, 100));

      const dataUrl = await toPng(exportRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      // 创建下载链接
      const link = document.createElement('a');
      link.download = `${currentPlan.title}-行程.png`;
      link.href = dataUrl;
      link.click();

      antMessage.success('导出成功');
      setExportModalOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
      antMessage.error('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  // 状态颜色
  const statusColors: Record<string, string> = {
    planning: 'blue',
    ongoing: 'green',
    completed: 'default',
  };

  const statusLabels: Record<string, string> = {
    planning: '规划中',
    ongoing: '进行中',
    completed: '已完成',
  };

  if (loading && viewMode === 'list') {
    return (
      <BaseLayout title="旅行计划">
        <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin size="large" />
        </div>
      </BaseLayout>
    );
  }

  // AI对话视图 - 全屏展示
  if (viewMode === 'ai-chat') {
    return (
      <BaseLayout
        title="AI旅行规划"
        headerActions={
          <Button icon={<LeftOutlined />} onClick={() => setViewMode('list')}>
            返回
          </Button>
        }
        fullscreen
      >
        <div style={{ height: 'calc(100vh - 64px)' }}>
          <TravelAIChat 
            onPlanGenerated={(planId) => {
              loadPlanDetail(planId);
            }}
          />
        </div>
      </BaseLayout>
    );
  }

  // 计划列表视图
  if (viewMode === 'list') {
    return (
      <BaseLayout
        title="旅行计划"
        headerActions={
          <Space>
            <Button 
              type="primary" 
              icon={<RobotOutlined />} 
              onClick={() => setViewMode('ai-chat')}
              style={{ background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)', border: 'none' }}
            >
              AI智能规划
            </Button>
            <Button icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              手动创建
            </Button>
          </Space>
        }
      >
        {plans.length === 0 ? (
          <div style={{ background: colorBgContainer, padding: 48, borderRadius: 8, textAlign: 'center' }}>
            <Empty
              description="还没有旅行计划"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Space direction="vertical" size={12}>
                <Button 
                  type="primary" 
                  size="large"
                  icon={<RobotOutlined />} 
                  onClick={() => setViewMode('ai-chat')}
                  style={{ background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)', border: 'none' }}
                >
                  AI智能规划
                </Button>
                <Button icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
                  手动创建计划
                </Button>
              </Space>
            </Empty>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {plans.map(plan => (
              <Card
                key={plan.id}
                hoverable
                onClick={() => loadPlanDetail(plan.id)}
                style={{ background: colorBgContainer }}
                cover={
                  plan.cover_image ? (
                    <div style={{ height: 160, background: `url(${plan.cover_image}) center/cover` }} />
                  ) : (
                    <div style={{ 
                      height: 160, 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <CompassOutlined style={{ fontSize: 48, color: 'rgba(255,255,255,0.8)' }} />
                    </div>
                  )
                }
                actions={[
                  <Tooltip title="编辑" key="edit">
                    <EditOutlined onClick={(e) => { e.stopPropagation(); loadPlanDetail(plan.id); }} />
                  </Tooltip>,
                  <Popconfirm
                    key="delete"
                    title="确定删除这个计划吗？"
                    onConfirm={(e) => { e?.stopPropagation(); handleDeletePlan(plan.id); }}
                    onCancel={(e) => e?.stopPropagation()}
                  >
                    <DeleteOutlined onClick={(e) => e.stopPropagation()} style={{ color: '#ff4d4f' }} />
                  </Popconfirm>,
                ]}
              >
                <Card.Meta
                  title={
                    <Space>
                      {plan.title}
                      <Tag color={statusColors[plan.status]}>{statusLabels[plan.status]}</Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      {plan.destination && (
                        <Text type="secondary">
                          <EnvironmentOutlined /> {plan.destination}
                        </Text>
                      )}
                      <Text type="secondary">
                        <CalendarOutlined /> {plan.start_date} ~ {plan.end_date} ({plan.days_count}天)
                      </Text>
                      {plan.budget && plan.budget > 0 && (
                        <Text type="secondary">
                          <DollarOutlined /> 预算: {plan.budget.toLocaleString()}
                        </Text>
                      )}
                      <Space size={8} style={{ marginTop: 4 }}>
                        <Tag>{plan.itinerary_count || 0} 个行程</Tag>
                        <Tag>{plan.hotel_count || 0} 个酒店</Tag>
                        <Tag>{plan.transport_count || 0} 个交通</Tag>
                      </Space>
                    </Space>
                  }
                />
              </Card>
            ))}
          </div>
        )}

        {/* 创建计划弹窗 */}
        <Modal
          title="新建旅行计划"
          open={createModalOpen}
          onCancel={() => setCreateModalOpen(false)}
          footer={null}
          width={500}
        >
          <Form form={planForm} layout="vertical" onFinish={handleCreatePlan}>
            <Form.Item name="title" label="计划名称" rules={[{ required: true, message: '请输入计划名称' }]}>
              <Input placeholder="例如：日本东京5日游" />
            </Form.Item>
            <Form.Item name="destination" label="目的地">
              <Input placeholder="例如：日本东京" prefix={<EnvironmentOutlined />} />
            </Form.Item>
            <Form.Item name="dateRange" label="出行日期" rules={[{ required: true, message: '请选择日期' }]}>
              <RangePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="budget" label="预算（元）">
              <InputNumber style={{ width: '100%' }} min={0} placeholder="可选" />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <TextArea rows={3} placeholder="记录一些想法..." />
            </Form.Item>
            <Form.Item name="shared" valuePropName="checked">
              <Checkbox>共享给对方</Checkbox>
            </Form.Item>
            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setCreateModalOpen(false)}>取消</Button>
                <Button type="primary" htmlType="submit">创建</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </BaseLayout>
    );
  }

  // 计划详情视图
  if (!currentPlan) return null;

  const daysArray = Array.from({ length: currentPlan.days_count }, (_, i) => i + 1);

  return (
    <BaseLayout
      title={currentPlan.title}
      headerActions={
        <Space>
          <Button icon={<LeftOutlined />} onClick={backToList}>返回列表</Button>
          <Button icon={<SearchOutlined />} onClick={() => { setSearchCity(currentPlan?.destination || ''); setSearchDrawerOpen(true); }}>搜索地点</Button>
          <Button icon={<DownloadOutlined />} onClick={() => setExportModalOpen(true)}>导出图片</Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 160px)' }}>
        {/* 左侧：行程时间线 */}
        <div style={{ flex: 1, overflow: 'auto', background: colorBgContainer, borderRadius: 8, padding: 16 }}>
          <Tabs
            defaultActiveKey="itinerary"
            items={[
              {
                key: 'itinerary',
                label: <span><CompassOutlined /> 行程</span>,
                children: (
                  <div>
                    {/* 总费用统计 */}
                    <Card size="small" style={{ marginBottom: 16, background: 'linear-gradient(135deg, #667eea11 0%, #764ba211 100%)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space size={24}>
                          <div>
                            <Text type="secondary">预计总费用</Text>
                            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>
                              ¥{Object.values(currentPlan.itinerary_by_day).flat().reduce((sum, item) => sum + (item.cost || 0), 0).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <Text type="secondary">实际花费</Text>
                            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>
                              ¥{Object.values(currentPlan.itinerary_by_day).flat().reduce((sum, item) => sum + (item.actual_cost || 0), 0).toLocaleString()}
                            </div>
                          </div>
                          {currentPlan.budget && currentPlan.budget > 0 && (
                            <div>
                              <Text type="secondary">预算</Text>
                              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#faad14' }}>
                                ¥{currentPlan.budget.toLocaleString()}
                              </div>
                            </div>
                          )}
                        </Space>
                        <Text type="secondary">{daysArray.length}天 · {Object.values(currentPlan.itinerary_by_day).flat().length}项</Text>
                      </div>
                    </Card>
                    <Collapse
                      defaultActiveKey={daysArray.map(d => d.toString())}
                      ghost
                      items={daysArray.map(day => {
                        const dayItems = currentPlan.itinerary_by_day[day] || [];
                        const regularItems = dayItems.filter(item => !item.is_hotel_injection);
                        const hotelInjections = dayItems.filter(item => item.is_hotel_injection);
                        const dayDate = dayjs(currentPlan.start_date).add(day - 1, 'day');
                        const dayCost = dayItems.reduce((sum, item) => sum + (item.cost || 0), 0);
                        const dayActualCost = dayItems.reduce((sum, item) => sum + (item.actual_cost || 0), 0);
                        
                        return {
                          key: day.toString(),
                          label: (
                            <Space>
                              <Tag color={dayColors[(day - 1) % dayColors.length]}>Day {day}</Tag>
                              <Text strong>{dayDate.format('M月D日')}</Text>
                              <Text type="secondary">{dayDate.format('ddd')}</Text>
                              <Text type="secondary">({dayItems.length}项)</Text>
                              {dayCost > 0 && (
                                <Tag color="gold">预计 ¥{dayCost.toLocaleString()}</Tag>
                              )}
                              {dayActualCost > 0 && (
                                <Tag color="green">实际 ¥{dayActualCost.toLocaleString()}</Tag>
                              )}
                            </Space>
                          ),
                          extra: (
                            <Space>
                              <Button
                                type="link"
                                size="small"
                                onClick={(e) => { e.stopPropagation(); setSelectedDay(day); }}
                              >
                                查看地图
                              </Button>
                              <Button
                                type="link"
                                size="small"
                                icon={<PlusOutlined />}
                                onClick={(e) => { e.stopPropagation(); openItineraryDrawer(day); }}
                              >
                                添加
                              </Button>
                            </Space>
                          ),
                          children: dayItems.length === 0 ? (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description="暂无行程"
                              style={{ padding: '20px 0' }}
                            >
                              <Button size="small" onClick={() => openItineraryDrawer(day)}>添加行程</Button>
                            </Empty>
                          ) : (
                            <>
                            <Timeline
                              items={regularItems.map((item, itemIndex) => {
                                const config = getCategoryConfig(item.category);
                                
                                return {
                                  dot: <span style={{ color: config.color }}>{config.icon}</span>,
                                  children: (
                                    <div>
                                      {/* 通勤信息显示（使用保存的数据）*/}
                                      {itemIndex > 0 && item.category !== 'transport' && item.transport_duration && item.transport_duration > 0 && (
                                        <div style={{ 
                                          fontSize: 11, 
                                          color: '#8c8c8c', 
                                          marginBottom: 4,
                                          padding: '2px 8px',
                                          background: colorFillQuaternary,
                                          borderRadius: 4,
                                          display: 'inline-block'
                                        }}>
                                          <CarOutlined /> 
                                          {item.transport_mode === 'transit' ? '公交' : '驾车'}约{item.transport_duration}分钟
                                          {item.transport_distance && (
                                            <span style={{ marginLeft: 8 }}>
                                              {(item.transport_distance / 1000).toFixed(1)}公里
                                            </span>
                                          )}
                                          {item.transport_cost && item.transport_cost > 0 && (
                                            <span style={{ marginLeft: 8 }}>
                                              ¥{item.transport_cost}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      <Card
                                        size="small"
                                        style={{ marginBottom: 8, cursor: 'pointer' }}
                                        onClick={() => {
                                          setSelectedItinerary(item);
                                          setDetailDrawerOpen(true);
                                        }}
                                        actions={[
                                          <Tooltip title="记录感受" key="review">
                                            <span onClick={(e) => { e.stopPropagation(); setSelectedItinerary(item); setDetailDrawerOpen(true); }}>
                                              {item.visited ? '✅' : '📝'}
                                            </span>
                                          </Tooltip>,
                                          <EditOutlined key="edit" onClick={(e) => { e.stopPropagation(); openItineraryDrawer(day, item); }} />,
                                          <Popconfirm
                                            key="delete"
                                            title="确定删除？"
                                            onConfirm={(e) => { e?.stopPropagation(); handleDeleteItinerary(item.id); }}
                                            onCancel={(e) => e?.stopPropagation()}
                                          >
                                            <DeleteOutlined onClick={(e) => e.stopPropagation()} style={{ color: '#ff4d4f' }} />
                                          </Popconfirm>,
                                        ]}
                                      >
                                        <Space direction="vertical" size={2} style={{ width: '100%' }}>
                                          <Space>
                                            <Text strong>{item.title}</Text>
                                            <Tag color={config.color}>{config.label}</Tag>
                                            {item.visited && <Tag color="success">已打卡</Tag>}
                                            {item.rating && item.rating > 0 && <Tag color="gold">{'★'.repeat(item.rating)}</Tag>}
                                          </Space>
                                          {/* 交通类型：显示起终点 */}
                                          {item.category === 'transport' && item.from_location_name && (
                                            <div style={{ fontSize: 12, color: '#52c41a', background: colorFillQuaternary, padding: '4px 8px', borderRadius: 4 }}>
                                              <SwapOutlined /> {item.from_location_name} → {item.location_name || item.title}
                                              {item.departure_datetime && item.arrival_datetime && (
                                                <span style={{ marginLeft: 8, color: '#8c8c8c' }}>
                                                  {dayjs(item.departure_datetime).format('HH:mm')} - {dayjs(item.arrival_datetime).format('HH:mm')}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                          {/* 酒店类型：显示入住退房 */}
                                          {item.category === 'hotel' && item.check_in_day && item.check_out_day && (
                                            <div style={{ fontSize: 12, color: '#13c2c2', background: colorFillQuaternary, padding: '4px 8px', borderRadius: 4 }}>
                                              <BankOutlined /> Day {item.check_in_day} 入住 - Day {item.check_out_day} 退房
                                            </div>
                                          )}
                                          {item.start_time && item.category !== 'transport' && (
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                              <ClockCircleOutlined /> {item.start_time}{item.end_time && ` - ${item.end_time}`}
                                            </Text>
                                          )}
                                          {item.location_address && item.category !== 'transport' && (
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                              <EnvironmentOutlined /> {item.location_address}
                                            </Text>
                                          )}
                                          {((item.cost && item.cost > 0) || item.actual_cost) && (
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                              <DollarOutlined />
                                              {item.actual_cost ? `实际 ${item.actual_cost.toLocaleString()}元` : `预计 ${(item.cost || 0).toLocaleString()}元`}
                                            </Text>
                                          )}
                                          {item.review && (
                                            <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
                                              "{item.review.slice(0, 30)}{item.review.length > 30 ? '...' : ''}"
                                            </Text>
                                          )}
                                          {item.photos && item.photos.length > 0 && (
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                              📷 {item.photos.length}张照片
                                            </Text>
                                          )}
                                        </Space>
                                      </Card>
                                    </div>
                                  ),
                                };
                              })}
                            />
                            {/* 酒店注入卡片 - 显示在每天末尾 */}
                            {hotelInjections.map(hotel => (
                              <Card
                                key={`hotel-inject-${hotel.id}-${day}`}
                                size="small"
                                style={{
                                  marginBottom: 8,
                                  borderColor: '#13c2c2',
                                  cursor: 'pointer',
                                }}
                                onClick={() => {
                                  setSelectedItinerary(hotel);
                                  setDetailDrawerOpen(true);
                                }}
                              >
                                <Space>
                                  <BankOutlined style={{ color: '#13c2c2' }} />
                                  <Text strong>{hotel.title}</Text>
                                  <Tag color="cyan">
                                    Day {hotel.check_in_day} - Day {hotel.check_out_day} 住宿
                                  </Tag>
                                </Space>
                              </Card>
                            ))}
                            </>
                          ),
                        };
                      })}
                    />
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* 右侧：地图 */}
        <div style={{ width: 500, flexShrink: 0 }}>
          <Card
            title={
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span><AimOutlined /> Day {selectedDay} 路线</span>
                  <Space size={4}>
                    {currentPlan && Object.keys(currentPlan.itinerary_by_day).map(day => (
                      <Button
                        key={day}
                        size="small"
                        type={selectedDay === parseInt(day) ? 'primary' : 'default'}
                        onClick={() => setSelectedDay(parseInt(day))}
                        style={{
                          minWidth: 32,
                          background: selectedDay === parseInt(day) ? dayColors[(parseInt(day) - 1) % dayColors.length] : undefined,
                          borderColor: selectedDay === parseInt(day) ? dayColors[(parseInt(day) - 1) % dayColors.length] : undefined,
                        }}
                      >
                        {day}
                      </Button>
                    ))}
                  </Space>
                </div>
                {/* 城市子标签 */}
                {cityGroups[selectedDay] && cityGroups[selectedDay].length > 1 && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {cityGroups[selectedDay].map((group) => (
                      <Tag
                        key={group.cityKey}
                        color={selectedCity === group.cityKey ? 'blue' : 'default'}
                        style={{ cursor: 'pointer', margin: 0 }}
                        onClick={() => setSelectedCity(group.cityKey)}
                      >
                        {group.cityName} ({group.items.length})
                      </Tag>
                    ))}
                    <Tag
                      color={selectedCity === null ? 'blue' : 'default'}
                      style={{ cursor: 'pointer', margin: 0 }}
                      onClick={() => setSelectedCity(null)}
                    >
                      全部
                    </Tag>
                  </div>
                )}
              </div>
            }
            style={{ height: '100%' }}
            bodyStyle={{ height: 'calc(100% - 57px)', padding: 0, display: 'flex', flexDirection: 'column' }}
          >
            {AMAP_JS_KEY ? (
              <>
                <div ref={mapContainerRef} style={{ width: '100%', flex: 1, minHeight: 0 }} />
                {/* 地图图例 */}
                {mapPoints.length > 0 && (
                  <div style={{
                    maxHeight: 160,
                    overflowY: 'auto',
                    borderTop: `1px solid ${colorBorderSecondary}`,
                    padding: '8px 12px',
                    background: colorBgContainer,
                    fontSize: 12,
                    lineHeight: '20px',
                  }}>
                    {mapPoints.map((pt) => {
                      const config = categoryConfig[pt.type] || { color: '#8c8c8c' };
                      return (
                        <div key={`${pt.id}-${pt.order}`} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: config.color,
                            color: 'white',
                            fontSize: 10,
                            fontWeight: 'bold',
                            flexShrink: 0,
                          }}>{pt.order}</span>
                          <Text style={{ fontSize: 12 }} ellipsis>{pt.name}</Text>
                          {pt.time && <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>{pt.time}</Text>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div style={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                flexDirection: 'column',
                gap: 16,
              }}>
                <CompassOutlined style={{ fontSize: 48, color: '#8c8c8c' }} />
                <Text type="secondary">请配置高德地图API Key以启用地图功能</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  前往 frontend/src/pages/Travel.tsx 配置 AMAP_JS_KEY
                </Text>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* 添加/编辑行程抽屉 */}
      <Drawer
        title={editingItinerary ? '编辑行程' : '添加行程'}
        open={itineraryDrawerOpen}
        onClose={() => { setItineraryDrawerOpen(false); setEditingItinerary(null); }}
        width={400}
        extra={
          <Button type="primary" onClick={() => itineraryForm.submit()}>保存</Button>
        }
      >
        <Form form={itineraryForm} layout="vertical" onFinish={handleSaveItinerary}>
          <Form.Item name="category" label="类型" initialValue="attraction">
            <Select
              options={Object.entries(categoryConfig).map(([key, config]) => ({
                value: key,
                label: (
                  <Space>
                    <span style={{ color: config.color }}>{config.icon}</span>
                    {config.label}
                  </Space>
                ),
              }))}
            />
          </Form.Item>

          {/* 根据类型显示不同的表单字段 */}
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.category !== cur.category}>
            {({ getFieldValue }) => {
              const category = getFieldValue('category');

              if (category === 'hotel') {
                return (
                  <>
                    <Form.Item name="title" label="酒店名称" rules={[{ required: true, message: '请输入酒店名称' }]}>
                      <AutoComplete
                        options={locationOptions}
                        onSearch={handleLocationSearch}
                        onSelect={(_value: string, option: any) => {
                          const poi = option.poi;
                          if (poi) {
                            itineraryForm.setFieldsValue({
                              title: poi.name,
                              location_name: poi.name,
                              location_address: poi.address || '',
                              latitude: poi.latitude,
                              longitude: poi.longitude,
                              poi_id: poi.id,
                            });
                            setLocationOptions([]);
                          }
                        }}
                        placeholder="搜索酒店名称..."
                        notFoundContent={locationSearchLoading ? <Spin size="small" /> : null}
                        allowClear
                      />
                    </Form.Item>
                    <Form.Item name="check_in_day" label="入住日" rules={[{ required: true, message: '请选择入住日' }]}>
                      <Select options={daysArray.map(d => ({ value: d, label: `Day ${d}` }))} />
                    </Form.Item>
                    <Form.Item name="check_out_day" label="退房日" rules={[{ required: true, message: '请选择退房日' }]}>
                      <Select options={daysArray.map(d => ({ value: d, label: `Day ${d}` }))} />
                    </Form.Item>
                    <Form.Item name="location_name" hidden><Input /></Form.Item>
                    <Form.Item name="location_address" hidden><Input /></Form.Item>
                    <Form.Item name="latitude" hidden><Input /></Form.Item>
                    <Form.Item name="longitude" hidden><Input /></Form.Item>
                    <Form.Item name="poi_id" hidden><Input /></Form.Item>
                    <Form.Item name="cost" label="总费用（元）">
                      <InputNumber style={{ width: '100%' }} min={0} />
                    </Form.Item>
                    <Form.Item name="notes" label="备注">
                      <TextArea rows={2} />
                    </Form.Item>
                  </>
                );
              }

              if (category === 'transport') {
                return (
                  <>
                    {/* 交通子类型选择 */}
                    <Form.Item label="交通方式">
                      <Radio.Group
                        value={transportSubtype}
                        onChange={(e) => {
                          const newSubtype = e.target.value;
                          setTransportSubtype(newSubtype);
                          setRouteInfo(null);
                          // 如果切换打车↔地铁且坐标已存在，自动重新获取路线
                          if (newSubtype === 'taxi' || newSubtype === 'metro') {
                            const fromLat = itineraryForm.getFieldValue('from_latitude');
                            const fromLng = itineraryForm.getFieldValue('from_longitude');
                            const toLat = itineraryForm.getFieldValue('latitude');
                            const toLng = itineraryForm.getFieldValue('longitude');
                            if (fromLat && fromLng && toLat && toLng) {
                              const mode = newSubtype === 'taxi' ? 'driving' : 'transit';
                              fetchRouteInfo(fromLng, fromLat, toLng, toLat, mode);
                            }
                          }
                        }}
                        optionType="button"
                        buttonStyle="solid"
                      >
                        <Radio.Button value="taxi">打车</Radio.Button>
                        <Radio.Button value="metro">地铁</Radio.Button>
                        <Radio.Button value="manual">高铁/飞机/其他</Radio.Button>
                      </Radio.Group>
                    </Form.Item>

                    {(transportSubtype === 'taxi' || transportSubtype === 'metro') ? (
                      <>
                        {/* 打车/地铁简化表单 */}

                        <div style={{ background: colorFillQuaternary, padding: 12, borderRadius: 8, marginBottom: 16, border: `1px solid ${colorBorderSecondary}` }}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                            <SwapOutlined /> 出发地
                          </Text>
                          <Form.Item name="from_location_name" label="出发地点" style={{ marginBottom: 0 }} rules={[{ required: true, message: '请选择出发地点' }]}>
                            <AutoComplete
                              options={locationOptions}
                              onSearch={handleLocationSearch}
                              onSelect={(_value: string, option: any) => {
                                const poi = option.poi;
                                if (poi) {
                                  itineraryForm.setFieldsValue({
                                    from_location_name: poi.name,
                                    from_location_address: poi.address || '',
                                    from_latitude: poi.latitude,
                                    from_longitude: poi.longitude,
                                  });
                                  setLocationOptions([]);
                                  // 自动获取路线
                                  tryFetchRouteFromForm();
                                }
                              }}
                              placeholder="搜索出发地点..."
                              notFoundContent={locationSearchLoading ? <Spin size="small" /> : null}
                              allowClear
                            />
                          </Form.Item>
                        </div>
                        <Form.Item name="from_location_address" hidden><Input /></Form.Item>
                        <Form.Item name="from_latitude" hidden><Input /></Form.Item>
                        <Form.Item name="from_longitude" hidden><Input /></Form.Item>

                        <div style={{ background: colorFillQuaternary, padding: 12, borderRadius: 8, marginBottom: 16, border: `1px solid ${colorBorderSecondary}` }}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                            <EnvironmentOutlined /> 到达地
                          </Text>
                          <Form.Item name="location_name" label="到达地点" style={{ marginBottom: 0 }} rules={[{ required: true, message: '请选择到达地点' }]}>
                            <AutoComplete
                              options={locationOptions}
                              onSearch={handleLocationSearch}
                              onSelect={(_value: string, option: any) => {
                                const poi = option.poi;
                                if (poi) {
                                  itineraryForm.setFieldsValue({
                                    location_name: poi.name,
                                    location_address: poi.address || '',
                                    latitude: poi.latitude,
                                    longitude: poi.longitude,
                                    poi_id: poi.id,
                                  });
                                  setLocationOptions([]);
                                  // 自动获取路线
                                  tryFetchRouteFromForm();
                                }
                              }}
                              placeholder="搜索到达地点..."
                              notFoundContent={locationSearchLoading ? <Spin size="small" /> : null}
                              allowClear
                            />
                          </Form.Item>
                        </div>
                        <Form.Item name="location_address" hidden><Input /></Form.Item>
                        <Form.Item name="latitude" hidden><Input /></Form.Item>
                        <Form.Item name="longitude" hidden><Input /></Form.Item>
                        <Form.Item name="poi_id" hidden><Input /></Form.Item>
                        <Form.Item name="title" hidden><Input /></Form.Item>

                        <Form.Item name="departure_time" label="出发时间">
                          <TimePicker format="HH:mm" style={{ width: '100%' }} placeholder="选择出发时间" />
                        </Form.Item>

                        {/* 路线信息卡片 */}
                        {routeLoading && (
                          <Card size="small" style={{ marginBottom: 16, textAlign: 'center' }}>
                            <Spin indicator={<LoadingOutlined />} /> 正在查询路线...
                          </Card>
                        )}
                        {routeInfo && routeInfo.paths && routeInfo.paths.length > 0 && (
                          <Card
                            size="small"
                            style={{
                              marginBottom: 16,
                              background: colorFillQuaternary,
                              border: `1px solid ${colorBorderSecondary}`,
                            }}
                            title={
                              <Space>
                                <CarOutlined style={{ color: transportSubtype === 'taxi' ? '#13c2c2' : '#722ed1' }} />
                                <span>{transportSubtype === 'taxi' ? '打车路线' : '地铁路线'}</span>
                              </Space>
                            }
                          >
                            <Space direction="vertical" size={4} style={{ width: '100%' }}>
                              {(() => {
                                const path = routeInfo.paths[0];
                                const durationMin = Math.round(parseInt(path.duration) / 60);
                                const distanceKm = (parseInt(path.distance) / 1000).toFixed(1);
                                const cost = transportSubtype === 'taxi'
                                  ? routeInfo.taxi_cost
                                  : path.cost;
                                return (
                                  <>
                                    <div>
                                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                                      <Text strong>预计时长: </Text>
                                      <Text>{durationMin} 分钟</Text>
                                    </div>
                                    <div>
                                      <EnvironmentOutlined style={{ marginRight: 4 }} />
                                      <Text strong>距离: </Text>
                                      <Text>{distanceKm} 公里</Text>
                                    </div>
                                    {cost !== undefined && cost > 0 && (
                                      <div>
                                        <DollarOutlined style={{ marginRight: 4 }} />
                                        <Text strong>预计费用: </Text>
                                        <Text style={{ color: '#f5222d', fontWeight: 'bold' }}>¥{Number(cost).toFixed(0)}</Text>
                                      </div>
                                    )}
                                    {transportSubtype === 'taxi' && path.toll > 0 && (
                                      <div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>含过路费 ¥{path.toll}</Text>
                                      </div>
                                    )}
                                    {transportSubtype === 'metro' && path.walking_distance && parseInt(path.walking_distance) > 0 && (
                                      <div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>步行 {(parseInt(path.walking_distance) / 1000).toFixed(1)} 公里</Text>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </Space>
                          </Card>
                        )}

                        <Form.Item name="notes" label="备注">
                          <TextArea rows={2} />
                        </Form.Item>
                      </>
                    ) : (
                      <>
                        {/* 手动模式：高铁/飞机/其他 */}
                        <Form.Item name="title" label="交通名称" rules={[{ required: true, message: '请输入名称' }]}>
                          <Input placeholder="例如: 高铁G1234、东航MU5678" />
                        </Form.Item>
                        <div style={{ background: colorFillQuaternary, padding: 12, borderRadius: 8, marginBottom: 16, border: `1px solid ${colorBorderSecondary}` }}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                            <SwapOutlined /> 出发地信息
                          </Text>
                          <Form.Item name="from_location_name" label="出发地点" style={{ marginBottom: 8 }}>
                            <AutoComplete
                              options={locationOptions}
                              onSearch={handleLocationSearch}
                              onSelect={(_value: string, option: any) => {
                                const poi = option.poi;
                                if (poi) {
                                  itineraryForm.setFieldsValue({
                                    from_location_name: poi.name,
                                    from_location_address: poi.address || '',
                                    from_latitude: poi.latitude,
                                    from_longitude: poi.longitude,
                                  });
                                  setLocationOptions([]);
                                }
                              }}
                              placeholder="搜索出发地点..."
                              notFoundContent={locationSearchLoading ? <Spin size="small" /> : null}
                              allowClear
                            />
                          </Form.Item>
                          <Form.Item name="from_location_address" label="出发地址" style={{ marginBottom: 8 }}>
                            <Input placeholder="出发地详细地址" />
                          </Form.Item>
                          <Form.Item name="departure_time" label="出发时间" style={{ marginBottom: 0 }}>
                            <TimePicker format="HH:mm" style={{ width: '100%' }} placeholder="选择出发时间" />
                          </Form.Item>
                        </div>
                        <Form.Item name="from_latitude" hidden><Input /></Form.Item>
                        <Form.Item name="from_longitude" hidden><Input /></Form.Item>

                        <div style={{ background: colorFillQuaternary, padding: 12, borderRadius: 8, marginBottom: 16, border: `1px solid ${colorBorderSecondary}` }}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                            <EnvironmentOutlined /> 到达地信息
                          </Text>
                          <Form.Item name="location_name" label="到达地点" style={{ marginBottom: 8 }}>
                            <AutoComplete
                              options={locationOptions}
                              onSearch={handleLocationSearch}
                              onSelect={(_value: string, option: any) => {
                                const poi = option.poi;
                                if (poi) {
                                  itineraryForm.setFieldsValue({
                                    location_name: poi.name,
                                    location_address: poi.address || '',
                                    latitude: poi.latitude,
                                    longitude: poi.longitude,
                                    poi_id: poi.id,
                                  });
                                  setLocationOptions([]);
                                }
                              }}
                              placeholder="搜索到达地点..."
                              notFoundContent={locationSearchLoading ? <Spin size="small" /> : null}
                              allowClear
                            />
                          </Form.Item>
                          <Form.Item name="location_address" label="到达地址" style={{ marginBottom: 8 }}>
                            <Input placeholder="到达地详细地址" />
                          </Form.Item>
                          <Form.Item name="arrival_time" label="到达时间" style={{ marginBottom: 0 }}>
                            <TimePicker format="HH:mm" style={{ width: '100%' }} placeholder="选择到达时间" />
                          </Form.Item>
                        </div>
                        <Form.Item name="latitude" hidden><Input /></Form.Item>
                        <Form.Item name="longitude" hidden><Input /></Form.Item>
                        <Form.Item name="poi_id" hidden><Input /></Form.Item>
                        <Form.Item name="cost" label="费用（元）">
                          <InputNumber style={{ width: '100%' }} min={0} />
                        </Form.Item>
                        <Form.Item name="notes" label="备注">
                          <TextArea rows={2} />
                        </Form.Item>
                        <Form.Item name="description" label="描述">
                          <TextArea rows={2} />
                        </Form.Item>
                      </>
                    )}
                  </>
                );
              }

              // 景点 (attraction) 和 餐饮 (food) 共用表单
              return (
                <>
                  <Form.Item name="title" label={category === 'food' ? '餐厅名称' : '名称'} rules={[{ required: true, message: '请输入名称' }]}>
                    <AutoComplete
                      options={locationOptions}
                      onSearch={handleLocationSearch}
                      onSelect={(_value: string, option: any) => {
                        const poi = option.poi;
                        if (poi) {
                          itineraryForm.setFieldsValue({
                            title: poi.name,
                            location_name: poi.name,
                            location_address: poi.address || '',
                            latitude: poi.latitude,
                            longitude: poi.longitude,
                            poi_id: poi.id,
                          });
                          setLocationOptions([]);
                        }
                      }}
                      placeholder="输入名称搜索地点..."
                      notFoundContent={locationSearchLoading ? <Spin size="small" /> : null}
                      allowClear
                    />
                  </Form.Item>
                  <Form.Item name="location_name" hidden><Input /></Form.Item>
                  <Form.Item name="location_address" hidden><Input /></Form.Item>
                  <Form.Item name="latitude" hidden><Input /></Form.Item>
                  <Form.Item name="longitude" hidden><Input /></Form.Item>
                  <Form.Item name="poi_id" hidden><Input /></Form.Item>
                  <Form.Item name="day_number" hidden><Input /></Form.Item>
                  <Form.Item name="time_range" label={category === 'food' ? '用餐时间' : '游览时间'}>
                    <TimePicker.RangePicker format="HH:mm" style={{ width: '100%' }} />
                  </Form.Item>
                  {category === 'attraction' && (
                    <Form.Item name="duration_minutes" label="预计时长（分钟）">
                      <InputNumber style={{ width: '100%' }} min={0} />
                    </Form.Item>
                  )}
                  <Form.Item name="cost" label="费用（元）">
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                  <Form.Item name="notes" label="备注">
                    <TextArea rows={2} />
                  </Form.Item>
                </>
              );
            }}
          </Form.Item>
        </Form>
      </Drawer>

      {/* 搜索地点抽屉 */}
      <Drawer
        title="搜索地点"
        open={searchDrawerOpen}
        onClose={() => setSearchDrawerOpen(false)}
        width={400}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="搜索景点、餐厅、酒店..."
              value={searchKeywords}
              onChange={(e) => setSearchKeywords(e.target.value)}
              onPressEnter={handleSearch}
              style={{ flex: 1 }}
            />
            <Input
              placeholder="城市"
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              style={{ width: 100 }}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={searchLoading}>
              搜索
            </Button>
          </Space.Compact>
          
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>添加到: </Text>
            <Select
              value={selectedDay}
              onChange={setSelectedDay}
              options={daysArray.map(d => ({ value: d, label: `Day ${d}` }))}
              style={{ width: 100 }}
              size="small"
            />
          </div>

          {searchLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : searchResults.length > 0 ? (
            <List
              dataSource={searchResults}
              renderItem={poi => (
                <List.Item
                  actions={[
                    <Button
                      type="link"
                      size="small"
                      onClick={() => handleAddFromSearch(poi)}
                    >
                      添加
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<EnvironmentOutlined />} style={{ background: '#1890ff' }} />}
                    title={poi.name}
                    description={
                      <Space direction="vertical" size={0}>
                        {poi.address && <Text type="secondary" style={{ fontSize: 12 }}>{poi.address}</Text>}
                        {poi.type && <Tag style={{ fontSize: 10 }}>{poi.type}</Tag>}
                        {poi.rating && <Text type="secondary" style={{ fontSize: 12 }}>评分: {poi.rating}</Text>}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="输入关键词搜索地点"
            />
          )}
        </Space>
      </Drawer>

      {/* 行程详情抽屉 */}
      <ItineraryDetailDrawer
        item={selectedItinerary}
        open={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false);
          setSelectedItinerary(null);
        }}
        onUpdate={() => {
          if (currentPlan) {
            loadPlanDetail(currentPlan.id);
          }
        }}
        routeInfo={
          selectedItinerary && selectedItinerary.transport_duration
            ? {
                driving: {
                  duration: (selectedItinerary.transport_duration || 0) * 60, // 转回秒
                  distance: selectedItinerary.transport_distance || 0,
                  toll: selectedItinerary.transport_cost || 0,
                }
              }
            : undefined
        }
      />

      {/* 导出图片弹窗 */}
      <Modal
        title="导出行程图片"
        open={exportModalOpen}
        onCancel={() => setExportModalOpen(false)}
        width={850}
        footer={[
          <Button key="cancel" onClick={() => setExportModalOpen(false)}>
            取消
          </Button>,
          <Button
            key="export"
            type="primary"
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={handleExportImage}
          >
            {exporting ? '导出中...' : '下载图片'}
          </Button>,
        ]}
      >
        <div style={{ maxHeight: '70vh', overflow: 'auto', padding: '16px 0' }}>
          <TravelExportCard ref={exportRef} plan={currentPlan} cityGroups={cityGroups} />
        </div>
      </Modal>
    </BaseLayout>
  );
};

export default Travel;

