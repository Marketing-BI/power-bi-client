import { IAzureConfig } from './connectors/azure/interfaces';

export * from './connectors/azure/interfaces';
export * from './service/interfaces.pbi';
export * from './service/powerBI.interfaces';
export * from './service/dto/powerBiConfig.dto';

export interface PowerBiConfig {
    azureConfig: IAzureConfig
}

export interface DatasetRefreshInfo {
    allInFinalState: boolean;
    lastRefreshSuccessful: boolean;
}
