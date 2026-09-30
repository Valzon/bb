import { describe, expect, it } from "vitest";
import {
  findPane,
  findPaneByContent,
  findPaneByThread,
  listPanes,
  MAX_PANES,
  setPanePinned,
  splitPane,
} from "@/lib/split-layout";
import type { PaneContent, PaneNode, SplitLayout } from "@/lib/split-layout";
import {
  applyThreadOpenToLayout,
  applyThreadPaneActionToLayout,
  createSinglePaneLayout,
  focusedPaneRoute,
  reconcileLayoutForContent,
} from "./splitThreadNavigation";

function twoPaneLayout(): SplitLayout {
  return splitPane(
    createSinglePaneLayout({ projectId: "p1", threadId: "thread-1" }),
    "pane-1",
    "right",
    {
      kind: "thread",
      projectId: "p1",
      threadId: "thread-2",
    },
  );
}

function eightPaneLayout(): SplitLayout {
  let layout = twoPaneLayout();
  for (let index = 3; index <= MAX_PANES; index += 1) {
    layout = applyThreadOpenToLayout(
      layout,
      { projectId: "p1", threadId: `thread-${index}` },
      "right",
    );
  }
  return layout;
}

describe("mixed page navigation", () => {
  it("keeps New Thread as a singleton and focuses its existing pane", () => {
    const withCompose = splitPane(twoPaneLayout(), "pane-2", "bottom", {
      kind: "new-thread",
    });

    const after = reconcileLayoutForContent(withCompose, {
      kind: "new-thread",
    });

    expect(listPanes(after.root)).toHaveLength(3);
    expect(after.focusedPaneId).toBe(
      findPaneByContent(after.root, { kind: "new-thread" })?.paneId,
    );
    expect(focusedPaneRoute(after)).toBe("/");
  });

  it("updates a plugin pane's subpath without duplicating the panel", () => {
    const plugin = {
      kind: "plugin-panel",
      pluginId: "notes",
      panelPath: "notes",
      subPath: "inbox.md",
    } as const;
    const before = splitPane(twoPaneLayout(), "pane-1", "bottom", plugin);

    const after = reconcileLayoutForContent(before, {
      ...plugin,
      subPath: "work/today.md",
    });

    expect(listPanes(after.root)).toHaveLength(3);
    expect(findPaneByContent(after.root, plugin)?.content).toEqual({
      ...plugin,
      subPath: "work/today.md",
    });
    expect(focusedPaneRoute(after)).toBe("/plugins/notes/notes/work/today.md");
  });
});

describe("applyThreadOpenToLayout", () => {
  it("splits from the focused pane and focuses the opened thread", () => {
    const before = twoPaneLayout();
    const after = applyThreadOpenToLayout(
      before,
      { projectId: "p2", threadId: "thread-3" },
      "down",
    );

    expect(listPanes(after.root)).toHaveLength(3);
    expect(findPaneByThread(after.root, "p2", "thread-3")?.paneId).toBe(
      after.focusedPaneId,
    );
  });

  it("focuses an already-open thread instead of duplicating it", () => {
    const before = twoPaneLayout();
    const after = applyThreadOpenToLayout(
      before,
      { projectId: "p1", threadId: "thread-1" },
      "right",
    );

    expect(listPanes(after.root)).toHaveLength(2);
    expect(after.focusedPaneId).toBe("pane-1");
  });

  it("creates panes five through eight, then replaces the focused pane for a ninth open", () => {
    const eight = eightPaneLayout();
    const focusedPaneId = eight.focusedPaneId;

    expect(listPanes(eight.root)).toHaveLength(MAX_PANES);
    expect(eight.root).toMatchObject({
      type: "split",
      dir: "row",
      sizes: Array.from({ length: MAX_PANES }, () => 1 / MAX_PANES),
    });
    for (let index = 5; index <= MAX_PANES; index += 1) {
      expect(
        findPaneByThread(eight.root, "p1", `thread-${index}`),
      ).not.toBeNull();
    }

    const after = applyThreadOpenToLayout(
      eight,
      { projectId: "p2", threadId: "thread-9" },
      "left",
    );

    expect(listPanes(after.root)).toHaveLength(MAX_PANES);
    expect(after.focusedPaneId).toBe(focusedPaneId);
    expect(findPaneByThread(after.root, "p2", "thread-9")?.paneId).toBe(
      focusedPaneId,
    );
    expect(findPaneByThread(after.root, "p1", "thread-8")).toBeNull();
  });
});

