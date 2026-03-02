import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BaseLayout } from '../components/layout/BaseLayout';
import { learningApi } from '../services/api';
import type { LearningQuestion, LearningStatsResponse } from '../types';
import {
  Card,
  Button,
  Tabs,
  Progress,
  Radio,
  Tag,
  Table,
  Statistic,
  Row,
  Col,
  Space,
  message as antMessage,
  Empty,
  Spin,
  Typography,
  theme,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LeftOutlined,
  RightOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  FireOutlined,
  BarChartOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

const CATEGORY_LABELS: Record<string, string> = {
  databases: '数据库',
  api_design: 'API设计',
  security: '安全',
  performance: '性能优化',
  architecture: '架构设计',
  networking: '网络',
  devops: '运维部署',
  concurrency: '并发编程',
  caching: '缓存',
  testing: '测试',
};

const DIFFICULTY_CONFIG: Record<string, { color: string; label: string }> = {
  easy: { color: 'green', label: '简单' },
  medium: { color: 'orange', label: '中等' },
  hard: { color: 'red', label: '困难' },
};

const Learning: React.FC = () => {
  const [questions, setQuestions] = useState<LearningQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<LearningStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('quiz');
  const timerRef = useRef<number>(0);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const {
    token: { colorSuccess, colorError },
  } = theme.useToken();

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await learningApi.getQuestions();
      setQuestions(res.data.questions);
      // Navigate to first unanswered question
      const firstUnanswered = res.data.questions.findIndex(q => !q.answered);
      setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
    } catch {
      antMessage.error('加载题目失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await learningApi.getStats();
      setStats(res.data);
    } catch {
      antMessage.error('加载统计数据失败');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // Timer for current question
  useEffect(() => {
    const q = questions[currentIndex];
    if (q && !q.answered) {
      timerRef.current = 0;
      timerInterval.current = setInterval(() => {
        timerRef.current += 1;
      }, 1000);
    }
    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    };
  }, [currentIndex, questions]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await learningApi.generate();
      if (res.data.success) {
        antMessage.success(`成功生成 ${res.data.generated} 道题目`);
        await loadQuestions();
      } else {
        antMessage.warning(res.data.error || '生成失败');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      antMessage.error(error.response?.data?.error || '生成题目失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitAnswer = async () => {
    const q = questions[currentIndex];
    if (!q || !selectedAnswer) return;

    setSubmitting(true);
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }

    try {
      const res = await learningApi.submitAnswer({
        question_id: q.id,
        selected_answer: selectedAnswer,
        time_spent: timerRef.current,
      });

      if (res.data.success) {
        // Update local state
        const updated = [...questions];
        updated[currentIndex] = {
          ...q,
          answered: true,
          selected_answer: selectedAnswer,
          is_correct: res.data.is_correct,
          correct_answer: res.data.correct_answer,
          explanation: res.data.explanation,
        };
        setQuestions(updated);
      }
    } catch {
      antMessage.error('提交答案失败');
    } finally {
      setSubmitting(false);
    }
  };

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
      setSelectedAnswer(null);
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'stats') {
      loadStats();
    }
  };

  const currentQuestion = questions[currentIndex];
  const answeredCount = questions.filter(q => q.answered).length;
  const correctCount = questions.filter(q => q.is_correct).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  // Quiz Tab Content
  const renderQuiz = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      );
    }

    if (questions.length === 0) {
      return (
        <Card>
          <Empty description="今日还没有题目">
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleGenerate}
              loading={generating}
              size="large"
            >
              生成今日题目
            </Button>
          </Empty>
        </Card>
      );
    }

    // Summary view when all questions answered
    if (allAnswered) {
      return (
        <div>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <TrophyOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
              <h2 style={{ margin: '0 0 8px' }}>今日测验完成</h2>
              <Text type="secondary">
                {correctCount}/{questions.length} 正确 ({questions.length > 0 ? Math.round(correctCount / questions.length * 100) : 0}%)
              </Text>
              <Progress
                percent={Math.round(correctCount / questions.length * 100)}
                status={correctCount / questions.length >= 0.6 ? 'success' : 'exception'}
                style={{ maxWidth: 300, margin: '16px auto 0' }}
              />
            </div>
          </Card>

          {/* Still allow reviewing questions */}
          {renderQuestionCard()}

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleGenerate}
              loading={generating}
            >
              再来一组
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div>
        {/* Progress */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>
              进度: {answeredCount}/{questions.length}
            </Text>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleGenerate}
              loading={generating}
              size="small"
            >
              生成更多
            </Button>
          </div>
          <Progress
            percent={Math.round(answeredCount / questions.length * 100)}
            showInfo={false}
            style={{ marginTop: 8 }}
          />
        </Card>

        {renderQuestionCard()}
      </div>
    );
  };

  const renderQuestionCard = () => {
    if (!currentQuestion) return null;

    const diffConfig = DIFFICULTY_CONFIG[currentQuestion.difficulty] || DIFFICULTY_CONFIG.medium;
    const isAnswered = currentQuestion.answered;

    const getOptionStyle = (option: string) => {
      if (!isAnswered) return {};
      if (option === currentQuestion.correct_answer) {
        return { borderColor: colorSuccess, background: `${colorSuccess}11` };
      }
      if (option === currentQuestion.selected_answer && !currentQuestion.is_correct) {
        return { borderColor: colorError, background: `${colorError}11` };
      }
      return {};
    };

    const getOptionIcon = (option: string) => {
      if (!isAnswered) return null;
      if (option === currentQuestion.correct_answer) {
        return <CheckCircleOutlined style={{ color: colorSuccess }} />;
      }
      if (option === currentQuestion.selected_answer && !currentQuestion.is_correct) {
        return <CloseCircleOutlined style={{ color: colorError }} />;
      }
      return null;
    };

    return (
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span>第 {currentIndex + 1}/{questions.length} 题</span>
            <Space>
              <Tag color={diffConfig.color}>{diffConfig.label}</Tag>
              <Tag>{CATEGORY_LABELS[currentQuestion.category] || currentQuestion.category}</Tag>
            </Space>
          </div>
        }
      >
        {/* Question text */}
        <div style={{ fontSize: 16, marginBottom: 24, lineHeight: 1.8 }}>
          {currentQuestion.question_text}
        </div>

        {/* Options */}
        <Radio.Group
          value={isAnswered ? currentQuestion.selected_answer : selectedAnswer}
          onChange={(e) => !isAnswered && setSelectedAnswer(e.target.value)}
          disabled={isAnswered}
          style={{ width: '100%' }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {(['A', 'B', 'C', 'D'] as const).map((opt) => {
              const optionKey = `option_${opt.toLowerCase()}` as keyof LearningQuestion;
              return (
                <div
                  key={opt}
                  style={{
                    padding: '12px 16px',
                    border: '1px solid #d9d9d9',
                    borderRadius: 8,
                    cursor: isAnswered ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s',
                    ...getOptionStyle(opt),
                  }}
                  onClick={() => !isAnswered && setSelectedAnswer(opt)}
                >
                  <Radio value={opt} style={{ width: '100%' }}>
                    <span style={{ marginLeft: 4 }}>
                      {opt}. {currentQuestion[optionKey] as string}
                    </span>
                  </Radio>
                  {getOptionIcon(opt)}
                </div>
              );
            })}
          </Space>
        </Radio.Group>

        {/* Explanation after answering */}
        {isAnswered && currentQuestion.explanation && (
          <div style={{
            marginTop: 20,
            padding: 16,
            background: currentQuestion.is_correct ? `${colorSuccess}11` : `${colorError}11`,
            borderRadius: 8,
            borderLeft: `4px solid ${currentQuestion.is_correct ? colorSuccess : colorError}`
          }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>
              {currentQuestion.is_correct ? '回答正确' : `回答错误 - 正确答案: ${currentQuestion.correct_answer}`}
            </div>
            <Text type="secondary">{currentQuestion.explanation}</Text>
          </div>
        )}

        {/* Actions */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            icon={<LeftOutlined />}
            onClick={() => goToQuestion(currentIndex - 1)}
            disabled={currentIndex === 0}
          >
            上一题
          </Button>

          {!isAnswered ? (
            <Button
              type="primary"
              onClick={handleSubmitAnswer}
              loading={submitting}
              disabled={!selectedAnswer}
            >
              提交答案
            </Button>
          ) : (
            <span />
          )}

          <Button
            onClick={() => goToQuestion(currentIndex + 1)}
            disabled={currentIndex === questions.length - 1}
          >
            下一题 <RightOutlined />
          </Button>
        </div>

        {/* Question dots navigation */}
        <div style={{
          marginTop: 20,
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          {questions.map((q, i) => (
            <div
              key={q.id}
              onClick={() => goToQuestion(i)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: i === currentIndex ? 600 : 400,
                border: i === currentIndex ? '2px solid #1890ff' : '1px solid #d9d9d9',
                background: q.answered
                  ? q.is_correct ? colorSuccess : colorError
                  : i === currentIndex ? '#e6f7ff' : 'transparent',
                color: q.answered ? '#fff' : undefined,
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </Card>
    );
  };

  // Stats Tab Content
  const renderStats = () => {
    if (statsLoading || !stats) {
      return (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      );
    }

    const categoryColumns = [
      {
        title: '分类',
        dataIndex: 'category',
        render: (cat: string) => CATEGORY_LABELS[cat] || cat,
      },
      {
        title: '答题数',
        dataIndex: 'total',
      },
      {
        title: '正确数',
        dataIndex: 'correct',
      },
      {
        title: '正确率',
        dataIndex: 'accuracy',
        render: (val: number) => (
          <span style={{ color: val >= 60 ? colorSuccess : colorError }}>
            {val}%
          </span>
        ),
      },
    ];

    const trendColumns = [
      {
        title: '日期',
        dataIndex: 'date',
        render: (d: string) => d.slice(5), // MM-DD
      },
      {
        title: '答题数',
        dataIndex: 'answered',
      },
      {
        title: '正确数',
        dataIndex: 'correct',
      },
      {
        title: '正确率',
        dataIndex: 'accuracy',
        render: (val: number) => val > 0 ? `${val}%` : '-',
      },
    ];

    return (
      <div>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="总答题数"
                value={stats.total_answered}
                prefix={<BarChartOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="总正确率"
                value={stats.accuracy}
                suffix="%"
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: stats.accuracy >= 60 ? colorSuccess : colorError }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="连续天数"
                value={stats.streak}
                suffix="天"
                prefix={<FireOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="今日进度"
                value={stats.today.answered}
                suffix={`/ ${stats.today.total}`}
                prefix={<TrophyOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Card title="分类统计" style={{ marginTop: 16 }}>
          <Table
            dataSource={stats.categories}
            columns={categoryColumns}
            rowKey="category"
            pagination={false}
            size="small"
          />
        </Card>

        <Card title="近7天趋势" style={{ marginTop: 16 }}>
          <Table
            dataSource={stats.trend}
            columns={trendColumns}
            rowKey="date"
            pagination={false}
            size="small"
          />
        </Card>
      </div>
    );
  };

  return (
    <BaseLayout>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={[
          {
            key: 'quiz',
            label: '今日测验',
            children: renderQuiz(),
          },
          {
            key: 'stats',
            label: '学习统计',
            children: renderStats(),
          },
        ]}
      />
    </BaseLayout>
  );
};

export default Learning;
