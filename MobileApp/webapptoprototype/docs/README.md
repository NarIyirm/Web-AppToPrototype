# Web-AppToPrototype 开发文档入口

更新：2026-10-20（Australia/Sydney）。业务alpha源码与桌面集成已实施，当前SDK57（用户要求由58降级）；两端原生编译/安装及最终验收待用户。最新结果见PROGRESS第7–8节，实际操作见[用户验证步骤](USER-VERIFICATION.md)。

| 阅读顺序 | 文档 | 用途 |
|---|---|---|
| 1 | [HANDOFF](HANDOFF.md) | 当前状态、用户约束、检查和续接范围 |
| 2 | [PROGRESS](PROGRESS.md) | 第7–8节实际实现、SDK57迁移与证据；前文历史保留 |
| 3 | [APP-PLAN](APP-PLAN.md) | 产品目标、双平台能力、完整流程、架构、预算与阶段 |
| 4 | [ROADMAP](ROADMAP.md) | 可执行任务、依赖、交付物与退出门槛 |
| 5 | [PROTOCOL-DRAFT](PROTOCOL-DRAFT.md) | 当前alpha.1原始包、桌面接收、配对/TLS和恢复边界 |
| 6 | [DESIGN](DESIGN.md) | 页面与路由、操作状态、触控/安全区和原生差异 |
| 7 | [ACCEPTANCE](ACCEPTANCE.md) | 双平台/四传输组合、来源保真和真实验收矩阵 |

开发前还必须读取项目根[AGENTS.md](../AGENTS.md)、[package.json](../package.json)和[app.json](../app.json)。技术API以Expo SDK58文档及实际安装版本为准，不把旧方案的候选版本当作当前依赖。

已有桌面项目位于同机`E:\WebToPrototype`，移动项目位于`E:\WebToPrototype\MobileApp\webapptoprototype`，二者为独立Git仓库。移动文档应在单独克隆移动仓库时仍可理解；桌面集成需要桌面源码和对应工作区权限，不建立越出仓库的相对运行依赖。

本计划明确Android、iOS同等优先；已知测试设备iPhone16Pro，系统版本未知，Android真机待确认。网页结构采集与原生画面推断分开交付，不能把截图导入通过当作实时跨App采集已通过。
