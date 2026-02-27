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
  FabricItem,
  ListFoldersRequest,
  ListFolderResponse,
  DeleteRecursiveOptions,
} from './interfaces.fabric';

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
  FOLDER_ITEMS: fabricRestConfig.url + '/workspaces/:workspaceId/items/',
  WORKSPACE_ITEM: fabricRestConfig.url + '/workspaces/:workspaceId/items/:itemId',
};

/**
 * FabricService handles Microsoft Fabric API operations
 */
export class FabricService {
  private readonly _fabricClient: FabricClient;
  private _authorizationToken: AzureAccessToken | null = null;

  constructor(fabricClient: FabricClient) {
    this._fabricClient = fabricClient;
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
        Authorization: `Bearer ${this._authorizationToken!.accessToken}`,
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
      let continuationToken: string = '';
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
            ...(requestConfig.recursive !== undefined ? { recursive: requestConfig.recursive?.toString() } : {}),
            ...(requestConfig.rootFolderId !== undefined ? { rootFolderId: requestConfig.rootFolderId } : {}),
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
   * List all items inside a specific folder in a Power BI group.
   * @param groupId The Power BI group ID
   * @param folderId The folder ID
   * @returns Array of folder items
   */
  public async listFolderItems(groupId: string, folderId: string): Promise<Array<FabricItem>> {
    logger.info('Listing items in folder %s for group: %s', folderId, groupId);

    try {
      let continuationToken: string = '';
      const items: Array<FabricItem> = [];

      do {
        const response = await this.makeApiCall<
          undefined,
          { value?: Array<FabricItem>; continuationToken?: string }
        >(
          AllowedMethodEnum.GET,
          AllowedApiPaths.FOLDER_ITEMS,
          undefined,
          {
            workspaceId: groupId,
          },
          {
            ...(continuationToken ? { continuationToken } : {}),
            rootFolderId: folderId,
          },
        );

        items.push(...(response?.value || []));
        continuationToken = response?.continuationToken || '';
      } while (continuationToken);

      logger.info('Found %d items in folder %s', items.length, folderId);
      return items;
    } catch (error: any) {
      logger.error('Error listing folder items: %s', error.message);
      throw error;
    }
  }

  /**
   * Delete a specific item (report, semantic model, etc.) from a workspace.
   *
   * @param workspaceId - The ID of the workspace
   * @param itemId - The ID of the item to delete
   */
  public async deleteItem(workspaceId: string, itemId: string): Promise<void> {
    logger.info('Deleting item %s from workspace: %s', itemId, workspaceId);

    try {
      await this.makeApiCall<void>(AllowedMethodEnum.DELETE, AllowedApiPaths.WORKSPACE_ITEM, undefined, {
        workspaceId,
        itemId,
      });

      logger.info('Item deleted successfully: %s', itemId);
    } catch (error: any) {
      logger.error('Error deleting item %s: %s', itemId, error.message);
      throw error;
    }
  }

  /**
   * Remove a folder from a workspace. Can only delete empty folders.
   * @param workspaceId
   * @param folderId
   */
  public async removeFolder(workspaceId: string, folderId: string): Promise<void> {
    logger.info('Removing folder "%s" from workspace: %s', folderId, workspaceId);

    try {
      await this.makeApiCall<void>(AllowedMethodEnum.DELETE, AllowedApiPaths.WORKSPACE_FOLDER, undefined, {
        workspaceId,
        folderId,
      });

      logger.info('Folder removed successfully: %s', folderId);
    } catch (error: any) {
      logger.error('Error removing folder: %s', error.message);
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
      let resultingFolder: FabricFolder | undefined = rootFolder;
      let rootFolderId = rootFolder?.id;
      if (!rootFolderId) {
        logger.info('Root folder "%s" not found. Creating it.', rootFolderName);
        const createdRootFolder = await this.createFolder(workspaceId, { displayName: rootFolderName });
        resultingFolder = createdRootFolder;
        rootFolderId = createdRootFolder.id;
      }
      logger.info('Root folder "%s" has ID: %s', rootFolderName, rootFolderId);

      // now recursively get or create subfolders if needed
      const allFolders = await this.listFolders(workspaceId, { recursive: true, rootFolderId });
      // find each subFolder in the list of all folders, if not found create it
      // iterate throught subFolders and filter them based on if found in allFolders. Break on first not found.
      let parentFolderId = rootFolderId;
      let createFolders: Array<string> = [];
      for (let i = 0; i < subFolders.length; i++) {
        const subFolderName = subFolders[i];
        let subFolder = allFolders.find(
          (f) =>
            f.displayName === subFolderName && f.workspaceId === workspaceId && f.parentFolderId === parentFolderId,
        );
        if (!subFolder) {
          logger.info('Subfolder "%s" not found under parent ID %s.', subFolderName, parentFolderId);
          createFolders = subFolders.slice(i); // all remaining folders in the path need to be created
          break;
        }
        parentFolderId = subFolder.id; // update parent folder id for the next iteration
        resultingFolder = subFolder; // if folder is found, update the resulting folder to be returned at the end
      }
      for (const folderName of createFolders) {
        logger.info('Creating subfolder "%s" under parent ID %s.', folderName, parentFolderId);
        const createdFolder = await this.createFolder(workspaceId, { displayName: folderName, parentFolderId });
        parentFolderId = createdFolder.id; // update parent folder id for the next iteration
        resultingFolder = createdFolder; // update resulting folder to be returned at the end
      }

      if (!resultingFolder) {
        logger.error('Folder path "%s" is invalid. No folder found or created.', folderPath);
        throw new Error('Folder path is invalid. No folder found or created.');
      }

      logger.info('Folder retrieved: %s', resultingFolder.id);
      return resultingFolder;
    } catch (error: any) {
      logger.error('Error getting folder: %s', error.message);
      throw error;
    }
  }

  /**
   * Recursively deletes all contents of a folder identified by its path.
   * Optionally deletes the folder itself after clearing its contents.
   *
   * The path is resolved by navigating the folder hierarchy (e.g. "Parent/Child/Target").
   * If the folder is not found, the operation is a no-op.
   * Child folders are deleted bottom-up (deepest first) so that each folder is empty before it is removed.
   *
   * @param workspaceId - The ID of the workspace
   * @param folderPath - Slash-separated path to the target folder (e.g. "Reports/2024/Q1")
   * @param options - Additional options controlling the delete behaviour
   * @param options.deleteSelf - When `true`, the target folder itself is deleted after its contents are removed. Defaults to `false`.
   */
  public async deleteRecursive(
    workspaceId: string,
    folderPath: string,
    options: DeleteRecursiveOptions = {},
  ): Promise<void> {
    const { deleteSelf = false } = options;
    logger.info(
      'Recursively deleting contents of folder path "%s" in workspace: %s (deleteSelf=%s)',
      folderPath,
      workspaceId,
      deleteSelf,
    );

    const folderNames = folderPath.split('/').map((name) => name.trim());
    const [rootFolderName, ...subFolders] = folderNames;

    try {
      // Resolve the root folder
      const rootFolders = await this.listFolders(workspaceId);
      const rootFolder = rootFolders.find((f) => f.displayName === rootFolderName && f.workspaceId === workspaceId);

      if (!rootFolder) {
        logger.info('Folder "%s" not found in workspace %s. Nothing to delete.', rootFolderName, workspaceId);
        return;
      }

      // Navigate down the path to reach the target folder
      let targetFolder: FabricFolder = rootFolder;

      if (subFolders.length > 0) {
        const allFolders = await this.listFolders(workspaceId, { recursive: true, rootFolderId: rootFolder.id });
        let parentFolderId = rootFolder.id;

        for (const subFolderName of subFolders) {
          const subFolder = allFolders.find(
            (f) =>
              f.displayName === subFolderName && f.workspaceId === workspaceId && f.parentFolderId === parentFolderId,
          );

          if (!subFolder) {
            logger.info('Folder "%s" not found at path "%s". Nothing to delete.', subFolderName, folderPath);
            return;
          }

          parentFolderId = subFolder.id;
          targetFolder = subFolder;
        }
      }

      // Collect all descendant folders and delete bottom-up (deepest first)
      const descendants = await this.listFolders(workspaceId, { recursive: true, rootFolderId: targetFolder.id });
      const allNodes = [targetFolder, ...descendants];

      const getDepth = (folder: FabricFolder): number => {
        let depth = 0;
        let current: FabricFolder | undefined = folder;
        while (current?.parentFolderId) {
          const parent = allNodes.find((f) => f.id === current!.parentFolderId);
          if (!parent) break;
          depth++;
          current = parent;
        }
        return depth;
      };

      // Sort deepest-first so each folder is empty before we delete it
      const foldersToEmpty = [...descendants].sort((a, b) => getDepth(b) - getDepth(a));

      // Also empty the target folder itself
      foldersToEmpty.push(targetFolder);

      for (const folder of foldersToEmpty) {
        // Delete all items inside the folder first
        const items = await this.listFolderItems(workspaceId, folder.id);
        for (const item of items) {
          logger.info('Deleting item "%s" (type: %s, id: %s) from folder %s', item.displayName, item.type, item.id, folder.id);
          await this.deleteItem(workspaceId, item.id);
        }

        // Delete the (now-empty) folder unless it's the target and deleteSelf is false
        const isTargetFolder = folder.id === targetFolder.id;
        if (!isTargetFolder) {
          await this.deleteFolder(workspaceId, folder.id);
        }
      }

      if (deleteSelf) {
        await this.deleteFolder(workspaceId, targetFolder.id);
        logger.info('Folder "%s" (id: %s) deleted.', folderPath, targetFolder.id);
      } else {
        logger.info('Contents of folder "%s" deleted. Folder itself was kept.', folderPath);
      }
    } catch (error: any) {
      logger.error('Error during deleteRecursive for path "%s": %s', folderPath, error.message);
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
   * Delete a workspace.
   *
   * @param workspaceId - The ID of the workspace to delete
   */
  public async deleteWorkspace(workspaceId: string): Promise<void> {
    logger.info('Deleting workspace: %s', workspaceId);

    try {
      await this.makeApiCall<void>(AllowedMethodEnum.DELETE, AllowedApiPaths.WORKSPACE, undefined, { workspaceId });

      logger.info('Workspace deleted successfully: %s', workspaceId);
    } catch (error: any) {
      logger.error('Error deleting workspace %s: %s', workspaceId, error.message);
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
