import type {
  DatasetRefreshInfo,
  GenerateTokenResponseType,
  PBIDatasource,
  PBIRefresh,
  PowerBiConfig,
  PowerBiConfigDto,
} from './types';
import { PowerBiClient as PBClient } from './connectors/azure';
import { PowerBiService } from './service';
import type { PBIClientInitResultType } from './service/interfaces.pbi';
import { PBIRefreshStatusEnum } from './service/enums';

export class PowerBiClient {
  private readonly _powerBiAuthClient: PBClient;
  private readonly _powerBiService: PowerBiService;

  constructor(configuration: PowerBiConfig) {
    this._powerBiAuthClient = new PBClient(configuration.azureConfig);
    this._powerBiService = new PowerBiService(this._powerBiAuthClient);
  }

  public async initProjectFromTemplate(config: PowerBiConfigDto): Promise<PBIClientInitResultType> {
    return this._powerBiService.initClientProject(config);
  }

  public async importToWorkspace(workspaceId: string, config: PowerBiConfigDto): Promise<PBIClientInitResultType> {
    return this._powerBiService.importPbixToWorkspace(workspaceId, config);
  }

  public async generateEmbedToken(groupId: string, reportId: string): Promise<GenerateTokenResponseType> {
    return this._powerBiService.generateEmbedToken(groupId, reportId);
  }

  public async groupDatasetRefreshed(groupId: string, datasetId: string): Promise<DatasetRefreshInfo> {
    const refreshes: Array<PBIRefresh> = await this._powerBiService.getDatasetRefreshes(groupId, datasetId);
    const allInFinalState: boolean = this._powerBiService.allRefreshesInFinalState(refreshes);
    let lastRefreshSuccessful: boolean = false;

    if (allInFinalState) {
      refreshes.sort((o1, o2) => (o1.endTime < o2.endTime ? -1 : 1));
      lastRefreshSuccessful = refreshes[refreshes.length - 1].status === PBIRefreshStatusEnum.Completed;
    }

    return {
      allInFinalState: allInFinalState,
      lastRefreshSuccessful: lastRefreshSuccessful,
    };
  }

  public async getLastDatasetRefresh(groupId: string, datasetId: string): Promise<PBIRefresh | undefined> {
    const refreshes: Array<PBIRefresh> = await this._powerBiService.getDatasetRefreshes(groupId, datasetId);

    refreshes.sort((o1, o2) => (o1.startTime < o2.startTime ? -1 : 1));

    return refreshes.pop();
  }

  public async refreshDataset(groupId: string, datasetId: string): Promise<PBIRefresh | undefined> {
    await this._powerBiService.datasetRefresh(groupId, datasetId);

    return this.getLastDatasetRefresh(groupId, datasetId);
  }

  public async datasetUpdateParameters(
    groupId: string,
    datasetId: string,
    params: Array<Record<string, any>>,
  ): Promise<void> {
    return this._powerBiService.datasetUpdateParameters(groupId, datasetId, params);
  }

  public async listDatasourcesInGroup(groupId: string, datasetId: string): Promise<Array<PBIDatasource>> {
    return this._powerBiService.listDatasourcesInGroup(groupId, datasetId);
  }
}
