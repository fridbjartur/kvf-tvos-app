import { folderNavigationManager } from "../folderNavigationManager";
import * as jellyfinApi from "../jellyfinApi";
import { JellyfinItem, FolderStackEntry } from "@/types/jellyfin";

jest.mock("../jellyfinApi");
jest.mock("@/utils/logger");

const mockFetchFolderContents = jellyfinApi.fetchFolderContents as jest.MockedFunction<typeof jellyfinApi.fetchFolderContents>;
const mockFetchPlaylistContents = jellyfinApi.fetchPlaylistContents as jest.MockedFunction<typeof jellyfinApi.fetchPlaylistContents>;

describe("FolderNavigationManager", () => {
  // Mock data
  const mockFolderItems: JellyfinItem[] = [
    {
      Id: "folder1",
      Name: "Movies",
      Type: "Folder",
      RunTimeTicks: 0,
      Path: "/media/movies",
      ChildCount: 50,
    },
  ];

  const mockPlaylistItems: JellyfinItem[] = [
    {
      Id: "video1",
      Name: "Movie 1",
      Type: "Movie",
      RunTimeTicks: 36000000000,
      Path: "/media/movie1.mp4",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    folderNavigationManager.clearCache();

    // Default mocks
    mockFetchFolderContents.mockResolvedValue({
      items: mockFolderItems,
      total: 1,
    });
    mockFetchPlaylistContents.mockResolvedValue({
      items: mockPlaylistItems,
      total: 1,
    });
  });

  describe("singleton pattern", () => {
    it("should return same instance", () => {
      const instance1 = folderNavigationManager;
      const instance2 = folderNavigationManager;
      expect(instance1).toBe(instance2);
    });
  });

  describe("navigateToFolder", () => {
    it("should push folder onto stack", async () => {
      const folder: FolderStackEntry = {
        id: "folder1",
        name: "Movies",
        type: "folder",
      };

      await folderNavigationManager.navigateToFolder(folder);

      const state = folderNavigationManager.getState();
      expect(state.folderStack).toHaveLength(1);
      expect(state.folderStack[0]).toEqual(folder);
      expect(state.currentFolder).toEqual(folder);
    });

    it("should load folder contents", async () => {
      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });

      expect(mockFetchFolderContents).toHaveBeenCalledWith("folder1", {
        limit: 60,
        startIndex: 0,
      });

      const state = folderNavigationManager.getState();
      expect(state.items).toEqual(mockFolderItems);
    });

    it("should route to playlist API for playlist type", async () => {
      await folderNavigationManager.navigateToFolder({
        id: "playlist1",
        name: "Favorites",
        type: "playlist",
      });

      expect(mockFetchPlaylistContents).toHaveBeenCalledWith("playlist1", {
        limit: 60,
        startIndex: 0,
      });
      expect(mockFetchFolderContents).not.toHaveBeenCalled();
    });
  });

  describe("navigateBack", () => {
    it("should return false when already at root", async () => {
      const result = await folderNavigationManager.navigateBack();
      expect(result).toBe(false);
    });

    it("should load root when at library root", async () => {
      await folderNavigationManager.navigateToFolder({
        id: "library1",
        name: "Movies Library",
        type: "folder",
      });

      const result = await folderNavigationManager.navigateBack();

      expect(result).toBe(true);
      expect(mockFetchFolderContents).toHaveBeenCalledWith(null, {
        limit: 60,
        startIndex: 0,
      });
      expect(folderNavigationManager.getState().folderStack).toHaveLength(0);
    });

    it("should pop stack and load parent folder", async () => {
      // Navigate into nested folders
      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });
      mockFetchFolderContents.mockClear();

      await folderNavigationManager.navigateToFolder({
        id: "folder2",
        name: "Action",
        type: "folder",
      });

      const result = await folderNavigationManager.navigateBack();

      expect(result).toBe(true);
      expect(folderNavigationManager.getState().folderStack).toHaveLength(1);
      expect(folderNavigationManager.getState().currentFolder?.id).toBe("folder1");
    });
  });

  describe("navigateToBreadcrumb", () => {
    it("should truncate stack to index", async () => {
      // Build 3-level deep stack
      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });
      await folderNavigationManager.navigateToFolder({
        id: "folder2",
        name: "Action",
        type: "folder",
      });
      await folderNavigationManager.navigateToFolder({
        id: "folder3",
        name: "Recent",
        type: "folder",
      });

      expect(folderNavigationManager.getState().folderStack).toHaveLength(3);

      // Navigate to index 1 (folder2)
      await folderNavigationManager.navigateToBreadcrumb(1);

      const state = folderNavigationManager.getState();
      expect(state.folderStack).toHaveLength(2);
      expect(state.currentFolder?.id).toBe("folder2");
    });

    it("should handle out-of-bounds index gracefully", async () => {
      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });

      const stateBefore = folderNavigationManager.getState();

      // Try invalid indices
      await folderNavigationManager.navigateToBreadcrumb(-1);
      await folderNavigationManager.navigateToBreadcrumb(10);

      const stateAfter = folderNavigationManager.getState();
      expect(stateAfter.folderStack).toEqual(stateBefore.folderStack);
    });
  });

  describe("loadRoot", () => {
    it("should clear stack and load root libraries", async () => {
      // Navigate into folder first
      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });

      mockFetchFolderContents.mockClear();

      await folderNavigationManager.loadRoot();

      expect(folderNavigationManager.getState().folderStack).toHaveLength(0);
      expect(mockFetchFolderContents).toHaveBeenCalledWith(null, {
        limit: 60,
        startIndex: 0,
      });
    });
  });

  describe("loadMore pagination", () => {
    it("should load next page", async () => {
      mockFetchFolderContents.mockResolvedValueOnce({
        items: mockFolderItems,
        total: 100,
      });

      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });

      expect(folderNavigationManager.getState().hasMoreResults).toBe(true);

      const page2Items: JellyfinItem[] = [
        {
          Id: "folder2",
          Name: "TV Shows",
          Type: "Folder",
          RunTimeTicks: 0,
          Path: "/media/tv",
          ChildCount: 30,
        },
      ];
      mockFetchFolderContents.mockResolvedValueOnce({
        items: page2Items,
        total: 100,
      });

      await folderNavigationManager.loadMore();

      const state = folderNavigationManager.getState();
      expect(state.items).toHaveLength(2);
      expect(mockFetchFolderContents).toHaveBeenLastCalledWith("folder1", {
        limit: 60,
        startIndex: 1,
      });
    });

    it("should not load when already loading", async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetchFolderContents.mockResolvedValueOnce({
        items: mockFolderItems,
        total: 100,
      });
      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });

      mockFetchFolderContents.mockReturnValue(promise as any);
      const loadMore1 = folderNavigationManager.loadMore();
      const loadMore2 = folderNavigationManager.loadMore();

      resolvePromise!({ items: [], total: 100 });
      await Promise.all([loadMore1, loadMore2]);

      // Should only call once (initial + one loadMore)
      expect(mockFetchFolderContents).toHaveBeenCalledTimes(2);
    });

    it("should set hasMoreResults to false on last page", async () => {
      mockFetchFolderContents.mockResolvedValueOnce({
        items: mockFolderItems,
        total: 100,
      });

      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });

      mockFetchFolderContents.mockResolvedValueOnce({
        items: [],
        total: 100,
      });

      await folderNavigationManager.loadMore();

      expect(folderNavigationManager.getState().hasMoreResults).toBe(false);
    });

    it("should use playlist API for playlist pagination", async () => {
      mockFetchPlaylistContents.mockResolvedValueOnce({
        items: mockPlaylistItems,
        total: 100,
      });

      await folderNavigationManager.navigateToFolder({
        id: "playlist1",
        name: "Favorites",
        type: "playlist",
      });

      const page2Items: JellyfinItem[] = [
        {
          Id: "video2",
          Name: "Movie 2",
          Type: "Movie",
          RunTimeTicks: 36000000000,
          Path: "/media/movie2.mp4",
        },
      ];
      mockFetchPlaylistContents.mockResolvedValueOnce({
        items: page2Items,
        total: 100,
      });

      await folderNavigationManager.loadMore();

      expect(mockFetchPlaylistContents).toHaveBeenLastCalledWith("playlist1", {
        limit: 60,
        startIndex: 1,
      });
      expect(mockFetchFolderContents).not.toHaveBeenCalled();
    });
  });

  describe("cache behavior", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should use cache within TTL", async () => {
      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });
      expect(mockFetchFolderContents).toHaveBeenCalledTimes(1);

      // Advance 4 minutes (less than 5 min TTL)
      jest.advanceTimersByTime(4 * 60 * 1000);

      // Navigate away and back
      await folderNavigationManager.navigateBack();
      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });

      // Should still be 1 (used cache) - wait, navigateBack also calls fetchFolderContents
      // So it should be 2 calls total: 1 for initial navigate + 1 for navigateBack, then cache hit
      expect(mockFetchFolderContents).toHaveBeenCalledTimes(2);
    });

    it("should refetch after TTL expires", async () => {
      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });
      const initialCalls = mockFetchFolderContents.mock.calls.length;

      // Advance 6 minutes (more than 5 min TTL)
      jest.advanceTimersByTime(6 * 60 * 1000);

      await folderNavigationManager.navigateBack();
      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });

      // Should have 3 calls: initial + navigateBack + refetch (cache expired)
      expect(mockFetchFolderContents).toHaveBeenCalledTimes(initialCalls + 2);
    });
  });

  describe("refresh", () => {
    it("should invalidate cache and reload", async () => {
      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });
      expect(mockFetchFolderContents).toHaveBeenCalledTimes(1);

      await folderNavigationManager.refresh();

      expect(mockFetchFolderContents).toHaveBeenCalledTimes(2);
    });
  });

  describe("subscribe", () => {
    it("should notify listener immediately", () => {
      const listener = jest.fn();

      folderNavigationManager.subscribe(listener);

      expect(listener).toHaveBeenCalledWith({
        items: [],
        isLoading: false,
        isLoadingMore: false,
        hasMoreResults: false,
        error: null,
        folderStack: [],
        currentFolder: null,
      });
    });

    it("should notify on state changes", async () => {
      const listener = jest.fn();
      folderNavigationManager.subscribe(listener);
      listener.mockClear();

      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });

      expect(listener).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          items: mockFolderItems,
          currentFolder: { id: "folder1", name: "Movies", type: "folder" },
        }),
      );
    });

    it("should return unsubscribe function", () => {
      const listener = jest.fn();
      const unsubscribe = folderNavigationManager.subscribe(listener);

      expect(typeof unsubscribe).toBe("function");

      unsubscribe();
      listener.mockClear();

      folderNavigationManager.clearCache();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should set error state on fetch failure", async () => {
      mockFetchFolderContents.mockRejectedValueOnce(new Error("Network error"));

      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });

      expect(folderNavigationManager.getState().error).toBe("Network error");
    });

    it("should clear error on successful retry", async () => {
      mockFetchFolderContents.mockRejectedValueOnce(new Error("Network error"));
      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });

      mockFetchFolderContents.mockResolvedValueOnce({
        items: mockFolderItems,
        total: 1,
      });
      await folderNavigationManager.refresh();

      expect(folderNavigationManager.getState().error).toBe(null);
    });

    it("should set error on loadMore failure", async () => {
      mockFetchFolderContents.mockResolvedValueOnce({
        items: mockFolderItems,
        total: 100,
      });

      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });

      mockFetchFolderContents.mockRejectedValueOnce(new Error("Load more failed"));

      await folderNavigationManager.loadMore();

      expect(folderNavigationManager.getState().error).toBe("Load more failed");
    });
  });

  describe("clearCache", () => {
    it("should reset all state", async () => {
      await folderNavigationManager.navigateToFolder({
        id: "folder1",
        name: "Movies",
        type: "folder",
      });

      const stateBefore = folderNavigationManager.getState();
      expect(stateBefore.items).toHaveLength(1);
      expect(stateBefore.folderStack).toHaveLength(1);

      folderNavigationManager.clearCache();

      const stateAfter = folderNavigationManager.getState();
      expect(stateAfter.items).toHaveLength(0);
      expect(stateAfter.folderStack).toHaveLength(0);
      expect(stateAfter.error).toBe(null);
      expect(stateAfter.hasMoreResults).toBe(false);
    });

    it("should notify listeners on clear", () => {
      const listener = jest.fn();
      folderNavigationManager.subscribe(listener);
      listener.mockClear();

      folderNavigationManager.clearCache();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [],
          folderStack: [],
        }),
      );
    });
  });
});