describe("applyThreadPaneActionToLayout", () => {
  it("focuses and maximizes the targeted open thread without changing the tree", () => {
    const before = twoPaneLayout();
    const result = applyThreadPaneActionToLayout(
      before,
      null,
      { projectId: "p1", threadId: "thread-1" },
      "maximize",
    );

    expect(result.layout.root).toEqual(before.root);
    expect(result.layout.focusedPaneId).toBe("pane-1");
    expect(result.maximizedPaneId).toBe("pane-1");
    expect(result.dimInactiveSplits).toBeNull();
  });

  it("restores only the targeted maximized pane and toggles it back", () => {
    const before = twoPaneLayout();
    const restored = applyThreadPaneActionToLayout(
      before,
      "pane-2",
      { projectId: "p1", threadId: "thread-2" },
      "restore",
    );
    expect(restored).toEqual({
      layout: before,
      maximizedPaneId: null,
      dimInactiveSplits: null,
    });

    const toggled = applyThreadPaneActionToLayout(
      restored.layout,
      restored.maximizedPaneId,
      { projectId: "p1", threadId: "thread-2" },
      "toggle",
    );
    expect(toggled.maximizedPaneId).toBe("pane-2");
  });

  it.each([
    ["spotlight", true],
    ["clear-spotlight", false],
  ] as const)(
    "focuses the target for %s and returns the preference",
    (action, expected) => {
      const before = twoPaneLayout();
      const result = applyThreadPaneActionToLayout(
        before,
        null,
        { projectId: "p1", threadId: "thread-1" },
        action,
      );

      expect(result.layout.root).toEqual(before.root);
      expect(result.layout.focusedPaneId).toBe("pane-1");
      expect(result.maximizedPaneId).toBeNull();
      expect(result.dimInactiveSplits).toBe(expected);
    },
  );

  it("is a no-op when the target is not open", () => {
    const before = twoPaneLayout();
    expect(
      applyThreadPaneActionToLayout(
        before,
        "pane-2",
        { projectId: "p1", threadId: "missing" },
        "maximize",
      ),
    ).toEqual({
      layout: before,
      maximizedPaneId: "pane-2",
      dimInactiveSplits: null,
    });
  });
});

function pluginPanel(pluginId: string): PaneContent {
  return { kind: "plugin-panel", pluginId, panelPath: "main", subPath: "" };
}

function rowLayout(panes: PaneNode[], focusedPaneId: string): SplitLayout {
  return {
    root: {
      type: "split",
      dir: "row",
      sizes: panes.map(() => 1 / panes.length),
      children: panes,
    },
    focusedPaneId,
  };
}

function pinnedPluginPane(paneId: string, pluginId: string): PaneNode {
  return {
    type: "pane",
    paneId,
    content: pluginPanel(pluginId),
    pinned: true,
  };
}

function threadPane(paneId: string, threadId: string): PaneNode {
  return {
    type: "pane",
    paneId,
    content: { kind: "thread", projectId: "p1", threadId },
  };
}

