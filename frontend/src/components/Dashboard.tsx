import { useState, useMemo } from 'react'
import { Layout, Tabs, Statistic, Row, Col, Card, Tag, Button, Input, Table, Drawer, Descriptions, Space, Progress, Collapse, Badge, Segmented } from 'antd'
import type { SegmentedValue } from 'antd/es/segmented'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { useTaskStore } from '../store/tasks'
import type { Task, TaskStatus, ClusterNode } from '../types'

const { Header, Content } = Layout

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'default', running: 'processing', success: 'success', failed: 'error', retry: 'warning'
}

const NODE_STATUS_ORDER: ClusterNode['status'][] = ['offline', 'overloaded', 'online']

const NODE_STATUS_LABELS: Record<ClusterNode['status'], string> = {
  online: '在线',
  overloaded: '过载',
  offline: '离线',
}

const NODE_STATUS_BADGE: Record<ClusterNode['status'], 'success' | 'warning' | 'error'> = {
  online: 'success',
  overloaded: 'warning',
  offline: 'error',
}

const NODE_STATUS_BG: Record<ClusterNode['status'], string> = {
  online: 'transparent',
  overloaded: '#fffbe6',
  offline: '#fff1f0',
}

const NODE_STATUS_ICON: Record<ClusterNode['status'], string> = {
  online: '✅',
  overloaded: '⚠️',
  offline: '❌',
}

