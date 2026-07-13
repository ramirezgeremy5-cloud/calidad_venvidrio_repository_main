from fastapi import FastAPI
from sqlalchemy import text

from app.database.connection import engine, Base

from app.models.usuario import Usuario
from app.models.produccion import Produccion
from app.models.etiqueta import Etiqueta
from app.models.defecto import Defecto
from app.models.auditoria import Auditoria
# routers
from app.routes import usuarios
from app.routes import auth   # 👈 NUEVO
from app.routes import produccion
from app.routes import etiqueta
from app.routes import defecto
from app.routes import auditoria
app = FastAPI(title="Venvidrio API")

# crear tablas
Base.metadata.create_all(bind=engine)

# =========================
# ROUTERS
# =========================
app.include_router(usuarios.router)
app.include_router(auth.router)   # 👈 LOGIN
app.include_router(produccion.router)
app.include_router(etiqueta.router)
app.include_router(defecto.router)
app.include_router(auditoria.router)
# =========================
# HOME
# =========================
@app.get("/")
def home():
    return {
        "status": "ok",
        "service": "venvidrio_calidad"
    }

# =========================
# HEALTH CHECK DB
# =========================
@app.get("/health/db")
def health_db():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))

        return {
            "database": "venvidrio_calidad",
            "status": "connected"
        }

    except Exception as e:
        return {
            "status": "error",
            "detail": str(e)
        }