@tool
class_name PlotFlowStoryNode
extends RefCounted

## Represents a single narrative node loaded from a PlotFlow JSON export.
##
## Each node has a unique id, a title, body text, and a list of options
## that lead to other nodes.  Options may carry conditions evaluated by
## [PlotFlowConditionEval].


## Unique node identifier (matching the original .mdstory node id).
var id: String = ""
## Human-readable title.
var title: String = ""
## Narrative description / body text (Markdown).
var description: String = ""
## Array of option dictionaries — each has keys:
##   "text"       : String — option label
##   "target"     : String — target node id
##   "conditions" : Array[String] — optional condition strings
var options: Array[Dictionary] = []
## Arbitrary metadata stored in the node.
var metadata: Dictionary = {}


## Create a new node from a parsed JSON dictionary.
static func from_dict(data: Dictionary) -> PlotFlowStoryNode:
	var node := PlotFlowStoryNode.new()
	node.id = str(data.get("id", ""))
	node.title = str(data.get("title", ""))
	node.description = str(data.get("description", ""))
	node.metadata = data.get("metadata", {}).duplicate()

	var raw_options: Array = data.get("options", [])
	for opt in raw_options:
		if typeof(opt) != TYPE_DICTIONARY:
			continue
		node.options.append({
			"text": str(opt.get("text", "")),
			"target": str(opt.get("target", "")),
			"conditions": _normalize_conditions(opt.get("conditions", []))
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
		var conds: Array[String] = opt.get("conditions", [])
		if conds.is_empty():
			available.append(opt)
		elif PlotFlowConditionEval.evaluate_many(conds, store):
			available.append(opt)
	return available


## Return the target node id for an option matching [code]option_text[/code].
## Returns an empty string if not found.
func get_target_for(option_text: String) -> String:
	for opt in options:
		if opt.get("text", "") == option_text:
			return opt.get("target", "")
	return ""


static func _normalize_conditions(raw: Variant) -> Array[String]:
	if raw is Array:
		return raw.map(func(x): return str(x))
	return []
