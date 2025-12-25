import React, { useEffect, useState } from 'react';
import { BaseLayout } from '../components/layout/BaseLayout';
import { assetApi } from '../services/api';
import type { Asset } from '../types';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Card,
  Row,
  Col,
  Statistic,
  Popconfirm,
  Tag,
  Space,
  message,
  DatePicker,
  Segmented
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  WalletOutlined,
  BankOutlined,
  FundOutlined,
  StockOutlined,
  GoldOutlined,
  DollarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const { RangePicker } = DatePicker;

const CATEGORIES = ['现金', '活期储蓄', '定期储蓄', '基金', '股票', '黄金现货'];

const CHART_COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f4a261', '#e9c46a', '#a8dadc', '#f1faee', '#e63946', '#2a9d8f'];

const getCategoryIcon = (category: string) => {
    switch(category) {
        case '现金': return <DollarOutlined />;
        case '活期储蓄': 
        case '定期储蓄': return <BankOutlined />;
        case '基金': return <FundOutlined />;
        case '股票': return <StockOutlined />;
        case '黄金现货': return <GoldOutlined />;
        default: return <WalletOutlined />;
    }
};

const getCategoryColor = (category: string) => {
    switch(category) {
        case '现金': return 'green';
        case '活期储蓄': return 'cyan';
        case '定期储蓄': return 'blue';
        case '基金': return 'purple';
        case '股票': return 'red';
        case '黄金现货': return 'gold';
        default: return 'default';
    }
};

