@tool
extends Control

const VariableSync = preload("VariableSync.gd")
const ExportTrigger = preload("ExportTrigger.gd")

var _file_list: ItemList = null
var _sync_btn: Button = null
var _export_btn: Button = null
var _refresh_btn: Button = null
var _status_label: Label = null
var _variable_sync: VariableSync = null
var _export_trigger: ExportTrigger = null

# Path to the story directory relative to project root.
var story_dir: String = "res://story"


func _init() -> void:
	_variable_sync = VariableSync.new()
	_export_trigger = ExportTrigger.new()


func _enter_tree() -> void:
	setup_ui()


func setup_ui() -> void:
	custom_minimum_size = Vector2(260, 320)

	# ---- Root VBox ----
	var vbox := VBoxContainer.new()
	vbox.name = "PlotFlowDock" # brand-compat: scene/runtime node identity
	vbox.anchor_right = 1.0
	vbox.anchor_bottom = 1.0
	add_child(vbox)

	# ---- Title ----
	var title := Label.new()
	title.text = "Fablevia"
	title.theme_type_variation = "TitleLabel"
	vbox.add_child(title)

	# ---- Story files list ----
	_file_list = ItemList.new()
	_file_list.size_flags_vertical = SIZE_EXPAND_FILL
	_file_list.allow_reselect = false
	_file_list.allow_rmb_select = false
	vbox.add_child(_file_list)

	# ---- Action buttons ----
	var btn_grid := HBoxContainer.new()
	btn_grid.alignment = BoxContainer.ALIGNMENT_CENTER
	vbox.add_child(btn_grid)

	_refresh_btn = Button.new()
	_refresh_btn.text = "Refresh"
	_refresh_btn.connect("pressed", Callable(self, "_on_refresh"))
	btn_grid.add_child(_refresh_btn)

	_sync_btn = Button.new()
	_sync_btn.text = "Sync Variables"
	_sync_btn.connect("pressed", Callable(self, "_on_sync"))
	btn_grid.add_child(_sync_btn)

	_export_btn = Button.new()
	_export_btn.text = "Export"
	_export_btn.connect("pressed", Callable(self, "_on_export"))
	btn_grid.add_child(_export_btn)

	# ---- Status label ----
	_status_label = Label.new()
	_status_label.text = ""
	_status_label.autowrap_mode = TextServer.AUTOWORD_WRAP
	_status_label.max_lines_visible = 3
	vbox.add_child(_status_label)

	# Initial scan.
	refresh_file_list()


## Scan [code]story_dir[/code] for .mdstory files and populate the list.
func refresh_file_list() -> void:
	_file_list.clear()

	var dir := DirAccess.open(story_dir)
	if not dir:
		_status_label.text = "No story/ directory found."
		return

	dir.list_dir_begin()
	var file_name := dir.get_next()
	var count := 0
	while file_name != "":
		if not dir.current_is_dir() and file_name.ends_with(".mdstory"):
			_file_list.add_item(file_name)
			count += 1
		file_name = dir.get_next()
	dir.list_dir_end()

	if count == 0:
		_status_label.text = "No .mdstory files in story/."
	else:
		_status_label.text = "%d story file(s) found." % count


## Returns the currently selected filename, or an empty string.
func get_selected_story() -> String:
	var idx := _file_list.get_selected_items()
	if idx.size() == 0:
		_status_label.text = "No story file selected."
		return ""
	return _file_list.get_item_text(idx[0])


func _on_refresh() -> void:
	refresh_file_list()


func _on_sync() -> void:
	var story_name := get_selected_story()
	if story_name.is_empty():
		return

	var full_path := story_dir.path_join(story_name)
	var ok := _variable_sync.sync_to_story(full_path)
	_status_label.text = "Variables synced." if ok else "Sync failed."


func _on_export() -> void:
	var story_name := get_selected_story()
	if story_name.is_empty():
		return

	var full_path := story_dir.path_join(story_name)
	var ok := _export_trigger.export_story(full_path)
	_status_label.text = "Export triggered." if ok else "Export failed."


## Called programmatically from plugin.gd menu items.
func trigger_export() -> void:
	_on_export()


## Called programmatically from plugin.gd menu items.
func trigger_sync() -> void:
	_on_sync()
