from pathlib import Path
import sys

from PIL import Image


def main() -> int:
    screenshot = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/home/ubuntu/screenshots/webdev-preview-root-1786781793114531249-4359.png")
    image = Image.open(screenshot).convert("RGB")
    board = image.crop((420, 145, 860, 590))
    pixels = list(board.get_flattened_data())

    white = sum(1 for red, green, blue in pixels if red >= 240 and green >= 240 and blue >= 240)
    yellow = sum(1 for red, green, blue in pixels if red >= 235 and 160 <= green <= 225 and blue <= 110)
    black = sum(1 for red, green, blue in pixels if red <= 60 and green <= 60 and blue <= 60)

    total = len(pixels)
    print(f"canvas_pixel_evidence: file={screenshot.name} crop=420,145,860,590 total={total} white={white} yellow={yellow} black={black}")

    if white < total * 0.60:
        raise SystemExit("Expected a predominantly white Canvas board crop")
    if yellow < 500:
        raise SystemExit("Expected at least 500 McDonald's-style yellow path pixels")
    if black < 500:
        raise SystemExit("Expected at least 500 black frame or number pixels")

    print("PASS: white board, yellow path, and black number/frame pixels are present.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
