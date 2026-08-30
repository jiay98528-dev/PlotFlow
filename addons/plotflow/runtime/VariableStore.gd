@tool
class_name PlotFlowVariableStore
extends RefCounted

## Stores and manages runtime variables for the story engine.
##
## Variables are set by the game engine before story evaluation and can
## be read/modified during story traversal.  This class is the single
## source of truth for all variables during a play session.


var current_chapter_id: String = ""

var _global_vars: Dictionary = {}
var _chapter_vars: Dictionary = {}
var _definitions: Dictionary = {}
var _scopes: Dictionary = {}
var _chapter_owners: Dictionary = {}


## Set a variable using its declared scope. Undeclared variables retain the
## 0.1 behavior and are stored globally.
func set_var(name: String, value: Variant) -> void:
	if _scopes.get(name, "global") == "chapter":
		if not _can_access_chapter_var(name, current_chapter_id):
			_warn_unauthorized(name, current_chapter_id, "set")
			return
		set_chapter_var(name, value)
	else:
		set_global_var(name, value)


## Get a variable.  Returns [code]default_value[/code] if not set.
func get_var(name: String, default_value: Variant = null) -> Variant:
	if _scopes.get(name, "global") == "chapter":
		if not _can_access_chapter_var(name, current_chapter_id):
			_warn_unauthorized(name, current_chapter_id, "get")
			return default_value
		var chapter: Dictionary = _ensure_chapter(current_chapter_id)
		return chapter.get(name, default_value)
	var current: Dictionary = _chapter_vars.get(current_chapter_id, {})
	if current.has(name):
		return current[name]
	return _global_vars.get(name, default_value)


## Returns true if the variable exists.
func has_var(name: String) -> bool:
	if _scopes.get(name, "global") == "chapter":
		if not _can_access_chapter_var(name, current_chapter_id):
			return false
		return _ensure_chapter(current_chapter_id).has(name)
	return _global_vars.has(name) or _chapter_vars.get(current_chapter_id, {}).has(name)


## Remove a variable.
func erase_var(name: String) -> void:
	if _scopes.get(name, "global") == "chapter":
		var chapter: Dictionary = _ensure_chapter(current_chapter_id)
		chapter.erase(name)
	else:
		_global_vars.erase(name)


## Change the active chapter namespace. Chapter-scoped defaults are created lazily.
func set_current_chapter(chapter_id: String) -> void:
	current_chapter_id = chapter_id
	_ensure_chapter(chapter_id)


func set_global_var(name: String, value: Variant) -> void:
	if _scopes.get(name, "global") == "chapter":
		_warn_unauthorized(name, current_chapter_id, "write as global")
		return
	_global_vars[name] = value


func set_chapter_var(name: String, value: Variant, chapter_id: String = "") -> void:
	var resolved_chapter := chapter_id if not chapter_id.is_empty() else current_chapter_id
	if _definitions.has(name) and _scopes.get(name, "global") != "chapter":
		push_warning("Fablevia VariableStore: cannot write global variable '%s' into a chapter namespace" % name)
		return
	if _scopes.get(name, "global") == "chapter" and not _can_access_chapter_var(name, resolved_chapter):
		_warn_unauthorized(name, resolved_chapter, "set")
		return
	var chapter: Dictionary = _ensure_chapter(resolved_chapter)
	chapter[name] = value
	_chapter_vars[resolved_chapter] = chapter


## Initialize namespaces from exported variable definitions. This understands
## the 0.1/0.2 fields type/default/scope and ignores newer unknown fields.
func initialize_from_definitions(definitions: Dictionary, chapter_ids: Array = []) -> void:
	_definitions = definitions.duplicate(true)
	_global_vars.clear()
	_chapter_vars.clear()
	_scopes.clear()
	_chapter_owners.clear()
	for name in _definitions:
		var definition: Variant = _definitions[name]
		if not (definition is Dictionary):
			continue
		var scope := str(definition.get("scope", "global"))
		_scopes[name] = scope
		if scope == "chapter":
			_chapter_owners[name] = str(definition.get("chapter", ""))
			continue
		_global_vars[name] = _definition_default(definition)
	for chapter_id in chapter_ids:
		_ensure_chapter(str(chapter_id))
	if not current_chapter_id.is_empty():
		_ensure_chapter(current_chapter_id)


