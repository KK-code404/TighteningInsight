"""CHANGE [2026-09-09 15:18 +08:00] [WH400]: 生成不含真实生产标识的 xlsx 样例，便于离线验收导入流程。"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 支持直接运行脚本时从项目根目录解析后端模块。
sys.path.insert(0, str(ROOT))

from backend.services import demo_frame


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 固定样例输出位置和列结构，使 README 与验收步骤保持稳定。
def main() -> None:
    output = ROOT / "sample_data" / "拧紧数据明细_脱敏样例.xlsx"
    output.parent.mkdir(parents=True, exist_ok=True)
    demo_frame(days=45, per_day=6).to_excel(output, index=False, engine="openpyxl")
    print(output)


if __name__ == "__main__":
    main()