describe("pinned panes", () => {
  const inboxFocused = rowLayout(
    [
      pinnedPluginPane("pane-1", "tasks"),
      threadPane("pane-2", "thread-2"),
      pinnedPluginPane("pane-3", "inbox"),
    ],
    "pane-3",
  );

  it("sends navigation from a focused pinned pane to the unpinned pane", () => {
    const after = reconcileLayoutForContent(
      inboxFocused,
      { kind: "thread", projectId: "p1", threadId: "thread-9" },
      ["pane-3", "pane-2", "pane-1"],
    );

    expect(after.focusedPaneId).toBe("pane-2");
    expect(findPane(after.root, "pane-2")?.content).toEqual({
      kind: "thread",
      projectId: "p1",
      threadId: "thread-9",
    });
    expect(findPane(after.root, "pane-3")).toEqual(
      pinnedPluginPane("pane-3", "inbox"),
    );
    expect(findPane(after.root, "pane-1")).toEqual(
      pinnedPluginPane("pane-1", "tasks"),
    );
  });

  it("picks the unpinned pane focused most recently", () => {
    const layout = rowLayout(
      [
        pinnedPluginPane("pane-1", "tasks"),
        threadPane("pane-2", "thread-2"),
        threadPane("pane-3", "thread-3"),
        pinnedPluginPane("pane-4", "inbox"),
      ],
      "pane-4",
    );

    const after = reconcileLayoutForContent(layout, pluginPanel("board"), [
      "pane-4",
      "pane-3",
      "pane-2",
    ]);

    expect(after.focusedPaneId).toBe("pane-3");
    expect(findPane(after.root, "pane-3")?.content).toEqual(
      pluginPanel("board"),
    );
    expect(findPane(after.root, "pane-2")?.content).toEqual(
      threadPane("pane-2", "thread-2").content,
    );
  });

  it("falls back to the first unpinned pane without focus history", () => {
    const after = reconcileLayoutForContent(inboxFocused, pluginPanel("board"));

    expect(after.focusedPaneId).toBe("pane-2");
  });

  it("replaces a focused unpinned pane as before", () => {
    const after = reconcileLayoutForContent(
      { ...inboxFocused, focusedPaneId: "pane-2" },
      pluginPanel("board"),
      ["pane-2", "pane-3"],
    );

    expect(after.focusedPaneId).toBe("pane-2");
    expect(findPane(after.root, "pane-2")?.content).toEqual(
      pluginPanel("board"),
    );
  });

  it("focuses content that is already open, even in a pinned pane", () => {
    const after = reconcileLayoutForContent(
      { ...inboxFocused, focusedPaneId: "pane-2" },
      pluginPanel("inbox"),
    );

    expect(after.focusedPaneId).toBe("pane-3");
    expect(listPanes(after.root)).toEqual(listPanes(inboxFocused.root));
  });

  it("opens beside the focused pane when every pane is pinned, and replaces it only at the pane cap", () => {
    const allPinned = rowLayout(
      [
        pinnedPluginPane("pane-1", "tasks"),
        pinnedPluginPane("pane-2", "inbox"),
      ],
      "pane-2",
    );

    const beside = reconcileLayoutForContent(allPinned, pluginPanel("board"));
    expect(listPanes(beside.root).map((pane) => pane.paneId)).toEqual([
      "pane-1",
      "pane-2",
      "pane-3",
    ]);
    expect(beside.focusedPaneId).toBe("pane-3");

    const full = rowLayout(
      Array.from({ length: MAX_PANES }, (_, index) =>
        pinnedPluginPane(`pane-${index + 1}`, `plugin-${index + 1}`),
      ),
      "pane-1",
    );
    const replaced = reconcileLayoutForContent(full, pluginPanel("board"));
    expect(findPane(replaced.root, "pane-1")?.content).toEqual(
      pluginPanel("board"),
    );
  });

  it("pins and unpins a thread's pane from a pane action without moving focus or maximizing", () => {
    const before = twoPaneLayout();
    const pinned = applyThreadPaneActionToLayout(
      before,
      null,
      { projectId: "p1", threadId: "thread-1" },
      "pin",
    );

    expect(findPane(pinned.layout.root, "pane-1")?.pinned).toBe(true);
    expect(pinned.layout.focusedPaneId).toBe(before.focusedPaneId);
    expect(pinned.maximizedPaneId).toBeNull();
    expect(pinned.dimInactiveSplits).toBeNull();

    const unpinned = applyThreadPaneActionToLayout(
      pinned.layout,
      null,
      { projectId: "p1", threadId: "thread-1" },
      "unpin",
    );
    expect(unpinned.layout.root).toEqual(before.root);
  });

  it("keeps thread opens and the pane-cap replace off pinned panes", () => {
    const opened = applyThreadOpenToLayout(
      inboxFocused,
      { projectId: "p1", threadId: "thread-9" },
      "replace",
      ["pane-3", "pane-2"],
    );
    expect(findPane(opened.root, "pane-2")?.content).toEqual({
      kind: "thread",
      projectId: "p1",
      threadId: "thread-9",
    });
    expect(findPane(opened.root, "pane-3")?.pinned).toBe(true);

    const full = setPanePinned(eightPaneLayout(), "pane-8", true);
    const capped = applyThreadOpenToLayout(
      { ...full, focusedPaneId: "pane-8" },
      { projectId: "p1", threadId: "thread-9" },
      "right",
      ["pane-8", "pane-5"],
    );
    expect(findPaneByThread(capped.root, "p1", "thread-9")?.paneId).toBe(
      "pane-5",
    );
    expect(findPaneByThread(capped.root, "p1", "thread-8")?.paneId).toBe(
      "pane-8",
    );
  });
});
