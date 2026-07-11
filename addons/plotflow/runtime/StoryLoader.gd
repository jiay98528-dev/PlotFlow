@tool
class_name PlotFlowStoryLoader
extends RefCounted

## Loads a PlotFlow JSON export and builds a traversable node tree.
##
## Usage:
##   var loader := PlotFlowStoryLoader.new()
##   var nodes := loader.load_file("res://story/my_story.json")
##   var start := loader.start_node   # the entry-point node


## Dictionary of opaque fullId → PlotFlowStoryNode.
var nodes: Dictionary = {}
## Chapter metadata keyed by the exported chapter id.
var chapters: Dictionary = {}
## Variable declarations from the JSON export.
var variable_definitions: Dictionary = {}
## The entry-point opaque fullId (first node in the file, or the root/start node).
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
	chapters.clear()
	variable_definitions = data.get("variables", {}).duplicate(true)
	start_node_id = ""
	_node_ids.clear()
	_chapter_node_ids.clear()
	_warn_for_schema_version(data)

	var raw_chapters: Variant = data.get("chapters", [])
	if raw_chapters is Array and not raw_chapters.is_empty():
		for raw_chapter in raw_chapters:
			if typeof(raw_chapter) != TYPE_DICTIONARY:
				continue
			var chapter_id := str(raw_chapter.get("id", ""))
			chapters[chapter_id] = {
				"id": chapter_id,
				"title": str(raw_chapter.get("title", chapter_id)),
			}
			_load_nodes(raw_chapter.get("nodes", []), chapter_id)
	else:
		# PlotFlow 0.1 legacy exports used a flat top-level nodes array.
		_load_nodes(data.get("nodes", []), "")

	if start_node_id.is_empty() and nodes.size() > 0:
		start_node_id = nodes.keys()[0]

	return nodes.duplicate()


## Get a specific node by opaque fullId. A unique legacy local id is accepted
## for 0.1 compatibility, but ambiguous local ids fail closed.
func get_node(node_id: String) -> PlotFlowStoryNode:
	if nodes.has(node_id):
		return nodes[node_id]
	var candidates: Array = _node_ids.get(node_id, [])
	if candidates.size() == 1:
		return nodes.get(candidates[0], null)
	return null


## Traverse to the node reached by choosing [code]option_text[/code]
## from [code]current_node[/code].  Returns the target node, or null if
## the option is not found / invalid.
func choose(
	current_node: PlotFlowStoryNode,
	option_text: String,
	store: PlotFlowVariableStore = null,
) -> PlotFlowStoryNode:
	if current_node == null:
		return null
	var target := current_node.get_target_descriptor(option_text)
	if target.is_empty():
		return null

	var target_full_id := str(target.get("target_full_id", ""))
	if not target_full_id.is_empty():
		return _activate_node_chapter(nodes.get(target_full_id, null), store)

	var target_node_id := str(target.get("target_node_id", ""))
	var target_chapter_id := str(target.get("target_chapter_id", ""))
	if target_chapter_id.is_empty():
		target_chapter_id = current_node.chapter_id
	var chapter_index: Dictionary = _chapter_node_ids.get(target_chapter_id, {})
	if not target_node_id.is_empty() and chapter_index.has(target_node_id):
		return _activate_node_chapter(nodes.get(chapter_index[target_node_id], null), store)

	var legacy_target := str(target.get("legacy_target", ""))
	return _activate_node_chapter(
		get_node(legacy_target if not legacy_target.is_empty() else target_node_id),
		store,
	)


## Returns the total number of nodes loaded.
func node_count() -> int:
	return nodes.size()


## Create a scope-aware variable store initialized from this story.
func create_variable_store(current_chapter_id: String = "") -> PlotFlowVariableStore:
	var store := PlotFlowVariableStore.new()
	store.initialize_from_definitions(variable_definitions, chapters.keys())
	if current_chapter_id.is_empty() and start_node != null:
		current_chapter_id = start_node.chapter_id
	store.set_current_chapter(current_chapter_id)
	return store


var _node_ids: Dictionary = {}
var _chapter_node_ids: Dictionary = {}


func _load_nodes(raw_nodes: Variant, inherited_chapter_id: String) -> void:
	if not (raw_nodes is Array):
		return
	for raw in raw_nodes:
		if typeof(raw) != TYPE_DICTIONARY:
			continue
		var node := PlotFlowStoryNode.from_dict(raw, inherited_chapter_id)
		if node.full_id.is_empty():
			push_warning("PlotFlow StoryLoader: skipping node without id/fullId")
			continue
		if nodes.has(node.full_id):
			push_warning("PlotFlow StoryLoader: duplicate fullId '%s'; last node wins" % node.full_id)
		nodes[node.full_id] = node
		var candidates: Array = _node_ids.get(node.id, [])
		candidates.append(node.full_id)
		_node_ids[node.id] = candidates
		var chapter_index: Dictionary = _chapter_node_ids.get(node.chapter_id, {})
		chapter_index[node.id] = node.full_id
		_chapter_node_ids[node.chapter_id] = chapter_index
		if start_node_id.is_empty() and bool(node.metadata.get("is_root", false)):
			start_node_id = node.full_id


func _warn_for_schema_version(data: Dictionary) -> void:
	var version := _read_schema_version(data)
	if version == "0.1" or version == "0.2" or version.begins_with("0.1.") or version.begins_with("0.2."):
		return
	push_warning("PlotFlow StoryLoader: story version '%s' is newer or unknown; loading supported fields only" % version)


func _read_schema_version(data: Dictionary) -> String:
	var schema_uri := str(data.get("$schema", ""))
	if not schema_uri.is_empty():
		var marker := "/schema/"
		var marker_index := schema_uri.find(marker)
		if marker_index >= 0:
			var tail := schema_uri.substr(marker_index + marker.length())
			var segments := tail.split("/")
			if not segments.is_empty() and not str(segments[0]).is_empty():
				return str(segments[0])
		return schema_uri
	var meta: Dictionary = data.get("meta", {})
	return str(meta.get("plotflow", "0.1"))


func _activate_node_chapter(
	node: PlotFlowStoryNode,
	store: PlotFlowVariableStore,
) -> PlotFlowStoryNode:
	if node != null and store != null and store.current_chapter_id != node.chapter_id:
		store.set_current_chapter(node.chapter_id)
	return node
