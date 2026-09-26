// ====================================================================
// NovaPulse / MakeMyPayroll — MMP Insights Master Service
// Dataset ingestion, validation, AI execution, saved insights, usage controls
// ====================================================================

import * as XLSX from 'xlsx';
import { StorageEngine, STORAGE_KEYS } from '../../database/storageEngine';
import {
  MMPDataset,
  MMPDatasetRow,
  MMPAnalyticsMetrics,
  MMPAIAnalysis,
  MMPSavedInsight,
  MMPAIUsage,
  MMPAISettings,
  MMPColumnMapping,
} from '../../database/schema';
import { MMPAnalyticsService } from '../analytics/mmpAnalyticsService';
import { AIProviderService } from '../ai/aiProviderService';
import { EmployeeService } from '../employeeService';
import { AttendanceService } from '../attendanceService';
import { ShiftService } from '../shiftService';
import { TicketService } from '../ticketService';
import { AuditService } from '../auditService';

export const DEFAULT_AI_SETTINGS: MMPAISettings = {
  id: 'mmp-ai-settings-default',
  tenantId: 'NP-000001',
  isAiEnabled: true,
  defaultProvider: 'makemypayroll_engine',
  defaultModel: 'MMP-Workforce-Reasoning-v2.6',
  monthlyRequestLimit: 100,
  dailyRequestLimit: 20,
  maxFileSizeMB: 10,
  maxRows: 5000,
  allowedRoles: ['Super Admin', 'Tenant Admin', 'HR Admin', 'Manager'],
  updatedAt: new Date().toISOString(),
};

export class MMPInsightService {
  /**
   * Retrieves datasets for tenant
   */
  public static getDatasets(tenantId?: string): MMPDataset[] {
    const list = StorageEngine.getList<MMPDataset>(STORAGE_KEYS.MMP_DATASETS);
    return tenantId ? list.filter(d => d.tenantId === tenantId) : list;
  }

  public static getDatasetById(id: string): MMPDataset | undefined {
    return this.getDatasets().find(d => d.id === id);
  }

  public static getDatasetRows(datasetId: string): MMPDatasetRow[] {
    const list = StorageEngine.getList<MMPDatasetRow>(STORAGE_KEYS.MMP_DATASET_ROWS);
    return list.filter(r => r.datasetId === datasetId);
  }

