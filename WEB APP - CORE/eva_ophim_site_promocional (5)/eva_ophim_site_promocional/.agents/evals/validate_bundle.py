"""Validação estrutural pequena, sem dependências externas nem mutações."""

from __future__ import annotations

import re
import sys
import tomllib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / ".agents" / "skills"
AGENTS = ROOT / ".codex" / "agents"
NAME = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LINK = re.compile(r"\]\((references/[^)#]+)(?:#[^)]+)?\)")


def fail(message: str) -> None:
    print(f"ERRO: {message}", file=sys.stderr)
    raise SystemExit(1)


def check_skills() -> int:
    names: set[str] = set()
    files = sorted(SKILLS.glob("*/SKILL.md"))
    if not files:
        fail("nenhuma skill encontrada")
    for file in files:
        content = file.read_text(encoding="utf-8")
        parts = content.split("---", 2)
        if len(parts) != 3 or parts[0].strip():
            fail(f"frontmatter ausente: {file}")
        metadata = dict(re.findall(r"^(name|description):\s*(.+)$", parts[1], re.M))
        name = metadata.get("name", "").strip()
        description = metadata.get("description", "").strip()
        if not NAME.fullmatch(name) or name != file.parent.name:
            fail(f"nome inválido ou divergente: {file}")
        if not description or len(description) > 1024 or name in names:
            fail(f"descrição/nome duplicado: {file}")
        names.add(name)
        for target in LINK.findall(parts[2]):
            if not (file.parent / target).is_file():
                fail(f"referência ausente: {file.parent / target}")
        if re.search(r"(?m)^\s*(?:#\s*)?TODO(?:\s|:)", content) or "<modelo" in content:
            fail(f"placeholder não resolvido: {file}")
    return len(files)


def check_agents() -> int:
    files = sorted(AGENTS.glob("*.toml"))
    if not files:
        fail("nenhum agente encontrado")
    names: set[str] = set()
    for file in files:
        data = tomllib.loads(file.read_text(encoding="utf-8"))
        if not all(isinstance(data.get(key), str) and data[key].strip() for key in ("name", "description", "developer_instructions")):
            fail(f"campos obrigatórios ausentes: {file}")
        if data["name"] != file.stem or data["name"] in names:
            fail(f"nome de agente divergente/duplicado: {file}")
        if data.get("sandbox_mode") != "read-only":
            fail(f"agente sem modo de leitura: {file}")
        names.add(data["name"])
    return len(files)


if __name__ == "__main__":
    print(f"OK: {check_skills()} skills e {check_agents()} agentes validados")
