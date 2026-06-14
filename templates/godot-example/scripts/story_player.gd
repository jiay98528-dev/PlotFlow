extends Node

@export_file("*.json") var story_json_path: String

var story_data: Dictionary = {}

func _ready() -> void:
    if story_json_path.is_empty():
        push_warning("No PlotFlow JSON file configured.")
        return
    load_story(story_json_path)

func load_story(path: String) -> void:
    var text := FileAccess.get_file_as_string(path)
    if text.is_empty():
        push_error("Failed to read PlotFlow JSON: %s" % path)
        return
    var parsed := JSON.parse_string(text)
    if typeof(parsed) != TYPE_DICTIONARY:
        push_error("PlotFlow JSON root must be an object.")
        return
    story_data = parsed
    print("Loaded PlotFlow story: %s" % story_data.get("meta", {}).get("title", "Untitled"))
