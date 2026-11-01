import { ref } from 'vue'

// A rule blueprint is a copied rule (name, enabled, condition tree, actions)
// that can be pasted back in as a new, unsaved rule. Only one blueprint is
// held at a time: copying replaces the previous one.
//
// The blueprint is written to the system clipboard as JSON, so it can be
// pasted on another Appliance, and also kept in localStorage, because the
// Clipboard API is missing on plain-HTTP origins and reading it can be denied.

const STORAGE_KEY = 'humi-rule-blueprint'
const FORMAT = 'humi-rule-blueprint'
const VERSION = 1

// The draft waiting to be opened by RuleDetail on the RuleNew route. Set by
// whoever pastes, consumed (and cleared) by RuleDetail.
const pendingDraft = ref(null)

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function isDeviceCondition(condition) {
  return typeof condition?.type === 'string' && condition.type.startsWith('device-id-')
}

function walkTree(node, visit) {
  if (!node) return
  visit(node)
  walkTree(node.and, visit)
  walkTree(node.or, visit)
}

// hasTargetIds reports whether any condition or action refers to a device or group.
export function hasTargetIds(rule) {
  let found = (rule.actions || []).some(a => a.id != null)
  walkTree(rule['condition-tree'], node => {
    if (isDeviceCondition(node.condition) && node.condition.id != null) found = true
  })
  return found
}

// hasMissingTargetIds reports whether any condition or action still needs a device or group.
export function hasMissingTargetIds(rule) {
  let missing = (rule.actions || []).some(a => a.id == null)
  walkTree(rule['condition-tree'], node => {
    if (isDeviceCondition(node.condition) && node.condition.id == null) missing = true
  })
  return missing
}

// clearTargetIds returns a copy of rule with every device and group ID set to null.
export function clearTargetIds(rule) {
  const copy = clone(rule)
  copy.actions = (copy.actions || []).map(a => ({ ...a, id: null }))
  walkTree(copy['condition-tree'], node => {
    if (isDeviceCondition(node.condition)) node.condition.id = null
  })
  return copy
}

function toBlueprint(rule) {
  return {
    format: FORMAT,
    version: VERSION,
    rule: {
      name: rule.name,
      enabled: rule.enabled,
      'condition-tree': clone(rule['condition-tree']) ?? null,
      actions: (rule.actions || []).map(({ type, id, capability, args }) => ({ type, id, capability, args })),
    },
  }
}

function parseBlueprint(text) {
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    if (parsed?.format !== FORMAT || parsed.version !== VERSION || typeof parsed.rule !== 'object') return null
    return parsed.rule
  } catch {
    return null
  }
}

// copyRule stores rule as the one blueprint. With keepIds false, its device
// and group IDs are cleared first. Returns true if it also reached the system
// clipboard.
export async function copyRule(rule, { keepIds }) {
  const text = JSON.stringify(toBlueprint(keepIds ? rule : clearTargetIds(rule)), null, 2)
  try {
    localStorage.setItem(STORAGE_KEY, text)
  } catch {
    // Storage blocked: the system clipboard below is all there is.
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// readBlueprint returns the rule to paste, or null if there is none. A
// blueprint on the system clipboard wins (it may come from another
// Appliance); otherwise the last one copied here is used.
export async function readBlueprint() {
  try {
    const fromClipboard = parseBlueprint(await navigator.clipboard.readText())
    if (fromClipboard) return fromClipboard
  } catch {
    // No Clipboard API, or reading was denied.
  }
  try {
    return parseBlueprint(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

let draftSeq = 0

// setPendingDraft hands rule to RuleDetail as an unsaved draft. The returned
// token goes in the RuleNew route's query, so pasting again while already on
// RuleNew still reloads the editor.
export function setPendingDraft(rule, { idsCleared }) {
  draftSeq += 1
  pendingDraft.value = { token: String(draftSeq), rule: clone(rule), idsCleared }
  return pendingDraft.value.token
}

export function takePendingDraft(token) {
  const draft = pendingDraft.value
  if (!draft || draft.token !== token) return null
  pendingDraft.value = null
  return draft
}
