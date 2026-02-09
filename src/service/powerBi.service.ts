import FormData from 'form-data';
import { RequestInit } from 'node-fetch';

import { PowerBiConfigDto, PowerBiError } from './index';
import type {
  PBICapacity,
  PBICreateDataSourceRequest,
  PBICredentialDetails,
  PBIGroup,
  PBIGroupUser,
  PBIReport,
  PBIReportPage,
  PBIResponse,
  PBIDatasource,
  PBIDataset,
  PBIImport,
} from './powerBI.interfaces';

import { logger } from '../configuration';
import { PowerBiClient } from '../connectors/azure';
import { AzureAccessToken } from '../connectors/azure/dto/AzureAccessToken';
import { HttpHandler } from '../httpHandler/HttpHandler';
import type {
  GenerateTokenResponseType,
  PBIClientInitReportType,
  PBIClientInitResultType,
  PBIGenerateTokenResponseType,
  PBIRefresh,
  PBIRefreshSchedule,
  ReportPageType,
} from './interfaces.pbi';
import { PBIRefreshStatusEnum, PBIScheduleNotifyOption } from './enums';

let powerBiRestConfig = {
  url: 'https://api.powerbi.com/v1.0/myorg',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
  },
  authorizationToken: {
    accessToken: '',
    expireAt: 0,
  },
  authorizationTokenExpiredAt: null,
};

const AllowedMethodEnum = {
  GET: 'GET',
  PATCH: 'PATCH',
  POST: 'POST',
  DELETE: 'DELETE',
} as const;

const AllowedApiPaths = {
  GROUPS: powerBiRestConfig.url + '/groups',
  GROUP: powerBiRestConfig.url + '/groups/:groupId',
  GROUP_USERS: powerBiRestConfig.url + '/groups/:groupId/users',
  REPORTS: powerBiRestConfig.url + '/reports',
  DATASETS_IN_GROUP: powerBiRestConfig.url + '/groups/:groupId/datasets',
  DATASETS_IN_GROUP_TAKE_OVER: powerBiRestConfig.url + '/groups/:groupId/datasets/:datasetId/Default.TakeOver',
  DATASETS_IN_GROUP_UPDATE_PARAMETERS:
    powerBiRestConfig.url + '/groups/:groupId/datasets/:datasetId/Default.UpdateParameters',
  DATASETS_IN_GROUP_UPDATE_DATASOURCE:
    powerBiRestConfig.url + '/groups/:groupId/datasets/:datasetId/Default.UpdateDataSources',
  DATASETS_IN_GROUP_UPDATE_GET_BGD:
    powerBiRestConfig.url + '/groups/:groupId/datasets/:datasetId/Default.GetBoundGatewayDatasources',
  DATASETS_IN_GROUP_REFRESHES: powerBiRestConfig.url + '/groups/:groupId/datasets/:datasetId/refreshes',
  DATASETS_IN_GROUP_REFRESH_SCHEDULE: powerBiRestConfig.url + '/groups/:groupId/datasets/:datasetId/refreshSchedule',
  DATASOURCE_IN_GROUP: powerBiRestConfig.url + '/groups/:groupId/datasets/:datasetId/datasources',
  REPORTS_IN_GROUP: powerBiRestConfig.url + '/groups/:groupId/reports',
  GROUP_REPORT_EXPORT: powerBiRestConfig.url + '/groups/:groupId/reports/:reportId/Export',
  REPORTS_IN_GROUP_CLONE: powerBiRestConfig.url + '/groups/:groupId/reports/:reportId/clone',
  REPORTS_CLONE_IN_GROUP_CLONE: powerBiRestConfig.url + '/groups/:groupId/reports/:reportId/Clone',
  GATEWAYS: powerBiRestConfig.url + '/gateways',
  GATEWAYS_DATASOURCES: powerBiRestConfig.url + '/gateways/:gatewayId/datasources',
  GATEWAY_DATASOURCE_UPDATE: powerBiRestConfig.url + '/gateways/:gatewayId/datasources/:datasourceId',
  IMPORTS_IN_GROUP: powerBiRestConfig.url + '/groups/:groupId/imports',
  IMPORT_IN_GROUP: powerBiRestConfig.url + '/groups/:groupId/imports/:importId',
  GENERATE_TOKEN_FOR_REPORT: powerBiRestConfig.url + '/groups/:groupId/reports/:reportId/GenerateToken',
  REPORT_PAGES_IN_GROUP: powerBiRestConfig.url + '/groups/:groupId/reports/:reportId/pages',
  CAPACITIES: powerBiRestConfig.url + '/capacities',
  GROUPS_ASSIGN_TO_CAPACITY: powerBiRestConfig.url + '/groups/:groupId/AssignToCapacity',
};

