import { ref, readonly } from 'vue'

export function pathsEqual(a, b) {
  return a.length === b.length && a.every((s, i) => s === b[i])
}

function isAncestorOf(ancestorPath, descendantPath) {
  if (descendantPath.length <= ancestorPath.length) return false
  return ancestorPath.every((step, i) => step === descendantPath[i])
}

export function getNodeAtPath(tree, path) {
  let node = tree
  for (const step of path) node = node?.[step]
  return node
}

function setNodeAtPath(tree, path, value) {
  if (path.length === 0) return value
  const [head, ...tail] = path
  return { ...tree, [head]: setNodeAtPath(tree[head], tail, value) }
}

// Swaps only the condition fields — the and/or topology stays the same.
// This makes it cycle-safe for any pair, including parent↔child.
export function applySwap(tree, pathA, pathB) {
  const nodeA = getNodeAtPath(tree, pathA)
  const nodeB = getNodeAtPath(tree, pathB)
  const condA = JSON.parse(JSON.stringify(nodeA.condition))
  const condB = JSON.parse(JSON.stringify(nodeB.condition))
  let result = setNodeAtPath(tree, pathA, { ...nodeA, condition: condB })
  result = setNodeAtPath(result, pathB, { ...getNodeAtPath(result, pathB), condition: condA })
  return result
}

export function applyMoveToSlot(tree, sourcePath, targetPath, slot) {
  const sourceNode = JSON.parse(JSON.stringify(getNodeAtPath(tree, sourcePath)))
  let result = setNodeAtPath(tree, sourcePath, null)
  result = setNodeAtPath(result, [...targetPath, slot], sourceNode)
  return result
}

export function useConditionDrag() {
  const isDragging = ref(false)
  const sourcePath = ref(null)
  const mouseX = ref(0)
  const mouseY = ref(0)
  const sourceRect = ref(null)
  const hoveredTargetPath = ref(null)
  const hoveredAction = ref(null)

  function startDrag(path, rect) {
    isDragging.value = true
    sourcePath.value = path
    sourceRect.value = rect
    mouseX.value = rect.left + rect.width / 2
    mouseY.value = rect.top + rect.height / 2
  }

  function updateMouse(x, y) {
    mouseX.value = x
    mouseY.value = y
  }

  function setHover(targetPath, action) {
    hoveredTargetPath.value = targetPath
    hoveredAction.value = action
  }

  function clearHover() {
    hoveredTargetPath.value = null
    hoveredAction.value = null
  }

  function endDrag() {
    isDragging.value = false
    sourcePath.value = null
    sourceRect.value = null
    hoveredTargetPath.value = null
    hoveredAction.value = null
  }

  function isSource(path) {
    return isDragging.value && !!sourcePath.value && pathsEqual(path, sourcePath.value)
  }

  function isDescendantOfSource(path) {
    return isDragging.value && !!sourcePath.value && isAncestorOf(sourcePath.value, path)
  }

  function isAncestorOfSource(path) {
    return isDragging.value && !!sourcePath.value && isAncestorOf(path, sourcePath.value)
  }

  return {
    isDragging: readonly(isDragging),
    sourcePath: readonly(sourcePath),
    mouseX: readonly(mouseX),
    mouseY: readonly(mouseY),
    sourceRect: readonly(sourceRect),
    hoveredTargetPath: readonly(hoveredTargetPath),
    hoveredAction: readonly(hoveredAction),
    startDrag,
    updateMouse,
    setHover,
    clearHover,
    endDrag,
    isSource,
    isDescendantOfSource,
    isAncestorOfSource,
  }
}
