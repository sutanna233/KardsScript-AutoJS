#!/usr/bin/env python3
"""
KARDS Hand Position Calculator
计算1-9张手牌时每张牌的精确像素坐标（1280x720横屏）

Usage:
    python hand_positions.py                 # 输出所有1-9张牌的坐标
    python hand_positions.py --cards 4       # 输出4张牌的坐标
    python hand_positions.py --cards 4 --json # JSON格式输出
"""
import json
import sys

# === 配置 ===
# 手牌区域在 1280x720 横屏中的范围
# 从截图分析得出：手牌区域大约在 y=300~620，x=50~1230
# 手牌是扇形展开，有重叠

# 每张牌的实际像素尺寸（从截图测量）
CARD_WIDTH = 120    # 牌宽
CARD_HEIGHT = 170   # 牌高

# 手牌区域边界
HAND_LEFT = 80      # 最左边牌的左边缘
HAND_RIGHT = 1200   # 最右边牌的右边缘
HAND_CENTER_Y = 460 # 手牌中心Y坐标
HAND_TOP = HAND_CENTER_Y - CARD_HEIGHT // 2  # 290
HAND_BOTTOM = HAND_CENTER_Y + CARD_HEIGHT // 2  # 630

# 扇形展开参数
OVERLAP_X = 15      # 牌与牌之间的X重叠量（像素）
FAN_ANGLE = 3       # 每张牌的旋转角度（度）
FAN_CURVE_Y = 15    # 扇形Y方向弧度（像素）


def calculate_hand_positions(num_cards: int) -> list[dict]:
    """计算 num_cards 张手牌时每张牌的中心坐标和包围盒"""
    if num_cards <= 0:
        return []

    positions = []

    # 计算牌组总宽度
    # 每张牌宽度减去重叠部分
    card_spacing = CARD_WIDTH - OVERLAP_X
    total_width = card_spacing * (num_cards - 1) + CARD_WIDTH

    # 居中对齐
    start_x = (1280 - total_width) // 2
    if start_x < HAND_LEFT:
        start_x = HAND_LEFT

    for i in range(num_cards):
        # X坐标：均匀分布
        x_center = start_x + card_spacing * i + CARD_WIDTH // 2

        # Y坐标：扇形弧度（中间高，两边低）
        # 使用抛物线模拟扇形
        normalized_pos = (i - (num_cards - 1) / 2) / max(num_cards - 1, 1)
        y_offset = FAN_CURVE_Y * normalized_pos ** 2
        y_center = HAND_CENTER_Y + y_offset

        # 旋转角度
        rotation = FAN_ANGLE * normalized_pos

        # 包围盒
        x1 = int(x_center - CARD_WIDTH // 2)
        y1 = int(y_center - CARD_HEIGHT // 2)
        x2 = int(x_center + CARD_WIDTH // 2)
        y2 = int(y_center + CARD_HEIGHT // 2)

        positions.append({
            'index': i,
            'card_number': i + 1,
            'center': {'x': int(x_center), 'y': int(y_center)},
            'bbox': {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2},
            'width': CARD_WIDTH,
            'height': CARD_HEIGHT,
            'rotation_deg': round(rotation, 1),
            'normalized_center': {
                'x': round(x_center / 1280, 3),
                'y': round(y_center / 720, 3)
            }
        })

    return positions


def print_positions(num_cards: int):
    """打印指定数量手牌的位置"""
    positions = calculate_hand_positions(num_cards)
    print(f"\n=== {num_cards}张手牌位置 (1280x720) ===")
    for p in positions:
        print(f"  牌{p['card_number']}: 中心({p['center']['x']}, {p['center']['y']}) "
              f"包围盒[{p['bbox']['x1']},{p['bbox']['y1']},{p['bbox']['x2']},{p['bbox']['y2']}] "
              f"归一化({p['normalized_center']['x']}, {p['normalized_center']['y']})")


def main():
    if '--cards' in sys.argv:
        idx = sys.argv.index('--cards')
        if idx + 1 < len(sys.argv):
            n = int(sys.argv[idx + 1])
            if '--json' in sys.argv:
                print(json.dumps(calculate_hand_positions(n), ensure_ascii=False, indent=2))
            else:
                print_positions(n)
            return

    # 默认输出所有1-9张的情况
    for n in range(1, 10):
        print_positions(n)

    # 也输出JSON版本供代码使用
    all_data = {}
    for n in range(1, 10):
        all_data[str(n)] = calculate_hand_positions(n)

    with open('J:/dev/KardsScript/fixtures/ref/hand-positions-all.json', 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    print(f"\nJSON saved to hand-positions-all.json")


if __name__ == '__main__':
    main()
