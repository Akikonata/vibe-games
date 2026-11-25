# Vibe Games · 纯 HTML5 休闲游戏合集

本项目已彻底剥离小红书小程序运行时依赖（零 `xhs.*`、零 `.xhsml`、零 `rpx`），以 **原生 HTML5 + CSS3 + ES Modules** 架构重构，可直接部署至 GitHub Pages、Cloudflare Pages、Netlify、Vercel 或任意静态服务器，同时兼容移动端触控与桌面端键鼠操作。

## 收录游戏

| 游戏 | 目录 | 核心玩法 |
| --- | --- | --- |
| **糖心蛇蛇 (Sweet Snake)** | `games/sweet-snake/` | 50 关可爱贪吃蛇大冒险、6 款技能蛇蛇伙伴、糖果小屋商店、动态蛇蛇花园、道具与星级体系、完整 BGM 与音效（支持触控滑动 + 键盘方向键/WASD + 鼠标拖动） |
| **甜点屋物语 (Patisserie Story)** | `games/patisserie-story/` | 焦糖古典欧风甜点屋经营 × RPG 视觉小说、11 道欧洲经典甜点、5 大独立小游戏引擎（红砖烤炉 / 物理堆叠 / 三轨节拍 / 三口铜锅 / 接盘收集）、S/A/B 分歧剧情与 7 段镜头移动式过场漫画、轻度胡闹厨房营业与装潢升级、食谱文化手账 |

## 目录结构

```text
vibe-games/
├── index.html                  # Vibe Games 首页入口大厅
├── styles/portal.css           # 大厅样式
├── shared/web-ui.js            # 公共 HTML5 基础工具（localStorage、Toast、弹窗、触觉反馈）
└── games/
    ├── sweet-snake/            # 《糖心蛇蛇》纯 HTML5 版本
    │   ├── index.html
    │   ├── styles/main.css
    │   ├── src/                # ES Modules 源码（engine, garden, levels, snakes, items, audio, app, view）
    │   └── assets/             # 图片、地图、音频资源
    └── patisserie-story/       # 《甜点屋物语》纯 HTML5 版本
        ├── index.html
        ├── styles/             # 清晰 px 单位模块化 CSS
        ├── src/                # ES Modules 源码（data/, engines/, utils/, pages/, main.js）
        └── assets/images/      # 141 份手绘 SVG 与实景立绘/场景资源
```

## GitHub Pages 发布

本站直接发布 `dev` 分支根目录，无需安装依赖或构建。根目录的 `.nojekyll` 用于跳过 Jekyll 处理。

1. 将本地提交推送到 GitHub：`git push -u origin dev`。
2. 在仓库 **Settings → Pages → Build and deployment** 中，选择 **Deploy from a branch**，分支选择 **dev**，目录选择 **/(root)**，点击 **Save**。
3. 等待 **Actions → pages build and deployment** 成功后访问：
   - 游戏大厅：https://akikonata.github.io/vibe-games/
   - 糖心蛇蛇：https://akikonata.github.io/vibe-games/games/sweet-snake/
   - 甜点屋物语：https://akikonata.github.io/vibe-games/games/patisserie-story/

后续推送到 `dev` 会自动更新网站。仅创建 GitHub 仓库不会发布网站，必须完成代码推送和 Pages 发布源设置。

## 本地运行

由于使用了原生 ES Modules（`<script type="module">`），请通过任意本地静态服务器打开（避免 `file://` CORS 限制）：

```bash
# 方式 1：Python 内置服务器
python3 -m http.server 8080

# 方式 2：Node npx serve
npx serve . -l 8080
```

然后在浏览器访问：
- 游戏大厅：`http://localhost:8080/`
- 糖心蛇蛇：`http://localhost:8080/games/sweet-snake/`
- 甜点屋物语：`http://localhost:8080/games/patisserie-story/`
