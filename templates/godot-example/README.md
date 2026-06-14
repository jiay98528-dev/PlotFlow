# Godot Runtime Loader Example

This sample shows the shape expected by the future Godot integration:

- `story.mdstory` is the PlotFlow source file.
- `scripts/story_player.gd` demonstrates the runtime-side loading boundary.
- Export the story as JSON from PlotFlow, then point the runtime loader at the exported JSON.

The example is intentionally small and offline-first. It does not require cloud services or a database.
