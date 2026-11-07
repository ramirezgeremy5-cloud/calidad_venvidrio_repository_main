from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv
from pathlib import Path
import psycopg2
from urllib.parse import quote_plus
import os

Base = declarative_base()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

# 1. Intentamos obtener la URL completa (para Producción/Render)
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    print("✅ Usando DATABASE_URL de producción (Render)")
    
    # Corrección por si la URL no tiene el sslmode requerido por Supabase
    if "sslmode=require" not in DATABASE_URL:
        if "?" in DATABASE_URL:
            DATABASE_URL += "&sslmode=require"
        else:
            DATABASE_URL += "?sslmode=require"
            
else:
    # 2. Si no existe, usamos la lógica local (para tu PC)
    print("========== CONFIG LOCAL ==========")
    print("HOST:", os.getenv("DB_HOST"))
    print("PORT:", os.getenv("DB_PORT"))
    print("DB:", os.getenv("DB_NAME"))
    print("USER:", os.getenv("DB_USER"))
    print("PASSWORD:", os.getenv("DB_PASSWORD"))
    print("==================================")

    # Prueba de conexión directa (solo para local)
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
        )
        print("✅ Conexión directa exitosa")
        conn.close()
    except Exception as e:
        print("❌ Error de conexión directa:")
        print(repr(e))
        raise

    # Construcción de la URL para local (con quote_plus para contraseñas con caracteres especiales)
    DB_USER = os.getenv('DB_USER')
    DB_PASSWORD = quote_plus(os.getenv('DB_PASSWORD', ''))
    DB_HOST = os.getenv('DB_HOST')
    DB_PORT = os.getenv('DB_PORT')
    DB_NAME = os.getenv('DB_NAME')

    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

print(f"🔗 URL de conexión final configurada (Oculta por seguridad).")

# ==========================================
# CONFIGURACIÓN DEL ENGINE (Optimizado para Render + Supabase)
# ==========================================
try:
    engine = create_engine(
        DATABASE_URL,
        echo=False, # Ponlo en True solo si necesitas ver las consultas SQL en consola
        poolclass=NullPool, # 👈 CRUCIAL para evitar el colapso de conexiones en Supabase
        pool_pre_ping=True  # Verifica que la conexión esté viva antes de usarla
    )
    print("✅ Engine de SQLAlchemy creado correctamente.")
except Exception as e:
    print(f"❌ Error al crear el engine de SQLAlchemy: {e}")
    raise

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)