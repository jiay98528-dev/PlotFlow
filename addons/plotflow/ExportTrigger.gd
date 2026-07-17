@tool
extends RefCounted

## Calls the Fablevia CLI compatibility command to export a .mdstory file to JSON.
##
## The CLI executable is assumed to be discoverable via PATH.
## Override the path by setting the project setting:
##   plotflow/cli_path

const DEFAULT_CLI: String = "plotflow-cli"
const SETTINGS_CLI_PATH: String = "plotflow/cli_path"


## Export [code]mdstory_path[/code] to JSON.
## The output file will be placed next to the source with a .json extension.
## Returns true if the CLI exited successfully.
func export_story(mdstory_path: String) -> bool:
	var cli := _get_cli_path()
	if cli.is_empty():
		cli = DEFAULT_CLI

	var abs_path := ProjectSettings.globalize_path(mdstory_path)
	if abs_path.is_empty():
		abs_path = mdstory_path

	var output_path := abs_path.get_basename() + ".json"
	var args := PackedStringArray([
		"export",
		"--input", abs_path,
		"--output", output_path,
		"--format", "json"
	])

	var output := []
	var exit_code := OS.execute(cli, args, output, true)

	if exit_code != 0:
		push_error("Fablevia ExportTrigger: CLI exited with code %d. Output:\n%s" % [exit_code, "\n".join(output)])
		return false

	print("Fablevia ExportTrigger: exported to ", output_path)
	return true


func _get_cli_path() -> String:
	if ProjectSettings.has_setting(SETTINGS_CLI_PATH):
		return ProjectSettings.get_setting(SETTINGS_CLI_PATH)
	return ""
