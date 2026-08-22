# 决策树 DSL

决策树是受约束的 JSON，不执行任意 JavaScript 或网络代码。

## 节点

- `priority`：从前到后选择第一条有动作的分支。
- `sequence`：组合多个子动作。
- `condition`：`whenAll` 所有条件成立时执行 `then`。
- `action`：`PLAY_CARD`、`OPERATE_UNIT`、`MOVE_TO_FRONTLINE`、`ATTACK` 或 `END_TURN`。

## 目标安全语义

除 `END_TURN` 外的动作必须设置 `legalOnly: true`。运行时在选择牌/单位后调用视觉网关生成 `legalTargets`。解释器永远不创建目标坐标、也不会点击不属于该集合的对象。

## 条件字段

`scene`、`credits`、`handCount`、`hasPlayableCard`、`hasOperableUnit`、`hasLegalTarget`、`canLethal`、`enemyUnitCount`、`playerUnitCount`、`frontlineControlled`、`confidence`。

## 排序器

`USER_PRIORITY_DESC`、`DEPLOYMENT_COST_DESC`、`DEPLOYMENT_COST_ASC`、`OPERATION_COST_ASC`、`ATTACK_DESC`、`DEFENSE_ASC`、`THREAT_DESC`、`KILLABLE_FIRST`、`FAVORABLE_TRADE_FIRST`、`ENEMY_HQ_FIRST`、`RANDOM_TIE_BREAK`。
