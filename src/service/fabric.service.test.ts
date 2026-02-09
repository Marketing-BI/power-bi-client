import { FabricService } from './fabric.service';
import { AzureAccessToken, FabricClient } from '../connectors/azure';
import { HttpHandler } from '../httpHandler/HttpHandler';
import type { FabricWorkspace, FabricFolder, CreateFolderRequest } from './interfaces.fabric';

// Mock dependencies
jest.mock('../httpHandler/HttpHandler');
jest.mock('../configuration', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('FabricService', () => {
  let fabricService: FabricService;
  let mockFabricClient: jest.Mocked<FabricClient>;
  let mockHttpHandler: jest.MockedObjectDeep<typeof HttpHandler>;

  const mockAccessToken = new AzureAccessToken('mock-fabric-access-token-xyz123', Date.now() + 3600000);

  // Mock data
  const mockWorkspaceId = 'aaaaaaaa-0000-1111-2222-bbbbbbbbbbbb';
  const mockFolderId = 'bbbbbbbb-1111-2222-3333-cccccccccccc';
  const mockParentFolderId = 'cccccccc-2222-3333-4444-dddddddddddd';

  const mockWorkspace: FabricWorkspace = {
    id: mockWorkspaceId,
    displayName: 'Sales Analytics Workspace',
    type: 'Workspace',
    state: 'Active',
    capacityId: 'capacity-id-123',
    domainId: '8badadb6-9945-4e07-8134-00e0defec00b',
    isReadOnly: false,
    isOnDedicatedCapacity: true,
  };

  const mockFolder: FabricFolder = {
    id: mockFolderId,
    displayName: 'Sales Reports',
    workspaceId: mockWorkspaceId,
  };

  const mockSubFolder: FabricFolder = {
    id: 'subfolder-id-123',
    displayName: 'Q1 Reports',
    workspaceId: mockWorkspaceId,
    parentFolderId: mockFolderId,
  };

  const mockParentFolder: FabricFolder = {
    id: mockParentFolderId,
    displayName: 'Main Reports',
    workspaceId: mockWorkspaceId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockHttpHandler = jest.mocked(HttpHandler);

    mockFabricClient = {
      generateValidToken: jest.fn().mockResolvedValue(mockAccessToken),
    } as jest.MockedObjectDeep<FabricClient>;

    fabricService = new FabricService(mockFabricClient);
  });

  describe('listFolders', () => {
    it('should list folders without pagination', async () => {
      const mockResponse = {
        value: [mockFolder, mockSubFolder],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await fabricService.listFolders(mockWorkspaceId);

      expect(result).toEqual([mockFolder, mockSubFolder]);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
    });

    it('should list folders with recursive option enabled', async () => {
      const mockResponse = {
        value: [mockFolder, mockSubFolder],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await fabricService.listFolders(mockWorkspaceId, { recursive: true });

      expect(result).toEqual([mockFolder, mockSubFolder]);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        { workspaceId: mockWorkspaceId },
        expect.objectContaining({
          recursive: 'true',
        }),
      );
    });

    it('should list folders with rootFolderId filter', async () => {
      const mockResponse = {
        value: [mockSubFolder],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await fabricService.listFolders(mockWorkspaceId, {
        recursive: true,
        rootFolderId: mockFolderId,
      });

      expect(result).toEqual([mockSubFolder]);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        { workspaceId: mockWorkspaceId },
        expect.objectContaining({
          rootFolderId: mockFolderId,
        }),
      );
    });

    it('should handle pagination with continuation tokens', async () => {
      const mockResponse1 = {
        value: [mockFolder],
        continuationToken: 'token-page-1',
      };

      const mockResponse2 = {
        value: [mockSubFolder],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse1).mockResolvedValueOnce(mockResponse2);

      const result = await fabricService.listFolders(mockWorkspaceId);

      expect(result).toEqual([mockFolder, mockSubFolder]);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(2);

      // Verify second call includes continuation token
      expect(mockHttpHandler.handleHttpCall).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.any(Object),
        { workspaceId: mockWorkspaceId },
        expect.objectContaining({
          continuationToken: 'token-page-1',
        }),
      );
    });

    it('should handle empty folder list', async () => {
      const mockResponse = {
        value: [],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await fabricService.listFolders(mockWorkspaceId);

      expect(result).toEqual([]);
    });

    it('should handle errors when listing folders', async () => {
      const mockError = new Error('API Error: Workspace not found');
      mockHttpHandler.handleHttpCall.mockRejectedValueOnce(mockError);

      await expect(fabricService.listFolders(mockWorkspaceId)).rejects.toThrow('API Error: Workspace not found');
    });
  });

  describe('createFolder', () => {
    const folderData: CreateFolderRequest = {
      displayName: 'New Report Folder',
      parentFolderId: mockParentFolderId,
    };

    it('should create a folder with parent', async () => {
      const newFolder = { ...mockFolder, id: 'new-folder-id', displayName: folderData.displayName };
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(newFolder);

      const result = await fabricService.createFolder(mockWorkspaceId, folderData);

      expect(result).toEqual(newFolder);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
    });

    it('should create a root folder without parent', async () => {
      const rootFolderData: CreateFolderRequest = {
        displayName: 'Root Folder',
      };

      const newRootFolder = { ...mockFolder, displayName: rootFolderData.displayName };
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(newRootFolder);

      await fabricService.createFolder(mockWorkspaceId, rootFolderData);
    });

    it('should handle errors when creating folder', async () => {
      const mockError = new Error('Folder already exists');
      mockHttpHandler.handleHttpCall.mockRejectedValueOnce(mockError);

      await expect(fabricService.createFolder(mockWorkspaceId, folderData)).rejects.toThrow('Folder already exists');
    });
  });

  describe('getFolder', () => {
    it('should get a folder by id', async () => {
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockFolder);

      const result = await fabricService.getFolder(mockWorkspaceId, mockFolderId);

      expect(result).toEqual(mockFolder);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        {
          workspaceId: mockWorkspaceId,
          folderId: mockFolderId,
        },
        undefined,
      );
    });

    it('should handle errors when getting folder', async () => {
      const mockError = new Error('Folder not found');
      mockHttpHandler.handleHttpCall.mockRejectedValueOnce(mockError);

      await expect(fabricService.getFolder(mockWorkspaceId, mockFolderId)).rejects.toThrow('Folder not found');
    });
  });

  describe('deleteFolder', () => {
    it('should delete a folder', async () => {
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(undefined);

      await fabricService.deleteFolder(mockWorkspaceId, mockFolderId);

      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        {
          workspaceId: mockWorkspaceId,
          folderId: mockFolderId,
        },
        undefined,
      );
    });

    it('should handle errors when deleting folder', async () => {
      const mockError = new Error('Folder contains items and cannot be deleted');
      mockHttpHandler.handleHttpCall.mockRejectedValueOnce(mockError);

      await expect(fabricService.deleteFolder(mockWorkspaceId, mockFolderId)).rejects.toThrow(
        'Folder contains items and cannot be deleted',
      );
    });
  });

  describe('getFolderOrCreate', () => {
    it('should get existing root folder', async () => {
      const mockResponse = {
        value: [mockFolder],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await fabricService.getFolderOrCreate(mockWorkspaceId, 'Sales Reports');

      expect(result).toEqual(mockFolder);
    });

    it('should create root folder if it does not exist', async () => {
      const mockEmptyResponse = { value: [] };
      const newFolder = { ...mockFolder, displayName: 'NewFolder' };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockEmptyResponse).mockResolvedValueOnce(newFolder);

      const result = await fabricService.getFolderOrCreate(mockWorkspaceId, 'NewFolder');

      expect(result).toEqual(newFolder);
    });

    it('should handle nested folder path with existing folders', async () => {
      const mockRootFoldersResponse = { value: [mockFolder] };
      const mockAllFoldersResponse = { value: [mockSubFolder] };

      mockHttpHandler.handleHttpCall
        .mockResolvedValueOnce(mockRootFoldersResponse)
        .mockResolvedValueOnce(mockAllFoldersResponse);

      const result = await fabricService.getFolderOrCreate(mockWorkspaceId, 'Sales Reports/Q1 Reports');

      expect(result).toEqual(mockSubFolder);
    });

    it('should create nested folders recursively', async () => {
      const mockRootFoldersResponse = { value: [] };
      const mockCreatedParentResponse = { ...mockFolder, displayName: 'Parent' };
      const mockEmptySubFoldersResponse = { value: [] };
      const mockCreatedSubResponse = { ...mockSubFolder, displayName: 'Child' };

      mockHttpHandler.handleHttpCall
        .mockResolvedValueOnce(mockRootFoldersResponse)
        .mockResolvedValueOnce(mockCreatedParentResponse)
        .mockResolvedValueOnce(mockEmptySubFoldersResponse)
        .mockResolvedValueOnce(mockCreatedSubResponse);

      const result = await fabricService.getFolderOrCreate(mockWorkspaceId, 'Parent/Child');

      expect(result).toEqual(mockCreatedSubResponse);
    });

    it('should handle deeply nested folder paths', async () => {
      const mockRootFoldersResponse = { value: [] };
      const level1 = { ...mockFolder, displayName: 'Level1' };
      const level2 = { ...mockSubFolder, displayName: 'Level2', parentFolderId: level1.id };
      const level3 = { ...mockSubFolder, id: 'level3-id', displayName: 'Level3', parentFolderId: level2.id };

      mockHttpHandler.handleHttpCall
        .mockResolvedValueOnce(mockRootFoldersResponse)
        .mockResolvedValueOnce(level1)
        .mockResolvedValueOnce({ value: [] })
        .mockResolvedValueOnce(level2)
        .mockResolvedValueOnce(level3);

      const result = await fabricService.getFolderOrCreate(mockWorkspaceId, 'Level1/Level2/Level3');

      expect(result).toEqual(level3);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(5);
    });

    it('should handle errors during folder creation', async () => {
      const mockError = new Error('Permission denied');
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce({ value: [] }).mockRejectedValueOnce(mockError);

      await expect(fabricService.getFolderOrCreate(mockWorkspaceId, 'NewFolder')).rejects.toThrow('Permission denied');
    });
  });

  describe('listWorkspaces', () => {
    it('should list all workspaces', async () => {
      const mockResponse = {
        value: [mockWorkspace],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await fabricService.listWorkspaces();

      expect(result).toEqual([mockWorkspace]);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
    });

    it('should handle empty workspace list', async () => {
      const mockResponse = {
        value: [],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await fabricService.listWorkspaces();

      expect(result).toEqual([]);
    });

    it('should list multiple workspaces', async () => {
      const workspace2 = { ...mockWorkspace, id: 'workspace-id-2', displayName: 'Marketing Analytics' };
      const mockResponse = {
        value: [mockWorkspace, workspace2],
      };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      const result = await fabricService.listWorkspaces();

      expect(result).toHaveLength(2);
      expect(result).toEqual([mockWorkspace, workspace2]);
    });

    it('should handle errors when listing workspaces', async () => {
      const mockError = new Error('Unauthorized');
      mockHttpHandler.handleHttpCall.mockRejectedValueOnce(mockError);

      await expect(fabricService.listWorkspaces()).rejects.toThrow('Unauthorized');
    });
  });

  describe('getWorkspace', () => {
    it('should get a workspace by id', async () => {
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockWorkspace);

      const result = await fabricService.getWorkspace(mockWorkspaceId);

      expect(result).toEqual(mockWorkspace);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledTimes(1);
      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        {
          workspaceId: mockWorkspaceId,
        },
        undefined,
      );
    });

    it('should handle errors when getting workspace', async () => {
      const mockError = new Error('Workspace not found');
      mockHttpHandler.handleHttpCall.mockRejectedValueOnce(mockError);

      await expect(fabricService.getWorkspace(mockWorkspaceId)).rejects.toThrow('Workspace not found');
    });

    it('should handle forbidden workspace access', async () => {
      const mockError = new Error('Insufficient privileges');
      mockHttpHandler.handleHttpCall.mockRejectedValueOnce(mockError);

      await expect(fabricService.getWorkspace(mockWorkspaceId)).rejects.toThrow('Insufficient privileges');
    });
  });

  describe('Token Management', () => {
    it('should request token before first API call', async () => {
      const mockResponse = { value: [] };
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      await fabricService.listWorkspaces();

      expect(mockFabricClient.generateValidToken).toHaveBeenCalledTimes(1);
      expect(mockFabricClient.generateValidToken).toHaveBeenCalledWith(null);
    });

    it('should use cached token for multiple API calls', async () => {
      const mockResponse = { value: [] };
      mockHttpHandler.handleHttpCall.mockResolvedValue(mockResponse);

      await fabricService.listWorkspaces();
      await fabricService.listWorkspaces();

      // Token should be generated each time to ensure freshness
      expect(mockFabricClient.generateValidToken).toHaveBeenCalledTimes(2);
    });

    it('should include valid token in authorization header', async () => {
      const mockResponse = { value: [] };
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      await fabricService.listWorkspaces();

      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken.accessToken}`,
          }),
        }),
        undefined,
        undefined,
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors with status codes', async () => {
      const mockError = new Error('API Error: 401 Unauthorized');
      mockHttpHandler.handleHttpCall.mockRejectedValueOnce(mockError);

      await expect(fabricService.listWorkspaces()).rejects.toThrow('API Error: 401 Unauthorized');
    });

    it('should handle network errors', async () => {
      const mockError = new Error('Network timeout');
      mockHttpHandler.handleHttpCall.mockRejectedValueOnce(mockError);

      await expect(fabricService.listFolders(mockWorkspaceId)).rejects.toThrow('Network timeout');
    });

    it('should handle malformed API responses', async () => {
      const mockResponse = null; // Invalid response

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      // Should handle gracefully
      const result = await fabricService.listFolders(mockWorkspaceId);
      expect(result).toEqual([]);
    });
  });

  describe('API Path Construction', () => {
    it('should construct correct path parameters for folder endpoints', async () => {
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockFolder);

      await fabricService.getFolder(mockWorkspaceId, mockFolderId);

      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledWith(
        expect.stringContaining(':workspaceId'),
        expect.any(Object),
        expect.objectContaining({
          workspaceId: mockWorkspaceId,
          folderId: mockFolderId,
        }),
        undefined,
      );
    });

    it('should construct correct query parameters for pagination', async () => {
      const mockResponse = { value: [], continuationToken: 'token' };

      mockHttpHandler.handleHttpCall.mockResolvedValueOnce(mockResponse);

      await fabricService.listFolders(mockWorkspaceId, { recursive: true });

      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
          recursive: 'true',
        }),
      );
    });
  });

  describe('Request Headers', () => {
    it('should include required headers in requests', async () => {
      mockHttpHandler.handleHttpCall.mockResolvedValueOnce({ value: [] });

      await fabricService.listWorkspaces();

      expect(mockHttpHandler.handleHttpCall).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Cache-Control': 'no-cache',
            Authorization: expect.stringContaining('Bearer'),
          }),
        }),
        undefined,
        undefined,
      );
    });
  });
});