function NodeCard({ node }: { node: ClusterNode }) {
  return (
    <Card
      size="small"
      title={<span>{node.type === 'scheduler' ? '🎯' : '⚙️'} {node.name}</span>}
      extra={<Badge status={NODE_STATUS_BADGE[node.status]} text={NODE_STATUS_LABELS[node.status]} />}
    >
      <Progress percent={Math.round(node.cpu)} strokeColor={node.cpu > 80 ? '#ff4d4f' : '#1890ff'} format={v => `CPU ${v}%`} size="small" />
      <Progress percent={Math.round(node.memory)} strokeColor={node.memory > 80 ? '#ff4d4f' : '#52c41a'} format={v => `MEM ${v}%`} size="small" />
      <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
        任务数: {node.tasks} | 运行时间: {Math.floor(node.uptime / 3600)}h
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const store = useTaskStore()
  const [newTaskName, setNewTaskName] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [nodeFilter, setNodeFilter] = useState<ClusterNode['status'] | 'all' | 'abnormal'>('all')
  const [activeCollapseKeys, setActiveCollapseKeys] = useState<string[]>([])

  const nodeStatusCounts = useMemo(() => {
    const counts: Record<ClusterNode['status'], number> = { online: 0, overloaded: 0, offline: 0 }
    store.nodes.forEach(n => { counts[n.status]++ })
    return counts
  }, [store.nodes])

  const abnormalCount = nodeStatusCounts.offline + nodeStatusCounts.overloaded

  const groupedNodes = useMemo(() => {
    const groups: Record<ClusterNode['status'], ClusterNode[]> = { online: [], overloaded: [], offline: [] }
    store.nodes.forEach(n => { groups[n.status].push(n) })
    return groups
  }, [store.nodes])

  const displayNodes = useMemo(() => {
    if (nodeFilter === 'all') return store.nodes
    if (nodeFilter === 'abnormal') return [...groupedNodes.offline, ...groupedNodes.overloaded]
    return groupedNodes[nodeFilter]
  }, [nodeFilter, store.nodes, groupedNodes])

  const abnormalGroupedNodes = useMemo(() => ({
    offline: groupedNodes.offline,
    overloaded: groupedNodes.overloaded,
  }), [groupedNodes])

  const defaultActiveKeys = useMemo(() => {
    return NODE_STATUS_ORDER.filter(s => nodeStatusCounts[s] > 0 && s !== 'online')
  }, [nodeStatusCounts])

  const handleExpandAll = () => {
    setActiveCollapseKeys(NODE_STATUS_ORDER.filter(s => nodeStatusCounts[s] > 0))
  }

  const handleCollapseAll = () => {
    setActiveCollapseKeys([])
  }

  const handleExpandAbnormal = () => {
    setActiveCollapseKeys(['offline', 'overloaded'].filter(s => nodeStatusCounts[s as ClusterNode['status']] > 0))
  }

  const taskColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 100 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: TaskStatus) => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
    { title: '节点', dataIndex: 'node', key: 'node' },
    { title: '重试', key: 'retries', render: (_: any, r: Task) => `${r.retries}/${r.maxRetries}` },
    { title: '耗时', key: 'duration', render: (_: any, r: Task) => r.duration ? `${(r.duration / 1000).toFixed(1)}s` : '-' },
    { title: '操作', key: 'actions', render: (_: any, r: Task) => (
      <Space>
        {r.status === 'failed' && <Button size="small" type="primary" onClick={() => store.retryTask(r.id)}>重试</Button>}
        {r.status === 'running' && <Button size="small" danger onClick={() => store.cancelTask(r.id)}>取消</Button>}
        <Button size="small" onClick={() => { store.selectTask(r); setDrawerOpen(true) }}>详情</Button>
      </Space>
    )},
  ]

  const successCount = store.tasks.filter(t => t.status === 'success').length
  const failedCount = store.tasks.filter(t => t.status === 'failed').length
  const runningCount = store.tasks.filter(t => t.status === 'running').length

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1 style={{ color: 'white', margin: 0, fontSize: 18 }}>🔧 分布式任务调度与监控平台</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Input placeholder="任务名称" value={newTaskName} onChange={e => setNewTaskName(e.target.value)} style={{ width: 160 }} />
          <Button type="primary" onClick={() => { if (newTaskName) { store.addTask(newTaskName); setNewTaskName('') } }}>
            添加任务
          </Button>
        </div>
      </Header>
      <Content style={{ padding: 16 }}>
        {/* Stats */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card><Statistic title="总任务" value={store.tasks.length} /></Card></Col>
          <Col span={6}><Card><Statistic title="运行中" value={runningCount} valueStyle={{ color: '#1890ff' }} /></Card></Col>
          <Col span={6}><Card><Statistic title="成功" value={successCount} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={6}><Card><Statistic title="失败" value={failedCount} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        </Row>

        <Tabs items={[
          { key: 'metrics', label: '监控指标', children: (
            <Row gutter={16}>
              <Col span={12}>
                <Card title="运行中任务数">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={store.metrics}>
                      <XAxis dataKey="time" tickFormatter={t => new Date(t).toLocaleTimeString()} fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip labelFormatter={t => new Date(t as number).toLocaleString()} />
                      <Area type="monotone" dataKey="runningTasks" stroke="#1890ff" fill="#1890ff" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="成功率 %">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={store.metrics}>
                      <XAxis dataKey="time" tickFormatter={t => new Date(t).toLocaleTimeString()} fontSize={10} />
                      <YAxis domain={[0, 100]} fontSize={10} />
                      <Tooltip labelFormatter={t => new Date(t as number).toLocaleString()} />
                      <Line type="monotone" dataKey="successRate" stroke="#52c41a" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col span={24} style={{ marginTop: 16 }}>
                <Card title="平均延迟 (ms)">
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart data={store.metrics}>
                      <XAxis dataKey="time" tickFormatter={t => new Date(t).toLocaleTimeString()} fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Area type="monotone" dataKey="avgLatency" stroke="#faad14" fill="#faad14" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>
          )},
          { key: 'tasks', label: '任务列表', children: (
            <Table dataSource={store.tasks} columns={taskColumns} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
          )},
          { key: 'nodes', label: (
            <span>
              集群节点
              {abnormalCount > 0 && (
                <Badge count={abnormalCount} style={{ marginLeft: 8, backgroundColor: '#ff4d4f' }} size="small" />
              )}
            </span>
          ), children: (
            <>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <Segmented
                  value={nodeFilter}
                  onChange={(v: SegmentedValue) => setNodeFilter(v as ClusterNode['status'] | 'all' | 'abnormal')}
                  options={[
                    { label: (
                      <span>
                        全部
                        <Badge count={store.nodes.length} style={{ marginLeft: 6, backgroundColor: '#8c8c8c' }} size="small" />
                      </span>
                    ), value: 'all' },
                    { label: (
                      <span style={{ color: abnormalCount > 0 ? '#ff4d4f' : undefined, fontWeight: abnormalCount > 0 ? 600 : undefined }}>
                        🚨 异常
                        <Badge count={abnormalCount} style={{ marginLeft: 6, backgroundColor: '#ff4d4f' }} size="small" />
                      </span>
                    ), value: 'abnormal' },
                    { label: (
                      <span>
                        <Badge status="error" />
                        离线
                        <Badge count={nodeStatusCounts.offline} style={{ marginLeft: 6, backgroundColor: '#ff4d4f' }} size="small" />
                      </span>
                    ), value: 'offline' },
                    { label: (
                      <span>
                        <Badge status="warning" />
                        过载
                        <Badge count={nodeStatusCounts.overloaded} style={{ marginLeft: 6, backgroundColor: '#faad14' }} size="small" />
                      </span>
                    ), value: 'overloaded' },
                    { label: (
                      <span>
                        <Badge status="success" />
                        在线
                        <Badge count={nodeStatusCounts.online} style={{ marginLeft: 6, backgroundColor: '#52c41a' }} size="small" />
                      </span>
                    ), value: 'online' },
                  ]}
                />
                {nodeFilter === 'all' && (
                  <Space size="small">
                    <Button size="small" onClick={handleExpandAll}>全部展开</Button>
                    <Button size="small" onClick={handleCollapseAll}>全部收起</Button>
                    {abnormalCount > 0 && (
                      <Button size="small" type="primary" danger onClick={handleExpandAbnormal}>展开异常</Button>
                    )}
                  </Space>
                )}
                <Button size="small" onClick={() => store.refreshNodes()}>刷新</Button>
                <span style={{ color: '#888', fontSize: 12 }}>
                  共 {store.nodes.length} 个节点
                  {abnormalCount > 0 && <span style={{ color: '#ff4d4f', marginLeft: 8 }}>，{abnormalCount} 个异常</span>}
                </span>
              </div>

              {nodeFilter === 'all' ? (
                <Collapse
                  activeKey={activeCollapseKeys.length > 0 ? activeCollapseKeys : defaultActiveKeys}
                  onChange={(keys) => setActiveCollapseKeys(keys as string[])}
                  items={NODE_STATUS_ORDER.map(status => ({
                    key: status,
                    style: {
                      background: NODE_STATUS_BG[status],
                      marginBottom: 8,
                      borderRadius: 8,
                      border: status !== 'online'
                        ? `2px solid ${status === 'offline' ? '#ff7875' : '#ffc53d'}`
                        : '1px solid #d9d9d9',
                      boxShadow: status !== 'online' && nodeStatusCounts[status] > 0
                        ? `0 2px 8px ${status === 'offline' ? 'rgba(255, 77, 79, 0.15)' : 'rgba(250, 173, 20, 0.15)'}`
                        : undefined,
                    },
                    label: (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{NODE_STATUS_ICON[status]}</span>
                        <Badge
                          status={NODE_STATUS_BADGE[status]}
                          text={
                            <span style={{ fontSize: 15, fontWeight: 600 }}>
                              {NODE_STATUS_LABELS[status]}（{nodeStatusCounts[status]}）
                            </span>
                          }
                        />
                        {status !== 'online' && nodeStatusCounts[status] > 0 && (
                          <Tag color={status === 'offline' ? 'red' : 'gold'} style={{ marginLeft: 8, fontWeight: 500 }}>
                            需关注
                          </Tag>
                        )}
                      </div>
                    ),
                    children: groupedNodes[status].length > 0 ? (
                      <Row gutter={[16, 16]}>
                        {groupedNodes[status].map(node => (
                          <Col span={8} key={node.id}>
                            <NodeCard node={node} />
                          </Col>
                        ))}
                      </Row>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '24px 0', color: '#999', fontSize: 13 }}>
                        ✅ 该分组下暂无节点
                      </div>
                    ),
                  }))}
                />
              ) : nodeFilter === 'abnormal' ? (
                abnormalCount > 0 ? (
                  <Collapse
                    defaultActiveKey={['offline', 'overloaded'].filter(s => nodeStatusCounts[s as ClusterNode['status']] > 0)}
                    items={(['offline', 'overloaded'] as const).map(status => ({
                      key: status,
                      style: {
                        background: NODE_STATUS_BG[status],
                        marginBottom: 8,
                        borderRadius: 8,
                        border: `2px solid ${status === 'offline' ? '#ff7875' : '#ffc53d'}`,
                        boxShadow: `0 2px 8px ${status === 'offline' ? 'rgba(255, 77, 79, 0.15)' : 'rgba(250, 173, 20, 0.15)'}`,
                      },
                      label: (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18 }}>{NODE_STATUS_ICON[status]}</span>
                          <Badge
                            status={NODE_STATUS_BADGE[status]}
                            text={
                              <span style={{ fontSize: 15, fontWeight: 600 }}>
                                {NODE_STATUS_LABELS[status]}（{nodeStatusCounts[status]}）
                              </span>
                            }
                          />
                          <Tag color={status === 'offline' ? 'red' : 'gold'} style={{ marginLeft: 8, fontWeight: 500 }}>
                            需关注
                          </Tag>
                        </div>
                      ),
                      children: abnormalGroupedNodes[status].length > 0 ? (
                        <Row gutter={[16, 16]}>
                          {abnormalGroupedNodes[status].map(node => (
                            <Col span={8} key={node.id}>
                              <NodeCard node={node} />
                            </Col>
                          ))}
                        </Row>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: '#999', fontSize: 13 }}>
                          ✅ 该分组下暂无节点
                        </div>
                      ),
                    }))}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '64px 0', color: '#52c41a' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>所有节点运行正常</div>
                    <div style={{ fontSize: 13, color: '#8c8c8c', marginTop: 8 }}>当前没有离线或过载的节点</div>
                  </div>
                )
              ) : (
                <Row gutter={[16, 16]}>
                  {groupedNodes[nodeFilter].length > 0 ? (
                    groupedNodes[nodeFilter].map(node => (
                      <Col span={8} key={node.id}>
                        <NodeCard node={node} />
                      </Col>
                    ))
                  ) : (
                    <Col span={24}>
                      <div style={{ textAlign: 'center', padding: '64px 0', color: '#999' }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>
                          {NODE_STATUS_ICON[nodeFilter]}
                        </div>
                        <div style={{ fontSize: 15 }}>{NODE_STATUS_LABELS[nodeFilter]}状态下暂无节点</div>
                      </div>
                    </Col>
                  )}
                </Row>
              )}
            </>
          )},
        ]} />

        {/* Task Detail Drawer */}
        <Drawer title="任务详情" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={480}>
          {store.selectedTask && (
            <>
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="ID">{store.selectedTask.id}</Descriptions.Item>
                <Descriptions.Item label="名称">{store.selectedTask.name}</Descriptions.Item>
                <Descriptions.Item label="状态"><Tag color={STATUS_COLORS[store.selectedTask.status]}>{store.selectedTask.status}</Tag></Descriptions.Item>
                <Descriptions.Item label="执行节点">{store.selectedTask.node}</Descriptions.Item>
                <Descriptions.Item label="重试次数">{store.selectedTask.retries}/{store.selectedTask.maxRetries}</Descriptions.Item>
                <Descriptions.Item label="创建时间">{new Date(store.selectedTask.createdAt).toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label="耗时">{store.selectedTask.duration ? `${(store.selectedTask.duration / 1000).toFixed(1)}s` : '-'}</Descriptions.Item>
              </Descriptions>
              <h4 style={{ marginTop: 16 }}>执行日志</h4>
              <pre style={{ background: '#1f1f1f', padding: 12, borderRadius: 8, fontSize: 12, maxHeight: 300, overflow: 'auto' }}>
                {store.selectedTask.logs.join('\n')}
              </pre>
            </>
          )}
        </Drawer>
      </Content>
    </Layout>
  )
}
