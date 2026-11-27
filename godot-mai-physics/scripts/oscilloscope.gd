class_name PhysicsOscilloscope
extends Control

## 实时双侧乳摇位移示波器 (Real-Time Left/Right Y-Displacement Waveform)
## 红线 = 左胸 Y 位移，金线 = 右胸 Y 位移

const MAX_SAMPLES: int = 160
var _left_samples: PackedFloat32Array = PackedFloat32Array()
var _right_samples: PackedFloat32Array = PackedFloat32Array()


func _ready() -> void:
	custom_minimum_size = Vector2(260, 74)
	_left_samples.resize(MAX_SAMPLES)
	_right_samples.resize(MAX_SAMPLES)


func push_sample(left_y: float, right_y: float) -> void:
	for i in range(MAX_SAMPLES - 1):
		_left_samples[i] = _left_samples[i + 1]
		_right_samples[i] = _right_samples[i + 1]
	_left_samples[MAX_SAMPLES - 1] = left_y
	_right_samples[MAX_SAMPLES - 1] = right_y
	queue_redraw()


func _draw() -> void:
	var w := size.x
	var h := size.y
	var mid_y := h * 0.5

	# 背景框
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.06, 0.04, 0.07, 0.88), true)
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.86, 0.25, 0.30, 0.45), false, 1.2)

	# 中线与参考虚线
	draw_line(Vector2(0, mid_y), Vector2(w, mid_y), Color(1.0, 1.0, 1.0, 0.16), 1.0)
	draw_line(Vector2(0, h * 0.22), Vector2(w, h * 0.22), Color(1.0, 1.0, 1.0, 0.07), 1.0)
	draw_line(Vector2(0, h * 0.78), Vector2(w, h * 0.78), Color(1.0, 1.0, 1.0, 0.07), 1.0)

	var scale_y := (h * 0.44) / 0.065
	var pts_l := PackedVector2Array()
	var pts_r := PackedVector2Array()
	pts_l.resize(MAX_SAMPLES)
	pts_r.resize(MAX_SAMPLES)

	for i in range(MAX_SAMPLES):
		var x := (float(i) / float(MAX_SAMPLES - 1)) * w
		pts_l[i] = Vector2(x, clampf(mid_y - _left_samples[i] * scale_y, 3.0, h - 3.0))
		pts_r[i] = Vector2(x, clampf(mid_y - _right_samples[i] * scale_y, 3.0, h - 3.0))

	draw_polyline(pts_l, Color(0.98, 0.24, 0.34, 0.95), 2.0, true)
	draw_polyline(pts_r, Color(0.98, 0.78, 0.28, 0.90), 1.6, true)
