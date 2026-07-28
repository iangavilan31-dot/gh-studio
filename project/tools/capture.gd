extends Node
## Autoload name: Capture. Captures a real rendered frame to PNG, then quits.
## godot --path project --resolution 1920x1080 -- --capture=res://captures/x.png --frames=90
## Do NOT pass --headless. Headless uses the dummy rasterizer and writes black.

var _target: String = ""
var _frames: int = 90
var _armed: bool = false

func _ready() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--capture="):
			_target = arg.split("=", true, 1)[1]
		elif arg.begins_with("--frames="):
			_frames = int(arg.split("=", true, 1)[1])
	if _target.is_empty():
		set_process(false)
		return
	_armed = true
	print("[capture] armed -> %s after %d frames" % [_target, _frames])

func _process(_delta: float) -> void:
	if not _armed:
		return
	_frames -= 1
	if _frames > 0:
		return
	_armed = false
	set_process(false)
	await RenderingServer.frame_post_draw
	var img: Image = get_viewport().get_texture().get_image()
	if img == null:
		push_error("[capture] viewport image was null")
		get_tree().quit(1)
		return
	var dir: String = _target.get_base_dir()
	if not dir.is_empty():
		var abs_dir: String = ProjectSettings.globalize_path(dir)
		if not DirAccess.dir_exists_absolute(abs_dir):
			DirAccess.make_dir_recursive_absolute(abs_dir)
	var err: int = img.save_png(_target)
	if err != OK:
		push_error("[capture] save_png failed: %d" % err)
		get_tree().quit(1)
		return
	print("[capture] wrote %s (%dx%d)" % [ProjectSettings.globalize_path(_target), img.get_width(), img.get_height()])
	get_tree().quit(0)
