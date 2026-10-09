"""Compara caracteres de instruções candidatas; não mede uso real de tokens."""

from __future__ import annotations

import re
import sys
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OLD = {
    "edicao-mecanica": ("concise-output", "token-budget-router", "surgical-code-search", "secure-by-default"),
    "concluir-interface-parcial": ("concise-output", "token-budget-router", "surgical-code-search", "secure-by-default"),
    "concluir-cadastro-parcial": ("concise-output", "token-budget-router", "surgical-code-search", "secure-by-default", "sql-injection-prevention"),
    "revisao-pr": ("concise-output", "token-budget-router", "surgical-code-search", "code-review"),
    "sql-dinamico": ("concise-output", "token-budget-router", "surgical-code-search", "secure-by-default", "sql-injection-prevention"),
    "atualizacao-dependencia": ("concise-output", "token-budget-router", "surgical-code-search", "secure-by-default", "dependency-supply-chain"),
    "codigo-com-credencial": ("concise-output", "token-budget-router", "surgical-code-search", "secure-by-default", "secrets-hygiene"),
}
NEW = {
    "edicao-mecanica": (),
    "concluir-interface-parcial": ("finish-partial-work",),
    "concluir-cadastro-parcial": ("finish-partial-work", "secure-coding", "sql-injection-prevention"),
    "revisao-pr": ("code-review",),
    "sql-dinamico": ("secure-coding", "sql-injection-prevention"),
    "atualizacao-dependencia": ("dependency-supply-chain",),
    "codigo-com-credencial": ("secure-coding", "secrets-hygiene"),
}


def metadata(content: str) -> tuple[str, str]:
    parts = content.split("---", 2)
    if len(parts) != 3:
        raise ValueError("SKILL.md sem frontmatter")
    fields = dict(re.findall(r"^(name|description):\s*(.+)$", parts[1], re.M))
    return fields["name"].strip(), fields["description"].strip()


def old_skills(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    with zipfile.ZipFile(path) as archive:
        for name in archive.namelist():
            if name.endswith("/SKILL.md"):
                content = archive.read(name).decode("utf-8")
                result[metadata(content)[0]] = content
    return result


def new_skills() -> dict[str, str]:
    result: dict[str, str] = {}
    for file in (ROOT / ".agents" / "skills").glob("*/SKILL.md"):
        content = file.read_text(encoding="utf-8")
        result[metadata(content)[0]] = content
    return result


def total(skills: dict[str, str], names: tuple[str, ...]) -> int:
    return sum(len(skills[name]) for name in names)


def main(path: Path) -> None:
    before, after = old_skills(path), new_skills()
    old_discovery = sum(len(name) + len(metadata(body)[1]) for name, body in before.items())
    new_discovery = sum(len(name) + len(metadata(body)[1]) for name, body in after.items())
    print(f"Descoberta: {old_discovery} -> {new_discovery} caracteres ({100 * (1 - new_discovery / old_discovery):.1f}% menos)")
    print("Cenario | Antigo | Novo | Reducao")
    for scenario, old_names in OLD.items():
        old_chars = total(before, old_names)
        new_chars = total(after, NEW[scenario]) + len((ROOT / "AGENTS.md").read_text(encoding="utf-8"))
        print(f"{scenario} | {old_chars} | {new_chars} | {100 * (1 - new_chars / old_chars):.1f}%")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("uso: python evals/measure_instructions.py <pacote-antigo.zip>")
    main(Path(sys.argv[1]))
