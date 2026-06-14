@tool
class_name PlotFlowStoryLoader
extends RefCounted

## Loads a PlotFlow JSON export and builds a traversable node tree.
##
## Usage:
##   var loader := PlotFlowStoryLoader.new()
##   var nodes := loader.load_file("res://story/my_story.json")
##   var start := loader.start_node   # the entry-point node


## Dictionary of node_id → PlotFlowStoryNode.
var nodes: Dictionary = {}
## The entry-point node id (first node in the file, or the one tagged "start").
var start_node_id: String = ""
## The entry-point node, for convenience.
var start_node: PlotFlowStoryNode:
	get:
		if start_node_id.is_empty():
			return null
		return nodes.get(start_node_id, null)


## Load a PlotFlow JSON file.  Returns the node Dictionary on success, or null.
func load_file(json_path: String) -> Dictionary:
	var file := FileAccess.open(json_path, FileAccess.READ)
	if not file:
		push_error("PlotFlow StoryLoader: cannot open ", json_path)
		return {}

	var text := file.get_as_text()
	file.close()

	var json := JSON.new()
	var err := json.parse(text)
	if err != OK:
		push_error("PlotFlow StoryLoader: JSON parse error: ", json.get_error_message())
		return {}

	var data := json.data
	if typeof(data) != TYPE_DICTIONARY:
		push_error("PlotFlow StoryLoader: root is not a dictionary.")
		return {}

	return _load_from_dict(data)


## Load from a pre-parsed Dictionary (matches the PlotFlow JSON Schema).
func load_from_dict(data: Dictionary) -> Dictionary:
	return _load_from_dict(data)


func _load_from_dict(data: Dictionary) -> Dictionary:
	nodes.clear()
	start_node_id = ""

	var raw_nodes: Array = data.get("nodes", [])
	for raw in raw_nodes:
		if typeof(raw) != TYPE_DICTIONARY:
			continue
		var node := PlotFlowStoryNode.from_dict(raw)
		nodes[node.id] = node

	# Determine start node: first node tagged as "start", or simply the first.
	for raw in raw_nodes:
		if typeof(raw) != TYPE_DICTIONARY:
			continue
		var meta = raw.get("metadata", {})
		if meta.get("start", false) or meta.get("type", "") == "start":
			start_node_id = str(raw.get("id", ""))
			break

	if start_node_id.is_empty() and nodes.size() > 0:
		start_node_id = nodes.keys()[0]

	return nodes.duplicate()


## Get a specific node by id.
func get_node(node_id: String) -> PlotFlowStoryNode:
	return nodes.get(node_id, null)


## Traverse to the node reached by choosing [code]option_text[/code]
## from [code]current_node[/code].  Returns the target node, or null if
## the option is not found / invalid.
func choose(current_node: PlotFlowStoryNode, option_text: String) -> PlotFlowStoryNode:
	if current_node == null:
		return null
	var target_id := current_node.get_target_for(option_text)
	if target_id.is_empty():
		return null
	return nodes.get(target_id, null)


## Returns the total number of nodes loaded.
func node_count() -> int:
	return nodes.size()
