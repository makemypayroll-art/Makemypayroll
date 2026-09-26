// ====================================================================
// MODULE 12: MMP Insights — AI-Powered Workforce Intelligence
// MakeMyPayroll AI Workforce Analytics, Excel Ingestion & Natural Language Insights
// ====================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Upload,
  Bot,
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  FileText,
  Sliders,
  Send,
  Bookmark,
  Printer,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Users,
  Clock,
  Activity,
  Layers,
  HelpCircle,
  BarChart3,
  ShieldCheck,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { StorageEngine } from '../../database/storageEngine';
import { MMPInsightService } from '../../services/mmpInsights/mmpInsightService';
import { MMPAnalyticsService } from '../../services/analytics/mmpAnalyticsService';
import {
  MMPDataset,
  MMPDatasetRow,
  MMPAnalyticsMetrics,
  MMPAIAnalysis,
  MMPSavedInsight,
  MMPAIUsage,
  MMPAISettings,
} from '../../database/schema';

export const MMPInsightsModule: React.FC = () => {
  const { currentUser, isSuperAdmin, activeTenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'upload' | 'analysis' | 'ask' | 'saved' | 'reports' | 'settings'>('overview');
  const [dataVersion, setDataVersion] = useState(0);

  // Datasets and analytics state
  const [datasets, setDatasets] = useState<MMPDataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [metrics, setMetrics] = useState<MMPAnalyticsMetrics | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<MMPAIAnalysis | null>(null);
  const [savedInsights, setSavedInsights] = useState<MMPSavedInsight[]>([]);
  const [usage, setUsage] = useState<MMPAIUsage | null>(null);
  const [settings, setSettings] = useState<MMPAISettings | null>(null);

  // Upload and Ask MMP state
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; time: string; analysis?: MMPAIAnalysis }>>([
    {
      sender: 'ai',
      text: 'Hello! I am MMP Insights AI. You can ask me any question about your workforce productivity, department workloads, attendance trends, or overtime anomalies.',
      time: 'Just now',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tenantId = activeTenant?.tenantId || 'NP-000001';

  // Load datasets & usage on mount
  useEffect(() => {
    const list = MMPInsightService.getDatasets(tenantId);
    setDatasets(list);
    setSavedInsights(MMPInsightService.getSavedInsights(tenantId));
    setUsage(MMPInsightService.getUsage(tenantId));
    setSettings(MMPInsightService.getSettings(tenantId));

    if (list.length > 0) {
      const active = list[0];
      setSelectedDatasetId(active.id);
      const rows = MMPInsightService.getDatasetRows(active.id);
      setMetrics(MMPAnalyticsService.calculateMetrics(rows));
    } else {
      // Auto-sync internal HRMS
      const sync = MMPInsightService.generateFromInternalHRMS({
        tenantId,
        userId: currentUser.id,
        userName: currentUser.fullName || currentUser.email,
      });
      setDatasets([sync.dataset]);
      setSelectedDatasetId(sync.dataset.id);
      setMetrics(sync.metrics);
    }
  }, [tenantId, dataVersion]);

  // Handle dataset switch
  const handleSelectDataset = (datasetId: string) => {
    setSelectedDatasetId(datasetId);
    const rows = MMPInsightService.getDatasetRows(datasetId);
    setMetrics(MMPAnalyticsService.calculateMetrics(rows));
    setCurrentAnalysis(null);
  };

  // Handle File Upload (.xlsx, .xls, .csv)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const buffer = evt.target?.result as ArrayBuffer;
          const result = await MMPInsightService.parseUploadedFile({
            fileData: buffer,
            fileName: file.name,
            tenantId,
            userId: currentUser.id,
            userName: currentUser.fullName || currentUser.email,
          });

          setUploadSuccess(`Successfully processed ${file.name} with ${result.dataset.rowCount} rows across ${result.dataset.dataSummary.departmentsCount} department(s).`);
          setDataVersion(v => v + 1);
          setIsUploading(false);
          setActiveTab('overview');
        } catch (err: any) {
          setUploadError(err.message || 'Failed to parse file.');
          setIsUploading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setUploadError(err.message || 'Error reading file.');
      setIsUploading(false);
    }
  };

  // Handle Natural Language Prompt
  const handleRunAIAnalysis = async (promptToRun?: string) => {
    const prompt = promptToRun || customPrompt;
    if (!prompt.trim()) return;

    setIsAnalyzing(true);
    try {
      const res = await MMPInsightService.askMMP({
        prompt,
        datasetId: selectedDatasetId,
        tenantId,
        userId: currentUser.id,
        userName: currentUser.fullName || currentUser.email,
      });
      setCurrentAnalysis(res.analysis);
      setMetrics(res.metrics);
      setActiveTab('analysis');
      setDataVersion(v => v + 1);
    } catch (err: any) {
      alert(`AI Analysis Error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle Ask MMP Chat Submission
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isAnalyzing) return;

    const userText = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { sender: 'user', text: userText, time: 'Just now' }]);

    setIsAnalyzing(true);
    try {
      const res = await MMPInsightService.askMMP({
        prompt: userText,
        datasetId: selectedDatasetId,
        tenantId,
        userId: currentUser.id,
        userName: currentUser.fullName || currentUser.email,
      });

      setChatMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: res.analysis.executiveSummary,
          time: 'Just now',
          analysis: res.analysis,
        },
      ]);
      setDataVersion(v => v + 1);
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: `MMP Insights is temporarily unable to complete this query: ${err.message}`,
          time: 'Just now',
        },
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle Save Current Insight
  const handleSaveInsight = () => {
    if (!currentAnalysis || !metrics) return;
    const title = prompt('Enter a title for this Saved Insight:', currentAnalysis.prompt.slice(0, 50));
    if (!title) return;

    const currentDataset = datasets.find(d => d.id === selectedDatasetId);
    MMPInsightService.saveInsight({
      tenantId,
      userId: currentUser.id,
      userName: currentUser.fullName || currentUser.email,
      title,
      prompt: currentAnalysis.prompt,
      analysis: currentAnalysis,
      metrics,
      datasetName: currentDataset?.fileName || 'Workforce Dataset',
    });

    alert('Insight saved successfully to "Saved Insights"!');
    setDataVersion(v => v + 1);
  };

  const presetPrompts = [
    'Find departments with lowest productivity and workload variance',
    'Identify excessive overtime concentration and burnout risks',
    'Compare attendance rate versus productive output ratio',
    'Give top management recommendations for workforce optimization',
    'Summarize workforce trends and anomalies in 5 points',
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-950 border border-purple-700 flex items-center justify-center text-purple-300 shadow-inner">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white">MMP Insights</h1>
              <Badge variant="purple" className="text-[10px] font-mono uppercase tracking-wider">
                AI Workforce Intelligence
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              AI-powered productivity, attendance analytics, and management recommendations.
            </p>
          </div>
        </div>

        {/* Dataset Selector & Quick Upload */}
        <div className="flex flex-wrap items-center gap-3">
          {datasets.length > 0 && (
            <select
              value={selectedDatasetId}
              onChange={e => handleSelectDataset(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
            >
              {datasets.map(d => (
                <option key={d.id} value={d.id}>
                  {d.fileName} ({d.rowCount} rows)
                </option>
              ))}
            </select>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab('upload')}
            className="flex items-center gap-1.5 text-xs font-bold border-purple-800 text-purple-300 hover:bg-purple-950/40"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Data</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setActiveTab('ask')}
            className="flex items-center gap-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-950/50"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Ask MMP</span>
          </Button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800 pb-2 scrollbar-none text-xs font-bold">
        {[
          { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'upload', label: 'Upload Data', icon: <Upload className="w-4 h-4" /> },
          { id: 'analysis', label: 'AI Analysis', icon: <BrainCircuit className="w-4 h-4" /> },
          { id: 'ask', label: 'Ask MMP', icon: <Bot className="w-4 h-4" /> },
          { id: 'saved', label: 'Saved Insights', icon: <Bookmark className="w-4 h-4" /> },
          { id: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" /> },
          { id: 'settings', label: 'AI Settings', icon: <Sliders className="w-4 h-4" /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && metrics && (
        <div className="space-y-6">
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <Card className="bg-slate-900 border-slate-800 p-3.5 text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Employees</div>
              <div className="text-xl font-black text-white mt-1">{metrics.totalEmployees}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Active Headcount</div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-3.5 text-center">
              <div className="text-[10px] uppercase font-bold text-emerald-400">Attendance</div>
              <div className="text-xl font-black text-emerald-400 mt-1">{metrics.attendanceRatePercent}%</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Presence Rate</div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-3.5 text-center">
              <div className="text-[10px] uppercase font-bold text-brand-400">Productivity</div>
              <div className="text-xl font-black text-brand-400 mt-1">{metrics.productivityRatioPercent}%</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Output Ratio</div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-3.5 text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Working Hrs</div>
              <div className="text-xl font-black text-white mt-1">{metrics.avgWorkingHours}h</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Avg / Day</div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-3.5 text-center">
              <div className="text-[10px] uppercase font-bold text-purple-400">Productive Hrs</div>
              <div className="text-xl font-black text-purple-400 mt-1">{metrics.avgProductiveHours}h</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Avg / Day</div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-3.5 text-center">
              <div className="text-[10px] uppercase font-bold text-amber-400">Overtime</div>
              <div className="text-xl font-black text-amber-400 mt-1">{metrics.totalOvertimeHours}h</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{metrics.overtimeRatePercent}% of total</div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-3.5 text-center">
              <div className="text-[10px] uppercase font-bold text-cyan-400">Task Velocity</div>
              <div className="text-xl font-black text-cyan-400 mt-1">{metrics.taskCompletionRatePercent}%</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Completion</div>
            </Card>

            <Card className="bg-slate-900 border-purple-800 p-3.5 text-center bg-gradient-to-b from-purple-950/30 to-slate-900 shadow-md">
              <div className="text-[10px] uppercase font-bold text-purple-300">MMP Score</div>
              <div className="text-xl font-black text-purple-300 mt-1">{metrics.productivityScore}/100</div>
              <div className="text-[10px] text-purple-400 mt-0.5">Weighted Index</div>
            </Card>
          </div>

          {/* Transparent Score & Anomaly Alert Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score Formula Card */}
            <Card className="bg-slate-900 border-slate-800 p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Transparent Productivity Score Formula</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {metrics.scoreFormulaDescription}
              </p>
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-center">
                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Attendance</div>
                  <div className="text-xs font-bold text-emerald-400">25% wt</div>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Output Ratio</div>
                  <div className="text-xs font-bold text-brand-400">35% wt</div>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Tasks</div>
                  <div className="text-xs font-bold text-cyan-400">25% wt</div>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Punctuality</div>
                  <div className="text-xs font-bold text-amber-400">15% wt</div>
                </div>
              </div>
            </Card>

            {/* Anomalies Detected */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Workforce Patterns & Anomaly Indicators</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono font-normal">
                  {metrics.anomalies.length} Pattern(s) Identified
                </span>
              </div>

              {metrics.anomalies.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {metrics.anomalies.map((ano, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{ano.title}</span>
                        <Badge
                          variant={ano.severity === 'HIGH' ? 'danger' : 'warning'}
                          className="text-[9px] uppercase font-bold"
                        >
                          {ano.severity} Priority
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400">{ano.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                  Zero critical anomalies detected. Workforce metrics align with operational benchmarks.
                </div>
              )}
            </div>
          </div>

          {/* Department Comparison Chart */}
          <Card className="bg-slate-900 border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Department Productivity & Attendance Comparison</h3>
                <p className="text-xs text-slate-400">Comparing productive ratio vs attendance presence rate by department</p>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.departmentMetrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="department" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="productivityRatio" name="Productivity Ratio %" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="attendanceRate" name="Attendance Rate %" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="productivityScore" name="Overall MMP Score" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: UPLOAD DATA */}
      {activeTab === 'upload' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="bg-slate-900 border-slate-800 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-black text-white">Upload Workforce Dataset</h2>
              <p className="text-xs text-slate-400 mt-1">
                Upload raw employee productivity, attendance, and task logs in Excel (.xlsx, .xls) or CSV format.
              </p>
            </div>

            {/* Drag & Drop Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-purple-500 bg-slate-950/60 rounded-3xl p-8 text-center cursor-pointer transition-all space-y-3 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-purple-950/60 border border-purple-700 flex items-center justify-center text-purple-300 mx-auto group-hover:scale-105 transition-transform">
                <Upload className="w-7 h-7" />
              </div>
              <div>
                <span className="text-sm font-bold text-white">Click or drag & drop Excel / CSV workforce file</span>
                <p className="text-xs text-slate-500 mt-1">Supported formats: .xlsx, .xls, .csv (Max 10 MB)</p>
              </div>
            </div>

            {isUploading && (
              <div className="text-center text-xs text-purple-400 font-bold animate-pulse">
                Parsing, validating data types, and detecting column schema...
              </div>
            )}

            {uploadSuccess && (
              <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-4 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {uploadError && (
              <div className="bg-rose-950/40 border border-rose-800 rounded-xl p-4 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Sync from internal MakeMyPayroll button */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Direct Live HRMS Sync</h4>
                <p className="text-[11px] text-slate-400">Generate an intelligence dataset directly from current attendance and employee tables.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const sync = MMPInsightService.generateFromInternalHRMS({
                    tenantId,
                    userId: currentUser.id,
                    userName: currentUser.fullName || currentUser.email,
                  });
                  setUploadSuccess(`Directly synced live MakeMyPayroll dataset (${sync.dataset.rowCount} rows).`);
                  setDataVersion(v => v + 1);
                  setActiveTab('overview');
                }}
                className="text-xs font-bold border-purple-800 text-purple-300 hover:bg-purple-950"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                <span>Sync Live HRMS</span>
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: AI ANALYSIS & NATURAL PROMPTS */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          {/* Prompt Entry Box */}
          <Card className="bg-slate-900 border-purple-800 p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Ask MMP Insights Anything About This Workforce Data</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Find departments with lowest productivity and give top 3 management recommendations"
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRunAIAnalysis(); }}
                className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <Button
                variant="primary"
                onClick={() => handleRunAIAnalysis()}
                disabled={isAnalyzing || !customPrompt.trim()}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-6 flex items-center gap-2 shadow-md shadow-purple-950"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Analyze</span>
                  </>
                )}
              </Button>
            </div>

            {/* Preset Query Pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              {presetPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCustomPrompt(p);
                    handleRunAIAnalysis(p);
                  }}
                  className="px-3 py-1 rounded-full bg-slate-950 border border-slate-800 hover:border-purple-700 text-slate-300 hover:text-purple-300 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  {p}
                </button>
              ))}
            </div>
          </Card>

          {/* Current AI Analysis Response Cards */}
          {currentAnalysis && (
            <div className="space-y-6">
              {/* Action Bar */}
              <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">Prompt:</span>
                  <span className="text-xs font-mono font-bold text-purple-300">"{currentAnalysis.prompt}"</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveInsight}
                    className="text-xs font-bold border-slate-700 hover:bg-slate-800 flex items-center gap-1.5"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-purple-400" />
                    <span>Save Insight</span>
                  </Button>
                </div>
              </div>

              {/* Executive Summary */}
              <Card className="bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-900 border-purple-700/80 p-6 space-y-2 shadow-xl">
                <div className="text-[10px] uppercase font-bold text-purple-300 tracking-wider">Executive Summary</div>
                <p className="text-sm text-slate-100 font-medium leading-relaxed">
                  {currentAnalysis.executiveSummary}
                </p>
              </Card>

              {/* Key Insights (FACT vs OBSERVATION) */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Key Analytical Insights & Findings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentAnalysis.keyInsights.map((ins, idx) => (
                    <Card key={idx} className="bg-slate-900 border-slate-800 p-5 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={ins.type === 'FACT' ? 'success' : ins.type === 'OBSERVATION' ? 'purple' : 'warning'}
                          className="text-[9px] uppercase font-bold font-mono"
                        >
                          {ins.type}
                        </Badge>
                        {ins.metricReference && (
                          <span className="text-[10px] text-slate-400 font-mono">{ins.metricReference}</span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-white">{ins.title}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{ins.description}</p>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Areas to Investigate & Recommendations Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Areas to Investigate */}
                <Card className="bg-slate-900 border-slate-800 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Potential Areas to Investigate</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {currentAnalysis.areasToInvestigate.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <ChevronRight className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                {/* Recommended Actions */}
                <Card className="bg-slate-900 border-slate-800 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Recommended Management Actions</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {currentAnalysis.recommendedActions.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <ChevronRight className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              {/* Data Limitations Disclaimer */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-[11px] text-slate-500 flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{currentAnalysis.dataLimitations.join(' • ')}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ASK MMP (CONVERSATIONAL INTERFACE) */}
      {activeTab === 'ask' && (
        <Card className="bg-slate-900 border-slate-800 p-6 flex flex-col h-[600px] max-w-4xl mx-auto shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-950 border border-purple-700 flex items-center justify-center text-purple-300">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Ask MMP Assistant</h3>
                <p className="text-[11px] text-slate-400">Contextual natural-language workforce Q&A</p>
              </div>
            </div>
            <Badge variant="purple" className="text-[10px]">
              Active Dataset: {datasets.find(d => d.id === selectedDatasetId)?.fileName || 'Live HRMS'}
            </Badge>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 scrollbar-thin">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-xl bg-purple-950 border border-purple-700 flex items-center justify-center text-purple-300 shrink-0 mt-1">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-xl rounded-2xl p-4 text-xs leading-relaxed space-y-2 ${
                    msg.sender === 'user'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-slate-950 border border-slate-800 text-slate-200'
                  }`}
                >
                  <p>{msg.text}</p>
                  {msg.analysis && (
                    <div className="pt-2 border-t border-slate-800 space-y-1 text-[11px] text-slate-400">
                      <div className="font-bold text-purple-300">Top Insights:</div>
                      {msg.analysis.keyInsights.slice(0, 2).map((ins, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <ChevronRight className="w-3 h-3 text-purple-400" />
                          <span>{ins.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isAnalyzing && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-xl bg-purple-950 border border-purple-700 flex items-center justify-center text-purple-300 shrink-0 animate-pulse">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-purple-400 animate-pulse">
                  Evaluating workforce metrics and synthesizing response...
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendChatMessage} className="pt-4 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              placeholder="Ask anything about productivity, departments, overtime, or employee trends..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={isAnalyzing || !chatInput.trim()}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </Card>
      )}

      {/* TAB 5: SAVED INSIGHTS */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Saved AI Insights & Analyses</h3>
            <span className="text-xs text-slate-400">{savedInsights.length} Saved Analysis</span>
          </div>

          {savedInsights.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedInsights.map(item => (
                <Card key={item.id} className="bg-slate-900 border-slate-800 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{item.title}</span>
                    <button
                      onClick={() => {
                        if (confirm(`Delete saved insight "${item.title}"?`)) {
                          MMPInsightService.deleteSavedInsight(item.id, tenantId);
                          setDataVersion(v => v + 1);
                        }
                      }}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                    {item.analysis.executiveSummary}
                  </p>
                  <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-500">
                    <span>{item.dataPeriod}</span>
                    <span className="font-mono text-purple-300">Prompt: "{item.prompt.slice(0, 35)}..."</span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-slate-900 border-slate-800 p-8 text-center text-xs text-slate-400">
              <Bookmark className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              No saved insights yet. Run an analysis in "AI Analysis" and click "Save Insight".
            </Card>
          )}
        </div>
      )}

      {/* TAB 6: MANAGEMENT REPORTS */}
      {activeTab === 'reports' && metrics && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Management-Ready Workforce Intelligence Report</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="text-xs font-bold border-slate-700 flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4 text-purple-400" />
              <span>Print / Export PDF</span>
            </Button>
          </div>

          <Card className="bg-slate-900 border-slate-800 p-8 space-y-6 print:bg-white print:text-black shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h1 className="text-xl font-black text-white print:text-black">MakeMyPayroll Workforce Intelligence Report</h1>
                <p className="text-xs text-slate-400 print:text-slate-600 mt-1">
                  Generated for {activeTenant?.companyName || 'NovaPulse Technologies'} • Dataset: {datasets.find(d => d.id === selectedDatasetId)?.fileName || 'Live HRMS'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-purple-400 font-bold">MMP-REPORT-{new Date().getFullYear()}-09</span>
                <p className="text-[10px] text-slate-500">{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 print:bg-slate-100">
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Workforce</div>
                <div className="text-lg font-black text-white print:text-black">{metrics.totalEmployees}</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 print:bg-slate-100">
                <div className="text-[10px] uppercase font-bold text-emerald-400">Attendance Rate</div>
                <div className="text-lg font-black text-emerald-400">{metrics.attendanceRatePercent}%</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 print:bg-slate-100">
                <div className="text-[10px] uppercase font-bold text-purple-400">Productivity Ratio</div>
                <div className="text-lg font-black text-purple-400">{metrics.productivityRatioPercent}%</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 print:bg-slate-100">
                <div className="text-[10px] uppercase font-bold text-brand-400">Productivity Score</div>
                <div className="text-lg font-black text-brand-400">{metrics.productivityScore}/100</div>
              </div>
            </div>

            {/* Department Breakdown Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white print:text-black uppercase tracking-wider">Department Output Summary</h4>
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Department</th>
                      <th className="p-2.5">Headcount</th>
                      <th className="p-2.5">Attendance</th>
                      <th className="p-2.5">Avg Working</th>
                      <th className="p-2.5">Avg Productive</th>
                      <th className="p-2.5">Output Ratio</th>
                      <th className="p-2.5">MMP Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {metrics.departmentMetrics.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-bold text-white">{d.department}</td>
                        <td className="p-2.5">{d.employeeCount}</td>
                        <td className="p-2.5 text-emerald-400">{d.attendanceRate}%</td>
                        <td className="p-2.5">{d.avgWorkingHours}h</td>
                        <td className="p-2.5 text-purple-400">{d.avgProductiveHours}h</td>
                        <td className="p-2.5 font-bold">{d.productivityRatio}%</td>
                        <td className="p-2.5 font-bold text-purple-300">{d.productivityScore}/100</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 7: AI SETTINGS & USAGE CONTROLS */}
      {activeTab === 'settings' && usage && settings && (
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="bg-slate-900 border-slate-800 p-6 space-y-6 shadow-xl">
            <div>
              <h2 className="text-lg font-black text-white">AI Usage & Cost Controls</h2>
              <p className="text-xs text-slate-400 mt-1">
                Monitors monthly token consumption, API calls, and tenant quota limits.
              </p>
            </div>

            {/* Usage Meter Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Monthly AI Request Quota</span>
                <span className="text-xs font-mono font-bold text-purple-400">
                  {usage.requestCount} / {usage.monthlyLimit} Requests Used
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-brand-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (usage.requestCount / usage.monthlyLimit) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>Remaining: {Math.max(0, usage.monthlyLimit - usage.requestCount)} queries</span>
                <span>Billing Period: {usage.monthYear}</span>
              </div>
            </div>

            {/* Token Stats Grid */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-400">Input Tokens</div>
                <div className="text-base font-bold text-white mt-1">{usage.inputTokens.toLocaleString()}</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-[10px] uppercase font-bold text-purple-400">Output Tokens</div>
                <div className="text-base font-bold text-purple-400 mt-1">{usage.outputTokens.toLocaleString()}</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-[10px] uppercase font-bold text-emerald-400">Estimated API Cost</div>
                <div className="text-base font-bold text-emerald-400 mt-1">${usage.estimatedCostUSD}</div>
              </div>
            </div>

            {/* Model & Security Guardrails */}
            <div className="pt-4 border-t border-slate-800 space-y-2 text-xs text-slate-400">
              <div className="flex items-center justify-between">
                <span>Active AI Reasoning Engine:</span>
                <span className="font-mono text-white font-bold">{settings.defaultModel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Zero PII Policy:</span>
                <span className="text-emerald-400 font-bold">Enabled (PAN/Aadhaar/Bank Details Masked)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tenant RLS Isolation:</span>
                <span className="text-emerald-400 font-bold">Enforced</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
