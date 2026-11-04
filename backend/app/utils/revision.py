import json
from pathlib import Path
from datetime import datetime

COUNTER_PATH = Path(__file__).parent.parent / "static" / "revision_counter.json"


def _leer_contador() -> dict:
    """Lee el archivo JSON con los contadores. Si no existe, lo crea."""
    if not COUNTER_PATH.exists():
        COUNTER_PATH.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "produccion": 17,
            "defectos": 17,
            "auditoria": 17,
            "ultima_actualizacion": datetime.now().isoformat()
        }
        COUNTER_PATH.write_text(json.dumps(data, indent=2), encoding='utf-8')
        return data

    try:
        return json.loads(COUNTER_PATH.read_text(encoding='utf-8'))
    except (json.JSONDecodeError, OSError):
        return {"produccion": 1, "defectos": 1, "auditoria": 1}


def _guardar_contador(data: dict):
    COUNTER_PATH.parent.mkdir(parents=True, exist_ok=True)
    data["ultima_actualizacion"] = datetime.now().isoformat()
    COUNTER_PATH.write_text(json.dumps(data, indent=2), encoding='utf-8')


def obtener_numero_revision(tipo: str = "produccion", incrementar: bool = True) -> int:
    """
    Devuelve el número de revisión actual.
    Si incrementar=True, incrementa el contador y guarda.
    """
    data = _leer_contador()
    actual = int(data.get(tipo, 1))

    if incrementar:
        data[tipo] = actual + 1
        _guardar_contador(data)

    return actual


def consultar_numero_revision(tipo: str = "produccion") -> int:
    """Solo consulta sin incrementar."""
    data = _leer_contador()
    return int(data.get(tipo, 1))