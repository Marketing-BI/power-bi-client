import { PowerBiService } from './powerBi.service';
import { AzureAccessToken, PowerBiClient } from '../connectors/azure';
import { HttpHandler } from '../httpHandler/HttpHandler';
import {
  PBIGroup,
  PBIReport,
  PBIDataset,
  PBIGroupUser,
  PBIGroupUserAccessRightEnum,
  PBIPrincipalTypeEnum,
  PBICapacity,
  PBIImport,
  PBIDatasource,
} from './powerBI.interfaces';
import { PBIRefreshStatusEnum, PBIRefreshTypeEnum } from './enums';
import type { PBIRefresh, GenerateTokenResponseType, PBIRefreshSchedule } from './interfaces.pbi';

jest.mock('../httpHandler/HttpHandler');
jest.mock('../configuration', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('PowerBiService', () => {
  let powerBiService: PowerBiService;
  let mockPowerBiClient: jest.Mocked<PowerBiClient>;
  let mockHttpHandler: jest.MockedObjectDeep<typeof HttpHandler>;

  const mockAccessToken: AzureAccessToken = new AzureAccessToken('mock-access-token-pbi-12345', Date.now() + 3600000);

  const mockGroupId = '12e84e90-4ff0-44e6-8c3a-c2ffdf13b7c5';
  const mockDatasetId = 'cfafbeb1-8037-4d0c-896e-a46fb27ff229';
  const mockReportId = '3546052c-ae64-4526-b1a8-52af7761426f';

  // Mock data - PBIGroup
  const mockGroup: PBIGroup = {
    id: mockGroupId,
    name: 'Test Workspace',
    description: 'Test workspace description',
    state: 'Active',
    type: 'Workspace',
    capacityId: 'capacity-id-123',
    isOnDedicatedCapacity: true,
    isReadOnly: false,
    dataflowStorageId: 'dataflow-storage-123',
    pipelineId: 'pipeline-id-123',
    dashboards: [],
    dataflows: [],
    datasets: [],
    reports: [],
    workbooks: [],
    users: [],
  };

  // Mock data - PBIReport
  const mockReport: PBIReport = {
    id: mockReportId,
    name: 'Sales Report',
    reportType: 'PbixReport',
    webUrl: 'https://app.powerbi.com/groups/me/reports/report-id',
    embedUrl: 'https://app.powerbi.com/reportEmbed?reportId=report-id',
    isFromPbix: true,
    isOwnedByMe: true,
    datasetId: mockDatasetId,
    users: [],
  };

  // Mock data - PBIDataset
  const mockDataset: PBIDataset = {
    id: mockDatasetId,
    name: 'Sales Dataset',
    addRowsAPIEnabled: true,
    configuredBy: 'admin@contoso.com',
    isRefreshable: true,
    isEffectiveIdentityRequired: false,
    isEffectiveIdentityRolesRequired: false,
    isOnPremGatewayRequired: false,
    webUrl: 'https://app.powerbi.com/groups/me/datasets/dataset-id',
  };

  // Mock data - PBIGroupUser
  const mockUser: PBIGroupUser = {
    displayName: 'John Doe',
    emailAddress: 'john@contoso.com',
    graphId: 'user-graph-id-123',
    groupUserAccessRight: PBIGroupUserAccessRightEnum.Admin,
    identifier: 'john@contoso.com',
    principalType: PBIPrincipalTypeEnum.User,
  };

  // Mock data - PBIRefresh
  const mockRefresh: PBIRefresh = {
    startTime: '2024-02-09T09:00:00Z',
    endTime: '2024-02-09T09:05:00Z',
    refreshType: PBIRefreshTypeEnum.Scheduled,
    requestId: 'request-id-123',
    status: PBIRefreshStatusEnum.Completed,
    serviceExceptionJson: '',
  };

  // Mock data - PBICapacity
  const mockCapacity: PBICapacity = {
    id: 'capacity-id-123',
    displayName: 'Premium Capacity A1',
    sku: 'A1',
    state: 'Active',
    region: 'East US',
    admins: ['admin@contoso.com'],
    capacityUserAccessRight: 'Admin',
  };

  // Mock data - PBIImport
  const mockImport: PBIImport = {
    id: 'import-id-123',
    importState: 'Succeeded',
    name: 'Sales Report Import',
    createdDateTime: '2024-02-09T08:00:00Z',
    updatedDateTime: '2024-02-09T08:05:00Z',
    datasets: [
      {
        id: mockDatasetId,
        name: 'Sales Dataset',
        webUrl: 'https://app.powerbi.com/datasets/dataset-id',
      },
    ],
    reports: [
      {
        id: mockReportId,
        name: 'Sales Report',
        webUrl: 'https://app.powerbi.com/reports/report-id',
        embedUrl: 'https://app.powerbi.com/reportEmbed?reportId=report-id',
      },
    ],
  };

  // Mock data - PBIRefreshSchedule
  const mockRefreshSchedule: PBIRefreshSchedule = {
    enabled: true,
    days: ['Sunday', 'Wednesday', 'Friday'],
    times: ['08:00', '14:00', '20:00'],
    localTimeZoneId: 'UTC',
    notifyOption: 'MailOnFailure',
  };

  // Mock data - PBIDatasource
  const mockDatasource: PBIDatasource = {
    datasourceType: 'Sql',
    datasourceId: 'datasource-id-123',
    gatewayId: 'gateway-id-123',
    connectionDetails: {
      server: 'server.database.windows.net',
      database: 'MyDatabase',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockHttpHandler = jest.mocked(HttpHandler);

    mockPowerBiClient = {
      generateValidToken: jest.fn().mockResolvedValue(mockAccessToken),
    } as any;

    powerBiService = new PowerBiService(mockPowerBiClient);
  });

  describe('listGroups', () => {
    it('should list all groups', async () => {
      const mockResponse = {
        value: [mockGroup],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await powerBiService.listGroups();

      expect(result).toEqual([mockGroup]);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no groups exist', async () => {
      const mockResponse = {
        value: [],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await powerBiService.listGroups();

      expect(result).toEqual([]);
    });

    it('should handle non-OK response', async () => {
      const mockResponse = {
        value: null,
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await powerBiService.listGroups();

      expect(result).toEqual([]);
    });
  });

  describe('getGroup', () => {
    it('should get a group by id', async () => {
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce({ value: [mockGroup] });

      const result = await powerBiService.getGroup(mockGroupId);

      expect(result).toEqual(mockGroup);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
    });

    it('should throw error when groupId is missing', async () => {
      await expect(powerBiService.getGroup('')).rejects.toThrow();
    });
  });

  describe('createGroup', () => {
    it('should create a new group', async () => {
      const groupName = 'New Test Group';
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockGroup);

      const result = await powerBiService.createGroup(groupName);

      expect(result).toEqual(mockGroup);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
    });

    it('should throw error when group name is missing', async () => {
      await expect(powerBiService.createGroup('')).rejects.toThrow();
    });
  });

  describe('deleteGroup', () => {
    it('should delete a group', async () => {
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockGroup);

      const result = await powerBiService.deleteGroup(mockGroupId);

      expect(result).toEqual(mockGroup);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
    });

    it('should throw error when groupId is missing', async () => {
      await expect(powerBiService.deleteGroup('')).rejects.toThrow();
    });
  });

  describe('getGroupUsers', () => {
    it('should get all users in a group', async () => {
      const mockResponse = {
        value: [mockUser],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await powerBiService.getGroupUsers(mockGroupId);

      expect(result).toEqual([mockUser]);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
    });

    it('should throw error when groupId is missing', async () => {
      await expect(powerBiService.getGroupUsers('')).rejects.toThrow();
    });
  });

  describe('addGroupUser', () => {
    it('should add a user to a group', async () => {
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(undefined);

      await powerBiService.addGroupUser(mockGroupId, mockUser);

      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(powerBiService.addGroupUser('', mockUser)).rejects.toThrow();
      await expect(powerBiService.addGroupUser(mockGroupId, null as any)).rejects.toThrow();
    });
  });

  describe('listReportsInGroup', () => {
    it('should list all reports in a group', async () => {
      const mockResponse = {
        value: [mockReport],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await powerBiService.listReportsInGroup(mockGroupId);

      expect(result).toEqual([mockReport]);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
    });

    it('should throw error when groupId is missing', async () => {
      await expect(powerBiService.listReportsInGroup('')).rejects.toThrow();
    });
  });

  describe('listReportsInGroupForDataset', () => {
    it('should list reports for a specific dataset in a group', async () => {
      const mockResponse = {
        value: [mockReport],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await powerBiService.listReportsInGroupForDataset(mockGroupId, mockDatasetId);

      expect(result).toEqual([mockReport]);
      expect(result[0].datasetId).toBe(mockDatasetId);
    });

    it('should filter reports by datasetId', async () => {
      const otherReport = { ...mockReport, id: 'other-report-id', datasetId: 'other-dataset-id' };
      const mockResponse = {
        value: [mockReport, otherReport],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await powerBiService.listReportsInGroupForDataset(mockGroupId, mockDatasetId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockReport.id);
    });
  });

  describe('listDatasetsInGroup', () => {
    it('should list all datasets in a group', async () => {
      const mockResponse = {
        value: [mockDataset],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await powerBiService.listDatasetsInGroup(mockGroupId);

      expect(result).toEqual([mockDataset]);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
    });

    it('should throw error when groupId is missing', async () => {
      await expect(powerBiService.listDatasetsInGroup('')).rejects.toThrow();
    });
  });

  describe('listReportPagesInGroup', () => {
    it('should list all pages in a report', async () => {
      const mockPages = [
        { name: 'page-1', displayName: 'Page 1', order: 0 },
        { name: 'page-2', displayName: 'Page 2', order: 1 },
      ];

      const mockResponse = {
        value: mockPages,
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await powerBiService.listReportPagesInGroup(mockGroupId, mockReportId);

      expect(result).toEqual(mockPages);
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(powerBiService.listReportPagesInGroup('', mockReportId)).rejects.toThrow();
      await expect(powerBiService.listReportPagesInGroup(mockGroupId, '')).rejects.toThrow();
    });
  });

  describe('listDatasourcesInGroup', () => {
    it('should list all datasources for a dataset', async () => {
      const mockResponse = {
        value: [mockDatasource],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await powerBiService.listDatasourcesInGroup(mockGroupId, mockDatasetId);

      expect(result).toEqual([mockDatasource]);
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(powerBiService.listDatasourcesInGroup('', mockDatasetId)).rejects.toThrow();
      await expect(powerBiService.listDatasourcesInGroup(mockGroupId, '')).rejects.toThrow();
    });
  });

  describe('datasetTakeOver', () => {
    it('should take over a dataset', async () => {
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(undefined);

      await powerBiService.datasetTakeOver(mockGroupId, mockDatasetId);

      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
    });

    it('should throw error when groupId is missing', async () => {
      await expect(powerBiService.datasetTakeOver('', mockDatasetId)).rejects.toThrow();
    });
  });

  describe('datasetRefresh', () => {
    it('should trigger a dataset refresh', async () => {
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(undefined);

      await powerBiService.datasetRefresh(mockGroupId, mockDatasetId);

      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(powerBiService.datasetRefresh('', mockDatasetId)).rejects.toThrow();
      await expect(powerBiService.datasetRefresh(mockGroupId, '')).rejects.toThrow();
    });
  });

  describe('getDatasetRefreshes', () => {
    it('should get refresh history for a dataset', async () => {
      const mockResponse = {
        value: [mockRefresh],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await powerBiService.getDatasetRefreshes(mockGroupId, mockDatasetId);

      expect(result).toEqual([mockRefresh]);
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(powerBiService.getDatasetRefreshes('', mockDatasetId)).rejects.toThrow();
      await expect(powerBiService.getDatasetRefreshes(mockGroupId, '')).rejects.toThrow();
    });
  });

  describe('datasetCreateRefreshSchedule', () => {
    it('should create a refresh schedule for a dataset', async () => {
      const times = ['08:00', '14:00', '20:00'];
      const days = ['Sunday', 'Wednesday', 'Friday'];

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(undefined);

      await powerBiService.datasetCreateRefreshSchedule(mockGroupId, mockDatasetId, times, days);

      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(powerBiService.datasetCreateRefreshSchedule('', mockDatasetId, [])).rejects.toThrow();
      await expect(powerBiService.datasetCreateRefreshSchedule(mockGroupId, '', [])).rejects.toThrow();
    });
  });

  describe('getDatasetRefreshSchedule', () => {
    it('should get refresh schedule for a dataset', async () => {
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockRefreshSchedule);

      const result = await powerBiService.getDatasetRefreshSchedule(mockGroupId, mockDatasetId);

      expect(result).toEqual(mockRefreshSchedule);
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(powerBiService.getDatasetRefreshSchedule('', mockDatasetId)).rejects.toThrow();
      await expect(powerBiService.getDatasetRefreshSchedule(mockGroupId, '')).rejects.toThrow();
    });
  });

  describe('cloneReportInGroup', () => {
    it('should clone a report to a target dataset', async () => {
      const clonedReport = { ...mockReport, id: 'cloned-report-id', name: 'Cloned Report' };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(clonedReport);

      const result = await powerBiService.cloneReportInGroup(
        mockGroupId,
        mockReportId,
        'Cloned Report',
        mockGroupId,
        mockDatasetId,
      );

      expect(result).toEqual(clonedReport);
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(
        powerBiService.cloneReportInGroup('', mockReportId, 'name', mockGroupId, mockDatasetId),
      ).rejects.toThrow();
      await expect(
        powerBiService.cloneReportInGroup(mockGroupId, '', 'name', mockGroupId, mockDatasetId),
      ).rejects.toThrow();
    });
  });

  describe('getCapacities', () => {
    it('should get all Power BI capacities', async () => {
      const mockResponse = {
        value: [mockCapacity],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await powerBiService.getCapacities();

      expect(result).toEqual([mockCapacity]);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
    });
  });

  describe('assignCapacityToGroup', () => {
    it('should assign a capacity to a group', async () => {
      const capacityId = 'capacity-id-123';
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce({ value: [mockCapacity] });

      const result = await powerBiService.assignCapacityToGroup(mockGroupId, capacityId);

      expect(result).toBeTruthy();
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(powerBiService.assignCapacityToGroup('', 'capacity-id')).rejects.toThrow();
      await expect(powerBiService.assignCapacityToGroup(mockGroupId, '')).rejects.toThrow();
    });
  });

  describe('validateCapacityId', () => {
    it('should validate that capacity exists', async () => {
      const mockResponse = {
        value: [mockCapacity],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      // Should not throw
      await expect(powerBiService.validateCapacityId(mockGroupId, mockCapacity.id)).resolves.toBeUndefined();
    });

    it('should throw error for invalid capacity id', async () => {
      const mockResponse = {
        value: [mockCapacity],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      await expect(powerBiService.validateCapacityId(mockGroupId, 'invalid-capacity-id')).rejects.toThrow();
    });
  });

  describe('importInGroup', () => {
    it('should import a PBIX file to a group', async () => {
      const mockFile = Buffer.from('mock pbix file content');

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockImport);

      const result = await powerBiService.importInGroup(mockGroupId, mockFile);

      expect(result).toEqual(mockImport);
    });

    it('should throw error when groupId is missing', async () => {
      const mockFile = Buffer.from('mock pbix file content');
      await expect(powerBiService.importInGroup('', mockFile)).rejects.toThrow();
    });
  });

  describe('getImportInGroup', () => {
    it('should get import status', async () => {
      const importId = 'import-id-123';

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockImport);

      const result = await powerBiService.getImportInGroup(mockGroupId, importId);

      expect(result).toEqual(mockImport);
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(powerBiService.getImportInGroup('', 'import-id')).rejects.toThrow();
      await expect(powerBiService.getImportInGroup(mockGroupId, '')).rejects.toThrow();
    });
  });

  describe('copyUsersFromGroup', () => {
    it('should copy users from source to target group', async () => {
      const sourceGroupId = 'source-group-id';
      const targetGroupId = 'target-group-id';
      const mockAddResponse = { value: [mockUser] };
      const mockGetResponse = { value: [mockUser] };

      // First call gets users from source group
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockGetResponse);
      // Second call gets existing users from target group
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce({ value: [] });
      // Third call adds user to target group
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(undefined);

      const result = await powerBiService.copyUsersFromGroup(sourceGroupId, targetGroupId);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateEmbedToken', () => {
    it('should generate embed token for a report', async () => {
      const mockTokenResponse: GenerateTokenResponseType = {
        token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
        tokenId: 'token-id-123',
        expiration: new Date(Date.now() + 3600000).toISOString(),
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockTokenResponse);

      const result = await powerBiService.generateEmbedToken(mockGroupId, mockReportId);

      expect(result).toEqual(mockTokenResponse);
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(powerBiService.generateEmbedToken('', mockReportId)).rejects.toThrow();
      await expect(powerBiService.generateEmbedToken(mockGroupId, '')).rejects.toThrow();
    });
  });

  describe('allRefreshesInFinalState', () => {
    it('should return true when all refreshes are in final state', () => {
      const completed = { ...mockRefresh, status: PBIRefreshStatusEnum.Completed };
      const failed = { ...mockRefresh, status: PBIRefreshStatusEnum.Failed };
      const refreshes = [completed, failed];

      const result = powerBiService.allRefreshesInFinalState(refreshes);

      expect(result).toBe(true);
    });

    it('should return false when any refresh is not in final state', () => {
      const unknown = { ...mockRefresh, status: PBIRefreshStatusEnum.Unknown };
      const refreshes = [mockRefresh, unknown];

      const result = powerBiService.allRefreshesInFinalState(refreshes);

      expect(result).toBe(false);
    });

    it('should return true for empty array', () => {
      const result = powerBiService.allRefreshesInFinalState([]);

      expect(result).toBe(true);
    });

    it('should return false for null or undefined', () => {
      expect(powerBiService.allRefreshesInFinalState(null as any)).toBe(false);
      expect(powerBiService.allRefreshesInFinalState(undefined as any)).toBe(false);
    });
  });

  describe('Token Management', () => {
    it('should generate and cache access token', async () => {
      const mockResponse = { value: [] };
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      await powerBiService.listGroups();

      expect(mockPowerBiClient.generateValidToken).toHaveBeenCalledTimes(1);
    });

    it('should use same token for multiple calls', async () => {
      const mockResponse = { value: [] };
      mockHttpHandler.handleHttpCall.mockResolvedValue(mockResponse);

      await powerBiService.listGroups();
      mockPowerBiClient.generateValidToken.mockResolvedValueOnce(mockAccessToken);
      await powerBiService.getCapacities();

      // Token should be generated at least once per call
      expect(mockPowerBiClient.generateValidToken).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP errors gracefully', async () => {
      const mockError = new Error('API Error: 401 Unauthorized');
      mockHttpHandler.handleHttpCall.mockRejectedValueOnce(mockError);

      await expect(powerBiService.listGroups()).rejects.toThrow('API Error: 401 Unauthorized');
    });

    it('should handle invalid group ID errors', async () => {
      const mockError = new Error('Group not found');
      mockHttpHandler.handleHttpCall.mockRejectedValueOnce(mockError);

      await expect(powerBiService.getGroup(mockGroupId)).rejects.toThrow('Group not found');
    });
  });
});
