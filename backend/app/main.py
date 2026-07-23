from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database.connection import engine, Base


# =========================
# MODELOS
# =========================

from app.models.usuario import Usuario
from app.models.produccion import Produccion
from app.models.etiqueta import Etiqueta
from app.models.defecto import Defecto
from app.models.auditoria import Auditoria



# =========================
# ROUTERS
# =========================

from app.routes import usuarios
from app.routes import auth
from app.routes import produccion
from app.routes import etiqueta
from app.routes import defecto
from app.routes import auditoria
from app.routes import dashboard



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

    "http://localhost:5501"

]


app.add_middleware(

    CORSMiddleware,

    allow_origins=origins,

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)



# =========================
# CREAR TABLAS
# =========================

Base.metadata.create_all(

    bind=engine

)



# =========================
# REGISTRO ROUTERS
# =========================

app.include_router(

    usuarios.router

)


app.include_router(

    auth.router

)


app.include_router(

    produccion.router

)


app.include_router(

    etiqueta.router

)


app.include_router(

    defecto.router

)


app.include_router(

    auditoria.router

)


app.include_router(

    dashboard.router

)



# =========================
# HOME
# =========================

@app.get("/")
def home():

    return {

        "status": "ok",

        "service": "venvidrio_calidad",

        "message":
            "API funcionando correctamente"

    }



# =========================
# HEALTH DATABASE
# =========================

@app.get("/health/db")
def health_db():

    try:

        with engine.connect() as conn:

            conn.execute(
                text("SELECT 1")
            )


        return {

            "database":
                "venvidrio_calidad",

            "status":
                "connected"

        }


    except Exception as e:


        return {

            "status":
                "error",

            "detail":
                str(e)

        }



# =========================
# STARTUP
# =========================

@app.on_event("startup")
def startup_event():

    print("===============================")
    print("🚀 Venvidrio API iniciada")
    print("📦 PostgreSQL conectado")
    print("🌐 CORS habilitado")
    print("===============================")