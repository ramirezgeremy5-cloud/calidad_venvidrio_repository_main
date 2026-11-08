from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import configure_mappers
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
import os
import traceback

from app.database.connection import engine, Base


# =========================
# MODELOS (ORDEN CRÍTICO)
# =========================
# 👇 IMPORTANTE: Importar TODOS los modelos que tienen relaciones
from app.models.usuario import Usuario
from app.models.cargo import Cargo
from app.models.defecto import Defecto
from app.models.auditoria_producto import AuditoriaProducto


# =========================
# ROUTERS
# =========================

from app.routes import usuarios
from app.routes import auth
from app.routes import clientes
from app.routes import productos
from app.routes import produccion
from app.routes import etiqueta
from app.routes import defecto
from app.routes import defecto_tipos
from app.routes import auditoria_interna
from app.routes import auditoria_producto
from app.routes import dashboard
from app.routes import reportes
from app.routes import reportes_defectos
from app.routes import cargos
from app.routes import escaner


# =========================
# SCHEDULER: LIMPIEZA DE SESIONES EXPIRADAS
# =========================

# 👇 ALINEADO CON auth.py Y dependencies/auth.py: 60 MINUTOS
TIEMPO_INACTIVIDAD_MINUTOS = 60

scheduler = BackgroundScheduler()


def limpiar_sesiones_expiradas():
    try:
        limite = (datetime.utcnow() - timedelta(minutes=TIEMPO_INACTIVIDAD_MINUTOS)).isoformat()
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                    UPDATE usuarios
                    SET session_id = NULL,
                        ultima_actividad = NULL
                    WHERE session_id IS NOT NULL
                      AND (ultima_actividad IS NULL OR ultima_actividad < :limite)
                """),
                {"limite": limite}
            )
            conn.commit()
            if result.rowcount:
                print(f"♻️ [Scheduler] {result.rowcount} sesiones expiradas liberadas")
    except Exception as e:
        print(f"⚠️ [Scheduler] Error limpiando sesiones: {e}")


# =========================
# LIFESPAN (STARTUP + SHUTDOWN)
# =========================

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 60)
    print("🐉 MoonDRAGO — Sistema de Control de Calidad")
    print("   Desarrollado para Venvidrio C.A.")
    print("=" * 60)
    print("🚀 MoonDRAGO API iniciada")
    
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("📦 Base de datos conectada correctamente")
    except Exception as e:
        print(f"❌ ERROR CRÍTICO: No se pudo conectar a la base de datos: {e}")

    scheduler.add_job(
        limpiar_sesiones_expiradas,
        "interval",
        minutes=5,
        id="limpiar_sesiones",
        replace_existing=True
    )
    scheduler.start()
    print("🧹 Scheduler de limpieza de sesiones iniciado (cada 5 min)")

    print("=" * 60)
    print("🌐 CORS habilitado para puertos locales y Render")
    print("=" * 60)

    yield

    try:
        print("🛑 Deteniendo scheduler de limpieza...")
        if scheduler.running:
            scheduler.shutdown(wait=False)
    except Exception as e:
        print(f"⚠️ Error deteniendo scheduler: {e}")
    print("👋 MoonDRAGO API detenida")


# =========================
# CREACIÓN APP
# =========================

app = FastAPI(
    title="MoonDRAGO — Sistema de Control de Calidad",
    version="1.0.0",
    description="Sistema de Control de Calidad Venvidrio — Desarrollado como MoonDRAGO",
    lifespan=lifespan
)


# =========================
# CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS (FOTOS)
# =========================

UPLOAD_DIR = "app/static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory="app/static"), name="static")


# =========================
# CORS FRONTEND (BLINDADO PARA RENDER)
# =========================

origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://192.168.1.103:5500",
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "http://127.0.0.1:5502",
    "http://localhost:5502",
    "http://127.0.0.1:5503",
    "http://localhost:5503",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    # 👇 DOMINIOS DE PRODUCCIÓN EN RENDER
    "https://venvidrio-calidad.onrender.com",
    "https://calidad-venvidrio-repository-main.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):[0-9]{4,5}",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# =========================
# CREAR TABLAS (CON MANEJO DE ERRORES)
# =========================

try:
    # 👇 FORZAMOS A SQLALCHEMY A MAPEAR TODOS LOS MODELOS ANTES DE CREAR TABLAS
    configure_mappers()
    print("✅ Mapeo de modelos verificado correctamente.")
    
    Base.metadata.create_all(bind=engine)
    print("✅ Tablas creadas/verificadas exitosamente.")
except Exception as e:
    print(f"⚠️ Error al configurar mappers o crear tablas: {e}")
    print("⚠️ Si el error es de relación, revisa que los modelos tengan los back_populates correctos.")


# =========================
# REGISTRO ROUTERS
# =========================

app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(cargos.router)

app.include_router(clientes.router)
app.include_router(productos.router)
app.include_router(produccion.router)
app.include_router(etiqueta.router)
app.include_router(defecto_tipos.router)
app.include_router(defecto.router)

# 👇 ROUTERS DE AUDITORÍA
app.include_router(auditoria_interna.router)
app.include_router(auditoria_producto.router)

app.include_router(dashboard.router)

app.include_router(reportes.router)
app.include_router(reportes_defectos.router)

# 👇 REGISTRO DEL ROUTER DEL ESCÁNER
app.include_router(escaner.router)


# =========================
# HOME
# =========================

@app.get("/")
def home():
    return {
        "status": "ok",
        "service": "MoonDRAGO",
        "system": "Venvidrio Calidad",
        "message": "API MoonDRAGO funcionando correctamente",
        "documentation": "/docs",
        "auth": {
            "login": "/auth/login",
            "register": "/auth/registro",
            "logout": "/auth/logout",
            "me": "/usuarios/me"
        }
    }


# =========================
# HEALTH DATABASE
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


# =========================
# HEALTH CHECK GENERAL
# =========================

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "MoonDRAGO",
        "system": "Venvidrio Calidad",
        "version": "1.0.0",
        "database": "conectada" if engine else "desconectada",
        "session": {
            "inactividad_minutos": TIEMPO_INACTIVIDAD_MINUTOS,
            "scheduler": "activo (limpieza cada 5 min)"
        }
    }


# =========================
# MANEJO DE ERRORES GLOBAL
# =========================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"❌ [MoonDRAGO] ERROR NO MANEJADO en {request.url.path}: {exc}")
    traceback.print_exc()

    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "service": "MoonDRAGO",
            "detail": str(exc),
            "path": request.url.path,
            "traceback": traceback.format_exc()
        }
    )


# =========================
# EJECUCIÓN (Opcional)
# =========================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )