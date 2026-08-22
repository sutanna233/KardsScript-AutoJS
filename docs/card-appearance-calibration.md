# 卡牌外观校准记录

## 字段边界

- `rarity` 表示卡牌数据稀有度：`COMMON`、`RARE`、`ELITE`、`SPECIAL`。
- `foil` 表示是否为镀金/闪金外观：`FOIL`、`NON_FOIL`。
- 两个字段互不推导；闪金不能改变稀有度，静态外观也不能单独证明闪金。

## 采样要求

需要同一卡牌、同一分辨率、同一 UI 状态下的完整卡牌截图：

1. 普通版一张，并标注真实 rarity。
2. 闪金版一张，并标注真实 rarity 和 `FOIL`。
3. 至少再提供一张不同 rarity 的普通版，用来排除“卡图/阵营颜色”误报。

只提供卡牌局部、不同卡牌或不同缩放比例时，不写入生产模板。

## 探针

```powershell
node autojs/tools/card-appearance-probe.js <截图.png> <x1,y1,x2,y2> <标签>
```

探针输出 `goldRatio`、亮度方差和边缘密度，仅用于比较样本，不会自行输出分类。
只有普通/闪金成对样本在特征上稳定分离后，才将裁剪模板放入 `autojs/templates/cards/`，并在 `autojs/lib/config.js` 的 `templates.rarity*` 或 `templates.foil` 中启用。

## 当前状态

- 已实现独立字段和模板匹配接口。
- 已实现卡库稀有度值域标准化。
- 当前样本不足以安全生成生产阈值，运行时继续返回 `UNKNOWN`，避免误判。
