@tool
class_name PlotFlowVariableStore
extends RefCounted

## Stores and manages runtime variables for the story engine.
##
## Variables are set by the game engine before story evaluation and can
## be read/modified during story traversal.  This class is the single
## source of truth for all variables during a play session.


var _vars: Dictionary = {}


## Set a variable.
func set_var(name: String, value: Variant) -> void:
	_vars[name] = value


## Get a variable.  Returns [code]default_value[/code] if not set.
func get_var(name: String, default_value: Variant = null) -> Variant:
	return _vars.get(name, default_value)


## Returns true if the variable exists.
func has_var(name: String) -> bool:
	return _vars.has(name)


## Remove a variable.
func erase_var(name: String) -> void:
	_vars.erase(name)


## Bulk-import variables from a Dictionary.
func import_from_dict(dict: Dictionary) -> void:
	for key in dict:
		_vars[key] = dict[key]


## Export all variables as a plain Dictionary.
func export_to_dict() -> Dictionary:
	return _vars.duplicate()


## Clear all variables.
func clear() -> void:
	_vars.clear()


## Returns the total number of stored variables.
func size() -> int:
	return _vars.size()
