@tool
extends RefCounted

## Reads variables from Godot project settings and injects them into the
## YAML frontmatter of a .mdstory file.
##
## Expected project settings keys (set via Project → Project Settings → PlotFlow):
##   plotflow/variables — a Dictionary of variable_name → default_value


const SETTINGS_VAR_KEY: String = "plotflow/variables"


## Read variables from project settings.
func read_project_variables() -> Dictionary:
	if not ProjectSettings.has_setting(SETTINGS_VAR_KEY):
		return {}

	var raw = ProjectSettings.get_setting(SETTINGS_VAR_KEY)
	if not typeof(raw) == TYPE_DICTIONARY:
		return {}

	# Convert all values to strings for YAML compatibility.
	var result: Dictionary = {}
	for key in raw:
		result[str(key)] = str(raw[key])
	return result


## Write the given dictionary into the YAML frontmatter of [code]file_path[/code].
## If the file already has a frontmatter block, its variables section is replaced.
## Returns true on success.
func sync_to_story(file_path: String) -> bool:
	var variables := read_project_variables()
	if variables.is_empty():
		push_warning("PlotFlow VariableSync: no variables found in project settings.")
		return false

	var file := FileAccess.open(file_path, FileAccess.READ)
	if not file:
		push_error("PlotFlow VariableSync: cannot read ", file_path)
		return false

	var content := file.get_as_text()
	file.close()

	var new_content := _inject_frontmatter(content, variables)
	if new_content == content:
		return true  # Nothing changed, still success.

	file = FileAccess.open(file_path, FileAccess.WRITE)
	if not file:
		push_error("PlotFlow VariableSync: cannot write ", file_path)
		return false

	file.store_string(new_content)
	file.close()
	return true


## Parse existing frontmatter, merge variables, return updated content.
func _inject_frontmatter(content: String, variables: Dictionary) -> String:
	var lines := content.split("\n")
	var frontmatter_start := -1
	var frontmatter_end := -1

	# Detect YAML frontmatter delimited by `---`.
	if lines.size() > 0 and lines[0].strip_edges() == "---":
		frontmatter_start = 0
		for i in range(1, lines.size()):
			if lines[i].strip_edges() == "---":
				frontmatter_end = i
				break

	# Build the variables YAML block.
	var var_lines: PackedStringArray
	var_lines.append("variables:")
	for key in variables:
		var_lines.append("  %s: \"%s\"" % [key, variables[key]])

	if frontmatter_start >= 0 and frontmatter_end > frontmatter_start:
		# Replace existing variables block inside frontmatter.
		var inside := PackedStringArray()
		var replaced := false
		var in_vars_block := false
		for i in range(frontmatter_start + 1, frontmatter_end):
			var line := lines[i]
			if line.strip_edges().begins_with("variables:"):
				inside.append(line)
				in_vars_block = true
				replaced = false
				continue
			if in_vars_block:
				# Check if the line is indented (still part of variables block).
				if line.begins_with(" ") or line.is_empty():
					continue  # Skip existing variable lines.
				in_vars_block = false

			inside.append(line)

		if not replaced:
			# Append variables block if not already present.
			for v_line in var_lines:
				inside.append(v_line)

		# Rebuild frontmatter.
		var new_lines := PackedStringArray()
		new_lines.append("---")
		for l in inside:
			new_lines.append(l)
		new_lines.append("---")
		# Append everything after frontmatter.
		for i in range(frontmatter_end + 1, lines.size()):
			new_lines.append(lines[i])
		return "\n".join(new_lines)
	else:
		# No frontmatter — prepend one.
		var new_lines := PackedStringArray()
		new_lines.append("---")
		new_lines.append("plotflow:")
		for v_line in var_lines:
			new_lines.append("  " + v_line)
		new_lines.append("---")
		for l in lines:
			new_lines.append(l)
		return "\n".join(new_lines)
