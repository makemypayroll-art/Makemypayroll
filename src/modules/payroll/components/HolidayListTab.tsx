// ====================================================================
// Payroll Configuration Submodule: Holiday List (Centralized Calendar)
// ====================================================================

import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Building2,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Holiday, Branch } from '../../../database/schema';
import { HolidayPayrollService } from '../../../services/payroll/holidayPayrollService';
import { StorageEngine, STORAGE_KEYS } from '../../../database/storageEngine';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Table, Column } from '../../../components/common/Table';
import { Modal } from '../../../components/common/Modal';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';
import { formatDate } from '../../../utils/dateUtils';

export const HolidayListTab: React.FC = () => {
  const { currentUser, isSuperAdmin, isHR, activeTenant } = useAuth();
  const tenantId = activeTenant?.tenantId || 'NP-000001';

  // Filters
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [version, setVersion] = useState(0);

  // Branches
  const branches = StorageEngine.getList<Branch>(STORAGE_KEYS.BRANCHES).filter(
    b => !b.organizationId || b.organizationId === tenantId || b.organizationId === 'org-novapulse-01' || b.organizationId === 'NP-000001'
  );

  // Holidays
  const holidays = HolidayPayrollService.getAll({
    tenantId,
    branchId: selectedBranch,
    year: selectedYear,
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);

  // Form State
  const [formData, setFormData] = useState<Omit<Holiday, 'id'>>({
    organizationId: tenantId,
    branchId: '',
    name: '',
    date: '2026-01-01',
    isOptional: false,
    description: '',
  });

  const handleOpenAdd = () => {
    setEditingHoliday(null);
    setFormData({
      organizationId: tenantId,
      branchId: '',
      name: '',
      date: `${selectedYear}-01-01`,
      isOptional: false,
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (h: Holiday) => {
    setEditingHoliday(h);
    setFormData({
      organizationId: h.organizationId || tenantId,
      branchId: h.branchId || '',
      name: h.name,
      date: h.date,
      isOptional: h.isOptional || false,
      description: h.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.date) {
      alert('Holiday Name and Date are required.');
      return;
    }

    try {
      if (editingHoliday) {
        HolidayPayrollService.update(
          editingHoliday.id,
          {
            ...formData,
            branchId: formData.branchId || undefined,
          },
          currentUser?.fullName
        );
      } else {
        HolidayPayrollService.create(
          {
            ...formData,
            organizationId: tenantId,
            branchId: formData.branchId || undefined,
          },
          currentUser?.fullName
        );
      }

      setIsModalOpen(false);
      setVersion(v => v + 1);
    } catch (err: any) {
      alert(err.message || 'Failed to save holiday.');
    }
  };

  const handleDelete = (h: Holiday) => {
    if (!window.confirm(`Are you sure you want to delete holiday "${h.name}" (${h.date})?`)) {
      return;
    }

    const res = HolidayPayrollService.delete(h.id, currentUser?.fullName);
    if (res.success) {
      setVersion(v => v + 1);
    } else {
      alert(res.message);
    }
  };

  const columns: Column<Holiday>[] = [
    {
      key: 'date',
      header: 'Holiday Date',
      render: (h) => {
        const d = new Date(h.date);
        const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-center">
              <span className="text-[9px] font-black text-slate-500 uppercase">{dayOfWeek}</span>
              <span className="text-xs font-black text-slate-900">{d.getDate()}</span>
            </div>
            <div>
              <span className="font-mono text-xs font-bold text-slate-800">{formatDate(h.date)}</span>
              <div className="text-[10px] text-slate-500">{d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'name',
      header: 'Holiday Name',
      render: (h) => (
        <div className="space-y-0.5">
          <span className="font-extrabold text-sm text-slate-900 tracking-tight">{h.name}</span>
          {h.description && <div className="text-[11px] text-slate-500 font-normal">{h.description}</div>}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (h) => (
        <Badge variant={h.isOptional ? 'warning' : 'success'} size="sm" className="text-[10px] font-semibold">
          {h.isOptional ? 'Optional / Restricted' : 'Mandatory Paid Holiday'}
        </Badge>
      ),
    },
    {
      key: 'branch',
      header: 'Applicable Branch',
      render: (h) => {
        if (!h.branchId) {
          return (
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>All Branches</span>
            </div>
          );
        }
        const branch = branches.find(b => b.id === h.branchId);
        return (
          <div className="flex items-center gap-1.5 text-xs text-brand-700 font-semibold">
            <Building2 className="w-3.5 h-3.5 text-brand-500" />
            <span>{branch?.name || h.branchId}</span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (h) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenEdit(h)}
            className="h-7 px-2.5 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-700 hover:text-slate-900"
          >
            <Edit2 className="w-3.5 h-3.5 mr-1 text-slate-500" />
            <span>Edit</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(h)}
            className="h-7 px-2.5 text-xs font-semibold border-rose-200 hover:bg-rose-50 text-rose-700 hover:border-rose-300"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-500" />
            <span>Delete</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-950 border border-brand-800 flex items-center justify-center text-brand-400 shadow-inner">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">Holiday List</h2>
            <div className="text-xs text-slate-400 font-mono">
              {holidays.length} configured holidays in {selectedYear}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-transparent border-none text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              <option value={2025} className="bg-slate-900 text-white">2025</option>
              <option value={2026} className="bg-slate-900 text-white">2026</option>
              <option value={2027} className="bg-slate-900 text-white">2027</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAdd}
            className="text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-950"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>Add Holiday</span>
          </Button>
        </div>
      </div>

      {/* Holiday Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <Table
          data={holidays}
          columns={columns}
          keyExtractor={h => h.id}
          emptyMessage={`No holidays registered for year ${selectedYear}.`}
          className="border-none shadow-none rounded-none"
        />
      </div>

      {/* Add / Edit Holiday Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingHoliday ? 'Edit Company Holiday' : 'Add Company Holiday'}
        >
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">
                Holiday Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Republic Day, Diwali, Christmas"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-brand-500 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-brand-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Applicable Branch</label>
                <select
                  value={formData.branchId || ''}
                  onChange={e => setFormData({ ...formData, branchId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-brand-500 focus:outline-none"
                >
                  <option value="">All Branches</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
              <input
                type="checkbox"
                id="isOptional"
                checked={formData.isOptional}
                onChange={e => setFormData({ ...formData, isOptional: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-600 cursor-pointer"
              />
              <label htmlFor="isOptional" className="text-slate-300 font-semibold cursor-pointer">
                Optional / Restricted Holiday (Restricted to eligible employees)
              </label>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Notes / Remarks</label>
              <textarea
                value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                placeholder="Optional description or religious festival details"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" className="bg-brand-600 text-white font-bold">
                {editingHoliday ? 'Save Changes' : 'Create Holiday'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
