@tool
extends EditorPlugin

const PlotFlowDock = preload("PlotFlowDock.gd") # brand-compat: stable plugin script/class path

var dock: Control = null


func _enter_tree() -> void:
	dock = PlotFlowDock.new()
	add_control_to_dock(DOCK_SLOT_RIGHT_UL, dock)
	add_tool_menu_item("Fablevia — Export Story", _on_export_menu_clicked)
	add_tool_menu_item("Fablevia — Sync Variables", _on_sync_menu_clicked)
	print("Fablevia plugin loaded.")


func _exit_tree() -> void:
	if dock:
		remove_control_from_docks(dock)
		dock.queue_free()
		dock = null

	remove_tool_menu_item("Fablevia — Export Story")
	remove_tool_menu_item("Fablevia — Sync Variables")
	print("Fablevia plugin unloaded.")


func _on_export_menu_clicked(ud: Variant = null) -> void:
	if dock and dock.has_method("trigger_export"):
		dock.trigger_export()


func _on_sync_menu_clicked(ud: Variant = null) -> void:
	if dock and dock.has_method("trigger_sync"):
		dock.trigger_sync()