## Bulk-import variables from a Dictionary.
func import_from_dict(dict: Dictionary) -> void:
	for key in dict:
		_global_vars[key] = dict[key]


## Export all variables as a plain Dictionary.
func export_to_dict() -> Dictionary:
	var effective := _global_vars.duplicate(true)
	var chapter: Dictionary = _chapter_vars.get(current_chapter_id, {})
	for key in chapter:
		effective[key] = _duplicate_value(chapter[key])
	return effective


## Export namespaces without flattening chapter-scoped values.
func export_scoped_dict() -> Dictionary:
	return {
		"current_chapter_id": current_chapter_id,
		"global": _global_vars.duplicate(true),
		"chapters": _chapter_vars.duplicate(true),
	}


## Apply exported side effects while respecting variable ownership.
func apply_effects(effects: Array) -> void:
	for effect in effects:
		if effect is Dictionary:
			_apply_effect(effect)


## Clear all variables.
func clear() -> void:
	_global_vars.clear()
	_chapter_vars.clear()
	_definitions.clear()
	_scopes.clear()
	_chapter_owners.clear()
	current_chapter_id = ""


## Returns the total number of stored variables.
func size() -> int:
	return export_to_dict().size()


func _ensure_chapter(chapter_id: String) -> Dictionary:
	var chapter: Dictionary = _chapter_vars.get(chapter_id, {})
	for name in _definitions:
		if _scopes.get(name, "global") != "chapter" or chapter.has(name):
			continue
		if not _can_access_chapter_var(str(name), chapter_id):
			continue
		var definition: Variant = _definitions[name]
		if definition is Dictionary:
			chapter[name] = _definition_default(definition)
	_chapter_vars[chapter_id] = chapter
	return chapter


func _definition_default(definition: Dictionary) -> Variant:
	if definition.has("default"):
		return _duplicate_value(definition["default"])
	match str(definition.get("type", "string")):
		"int":
			return 0
		"float":
			return 0.0
		"bool":
			return false
		"enum":
			var values: Array = definition.get("values", [])
			return "" if values.is_empty() else _duplicate_value(values[0])
		"object":
			var result: Dictionary = {}
			var fields: Dictionary = definition.get("fields", {})
			for field_name in fields:
				if fields[field_name] is Dictionary:
					result[field_name] = _definition_default(fields[field_name])
			return result
		_:
			return ""


func _duplicate_value(value: Variant) -> Variant:
	if value is Dictionary or value is Array:
		return value.duplicate(true)
	return value


func _can_access_chapter_var(name: String, chapter_id: String) -> bool:
	var owner := str(_chapter_owners.get(name, ""))
	return owner.is_empty() or owner == chapter_id


func _warn_unauthorized(name: String, chapter_id: String, operation: String) -> void:
	push_warning(
		"Fablevia VariableStore: cannot %s chapter variable '%s' from chapter '%s' (owner: '%s')"
		% [operation, name, chapter_id, str(_chapter_owners.get(name, ""))]
	)


func _apply_effect(effect: Dictionary) -> void:
	var path := str(effect.get("variable", ""))
	if path.is_empty():
		return
	var parts := path.split(".")
	var root_name := str(parts[0])
	if _scopes.get(root_name, "global") == "chapter" and not _can_access_chapter_var(root_name, current_chapter_id):
		_warn_unauthorized(root_name, current_chapter_id, "apply effect to")
		return
	var current := get_var(root_name)
	if current == null:
		return
	var operation := str(effect.get("operation", "set"))
	var effect_value: Variant = effect.get("value")
	if parts.size() == 1:
		set_var(root_name, _apply_operation(current, operation, effect_value))
		return
	if not (current is Dictionary):
		return
	var container: Dictionary = current
	for index in range(1, parts.size() - 1):
		var key := str(parts[index])
		if not (container.get(key) is Dictionary):
			return
		container = container[key]
	var last_key := str(parts[parts.size() - 1])
	if container.has(last_key):
		container[last_key] = _apply_operation(container[last_key], operation, effect_value)


func _apply_operation(current: Variant, operation: String, value: Variant) -> Variant:
	match operation:
		"set":
			return value
		"add":
			return current + value
		"subtract":
			return current - value
		"append":
			return str(current) + str(value)
		_:
			push_warning("Fablevia VariableStore: unknown effect operation '%s'" % operation)
			return current
