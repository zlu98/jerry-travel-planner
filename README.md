# 旅行攻略工具

用 AI 辅助开发的可编辑旅行规划网页。内置巴黎、新加坡、马尔代夫三个国外示例。

规划在浏览器中用本地规则计算，**不调用大模型，不需要 API Key**。地图使用 Leaflet 与 OpenStreetMap。macOS 26+ 可使用本机中文听写，其他环境使用浏览器 Web Speech API。

## 启动

安装 Node.js 18 或更新版本。解压后，在此目录打开终端：

```sh
node server.mjs
```

用 Chrome 打开终端显示的 `http://127.0.0.1:8024`。不需要 npm install。服务器默认只接受本机连接。

端口被占用时：

```sh
node server.mjs 8025
```

也可将 `public/` 部署到支持 HTTPS 的静态网站。语音通常需要 HTTPS 或 localhost 安全环境。

## 怎样使用

1. 在左侧选择或输入目的地、天数、人数、预算和节奏。
2. 点击生成，查看每天的景点安排和地图。
3. 添加或移除内置景点，调整先后顺序、把景点移到另一天。
4. 假设某天下雨，重新分配室内和户外活动。
5. 保存到当前浏览器，恢复存档，或导出含来源链接的 Markdown 行程单。

### 三种操作入口

- 选项：表单使用可手输的下拉候选，底部操作菜单提供生成、增删、换天、保存、恢复和导出等操作。
- 文字：在底部输入一条明确命令，点击执行或按回车。
- 语音：点击语音，允许本网站使用麦克风，说同样的命令。识别完成后自动执行，可撤销修改。

例句：

```text
切换目的地巴黎
生成行程
玩三天
两个人
预算改成8000
节奏轻松
日期2026年12月12日
酒店在市中心附近
预留6000
添加奥赛博物馆
把卢浮宫移到第二天
删除凯旋门
上移卢浮宫
查看第二天
第二天下雨
取消第二天下雨
转机8小时
入境条件已确认
保存行程
恢复行程
导出行程
撤销
```

每次说一条命令。酒店区域只作备忘。新加坡的转机时长、入境确认也只作备忘，不据此判断航班衔接可行性。命令解析使用明确语法，不能理解任意自然语言。未识别的命令会显示错误，不自动猜测操作。

## 语音兼容性与隐私

### macOS 本机听写

本机启动时，服务器会尝试用系统 Swift 编译器构建 `voice-macos.swift`，检查中文 SpeechTranscriber 模型是否可用。需要 macOS 26+、支持的设备、系统中文听写模型，以及 Xcode Command Line Tools。条件具备时，“语音”按钮自动使用本机听写，声音只发送到 `127.0.0.1` 上的本机服务，处理后删除临时音频。不会发给外部识别平台。

如果尚未准备好系统语言模型，可在本机主动运行以下命令，由系统从苹果下载模型，再重新启动服务器：

```sh
swiftc voice-macos.swift -o /tmp/jerry-travel-voice
/tmp/jerry-travel-voice --install
node server.mjs
```

点击语音后说一条命令，说完停顿约1秒自动结束，也可点击停止。最长约25秒。浏览器和系统都需要允许麦克风。本机能力检测失败时不会声称已启用，而是使用下面的浏览器方案。

### 浏览器方案

浏览器需提供 `SpeechRecognition` 或 `webkitSpeechRecognition`。不同 Chrome 版本、系统、区域和网络环境表现可能不同。可能需要麦克风权限和浏览器厂商在线识别服务。**浏览器方案不保证离线语音识别，不提供跨平台在线识别服务。macOS 本机方案见上，临时音频在处理后删除。**

如果显示“network”或在线服务连接失败，可以先用文字/下拉操作，或使用操作系统听写把文字输入命令框。文字转命令的测试不等同于真实麦克风识别验收。本项目在 macOS 本机方案上已完成真实麦克风测试：口令“预算改成八千”识别为“预算改成8000”，并更新预算。这个结果不保证其他设备或网络下表现相同。

行程保存到当前浏览器的 localStorage，含自行填写的日期和住宿区域，不会自动上传。请在自己的设备使用保存功能。地图瓦片请求会把请求的地图区域和网络地址发送给 OpenStreetMap。语音可能由浏览器厂商在线处理。没有广告、分析脚本、账号登录或付费功能。

## 规划和费用的边界

- 当前只内置三个目的地。扩展地点可修改 `public/data.js`。
- 景点坐标是中心附近的展示点，不作为精确入口或导航坐标。
- 规则先按相邻位置排序，再结合天数、节奏、停留时长和雨天假设分配。**不保证全局最短路线。**
- 地图虚线表示地点先后顺序，不是实际道路路线。时间按照直线距离乘以示意系数估算步行，未查询真实道路或公共交通。
- 日期不会自动检查闭馆日、节日、预约和实际天气。景点卡片附官方参考链接，出发前需要自己核实。
- 马尔代夫水屋、浮潜、海豚巡游等是活动模板，没有确认的地点不画坐标，跨岛接送及活动时段由酒店或运营方确认，野生动物出现不作保证。
- 费用是人民币演示预算占位，不是实时票价、酒店报价或汇率。人数按每两人一间房估算，住宿夜数按天数减一计算。国际机票、保险、购物和未填入的跨岛接送不在基础估算中，可以用“额外预留”补入。
- 预算不足只提示超支，不擅自删除已选景点。调整预算不会打乱手动安排。
- 没有连接预订、支付、航班或签证服务。

## 自检

```sh
node --test tests/*.test.mjs
node --check public/app.js
node --check public/core.js
node --check server.mjs
```

测试覆盖三地分配完整性、增删换天、文字/语音转写后的命令一致性、非法参数和损坏存档、预算计算、跨海边界和导出来源。真实地图网络、麦克风识别与设备界面需另外实测。

## 文件

```text
public/index.html       界面
public/style.css        样式
public/app.js           界面事件、地图、保存、导出、语音
public/local-voice.js   本机麦克风采集和 WAV 编码
public/pcm-worklet.js   音频采集处理器
public/core.js          规划、校验、命令解析和估算
public/data.js          可扩展的景点数据与官方链接
public/vendor/          Leaflet 1.9.4 与许可
server.mjs              仅本机监听的零依赖静态服务器
voice-macos.swift       可选 macOS 本机听写
tests/core.test.mjs     核心测试
```

## 开源与来源

代码采用 MIT 许可证，见 LICENSE。Leaflet 1.9.4 采用 BSD 2-Clause 许可证，原始许可保留在 `public/vendor/LEAFLET-LICENSE`。地图使用时保留 Leaflet / OpenStreetMap 的可见署名，遵守 [OpenStreetMap 瓦片使用政策](https://operations.osmfoundation.org/policies/tiles/)，不要批量下载瓦片或离线预取。

地点官网参考链接位于 `public/data.js`。景点说明、费用和时长由本项目整理，未复制旅游平台攻略。公开资料核对日期：2026-10-21。

技术参考：[Leaflet](https://leafletjs.com/examples/quick-start/)、[Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)、[星耀樟宜交通指引](https://www.jewelchangiairport.com/en/getting-to-jewel.html)、[樟宜机场转机访问说明](https://nowboarding.changiairport.com/discover-changi/tips-to-visit-jewel-changi-airport.html)、[马尔代夫旅游局](https://visitmaldives.com/)。
