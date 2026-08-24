import {describe, expect, it, vi, beforeEach} from "vitest"
import {createPinia, setActivePinia} from "pinia"

import {useFileExplorerStore, type TreeNode, type TreeNodeDirectory} from "./fileExplorer"

const importFileDirectory = vi.fn()

vi.mock("override/stores/namespaces", () => ({
    useNamespacesStore: () => ({importFileDirectory}),
}))
vi.mock("../utils/toast", () => ({
    useToast: () => ({success: vi.fn(), error: vi.fn()}),
}))
vi.mock("vue-i18n", () => ({
    useI18n: () => ({t: (key: string) => key}),
}))

/** A FileList is not constructible, so this is the minimum importFiles reads off one. */
const fileList = (files: {name: string; relativePath?: string}[]) => {
    const entries = files.map(({name, relativePath}) => {
        const file = new File(["content"], name, {type: "text/plain"})
        if (relativePath) Object.defineProperty(file, "webkitRelativePath", {value: relativePath})
        return file
    })
    return entries as unknown as FileList
}

const names = (nodes: TreeNode[]) => nodes.map(node => node.fileName)

describe("fileExplorer importFiles", () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        importFileDirectory.mockReset().mockResolvedValue(undefined)
    })

    it("should not add a second tree entry when re-importing an existing file", async () => {
        const store = useFileExplorerStore()
        store.namespaceId = "dev"
        store.fileTree = [{id: "existing", fileName: "1.txt", extension: "txt", type: "File", leaf: true}]

        await store.importFiles(fileList([{name: "1.txt"}]))

        expect(names(store.fileTree)).toEqual(["1.txt"])
        // The file is still uploaded — import overwrites server-side, only the tree is deduped.
        expect(importFileDirectory).toHaveBeenCalledOnce()
    })

    it("should add a file that is not in the tree yet", async () => {
        const store = useFileExplorerStore()
        store.namespaceId = "dev"
        store.fileTree = [{id: "existing", fileName: "1.txt", extension: "txt", type: "File", leaf: true}]

        await store.importFiles(fileList([{name: "2.txt"}]))

        expect(names(store.fileTree)).toEqual(["1.txt", "2.txt"])
    })

    it("should keep the tree sorted when adding an imported file", async () => {
        const store = useFileExplorerStore()
        store.namespaceId = "dev"
        store.fileTree = [{id: "b", fileName: "b.txt", extension: "txt", type: "File", leaf: true}]

        await store.importFiles(fileList([{name: "a.txt"}]))

        expect(names(store.fileTree)).toEqual(["a.txt", "b.txt"])
    })

    it("should dedupe inside a folder when importing a directory", async () => {
        const store = useFileExplorerStore()
        store.namespaceId = "dev"
        store.fileTree = [{
            id: "folder",
            fileName: "src",
            type: "Directory",
            leaf: false,
            children: [{id: "existing", fileName: "a.py", extension: "py", type: "File", leaf: true}],
        }]

        await store.importFiles(fileList([{name: "a.py", relativePath: "src/a.py"}]))

        const folder = store.fileTree[0] as TreeNodeDirectory
        expect(names(folder.children)).toEqual(["a.py"])
    })

    it("should not add a file whose name collides with an existing folder", async () => {
        const store = useFileExplorerStore()
        store.namespaceId = "dev"
        store.fileTree = [{id: "folder", fileName: "docs", type: "Directory", leaf: false, children: []}]

        await store.importFiles(fileList([{name: "docs"}]))

        expect(store.fileTree).toHaveLength(1)
        expect(store.fileTree[0].type).toBe("Directory")
    })
})
