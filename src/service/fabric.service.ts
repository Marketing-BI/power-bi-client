/**
 * Fabric Service
 * Handles Microsoft Fabric API operations for workspace and folder management
 */

import { RequestInit } from 'node-fetch';
import { FabricClient } from '../connectors/azure';
import { AzureAccessToken } from '../connectors/azure/dto/AzureAccessToken';
import { HttpHandler } from '../httpHandler/HttpHandler';
import { logger } from '../configuration';
import type {
  FabricWorkspace,
  CreateFolderRequest,
  FabricFolder,
  ListFoldersRequest,
  ListFolderResponse,
} from './interfaces.fabric';
import { PBIResponse } from './powerBI.interfaces';

/**
 * Fabric workspace configuration
 */
const fabricRestConfig = {
  url: 'https://api.fabric.microsoft.com/v1',
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
};

const AllowedMethodEnum = {
  GET: 'GET',
  POST: 'POST',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
} as const;

/**
 * Workspace API paths
 */
const AllowedApiPaths = {
  WORKSPACES: fabricRestConfig.url + '/workspaces',
  WORKSPACE: fabricRestConfig.url + '/workspaces/:workspaceId',
  WORKSPACE_FOLDERS: fabricRestConfig.url + '/workspaces/:workspaceId/folders',
  WORKSPACE_FOLDER: fabricRestConfig.url + '/workspaces/:workspaceId/folders/:folderId',
};

/**
 * FabricService handles Microsoft Fabric API operations
 */
export class FabricService {
  private readonly _fabricClient: FabricClient;
  private _authorizationToken: AzureAccessToken;

  constructor(fabricClient: FabricClient) {
    this._fabricClient = fabricClient;
    this._authorizationToken = null;
  }

  /**
   * Ensure we have a valid authorization token
   */
  private async ensureValidToken(): Promise<void> {
    this._authorizationToken = await this._fabricClient.generateValidToken(this._authorizationToken);
    fabricRestConfig.authorizationToken = this._authorizationToken;
  }

  /**
   * Make an HTTP call to the Fabric API
   */
  private async makeApiCall<ReqBody = unknown, Res = unknown>(
    method: (typeof AllowedMethodEnum)[keyof typeof AllowedMethodEnum],
    path: string,
    body?: ReqBody,
    pathParams?: Record<string, string>,
    queryParams?: Record<string, string>,
  ): Promise<any> {
    await this.ensureValidToken();

    const requestInit: RequestInit = {
      method,
      headers: {
        ...fabricRestConfig.headers,
        Authorization: `Bearer ${this._authorizationToken.accessToken}`,
      },
    };

    if (body) {
      requestInit.body = JSON.stringify(body);
    }

    return HttpHandler.handleHttpCall<Res>(path, requestInit, pathParams, queryParams);
  }

  /**
   * List all folders in a workspace
   * @param workspaceId The workspace ID
   * @param requestConfig Optional configuration for listing folders (e.g. recursive)
   * @returns Array of folders in the workspace
   */
  /**
   * Lists all folders in a Fabric workspace.
   *
   * @param workspaceId - The ID of the workspace to list folders from
   * @param requestConfig - Configuration options for the folder listing request
   * @param requestConfig.recursive - Whether to recursively list folders. Defaults to `false`
   * @param requestConfig.rootFolderId - Optional ID of the root folder to start listing from. Defaults to `undefined`
   * @returns A promise that resolves to an array of FabricFolder objects
   * @throws Throws an error if the API call fails
   */
  public async listFolders(
    workspaceId: string,
    requestConfig: ListFoldersRequest = { recursive: false, rootFolderId: undefined },
  ): Promise<Array<FabricFolder>> {
    logger.info('Listing folders in workspace: %s', workspaceId);

    try {
      let continuationToken: string = undefined;
      let folders: Array<FabricFolder> = [];

      do {
        const response = await this.makeApiCall<ListFolderResponse>(
          AllowedMethodEnum.GET,
          AllowedApiPaths.WORKSPACE_FOLDERS,
          undefined,
          {
            workspaceId,
          },
          {
            recursive: requestConfig.recursive?.toString() ?? undefined,
            rootFolderId: requestConfig.rootFolderId,
            ...(continuationToken ? { continuationToken } : {}),
          },
        );
        folders.push(...(response?.value || []));
        continuationToken = response?.continuationToken;
      } while (continuationToken);

      return folders;
    } catch (error: any) {
      logger.error('Error listing folders: %s', error.message);
      throw error;
    }
  }

  /**
   * Create a new folder in a workspace
   * @param workspaceId The workspace ID
   * @param folderData The folder data
   * @returns The created folder
   */
  public async createFolder(workspaceId: string, folderData: CreateFolderRequest): Promise<FabricFolder> {
    logger.info(
      'Creating folder "%s" in workspace: %s under parent: %s',
      folderData.displayName,
      workspaceId,
      folderData.parentFolderId || 'root',
    );

    try {
      const folder = await this.makeApiCall(AllowedMethodEnum.POST, AllowedApiPaths.WORKSPACE_FOLDERS, folderData, {
        workspaceId,
      });

      logger.info('Folder created successfully: %s', folder.id);
      return folder;
    } catch (error: any) {
      logger.error('Error creating folder: %s', error.message);
      throw error;
    }
  }

