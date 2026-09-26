// Asset & Inventory Management Service
import { StorageEngine, STORAGE_KEYS } from '../database/storageEngine';
import { AssetInventory, AssetAllocationHistory, AssetCondition } from '../database/schema';
import { AuditService } from './auditService';

export class InventoryService {
  public static getAll(): AssetInventory[] {
    return StorageEngine.getList<AssetInventory>(STORAGE_KEYS.ASSETS);
  }

  public static getById(id: string): AssetInventory | undefined {
    return this.getAll().find(a => a.id === id);
  }

  public static getByEmployee(employeeId: string): AssetInventory[] {
    return this.getAll().filter(a => a.allocatedToEmployeeId === employeeId);
  }

  public static create(asset: Omit<AssetInventory, 'id'>): AssetInventory {
    const newAsset: AssetInventory = {
      ...asset,
      id: `ast-${Date.now()}`,
    };
    return StorageEngine.insert<AssetInventory>(STORAGE_KEYS.ASSETS, newAsset);
  }

  public static createAsset(asset: Omit<AssetInventory, 'id'>): AssetInventory {
    return this.create(asset);
  }

  public static update(id: string, updates: Partial<AssetInventory>): AssetInventory | undefined {
    return StorageEngine.update<AssetInventory>(STORAGE_KEYS.ASSETS, id, updates);
  }

  public static delete(id: string): boolean {
    return StorageEngine.remove<AssetInventory>(STORAGE_KEYS.ASSETS, id);
  }

  public static allocateAsset(
    paramsOrAssetId: { assetId: string; employeeId: string; handledByEmployeeId: string; notes?: string } | string,
    employeeId?: string,
    handledByEmployeeId?: string,
    notes?: string
  ): AssetInventory | undefined {
    const params = typeof paramsOrAssetId === 'string'
      ? { assetId: paramsOrAssetId, employeeId: employeeId!, handledByEmployeeId: handledByEmployeeId || 'Admin', notes }
      : paramsOrAssetId;

    const asset = this.getById(params.assetId);
    if (!asset) return undefined;

    const updated = this.update(params.assetId, {
      status: 'Allocated',
      allocatedToEmployeeId: params.employeeId,
      allocatedDate: new Date().toISOString().split('T')[0],
      notes: params.notes,
    });

    // Record history
    const history: AssetAllocationHistory = {
      id: `ahist-${Date.now()}`,
      organizationId: StorageEngine.getActiveTenantId(),
      assetId: params.assetId,
      employeeId: params.employeeId,
      action: 'ALLOCATED',
      date: new Date().toISOString(),
      condition: asset.condition,
      handledByEmployeeId: params.handledByEmployeeId,
      notes: params.notes,
    };
    StorageEngine.insert<AssetAllocationHistory>(STORAGE_KEYS.ASSET_HISTORY, history);

    AuditService.log(
      'UPDATE',
      'Inventory Management',
      `Allocated asset ${asset.assetTag} (${asset.name}) to employee ${params.employeeId}`,
      { id: params.handledByEmployeeId, name: 'Asset Manager', role: 'IT Admin' },
      { recordId: params.assetId }
    );

    return updated;
  }

  public static returnAsset(params: {
    assetId: string;
    handledByEmployeeId: string;
    returnCondition: AssetCondition;
    notes?: string;
  }): AssetInventory | undefined {
    const asset = this.getById(params.assetId);
    if (!asset || !asset.allocatedToEmployeeId) return undefined;

    const prevEmployeeId = asset.allocatedToEmployeeId;

    const updated = this.update(params.assetId, {
      status: params.returnCondition === 'Damaged' ? 'Maintenance' : 'Available',
      allocatedToEmployeeId: undefined,
      allocatedDate: undefined,
      condition: params.returnCondition,
      notes: params.notes,
    });

    const history: AssetAllocationHistory = {
      id: `ahist-${Date.now()}`,
      organizationId: StorageEngine.getActiveTenantId(),
      assetId: params.assetId,
      employeeId: prevEmployeeId,
      action: 'RETURNED',
      date: new Date().toISOString(),
      condition: params.returnCondition,
      handledByEmployeeId: params.handledByEmployeeId,
      notes: params.notes,
    };
    StorageEngine.insert<AssetAllocationHistory>(STORAGE_KEYS.ASSET_HISTORY, history);

    return updated;
  }
}
