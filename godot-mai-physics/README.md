# 不知火舞 3D 乳摇物理引擎 Demo (Godot 4 + Blender)

基于 **Godot Engine 4.7 (Forward+ / Metal)** 与 **Blender 5.4** 构建的专业游戏引擎 3D 次级柔体物理演示工程。

## 技术栈亮点

1. **Blender 骨骼与柔体权重资产 (`tools/generate_mai_glb.py` → `assets/mai_shiranui.glb`)**
   - 完整人形骨骼 `Mai_Rig` + 专用柔体骨骼 `Breast.L` / `Breast.R`（胸壁根部权重平滑过渡到 `Chest`，峰顶与下缘权重趋近 `1.0`，杜绝撕裂与缝隙）
   - 高马尾 4 节物理骨链 (`Ponytail.0..3`)、腰带蝴蝶结双飘带 (`ObiTail.L/R.0..2`)、前后衣摆 (`ApronFront/Back.0..1`)
   - 内置 9 段烘焙骨骼动画：`Idle_KOF`、`Jump_Start`、`Jump_Air`、`Jump_Land`、`Run_Jog`、`Fan_Spin`、`Ryuuenbu`、`Victory_Cheer`、`Hip_Sway`
2. **Godot 4 `SkeletonModifier3D` 双侧 3-DOF 弹簧阻尼解算器 (`scripts/breast_spring_modifier.gd`)**
   - 240Hz 固定子步长半隐式欧拉积分
   - 线性惯性 (`-a`) + 旋转离心力 (`-ω×(ω×r)`) + 切向惯性 (`-α×r`) + 姿态随动重力下垂
   - 各向异性刚度 + 胸壁防穿透反弹 + 乳沟内侧防穿模互推 + 体积恒定挤压拉伸 (`sx * sy * sz ≈ 1`)
3. **Verlet 链条修改器 (`scripts/verlet_chain_modifier.gd`)**
   - 实时驱动高马尾、腰带飘带与衣摆随跳跃和转身飘动

## 操作指南

- **`Space`**：跳跃 / 二段旋跳（落地触发强惯性弹跳）
- **`WASD` / 方向键**：自由移动与急停惯性测试
- **`1` ~ `6`**：切换展示动作（KOF待机 / 轻跑急停 / 花蝶扇旋舞 / 龙炎舞 / 胜利连跳 / 魅惑摇摆）
- **`P` 或 鼠标左键点击胸部**：直接施加测试拨动冲量
- **`D`**：开关 3D 骨骼弹簧与速度向量 Debug 视图
- **鼠标拖拽 / 滚轮**：360° 轨道旋转与缩放，顶部支持一键切换 `全身 / 上半身 / 侧面 / 特写` 与 `1.0x / 0.5x / 0.25x` 慢动作

## 运行方式

```bash
# 直接运行 Demo
godot --path /Users/panzheng/Documents/vibe-games/godot-mai-physics

# 用 Godot 编辑器打开工程
godot -e --path /Users/panzheng/Documents/vibe-games/godot-mai-physics
```