  /**
   * Get a specific folder from a workspace
   * @param workspaceId The workspace ID
   * @param folderId The folder ID
   * @returns The folder details
   */
  public async getFolder(workspaceId: string, folderId: string): Promise<FabricFolder> {
    logger.info('Getting folder %s from workspace: %s', folderId, workspaceId);

    try {
      const folder = await this.makeApiCall(AllowedMethodEnum.GET, AllowedApiPaths.WORKSPACE_FOLDER, undefined, {
        workspaceId,
        folderId,
      });

      logger.info('Folder retrieved: %s', folder.id);
      return folder;
    } catch (error: any) {
      logger.error('Error getting folder: %s', error.message);
      throw error;
    }
  }

  /**
   * Get a specific folder from a workspace by it's name or create it if it doesn't exist.
   * This also works for recursively creating folders if a path is provided. E.g. "ParentFolder/ChildFolder"
   * @param workspaceId The workspace ID
   * @param folderId The folder ID
   * @returns The folder details. If the folder didn't exist, it will be created and returned.
   * If the folder already existed, it will be returned as is without any modifications. Only the "last" folder created if recursive structure
   */
  public async getFolderOrCreate(workspaceId: string, folderPath: string): Promise<FabricFolder> {
    logger.info('Getting folder %s from workspace: %s', folderPath, workspaceId);

    const folderNames = folderPath.split('/').map((name) => name.trim());
    const [rootFolderName, ...subFolders] = folderNames;

    try {
      // first get root folders without recursion - this can avoid unnecessary recursive calls if the folder already exists
      const rootFolders = await this.listFolders(workspaceId);
      let rootFolder = rootFolders.find((f) => f.displayName === rootFolderName && f.workspaceId === workspaceId);
      let resultingFolder: FabricFolder = rootFolder;
      let rootFolderId = rootFolder?.id;
      if (!rootFolderId) {
        logger.info('Root folder "%s" not found. Creating it.', rootFolder);
        const createdRootFolder = await this.createFolder(workspaceId, { displayName: rootFolderName });
        resultingFolder = createdRootFolder;
        rootFolderId = createdRootFolder.id;
      }
      logger.info('Root folder "%s" has ID: %s', rootFolder, rootFolderId);

      // now recursively get or create subfolders if needed
      const allFolders = await this.listFolders(workspaceId, { recursive: true, rootFolderId });
      // find each subFolder in the list of all folders, if not found create it
      // iterate throught subFolders and filter them based on if found in allFolders. Break on first not found.
      let parentFolderId = rootFolderId;
      let createFolders = [];
      for (let i = 0; i < subFolders.length; i++) {
        const subFolderName = subFolders[i];
        let subFolder = allFolders.find((f) => f.displayName === subFolderName && f.workspaceId === workspaceId);
        if (!subFolder) {
          logger.info('Subfolder "%s" not found under parent ID %s.', subFolderName);
          createFolders = subFolders.slice(i); // all remaining folders in the path need to be created
          break;
        }
        resultingFolder = subFolder; // if folder is found, update the resulting folder to be returned at the end
      }
      for (const folderName of createFolders) {
        logger.info('Creating subfolder "%s" under parent ID %s.', folderName, parentFolderId);
        const createdFolder = await this.createFolder(workspaceId, { displayName: folderName, parentFolderId });
        parentFolderId = createdFolder.id; // update parent folder id for the next iteration
        resultingFolder = createdFolder; // update resulting folder to be returned at the end
      }

      logger.info('Folder retrieved: %s', resultingFolder.id);
      return resultingFolder;
    } catch (error: any) {
      logger.error('Error getting folder: %s', error.message);
      throw error;
    }
  }

  /**
   * Delete a folder from a workspace
   * @param workspaceId The workspace ID
   * @param folderId The folder ID
   */
  public async deleteFolder(workspaceId: string, folderId: string): Promise<void> {
    logger.info('Deleting folder %s from workspace: %s', folderId, workspaceId);

    try {
      await this.makeApiCall(AllowedMethodEnum.DELETE, AllowedApiPaths.WORKSPACE_FOLDER, undefined, {
        workspaceId,
        folderId,
      });

      logger.info('Folder deleted successfully: %s', folderId);
    } catch (error: any) {
      logger.error('Error deleting folder: %s', error.message);
      throw error;
    }
  }

  /**
   * List all workspaces
   * @returns Array of workspaces
   */
  public async listWorkspaces(): Promise<Array<FabricWorkspace>> {
    logger.info('Listing workspaces');

    try {
      const response = await this.makeApiCall(AllowedMethodEnum.GET, AllowedApiPaths.WORKSPACES);

      logger.info('Found %d workspaces', response.value?.length || 0);
      return response.value || [];
    } catch (error: any) {
      logger.error('Error listing workspaces: %s', error.message);
      throw error;
    }
  }

  /**
   * Get a specific workspace
   * @param workspaceId The workspace ID
   * @returns The workspace details
   */
  public async getWorkspace(workspaceId: string): Promise<FabricWorkspace> {
    logger.info('Getting workspace: %s', workspaceId);

    try {
      const workspace = await this.makeApiCall(AllowedMethodEnum.GET, AllowedApiPaths.WORKSPACE, undefined, {
        workspaceId,
      });

      logger.info('Workspace retrieved: %s', workspace.id);
      return workspace;
    } catch (error: any) {
      logger.error('Error getting workspace: %s', error.message);
      throw error;
    }
  }
}