const Assets: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  // Chart state
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(90, 'day'),
    dayjs()
  ]);
  const [pieType, setPieType] = useState<string>('category');
  const [lineType, setLineType] = useState<string>('total');
  const [chartData, setChartData] = useState<{
    pie: { labels: string[]; data: number[] };
    line: { labels: string[]; data?: number[]; datasets?: Array<{ label: string; data: number[]; borderColor: string }> };
  } | null>(null);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const response = await assetApi.getAll();
      setAssets(response.data.assets || []);
    } catch (error) {
      console.error('Failed to load assets:', error);
      messageApi.error('加载资产失败');
    } finally {
      setLoading(false);
    }
  };

  const loadChartData = async () => {
    try {
      const response = await assetApi.getChartData({
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
        type: lineType,
        pie_type: pieType,
      });
      setChartData(response.data);
    } catch (error) {
      console.error('Failed to load chart data:', error);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  useEffect(() => {
    loadChartData();
  }, [dateRange, pieType, lineType]);

  const totalAssets = assets.reduce((sum, a) => sum + a.amount, 0);

  const categoryTotals = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = assets.filter((a) => a.category === cat).reduce((sum, a) => sum + a.amount, 0);
    return acc;
  }, {} as Record<string, number>);

  // Prepare pie chart data
  const pieChartData = chartData?.pie?.labels?.map((label, index) => ({
    name: label,
    value: chartData.pie.data[index],
  })) || [];

  // Prepare line chart data
  const lineChartData = chartData?.line?.labels?.map((label, index) => {
    const point: Record<string, string | number> = { date: label };
    if (chartData.line.datasets) {
      chartData.line.datasets.forEach((ds) => {
        point[ds.label] = ds.data[index];
      });
    }
    return point;
  }) || [];

  const setQuickDateRange = (days: number) => {
    setDateRange([dayjs().subtract(days, 'day'), dayjs()]);
  };

  const handleSubmit = async (values: { name: string; category: string; amount: string }) => {
    try {
      const data = {
        name: values.name,
        category: values.category,
        amount: parseFloat(values.amount),
      };

      if (editingAsset) {
        await assetApi.update(editingAsset.id, data);
        messageApi.success('资产更新成功');
      } else {
        await assetApi.create(data);
        messageApi.success('资产添加成功');
      }

      setIsModalOpen(false);
      setEditingAsset(null);
      form.resetFields();
      loadAssets();
    } catch (error) {
      console.error('Failed to save asset:', error);
      messageApi.error('保存失败');
    }
  };

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    form.setFieldsValue({
      name: asset.name,
      category: asset.category,
      amount: asset.amount,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await assetApi.delete(id);
      messageApi.success('资产删除成功');
      loadAssets();
    } catch (error) {
      console.error('Failed to delete asset:', error);
      messageApi.error('删除失败');
    }
  };

  const openAddModal = () => {
    setEditingAsset(null);
    form.resetFields();
    form.setFieldsValue({ category: CATEGORIES[0] });
    setIsModalOpen(true);
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Asset) => (
        <Space>
           {getCategoryIcon(record.category)}
           <span style={{ fontWeight: 500 }}>{text}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => (
        <Tag color={getCategoryColor(category)}>{category}</Tag>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => (
        <span style={{ fontWeight: 'bold', color: amount >= 0 ? '#3f8600' : '#cf1322' }}>
            ¥{amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
        </span>
      ),
      sorter: (a: Asset, b: Asset) => a.amount - b.amount,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
      sorter: (a: Asset, b: Asset) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Asset) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)} 
          />
          <Popconfirm
            title="确定删除这个资产吗?"
            onConfirm={() => handleDelete(record.id)}
            okText="是"
            cancelText="否"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <BaseLayout 
        title="资产管理" 
        subtitle="管理财务, 规划未来"
        headerActions={
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
                添加资产
            </Button>
        }
    >
      {contextHolder}
      
      {/* Overview Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={8}>
             <Card bordered={false} style={{ height: '100%', background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', color: '#fff' }}>
                 <Statistic 
                    title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>总资产</span>}
                    value={totalAssets}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: '#fff', fontSize: 32 }}
                 />
                 <div style={{ marginTop: 16, opacity: 0.8 }}>
                    <WalletOutlined style={{ fontSize: 24 }} />
                 </div>
             </Card>
          </Col>
          <Col xs={24} md={16}>
              <Row gutter={[8, 8]}>
                  {CATEGORIES.map(cat => (
                      <Col xs={12} sm={8} key={cat}>
                          <Card size="small" bordered={false} hoverable>
                              <Statistic
                                title={cat}
                                value={categoryTotals[cat] || 0}
                                precision={0}
                                prefix="¥"
                                valueStyle={{ fontSize: 16, fontWeight: 500 }}
                              />
                          </Card>
                      </Col>
                  ))}
              </Row>
          </Col>
      </Row>

      {/* Charts Section */}
      <Card bordered={false} style={{ borderRadius: 8, marginBottom: 24 }}>
        {/* Date Range Selector */}
        <Row gutter={16} align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
            />
          </Col>
          <Col>
            <Space>
              <Button size="small" onClick={() => setQuickDateRange(7)}>7天</Button>
              <Button size="small" onClick={() => setQuickDateRange(30)}>30天</Button>
              <Button size="small" onClick={() => setQuickDateRange(90)}>90天</Button>
              <Button size="small" onClick={() => setQuickDateRange(365)}>1年</Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={24}>
          {/* Pie Chart */}
          <Col xs={24} lg={12}>
            <Card
              title="资产分布"
              size="small"
              bordered={false}
              style={{ background: '#fafafa' }}
              extra={
                <Select
                  value={pieType}
                  onChange={setPieType}
                  size="small"
                  style={{ width: 100 }}
                  options={[
                    { value: 'category', label: '按分类' },
                    { value: 'type', label: '按类型' },
                    { value: 'item', label: '按条目' },
                  ]}
                />
              }
            >
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>

          {/* Line Chart */}
          <Col xs={24} lg={12}>
            <Card
              title="资产趋势"
              size="small"
              bordered={false}
              style={{ background: '#fafafa' }}
              extra={
                <Segmented
                  size="small"
                  value={lineType}
                  onChange={(v) => setLineType(v as string)}
                  options={[
                    { value: 'total', label: '总资产' },
                    { value: 'category', label: '分类' },
                  ]}
                />
              }
            >
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`} />
                    {chartData?.line?.datasets?.map((ds, index) => (
                      <Line
                        key={ds.label}
                        type="monotone"
                        dataKey={ds.label}
                        stroke={CHART_COLORS[index % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                    {lineType === 'category' && <Legend />}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Asset Table */}
      <Card bordered={false} style={{ borderRadius: 8 }}>
          <Table 
            columns={columns} 
            dataSource={assets} 
            rowKey="id" 
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
      </Card>

      {/* Edit/Create Modal */}
      <Modal
        title={editingAsset ? '编辑资产' : '添加资产'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ category: CATEGORIES[0] }}
        >
          <Form.Item
            name="name"
            label="资产名称"
            rules={[{ required: true, message: '请输入资产名称' }]}
          >
            <Input placeholder="例如：招商银行储蓄卡" />
          </Form.Item>

          <Form.Item
            name="category"
            label="类型"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Select>
              {CATEGORIES.map(cat => (
                <Select.Option key={cat} value={cat}>{cat}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="amount"
            label="金额"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <Input type="number" step="0.01" prefix="¥" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
                <Button onClick={() => setIsModalOpen(false)}>取消</Button>
                <Button type="primary" htmlType="submit">
                {editingAsset ? '保存' : '添加'}
                </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </BaseLayout>
  );
};

export default Assets;
