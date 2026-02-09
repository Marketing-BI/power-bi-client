/**
 * Fabric Workspace representation
 */
export interface FabricWorkspace {
  id: string;
  displayName: string;
  type?: string;
  state?: string;
  isReadOnly?: boolean;
  isOnDedicatedCapacity?: boolean;
}

/**
 * Fabric Folder representation
 */
export interface FabricFolder {
  id: string;
  displayName: string;
  workspaceId: string;
}

/**
 * Request object for creating a folder
 */
/**
 * Request payload for creating a new folder in a Power BI workspace.
 *
 * @example
 * const request: CreateFolderRequest = {
 *   displayName: "My Folder",
 *   description: "Optional folder description"
 * };
 */
export interface CreateFolderRequest {
  /**
   * The name of the folder to be created. This is a required field and must be unique within the workspace.
   *
   * @remarks
   * The folder name must comply with the following constraints:
   * - Cannot include C0 and C1 control codes
   * - Cannot contain leading or trailing spaces
   * - Cannot contain these characters: ~"#.&*:<>?/{|}
   * - Cannot be a system-reserved name: $recycle.bin, recycled, recycler
   * - Maximum length: 255 characters
   * - Must be unique within the parent folder or workspace root
   *
   * @pattern ^(?!.*[\x00-\x1F\x7F])(?![ ])(?!.*[ ]$)(?!(?:^\$recycle\.bin$|^recycled$|^recycler$))^[^~"#.&*:<>?/{|}]{1,255}$
   * @regex /^(?!.*[\x00-\x1F\x7F])(?![ ])(?!.*[ ]$)(?!(?:^\$recycle\.bin$|^recycled$|^recycler$))^[^~"#.&*:<>?/{|}]{1,255}$/i
   */
  displayName: string;

  /**
   * Optional parent folder ID under which the new folder will be created. If not provided, the folder will be created at the root of the workspace.
   */
  parentFolderId?: string;
}

export interface ListFoldersRequest {
  /**
   * Lists folders in a folder and its nested folders, or just a folder only. True - All folders in the folder and its nested folders are listed, False - Only folders in the folder are listed. The default value is true.
   * @default false
   */
  recursive?: boolean;

  /**
   * This parameter allows users to filter folders based on a specific root folder. If not provided, the workspace is used as the root folder.
   * Root folder UUID
   * @default undefined
   */
  rootFolderId?: string;
}

export interface ListFolderResponse {
  value: Array<FabricFolder>;
  continuationToken?: string;
  continuationUri?: string;
}
