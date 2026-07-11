@tool
class_name PlotFlowStoryNode
extends RefCounted

## Represents a single narrative node loaded from a PlotFlow JSON export.
##
## Each node has a unique id, a title, body text, and a list of options
## that lead to other nodes.  Options may carry conditions evaluated by
## [PlotFlowConditionEval].


## Chapter-local node identifier (matching the original .mdstory node id).
var id: String = ""
## Owning chapter id. This is metadata only and must not be used to derive full_id.
var chapter_id: String = ""
## Opaque, globally unique identifier emitted by PlotFlow.
var full_id: String = ""
## Human-readable title.
var title: String = ""
## Narrative description / body text (Markdown).
var description: String = ""
## Array of option dictionaries — each has keys:
##   "text"       : String — option label
##   "target"     : String — resolved target fullId (legacy convenience key)
##   "target_full_id" : String — opaque target fullId
##   "target_chapter_id" : String — explicit target chapter, when present
##   "target_node_id" : String — chapter-local target node id
##   "conditions" : Variant — 0.1 expression/AST or 0.2 operand AST
var options: Array[Dictionary] = []
## Arbitrary metadata stored in the node.
var metadata: Dictionary = {}


## Create a new node from a parsed JSON dictionary.
static func from_dict(data: Dictionary, inherited_chapter_id: String = "") -> PlotFlowStoryNode:
	var node := PlotFlowStoryNode.new()
	node.id = str(data.get("id", ""))
	node.chapter_id = _string_or_empty(data.get("chapterId", inherited_chapter_id))
	# fullId is deliberately opaque. Never reconstruct it from chapter/id delimiters.
	node.full_id = _string_or_empty(data.get("fullId", node.id))
	if node.full_id.is_empty():
		node.full_id = node.id
	node.title = str(data.get("title", ""))
	var raw_body: Variant = data.get("body", data.get("description", ""))
	if raw_body is Array:
		var paragraphs: PackedStringArray = []
		for paragraph in raw_body:
			paragraphs.append(str(paragraph))
		node.description = "\n\n".join(paragraphs)
	else:
		node.description = str(raw_body)
	node.metadata = data.get("metadata", {}).duplicate()
	node.metadata["is_root"] = bool(data.get(
		"isRoot",
		node.metadata.get("start", false) or node.metadata.get("type", "") == "start",
	))
	node.metadata["is_orphan"] = bool(data.get("isOrphan", false))
	node.metadata["is_dead_end"] = bool(data.get("isDeadEnd", false))

	var raw_options: Array = data.get("options", [])
	for opt in raw_options:
		if typeof(opt) != TYPE_DICTIONARY:
			continue
		var target_full_id := _string_or_empty(opt.get("targetFullId", opt.get("target", "")))
		var target_node_id := _string_or_empty(opt.get("targetNodeId", opt.get("target", "")))
		node.options.append({
			"text": str(opt.get("text", "")),
			"target": target_full_id if not target_full_id.is_empty() else target_node_id,
			"target_full_id": target_full_id,
			"target_chapter_id": _string_or_empty(opt.get("targetChapterId", "")),
			"target_node_id": target_node_id,
			"conditions": _duplicate_condition(opt.get("conditions")),
			"side_effects": opt.get("sideEffects", []).duplicate(true),
		})

	return node


## Get the node's body text.
func get_description() -> String:
	return description


## Return the list of available options, optionally filtered by condition evaluation.
func get_options(store: PlotFlowVariableStore = null) -> Array[Dictionary]:
	if store == null:
		return options.duplicate()

	var available: Array[Dictionary] = []
	for opt in options:
		var condition: Variant = opt.get("conditions")
		if condition == null or (condition is Array and condition.is_empty()):
			available.append(opt)
		elif PlotFlowConditionEval.evaluate_condition(condition, store):
			available.append(opt)
	return available


## Return the target node id for an option matching [code]option_text[/code].
## Returns an empty string if not found.
func get_target_for(option_text: String) -> String:
	for opt in options:
		if opt.get("text", "") == option_text:
			return str(opt.get("target_full_id", opt.get("target", "")))
	return ""


## Return all target fields for loader-side compatibility resolution.
func get_target_descriptor(option_text: String) -> Dictionary:
	for opt in options:
		if opt.get("text", "") == option_text:
			return {
				"target_full_id": str(opt.get("target_full_id", "")),
				"target_chapter_id": str(opt.get("target_chapter_id", "")),
				"target_node_id": str(opt.get("target_node_id", "")),
				"legacy_target": str(opt.get("target", "")),
			}
	return {}


static func _duplicate_condition(raw: Variant) -> Variant:
	if raw is Dictionary or raw is Array:
		return raw.duplicate(true)
	return raw


static func _string_or_empty(value: Variant) -> String:
	return "" if value == null else str(value)