  /**
   * 1. INGESTION: PARSE EXCEL (.XLSX / .XLS) OR CSV FILE BUFFER
   */
  public static async parseUploadedFile(params: {
    fileData: ArrayBuffer | string;
    fileName: string;
    tenantId: string;
    userId: string;
    userName: string;
    customMapping?: Partial<MMPColumnMapping>;
  }): Promise<{ dataset: MMPDataset; rows: MMPDatasetRow[]; metrics: MMPAnalyticsMetrics }> {
    const workbook = XLSX.read(params.fileData, { type: typeof params.fileData === 'string' ? 'string' : 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawJson: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawJson || rawJson.length === 0) {
      throw new Error('Uploaded file is empty or contains no valid rows.');
    }

    const headers = Object.keys(rawJson[0]);
    const detectedMapping = MMPAnalyticsService.detectColumnMapping(headers);
    const finalMapping: MMPColumnMapping = {
      ...detectedMapping,
      ...(params.customMapping || {}),
    };

    const datasetId = `dataset-${Date.now()}`;
    const datasetRows: MMPDatasetRow[] = [];
    const seenEmpDates = new Set<string>();
    let duplicatesCount = 0;
    let missingValuesCount = 0;
    let minDate = '9999-99-99';
    let maxDate = '0000-00-00';
    const departments = new Set<string>();
    const employees = new Set<string>();

    rawJson.forEach((row, idx) => {
      const empId = String(row[finalMapping.employeeIdentifier] || `EMP-${idx + 1}`).trim();
      const empName = String(row[finalMapping.employeeName] || empId).trim();
      const dept = String(row[finalMapping.department] || 'General').trim();
      const dateVal = String(row[finalMapping.date] || new Date().toISOString().split('T')[0]).trim();
      const workHrs = parseFloat(row[finalMapping.workingHours]) || 8;
      const prodHrs = parseFloat(row[finalMapping.productiveHours]) || (workHrs * 0.8);
      const otHrs = parseFloat(row[finalMapping.overtimeHours]) || 0;
      const tasksTotal = parseInt(row[finalMapping.taskCount || '']) || 5;
      const tasksDone = parseInt(row[finalMapping.completedTasks || '']) || Math.min(tasksTotal, 4);
      const attStatus = String(row[finalMapping.attendanceStatus || ''] || 'Present').trim();

      const comboKey = `${empId}_${dateVal}`;
      if (seenEmpDates.has(comboKey)) {
        duplicatesCount += 1;
      } else {
        seenEmpDates.add(comboKey);
      }

      if (!row[finalMapping.productiveHours]) {
        missingValuesCount += 1;
      }

      if (dateVal < minDate) minDate = dateVal;
      if (dateVal > maxDate) maxDate = dateVal;
      departments.add(dept);
      employees.add(empId);

      const newRow: MMPDatasetRow = {
        id: `row-${datasetId}-${idx + 1}`,
        datasetId,
        tenantId: params.tenantId,
        employeeIdentifier: empId,
        employeeName: empName,
        department: dept,
        date: dateVal,
        workingHours: workHrs,
        productiveHours: prodHrs,
        overtimeHours: otHrs,
        taskCount: tasksTotal,
        completedTasks: tasksDone,
        attendanceStatus: attStatus,
        rawData: row,
      };

      datasetRows.push(newRow);
    });

    const fileType = params.fileName.endsWith('.csv') ? 'csv' : params.fileName.endsWith('.xls') ? 'xls' : 'xlsx';
    const dataset: MMPDataset = {
      id: datasetId,
      tenantId: params.tenantId,
      userId: params.userId,
      userName: params.userName,
      fileName: params.fileName,
      fileType,
      rowCount: datasetRows.length,
      columnCount: headers.length,
      detectedColumns: headers,
      columnMapping: finalMapping,
      dataSummary: {
        departmentsCount: departments.size,
        employeesCount: employees.size,
        dateRange: {
          from: minDate !== '9999-99-99' ? minDate : new Date().toISOString().split('T')[0],
          to: maxDate !== '0000-00-00' ? maxDate : new Date().toISOString().split('T')[0],
        },
        missingValuesCount,
        duplicateRowsCount: duplicatesCount,
        invalidValuesCount: 0,
      },
      status: 'READY',
      createdAt: new Date().toISOString(),
    };

    // Save dataset and rows
    StorageEngine.insert<MMPDataset>(STORAGE_KEYS.MMP_DATASETS, dataset);
    const existingRows = StorageEngine.getList<MMPDatasetRow>(STORAGE_KEYS.MMP_DATASET_ROWS);
    StorageEngine.set<MMPDatasetRow[]>(STORAGE_KEYS.MMP_DATASET_ROWS, [...existingRows, ...datasetRows]);

    const metrics = MMPAnalyticsService.calculateMetrics(datasetRows);

    AuditService.log({
      userId: params.userId,
      userName: params.userName,
      userRole: 'HR Admin',
      module: 'MMP Insights',
      action: 'CREATE',
      description: `Uploaded and ingested workforce dataset ${params.fileName} (${datasetRows.length} rows, ${employees.size} employees)`,
      recordId: dataset.id,
    });

    return { dataset, rows: datasetRows, metrics };
  }

  /**
   * 2. INGESTION: GENERATE SYNTHETIC DATASET FROM INTERNAL HRMS TABLES
   */
  public static generateFromInternalHRMS(params: {
    tenantId: string;
    userId: string;
    userName: string;
    monthStr?: string; // "2026-09"
  }): { dataset: MMPDataset; rows: MMPDatasetRow[]; metrics: MMPAnalyticsMetrics } {
    const tenantId = params.tenantId || 'NP-000001';
    let employees = EmployeeService.getAll().filter(
      e => (e.organizationId === tenantId || (e as any).tenantId === tenantId || (tenantId === 'NP-000001' && e.organizationId === 'org-novapulse-01')) && e.employmentStatus === 'Active'
    );
    if (employees.length === 0) {
      employees = EmployeeService.getAll().filter(e => e.employmentStatus === 'Active');
    }
    const attendance = AttendanceService.getAll();
    const tickets = TicketService.getAll();

    const datasetId = `dataset-internal-${Date.now()}`;
    const datasetRows: MMPDatasetRow[] = [];
    const departments = new Set<string>();

    employees.forEach((emp: any, eIdx) => {
      const deptName = emp.departmentName || 'Engineering';
      const empName = emp.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : (emp.personalInfo ? `${emp.personalInfo.firstName} ${emp.personalInfo.lastName || ''}`.trim() : emp.employeeCode || emp.id);
      departments.add(deptName);
      const empAtt = attendance.filter(a => a.employeeId === emp.id);

      if (empAtt.length > 0) {
        empAtt.forEach((att, aIdx) => {
          const workHrs = (att as any).workingHours || (att.status === 'Present' ? 8 : att.status === 'Half-Day' ? 4 : 0);
          const prodHrs = Math.max(0, workHrs * (0.75 + (eIdx % 3) * 0.08));
          datasetRows.push({
            id: `row-${datasetId}-${eIdx}-${aIdx}`,
            datasetId,
            tenantId,
            employeeIdentifier: emp.employeeCode || emp.id,
            employeeName: empName,
            department: deptName,
            date: att.date,
            workingHours: workHrs,
            productiveHours: Math.round(prodHrs * 10) / 10,
            overtimeHours: (att as any).overtimeHours || 0,
            taskCount: 6,
            completedTasks: 5,
            attendanceStatus: att.status,
          });
        });
      } else {
        // Generate standard month entries
        for (let day = 1; day <= 22; day++) {
          const dStr = `2026-09-${day.toString().padStart(2, '0')}`;
          const isPresent = day % 7 !== 0;
          const workHrs = isPresent ? 8.5 : 0;
          const prodHrs = isPresent ? 7.2 : 0;
          datasetRows.push({
            id: `row-${datasetId}-${eIdx}-${day}`,
            datasetId,
            tenantId,
            employeeIdentifier: emp.employeeCode || emp.id,
            employeeName: empName,
            department: deptName,
            date: dStr,
            workingHours: workHrs,
            productiveHours: prodHrs,
            overtimeHours: (day === 15 && eIdx === 0) ? 3 : 0,
            taskCount: 5,
            completedTasks: isPresent ? 4 : 0,
            attendanceStatus: isPresent ? 'Present' : 'Absent',
          });
        }
      }
    });

    const dataset: MMPDataset = {
      id: datasetId,
      tenantId,
      userId: params.userId,
      userName: params.userName,
      fileName: `MakeMyPayroll_Live_Sync_2026_09.internal`,
      fileType: 'internal_hrms',
      rowCount: datasetRows.length,
      columnCount: 10,
      detectedColumns: ['EmployeeCode', 'EmployeeName', 'Department', 'Date', 'WorkingHours', 'ProductiveHours', 'OvertimeHours', 'TaskCount', 'CompletedTasks', 'AttendanceStatus'],
      columnMapping: {
        employeeIdentifier: 'EmployeeCode',
        employeeName: 'EmployeeName',
        department: 'Department',
        date: 'Date',
        workingHours: 'WorkingHours',
        productiveHours: 'ProductiveHours',
        overtimeHours: 'OvertimeHours',
      },
      dataSummary: {
        departmentsCount: departments.size,
        employeesCount: employees.length,
        dateRange: { from: '2026-09-01', to: '2026-09-30' },
        missingValuesCount: 0,
        duplicateRowsCount: 0,
        invalidValuesCount: 0,
      },
      status: 'READY',
      createdAt: new Date().toISOString(),
    };

    StorageEngine.insert<MMPDataset>(STORAGE_KEYS.MMP_DATASETS, dataset);
    const existingRows = StorageEngine.getList<MMPDatasetRow>(STORAGE_KEYS.MMP_DATASET_ROWS);
    StorageEngine.set<MMPDatasetRow[]>(STORAGE_KEYS.MMP_DATASET_ROWS, [...existingRows, ...datasetRows]);

    const metrics = MMPAnalyticsService.calculateMetrics(datasetRows);
    return { dataset, rows: datasetRows, metrics };
  }

  /**
   * 3. EXECUTE NATURAL-LANGUAGE AI ANALYSIS QUERY
   */
  public static async askMMP(params: {
    prompt: string;
    datasetId?: string;
    tenantId: string;
    userId: string;
    userName: string;
  }): Promise<{ analysis: MMPAIAnalysis; metrics: MMPAnalyticsMetrics }> {
    const tenantId = params.tenantId || 'NP-000001';

    // Check usage limits
    const usage = this.getUsage(tenantId);
    if (usage.requestCount >= usage.monthlyLimit) {
      throw new Error(`MMP Insights monthly usage limit has been reached (${usage.requestCount}/${usage.monthlyLimit} requests used).`);
    }

    // Load dataset and calculate factual metrics
    let dataset = params.datasetId ? this.getDatasetById(params.datasetId) : undefined;
    let rows: MMPDatasetRow[] = [];

    if (dataset) {
      rows = this.getDatasetRows(dataset.id);
    } else {
      const allDatasets = this.getDatasets(tenantId);
      if (allDatasets.length > 0) {
        dataset = allDatasets[0];
        rows = this.getDatasetRows(dataset.id);
      } else {
        const sync = this.generateFromInternalHRMS({
          tenantId,
          userId: params.userId,
          userName: params.userName,
        });
        dataset = sync.dataset;
        rows = sync.rows;
      }
    }

    const metrics = MMPAnalyticsService.calculateMetrics(rows);
    const provider = AIProviderService.getProvider();
    const res = await provider.analyze({
      prompt: params.prompt,
      metrics,
      datasetName: dataset ? dataset.fileName : 'Live HRMS Dataset',
      tenantId,
    });

    const analysis: MMPAIAnalysis = {
      id: `ai-ana-${Date.now()}`,
      tenantId,
      datasetId: dataset?.id || 'live',
      prompt: params.prompt,
      executiveSummary: res.executiveSummary,
      keyInsights: res.keyInsights,
      areasToInvestigate: res.areasToInvestigate,
      recommendedActions: res.recommendedActions,
      dataLimitations: res.dataLimitations,
      provider: res.providerName,
      model: res.modelName,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      createdAt: new Date().toISOString(),
    };

    // Increment usage
    this.recordUsage(tenantId, params.userId, res.inputTokens, res.outputTokens);

    AuditService.log({
      userId: params.userId,
      userName: params.userName,
      userRole: 'HR Admin',
      module: 'MMP Insights',
      action: 'PROCESS',
      description: `Executed AI insight query: "${params.prompt.slice(0, 60)}..."`,
      recordId: analysis.id,
    });

    return { analysis, metrics };
  }

  /**
   * 4. SAVED INSIGHTS MANAGEMENT
   */
  public static getSavedInsights(tenantId?: string): MMPSavedInsight[] {
    const list = StorageEngine.getList<MMPSavedInsight>(STORAGE_KEYS.MMP_SAVED_INSIGHTS);
    return tenantId ? list.filter(s => s.tenantId === tenantId) : list;
  }

  public static saveInsight(params: {
    tenantId: string;
    userId: string;
    userName: string;
    title: string;
    prompt: string;
    analysis: MMPAIAnalysis;
    metrics: MMPAnalyticsMetrics;
    datasetName: string;
    tags?: string[];
  }): MMPSavedInsight {
    const newSaved: MMPSavedInsight = {
      id: `saved-${Date.now()}`,
      tenantId: params.tenantId,
      userId: params.userId,
      userName: params.userName,
      title: params.title,
      prompt: params.prompt,
      analysis: params.analysis,
      metrics: params.metrics,
      datasetName: params.datasetName,
      dataPeriod: 'FY 2026-27 Q2',
      tags: params.tags || ['Productivity', 'Workforce AI'],
      createdAt: new Date().toISOString(),
    };

    StorageEngine.insert<MMPSavedInsight>(STORAGE_KEYS.MMP_SAVED_INSIGHTS, newSaved);
    return newSaved;
  }

  public static deleteSavedInsight(id: string, tenantId?: string): boolean {
    const item = this.getSavedInsights(tenantId).find(s => s.id === id);
    if (!item) return false;

    StorageEngine.remove<MMPSavedInsight>(STORAGE_KEYS.MMP_SAVED_INSIGHTS, id);
    return true;
  }

  /**
   * 5. USAGE & SETTINGS
   */
  public static getUsage(tenantId: string = 'NP-000001'): MMPAIUsage {
    const list = StorageEngine.getList<MMPAIUsage>(STORAGE_KEYS.MMP_AI_USAGE);
    const monthYear = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    const found = list.find(u => u.tenantId === tenantId && u.monthYear === monthYear);

    if (found) return found;

    const initial: MMPAIUsage = {
      id: `usage-${tenantId}-${monthYear}`,
      tenantId,
      userId: 'system',
      monthYear,
      requestCount: 0,
      monthlyLimit: 100,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUSD: 0,
      lastRequestAt: new Date().toISOString(),
    };
    StorageEngine.insert<MMPAIUsage>(STORAGE_KEYS.MMP_AI_USAGE, initial);
    return initial;
  }

  public static recordUsage(tenantId: string, userId: string, inputTokens: number, outputTokens: number): MMPAIUsage {
    const current = this.getUsage(tenantId);
    const updatedCount = current.requestCount + 1;
    const updatedIn = current.inputTokens + inputTokens;
    const updatedOut = current.outputTokens + outputTokens;
    const cost = Math.round(((updatedIn * 0.0000015) + (updatedOut * 0.000002)) * 1000) / 1000;

    const updated: MMPAIUsage = {
      ...current,
      userId,
      requestCount: updatedCount,
      inputTokens: updatedIn,
      outputTokens: updatedOut,
      estimatedCostUSD: cost,
      lastRequestAt: new Date().toISOString(),
    };

    StorageEngine.upsert<MMPAIUsage>(STORAGE_KEYS.MMP_AI_USAGE, updated);
    return updated;
  }

  public static getSettings(tenantId: string = 'NP-000001'): MMPAISettings {
    const list = StorageEngine.getList<MMPAISettings>(STORAGE_KEYS.MMP_AI_SETTINGS);
    const found = list.find(s => s.tenantId === tenantId);
    return found || { ...DEFAULT_AI_SETTINGS, tenantId };
  }

  public static updateSettings(tenantId: string, updates: Partial<MMPAISettings>): MMPAISettings {
    const current = this.getSettings(tenantId);
    const updated: MMPAISettings = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    StorageEngine.upsert<MMPAISettings>(STORAGE_KEYS.MMP_AI_SETTINGS, updated);
    return updated;
  }
}
