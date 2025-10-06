import { DatasetRefreshInfo, GenerateTokenResponseType, PBIRefresh, PBIRefreshStatusEnum, PowerBiConfig, PowerBiConfigDto } from './types';
import { AzureClient } from './connectors/azure';
import { PowerBiService } from './service';
import { PBIClientInitResultType } from './service/interfaces.pbi';

export class PowerBiClient {

    private readonly _azureClient: AzureClient;
    private readonly _powerBiService: PowerBiService;

    constructor(configuration: PowerBiConfig) {
        this._azureClient = new AzureClient(configuration.azureConfig);
        this._powerBiService = new PowerBiService(this._azureClient);
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

        if (allInFinalState){
            refreshes.sort((o1, o2) => o1.endTime < o2.endTime ? -1 : 1);
            lastRefreshSuccessful = refreshes[refreshes.length - 1].status === PBIRefreshStatusEnum.Completed;
        }

        return {
            allInFinalState: allInFinalState,
            lastRefreshSuccessful: lastRefreshSuccessful,
        };
    }

    public async getLastDatasetRefresh(groupId: string, datasetId: string): Promise<PBIRefresh> {
        const refreshes: Array<PBIRefresh> = await this._powerBiService.getDatasetRefreshes(groupId, datasetId);

        refreshes.sort((o1, o2) => o1.startTime < o2.startTime ? -1 : 1);

        return refreshes.pop();
    }

    public async refreshDataset(groupId: string, datasetId: string): Promise<PBIRefresh> {
        await this._powerBiService.datasetRefresh(groupId, datasetId);

        return this.getLastDatasetRefresh(groupId, datasetId);
    }


}
