import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { CHART_COLORS, getCategoryInfo } from '../../utils/constants';
import LoadingSpinner from '../common/LoadingSpinner';
import './Analytics.css';

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [analyticsRes, recsRes] = await Promise.all([
        api.get('/subscriptions/analytics'),
        api.get('/subscriptions/recommendations')
      ]);
      setAnalytics(analyticsRes.data.data);
      setRecommendations(recsRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.setTextColor(99, 102, 241);
    doc.text('SOCA — Subscription Report', 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Summary', 14, 44);

    doc.autoTable({
      startY: 48,
      head: [['Metric', 'Value']],
      body: [
        ['Monthly Spend', formatCurrency(analytics?.totalMonthly || 0)],
        ['Yearly Spend', formatCurrency(analytics?.totalYearly || 0)],
        ['Active Subscriptions', String(analytics?.activeCount || 0)],
        ['Average Per Subscription', formatCurrency(analytics?.averagePerSubscription || 0)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241] }
    });

    if (analytics?.categoryBreakdown?.length > 0) {
      doc.text('Category Breakdown', 14, doc.lastAutoTable.finalY + 14);
      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 18,
        head: [['Category', 'Count', 'Monthly Cost', '% of Total']],
        body: analytics.categoryBreakdown.map(c => [
          getCategoryInfo(c.category).label,
          String(c.count),
          formatCurrency(c.monthlyTotal),
          `${c.percentage}%`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] }
      });
    }

    doc.save('SOCA_Report.pdf');
  };

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['SOCA Subscription Report'],
      ['Generated', new Date().toLocaleDateString()],
      [],
      ['Metric', 'Value'],
      ['Monthly Spend', analytics?.totalMonthly || 0],
      ['Yearly Spend', analytics?.totalYearly || 0],
      ['Active Subscriptions', analytics?.activeCount || 0],
      ['Average Per Subscription', analytics?.averagePerSubscription || 0],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

    if (analytics?.categoryBreakdown) {
      const catData = [
        ['Category', 'Count', 'Monthly Cost', '% of Total'],
        ...analytics.categoryBreakdown.map(c => [
          getCategoryInfo(c.category).label, c.count, c.monthlyTotal, c.percentage
        ])
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(catData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Categories');
    }

    if (analytics?.monthlyTrend) {
      const trendData = [
        ['Month', 'Total'],
        ...analytics.monthlyTrend.map(t => [t.month, t.total])
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(trendData);
      XLSX.utils.book_append_sheet(wb, ws3, 'Monthly Trend');
    }

    XLSX.writeFile(wb, 'SOCA_Report.xlsx');
  };

  if (loading) return <LoadingSpinner text="Loading analytics..." />;

  const pieData = analytics?.categoryBreakdown?.map((c, i) => ({
    name: getCategoryInfo(c.category).label,
    value: c.monthlyTotal,
    color: CHART_COLORS[i % CHART_COLORS.length]
  })) || [];

  const severityIcon = { warning: '⚠️', info: 'ℹ️', tip: '💡' };

  return (
    <div className="analytics-page" id="analytics-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Deep insights into your subscription spending</p>
        </div>
        <div className="export-btns">
          <button className="btn btn-secondary btn-sm" onClick={exportPDF} id="export-pdf">📄 PDF</button>
          <button className="btn btn-secondary btn-sm" onClick={exportExcel} id="export-excel">📊 Excel</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="analytics-summary">
        <div className="analytics-summary-card">
          <span className="analytics-summary-label">Monthly Spend</span>
          <span className="analytics-summary-value">{formatCurrency(analytics?.totalMonthly || 0)}</span>
        </div>
        <div className="analytics-summary-card">
          <span className="analytics-summary-label">Yearly Spend</span>
          <span className="analytics-summary-value">{formatCurrency(analytics?.totalYearly || 0)}</span>
        </div>
        <div className="analytics-summary-card">
          <span className="analytics-summary-label">Active Subs</span>
          <span className="analytics-summary-value">{analytics?.activeCount || 0}</span>
        </div>
        <div className="analytics-summary-card highlight">
          <span className="analytics-summary-label">Potential Savings</span>
          <span className="analytics-summary-value savings">{formatCurrency(recommendations?.totalPotentialSavings || 0)}/mo</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="analytics-tabs">
        {['overview', 'categories', 'recommendations'].map(tab => (
          <button
            key={tab}
            className={`analytics-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' ? '📈 Overview' : tab === 'categories' ? '📊 Categories' : '💡 Recommendations'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="analytics-content animate-fade-in">
          <div className="analytics-charts-grid">
            <div className="glass-card analytics-chart-card">
              <h3 className="card-title">Spending Over Time</h3>
              {analytics?.monthlyTrend?.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={analytics.monthlyTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={v => `$${v}`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '10px', fontSize: '13px' }}
                      formatter={v => [formatCurrency(v), 'Total']}
                    />
                    <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} fill="url(#areaGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="empty-chart"><p>No data yet</p></div>}
            </div>

            <div className="glass-card analytics-chart-card">
              <h3 className="card-title">Monthly Comparison</h3>
              {analytics?.monthlyTrend?.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={analytics.monthlyTrend.slice(-6)} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={v => `$${v}`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '10px', fontSize: '13px' }}
                      formatter={v => [formatCurrency(v), 'Total']}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {analytics.monthlyTrend.slice(-6).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="empty-chart"><p>No data yet</p></div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="analytics-content animate-fade-in">
          <div className="analytics-charts-grid">
            <div className="glass-card analytics-chart-card">
              <h3 className="card-title">Category Distribution</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={120}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '10px', fontSize: '13px' }}
                      formatter={v => formatCurrency(v)}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="empty-chart"><p>No data yet</p></div>}
            </div>

            <div className="glass-card analytics-chart-card">
              <h3 className="card-title">Category Details</h3>
              <div className="category-list">
                {analytics?.categoryBreakdown?.map((cat, idx) => {
                  const catInfo = getCategoryInfo(cat.category);
                  return (
                    <div key={cat.category} className="category-item">
                      <div className="category-item-left">
                        <div className="category-item-icon" style={{ background: `${catInfo.color}18`, color: catInfo.color }}>
                          {catInfo.icon}
                        </div>
                        <div>
                          <p className="category-item-name">{catInfo.label}</p>
                          <p className="category-item-count">{cat.count} subscription{cat.count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="category-item-right">
                        <p className="category-item-cost">{formatCurrency(cat.monthlyTotal)}/mo</p>
                        <div className="category-item-bar">
                          <div className="category-item-bar-fill" style={{ width: `${cat.percentage}%`, background: catInfo.color }} />
                        </div>
                        <p className="category-item-pct">{cat.percentage}%</p>
                      </div>
                    </div>
                  );
                })}
                {(!analytics?.categoryBreakdown || analytics.categoryBreakdown.length === 0) && (
                  <div className="empty-chart"><p>No categories yet</p></div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'recommendations' && (
        <div className="analytics-content animate-fade-in">
          <div className="recommendations-grid">
            {recommendations?.recommendations?.length > 0 ? (
              recommendations.recommendations.map((rec, idx) => (
                <div key={idx} className={`glass-card recommendation-card rec-${rec.severity}`}>
                  <div className="rec-header">
                    <span className="rec-icon">{severityIcon[rec.severity] || '💡'}</span>
                    <span className="rec-type">{rec.type.replace('_', ' ')}</span>
                    {rec.potentialSavings > 0 && (
                      <span className="rec-savings">Save {formatCurrency(rec.potentialSavings)}/mo</span>
                    )}
                  </div>
                  <p className="rec-message">{rec.message}</p>
                  <p className="rec-sub">Related: {rec.subscription}</p>
                </div>
              ))
            ) : (
              <div className="glass-card empty-state" style={{ gridColumn: '1 / -1' }}>
                <div className="empty-state-icon">🎉</div>
                <h3>All Optimized!</h3>
                <p>No recommendations at this time. Your subscriptions look great!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
