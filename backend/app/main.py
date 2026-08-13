from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database.connection import engine, Base


# =========================
# MODELOS (ORDEN CRÍTICO)
# =========================

# 1. Modelos "Padre" (Los que no dependen de nadie)
from app.models.usuario import Usuario
from app.models.cliente import Cliente

# 2. Modelos que dependen de los padres
from app.models.produccion import Produccion
from app.models.etiqueta import Etiqueta
from app.models.defecto import Defecto
from app.models.auditoria import Auditoria


# =========================
# ROUTERS
# =========================

from app.routes import usuarios
from app.routes import auth
from app.routes import clientes
from app.routes import produccion
from app.routes import etiqueta
from app.routes import defecto
from app.routes import auditoria
from app.routes import dashboard
from app.routes import reportes
from app.routes import reportes_produccion


# =========================
# CREACIÓN APP
# =========================

app = FastAPI(
    title="Venvidrio API",
    version="1.0.0",
    description="Sistema de Control de Calidad Venvidrio"
)


# =========================
# CORS FRONTEND
# =========================

origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "http://127.0.0.1:5502",
    "http://localhost:5502",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "*"  # Solo para desarrollo, quitar en producción
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# CREAR TABLAS (Con protección)
# =========================

try:
    Base.metadata.create_all(
        bind=engine
    )
    print("✅ Tablas creadas/verificadas exitosamente.")
except Exception as e:
    print(f"⚠️ Advertencia al crear tablas (puede ser normal si ya existen): {e}")


# =========================
# REGISTRO ROUTERS
# =========================

# Rutas de autenticación y usuarios
app.include_router(auth.router)           # Login, Logout, Recuperación
app.include_router(usuarios.router)       # CRUD de usuarios

# Rutas de negocio
app.include_router(clientes.router)
app.include_router(produccion.router)
app.include_router(etiqueta.router)
app.include_router(defecto.router)
app.include_router(auditoria.router)
app.include_router(dashboard.router)
app.include_router(reportes.router)
app.include_router(reportes_produccion.router)


# =========================
# HOME
# =========================

@app.get("/")
def home():
    return {
        "status": "ok",
        "service": "venvidrio_calidad",
        "message": "API funcionando correctamente",
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
        "service": "venvidrio_calidad",
        "version": "1.0.0",
        "endpoints": {
            # Autenticación
            "auth": {
                "login": "/auth/login",
                "register": "/auth/registro",
                "logout": "/auth/logout",
                "recuperar": "/auth/recuperar-password",
                "restablecer": "/auth/restablecer-password"
            },
            # Usuarios
            "usuarios": {
                "listar": "/usuarios/",
                "me": "/usuarios/me",
                "crear": "/usuarios/",
                "actualizar": "/usuarios/{id}",
                "cambiar_password": "/usuarios/cambiar-password",
                "activar": "/usuarios/{id}/activar",
                "desactivar": "/usuarios/{id}/desactivar",
                "eliminar": "/usuarios/{id}"
            },
            # Negocio
            "clientes": "/clientes",
            "produccion": "/produccion",
            "auditorias": "/auditorias",
            "defectos": "/defectos",
            "etiquetas": "/etiquetas",
            "dashboard": "/dashboard",
            "reportes": {
                "auditorias_excel": "/reportes/auditorias/excel",
                "auditorias_pdf": "/reportes/auditorias/pdf",
                "produccion_excel": "/reportes/produccion/excel/{id}",
                "produccion_pdf": "/reportes/produccion/pdf/{id}"
            }
        }
    }


# =========================
# STARTUP
# =========================

@app.on_event("startup")
def startup_event():
    print("=" * 60)
    print("🚀 Venvidrio API iniciada")
    print("📦 PostgreSQL conectado")
    print("🌐 CORS habilitado")
    print("=" * 60)
    print("📋 Endpoints disponibles:")
    print()
    print("  🔐 AUTENTICACIÓN:")
    print("     POST   /auth/login")
    print("     POST   /auth/registro")
    print("     POST   /auth/logout")
    print("     POST   /auth/recuperar-password")
    print("     POST   /auth/restablecer-password")
    print()
    print("  👤 USUARIOS:")
    print("     GET    /usuarios/")
    print("     GET    /usuarios/me")
    print("     POST   /usuarios/")
    print("     GET    /usuarios/{id}")
    print("     PUT    /usuarios/{id}")
    print("     POST   /usuarios/cambiar-password")
    print("     PATCH  /usuarios/{id}/activar")
    print("     PATCH  /usuarios/{id}/desactivar")
    print("     DELETE /usuarios/{id}")
    print()
    print("  📊 NEGOCIO:")
    print("     GET    /clientes")
    print("     POST   /clientes")
    print("     GET    /produccion")
    print("     POST   /produccion")
    print("     PUT    /produccion/{id}")
    print("     DELETE /produccion/{id}")
    print("     GET    /auditorias")
    print("     POST   /auditorias")
    print("     PUT    /auditorias/{id}")
    print("     DELETE /auditorias/{id}")
    print("     GET    /defectos")
    print("     GET    /etiquetas")
    print("     GET    /dashboard")
    print()
    print("  📄 REPORTES:")
    print("     GET    /reportes/auditorias/excel")
    print("     GET    /reportes/auditorias/pdf")
    print("     GET    /reportes/produccion/excel/{id}")
    print("     GET    /reportes/produccion/pdf/{id}")
    print()
    print("  📚 DOCUMENTACIÓN:")
    print("     GET    /docs")
    print("     GET    /redoc")
    print("=" * 60)


# =========================
# MANEJO DE ERRORES GLOBAL
# =========================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return {
        "status": "error",
        "detail": str(exc),
        "path": request.url.path
    }


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