const REFRESH_FINAL_STATUSES = [
  PBIRefreshStatusEnum.Failed,
  PBIRefreshStatusEnum.Completed,
  PBIRefreshStatusEnum.Disabled,
  PBIRefreshStatusEnum.Unknown,
];

const GROUP_PREFIX: string = process.env.POWER_BI_GROUP_PREFIX ? process.env.POWER_BI_GROUP_PREFIX : '';

// TODO:
// Handling non HDs scenario
// Create API and add it to YAML file to use it
// Add user management a JWT generation same as PAPI
// Add logs and result store
export class PowerBiService {
  private readonly _azurePbiClient: PowerBiClient;

  constructor(pbiClient: PowerBiClient) {
    this._azurePbiClient = pbiClient;
  }

  private static reportPageConvertor(page: PBIReportPage): ReportPageType {
    return {
      name: page.name,
      displayName: page.displayName,
      order: page.order,
    };
  }

  public async initClientProject(config: PowerBiConfigDto): Promise<PBIClientInitResultType> {
    logger.info(`New Workspace initialization starts for groupName: ${config.name}`);
    if (config?.name) {
      let newGroup: PBIGroup;
      try {
        newGroup = await this.createGroup(GROUP_PREFIX + config.name);

        const result: PBIClientInitResultType = await this.importPbixToWorkspace(newGroup.id, config);

        // Specific capacity for given project
        if (config.capacityId) {
          await this.assignCapacityToGroup(newGroup.id, config.capacityId);
        }

        logger.info(`New Client initialization ends successfully for groupId: ${newGroup.id}`);
        return result;
      } catch (e) {
        logger.error('New Client initialization ends with error. Additional error info %s', e);
        if (newGroup) {
          await this.deleteGroup(newGroup.id);
        }

        throw new PowerBiError(PowerBiError.ERROR_MESSAGES.UNEXPECTED_CREATION_ERROR);
      }
    } else {
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_INIT_CONFIGURATION);
    }
  }

  /**
   * Imports a PBIX file to a Power BI workspace and configures it with the specified settings.
   *
   * This method performs the following operations:
   * 1. Retrieves the target Power BI group/workspace
   * 2. Copies users from the template group to the target workspace
   * 3. Imports the PBIX file and waits for publishing to complete
   * 4. Takes ownership of the created dataset
   * 5. Updates dataset parameters and datasource credentials
   * 6. Triggers a dataset refresh and waits for completion (up to 72 iterations with 10s intervals)
   * 7. Optionally creates a refresh schedule if specified in the configuration
   * 8. Retrieves all reports associated with the dataset
   *
   * @param groupId - The ID of the target Power BI workspace/group where the PBIX will be imported
   * @param config - Configuration object containing:
   *   - templateGroupId: ID of the source group to copy users from
   *   - datasourceCredentials: Credentials for the datasource connection
   *   - datasourceParams: Parameters for dataset configuration
   *   - name: Name for the dataset/report
   *   - scheduledTimes: Optional array of scheduled refresh times
   *   - scheduledDays: Optional array of scheduled refresh days
   *   - getTemplate(): Method that returns the PBIX file as a Buffer
   *
   * @returns A Promise that resolves to a PBIClientInitResultType object containing:
   *   - workspaceId: The ID of the workspace
   *   - dataRefreshed: Boolean indicating if the dataset was successfully refreshed
   *   - name: The name of the workspace
   *   - datasetId: The ID of the created dataset
   *   - datasourceId: The ID of the datasource
   *   - reports: Array of reports associated with the dataset
   *
   * @throws {PowerBiError} When groupId or datasourceCredentials are missing (MISSING_INIT_CONFIGURATION)
   * @throws {PowerBiError} When any unexpected error occurs during the import process (UNEXPECTED_CREATION_ERROR)
   */
  public async importPbixToWorkspace(groupId: string, config: PowerBiConfigDto): Promise<PBIClientInitResultType> {
    logger.info(`Import PBIX to Workspace starts for groupId: ${groupId}`);

    if (!(groupId && config.datasourceCredentials)) {
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_INIT_CONFIGURATION);
    }
    const pbiGroup: PBIGroup = await this.getGroup(groupId);
    try {
      const addedUsers: Set<string> = await this.copyUsersFromGroup(config.templateGroupId, pbiGroup.id);

      const data: Buffer = await config.getTemplate();
      // dataset name matches the name of pbix report
      const datasetName: string = config.name;
      let importData: Record<string, any> = await this.importInGroup(pbiGroup.id, data, datasetName);
      do {
        logger.info('%s - Import with id: `%s` in group: `%s` still publishing...', importData.id, pbiGroup.id);
        await new Promise((r) => setTimeout(r, 2000));
        importData = await this.getImportInGroup(pbiGroup.id, importData.id);
      } while (importData.importState === 'Publishing');
      const datasets: Array<Record<string, any>> = await this.getGroupDatasets(pbiGroup.id);
      const datasetId: string = datasets.find((dataset) => dataset.name === datasetName).id;
      //Take ownership
      await this.datasetTakeOver(pbiGroup.id, datasetId);

      logger.info('new params: %s', JSON.stringify(config.datasourceParams));
      await this.datasetUpdateParameters(pbiGroup.id, datasetId, config.datasourceParams);
      // update datasource credentials
      const datasource = (await this.listDatasourcesInGroup(pbiGroup.id, datasetId))[0];

      await this.gatewayDatasourceUpdate(datasource.gatewayId, datasource.datasourceId, config.datasourceCredentials);
      await this.datasetRefresh(pbiGroup.id, datasetId);
      let counter = 0;
      let refreshed: boolean;
      do {
        counter++;
        logger.info('%s - Dataset with id: `%s` in workspace: `%s` still refreshing...', datasetId, pbiGroup.id);
        await new Promise((r) => setTimeout(r, 10000));
        const refreshes = await this.getDatasetRefreshes(pbiGroup.id, datasetId);
        refreshed = this.allRefreshesInFinalState(refreshes);
      } while (counter < 72 && !refreshed);

      if (config.scheduledTimes) {
        // Provides Creation of schedule for dataset
        await this.datasetCreateRefreshSchedule(pbiGroup.id, datasetId, config.scheduledTimes, config.scheduledDays);
      }
      // Loads all Reports in a group
      const reports: Array<PBIReport> = await this.listReportsInGroupForDataset(pbiGroup.id, datasetId);

      const infoMsg = {
        groupId: pbiGroup.id,
        groupName: pbiGroup.name,
        datasetId: datasetId,
        gatewayId: datasource.gatewayId,
        datasourceId: datasource.datasourceId,
        assignedUsersCount: addedUsers.size,
        reportCount: reports.length,
      };

      logger.info(`Import PBIX to Workspace ends with result: ${JSON.stringify(infoMsg)}`);

      return {
        workspaceId: pbiGroup.id,
        dataRefreshed: refreshed,
        name: pbiGroup.name,
        datasetId: datasetId,
        datasourceId: datasource.datasourceId,
        reports: await Promise.all(reports.map((report) => this.reportConvertor(pbiGroup.id, report))),
      };
    } catch (e) {
      logger.error(e);
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.UNEXPECTED_CREATION_ERROR);
    }
  }

  //TODO: check this method Not working correctly - exported file seams to be corrupted?
  public async exportReport(groupId: string, reportId: string): Promise<string> {
    const requestInit: RequestInit = this.assembleRequest(AllowedMethodEnum.GET, await this.handleToken());
    const pathParams: Record<string, any> = {
      groupId: groupId,
      reportId: reportId,
    };

    return HttpHandler.handleHttpCall(AllowedApiPaths.GROUP_REPORT_EXPORT, requestInit, pathParams);
  }

  public async listGroups(): Promise<Array<PBIGroup>> {
    const requestInit: RequestInit = this.assembleRequest(AllowedMethodEnum.GET, await this.handleToken());
    let groups: Array<PBIGroup>;
    const respBody = await HttpHandler.handleHttpCall<any>(AllowedApiPaths.GROUPS, requestInit);

    if (respBody.value && respBody.value.length > 0) {
      groups = respBody.value;
    } else {
      groups = new Array<PBIGroup>();
    }
    return groups;
  }

  public async getGroup(groupId: string): Promise<PBIGroup> {
    if (groupId) {
      const groups: Array<PBIGroup> = await this.listGroups();

      return groups.find((group) => group.id === groupId);
    } else {
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, { '%PARAMS%': 'group ID' });
    }
  }

  public async createGroup(name: string): Promise<PBIGroup> {
    if (name) {
      const body = { name: name };
      const requestInit: RequestInit = this.assembleRequest(
        AllowedMethodEnum.POST,
        await this.handleToken(),
        JSON.stringify(body),
      );

      return HttpHandler.handleHttpCall(AllowedApiPaths.GROUPS, requestInit);
    } else {
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, { '%PARAMS%': 'name' });
    }
  }

  public async deleteGroup(groupId: string): Promise<PBIGroup> {
    if (groupId) {
      const requestInit: RequestInit = this.assembleRequest(AllowedMethodEnum.DELETE, await this.handleToken());
      const pathParams: Record<string, any> = {
        groupId: groupId,
      };

      return HttpHandler.handleHttpCall(AllowedApiPaths.GROUP, requestInit, pathParams);
    } else {
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, { '%PARAMS%': 'group ID' });
    }
  }

  public async getGroupUsers(groupId: string): Promise<Array<PBIGroupUser>> {
    if (groupId) {
      const requestInit: RequestInit = this.assembleRequest(AllowedMethodEnum.GET, await this.handleToken());
      const pathParams: Record<string, any> = {
        groupId: groupId,
      };

      return (await HttpHandler.handleHttpCall<any>(AllowedApiPaths.GROUP_USERS, requestInit, pathParams)).value;
    } else {
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, { '%PARAMS%': 'group ID' });
    }
  }

  public async addGroupUser(groupId: string, user: PBIGroupUser): Promise<void> {
    if (groupId) {
      const requestInit: RequestInit = this.assembleRequest(
        AllowedMethodEnum.POST,
        await this.handleToken(),
        JSON.stringify(user),
      );
      const pathParams: Record<string, any> = {
        groupId: groupId,
      };

      return HttpHandler.handleHttpCall(AllowedApiPaths.GROUP_USERS, requestInit, pathParams);
    } else {
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, { '%PARAMS%': 'group ID' });
    }
  }

  public async listReportsInGroupForDataset(groupId: string, datasetId: string): Promise<Array<PBIReport>> {
    return (await this.listReportsInGroup(groupId)).filter((report) => report.datasetId === datasetId);
  }

  public async listReportsInGroup(groupId: string): Promise<Array<PBIReport>> {
    if (groupId) {
      const requestInit: RequestInit = this.assembleRequest(AllowedMethodEnum.GET, await this.handleToken());
      const pathParams: Record<string, any> = {
        groupId: groupId,
      };

      const respBody = await HttpHandler.handleHttpCall<PBIResponse<Array<PBIReport>>>(
        AllowedApiPaths.REPORTS_IN_GROUP,
        requestInit,
        pathParams,
      );
      let reports: Array<PBIReport>;

      if (respBody.value && respBody.value.length > 0) {
        reports = respBody.value;
      } else {
        reports = new Array<PBIReport>();
      }

      return reports;
    } else {
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, { '%PARAMS%': 'groupId (WsId)' });
    }
  }

  public async listReportPagesInGroup(groupId: string, reportId: string): Promise<Array<PBIReportPage>> {
    if (groupId && reportId) {
      const requestInit: RequestInit = this.assembleRequest(AllowedMethodEnum.GET, await this.handleToken());
      const pathParams: Record<string, any> = {
        groupId: groupId,
        reportId: reportId,
      };

      const respBody = await HttpHandler.handleHttpCall<PBIResponse<Array<PBIReportPage>>>(
        AllowedApiPaths.REPORT_PAGES_IN_GROUP,
        requestInit,
        pathParams,
      );
      let reportPages: Array<PBIReportPage>;

      if (respBody.value && respBody.value.length > 0) {
        reportPages = respBody.value;
      } else {
        reportPages = new Array<PBIReportPage>();
      }

      return reportPages;
    } else {
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, {
        '%PARAMS%': 'groupId (WsId) or reportId',
      });
    }
  }

  public async listDatasetsInGroup(groupId: string): Promise<Array<PBIDataset>> {
    if (groupId) {
      const requestInit: RequestInit = this.assembleRequest(AllowedMethodEnum.GET, await this.handleToken());
      const pathParams: Record<string, any> = {
        groupId: groupId,
      };

      const respBody = await HttpHandler.handleHttpCall<PBIResponse<Array<PBIDataset>>>(
        AllowedApiPaths.DATASETS_IN_GROUP,
        requestInit,
        pathParams,
      );
      let reports: Array<any>;

      if (respBody.value && respBody.value.length > 0) {
        reports = respBody.value;
      } else {
        reports = new Array<any>();
      }

      return reports;
    } else {
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, { '%PARAMS%': 'groupId (WsId)' });
    }
  }

  public async listDatasourcesInGroup(groupId: string, datasetId: string): Promise<Array<PBIDatasource>> {
    if (groupId && datasetId) {
      const requestInit: RequestInit = this.assembleRequest(AllowedMethodEnum.GET, await this.handleToken());
      const pathParams: Record<string, any> = {
        groupId: groupId,
        datasetId: datasetId,
      };

      const respBody = await HttpHandler.handleHttpCall<PBIResponse<Array<PBIDatasource>>>(
        AllowedApiPaths.DATASOURCE_IN_GROUP,
        requestInit,
        pathParams,
      );
      let reports: Array<any>;

      if (respBody.value && respBody.value.length > 0) {
        reports = respBody.value;
      } else {
        reports = new Array<any>();
      }

      return reports;
    } else {
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, {
        '%PARAMS%': 'groupId (WsId) or datasetId',
      });
    }
  }

  public async datasetTakeOver(groupId: string, datasetId: string) {
    if (groupId) {
      const requestInit: RequestInit = this.assembleRequest(AllowedMethodEnum.POST, await this.handleToken());

      const pathParams: Record<string, any> = {
        groupId: groupId,
        datasetId: datasetId,
      };

      const response = await HttpHandler.handleHttpCall(
        AllowedApiPaths.DATASETS_IN_GROUP_TAKE_OVER,
        requestInit,
        pathParams,
      );
      logger.debug(JSON.stringify(response));
    } else {
      logger.error('Missing required param: "groupId"');
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, { '%PARAMS%': 'groupId' });
    }
  }

  public async datasetUpdateParameters(groupId: string, datasetId: string, params: Array<Record<string, any>>) {
    if (groupId) {
      if (!params || params.length === 0) return;
      const body = {
        updateDetails: params,
      };

      const requestInit: RequestInit = this.assembleRequest(
        AllowedMethodEnum.POST,
        await this.handleToken(),
        JSON.stringify(body),
      );

      const pathParams: Record<string, any> = {
        groupId: groupId,
        datasetId: datasetId,
      };

      const response = await HttpHandler.handleHttpCall(
        AllowedApiPaths.DATASETS_IN_GROUP_UPDATE_PARAMETERS,
        requestInit,
        pathParams,
      );
      logger.debug(JSON.stringify(response));
    } else {
      logger.error('Missing required param: "groupId"');
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, { '%PARAMS%': 'groupId' });
    }
  }

  public async datasetUpdateDatasource(groupId: string, datasetId: string) {
    if (groupId && datasetId) {
      const body = {
        updateDetails: [
          {
            datasourceSelector: {
              datasourceType: 'Extension',
              connectionDetails: {
                path: 'keboola.west-europe.azure.snowflakecomputing.com;KEBOOLA_PROD',
                kind: 'Snowflake',
              },
            },
            connectionDetails: {
              path: 'keboola.west-europe.azure.snowflakecomputing.com;KEBOOLA_PROD',
            },
          },
        ],
      };

      const requestInit: RequestInit = this.assembleRequest(
        AllowedMethodEnum.PATCH,
        await this.handleToken(),
        JSON.stringify(body),
      );

      const pathParams: Record<string, any> = {
        groupId: groupId,
        datasetId: datasetId,
      };

      const response = await HttpHandler.handleHttpCall(
        AllowedApiPaths.DATASETS_IN_GROUP_UPDATE_DATASOURCE,
        requestInit,
        pathParams,
      );
      logger.debug(JSON.stringify(response));
    } else {
      logger.error('Missing required param: "groupId, datasetId"');
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, {
        '%PARAMS%': '[groupId, datasetId]',
      });
    }
  }

  public async datasetGetBoundGatewayDatasources(groupId: string, datasetId: string) {
    if (groupId && datasetId) {
      const body = {
        //TODO
      };

      const requestInit: RequestInit = this.assembleRequest(
        AllowedMethodEnum.PATCH,
        await this.handleToken(),
        JSON.stringify(body),
      );

      const pathParams: Record<string, any> = {
        groupId: groupId,
        datasetId: datasetId,
      };

      const response = await HttpHandler.handleHttpCall(
        AllowedApiPaths.DATASETS_IN_GROUP_UPDATE_GET_BGD,
        requestInit,
        pathParams,
      );
      logger.debug(JSON.stringify(response));
    } else {
      logger.error('Missing required param: "groupId, datasetId"');
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, {
        '%PARAMS%': '[groupId, datasetId]',
      });
    }
  }

  public async datasetRefresh(groupId: string, datasetId: string) {
    if (groupId && datasetId) {
      const requestInit: RequestInit = this.assembleRequest(AllowedMethodEnum.POST, await this.handleToken());

      const pathParams: Record<string, any> = {
        groupId: groupId,
        datasetId: datasetId,
      };

      await HttpHandler.handleHttpCall(AllowedApiPaths.DATASETS_IN_GROUP_REFRESHES, requestInit, pathParams);
    } else {
      logger.error('Missing required param: "groupId, datasetId"');
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, {
        '%PARAMS%': '[groupId, datasetId]',
      });
    }
  }

  public async datasetCreateRefreshSchedule(
    groupId: string,
    datasetId: string,
    times: Array<string>,
    days?: Array<string>,
  ) {
    if (groupId && datasetId) {
      const body: { value: PBIRefreshSchedule } = {
        value: {
          enabled: true,
          times: times,
          days: days,
          localTimeZoneId: 'UTC',
          notifyOption: PBIScheduleNotifyOption.NoNotification,
        },
      };
      const requestInit: RequestInit = this.assembleRequest(
        AllowedMethodEnum.PATCH,
        await this.handleToken(),
        JSON.stringify(body),
      );

      const pathParams: Record<string, any> = {
        groupId: groupId,
        datasetId: datasetId,
      };

      await HttpHandler.handleHttpCall(AllowedApiPaths.DATASETS_IN_GROUP_REFRESH_SCHEDULE, requestInit, pathParams);
    } else {
      logger.error('Missing required param: "groupId, datasetId"');
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, {
        '%PARAMS%': '[groupId, datasetId]',
      });
    }
  }

  public async getDatasetRefreshSchedule(groupId: string, datasetId: string): Promise<PBIRefreshSchedule> {
    if (groupId && datasetId) {
      const requestInit: RequestInit = this.assembleRequest(AllowedMethodEnum.GET, await this.handleToken());

      const pathParams: Record<string, any> = {
        groupId: groupId,
        datasetId: datasetId,
      };

      return await HttpHandler.handleHttpCall(
        AllowedApiPaths.DATASETS_IN_GROUP_REFRESH_SCHEDULE,
        requestInit,
        pathParams,
      );
    } else {
      logger.error('Missing required param: "groupId, datasetId"');
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, {
        '%PARAMS%': '[groupId, datasetId]',
      });
    }
  }

  public async getDatasetRefreshes(groupId: string, datasetId: string): Promise<Array<PBIRefresh>> {
    if (groupId && datasetId) {
      const requestInit: RequestInit = this.assembleRequest(AllowedMethodEnum.GET, await this.handleToken());

      const pathParams: Record<string, any> = {
        groupId: groupId,
        datasetId: datasetId,
      };

      const response = await HttpHandler.handleHttpCall<PBIResponse<Array<PBIRefresh>>>(
        AllowedApiPaths.DATASETS_IN_GROUP_REFRESHES,
        requestInit,
        pathParams,
      );
      return response?.value ? response.value : new Array<PBIRefresh>();
    } else {
      logger.error('Missing required param: "groupId, datasetId"');
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, {
        '%PARAMS%': '[groupId, datasetId]',
      });
    }
  }

  public async getGroupDatasets(groupId: string): Promise<Array<Record<string, any>>> {
    if (groupId) {
      const requestInit: RequestInit = this.assembleRequest(AllowedMethodEnum.GET, await this.handleToken());

      const pathParams: Record<string, any> = {
        groupId: groupId,
      };

      const response = await HttpHandler.handleHttpCall<PBIResponse<Array<Record<string, any>>>>(
        AllowedApiPaths.DATASETS_IN_GROUP,
        requestInit,
        pathParams,
      );

      return response.value;
    } else {
      logger.error('Missing required param: "groupId"');
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, { '%PARAMS%': '[groupId]' });
    }
  }

  public async cloneReportInGroup(
    groupId: string,
    reportId: string,
    reportName: string,
    targetGroupId: string,
    targetDatasetId: string,
  ): Promise<PBIReport> {
    if (groupId && reportId && reportName && targetGroupId) {
      const body = {
        name: reportName,
        targetWorkspaceId: targetGroupId,
        targetModelId: targetDatasetId,
      };
      const requestInit: RequestInit = this.assembleRequest(
        AllowedMethodEnum.POST,
        await this.handleToken(),
        JSON.stringify(body),
      );
      const pathParams: Record<string, any> = {
        groupId: groupId,
        reportId: reportId,
      };

      return HttpHandler.handleHttpCall(AllowedApiPaths.REPORTS_CLONE_IN_GROUP_CLONE, requestInit, pathParams);
    } else {
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, {
        '%PARAMS%': 'group ID or report id or reportName or targetGroupId or targetDatasetId',
      });
    }
  }

  public async createDatasource(gatewayId: string, connectionData: PBICreateDataSourceRequest) {
    if (gatewayId && connectionData) {
      const requestInit: RequestInit = this.assembleRequest(
        AllowedMethodEnum.POST,
        await this.handleToken(),
        JSON.stringify(connectionData),
      );
      const pathParams: Record<string, any> = {
        gatewayId: gatewayId,
      };
      const response = await HttpHandler.handleHttpCall(AllowedApiPaths.GATEWAYS_DATASOURCES, requestInit, pathParams);
      logger.debug(JSON.stringify(response));
    } else {
      logger.error('Missing required param: "gatewayId" or "connectionData');
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, {
        '%PARAMS%': 'gateway Id or connectionData',
      });
    }
  }

  public async getGateways() {
    const requestInit: RequestInit = this.assembleRequest(AllowedMethodEnum.GET, await this.handleToken());
    const response = await HttpHandler.handleHttpCall(AllowedApiPaths.GATEWAYS, requestInit);
    logger.debug(JSON.stringify(response));

    return response;
  }

  public async importInGroup(
    groupId: string,
    file,
    datasetName: string = `${Date.now()}`,
  ): Promise<Record<string, any>> {
    if (groupId) {
      const formData: FormData = new FormData();
      formData.append('file0', file);
      const headers: Map<string, any> = new Map<string, any>();
      headers.set('Content-Type', formData.getHeaders()['content-type']);
      headers.set('Content-Length', formData.getLengthSync());
      const requestInit: RequestInit = this.assembleRequest(
        AllowedMethodEnum.POST,
        await this.handleToken(),
        formData,
        headers,
      );

      const pathParams: Record<string, any> = {
        groupId: groupId,
      };
      const queryParams: Record<string, any> = {
        datasetDisplayName: datasetName,
      };

      const response = await HttpHandler.handleHttpCall(
        AllowedApiPaths.IMPORTS_IN_GROUP,
        requestInit,
        pathParams,
        queryParams,
      );
      console.log(response);
      return response;
    } else {
      logger.error('Missing required param: "groupId"');
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, { '%PARAMS%': 'groupId' });
    }
  }

  public async getImportInGroup(groupId: string, importId: string): Promise<PBIImport> {
    if (groupId && importId) {
      const requestInit: RequestInit = this.assembleRequest(AllowedMethodEnum.GET, await this.handleToken());

      const pathParams: Record<string, any> = {
        groupId: groupId,
        importId: importId,
      };

      const response = await HttpHandler.handleHttpCall<PBIImport>(
        AllowedApiPaths.IMPORT_IN_GROUP,
        requestInit,
        pathParams,
      );
      console.log(response);
      if (response.importState === 'Failed') {
        throw new PowerBiError(PowerBiError.ERROR_MESSAGES.FAILED_IMPORT);
      }
      return response;
    } else {
      logger.error('Missing required param: "groupId, importId"');
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, { '%PARAMS%': 'groupId, importId' });
    }
  }

  public async copyUsersFromGroup(sourceGroupId: string, targetGroupId: string): Promise<Set<string>> {
    const users: Array<PBIGroupUser> = await this.getGroupUsers(sourceGroupId);
    const addedAddedUsers: Set<string> = new Set(
      (await this.getGroupUsers(targetGroupId)).map((user) => user.identifier),
    );

    for (const user of users) {
      if (addedAddedUsers.has(user.identifier)) {
        logger.warn('User already in group!');
      } else {
        await this.addGroupUser(targetGroupId, user);
        addedAddedUsers.add(user.identifier);
      }
    }

    return addedAddedUsers;
  }

  public async generateEmbedToken(groupId: string, reportId: string): Promise<GenerateTokenResponseType> {
    if (groupId && reportId) {
      const body = {
        accessLevel: 'view',
      };
      const requestInit: RequestInit = this.assembleRequest(
        AllowedMethodEnum.POST,
        await this.handleToken(),
        JSON.stringify(body),
      );
      const pathParams: Record<string, any> = {
        groupId: groupId,
        reportId: reportId,
      };

      const response: PBIGenerateTokenResponseType = await HttpHandler.handleHttpCall(
        AllowedApiPaths.GENERATE_TOKEN_FOR_REPORT,
        requestInit,
        pathParams,
      );

      return {
        token: response.token,
        tokenId: response.tokenId,
        expiration: response.expiration,
      };
    } else {
      logger.error('Missing required param: "groupId, reportId"');
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, { '%PARAMS%': 'groupId, reportId' });
    }
  }

  public allRefreshesInFinalState(refreshes: Array<PBIRefresh>) {
    return refreshes
      ? refreshes.filter(
          (refresh) =>
            refresh.status !== PBIRefreshStatusEnum.Unknown && REFRESH_FINAL_STATUSES.includes(refresh.status),
        ).length === refreshes.length
      : false;
  }

  public async getCapacities(): Promise<Array<PBICapacity>> {
    const requestInit: RequestInit = this.assembleRequest(AllowedMethodEnum.GET, await this.handleToken());

    const response: PBIResponse<Array<PBICapacity>> = await HttpHandler.handleHttpCall(
      AllowedApiPaths.CAPACITIES,
      requestInit,
    );

    return response.value;
  }

  public async assignCapacityToGroup(groupId: string, capacityId: string): Promise<string> {
    if (groupId && capacityId) {
      await this.validateCapacityId(groupId, capacityId);

      const body: Record<string, any> = {
        capacityId: capacityId,
      };

      const requestInit: RequestInit = this.assembleRequest(
        AllowedMethodEnum.POST,
        await this.handleToken(),
        JSON.stringify(body),
      );

      const pathParams: Record<string, any> = {
        groupId: groupId,
      };

      await HttpHandler.handleHttpCall(AllowedApiPaths.GROUPS_ASSIGN_TO_CAPACITY, requestInit, pathParams);

      return capacityId;
    } else {
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, {
        '%PARAMS%': 'group ID or capacityId',
      });
    }
  }

  public async validateCapacityId(groupId: string, capacityId: string) {
    const capacities: Array<PBICapacity> = await this.getCapacities();

    if (!capacities.find((capacity) => capacity.id === capacityId)) {
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.UNKNOWN_RESOURCE, {
        [PowerBiError.PARAM_NAMES.RESOURCE_NAME]: PowerBiError.RESOURCE_NAMES.CAPACITY,
        [PowerBiError.PARAM_NAMES.RESOURCE_ID]: capacityId,
      });
    }
  }

  private assembleRequest(
    method: keyof typeof AllowedMethodEnum,
    authorizationToken: string,
    body?: any,
    customHeaders?: Map<string, any>,
  ): RequestInit {
    let finalHeaders = {
      Authorization: 'Bearer ' + authorizationToken,
      ...powerBiRestConfig.headers,
    };

    if (customHeaders && customHeaders.size > 0) {
      for (const customHeader of customHeaders) {
        finalHeaders[customHeader[0]] = customHeader[1];
      }
    }

    return {
      method: method,
      headers: finalHeaders,
      body: body,
    };
  }

  private async handleToken(): Promise<string> {
    const validToken: AzureAccessToken = await this._azurePbiClient.generateValidToken(
      powerBiRestConfig.authorizationToken as AzureAccessToken,
    );
    powerBiRestConfig.authorizationToken = validToken;

    return validToken.accessToken;
  }

  private async gatewayDatasourceUpdate(gatewayId: string, datasourceId: string, dataToUpd: PBICredentialDetails) {
    if (gatewayId && datasourceId) {
      const body = {
        credentialDetails: dataToUpd,
      };
      const requestInit: RequestInit = this.assembleRequest(
        AllowedMethodEnum.PATCH,
        await this.handleToken(),
        JSON.stringify(body),
      );

      const pathParams: Record<string, any> = {
        gatewayId: gatewayId,
        datasourceId: datasourceId,
      };

      await HttpHandler.handleHttpCall(AllowedApiPaths.GATEWAY_DATASOURCE_UPDATE, requestInit, pathParams);
    } else {
      logger.error('Missing required param: "gatewayId, datasourceId"');
      throw new PowerBiError(PowerBiError.ERROR_MESSAGES.MISSING_REQUIRED_PARAM, {
        '%PARAMS%': '[gatewayId, datasourceId]',
      });
    }
  }

  private async reportConvertor(groupId: string, report: PBIReport): Promise<PBIClientInitReportType> {
    const pages: Array<PBIReportPage> = await this.listReportPagesInGroup(groupId, report.id);

    return {
      id: report.id,
      name: report.name,
      embedUrl: report.embedUrl,
      webUrl: report.webUrl,
      pages: pages.map((page: PBIReportPage) => PowerBiService.reportPageConvertor(page)),
    };
  }
}
